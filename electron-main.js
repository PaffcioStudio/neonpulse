// === ELECTRON MAIN – NeonPulse Player v3.4 ===

// Wyłącz sandbox jako pierwsze - musi być przed jakąkolwiek inicjalizacją
process.env.ELECTRON_NO_SANDBOX = '1';
process.env.LIBVA_DRIVER_NAME = process.env.LIBVA_DRIVER_NAME || 'dummy';

// KRYTYCZNE: te flagi MUSZĄ być ustawione przed require('electron')
// Na NVIDIA + Wayland proces GPU crashuje z "Unable to initialize SkSurface"
// appendSwitch() po require() działa za późno dla flag GPU
// Jedyne niezawodne rozwiązanie: ustaw je przez argv zanim Node załaduje moduły
const { app } = require('electron');

// Wymuś disable-gpu jako pierwsze - zanim cokolwiek innego
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Wayland
const isWayland = !!(process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland');
if (isWayland) {
  app.commandLine.appendSwitch('ozone-platform', 'wayland');
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
} else {
  app.commandLine.appendSwitch('ozone-platform', 'x11');
}

const { BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, globalShortcut, shell } = require('electron');
const path = require('path');
const os   = require('os');

// Ścieżka do katalogu okładek – identyczna logika jak w server.js
// Potrzebna do konwersji http://localhost/covers/... → file:///...  dla MPRIS artUrl
const NEONPULSE_COVERS_DIR = (() => {
  const base = process.env.NEONPULSE_DATA ||
    (process.platform === 'win32'
      ? path.join(process.env.APPDATA || os.homedir(), 'neonpulse')
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', 'neonpulse')
        : path.join(os.homedir(), '.neonpulse'));
  return path.join(base, 'covers');
})();

// Zamień http://localhost:PORT/covers/file.jpg → file:///~/.neonpulse/covers/file.jpg
// KDE Plasma widget nie pobiera okładek z localhost (loopback blokowany),
// ale file:// działa bez problemu.
function toFileArtUrl(url) {
  if (!url) return '';
  const m = url.match(/\/covers\/([^/?#]+)$/);
  if (m) return `file://${NEONPULSE_COVERS_DIR}/${m[1]}`;
  if (url.startsWith('http')) return ''; // inny http – odpuść
  if (!url.startsWith('file://')) return `file://${url}`;
  return url;
}

// ─── Backend server (inline – nie fork!) ─────────────────────
// fork() używa systemowego Node.js, który nie może załadować
// natywnych modułów (better-sqlite3) skompilowanych pod Electron.
// Ładujemy server.js bezpośrednio w tym samym procesie Electron.
async function startServer() {
  try {
    const serverPath = path.join(__dirname, 'server.js');
    require(serverPath);
    // Poczekaj aż serwer faktycznie zacznie nasłuchiwać (max 10s)
    const http = require('http');
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        const req = http.request({ hostname: '127.0.0.1', port: 3001, path: '/api/library', method: 'GET' }, (res) => {
          res.resume();
          resolve();
        });
        req.on('error', () => {
          attempts++;
          if (attempts > 50) return reject(new Error('Serwer nie wystartował w 10s'));
          setTimeout(check, 200);
        });
        req.end();
      };
      check();
    });
    console.log('[SERVER] Uruchomiony i gotowy, port 3001');
  } catch (e) {
    console.error('[SERVER] BŁĄD KRYTYCZNY - serwer nie wystartował:', e);
  }
}

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch {}
});

// ─── Globalna ochrona przed EPIPE z dbus-next / mpris-service ─
// Na Wayland D-Bus gniazdo może się zerwać gdy KDE przeładowuje
// Plasma albo zamknął się Media Player widget. dbus-next rzuca
// "Error: write EPIPE" jako uncaughtException – bez przechwycenia
// Electron wyświetla dialog błędu i może się wysypać.
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.message?.includes('EPIPE')) {
    console.warn('[DBUS] EPIPE – D-Bus gniazdo zerwane, ponawiam MPRIS za 2s...');
    mprisAvailable = false;
    if (mprisPlayer) {
      try { mprisPlayer._bus.disconnect(); } catch {}
      mprisPlayer = null;
    }
    // D-Bus daemon automatycznie zwalnia nazwę gdy klient się rozłącza.
    // 2s wystarczą żeby daemon przetworzył rozłączenie przed nową rejestracją.
    setTimeout(() => tryInitMPRIS(), 2000);
    return;
  }
  console.error('[MAIN] Nieobsłużony wyjątek:', err);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('EPIPE')) {
    console.warn('[DBUS] unhandledRejection EPIPE – ignoruję');
    return;
  }
  console.error('[MAIN] Nieobsłużona obietnica:', reason);
});

app.setName('NeonPulse Player');


// ─── Wayland / X11 – już ustawione na górze pliku przed require('electron') ──

// ─── GPU / sandbox – już ustawione na górze pliku przed require('electron') ──

let mainWindow;
let tray;
let mprisPlayer;
let mprisAvailable = false;
let currentPlayerState = { isPlaying: false, title: '', artist: '', volume: 1.0 };
let currentPlaybackPosition = 0; // aktualna pozycja w sekundach (aktualizowana przez IPC)
let appSettings = {
  minimizeToTray: true,
  startMinimized: false,
  showTrayControls: true,
  hardwareAccel: false,
};

// ─── MPRIS ────────────────────────────────────────────────────
async function tryInitMPRIS() {
  if (process.platform !== 'linux') return;

  // Prawdziwe zamknięcie poprzedniej instancji:
  // _bus.disconnect() zamyka gniazdo Unix do D-Bus – nazwa jest zwalniana
  // automatycznie przez D-Bus daemon gdy klient się rozłącza.
  // Samo mprisPlayer.quit() NIE ISTNIEJE jako metoda – to tylko event D-Bus.
  // releaseName() nie wystarczy bo _bus wciąż żyje i może re-zarejestrować.
  if (mprisPlayer) {
    mprisAvailable = false;
    try { mprisPlayer._bus.disconnect(); } catch {}
    mprisPlayer = null;
    // Poczekaj aż D-Bus daemon przetworzy rozłączenie i zwolni nazwę
    await new Promise(r => setTimeout(r, 500));
  }

  try {
    const mpris = require('mpris-service');
    mprisPlayer = mpris({
      name:                'neonpulse',
      identity:            'NeonPulse Player',
      supportedInterfaces: ['player'],
      desktopEntry:        'pl.paffcio.neonpulse',
    });
    mprisPlayer.canPlay = mprisPlayer.canPause = mprisPlayer.canGoNext =
      mprisPlayer.canGoPrevious = mprisPlayer.canSeek = mprisPlayer.canControl = true;
    mprisPlayer.playbackStatus = 'Stopped';
    mprisAvailable = true;

    mprisPlayer.getPosition = () => Math.floor(currentPlaybackPosition * 1_000_000);

    const send = (cmd) => { if (mainWindow) mainWindow.webContents.send('player:command', cmd); };
    mprisPlayer.on('play',        () => send('play'));
    mprisPlayer.on('pause',       () => send('pause'));
    mprisPlayer.on('playpause',   () => send('playpause'));
    mprisPlayer.on('next',        () => send('next'));
    mprisPlayer.on('previous',    () => send('previous'));

    mprisPlayer.on('seek', (offsetUs) => {
      const newPos = currentPlaybackPosition + (offsetUs / 1_000_000);
      if (mainWindow) mainWindow.webContents.send('app:seek-to', Math.max(0, newPos));
    });

    mprisPlayer.on('position', ({ position }) => {
      const newPos = position / 1_000_000;
      if (mainWindow) mainWindow.webContents.send('app:seek-to', Math.max(0, newPos));
    });

    if (mprisPlayer.serviceName?.includes('.instance')) {
      console.warn('[MPRIS] UWAGA: zarejestrowano jako', mprisPlayer.serviceName,
        '– stara instancja wciąż żyje na D-Bus! Uruchom: killall neonpulse-player');
    } else {
      console.log('[MPRIS] OK –', mprisPlayer.serviceName);
    }
  } catch (e) { console.warn('[MPRIS] Niedostępny:', e.message); }
}

// ─── TRAY MENU ────────────────────────────────────────────────
function buildTrayMenu(showControls) {
  const template = [];

  if (currentPlayerState.title) {
    template.push({ label: currentPlayerState.title, enabled: false });
    if (currentPlayerState.artist) template.push({ label: currentPlayerState.artist, enabled: false });
    template.push({ type: 'separator' });
  }

  if (showControls) {
    const playLabel = currentPlayerState.isPlaying ? 'Pauza' : 'Odtwarzaj';
    template.push(
      { label: playLabel,   click: () => sendCmd('playpause') },
      { label: 'Poprzedni', click: () => sendCmd('previous')  },
      { label: 'Następny',  click: () => sendCmd('next')      },
      { type: 'separator' }
    );
  }

  template.push(
    { label: 'Pokaż / Ukryj', click: () => toggleWindow() },
    { type: 'separator' },
    { label: 'Wyjdź', click: () => { app.isQuitting = true; app.quit(); } }
  );

  return Menu.buildFromTemplate(template);
}

function sendCmd(cmd) { if (mainWindow) mainWindow.webContents.send('player:command', cmd); }
function toggleWindow() {
  if (!mainWindow) return;
  mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
}

function updateTrayMenu(showControls) {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu(showControls ?? true));
}

// ─── OKNO ─────────────────────────────────────────────────────
function createWindow() {
  let windowIcon;
  try {
    const iconBase = app.isPackaged
      ? path.join(process.resourcesPath, 'icons')
      : path.join(__dirname, 'resources/icons');
    windowIcon = nativeImage.createFromPath(path.join(iconBase, '256x256.png'));
  } catch {}

  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width:  1366, height: 900,
    minWidth: 920, minHeight: 600,
    title: 'NeonPulse Player',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    icon: windowIcon,
    // Nie pokazuj okna dopóki strona się nie załaduje – eliminuje biały ekran
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  // ─── Logi z procesu renderera ────────────────────────────────
  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    const lvl = ['verbose', 'info', 'warn', 'error'][level] || 'info';
    console.log(`[RENDERER:${lvl.toUpperCase()}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_, errCode, errDesc, url) => {
    console.error(`[WINDOW] did-fail-load: ${errDesc} (${errCode}) url=${url}`);
    if (isDev) {
      console.error('[WINDOW] Vite jeszcze nie wystartował? Retry za 2s...');
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL('http://localhost:5173');
      }, 2000);
    }
  });

  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[WINDOW] Ładowanie strony...');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[WINDOW] Strona załadowana.');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[WINDOW] DOM gotowy.');
    // DevTools – otwórz automatycznie w trybie dev (możesz też użyć Ctrl+Shift+I)
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      console.log('[WINDOW] DevTools otwarte (tryb dev).');
    }
  });

  // ready-to-show jest bardziej niezawodne niż dom-ready dla pokazania okna
  // szczególnie na Wayland + disable-gpu gdzie renderowanie jest opóźnione
  mainWindow.once('ready-to-show', () => {
    console.log('[WINDOW] ready-to-show – pokazuję okno.');
    if (!appSettings.startMinimized) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Fallback: jeśli ready-to-show nie odpali w 5s (bug Wayland), pokaż okno na siłę
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.warn('[WINDOW] Fallback show po 5s (ready-to-show nie odpalił).');
      mainWindow.show();
    }
  }, 5000);

  mainWindow.webContents.on('crashed', (_, killed) => {
    console.error(`[WINDOW] Renderer CRASHED! killed=${killed}`);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[WINDOW] Renderer nie odpowiada!');
  });

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('[WINDOW] Renderer process gone:', JSON.stringify(details));
  });

  if (isDev) {
    console.log('[WINDOW] Tryb dev – ładuję http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    console.log('[WINDOW] Tryb produkcyjny – ładuję dist/index.html za 1.5s');
    // Odczekaj chwilę na start serwera Express przed załadowaniem UI
    setTimeout(() => {
      mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }, 1500);
  }

  mainWindow.on('close', (e) => {
    clearTimeout(showFallback);
    if (!app.isQuitting && appSettings.minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── TRAY ─────────────────────────────────────────────────────
function createTray() {
  let icon;
  try {
    const iconBase = app.isPackaged
      ? path.join(process.resourcesPath, 'icons')
      : path.join(__dirname, 'resources/icons');
    icon = nativeImage.createFromPath(path.join(iconBase, '32x32.png'));
  } catch { icon = nativeImage.createEmpty(); }

  tray = new Tray(icon);
  tray.setToolTip('NeonPulse Player');
  updateTrayMenu(true);

  // Lewy klik
  tray.on('click', () => toggleWindow());

  // Środkowy klik - pause/play
  // Na X11 działa natywnie; na Wayland Electron nie otrzymuje tego zdarzenia (ograniczenie protokołu)
  tray.on('middle-click', () => sendCmd('playpause'));

  // Scroll - głośność
  // Na X11 działa; na Wayland zablokowane przez compositor
  tray.on('scroll', (_event, direction, delta) => {
    const d = (delta && delta.y) ? (delta.y > 0 ? 0.05 : -0.05) : (direction === 'up' ? 0.05 : -0.05);
    if (mainWindow) mainWindow.webContents.send('player:volume-delta', d);
  });
}

// ─── IPC ──────────────────────────────────────────────────────
ipcMain.on('player:position', (_, posUs) => {
  currentPlaybackPosition = posUs / 1_000_000; // zapisz w sekundach
  if (!mprisAvailable || !mprisPlayer) return;
  try { mprisPlayer.position = posUs; } catch {}
});

ipcMain.on('player:update', (_, data) => {
  const { title, artist, album, cover, duration, position, isPlaying, showTrayControls, volume } = data;
  currentPlayerState = { isPlaying, title: title||'', artist: artist||'', volume: volume??1 };

  if (tray) {
    tray.setToolTip(title ? `NeonPulse – ${title}` : 'NeonPulse Player');
    updateTrayMenu(showTrayControls !== false);
  }

  if (!mprisAvailable || !mprisPlayer) return;
  try {
    // artUrl musi być file:// URI – KDE Plasma nie pobiera okładek z localhost
    let artUrl = toFileArtUrl(cover);

    mprisPlayer.metadata = {
      'mpris:trackid': mprisPlayer.objectPath('track/0'),
      'mpris:length':  Math.max(0, Math.floor((duration||0) * 1_000_000)),
      'mpris:artUrl':  artUrl,
      'xesam:title':   title  || '',
      'xesam:album':   album  || '',
      'xesam:artist':  [artist || ''],
    };
    mprisPlayer.position = Math.max(0, Math.floor((position||0) * 1_000_000));

    // Wymuś aktualizację playbackStatus nawet jeśli mpris-service myśli że się nie zmieniło.
    // Bez tego KDE nie odświeża ikonki play/pauza gdy zmiana przychodzi przez IPC z renderera.
    const newStatus = isPlaying ? 'Playing' : 'Paused';
    if (mprisPlayer.playbackStatus !== newStatus) {
      mprisPlayer.playbackStatus = newStatus;
    } else {
      // Wymuś PropertiesChanged emit przez tymczasową zmianę i powrót
      mprisPlayer.playbackStatus = isPlaying ? 'Paused' : 'Playing';
      setImmediate(() => {
        if (mprisPlayer) mprisPlayer.playbackStatus = newStatus;
      });
    }

    mprisPlayer.volume = Math.max(0, Math.min(1, volume ?? 1));
  } catch (e) { console.error('[MPRIS]', e.message); }
});

ipcMain.on('app:settings', (_, s) => {
  appSettings = { ...appSettings, ...s };
});

ipcMain.handle('get-platform', () => ({ platform: process.platform, isWayland }));

ipcMain.handle('open-external', (_, url) => {
  shell.openExternal(url);
});

ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const r = await dialog.showOpenDialog(mainWindow, { title:'Wybierz folder z muzyką', properties:['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

// ─── START ────────────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log('[APP] Electron gotowy, uruchamiam...');
  console.log(`[APP] Wayland: ${isWayland}, packaged: ${app.isPackaged}`);
  console.log(`[APP] userData: ${app.getPath('userData')}`);
  await startServer();
  createWindow();
  createTray();
  tryInitMPRIS();

  // Klawisze multimedialne - działają na Wayland i X11
  const keys = {
    'MediaPlayPause':    'playpause',
    'MediaNextTrack':    'next',
    'MediaPreviousTrack':'previous',
    'MediaStop':         'pause',
  };
  Object.entries(keys).forEach(([key, cmd]) => {
    try { globalShortcut.register(key, () => sendCmd(cmd)); } catch {}
  });

  // Ctrl+Shift+I – DevTools (zawsze dostępne, nie tylko w trybie dev)
  try {
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });
  } catch {}

  // F5 – odśwież w trybie dev
  if (!app.isPackaged) {
    try {
      globalShortcut.register('F5', () => {
        if (mainWindow) mainWindow.webContents.reload();
        console.log('[APP] Odświeżono renderer (F5)');
      });
    } catch {}
  }

  app.on('activate', () => { if (!mainWindow) createWindow(); else mainWindow.show(); });
});

app.on('window-all-closed',  () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit',        () => { app.isQuitting = true; });

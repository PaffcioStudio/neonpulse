#!/usr/bin/env node
/**
 * install-deb.js – instaluje/reinstaluje aktualnie zbudowany .deb
 * Użycie: npm run install-deb
 *
 * Algorytm:
 *  1. Czyta wersję z package.json (źródło prawdy)
 *  2. Szuka pliku release/neonpulse-player_<version>_amd64.deb
 *  3. Pyta o hasło sudo i instaluje przez pkexec lub sudo
 */

const fs    = require('fs');
const path  = require('path');
const cp    = require('child_process');
const readline = require('readline');

// ── Kolory terminalowe ──────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

function log(color, prefix, msg) {
  console.log(`${color}${c.bold}${prefix}${c.reset} ${msg}`);
}

function info(msg)  { log(c.cyan,   '[INFO]',    msg); }
function ok(msg)    { log(c.green,  '[OK]',      msg); }
function warn(msg)  { log(c.yellow, '[WARN]',    msg); }
function error(msg) { log(c.red,    '[BŁĄD]',    msg); }
function step(msg)  { log(c.gray,   '[...]',     msg); }

// ── Ścieżki ─────────────────────────────────────────────────────────────────
const ROOT        = path.resolve(__dirname, '..');
const PKG_PATH    = path.join(ROOT, 'package.json');
const RELEASE_DIR = path.join(ROOT, 'release');

// ── Walidacja ────────────────────────────────────────────────────────────────
if (!fs.existsSync(PKG_PATH)) {
  error('Nie znaleziono package.json. Uruchom z katalogu projektu.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const version = pkg.version;

// artifact naming: bez wersji w nazwie (stały URL dla update checka)
const ARCH     = 'amd64';
const DEB_NAME = `neonpulse-player_${ARCH}.deb`;
const DEB_PATH = path.join(RELEASE_DIR, DEB_NAME);

console.log('');
console.log(`${c.bold}${c.cyan}NeonPulse – Instalator .deb${c.reset}`);
console.log(`${c.gray}${'─'.repeat(45)}${c.reset}`);
info(`Wersja z package.json: ${c.bold}${version}${c.reset}`);
info(`Szukam:                ${c.bold}${DEB_PATH}${c.reset}`);
console.log('');

// ── Sprawdź czy plik istnieje ────────────────────────────────────────────────
if (!fs.existsSync(DEB_PATH)) {
  // Próba znalezienia jakiegokolwiek .deb w release/ żeby podpowiedzieć
  let found = [];
  if (fs.existsSync(RELEASE_DIR)) {
    found = fs.readdirSync(RELEASE_DIR).filter(f => f.endsWith('.deb'));
  }

  error(`Nie znaleziono pliku: ${DEB_NAME}`);

  if (found.length > 0) {
    warn('Znalezione .deb w release/:');
    found.forEach(f => console.log(`   ${c.yellow}→ ${f}${c.reset}`));
    warn('Sprawdź czy wersja w package.json zgadza się z zbudowanym plikiem.');
  } else {
    warn('Katalog release/ jest pusty lub nie istnieje. Uruchom najpierw: npm run dist');
  }

  console.log('');
  process.exit(1);
}

// ── Sprawdź rozmiar pliku (sanity check) ────────────────────────────────────
const stat = fs.statSync(DEB_PATH);
const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
ok(`Znaleziono: ${DEB_NAME} (${sizeMB} MB)`);
console.log('');

// ── Wybierz metodę instalacji ────────────────────────────────────────────────
function hasCmd(cmd) {
  try {
    cp.execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Preferuj pkexec (graficzne okno hasła w KDE/GNOME), fallback na sudo
const usePkexec = hasCmd('pkexec') && process.env.DISPLAY || process.env.WAYLAND_DISPLAY;
const installer = usePkexec ? 'pkexec' : 'sudo';

step(`Metoda instalacji: ${installer}`);
step(`Komenda: ${installer} dpkg -i "${DEB_PATH}"`);
console.log('');

// ── Zainstaluj ───────────────────────────────────────────────────────────────
info('Instaluję – za chwilę pojawi się prośba o hasło...');
console.log('');

const proc = cp.spawnSync(
  installer,
  ['dpkg', '-i', DEB_PATH],
  { stdio: 'inherit' }
);

console.log('');

if (proc.status === 0) {
  ok(`Zainstalowano pomyślnie: neonpulse-player ${version}`);
  console.log('');
  console.log(`${c.gray}Możesz uruchomić aplikację przez menu lub wpisując: neonpulse${c.reset}`);
} else if (proc.status === 126) {
  // pkexec: użytkownik anulował
  warn('Instalacja anulowana (odrzucono autoryzację).');
  process.exit(1);
} else {
  error(`dpkg zakończył się z kodem: ${proc.status}`);

  // Podpowiedź: dpkg może wymagać naprawy zależności
  console.log('');
  warn('Jeśli widzisz błędy zależności, uruchom:');
  console.log(`   ${c.cyan}sudo apt-get install -f${c.reset}`);
  process.exit(proc.status ?? 1);
}

#!/bin/bash
# Skrypt poinstalacyjny NeonPulse Player
# Uruchamiany automatycznie przez dpkg po instalacji .deb

WRAPPER="/usr/local/bin/neonpulse"

# ─── 1. Znajdź faktyczną ścieżkę instalacji ──────────────────
EXEC_PATH=""

EXEC_PATH=$(dpkg -L neonpulse-player 2>/dev/null \
  | grep -E '/neonpulse-player$' \
  | grep -v chrome-sandbox \
  | grep -v '\.sh$' \
  | head -1)

if [ -z "$EXEC_PATH" ]; then
  EXEC_PATH=$(find /opt -maxdepth 3 -name "neonpulse-player" \
    -not -name "*.sh" -type f 2>/dev/null | head -1)
fi

if [ -z "$EXEC_PATH" ]; then
  echo "[NeonPulse] BŁĄD: Nie znaleziono pliku wykonywalnego!" >&2
  echo "[NeonPulse] Sprawdź: dpkg -L neonpulse-player" >&2
  exit 1
fi

INSTALL_DIR=$(dirname "$EXEC_PATH")
echo "[NeonPulse] Znaleziono: $EXEC_PATH"

# ─── 2. Napraw uprawnienia chrome-sandbox ────────────────────
SANDBOX="$INSTALL_DIR/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  chown root "$SANDBOX"
  chmod 4755 "$SANDBOX"
  echo "[NeonPulse] Naprawiono chrome-sandbox."
fi

# ─── 3. Utwórz wrapper /usr/local/bin/neonpulse ──────────────
cat > "$WRAPPER" << WRAPPER_EOF
#!/bin/bash
# NeonPulse Player wrapper - wygenerowany przez after-install.sh
export ELECTRON_NO_SANDBOX=1
export LIBVA_DRIVER_NAME=dummy
exec "$EXEC_PATH" \\
  --no-sandbox \\
  --disable-gpu-sandbox \\
  --ozone-platform=wayland \\
  --enable-features=WaylandWindowDecorations \\
  --disable-gpu \\
  --disable-software-rasterizer \\
  "\$@"
WRAPPER_EOF
chmod +x "$WRAPPER"
echo "[NeonPulse] Wrapper: $WRAPPER"

# ─── 4. Zainstaluj ikonę do systemu ──────────────────────────
# Uwaga: electron-builder parsuje caly tekst skryptu wlacznie z komentarzami.
# Dlatego nie uzywamy petli ze zmiennymi w nawiasach klamrowych.
install_icon() {
  local dim="$1"
  local src="$INSTALL_DIR/resources/app/build/icons/$dim.png"
  if [ ! -f "$src" ]; then
    src="$INSTALL_DIR/resources/app.asar.unpacked/build/icons/$dim.png"
  fi
  if [ -f "$src" ]; then
    mkdir -p "/usr/share/icons/hicolor/$dim/apps"
    cp "$src" "/usr/share/icons/hicolor/$dim/apps/neonpulse-player.png"
  fi
}
install_icon "16x16"
install_icon "22x22"
install_icon "32x32"
install_icon "48x48"
install_icon "64x64"
install_icon "96x96"
install_icon "128x128"
install_icon "256x256"
install_icon "512x512"
gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
echo "[NeonPulse] Ikony zainstalowane."

# ─── 5. Napraw plik .desktop ─────────────────────────────────
# electron-builder tworzy neonpulse-player.desktop - usuń go, żeby KDE
# nie widział dwóch osobnych wpisów (dwóch zakładek w Media Player).
# Jedyny poprawny plik to pl.paffcio.neonpulse.desktop tworzony poniżej.
for f in \
  "/usr/share/applications/neonpulse-player.desktop" \
  "/usr/share/applications/neonpulse.desktop"; do
  [ -f "$f" ] && rm -f "$f" && echo "[NeonPulse] Usunięto duplikat: $f"
done

# Utwórz (lub nadpisz) jedyny poprawny plik .desktop
CORRECT_DESKTOP="/usr/share/applications/pl.paffcio.neonpulse.desktop"
cat > "$CORRECT_DESKTOP" << DESKTOP_EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=NeonPulse Player
GenericName=Music Player
Comment=Lokalny odtwarzacz muzyki z MPRIS i smart playlistami
Exec=$WRAPPER %U
Icon=neonpulse-player
Terminal=false
Categories=AudioVideo;Audio;Player;
Keywords=music;player;audio;mp3;flac;
StartupWMClass=neonpulse-player
MimeType=audio/mpeg;audio/flac;audio/ogg;audio/wav;audio/aac;
DESKTOP_EOF
echo "[NeonPulse] Utworzono: $CORRECT_DESKTOP"

# ─── 6. Zainstaluj metainfo jeśli nie trafiło przez fpm ──────
METAINFO_SRC="$INSTALL_DIR/resources/app/build/linux/metainfo/pl.paffcio.neonpulse.metainfo.xml"
METAINFO_DEST="/usr/share/metainfo/pl.paffcio.neonpulse.metainfo.xml"
if [ -f "$METAINFO_SRC" ] && [ ! -f "$METAINFO_DEST" ]; then
  mkdir -p /usr/share/metainfo
  cp "$METAINFO_SRC" "$METAINFO_DEST"
  echo "[NeonPulse] Zainstalowano metainfo."
fi

# ─── 7. Odśwież bazy danych ──────────────────────────────────
update-desktop-database /usr/share/applications 2>/dev/null || true
appstreamcli refresh --force 2>/dev/null || true

echo ""
echo "[NeonPulse] Instalacja zakończona!"
echo "[NeonPulse] Uruchom: neonpulse  lub kliknij ikonę w menu KDE."

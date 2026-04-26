#!/bin/bash
# Instalator AppImage NeonPulse Player dla Kubuntu/KDE Wayland
# Użycie: bash install-appimage.sh NeonPulse-3.4.0.AppImage
#
# Co robi:
#   1. Kopiuje AppImage do ~/.local/bin/
#   2. Tworzy wrapper ze wszystkimi flagami (nie musisz nic wpisywać ręcznie)
#   3. Tworzy plik .desktop (ikona w menu aplikacji KDE)

set -e

APPIMAGE_SRC="$1"
if [ -z "$APPIMAGE_SRC" ] || [ ! -f "$APPIMAGE_SRC" ]; then
  echo "Użycie: bash install-appimage.sh <plik.AppImage>"
  exit 1
fi

APPIMAGE_NAME=$(basename "$APPIMAGE_SRC")
INSTALL_DIR="$HOME/.local/bin"
APPIMAGE_DEST="$INSTALL_DIR/$APPIMAGE_NAME"
WRAPPER="$INSTALL_DIR/neonpulse"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/neonpulse-player.desktop"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
ICON_FILE="$ICON_DIR/neonpulse-player.png"

mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$ICON_DIR"

# 1. Skopiuj i nadaj uprawnienia AppImage
echo "Kopiowanie AppImage do $APPIMAGE_DEST..."
cp "$APPIMAGE_SRC" "$APPIMAGE_DEST"
chmod +x "$APPIMAGE_DEST"

# 2. Wyodrębnij ikonę z AppImage (jeśli możliwe)
echo "Wyodrębnianie ikony..."
TMPDIR_ICON=$(mktemp -d)
cd "$TMPDIR_ICON"
"$APPIMAGE_DEST" --appimage-extract "*.png" 2>/dev/null || true
EXTRACTED_ICON=$(find "$TMPDIR_ICON/squashfs-root" -name "*.png" -size +10k 2>/dev/null | head -1)
if [ -n "$EXTRACTED_ICON" ]; then
  cp "$EXTRACTED_ICON" "$ICON_FILE"
  echo "Ikona zainstalowana."
else
  echo "Nie udało się wyodrębnić ikony - użyta zostanie domyślna."
fi
cd /tmp && rm -rf "$TMPDIR_ICON"

# 3. Utwórz wrapper
echo "Tworzenie wrappera $WRAPPER..."
cat > "$WRAPPER" << WRAPPER_EOF
#!/bin/bash
# NeonPulse Player - wrapper (wygenerowany przez install-appimage.sh)
export ELECTRON_NO_SANDBOX=1
export LIBVA_DRIVER_NAME=dummy
exec "$APPIMAGE_DEST" \
  --no-sandbox \
  --disable-gpu-sandbox \
  --ozone-platform=wayland \
  --enable-features=WaylandWindowDecorations \
  --disable-gpu \
  --disable-software-rasterizer \
  "\$@"
WRAPPER_EOF
chmod +x "$WRAPPER"

# 4. Utwórz plik .desktop
echo "Tworzenie skrótu w menu KDE..."
cat > "$DESKTOP_FILE" << DESKTOP_EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=NeonPulse Player
GenericName=Music Player
Comment=Lokalny odtwarzacz muzyki z MPRIS i smart playlistami
Exec=$WRAPPER %U
Icon=$ICON_FILE
Terminal=false
Categories=AudioVideo;Audio;Player;
Keywords=music;player;audio;mp3;flac;
StartupWMClass=neonpulse-player
MimeType=audio/mpeg;audio/flac;audio/ogg;audio/wav;audio/aac;
DESKTOP_EOF

# 5. Odśwież bazę aplikacji KDE
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

echo ""
echo "✓ NeonPulse Player zainstalowany!"
echo "  Uruchom: neonpulse"
echo "  lub kliknij ikonę w menu aplikacji KDE."

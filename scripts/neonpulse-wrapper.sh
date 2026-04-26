#!/bin/bash
# NeonPulse Player wrapper dla instalacji .deb
export ELECTRON_NO_SANDBOX=1
export LIBVA_DRIVER_NAME=dummy

# Wykryj ścieżkę instalacji dynamicznie
EXEC_PATH=""

# Szukaj przez dpkg
EXEC_PATH=$(dpkg -L neonpulse-player 2>/dev/null \
  | grep -E '/(neonpulse-player|neonpulse)$' \
  | grep -v chrome-sandbox \
  | head -1)

# Fallback: /opt
if [ -z "$EXEC_PATH" ]; then
  EXEC_PATH=$(find /opt -maxdepth 2 \( -name "neonpulse-player" -o -name "neonpulse" \) \
    -not -name "*.sh" -type f 2>/dev/null | head -1)
fi

# Fallback: AppImage
if [ -z "$EXEC_PATH" ] && [ -n "$APPIMAGE" ]; then
  EXEC_PATH="$APPIMAGE"
fi

if [ -z "$EXEC_PATH" ]; then
  echo "BŁĄD: Nie znaleziono neonpulse-player" >&2
  exit 1
fi

exec "$EXEC_PATH" \
  --no-sandbox \
  --disable-gpu-sandbox \
  --ozone-platform=wayland \
  --enable-features=WaylandWindowDecorations \
  --disable-gpu \
  --disable-software-rasterizer \
  "$@"

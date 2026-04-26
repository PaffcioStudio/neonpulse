#!/bin/bash
# Skrypt diagnostyczny NeonPulse Player
# Uruchom gdy aplikacja nie startuje: bash scripts/diagnose.sh

echo "=== NeonPulse Player - Diagnostyka ==="
echo ""

echo "--- Plik wykonywalny ---"
dpkg -L neonpulse-player 2>/dev/null | grep -E '/(neonpulse|chrome-sandbox)' || echo "dpkg: paczka nie znaleziona"
find /opt -maxdepth 3 -name "neonpulse*" 2>/dev/null

echo ""
echo "--- Wrapper ---"
ls -la /usr/local/bin/neonpulse 2>/dev/null || echo "Wrapper /usr/local/bin/neonpulse NIE ISTNIEJE"
cat /usr/local/bin/neonpulse 2>/dev/null

echo ""
echo "--- Plik .desktop ---"
cat /usr/share/applications/neonpulse-player.desktop 2>/dev/null || echo "Plik .desktop nie znaleziony"

echo ""
echo "--- chrome-sandbox uprawnienia ---"
find /opt -name "chrome-sandbox" 2>/dev/null | xargs ls -la 2>/dev/null || echo "chrome-sandbox nie znaleziony"

echo ""
echo "--- GPU / Wayland ---"
echo "WAYLAND_DISPLAY=$WAYLAND_DISPLAY"
echo "XDG_SESSION_TYPE=$XDG_SESSION_TYPE"
glxinfo 2>/dev/null | grep "OpenGL renderer" || echo "glxinfo niedostępne"

echo ""
echo "--- Aby naprawić wrapper ręcznie ---"
echo "Uruchom: sudo bash scripts/after-install.sh"

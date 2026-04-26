#!/bin/bash
# Skrypt czyszczący cache KDE/AppStream przed reinstalacją NeonPulse Player
# Uruchom: bash scripts/clean-kde-cache.sh

echo "=== Czyszczenie cache KDE dla NeonPulse Player ==="

echo "1. Odinstalowywanie starej wersji..."
sudo apt remove -y neonpulse-player 2>/dev/null || true

echo "2. Usuwanie osieroconych plików .desktop..."
rm -f ~/.local/share/applications/neonpulse*.desktop
sudo rm -f /usr/share/applications/neonpulse*.desktop

echo "3. Usuwanie cache aplikacji KDE..."
rm -f ~/.cache/ksycoca6* 2>/dev/null || rm -f ~/.cache/ksycoca5* 2>/dev/null || true

echo "4. Odświeżanie bazy AppStream (Discover)..."
sudo appstreamcli refresh --force 2>/dev/null || true

echo ""
echo "Gotowe. Teraz zainstaluj nową paczkę .deb."

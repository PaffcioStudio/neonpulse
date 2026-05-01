# NeonPulse Player – Roadmapa

> Autor: Paffcio | Wersja: 3.4.0 | Ostatnia aktualizacja: 2025-02

---

## ✅ Zrealizowane (v3.4.0)

- Pełna biblioteka SQLite z live-scan przez chokidar
- Odtwarzacz audio z Web Audio API + wizualizator
- Smart playlisty z regułami (rok, gatunek, ulubione)
- Playlisty użytkownika z menu kontekstowym
- Integracja MPRIS v2 (klawisze multimedialne, panel systemowy)
- Tray z kontrolkami, middle-click, scroll głośności
- Crossfade 2s między utworami
- Gapless playback (prebuffering)
- Zapamiętywanie głośności i kolejki
- autoPlayLast – wznowienie od ostatniej pozycji
- continueOnStart – automatyczne odtwarzanie po starcie
- defaultShuffle, rememberVolume, rememberQueue
- Motywy kolorystyczne (10 akcentów)
- Wizualizator audio FFT
- Ambient color z okładki albumu
- Animacje przejść, tryb kompaktowy
- Detail views: artysta, album, gatunek
- HeartButton z animacją
- Integracja z systemem (.desktop, WMClass, MimeType)
- Budowanie .deb i .AppImage

---

## 🗓️ Dzień 1–2: Jakość i stabilność

- [x] **Equalizer** – 10-pasmowy EQ przez Web Audio API (BiquadFilterNode)
- [x] **ReplayGain** – normalizacja głośności z metadanych
- [x] **Fade-in przy starcie** – delikatne wejście głośności po play
- [x] **Obsługa błędów** – toast notifications przy problemach z plikami
- [ ] **Lepsza obsługa Wayland** – natywne zdarzenia tray przez D-Bus

---

## 🗓️ Dzień 3–4: Biblioteka i metadane

- [x] **Edytor tagów** – edycja ID3 inline (tytuł, artysta, album, rok, gatunek) + zapis node-id3 dla MP3
- [x] **Pobieranie okładek** – MusicBrainz / Cover Art Archive jako fallback (PPM → Pobierz okładkę)
- [x] **Duplikaty** – wykrywanie i zarządzanie duplikatami (dedykowany widok)
- [x] **Brakujące pliki** – oznaczanie i usuwanie martwych wpisów z DB
- [x] **Import playlist** – M3U / PLS / XSPF
- [x] **Eksport playlist** – zapis do M3U

---

## 🗓️ Dzień 5–6: UI/UX

- [x] **Mini player** – pływający widok 400×110px z kontrolkami, przeciągany
- [x] **Lyrics view** – wyświetlanie tekstów z pliku .lrc (sync z czasem) + embedded
- [x] **Kolumny na liście** – sortowanie po tytule / artyście / albumie / roku / czasie
- [x] **Drag & Drop** – przeciąganie folderów do okna → auto-dodanie do biblioteki
- [x] **Skróty klawiszowe** – Space, ←/→ (poprzedni/następny), Shift+←/→ (±10s), ↑/↓ (głośność), M (mute), S (shuffle), Ctrl+F (szukaj)

---

## 🗓️ Dzień 7–8: Statystyki i AI

- [x] **Scrobbling Last.fm** – integracja z kontem Last.fm
- [x] **Statystyki słuchania** – wykres dziennych/tygodniowych sesji
- [x] **Top 50** – najczęściej odtwarzane utwory (z DB)
- [x] **„Nie słuchane od dawna"** – smart playlista z datą last-play
- [ ] **AI mix** – generowanie playlisty na podstawie aktualnego nastroju (local model)

---

## 🗓️ Dzień 9–10: Integracje i dystrybucja

- [x] **MPRIS DBus seek bar** – pełna obsługa pozycji w KDE/GNOME media panel
- [ ] **Flatpak** – pakiet dla Flatpak (Flathub sandbox)
- [x] **Auto-updater** – sprawdzanie nowej wersji z GitHub Releases
- [ ] **Tłumaczenia** – i18n (EN/PL) z react-i18next
- [ ] **Profil użytkownika** – wiele profili biblioteki

---

## 💡 Backlog (bez terminu)

- Podcast / audiobook mode (bookmarks, speed control)
- Network streams (Icecast, HLS)
- Companion web app (kontrola z telefonu przez LAN)
- Discord Rich Presence
- Sleep timer
- Kara wyświetlania okładki jako tapeta systemowa

---

*Roadmapa jest żywa – priorytety mogą się zmieniać.*

<div align="center">

<img src="resources/icons/neonpulse-player.png" width="120" alt="NeonPulse Player" />

# NEONPULSE PLAYER

**Lokalny odtwarzacz audio dla Linuksa z duszą**

[![Version](https://img.shields.io/badge/wersja-3.4.0-a855f7?style=flat-square)](https://github.com/paffcio/neonpulse/releases)
[![Platform](https://img.shields.io/badge/platforma-Linux-blue?style=flat-square&logo=linux)](https://github.com/paffcio/neonpulse)
[![Electron](https://img.shields.io/badge/Electron-28-47848f?style=flat-square&logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://reactjs.org)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?style=flat-square&logo=sqlite)](https://sqlite.org)
[![License](https://img.shields.io/badge/licencja-MIT-22c55e?style=flat-square)](LICENSE)

</div>

---

## 📸 Zrzuty ekranu

<div align="center">

<img src="screenshots/1.png" width="49%" alt="Teraz gramy z wizualizacją" />
<img src="screenshots/2.png" width="49%" alt="Biblioteka i lista utworów" />

<img src="screenshots/3.png" width="49%" alt="Statystyki słuchania" />
<img src="screenshots/4.png" width="49%" alt="Ustawienia i EQ" />

</div>

---

## ✨ Funkcje

### 🎵 Odtwarzacz
- Obsługa MP3, FLAC, OGG, WAV, AAC i innych popularnych formatów
- **Crossfade** (2s) i **gapless playback** między utworami
- **Fade-in** przy starcie odtwarzania
- **ReplayGain** – automatyczna normalizacja głośności z metadanych
- **10-pasmowy equalizer** z presetami
- Przywracanie ostatniego utworu i pozycji po ponownym uruchomieniu
- Zapamiętywanie kolejki między sesjami

### 📚 Biblioteka
- Skanowanie folderów w czasie rzeczywistym (chokidar)
- Baza danych SQLite – szybkie wyszukiwanie i filtrowanie
- Widoki: wszystkie utwory, artyści, albumy, gatunki, dekady
- **Smart playlisty** z regułami (rok, gatunek, ulubione, BPM)
- **Edytor tagów ID3** – edycja tytułu, artysty, albumu, roku, gatunku
- **Pobieranie okładek** z MusicBrainz / Cover Art Archive
- Wykrywanie i usuwanie **duplikatów** (fizyczne usunięcie z dysku)
- Oznaczanie i usuwanie **brakujących plików**

### 📋 Playlisty
- Tworzenie, edycja i usuwanie list odtwarzania
- Import: **M3U, PLS, XSPF**
- Eksport do **M3U**
- Trwałe przechowywanie w bazie SQLite

### 📊 Statystyki
- Historia odtworzeń zapisywana lokalnie
- **Top 50** – najczęściej odtwarzane utwory
- Wykres dzienny/tygodniowy/miesięczny słuchania
- Lista **„Nie słuchane od dawna"**
- Łączny czas słuchania

### 🎨 Interfejs
- 10 motywów kolorystycznych (akcenty)
- **Ambient color** – tło dopasowane do okładki albumu
- **Wizualizacja audio** w rytm muzyki (FFT, fale, cząsteczki, okrąg spektrum)
- **Mini player** – pływający widget 400×110px, przeciągany
- Tryb kompaktowy listy utworów
- Sortowanie po tytule, artyście, albumie, roku, czasie trwania
- Animacje przejść widoków

### 🎤 Tekst utworu
- Synchronizowane teksty z pliku `.lrc` (karaoke)
- Tekst embedded w tagu USLT (ID3) / Vorbis Comment (FLAC)
- Automatyczne wykrywanie – bez konfiguracji

### 🔗 Integracje
- **MPRIS v2** – pełna obsługa klawiszy multimedialnych, panel systemowy KDE/GNOME
- **Tray** z kontrolkami (play/pause, poprzedni/następny)
- **Last.fm** – scrobbling i aktualizacja „teraz gra"
- **Drag & Drop** – przeciągnij folder do okna

### ⌨️ Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| `Space` | Play / Pause |
| `←` / `→` | Poprzedni / Następny utwór |
| `Shift+←` / `Shift+→` | Cofnij / Przewiń o 10 sekund |
| `↑` / `↓` | Głośność +/- |
| `M` | Wycisz / Odcisz |
| `S` | Shuffle |
| `Ctrl+F` | Szukaj |

---

## 🚀 Instalacja

### Wymagania
- **Node.js** 18+
- **npm** 9+
- Linux (testowany na Ubuntu 22.04, TuxedoOS)

### Uruchomienie w trybie deweloperskim

```bash
git clone https://github.com/paffcio/neonpulse.git
cd neonpulse
npm install
npm start
```

Aplikacja uruchamia jednocześnie serwer Express (port 3001) i Vite dev server (port 5173).

### Budowanie paczki

```bash
# Paczka .deb (Debian/Ubuntu)
npm run dist

# AppImage (przenośny)
npm run dist
```

Gotowe paczki znajdziesz w katalogu `dist/`.

---

## 🗂️ Struktura projektu

```
neonpulse/
├── electron-main.js       # Główny proces Electron
├── server.js              # Backend Express + SQLite API
├── src/
│   ├── components/        # Komponenty React
│   │   ├── views/         # Widoki (biblioteka, playlisty, statystyki…)
│   │   ├── MusicPlayer.jsx
│   │   ├── PlayerBar.jsx
│   │   ├── Sidebar.jsx
│   │   └── …
│   ├── hooks/
│   │   ├── usePlayer.js   # Logika odtwarzacza
│   │   └── useLastFm.js   # Scrobbling Last.fm
│   └── utils.js
├── resources/
│   └── icons/             # Ikony aplikacji
└── screenshots/           # Zrzuty ekranu
```

---

## 🛠️ Stack technologiczny

| Technologia | Rola |
|-------------|------|
| **Electron 28** | Silnik aplikacji desktopowej |
| **React 18** | Interfejs użytkownika |
| **Vite 4** | Bundler i dev server |
| **Tailwind CSS** | Style i layout |
| **SQLite** (better-sqlite3) | Baza danych biblioteki |
| **Express.js** | Backend REST API |
| **music-metadata** | Odczyt tagów audio |
| **chokidar** | Obserwowanie folderów |
| **Web Audio API** | Wizualizacja i equalizer |
| **MPRIS D-Bus** | Integracja z systemem Linux |
| **Last.fm API** | Scrobbling |
| **Lucide React** | Ikony |

---

## 📄 Licencja

MIT © [Paffcio](https://github.com/paffcio) 2026

---

<div align="center">

Zbudowane z ❤️ i muzyką w tle

</div>

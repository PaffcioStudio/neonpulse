<div align="center">

<img src="screenshots/banner.jpg" width="100%" alt="NeonPulse Player - baner" />

<br/>

<img src="resources/icons/neonpulse-player.png" width="118" alt="NeonPulse Player" />

# NeonPulse Player

**Lokalny odtwarzacz muzyki dla Linuksa, z biblioteką SQLite, MPRIS i nowoczesnym UI.**

[![Wersja](https://img.shields.io/badge/wersja-3.6.2-a855f7?style=for-the-badge)](package.json)
[![Linux](https://img.shields.io/badge/Linux-DEB%20%7C%20AppImage-2563eb?style=for-the-badge&logo=linux&logoColor=white)](#instalacja)
[![Electron](https://img.shields.io/badge/Electron-28-47848f?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=111)](https://react.dev)
[![SQLite](https://img.shields.io/badge/SQLite-biblioteka-003b57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)

</div>

---

## Zrzuty Ekranu

<div align="center">

<img src="screenshots/1.png" width="49%" alt="Ekran Teraz gramy" />
<img src="screenshots/2.png" width="49%" alt="Biblioteka muzyki" />

<img src="screenshots/3.png" width="49%" alt="Widok odtwarzacza systemowego" />
<img src="screenshots/4.png" width="49%" alt="Ustawienia aplikacji" />

</div>

---

## Najważniejsze Funkcje

| Obszar | Co potrafi |
| --- | --- |
| Odtwarzanie | MP3, FLAC, OGG, WAV, AAC i inne formaty wspierane przez Chromium |
| Kolejka | Kolejka i aktywny utwór są zapisywane między sesjami |
| Przejścia | Gapless playback albo crossfade, z automatycznym wykluczaniem konfliktu |
| Dźwięk | 10-pasmowy equalizer, szybki panel EQ, ReplayGain i fade-in |
| System Linux | MPRIS v2, klawisze multimedialne, panel KDE/GNOME i tray |
| Biblioteka | SQLite, live scan folderów, wyszukiwanie, sortowanie i widoki szczegółowe |
| Metadane | Edycja tagów, zbiorcza edycja, oceny, okładki z MusicBrainz / Cover Art Archive |
| Playlisty | Playlisty lokalne, smart playlisty, import M3U/PLS/XSPF i eksport M3U |
| Radio internetowe | Stacje Icecast/Shoutcast, własne stacje, import z M3U/M3U8/XML, manifest predefiniowanych stacji, warianty regionalne, open.fm (wsparcie nieoficjalne) |
| Teksty | Pliki `.lrc`, teksty embedded i synchronizacja z postępem utworu |
| Last.fm | Scrobbling, now playing i przełącznik integracji w ustawieniach |

---

## Interfejs

- Widoki: `Teraz gramy`, `Wszystkie utwory`, `Ulubione`, artyści, albumy, gatunki, dekady, playlisty, statystyki, tekst utworu, duplikaty i brakujące pliki.
- Dolny pasek odtwarzacza z okładką, tytułem, artystą, kolejką, wyłącznikiem czasowym i opcjonalnymi skrótami.
- Kliknięcie okładki przechodzi do `Teraz gramy`, tytułu do albumu, a artysty do jego albumów.
- Motywy kolorystyczne, ambient z okładki albumu, animacje przejść i tryb kompaktowy list.
- Wizualizacje audio: `Mgławica`, `Słupy`, `Tunel` i `Zorza`, z opcjonalnym delikatnym prześwitem w tle widoków.
- Pełnoekranowy widok odtwarzania z okładką, tekstem i kolejką.

---

## Radio Internetowe

- Osobna zakładka `Stacje radiowe` w pasku bocznym, niezależna od biblioteki lokalnej plików.
- Manifest predefiniowanych stacji (`resources/stations/manifest.json`), edytowalny bez rebuildu aplikacji — poza `.deb`/`AppImage` (`resources/stations/`), więc łatwo dopisać własne stacje po instalacji.
- Dodawanie własnych stacji ręcznie (nazwa, URL, gatunek, ikonka) oraz import z plików M3U, M3U8 i XML.
- Automatyczne dociąganie ikonek stacji z [Radio-Browser](https://www.radio-browser.info/) dla tych, które nie mają jej ustawionej w manifeście, plus ręczne wyszukiwanie ikonki po nazwie z podglądem wyników.
- Warianty regionalne dla stacji sieciowych z rozszczepieniami (np. inne miasto/oddział tej samej rozgłośni) — wybór zapamiętywany trwale per stacja.
- **Wsparcie dla [open.fm](https://open.fm) (nieoficjalne)** — przeglądanie i dodawanie dowolnej stacji z katalogu open.fm, odtwarzanej przez HLS (`hls.js`). Ponieważ open.fm nie udostępnia publicznego API, integracja korzysta z tego samego mechanizmu podpisanych, wygasających adresów strumienia co strona open.fm — token jest pobierany na nowo przy każdym odtworzeniu. Może przestać działać bez zapowiedzi, jeśli open.fm zmieni swój mechanizm autoryzacji.
- Equalizer i wizualizacja audio są wyłączone dla radia internetowego — większość publicznych strumieni nie wysyła nagłówków CORS wymaganych do bezpiecznego przetwarzania dźwięku w przeglądarce; próba ich obejścia realnie ryzykowała wyciszeniem strumienia, więc priorytet ma zawsze działający dźwięk.
- MPRIS i tray pokazują aktualnie graną stację (nazwa, ikonka, gatunek) tak samo jak dla utworów z biblioteki.

---

## Ustawienia I Automatyzacja

- Automatyczne przywracanie ostatniego utworu, pozycji i kolejki.
- Start zminimalizowany do traya, minimalizacja do traya i kontrolki w menu traya.
- Konfigurowalne przyciski paska odtwarzacza: widok odtwarzania, equalizer i wyłącznik czasowy.
- Wyłącznik czasowy z presetami i własnym limitem minut.
- Aktualizacje sprawdzane z GitHub Releases.
- Przeciąganie folderów do okna aplikacji dodaje je do biblioteki.

---

## Skróty Klawiszowe

| Skrót | Akcja |
| --- | --- |
| `Space` | Play / pauza |
| `←` / `→` | Poprzedni / następny utwór |
| `Shift+←` / `Shift+→` | Cofnij / przewiń o 10 sekund |
| `↑` / `↓` | Głośność w górę / w dół |
| `M` | Wycisz / odcisz |
| `S` | Shuffle |
| `Ctrl+F` | Szukaj |

---

## Instalacja

### Wymagania Deweloperskie

- Linux
- Node.js 18+
- npm 9+

### Uruchomienie Z Kodu

```bash
git clone https://github.com/PaffcioStudio/neonpulse.git
cd neonpulse
npm install
npm start
```

`npm start` uruchamia Vite oraz aplikację Electron. Backend Express działa na porcie `3001`, a Vite na `5173`.

### Build

```bash
npm run build
npm run dist
```

`npm run build` tworzy frontend w katalogu `dist/`.
`npm run dist` buduje paczki `.deb` i `AppImage` w katalogu `release/`.

---

## Struktura Projektu

```text
neonpulse/
├── electron-main.js          # Electron, tray, MPRIS, okno aplikacji
├── server.js                 # Express API, SQLite, skanowanie i integracje
├── src/
│   ├── components/           # Komponenty React
│   ├── components/views/     # Widoki aplikacji
│   ├── hooks/                # Logika odtwarzacza i Last.fm
│   ├── ipc.js                # Bezpieczny most IPC
│   └── utils.js              # Pomocnicze funkcje UI i biblioteki
├── resources/                # Ikony, metadane linuksowe, manifest stacji radiowych
├── screenshots/              # Zrzuty ekranu do README
└── scripts/                  # Instalacja i hooki paczek
```

---

## Stack

| Technologia | Rola |
| --- | --- |
| Electron 28 | Aplikacja desktopowa |
| React 18 | Interfejs |
| Vite 4 | Bundler |
| Tailwind CSS | Style |
| Express | Lokalne REST API |
| SQLite / better-sqlite3 | Biblioteka, playlisty i statystyki |
| music-metadata | Odczyt tagów audio |
| node-id3 | Zapis tagów MP3 |
| chokidar | Live scan folderów |
| Web Audio API | Equalizer i wizualizacje |
| MPRIS D-Bus | Integracja z systemem Linux |
| Last.fm API | Scrobbling |
| Lucide React | Ikony |

---

## Licencja

MIT © Paffcio 2026

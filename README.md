<div align="center">

<img src="screenshots/banner.jpg" width="100%" alt="NeonPulse Player banner" />

<br/>

<img src="resources/icons/neonpulse-player.png" width="118" alt="NeonPulse Player" />

# NeonPulse Player

**A modern local music player for Linux, featuring an SQLite library, MPRIS integration, and a polished user interface.**

[![Version](https://img.shields.io/badge/version-3.6.2-a855f7?style=for-the-badge)](package.json)
[![Linux](https://img.shields.io/badge/Linux-DEB%20%7C%20AppImage-2563eb?style=for-the-badge&logo=linux&logoColor=white)](#installation)
[![Electron](https://img.shields.io/badge/Electron-28-47848f?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=111)](https://react.dev)
[![SQLite](https://img.shields.io/badge/SQLite-library-003b57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)

</div>

---

## Screenshots

<div align="center">

<img src="screenshots/1.png" width="49%" alt="Now Playing view" />
<img src="screenshots/2.png" width="49%" alt="Music library" />

<img src="screenshots/3.png" width="49%" alt="System media player integration" />
<img src="screenshots/4.png" width="49%" alt="Application settings" />

</div>

---

## Key Features

| Area | Features |
| --- | --- |
| Playback | MP3, FLAC, OGG, WAV, AAC, and other formats supported by Chromium |
| Queue | The playback queue and current track are saved between sessions |
| Transitions | Gapless playback or crossfade, with automatic conflict prevention |
| Audio | 10-band equalizer, quick EQ panel, ReplayGain, and fade-in |
| Linux integration | MPRIS v2, multimedia keys, KDE/GNOME media controls, and system tray |
| Library | SQLite, live folder scanning, search, sorting, and detailed views |
| Metadata | Tag editing, bulk editing, ratings, and artwork from MusicBrainz / Cover Art Archive |
| Playlists | Local and smart playlists, M3U/PLS/XSPF import, and M3U export |
| Internet radio | Icecast/Shoutcast stations, custom stations, M3U/M3U8/XML import, preset station manifest, regional variants, and unofficial open.fm support |
| Lyrics | `.lrc` files, embedded lyrics, and synchronization with track progress |
| Last.fm | Scrobbling, now-playing updates, and an integration toggle in settings |

---

## Interface

- Views include `Now Playing`, `All Tracks`, `Favorites`, artists, albums, genres, decades, playlists, statistics, lyrics, duplicates, and missing files.
- Bottom playback bar with artwork, title, artist, queue, sleep timer, and optional shortcuts.
- Click artwork to open `Now Playing`, the title to open its album, or the artist to browse their albums.
- Color themes, album-art ambient backgrounds, transition animations, and compact list mode.
- Audio visualizations: `Nebula`, `Bars`, `Tunnel`, and `Aurora`, with an optional subtle background effect behind views.
- Full-screen playback view with artwork, lyrics, and the queue.

---

## Internet Radio

- A dedicated `Radio Stations` tab in the sidebar, separate from the local music library.
- Preset stations are defined in `resources/stations/manifest.json`. The manifest can be edited without rebuilding the app, except when stations are bundled into `.deb` or `AppImage` packages; `resources/stations/` can be edited directly in a source installation.
- Add custom stations manually (name, URL, genre, and icon), or import them from M3U, M3U8, and XML files.
- Automatically fetch station icons from [Radio-Browser](https://www.radio-browser.info/) when a station has no icon configured in the manifest. You can also search for an icon by station name and preview the results.
- Regional variants are supported for networks that split their broadcasts by city or branch. The selected variant is remembered for each station.
- **Unofficial [open.fm](https://open.fm) support** — browse and add stations from the open.fm catalogue and play them over HLS using `hls.js`. Since open.fm does not provide a public API, this integration uses the same kind of signed, expiring stream URLs as the open.fm website. A fresh token is retrieved whenever playback starts. The integration may stop working without notice if open.fm changes its authorization mechanism.
- The equalizer and audio visualizer are disabled for internet radio. Most public streams do not send the CORS headers needed for safe audio processing in the browser; attempting to work around this could mute playback, so reliable audio takes priority.
- MPRIS and the system tray show the currently playing station, including its name, icon, and genre, just as they do for tracks in the local library.

---

## Settings and Automation

- Automatically restore the last track, playback position, and queue.
- Start minimized to the system tray, minimize to tray, and use tray-menu controls.
- Configure playback-bar shortcuts for the playback view, equalizer, and sleep timer.
- Sleep timer with presets and a custom duration.
- Check for updates through GitHub Releases.
- Drag folders into the application window to add them to the library.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Previous / next track |
| `Shift+←` / `Shift+→` | Seek backward / forward by 10 seconds |
| `↑` / `↓` | Increase / decrease volume |
| `M` | Mute / unmute |
| `S` | Shuffle |
| `Ctrl+F` | Search |

---

## Installation

### Development Requirements

- Linux
- Node.js 18+
- npm 9+

### Run from Source

```bash
git clone https://github.com/PaffcioStudio/neonpulse.git
cd neonpulse
npm install
npm start
```

`npm start` launches Vite and the Electron application. The Express backend runs on port `3001`, and Vite runs on port `5173`.

### Build

```bash
npm run build
npm run dist
```

`npm run build` builds the frontend into `dist/`.
`npm run dist` creates `.deb` and `AppImage` packages in `release/`.

---

## Project Structure

```text
neonpulse/
├── electron-main.js          # Electron, system tray, MPRIS, application window
├── server.js                 # Express API, SQLite, scanning, and integrations
├── src/
│   ├── components/           # React components
│   ├── components/views/     # Application views
│   ├── hooks/                # Player and Last.fm logic
│   ├── ipc.js                # Secure IPC bridge
│   └── utils.js              # UI and library utility functions
├── resources/                # Icons, Linux metadata, and radio station manifests
├── screenshots/              # README screenshots
└── scripts/                  # Packaging scripts and hooks
```

---

## Tech Stack

| Technology | Role |
| --- | --- |
| Electron 28 | Desktop application |
| React 18 | User interface |
| Vite 4 | Bundler |
| Tailwind CSS | Styling |
| Express | Local REST API |
| SQLite / better-sqlite3 | Library, playlists, and statistics |
| music-metadata | Audio tag reading |
| node-id3 | MP3 tag writing |
| chokidar | Live folder scanning |
| Web Audio API | Equalizer and visualizations |
| MPRIS D-Bus | Linux desktop integration |
| Last.fm API | Scrobbling |
| Lucide React | Icons |

---

## License

MIT © Paffcio 2026

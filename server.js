'use strict';
// ══════════════════════════════════════════════════════════════
//  NeonPulse Player – Backend Server  (Express + SQLite + SSE)
//  Port: 3001  |  API prefix: /api
//
//  Schema (oryginalna baza):
//    songs        – id TEXT (sha1), path, title, artist, album,
//                   genre, year, duration, cover, lyrics,
//                   mtime, filesize, replaygain, added_at
//    favorites    – song_id TEXT FK → songs.id
//    watched_paths – path TEXT
//    settings     – key, value
// ══════════════════════════════════════════════════════════════

const path       = require('path');
const fs         = require('fs');
const os         = require('os');
const crypto     = require('crypto');
const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');

// ── Ścieżki danych ──────────────────────────────────────────────
const DATA_DIR = (() => {
  if (process.env.NEONPULSE_DATA) return process.env.NEONPULSE_DATA;
  if (process.platform === 'win32')
    return path.join(process.env.APPDATA || os.homedir(), 'neonpulse');
  if (process.platform === 'darwin')
    return path.join(os.homedir(), 'Library', 'Application Support', 'neonpulse');
  return path.join(os.homedir(), '.neonpulse');
})();

const DB_PATH    = path.join(DATA_DIR, 'library.db');
const COVERS_DIR = path.join(DATA_DIR, 'covers');

fs.mkdirSync(DATA_DIR,   { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });

// ── SQLite ──────────────────────────────────────────────────────
const Database = require('better-sqlite3');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous  = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id          TEXT PRIMARY KEY,
    path        TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL DEFAULT 'Nieznany tytuł',
    artist      TEXT NOT NULL DEFAULT 'Nieznany artysta',
    album       TEXT NOT NULL DEFAULT 'Nieznany album',
    genre       TEXT DEFAULT 'Inne',
    year        INTEGER DEFAULT 0,
    duration    REAL DEFAULT 0,
    cover       TEXT DEFAULT '',
    lyrics      TEXT DEFAULT '',
    mtime       INTEGER DEFAULT 0,
    filesize    INTEGER DEFAULT 0,
    replaygain  REAL DEFAULT 0,
    added_at    INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS favorites (
    song_id TEXT PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS watched_paths (
    path TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS playlists (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id     TEXT NOT NULL REFERENCES songs(id)     ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (playlist_id, song_id)
  );
  CREATE INDEX IF NOT EXISTS idx_playlist_songs ON playlist_songs(playlist_id, position);
  CREATE TABLE IF NOT EXISTS play_history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id   TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    played_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    duration_played REAL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_play_history_song ON play_history(song_id);
  CREATE INDEX IF NOT EXISTS idx_play_history_time ON play_history(played_at);
  CREATE INDEX IF NOT EXISTS idx_artist  ON songs(artist);
  CREATE INDEX IF NOT EXISTS idx_album   ON songs(album);
  CREATE INDEX IF NOT EXISTS idx_path    ON songs(path);
`);

// ── Pomocnicze ──────────────────────────────────────────────────
const AUDIO_EXT = new Set([
  '.mp3','.flac','.ogg','.wav','.aac','.m4a','.opus','.wma','.ape','.aiff','.aif',
]);
const isAudio = f => AUDIO_EXT.has(path.extname(f).toLowerCase());

// Konwertuj wiersz z bazy na obiekt dla frontu
// (dołącz isFavorite jako boolean)
const favSet = new Set();
function reloadFavSet() {
  const rows = db.prepare('SELECT song_id FROM favorites').all();
  favSet.clear();
  rows.forEach(r => favSet.add(r.song_id));
}
reloadFavSet();

function dbRow(row) {
  if (!row) return null;
  return { ...row, isFavorite: favSet.has(row.id) };
}

// SHA-1 ścieżki jako id (tak jak w oryginalnej bazie)
function songId(filePath) {
  return crypto.createHash('sha1').update(filePath).digest('hex');
}

// ── Parsowanie metadanych ────────────────────────────────────────
async function parseFileMeta(filePath) {
  try {
    const mm   = require('music-metadata');
    const stat = fs.statSync(filePath);
    const meta = await mm.parseFile(filePath, { skipCovers: false, duration: true });
    const c    = meta.common;

    let cover = '';
    const pic = c.picture && c.picture[0];
    if (pic) {
      const hash = crypto.createHash('md5').update(pic.data).digest('hex');
      const ext  = (pic.format || 'image/jpeg').split('/')[1] || 'jpg';
      const dest = path.join(COVERS_DIR, `${hash}.${ext}`);
      if (!fs.existsSync(dest)) fs.writeFileSync(dest, pic.data);
      cover = `http://localhost:3001/covers/${hash}.${ext}`;
    }

    // ReplayGain
    let replaygain = 0;
    const rg = meta.common.replaygain_track_gain;
    if (rg && typeof rg.dB === 'number') replaygain = rg.dB;

    return {
      title:      c.title        || path.basename(filePath, path.extname(filePath)),
      artist:     c.artist       || (c.artists && c.artists[0]) || 'Nieznany artysta',
      album:      c.album        || 'Nieznany album',
      genre:      (c.genre && c.genre[0]) || 'Inne',
      year:       c.year         || 0,
      duration:   meta.format.duration || 0,
      cover,
      lyrics:     (() => {
        // 1. unsynchronisedLyrics (USLT) – node-id3 / music-metadata style
        const uslt = meta.native?.['ID3v2.3']?.find?.(t => t.id === 'USLT')
                  || meta.native?.['ID3v2.4']?.find?.(t => t.id === 'USLT');
        if (uslt?.value?.text) return uslt.value.text;
        // 2. music-metadata common.lyrics array
        if (c.lyrics && c.lyrics.length > 0) {
          const l = c.lyrics[0];
          if (typeof l === 'string' && l.trim()) return l;
          if (l && typeof l.text === 'string' && l.text.trim()) return l.text;
        }
        // 3. Synchronised lyrics (SYLT) – skonwertuj na plain text
        const sylt = meta.native?.['ID3v2.3']?.find?.(t => t.id === 'SYLT')
                  || meta.native?.['ID3v2.4']?.find?.(t => t.id === 'SYLT');
        if (sylt?.value?.text && Array.isArray(sylt.value.text)) {
          return sylt.value.text.map(e => e.text || e[0] || '').filter(Boolean).join('\n');
        }
        return '';
      })(),
      mtime:      Math.floor(stat.mtimeMs / 1000),
      filesize:   stat.size,
      replaygain,
    };
  } catch {
    let stat = { mtimeMs: 0, size: 0 };
    try { stat = fs.statSync(filePath); } catch {}
    return {
      title:      path.basename(filePath, path.extname(filePath)),
      artist:     'Nieznany artysta',
      album:      'Nieznany album',
      genre:      'Inne',
      year:       0,
      duration:   0,
      cover:      '',
      lyrics:     '',
      mtime:      Math.floor((stat.mtimeMs || 0) / 1000),
      filesize:   stat.size || 0,
      replaygain: 0,
    };
  }
}

// ── SSE ─────────────────────────────────────────────────────────
const sseClients = new Set();

function sseEmit(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

// ── Skanowanie ──────────────────────────────────────────────────
let scanRunning = false;

function collectAudio(dir, results) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectAudio(full, results);
    else if (e.isFile() && isAudio(e.name)) results.push(full);
  }
}

async function scanPaths(paths) {
  if (scanRunning) return;
  scanRunning = true;

  const allFiles = [];
  for (const dir of paths) collectAudio(dir, allFiles);

  sseEmit('status', { isScanning: true, count: 0, total: allFiles.length, scanned: 0 });

  let scanned = 0;
  const batchSize = 10;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO songs
      (id, path, title, artist, album, genre, year, duration, cover, lyrics, mtime, filesize, replaygain)
    VALUES
      (@id,@path,@title,@artist,@album,@genre,@year,@duration,@cover,@lyrics,@mtime,@filesize,@replaygain)
  `);

  const updateStmt = db.prepare(`
    UPDATE songs SET
      title=@title, artist=@artist, album=@album, genre=@genre, year=@year,
      duration=@duration, cover=@cover, lyrics=@lyrics,
      mtime=@mtime, filesize=@filesize, replaygain=@replaygain
    WHERE id=@id
  `);

  for (let i = 0; i < allFiles.length; i += batchSize) {
    const batch = allFiles.slice(i, i + batchSize);
    await Promise.all(batch.map(async fp => {
      const id = songId(fp);
      const existing = db.prepare('SELECT id, mtime FROM songs WHERE id = ?').get(id);
      try {
        const stat = fs.statSync(fp);
        const mtime = Math.floor(stat.mtimeMs / 1000);
        if (!existing) {
          // Nowy plik – dodaj
          const meta = await parseFileMeta(fp);
          insertStmt.run({ id, path: fp, ...meta });
          sseEmit('song_added', { path: fp });
        } else if (existing.mtime !== mtime) {
          // Plik zmieniony – odśwież metadane
          const meta = await parseFileMeta(fp);
          updateStmt.run({ id, ...meta });
          sseEmit('tags_updated', { id, song: db.prepare('SELECT * FROM songs WHERE id=?').get(id) });
        }
        // Plik niezmieniony – pomiń
      } catch {}
      scanned++;
    }));
    sseEmit('status', { isScanning: true, count: scanned, total: allFiles.length, scanned });
  }

  // Usuń nieistniejące pliki
  const allInDb = db.prepare('SELECT id, path FROM songs').all();
  for (const row of allInDb) {
    if (!fs.existsSync(row.path)) {
      db.prepare('DELETE FROM songs WHERE id = ?').run(row.id);
      favSet.delete(row.id);
      sseEmit('song_removed', { id: row.id });
    }
  }

  const count = db.prepare('SELECT COUNT(*) as n FROM songs').get().n;
  sseEmit('scan_done', { count });
  sseEmit('status', { isScanning: false, count, scanned: count, total: allFiles.length });
  scanRunning = false;
}

// ── Chokidar ────────────────────────────────────────────────────
let watcher = null;

function startWatcher(paths) {
  if (watcher) { try { watcher.close(); } catch {} watcher = null; }
  if (!paths.length) return;
  try {
    const chokidar = require('chokidar');
    watcher = chokidar.watch(paths, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
    });
    watcher.on('add', async fp => {
      if (!isAudio(fp)) return;
      const id = songId(fp);
      const exists = db.prepare('SELECT id FROM songs WHERE id = ?').get(id);
      if (!exists) {
        const meta = await parseFileMeta(fp);
        try {
          db.prepare(`
            INSERT OR IGNORE INTO songs
              (id,path,title,artist,album,genre,year,duration,cover,lyrics,mtime,filesize,replaygain)
            VALUES
              (@id,@path,@title,@artist,@album,@genre,@year,@duration,@cover,@lyrics,@mtime,@filesize,@replaygain)
          `).run({ id, path: fp, ...meta });
          sseEmit('song_added', { path: fp });
          sseEmit('library_changed', {});
        } catch {}
      }
    });
    watcher.on('unlink', fp => {
      const id = songId(fp);
      db.prepare('DELETE FROM songs WHERE id = ?').run(id);
      favSet.delete(id);
      sseEmit('song_removed', { id });
      sseEmit('library_changed', {});
    });
  } catch (e) { console.warn('[WATCHER]', e.message); }
}

// ── Ścieżki muzyczne ────────────────────────────────────────────
function getWatchedPaths() {
  return db.prepare('SELECT path FROM watched_paths').all().map(r => r.path);
}

function addWatchedPath(p) {
  db.prepare('INSERT OR IGNORE INTO watched_paths (path) VALUES (?)').run(p);
}

function removeWatchedPath(p) {
  db.prepare('DELETE FROM watched_paths WHERE path = ?').run(p);
}

// ── Express ─────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/covers', express.static(COVERS_DIR, { maxAge: '7d' }));
app.use('/icons', express.static(path.join(__dirname, 'resources', 'icons'), { maxAge: '30d' }));

// GET /api/library
app.get('/api/library', (_req, res) => {
  try {
    const songs = db.prepare('SELECT * FROM songs ORDER BY artist, album, title').all();
    res.json(songs.map(dbRow));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/settings/paths
app.get('/api/settings/paths', (_req, res) => {
  res.json(getWatchedPaths());
});

// POST /api/settings/paths
app.post('/api/settings/paths', (req, res) => {
  const { path: p } = req.body;
  if (!p) return res.status(400).json({ error: 'brak path' });
  addWatchedPath(p);
  const paths = getWatchedPaths();
  startWatcher(paths);
  scanPaths(paths).catch(console.error);
  res.json(paths);
});

// DELETE /api/settings/paths
app.delete('/api/settings/paths', (req, res) => {
  const { path: p } = req.body;
  if (!p) return res.status(400).json({ error: 'brak path' });
  removeWatchedPath(p);
  const paths = getWatchedPaths();
  startWatcher(paths);
  res.json(paths);
});

// POST /api/library/rescan
app.post('/api/library/rescan', (_req, res) => {
  scanPaths(getWatchedPaths()).catch(console.error);
  res.json({ ok: true });
});

// POST /api/favorite  – toggle
app.post('/api/favorite', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'brak id' });
  const exists = db.prepare('SELECT song_id FROM favorites WHERE song_id = ?').get(id);
  let isFavorite;
  if (exists) {
    db.prepare('DELETE FROM favorites WHERE song_id = ?').run(id);
    favSet.delete(id);
    isFavorite = false;
  } else {
    db.prepare('INSERT OR IGNORE INTO favorites (song_id) VALUES (?)').run(id);
    favSet.add(id);
    isFavorite = true;
  }
  sseEmit('favorite_changed', { id, isFavorite });
  res.json({ id, isFavorite });
});

// PUT /api/tags/:id  – edycja tagów ID3 + aktualizacja SQLite
app.put('/api/tags/:id', async (req, res) => {
  const { id } = req.params;
  const { title, artist, album, year, genre } = req.body;

  const song = db.prepare('SELECT path FROM songs WHERE id = ?').get(id);
  if (!song) return res.status(404).json({ error: 'Nie znaleziono utworu' });

  const filePath = song.path;
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Plik nie istnieje' });

  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.mp3') {
      // Zapis tagów ID3 dla MP3 przez node-id3
      const NodeID3 = require('node-id3');
      const tags = {};
      if (title  !== undefined) tags.title  = String(title  || '');
      if (artist !== undefined) tags.artist = String(artist || '');
      if (album  !== undefined) tags.album  = String(album  || '');
      if (year   !== undefined) tags.year   = String(year   || '');
      if (genre  !== undefined) tags.genre  = String(genre  || '');
      const result = NodeID3.update(tags, filePath);
      if (result instanceof Error) throw result;
    } else if (['.flac', '.ogg', '.m4a', '.aac', '.opus', '.wv'].includes(ext)) {
      // Dla innych formatów – tylko aktualizacja SQLite (music-metadata read-only)
      // Zapis do pliku wymaga specyficznych bibliotek; aktualizujemy bazę i emitujemy SSE
      console.log(`[TAGS] Format ${ext} – tylko aktualizacja DB, nie pliku`);
    } else {
      return res.status(415).json({ error: `Nieobsługiwany format: ${ext}` });
    }

    // Aktualizacja SQLite
    const updates = [];
    const values  = [];
    if (title  !== undefined) { updates.push('title = ?');  values.push(String(title  || '')); }
    if (artist !== undefined) { updates.push('artist = ?'); values.push(String(artist || '')); }
    if (album  !== undefined) { updates.push('album = ?');  values.push(String(album  || '')); }
    if (year   !== undefined) { updates.push('year = ?');   values.push(Number(year)  || 0); }
    if (genre  !== undefined) { updates.push('genre = ?');  values.push(String(genre  || '')); }

    if (updates.length) {
      values.push(id);
      db.prepare(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
    sseEmit('tags_updated', { id, song: updated });
    res.json({ ok: true, song: updated });
  } catch (err) {
    console.error('[TAGS] Błąd zapisu:', err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// GET /api/lyrics?path=...  – wczytaj plik .lrc z dysku (204 gdy brak pliku, bez błędów w konsoli)
app.get('/api/lyrics', (req, res) => {
  const { path: lrcPath } = req.query;
  if (!lrcPath) return res.status(400).send('');
  try {
    if (!fs.existsSync(lrcPath)) return res.status(204).end(); // cicho – bez 404 w konsoli
    const content = fs.readFileSync(lrcPath, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch {
    res.status(204).end();
  }
});

// GET /api/lyrics/embedded?songId=...  – pobierz tekst embedded z pliku (live, bez reskanowania)
app.get('/api/lyrics/embedded', async (req, res) => {
  const { songId: id } = req.query;
  if (!id) return res.status(400).json({ error: 'Brak songId' });
  const song = db.prepare('SELECT path, lyrics FROM songs WHERE id = ?').get(id);
  if (!song) return res.status(404).json({ error: 'Brak utworu' });

  // Jeśli mamy w DB – zwróć od razu
  if (song.lyrics && song.lyrics.trim()) {
    return res.json({ lyrics: song.lyrics, source: 'db' });
  }

  // Spróbuj odczytać na żywo z pliku
  try {
    const mm = require('music-metadata');
    const meta = await mm.parseFile(song.path, { skipCovers: true, duration: false });
    const c = meta.common;

    let lyrics = '';

    // USLT native tag
    const uslt = meta.native?.['ID3v2.3']?.find?.(t => t.id === 'USLT')
              || meta.native?.['ID3v2.4']?.find?.(t => t.id === 'USLT');
    if (uslt?.value?.text) lyrics = uslt.value.text;

    // common.lyrics
    if (!lyrics && c.lyrics && c.lyrics.length > 0) {
      const l = c.lyrics[0];
      if (typeof l === 'string') lyrics = l;
      else if (l?.text) lyrics = l.text;
    }

    // SYLT → plain text
    if (!lyrics) {
      const sylt = meta.native?.['ID3v2.3']?.find?.(t => t.id === 'SYLT')
                || meta.native?.['ID3v2.4']?.find?.(t => t.id === 'SYLT');
      if (sylt?.value?.text && Array.isArray(sylt.value.text)) {
        lyrics = sylt.value.text.map(e => e.text || e[0] || '').filter(Boolean).join('\n');
      }
    }

    // Vorbis comment (FLAC/OGG)
    if (!lyrics) {
      const vorbis = meta.native?.vorbis;
      if (vorbis) {
        const tag = vorbis.find(t => t.id?.toLowerCase() === 'lyrics' || t.id?.toLowerCase() === 'unsyncedlyrics');
        if (tag?.value) lyrics = tag.value;
      }
    }

    // Zapisz do DB jeśli znaleziono
    if (lyrics.trim()) {
      db.prepare('UPDATE songs SET lyrics=? WHERE id=?').run(lyrics, id);
    }

    return res.json({ lyrics, source: 'file' });
  } catch (e) {
    console.error('[lyrics/embedded]', e.message);
    return res.json({ lyrics: '', source: 'error' });
  }
});

// POST /api/play  – zarejestruj odtworzenie utworu
app.post('/api/play', (req, res) => {
  const { songId, durationPlayed = 0 } = req.body;
  if (!songId) return res.status(400).json({ error: 'Brak songId' });
  try {
    db.prepare('INSERT INTO play_history (song_id, duration_played) VALUES (?, ?)').run(songId, durationPlayed);
    res.json({ ok: true });
  } catch (e) {
    console.error('[play]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/stats/top?limit=50  – najczęściej odtwarzane
app.get('/api/stats/top', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const rows = db.prepare(`
    SELECT s.*, COUNT(ph.id) as play_count, MAX(ph.played_at) as last_played
    FROM songs s
    JOIN play_history ph ON ph.song_id = s.id
    LEFT JOIN favorites f ON f.song_id = s.id
    GROUP BY s.id
    ORDER BY play_count DESC
    LIMIT ?
  `).all(limit);
  res.json(rows.map(r => ({ ...r, isFavorite: !!r.isFavorite || undefined })));
});

// GET /api/stats/daily?days=30  – historia dzienna (ile odtworzeń per dzień)
app.get('/api/stats/daily', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const rows = db.prepare(`
    SELECT
      date(played_at, 'unixepoch', 'localtime') as day,
      COUNT(*) as count,
      SUM(duration_played) as total_seconds
    FROM play_history
    WHERE played_at >= strftime('%s','now','-' || ? || ' days')
    GROUP BY day
    ORDER BY day ASC
  `).all(days);
  res.json(rows);
});

// GET /api/stats/unplayed?days=60  – nie słuchane od X dni
app.get('/api/stats/unplayed', (req, res) => {
  const days = parseInt(req.query.days) || 60;
  const rows = db.prepare(`
    SELECT s.*, MAX(ph.played_at) as last_played, COUNT(ph.id) as play_count
    FROM songs s
    LEFT JOIN play_history ph ON ph.song_id = s.id
    LEFT JOIN favorites f ON f.song_id = s.id
    GROUP BY s.id
    HAVING last_played IS NULL OR last_played < strftime('%s','now','-' || ? || ' days')
    ORDER BY last_played ASC NULLS FIRST
    LIMIT 200
  `).all(days);
  res.json(rows.map(r => ({ ...r, isFavorite: r.isFavorite ? true : undefined })));
});

// GET /api/stats/summary  – ogólne podsumowanie
app.get('/api/stats/summary', (_req, res) => {
  const totalPlays  = db.prepare('SELECT COUNT(*) as n FROM play_history').get().n;
  const totalTime   = db.prepare('SELECT SUM(duration_played) as s FROM play_history').get().s || 0;
  const uniqueSongs = db.prepare('SELECT COUNT(DISTINCT song_id) as n FROM play_history').get().n;
  const todayPlays  = db.prepare("SELECT COUNT(*) as n FROM play_history WHERE played_at >= strftime('%s','now','start of day')").get().n;
  const thisWeek    = db.prepare("SELECT COUNT(*) as n FROM play_history WHERE played_at >= strftime('%s','now','-7 days')").get().n;
  res.json({ totalPlays, totalTime, uniqueSongs, todayPlays, thisWeek });
});

// ── Last.fm Scrobbling ───────────────────────────────────────────────────────

function lastfmSign(params, secret) {
  const str = Object.keys(params).sort().map(k => k + params[k]).join('') + secret;
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

async function lastfmCall(params, secret) {
  const signed = { ...params, api_sig: lastfmSign(params, secret) };
  const body = new URLSearchParams(signed).toString();
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'ws.audioscrobbler.com',
      path: '/2.0/',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'NeonPulsePlayer/3.4' },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// POST /api/lastfm/auth  – utwórz sesję przez token
app.post('/api/lastfm/auth', async (req, res) => {
  const { token } = req.body;
  const cfg = JSON.parse(db.prepare("SELECT value FROM settings WHERE key='lastfm'").get()?.value || 'null');
  if (!cfg?.apiKey || !cfg?.apiSecret) return res.status(400).json({ error: 'Brak konfiguracji Last.fm' });
  if (!token) return res.status(400).json({ error: 'Brak tokenu' });
  try {
    const data = await lastfmCall({ method: 'auth.getSession', api_key: cfg.apiKey, token, format: 'json' }, cfg.apiSecret);
    if (data.session) {
      const newCfg = { ...cfg, sessionKey: data.session.key, username: data.session.name };
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('lastfm', ?)").run(JSON.stringify(newCfg));
      res.json({ ok: true, username: data.session.name });
    } else {
      res.status(400).json({ error: data.error ? data.message : 'Nie udało się uzyskać sesji' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/lastfm/scrobble  – wyślij scrobble
app.post('/api/lastfm/scrobble', async (req, res) => {
  const { artist, title, album, duration, timestamp } = req.body;
  const cfg = JSON.parse(db.prepare("SELECT value FROM settings WHERE key='lastfm'").get()?.value || 'null');
  if (!cfg?.sessionKey) return res.status(400).json({ error: 'Brak sesji Last.fm' });
  if (!artist || !title) return res.status(400).json({ error: 'Brak metadanych' });
  try {
    const params = {
      method: 'track.scrobble',
      api_key: cfg.apiKey,
      sk: cfg.sessionKey,
      'artist[0]': artist,
      'track[0]': title,
      'timestamp[0]': String(timestamp || Math.floor(Date.now() / 1000)),
      format: 'json',
    };
    if (album) params['album[0]'] = album;
    if (duration) params['duration[0]'] = String(Math.floor(duration));
    const data = await lastfmCall(params, cfg.apiSecret);
    res.json({ ok: !data.error, data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/lastfm/nowplaying  – aktualizuj "teraz gra"
app.post('/api/lastfm/nowplaying', async (req, res) => {
  const { artist, title, album, duration } = req.body;
  const cfg = JSON.parse(db.prepare("SELECT value FROM settings WHERE key='lastfm'").get()?.value || 'null');
  if (!cfg?.sessionKey) return res.status(204).end();
  try {
    const params = {
      method: 'track.updateNowPlaying',
      api_key: cfg.apiKey,
      sk: cfg.sessionKey,
      artist, track: title,
      format: 'json',
    };
    if (album) params.album = album;
    if (duration) params.duration = String(Math.floor(duration));
    await lastfmCall(params, cfg.apiSecret);
    res.json({ ok: true });
  } catch { res.status(204).end(); }
});

// GET /api/lastfm/config  – pobierz aktualną konfigurację (bez secretu)
app.get('/api/lastfm/config', (_req, res) => {
  const raw = db.prepare("SELECT value FROM settings WHERE key='lastfm'").get()?.value;
  if (!raw) return res.json({ configured: false });
  const cfg = JSON.parse(raw);
  res.json({ configured: true, apiKey: cfg.apiKey, username: cfg.username || null, hasSession: !!cfg.sessionKey });
});

// POST /api/lastfm/config  – zapisz konfigurację (apiKey + apiSecret)
app.post('/api/lastfm/config', (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) return res.status(400).json({ error: 'Brak apiKey lub apiSecret' });
  const existing = JSON.parse(db.prepare("SELECT value FROM settings WHERE key='lastfm'").get()?.value || '{}');
  const cfg = { ...existing, apiKey, apiSecret, sessionKey: existing.sessionKey || null, username: existing.username || null };
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('lastfm', ?)").run(JSON.stringify(cfg));
  res.json({ ok: true });
});

// DELETE /api/lastfm/config  – wyloguj
app.delete('/api/lastfm/config', (_req, res) => {
  db.prepare("DELETE FROM settings WHERE key='lastfm'").run();
  res.json({ ok: true });
});

// GET /api/update/check  – sprawdź czy jest nowa wersja na GitHub
app.get('/api/update/check', async (req, res) => {
  try {
    const pkg = require('./package.json');
    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      const r = https.get(
        'https://api.github.com/repos/paffcio/neonpulse/releases/latest',
        { headers: { 'User-Agent': 'NeonPulsePlayer/3.4' } },
        resp => {
          let d = '';
          resp.on('data', c => d += c);
          resp.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
        }
      );
      r.on('error', reject);
      r.setTimeout(8000, () => { r.destroy(); reject(new Error('timeout')); });
    });
    const latest = data.tag_name?.replace(/^v/, '') || null;
    const current = pkg.version;
    const hasUpdate = latest && latest !== current;
    res.json({ current, latest: latest || current, hasUpdate, url: data.html_url || null });
  } catch (e) {
    res.json({ current: require('./package.json').version, latest: null, hasUpdate: false, error: e.message });
  }
});

// ── Playlist API (DB-backed) ─────────────────────────────────────────────────

// GET /api/playlists
app.get('/api/playlists', (_req, res) => {
  const pls = db.prepare('SELECT * FROM playlists ORDER BY created_at ASC').all();
  const result = pls.map(pl => {
    const songIds = db.prepare('SELECT song_id FROM playlist_songs WHERE playlist_id=? ORDER BY position ASC').all(pl.id).map(r => r.song_id);
    return { ...pl, songIds };
  });
  res.json(result);
});

// POST /api/playlists  – utwórz
app.post('/api/playlists', (req, res) => {
  const { id, name, songIds = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Brak nazwy' });
  const plId = id || `pl-${Date.now()}`;
  db.prepare('INSERT OR IGNORE INTO playlists (id, name) VALUES (?, ?)').run(plId, name);
  const ins = db.prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)');
  const tx = db.transaction(() => { songIds.forEach((sid, i) => ins.run(plId, sid, i)); });
  tx();
  res.json({ ok: true, id: plId });
});

// PUT /api/playlists/:id  – zmień nazwę
app.put('/api/playlists/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Brak nazwy' });
  db.prepare("UPDATE playlists SET name=?, updated_at=strftime('%s','now') WHERE id=?").run(name, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/playlists/:id  – usuń
app.delete('/api/playlists/:id', (req, res) => {
  db.prepare('DELETE FROM playlists WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/playlists/:id/songs  – dodaj utwór
app.post('/api/playlists/:id/songs', (req, res) => {
  const { songId } = req.body;
  if (!songId) return res.status(400).json({ error: 'Brak songId' });
  const maxPos = db.prepare('SELECT MAX(position) as m FROM playlist_songs WHERE playlist_id=?').get(req.params.id)?.m ?? -1;
  db.prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)').run(req.params.id, songId, maxPos + 1);
  db.prepare("UPDATE playlists SET updated_at=strftime('%s','now') WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/playlists/:id/songs/:songId  – usuń utwór z playlisty
app.delete('/api/playlists/:id/songs/:songId', (req, res) => {
  db.prepare('DELETE FROM playlist_songs WHERE playlist_id=? AND song_id=?').run(req.params.id, req.params.songId);
  res.json({ ok: true });
});

// POST /api/playlists/:id/reorder  – zmień kolejność
app.post('/api/playlists/:id/reorder', (req, res) => {
  const { songIds } = req.body;
  if (!Array.isArray(songIds)) return res.status(400).json({ error: 'Brak songIds' });
  const upd = db.prepare('UPDATE playlist_songs SET position=? WHERE playlist_id=? AND song_id=?');
  const tx  = db.transaction(() => { songIds.forEach((sid, i) => upd.run(i, req.params.id, sid)); });
  tx();
  res.json({ ok: true });
});

// GET /api/missing  – znajdź martwe wpisy (plik nie istnieje na dysku)
app.get('/api/missing', (_req, res) => {
  const songs = db.prepare('SELECT id, path, title, artist FROM songs').all();
  const missing = songs.filter(s => !fs.existsSync(s.path));
  res.json(missing);
});

// DELETE /api/missing  – usuń zaznaczone martwe wpisy z DB
app.delete('/api/missing', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Brak ids' });
  const del    = db.prepare('DELETE FROM songs WHERE id = ?');
  const delFav = db.prepare('DELETE FROM favorites WHERE song_id = ?');
  let removed = 0;
  const tx = db.transaction(() => {
    for (const id of ids) {
      delFav.run(id);
      const r = del.run(id);
      removed += r.changes;
      sseEmit('song_removed', { id });
    }
  });
  tx();
  res.json({ ok: true, removed });
});

// GET /api/duplicates  – wykryj duplikaty (ten sam tytuł+artysta lub ten sam rozmiar pliku)
app.get('/api/duplicates', (_req, res) => {
  // Grupuj po (lower(title), lower(artist)) – pomijaj puste tytuły
  const byMeta = db.prepare(`
    SELECT lower(trim(title)) as t, lower(trim(artist)) as a, COUNT(*) as cnt
    FROM songs
    WHERE trim(title) != '' AND trim(artist) != ''
    GROUP BY t, a
    HAVING cnt > 1
  `).all();

  const groups = [];
  for (const row of byMeta) {
    const songs = db.prepare(
      `SELECT id, path, title, artist, album, year, duration, filesize, cover
       FROM songs WHERE lower(trim(title))=? AND lower(trim(artist))=? ORDER BY added_at`
    ).all(row.t, row.a);
    if (songs.length > 1) groups.push({ key: `${row.t} – ${row.a}`, songs });
  }
  res.json(groups);
});

// DELETE /api/duplicates  – usuń wybrane duplikaty
app.delete('/api/duplicates', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Brak ids' });
  const getSong = db.prepare('SELECT path FROM songs WHERE id = ?');
  const del    = db.prepare('DELETE FROM songs WHERE id = ?');
  const delFav = db.prepare('DELETE FROM favorites WHERE song_id = ?');
  let removed = 0;
  const tx = db.transaction(() => {
    for (const id of ids) {
      const song = getSong.get(id);
      delFav.run(id);
      const r = del.run(id);
      if (r.changes > 0) {
        removed += 1;
        sseEmit('song_removed', { id });
        if (song?.path) {
          try { fs.unlinkSync(song.path); } catch (e) {
            console.warn('[duplicates] Nie mozna usunac pliku:', song.path, e.message);
          }
        }
      }
    }
  });
  tx();
  res.json({ ok: true, removed });
});

// POST /api/covers/fetch/:id  – pobierz okładkę z MusicBrainz (fallback)
app.post('/api/covers/fetch/:id', async (req, res) => {
  const { id } = req.params;
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
  if (!song) return res.status(404).json({ error: 'Brak utworu' });
  if (song.cover) return res.json({ ok: true, cover: song.cover, cached: true });

  const artist = encodeURIComponent(song.artist || '');
  const album  = encodeURIComponent(song.album  || '');
  const title  = encodeURIComponent(song.title  || '');

  try {
    // 1. Szukaj nagrania w MusicBrainz
    const mbUrl = `https://musicbrainz.org/ws/2/recording/?query=recording:${title}+AND+artist:${artist}&fmt=json&limit=3`;
    const https = require('https');
    const fetchJson = (url) => new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'NeonPulsePlayer/3.4 (https://github.com/paffcio/neonpulse)' } }, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    });
    const fetchBinary = (url) => new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'NeonPulsePlayer/3.4 (https://github.com/paffcio/neonpulse)' } }, (r) => {
        if (r.statusCode === 302 || r.statusCode === 301) {
          fetchBinary(r.headers.location).then(resolve).catch(reject); return;
        }
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => resolve({ data: Buffer.concat(chunks), contentType: r.headers['content-type'] || 'image/jpeg' }));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    });

    // 2. Szukaj releasu po album+artist w CAA
    let coverUrl = null;
    try {
      const caaSearch = `https://musicbrainz.org/ws/2/release/?query=release:${album}+AND+artist:${artist}&fmt=json&limit=5`;
      const caaData = await fetchJson(caaSearch);
      const releases = (caaData.releases || []).filter(r => r.score >= 70);
      for (const release of releases) {
        try {
          const caa = await fetchJson(`https://coverartarchive.org/release/${release.id}`);
          const front = (caa.images || []).find(i => i.front);
          if (front) { coverUrl = front.image; break; }
        } catch { /* brak okładki dla tego release */ }
      }
    } catch { /* MusicBrainz niedostępny */ }

    if (!coverUrl) return res.json({ ok: false, reason: 'Nie znaleziono okładki' });

    const { data, contentType } = await fetchBinary(coverUrl);
    const ext  = (contentType.split('/')[1] || 'jpg').replace('jpeg','jpg');
    const hash = crypto.createHash('md5').update(data).digest('hex');
    const dest = path.join(COVERS_DIR, `${hash}.${ext}`);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, data);
    const cover = `http://localhost:3001/covers/${hash}.${ext}`;
    db.prepare('UPDATE songs SET cover=? WHERE id=?').run(cover, id);
    sseEmit('tags_updated', { id, song: db.prepare('SELECT * FROM songs WHERE id=?').get(id) });
    res.json({ ok: true, cover });
  } catch (err) {
    console.error('[COVERS]', err.message);
    res.status(500).json({ ok: false, reason: err.message });
  }
});

// POST /api/playlists/import  – import M3U/PLS/XSPF
app.post('/api/playlists/import', (req, res) => {
  const { content, filename } = req.body;
  if (!content) return res.status(400).json({ error: 'Brak zawartości' });

  const ext = (filename || '').split('.').pop().toLowerCase();
  let paths = [];

  if (ext === 'm3u' || ext === 'm3u8') {
    paths = content.split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
  } else if (ext === 'pls') {
    paths = content.split(/\r?\n/)
      .filter(l => /^File\d+=/i.test(l))
      .map(l => l.replace(/^File\d+=/i, '').trim());
  } else if (ext === 'xspf') {
    const matches = content.match(/<location>(.*?)<\/location>/gi) || [];
    paths = matches.map(m => m.replace(/<\/?location>/gi, '').replace(/^file:\/\//, '').trim());
  } else {
    return res.status(415).json({ error: 'Nieobsługiwany format. Użyj M3U, PLS lub XSPF.' });
  }

  // Mapuj ścieżki na id w bazie
  const songIds = [];
  const missing = [];
  for (const p of paths) {
    const id = songId(p);
    const exists = db.prepare('SELECT id FROM songs WHERE id = ?').get(id);
    if (exists) songIds.push(id);
    else missing.push(p);
  }

  res.json({
    ok: true,
    songIds,
    missing,
    name: (filename || 'importowana').replace(/\.[^.]+$/, ''),
  });
});

// GET /api/playlists/export  – eksport M3U
app.get('/api/playlists/export', (req, res) => {
  const { ids, name } = req.query;
  if (!ids) return res.status(400).json({ error: 'Brak ids' });

  const idList = ids.split(',').map(s => s.trim()).filter(Boolean);
  const songs = idList.map(id => db.prepare('SELECT path, title, artist, duration FROM songs WHERE id=?').get(id)).filter(Boolean);

  let m3u = '#EXTM3U\n';
  for (const s of songs) {
    const dur = Math.round(s.duration || -1);
    m3u += `#EXTINF:${dur},${s.artist || ''} - ${s.title || ''}\n${s.path}\n`;
  }

  const safeName = (name || 'playlist').replace(/[^\w\s-]/g, '').trim() || 'playlist';
  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.m3u"`);
  res.send(m3u);
});

// GET /api/events  (SSE)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(': connected\n\n');

  sseClients.add(res);
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25_000);
  req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
});

// ── Start ────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[SERVER] Uruchomiony, port ${PORT}`);
  const paths = getWatchedPaths();
  if (paths.length) {
    startWatcher(paths);
    const count = db.prepare('SELECT COUNT(*) as n FROM songs').get().n;
    if (count === 0) scanPaths(paths).catch(console.error);
  }
});

module.exports = app;

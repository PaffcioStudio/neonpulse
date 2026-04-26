import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Search, Heart, Disc, Music2, Mic2, Sparkles, Shuffle, ListOrdered, Tag, ListPlus } from 'lucide-react';

import Sidebar          from './Sidebar';
import PlayerBar        from './PlayerBar';
import TrackList        from './views/TrackList';
import SettingsView     from './views/SettingsView';
import GenresView       from './views/GenresView';
import PlaylistsView    from './views/PlaylistsView';
import ArtistDetailView from './views/ArtistDetailView';
import AlbumDetailView  from './views/AlbumDetailView';
import MissingFilesView from './views/MissingFilesView';
import DuplicatesView   from './views/DuplicatesView';
import LyricsView       from './views/LyricsView';
import StatsView        from './views/StatsView';
import ContextMenu      from './ContextMenu';
import TagEditorModal   from './TagEditorModal';
import ImportExportModal from './ImportExportModal';
import QueuePanel       from './QueuePanel';
import HeartButton      from './HeartButton';
import { usePlayer, REPEAT_MODES } from '../hooks/usePlayer';
import { useLastFm } from '../hooks/useLastFm';
import MiniPlayer from './MiniPlayer';
import {
  getCoverSrc, COVER_PLACEHOLDER, filterBySmartRules,
  shuffleArray, pluralTracks, extractDominantColor, applyTheme
} from '../utils';

import { ipcRenderer } from '../ipc';
// W trybie dev Vite proxy przekierowuje /api → localhost:3001 (brak CORS)
// W Electronie (production) React ładowany jest z file://, więc potrzeba pełnego URL
const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api'
  : 'http://localhost:3001/api';

const DEFAULT_SMART = [
  { id:'fav-dopamine',   name:'Dopamina z Ulubionych', description:'Tylko ulubione.',                    rules:{ favoritesOnly:true } },
  { id:'decades-90-00',  name:'Nostalgia 90/00',        description:'Hity z lat 1990–2010.',             rules:{ yearFrom:1990, yearTo:2010 } },
  { id:'modern-bangers', name:'Nowa Era',                description:'Rok 2000+ – świeże brzmienia.',    rules:{ yearFrom:2000 } },
  { id:'chill-mode',     name:'Night Chill',             description:'Spokojnie – nocne scrollowanie.',  rules:{ genreIncludes:['ambient','chill','lofi','downtempo'] } },
];

const DEFAULT_SETTINGS = {
  autoPlayLast:false, continueOnStart:false, gaplessPlayback:false, crossfade:false,
  defaultShuffle:false, rememberVolume:true, rememberQueue:false,
  minimizeToTray:true, startMinimized:false, showTrayControls:true,
  mprisEnabled:true, hardwareAccel:true,
  animationsEnabled:true, showVisualizer:true, compactMode:false, showAlbumColors:true,
  fadeInOnPlay:false, replayGainEnabled:true,
  theme:'fuchsia',
};

// ─────────────────────────────────────────────────────────────
export default function MusicPlayer() {

  // UI
  const [activeView,      setActiveViewRaw] = useState('home');
  const [isTransitioning, setTransitioning] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [isSidebarOpen,   setSidebarOpen]   = useState(true);
  const [isMiniPlayer,    setIsMiniPlayer]  = useState(false);
  const [isQueueOpen,     setIsQueueOpen]   = useState(false);
  const [searchQuery,     setSearchQuery]   = useState('');
  const [scanInfo,        setScanInfo]      = useState({ isScanning:false, count:0 });
  const [ctxMenu,         setCtxMenu]       = useState({ visible:false, x:0, y:0, song:null });
  const [tagEditorSong,   setTagEditorSong]   = useState(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [albumColor,      setAlbumColor]    = useState(null);

  // Detail views
  const [selectedArtist, setSelectedArtist] = useState(null); // nazwa artysty
  const [selectedAlbum,  setSelectedAlbum]  = useState(null); // nazwa albumu

  // Data
  const [library,    setLibrary]    = useState([]);
  const [musicPaths, setMusicPaths] = useState([]);

  // Playlisty użytkownika
  const [playlists, setPlaylists] = useState([]);

  // Smart
  const [smartPlaylists, setSmartPlaylists] = useState(DEFAULT_SMART);
  const [activeSmartId,  setActiveSmartId]  = useState(null);
  const [newSmartName, setNewSmartName]     = useState('');
  const [newSmartYearFrom, setNewSmartYearFrom] = useState('');
  const [newSmartYearTo,   setNewSmartYearTo]   = useState('');
  const [newSmartFavOnly,  setNewSmartFavOnly]  = useState(false);
  const [newSmartGenre,    setNewSmartGenre]    = useState('');

  // Settings
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('neonpulse_settings')||'{}') }; }
    catch { return DEFAULT_SETTINGS; }
  });

  // Player hook
  const player = usePlayer(settings, (msg) => setToasts(prev => { const id = Date.now(); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000); return [...prev, { id, msg, type: 'error' }]; }));

  // ─── Last.fm scrobbling ─────────────────────────────────────
  useLastFm(player.currentSong, player.isPlaying, player.progress);

  // ─── Toast notifications ──────────────────────────────────────
  const showToast = useCallback((msg, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Refs
  const canvasRef    = useRef(null);
  const animFrameRef = useRef(null);
  const homeRef      = useRef(null);

  // ─── Motyw ─────────────────────────────────────────────────
  useEffect(() => {
    applyTheme(settings.theme || 'fuchsia');
  }, [settings.theme]);

  // ─── Wyślij ustawienia systemowe do electron przy starcie ───
  useEffect(() => {
    ipcRenderer.send('app:settings', {
      minimizeToTray:   settings.minimizeToTray,
      startMinimized:   settings.startMinimized,
      showTrayControls: settings.showTrayControls,
      hardwareAccel:    settings.hardwareAccel,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── continueOnStart – przywróć kolejkę i wznów po starcie ──
  const restoredRef = React.useRef(false);
  useEffect(() => {
    // Uruchamia się raz gdy biblioteka się załaduje
    if (library.length === 0) return;
    if (restoredRef.current) return;
    restoredRef.current = true;

    if (!settings.continueOnStart && !settings.autoPlayLast) return;

    try {
      const savedIds  = JSON.parse(localStorage.getItem('neonpulse_queue')    || '[]');
      const savedIdx  = JSON.parse(localStorage.getItem('neonpulse_queue_idx')|| '0');
      const savedPos  = JSON.parse(localStorage.getItem('neonpulse_last_pos') || '0');
      const wasPlaying = JSON.parse(localStorage.getItem('neonpulse_was_playing') || 'false');

      if (!savedIds || savedIds.length === 0) return;

      // Zmapuj ID-ki na obiekty z biblioteki
      const songs = savedIds.map(id => library.find(s => s.id === id)).filter(Boolean);
      if (songs.length === 0) return;

      const idx  = Math.min(savedIdx, songs.length - 1);
      const song = songs[idx];
      if (!song) return;

      // Ustaw kolejkę i utwór
      player.setQueue(songs);
      player.setQueueIndex(idx);
      player.setCurrentSong(song);

      // Przywróć pozycję
      if (savedPos > 0 && player.audioRef?.current) {
        setTimeout(() => {
          if (player.audioRef.current) player.audioRef.current.currentTime = savedPos;
        }, 300);
      }

      // Wznów odtwarzanie jeśli grało
      if (wasPlaying && settings.continueOnStart) {
        setTimeout(() => player.setIsPlaying(true), 400);
      }
    } catch (e) {
      console.warn('[restore]', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  // ─── Zapisz stan odtwarzania przy zamknięciu ────────────────
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem('neonpulse_was_playing', JSON.stringify(player.isPlaying));
        // Zapisz też kolejkę i indeks jeśli nie zrobił tego usePlayer
        if (player.queue?.length > 0) {
          localStorage.setItem('neonpulse_queue',     JSON.stringify(player.queue.map(s => s.id)));
          localStorage.setItem('neonpulse_queue_idx', JSON.stringify(player.queueIndex));
        }
        if (player.audioRef?.current && player.progress > 0) {
          localStorage.setItem('neonpulse_last_pos', JSON.stringify(player.progress));
        }
      } catch {}
    };
    window.addEventListener('beforeunload', save);
    // IPC: Electron może wysłać 'app:before-quit' zanim okno się zamknie
    try { ipcRenderer.on('app:before-quit', save); } catch {}
    return () => {
      window.removeEventListener('beforeunload', save);
      try { ipcRenderer.removeListener('app:before-quit', save); } catch {}
    };
  }, [player.isPlaying, player.queue, player.queueIndex, player.progress]);

  // ─── Album ambient color ────────────────────────────────────
  useEffect(() => {
    if (!settings.showAlbumColors || !player.currentSong?.cover) { setAlbumColor(null); return; }
    extractDominantColor(getCoverSrc(player.currentSong.cover), color => setAlbumColor(color));
  }, [player.currentSong?.cover, settings.showAlbumColors]);

  // ─── Rejestruj odtworzenie w historii ──────────────────────
  const playStartRef  = React.useRef(null);
  const playedSongRef = React.useRef(null);
  const accPlayedRef  = React.useRef(0);   // skumulowany czas odtwarzania

  const submitPlay = React.useCallback((songId, durationPlayed) => {
    if (!songId || durationPlayed < 10) return;
    fetch(`${API_URL}/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, durationPlayed }),
    }).catch(() => {});
  }, []);

  // Akumuluj czas gdy gra
  useEffect(() => {
    if (!player.isPlaying || !player.currentSong) {
      // Zatrzymano — zapisz czas od ostatniego start
      if (playStartRef.current) {
        accPlayedRef.current += (Date.now() - playStartRef.current) / 1000;
        playStartRef.current = null;
      }
    } else {
      // Zaczęto grać
      playStartRef.current = Date.now();
    }
  }, [player.isPlaying]);

  // Zmiana utworu — zapisz poprzedni
  useEffect(() => {
    const prevId = playedSongRef.current;
    if (prevId) {
      let total = accPlayedRef.current;
      if (playStartRef.current) total += (Date.now() - playStartRef.current) / 1000;
      submitPlay(prevId, total);
    }
    playedSongRef.current = player.currentSong?.id || null;
    accPlayedRef.current  = 0;
    playStartRef.current  = player.isPlaying ? Date.now() : null;
  }, [player.currentSong?.id]);

  // Przy zamknięciu — zapisz bieżący utwór
  useEffect(() => {
    const onUnload = () => {
      if (!playedSongRef.current) return;
      let total = accPlayedRef.current;
      if (playStartRef.current) total += (Date.now() - playStartRef.current) / 1000;
      submitPlay(playedSongRef.current, total);
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [submitPlay]);

  // ─── Przejście widoku ────────────────────────────────────────
  const setActiveView = useCallback((view, opts = {}) => {
    if (view === activeView && opts.artist === undefined && opts.album === undefined) return;
    setSelectedArtist(opts.artist !== undefined ? opts.artist : null);
    setSelectedAlbum(opts.album  !== undefined ? opts.album  : null);
    if (!settings.animationsEnabled) { setActiveViewRaw(view); return; }
    setTransitioning(true);
    setTimeout(() => { setActiveViewRaw(view); setTransitioning(false); }, 120);
  }, [activeView, settings.animationsEnabled]);

  // ─── Fetch ────────────────────────────────────────────────
  const fetchLibrary = useCallback(async (retries = 5, delay = 800) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const [lR, pR] = await Promise.all([
          fetch(`${API_URL}/library`),
          fetch(`${API_URL}/settings/paths`),
        ]);
        if (!lR.ok || !pR.ok) throw new Error(`HTTP ${lR.status}/${pR.status}`);
        const lib   = await lR.json();
        const paths = await pR.json();
        setLibrary(Array.isArray(lib)   ? lib   : []);
        setMusicPaths(Array.isArray(paths) ? paths : []);
        return;
      } catch(e) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delay * (attempt + 1)));
        } else {
          console.error('[API] fetchLibrary failed after retries:', e);
          showToast('Błąd połączenia z serwerem — sprawdź czy aplikacja jest uruchomiona poprawnie', 'error');
        }
      }
    }
  }, []);

  // ─── Playlisty user ─────────────────────────────────────────
  const fetchPlaylists = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/playlists`);
      if (!r.ok) return;
      const data = await r.json();
      setPlaylists(data);
      // Jednorazowa migracja z localStorage → DB
      if (data.length === 0) {
        try {
          const local = JSON.parse(localStorage.getItem('neonpulse_playlists') || '[]');
          if (local.length > 0) {
            await Promise.all(local.map(pl =>
              fetch(`${API_URL}/playlists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: pl.id, name: pl.name, songIds: pl.songIds || [] }),
              })
            ));
            localStorage.removeItem('neonpulse_playlists');
            const r2 = await fetch(`${API_URL}/playlists`);
            if (r2.ok) setPlaylists(await r2.json());
          }
        } catch {}
      }
    } catch (e) { console.error('[playlists]', e); }
  }, []);

  useEffect(() => {
    fetchLibrary();
    fetchPlaylists();
    const es = new EventSource(`${API_URL}/events`);
    es.addEventListener('song_added',      () => fetchLibrary());
    es.addEventListener('song_removed',    () => fetchLibrary());
    es.addEventListener('library_changed', () => fetchLibrary());
    es.addEventListener('favorite_changed', e => {
      const { id, isFavorite } = JSON.parse(e.data);
      setLibrary(prev => prev.map(s => s.id===id ? {...s, isFavorite} : s));
      player.setCurrentSong(prev => prev?.id===id ? {...prev, isFavorite} : prev);
      player.setQueue(prev => prev.map(s => s.id===id ? {...s, isFavorite} : s));
    });
    es.addEventListener('scan_done', e => { setScanInfo({ isScanning:false, count:JSON.parse(e.data).count }); fetchLibrary(); });
    es.addEventListener('status',    e => { const d=JSON.parse(e.data); setScanInfo({ isScanning:d.isScanning, count:d.count||0, scanned:d.scanned, total:d.total }); });
    es.onerror = () => {};
    return () => es.close();
  }, [fetchLibrary, fetchPlaylists]);

  // ─── Sync tray controls z ustawieniami ─────────────────────
  useEffect(() => {
    if (player.currentSong) {
      ipcRenderer.send('player:update', {
        title: player.currentSong.title,
        artist: player.currentSong.artist,
        album: player.currentSong.album,
        cover: getCoverSrc(player.currentSong.cover) || '',
        duration: player.currentSong.duration,
        position: 0,
        isPlaying: player.isPlaying,
        showTrayControls: settings.showTrayControls,
      });
    }
  }, [settings.showTrayControls, player.currentSong]);

  // ─── Context menu zamknięcie ────────────────────────────────
  useEffect(() => {
    const close = () => setCtxMenu(p => ({ ...p, visible:false }));
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // ─── Wizualizator ────────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (activeView !== 'home' || !settings.showVisualizer ||
        !canvasRef.current || !player.analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const analyser = player.analyserRef.current;
    const freqBuf  = new Uint8Array(analyser.frequencyBinCount);
    const timeBuf  = new Uint8Array(analyser.fftSize);

    let w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w; canvas.height = h;

    const onResize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w; canvas.height = h;
    };
    window.addEventListener('resize', onResize);

    const accentRaw = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-from').trim();
    const accentRgb = hexToRgb(accentRaw);
    const accentRgb2 = hexToRgb(
      getComputedStyle(document.documentElement).getPropertyValue('--accent-to').trim() || accentRaw
    );

    // Cząsteczki
    const PARTICLE_COUNT = 60;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * 1, y: Math.random() * 1,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.0004 + 0.0001,
      angle: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    let t = 0;
    let lastFrame = 0;

    const render = (ts) => {
      animFrameRef.current = requestAnimationFrame(render);
      if (ts - lastFrame < 20) return; // ~50fps
      lastFrame = ts;
      t += 0.012;

      analyser.getByteFrequencyData(freqBuf);
      analyser.getByteTimeDomainData(timeBuf);

      // Bass / mid / treble energy
      const bass   = freqBuf.slice(0, 8).reduce((a,b)=>a+b,0)  / (8*255);
      const mid    = freqBuf.slice(8, 48).reduce((a,b)=>a+b,0) / (40*255);
      const treble = freqBuf.slice(48).reduce((a,b)=>a+b,0)    / (freqBuf.length*255);
      const energy = (bass * 0.6 + mid * 0.3 + treble * 0.1);
      const playing = player.isPlaying;

      // Wyczyść
      ctx.clearRect(0, 0, w, h);

      // ── 1. Pulsujące koło tła (bass) ──────────────────────────
      const cx = w * 0.5, cy = h * 0.5;
      const baseR = Math.min(w, h) * 0.28;
      const pulseR = baseR * (1 + (playing ? bass * 0.35 : 0.02 * Math.sin(t)));
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR * 1.8);
      grad.addColorStop(0, `rgba(${accentRgb},${0.10 + (playing ? bass*0.20 : 0.02)})`);
      grad.addColorStop(0.5, `rgba(${accentRgb2},${0.04 + (playing ? mid*0.08 : 0.01)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // ── 2. Okrąg spektrum (słupki w kole) ─────────────────────
      const BARS = 120;
      const innerR = baseR * 0.7;
      for (let i = 0; i < BARS; i++) {
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        const fi = Math.floor((i / BARS) * freqBuf.length * 0.75);
        const v = playing ? freqBuf[fi] / 255 : 0.02 + 0.02 * Math.sin(t + i * 0.2);
        const barLen = v * Math.min(w, h) * 0.18;
        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * (innerR + barLen);
        const y2 = cy + Math.sin(angle) * (innerR + barLen);
        const alpha = 0.3 + v * 0.7;
        const t2 = i / BARS;
        const r = Math.round(parseInt(accentRgb.split(',')[0])*(1-t2) + parseInt(accentRgb2.split(',')[0])*t2);
        const g2 = Math.round(parseInt(accentRgb.split(',')[1])*(1-t2) + parseInt(accentRgb2.split(',')[1])*t2);
        const b2 = Math.round(parseInt(accentRgb.split(',')[2])*(1-t2) + parseInt(accentRgb2.split(',')[2])*t2);
        ctx.strokeStyle = `rgba(${r},${g2},${b2},${alpha})`;
        ctx.lineWidth = Math.max(1.5, (w / 700) * 2.5);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

      // ── 3. Fala waveform (na dole) ────────────────────────────
      const waveY = h * 0.82;
      const waveH = h * 0.15;
      ctx.beginPath();
      ctx.moveTo(0, waveY);
      for (let i = 0; i < w; i++) {
        const fi = Math.floor((i / w) * timeBuf.length);
        const v = playing ? ((timeBuf[fi] - 128) / 128) : (Math.sin(t * 1.5 + i * 0.02) * 0.15);
        ctx.lineTo(i, waveY + v * waveH);
      }
      const waveGrad = ctx.createLinearGradient(0, 0, w, 0);
      waveGrad.addColorStop(0, `rgba(${accentRgb},0)`);
      waveGrad.addColorStop(0.2, `rgba(${accentRgb},${0.3 + energy * 0.4})`);
      waveGrad.addColorStop(0.8, `rgba(${accentRgb2},${0.3 + energy * 0.4})`);
      waveGrad.addColorStop(1, `rgba(${accentRgb2},0)`);
      ctx.strokeStyle = waveGrad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── 4. Cząsteczki unoszące się w rytm ─────────────────────
      for (const p of particles) {
        p.angle += p.speed * (1 + (playing ? energy * 3 : 0));
        const drift = playing ? bass * 0.15 : 0;
        p.y -= p.speed * (0.3 + (playing ? energy * 1.2 : 0));
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        const px = (p.x + Math.sin(p.angle) * 0.06) * w;
        const py = p.y * h;
        const sz = p.size * (1 + (playing ? bass * 1.5 : 0));
        const alpha = p.opacity * (0.4 + (playing ? energy * 0.6 : 0));
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${accentRgb},${alpha})`;
        ctx.fill();
      }

      // ── 5. Słupki na górze (treble) ───────────────────────────
      if (playing) {
        const TB = 32;
        const tw = w / TB;
        for (let i = 0; i < TB; i++) {
          const fi = Math.floor(((freqBuf.length * 0.4) + i * (freqBuf.length * 0.02)));
          const v = freqBuf[Math.min(fi, freqBuf.length-1)] / 255;
          const bh = v * h * 0.08;
          ctx.fillStyle = `rgba(${accentRgb2},${v * 0.5})`;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(i * tw + 1, 0, tw - 2, bh, [0,0,4,4]);
          else ctx.rect(i * tw + 1, 0, tw - 2, bh);
          ctx.fill();
        }
      }
    };

    render(0);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [activeView, player.isPlaying, settings.showVisualizer, settings.theme]);

  // ─── Filtry ─────────────────────────────────────────────────
  const searchFiltered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return library;
    return library.filter(s =>
      (s.title||'').toLowerCase().includes(q) ||
      (s.artist||'').toLowerCase().includes(q) ||
      (s.album||'').toLowerCase().includes(q)
    );
  }, [library, searchQuery]);

  const displayList = useMemo(() => {
    switch (activeView) {
      case 'favorites': return searchFiltered.filter(s => s.isFavorite);
      case 'mix-80':    return searchFiltered.filter(s => s.year>=1980 && s.year<1990);
      case 'mix-90':    return searchFiltered.filter(s => s.year>=1990 && s.year<2000);
      case 'mix-00':    return searchFiltered.filter(s => s.year>=2000 && s.year<2010);
      case 'smart':
        const pl = smartPlaylists.find(p => p.id === activeSmartId);
        return pl ? filterBySmartRules(searchFiltered, pl.rules) : [];
      default: return searchFiltered;
    }
  }, [activeView, searchFiltered, smartPlaylists, activeSmartId]);

  const groupedAlbums = useMemo(() => {
    const g = {};
    searchFiltered.forEach(s => { const k=s.album||'Nieznany album'; (g[k]=g[k]||[]).push(s); });
    return g;
  }, [searchFiltered]);

  const groupedArtists = useMemo(() => {
    const g = {};
    searchFiltered.forEach(s => { const k=s.artist||'Nieznany artysta'; (g[k]=g[k]||[]).push(s); });
    return g;
  }, [searchFiltered]);



  const createPlaylist = async (name) => {
    const id = `pl-${Date.now()}`;
    await fetch(`${API_URL}/playlists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) });
    fetchPlaylists();
  };
  const deletePlaylist = async (id) => {
    await fetch(`${API_URL}/playlists/${id}`, { method: 'DELETE' });
    fetchPlaylists();
  };
  const renamePlaylist = async (id, name) => {
    await fetch(`${API_URL}/playlists/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    fetchPlaylists();
  };
  const addToPlaylist = async (plId, songId) => {
    await fetch(`${API_URL}/playlists/${plId}/songs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songId }) });
    fetchPlaylists();
  };

  // ─── Akcje ──────────────────────────────────────────────────
  const toggleFavorite = useCallback(async (id) => {
    try {
      await fetch(`${API_URL}/favorite`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) });
    } catch(e) { console.error('[FAV]', e); }
  }, []);

  const handleBrowseFolder = async () => {
    const p = await ipcRenderer.invoke('select-folder');
    if (!p) return;
    await fetch(`${API_URL}/settings/paths`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ path:p }) });
    fetchLibrary();
  };

  const handleRemovePath = async (p) => {
    await fetch(`${API_URL}/settings/paths`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ path:p }) });
    fetchLibrary();
  };

  const handleRescan = () => fetch(`${API_URL}/library/rescan`, { method:'POST' });

  // ── Skróty klawiszowe ──────────────────────────────────────────
  const searchInputRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Ctrl+F – fokus na wyszukiwarkę
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      // Esc – wyczyść wyszukiwarkę jeśli aktywna
      if (e.key === 'Escape' && inInput) {
        setSearchQuery('');
        document.activeElement.blur();
        return;
      }
      if (inInput) return; // nie przechwytuj gdy piszemy

      switch (e.key) {
        case ' ':
          e.preventDefault();
          player.handlePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.shiftKey ? player.seekTo(player.audioRef.current?.currentTime + 10) : player.handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.shiftKey ? player.seekTo(player.audioRef.current?.currentTime - 10) : player.handlePrev();
          break;
        case 'ArrowUp':
          e.preventDefault();
          player.setVolume(v => Math.min(1, v + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          player.setVolume(v => Math.max(0, v - 0.05));
          break;
        case 'm': case 'M':
          player.setIsMuted(v => !v);
          break;
        case 's': case 'S':
          player.setIsShuffle(v => !v);
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [player]);

  // ── Drag & Drop plików/folderów do okna ───────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  useEffect(() => {
    const onDragEnter = (e) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
    };
    const onDragLeave = () => {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) setIsDragOver(false);
    };
    const onDragOver = (e) => e.preventDefault();
    const onDrop = async (e) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      const items = [...e.dataTransfer.items];
      const paths = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          paths.push(entry.fullPath || item.getAsFile()?.path);
        } else {
          const file = item.getAsFile();
          if (file?.path) paths.push(require('path').dirname(file.path));
        }
      }
      const unique = [...new Set(paths.filter(Boolean))];
      for (const p of unique) {
        await fetch(`${API_URL}/settings/paths`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: p }),
        });
      }
      if (unique.length) {
        fetch(`${API_URL}/library/rescan`, { method: 'POST' });
        showToast(`Dodano ${unique.length} folder${unique.length > 1 ? 'y' : ''} do biblioteki`, 'success');
      }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover',  onDragOver);
    window.addEventListener('drop',      onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover',  onDragOver);
      window.removeEventListener('drop',      onDrop);
    };
  }, []);

  const openCtx = (e, song) => { e.preventDefault(); setCtxMenu({ visible:true, x:e.clientX, y:e.clientY, song }); };

  const handleCtxAction = (action, song) => {
    switch (action) {
      case 'play-now':   player.playFromList(song, displayList); break;
      case 'play-next':  player.playNextInQueue(song);            break;
      case 'add-queue':  player.addToQueue(song);                 break;
      case 'toggle-fav': toggleFavorite(song.id);                 break;
      case 'go-artist':
        setActiveView('artists', { artist: song.artist || null });
        break;
      case 'go-album':
        setActiveView('albums', { album: song.album || null });
        break;
      case 'edit-tags':
        setTagEditorSong(song);
        break;
      case 'fetch-cover':
        (async () => {
          showToast('Szukam okładki w MusicBrainz…', 'info');
          try {
            const r = await fetch(`${API_URL}/covers/fetch/${song.id}`, { method: 'POST' });
            const data = await r.json();
            if (data.ok && data.cover) {
              setLibrary(prev => prev.map(s => s.id === song.id ? { ...s, cover: data.cover } : s));
              if (player.currentSong?.id === song.id)
                player.setCurrentSong({ ...player.currentSong, cover: data.cover });
              showToast('Okładka zaktualizowana!', 'success');
            } else {
              showToast(data.reason || 'Nie znaleziono okładki', 'warn');
            }
          } catch {
            showToast('Błąd połączenia z MusicBrainz', 'error');
          }
        })();
        break;
    }
    if (action.startsWith('add-pl-')) {
      addToPlaylist(action.replace('add-pl-', ''), song.id);
    }
    if (action.startsWith('new-pl:')) {
      const name = action.replace('new-pl:', '').trim();
      if (name) {
        fetch(`${API_URL}/playlists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: `pl-${Date.now()}`, name, songIds: [song.id] }) }).then(() => fetchPlaylists());
      }
    }
    setCtxMenu(p => ({ ...p, visible:false }));
  };

  const handleCreateSmart = (e) => {
    e.preventDefault();
    if (!newSmartName.trim()) return;
    const rules = {
      favoritesOnly: newSmartFavOnly,
      yearFrom: newSmartYearFrom ? Number(newSmartYearFrom) : undefined,
      yearTo:   newSmartYearTo   ? Number(newSmartYearTo)   : undefined,
      genreIncludes: newSmartGenre ? newSmartGenre.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [],
    };
    const id = `user-${Date.now()}`;
    setSmartPlaylists(prev => [...prev, { id, name:newSmartName.trim(), description:'Twoja smart playlista.', rules }]);
    setActiveSmartId(id);
    setNewSmartName(''); setNewSmartYearFrom(''); setNewSmartYearTo(''); setNewSmartFavOnly(false); setNewSmartGenre('');
    setActiveViewRaw('smart');
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]:value };
      try { localStorage.setItem('neonpulse_settings', JSON.stringify(next)); } catch {}
      // Przekaż ustawienia systemowe do electron-main
      ipcRenderer.send('app:settings', {
        minimizeToTray:   next.minimizeToTray,
        startMinimized:   next.startMinimized,
        showTrayControls: next.showTrayControls,
      });
      return next;
    });
  };

  // ─── Render helpers ──────────────────────────────────────────
  const contentCls = `flex-1 overflow-y-auto custom-scrollbar relative transition-opacity duration-[120ms] ${isTransitioning ? 'opacity-0' : 'opacity-100'}`;
  const cover      = getCoverSrc(player.currentSong?.cover);

  const isListView = ['library','favorites','mix-80','mix-90','mix-00','smart'].includes(activeView);

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar
        activeView={activeView} setActiveView={setActiveView}
        isOpen={isSidebarOpen} setOpen={setSidebarOpen}
        scanInfo={scanInfo} libraryCount={library.length}
        onImportExport={() => setShowImportExport(true)}
      />

      <main className="flex-1 flex flex-col bg-gradient-to-br from-zinc-900 via-zinc-950 to-black overflow-hidden relative">

        {/* Album ambient background */}
        {settings.showAlbumColors && albumColor && (
          <div
            className="absolute inset-0 pointer-events-none z-0 transition-all duration-[1200ms]"
            style={{
              background: `radial-gradient(ellipse 70% 60% at 20% 30%, ${albumColor}22 0%, transparent 65%)`
            }}
          />
        )}

        {/* TOP BAR */}
        <div className="relative z-30 h-14 flex items-center justify-between px-5 bg-black/20 backdrop-blur-sm border-b border-zinc-800/40 flex-shrink-0">
          <div className="flex-1 max-w-lg relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
            <input
              value={searchQuery}
              ref={searchInputRef}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Szukaj po tytule, artyście, albumie…"
              className="w-full bg-zinc-900/70 border border-zinc-800/60 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none transition-all"
              style={{ '--tw-ring-color': 'var(--accent-border)' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
              onBlur={e  => e.target.style.borderColor = ''}
            />
          </div>
          <button
            onClick={() => setIsQueueOpen(p => !p)}
            className={`ml-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
              isQueueOpen ? 'accent-border accent-text accent-bg' : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
            }`}
          >
            <ListOrdered size={13} /> {player.queue.length}
          </button>
        </div>

        {/* CONTENT */}
        <div className={`${contentCls} relative z-10`}>

          {/* ── HOME ── */}
          {activeView === 'home' && (
            <div className="h-full relative flex flex-col" ref={homeRef}>
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 z-10" />
                {settings.showVisualizer && <canvas ref={canvasRef} className="w-full h-full opacity-80" style={{ mixBlendMode: "screen" }} />}
              </div>

              <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
                {player.currentSong ? (
                  <div className="flex flex-col items-center gap-6 max-w-5xl w-full">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-10 w-full justify-center">
                      {/* Cover */}
                      <div className="relative group flex-shrink-0">
                        {settings.showAlbumColors && albumColor && (
                          <div className="absolute -inset-3 rounded-2xl blur-2xl opacity-40 transition-all duration-[1200ms]"
                            style={{ background: albumColor }} />
                        )}
                        <img
                          src={cover || COVER_PLACEHOLDER(384)}
                          className="relative w-64 h-64 md:w-80 md:h-80 rounded-2xl shadow-2xl object-cover border border-white/5"
                          alt={player.currentSong.title}
                        />
                        {/* Play indicator */}
                        {player.isPlaying && (
                          <div className="absolute bottom-3 right-3 flex gap-0.5 items-end">
                            {[1,2,3,4].map(i => (
                              <div key={i} className="w-0.5 rounded-full accent-gradient animate-pulse"
                                style={{ height:`${8+i*3}px`, animationDelay:`${i*100}ms` }} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="text-center md:text-left space-y-2 min-w-0 flex-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10 text-xs font-semibold accent-text mb-1">
                          <Music2 size={11} /> {player.currentSong.genre || 'Gatunek nieznany'}
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black leading-none tracking-tight">{player.currentSong.title}</h1>
                        <h2 className="text-xl md:text-3xl text-zinc-300 font-bold">{player.currentSong.artist}</h2>
                        <h3 className="text-sm text-zinc-500">
                          {player.currentSong.album}
                          {player.currentSong.year > 0 ? ` • ${player.currentSong.year}` : ''}
                        </h3>
                        <HeartButton
                          isFavorite={!!player.currentSong.isFavorite}
                          onToggle={() => toggleFavorite(player.currentSong.id)}
                          size={22}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {player.currentSong.lyrics && (
                      <div className="p-5 bg-black/40 backdrop-blur rounded-2xl border border-white/5 w-full max-w-xl max-h-44 overflow-y-auto custom-scrollbar text-center">
                        <p className="whitespace-pre-line text-zinc-300 text-sm leading-relaxed">{player.currentSong.lyrics}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-zinc-600 flex flex-col items-center">
                    <Disc size={72} className="mb-5 opacity-15" />
                    <h2 className="text-2xl font-bold text-zinc-500">Cisza w eterze.</h2>
                    <p className="text-sm text-zinc-700 mt-2">
                      {library.length === 0 ? 'Dodaj folder muzyczny w Ustawienia' : 'Wybierz utwór z biblioteki'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── LISTY TRACK ── */}
          {isListView && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">
                    {activeView==='library'   && 'Biblioteka'}
                    {activeView==='favorites' && <span className="flex items-center gap-2 text-red-400"><Heart size={22} className="fill-red-400"/>Ulubione</span>}
                    {activeView==='mix-80'    && 'Lata 80.'}
                    {activeView==='mix-90'    && 'Lata 90.'}
                    {activeView==='mix-00'    && 'Lata 2000+'}
                    {activeView==='smart'     && 'Smart mixy'}
                  </h2>
                  <p className="text-xs text-zinc-600 mt-0.5">{pluralTracks(displayList.length)}</p>
                </div>
                {displayList.length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={() => player.playFromList(displayList[0], displayList)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold accent-gradient hover:opacity-90 shadow-md transition-all">
                      <Play size={14} className="ml-0.5" /> Odtwórz
                    </button>
                    <button onClick={() => { player.setIsShuffle(true); player.playFromList(displayList[Math.floor(Math.random()*displayList.length)], displayList); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold transition-colors">
                      <Shuffle size={14} /> Losowo
                    </button>
                  </div>
                )}
              </div>

              {/* Smart panel */}
              {activeView === 'smart' && (
                <div className="flex gap-5 mb-5 flex-col lg:flex-row">
                  <div className="w-full lg:w-60 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
                    <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-3"><Sparkles size={12} className="accent-text"/>Zdefiniowane</h3>
                    <div className="space-y-1.5">
                      {smartPlaylists.map(pl => {
                        const cnt = filterBySmartRules(searchFiltered, pl.rules).length;
                        const on  = pl.id === activeSmartId;
                        return (
                          <button key={pl.id} onClick={() => setActiveSmartId(pl.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${on ? 'accent-bg accent-border text-white' : 'bg-zinc-950/50 border-zinc-800/60 text-zinc-400 hover:border-zinc-700'}`}>
                            <div className="flex justify-between">
                              <span className="font-semibold truncate">{pl.name}</span>
                              <span className="text-zinc-600 ml-2 flex-shrink-0">{cnt}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <form onSubmit={handleCreateSmart} className="flex-1 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
                    <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-3"><Mic2 size={12} className="accent-text"/>Nowa smart playlista</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[['Nazwa',newSmartName,setNewSmartName,'text','Nocny chill…'],['Gatunki',newSmartGenre,setNewSmartGenre,'text','techno, ambient…'],['Rok od',newSmartYearFrom,setNewSmartYearFrom,'number','1990'],['Rok do',newSmartYearTo,setNewSmartYearTo,'number','2010']].map(([lbl,val,set,type,ph]) => (
                        <div key={lbl}>
                          <label className="text-[10px] text-zinc-600 uppercase tracking-wide">{lbl}</label>
                          <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                            className="w-full mt-1 bg-black/40 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-white placeholder-zinc-700" />
                        </div>
                      ))}
                      <div className="flex items-center gap-2 col-span-full">
                        <input id="sf" type="checkbox" checked={newSmartFavOnly} onChange={e=>setNewSmartFavOnly(e.target.checked)} className="w-3.5 h-3.5" />
                        <label htmlFor="sf" className="text-xs text-zinc-500">Tylko ulubione</label>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button type="submit" className="px-4 py-1.5 text-xs rounded-full accent-gradient font-semibold">Zapisz</button>
                    </div>
                  </form>
                </div>
              )}

              <TrackList
                songs={displayList}
                currentSong={player.currentSong}
                isPlaying={player.isPlaying}
                compact={settings.compactMode}
                onPlay={song => player.playFromList(song, displayList)}
                onFavorite={toggleFavorite}
                onContextMenu={openCtx}
                emptyMessage={library.length===0 ? 'Biblioteka pusta. Dodaj folder w Ustawienia.' : 'Brak wyników.'}
              />
            </div>
          )}

          {/* ── ALBUMY ── */}
          {activeView === 'albums' && (
            selectedAlbum ? (
              <AlbumDetailView
                album={selectedAlbum}
                songs={groupedAlbums[selectedAlbum] || []}
                currentSong={player.currentSong}
                isPlaying={player.isPlaying}
                compact={settings.compactMode}
                onPlay={(s, list) => player.playFromList(s, list)}
                onBack={() => setSelectedAlbum(null)}
                onFavorite={toggleFavorite}
                onContextMenu={openCtx}
              />
            ) : (
            <div className="p-6">
              <h2 className="text-3xl font-black uppercase tracking-tight mb-1">Albumy</h2>
              <p className="text-xs text-zinc-600 mb-5">{Object.keys(groupedAlbums).length} albumów</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
                {Object.entries(groupedAlbums).map(([name, songs]) => (
                  <div key={name} className="group cursor-pointer" onClick={() => setSelectedAlbum(name)}>
                    <div className="aspect-square bg-zinc-800 rounded-xl overflow-hidden mb-2 shadow-lg relative">
                      <img src={getCoverSrc(songs[0].cover)||COVER_PLACEHOLDER(200)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" alt="" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                        <Play size={28} fill="white" className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm truncate">{name}</h3>
                    <p className="text-xs text-zinc-500 truncate">{songs[0].artist}</p>
                    <p className="text-[10px] text-zinc-700">{pluralTracks(songs.length)}</p>
                  </div>
                ))}
              </div>
            </div>
            )
          )}

          {/* ── ARTYŚCI ── */}
          {activeView === 'artists' && (
            selectedArtist ? (
              <ArtistDetailView
                artist={selectedArtist}
                songs={groupedArtists[selectedArtist] || []}
                currentSong={player.currentSong}
                isPlaying={player.isPlaying}
                compact={settings.compactMode}
                onPlay={(s, list) => player.playFromList(s, list)}
                onBack={() => setSelectedArtist(null)}
                onFavorite={toggleFavorite}
                onContextMenu={openCtx}
              />
            ) : (
            <div className="p-6">
              <h2 className="text-3xl font-black uppercase tracking-tight mb-1">Artyści</h2>
              <p className="text-xs text-zinc-600 mb-5">{Object.keys(groupedArtists).length} artystów</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Object.entries(groupedArtists).map(([name, songs]) => (
                  <div key={name} className="bg-zinc-900/40 border border-zinc-800/50 p-3 rounded-xl flex items-center gap-3 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer group"
                    onClick={() => setSelectedArtist(name)}>
                    <img src={getCoverSrc(songs[0].cover)||COVER_PLACEHOLDER(48)} className="w-12 h-12 rounded-full object-cover flex-shrink-0" loading="lazy" alt="" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate text-sm group-hover:accent-text transition-colors">{name}</h3>
                      <p className="text-xs text-zinc-600">{pluralTracks(songs.length)}</p>
                    </div>
                    <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors text-lg">›</span>
                  </div>
                ))}
              </div>
            </div>
            )
          )}

          {/* ── GATUNKI ── */}
          {activeView === 'genres' && (
            <GenresView library={searchFiltered} currentSong={player.currentSong} isPlaying={player.isPlaying}
              compact={settings.compactMode} onPlay={(s, list) => player.playFromList(s, list)}
              onFavorite={toggleFavorite} onContextMenu={openCtx} />
          )}

          {/* ── PLAYLISTY ── */}
          {activeView === 'playlists' && (
            <PlaylistsView
              library={library} playlists={playlists}
              onCreatePlaylist={createPlaylist} onDeletePlaylist={deletePlaylist} onRenamePlaylist={renamePlaylist}
              currentSong={player.currentSong}
              onPlay={(s, list) => player.playFromList(s, list)}
              onContextMenu={openCtx}
            />
          )}

          {/* ── USTAWIENIA ── */}
          {activeView === 'settings' && (
            <SettingsView
              musicPaths={musicPaths} library={library} scanInfo={scanInfo}
              onAddFolder={handleBrowseFolder} onRemovePath={handleRemovePath} onRescan={handleRescan}
              settings={settings} onSettingChange={handleSettingChange}
              setEqGain={player.setEqGain} eqFiltersRef={player.eqFiltersRef} EQ_FREQS={player.EQ_FREQS}
            />
          )}

          {/* ── BRAKUJĄCE PLIKI ── */}
          {activeView === 'missing' && (
            <MissingFilesView onLibraryChange={() => fetch(`${API_URL}/library`).then(r=>r.json()).then(setLibrary)} />
          )}

          {/* ── DUPLIKATY ── */}
          {activeView === 'duplicates' && (
            <DuplicatesView onLibraryChange={() => fetch(`${API_URL}/library`).then(r=>r.json()).then(setLibrary)} />
          )}

          {/* ── TEKST UTWORU ── */}
          {activeView === 'lyrics' && (
            <LyricsView
              currentSong={player.currentSong}
              audioRef={player.audioRef}
            />
          )}

          {/* ── STATYSTYKI ── */}
          {activeView === 'stats' && (
            <StatsView
              currentSong={player.currentSong}
              onPlay={(s, list) => player.playFromList(s, list)}
              onContextMenu={openCtx}
            />
          )}
        </div>

        {/* Context menu */}
        {ctxMenu.visible && ctxMenu.song && (
          <ContextMenu x={ctxMenu.x} y={ctxMenu.y} song={ctxMenu.song} playlists={playlists}
            onAction={action => handleCtxAction(action, ctxMenu.song)} />
        )}

        {/* Edytor tagów */}
        {tagEditorSong && (
          <TagEditorModal
            song={tagEditorSong}
            onClose={() => setTagEditorSong(null)}
            onSaved={(updated) => {
              setLibrary(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
              if (player.currentSong?.id === updated.id) {
                player.setCurrentSong({ ...player.currentSong, ...updated });
              }
            }}
          />
        )}

        {/* Import/Eksport playlist */}
        {showImportExport && (
          <ImportExportModal
            playlists={playlists}
            onClose={() => setShowImportExport(false)}
            onImported={async ({ name, songIds }) => {
              await fetch(`${API_URL}/playlists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: `pl-${Date.now()}`, name, songIds }) });
              fetchPlaylists();
              showToast(`Zaimportowano: ${name} (${songIds.length} utworów)`, 'success');
            }}
          />
        )}

        {/* Kolejka */}
        {isQueueOpen && (
          <QueuePanel queue={player.queue} queueIndex={player.queueIndex} currentSong={player.currentSong}
            onSelect={(song, idx) => { player.setQueueIndex(idx); player.setCurrentSong(song); player.setIsPlaying(true); }}
            onClose={() => setIsQueueOpen(false)}
            onRemove={player.removeFromQueue}
            onReorder={player.reorderQueue} />
        )}

        {/* Mini Player */}
        {isMiniPlayer && (
          <MiniPlayer
            currentSong={player.currentSong}
            isPlaying={player.isPlaying}
            progress={player.progress}
            volume={player.volume}
            isMuted={player.isMuted}
            repeatMode={player.repeatMode}
            isShuffle={player.isShuffle}
            handlePlayPause={player.handlePlayPause}
            handleNext={player.handleNext}
            handlePrev={player.handlePrev}
            seekTo={player.seekTo}
            setVolume={player.setVolume}
            setIsMuted={player.setIsMuted}
            setIsShuffle={player.setIsShuffle}
            cycleRepeat={player.cycleRepeat}
            onToggleFavorite={toggleFavorite}
            displayList={displayList}
            onClose={() => setIsMiniPlayer(false)}
            onExpand={() => setIsMiniPlayer(false)}
          />
        )}

        {/* Toast notifications */}
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[200] pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl border animate-in slide-in-from-bottom-2 fade-in duration-200 ${
              t.type === 'error'   ? 'bg-red-950/95 border-red-800 text-red-200' :
              t.type === 'warn'    ? 'bg-yellow-950/95 border-yellow-800 text-yellow-200' :
              t.type === 'success' ? 'bg-green-950/95 border-green-800 text-green-200' :
              t.type === 'info'    ? 'bg-blue-950/95 border-blue-800 text-blue-200' :
                                     'bg-zinc-900/95 border-zinc-700 text-zinc-200'
            }`}>
              {t.msg}
            </div>
          ))}
        </div>

        <PlayerBar
          currentSong={player.currentSong} isPlaying={player.isPlaying}
          progress={player.progress} volume={player.volume} isMuted={player.isMuted}
          repeatMode={player.repeatMode} isShuffle={player.isShuffle} queue={player.queue}
          setIsMuted={player.setIsMuted} setVolume={player.setVolume}
          setIsShuffle={player.setIsShuffle} cycleRepeat={player.cycleRepeat}
          handlePlayPause={player.handlePlayPause} handleNext={player.handleNext}
          handlePrev={player.handlePrev} seekTo={player.seekTo}
          handleVolumeScroll={player.handleVolumeScroll}
          onToggleFavorite={toggleFavorite}
          onShowQueue={() => setIsQueueOpen(p => !p)} isQueueOpen={isQueueOpen}
          onGoHome={() => setActiveView('home')} displayList={displayList}
          settings={settings} onMiniPlayer={() => setIsMiniPlayer(true)}
        />
      </main>

      {/* Drag & Drop overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-[500] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-2 rounded-2xl border-2 border-dashed border-accent/60 bg-black/60 backdrop-blur-sm" />
          <div className="relative flex flex-col items-center gap-3 text-white">
            <div className="p-4 rounded-2xl bg-accent/20 border border-accent/40">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="text-lg font-semibold">Upuść folder z muzyką</p>
            <p className="text-sm text-zinc-400">Zostanie dodany do biblioteki i przeskanowany</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hex string z CSS var → rgb numbers ────────────────────────
function hexToRgb(hex) {
  if (!hex) return '217,70,239';
  const h = hex.replace('#', '');
  if (h.length !== 6) return '217,70,239';
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  return `${r},${g},${b}`;
}

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Search, Heart, Disc, Music2, Mic2, Sparkles, Shuffle, Tag, ListPlus, Moon, X, Radio as RadioIcon } from 'lucide-react';

import Sidebar          from './Sidebar';
import PlayerBar        from './PlayerBar';
import TrackList        from './views/TrackList';
import SettingsView     from './views/SettingsView';
import GenresView       from './views/GenresView';
import PlaylistsView    from './views/PlaylistsView';
import RadioView        from './views/RadioView';
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
import NowPlayingView   from './views/NowPlayingView';
import SleepTimerModal  from './SleepTimerModal';
import BulkTagEditorModal from './BulkTagEditorModal';
import EqualizerPanel   from './EqualizerPanel';
import { usePlayer, REPEAT_MODES } from '../hooks/usePlayer';
import { useRadioPlayer } from '../hooks/useRadioPlayer';
import { useLastFm } from '../hooks/useLastFm';
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

export default function MusicPlayer() {
  const { t, i18n } = useTranslation(['common', 'library', 'player', 'radio']);

  // Funkcja do aktualizacji tłumaczeń menu traya
  const updateTrayTranslations = useCallback(() => {
    const translations = {
      play: t('play', { ns: 'common' }),
      pause: t('pause', { ns: 'common' }),
      previous: t('previous', { ns: 'common' }),
      next: t('next', { ns: 'common' }),
      showHide: t('showHide', { ns: 'common' }),
      quit: t('quit', { ns: 'common' })
    };
    ipcRenderer.send('set-tray-translations', translations);
  }, [t]);

  const DEFAULT_SMART = [
    { id:'fav-dopamine',   name:t('smartPlaylists.favDopamine', { ns: 'library' }), description:t('smartPlaylists.favDopamineDesc', { ns: 'library' }),                    rules:{ favoritesOnly:true } },
    { id:'decades-90-00',  name:t('smartPlaylists.decades9000', { ns: 'library' }), description:t('smartPlaylists.decades9000Desc', { ns: 'library' }),             rules:{ yearFrom:1990, yearTo:2010 } },
    { id:'modern-bangers', name:t('smartPlaylists.modernBangers', { ns: 'library' }), description:t('smartPlaylists.modernBangersDesc', { ns: 'library' }),    rules:{ yearFrom:2000 } },
    { id:'chill-mode',     name:t('smartPlaylists.chillMode', { ns: 'library' }), description:t('smartPlaylists.chillModeDesc', { ns: 'library' }),  rules:{ genreIncludes:['ambient','chill','lofi','downtempo'] } },
  ];

  const DEFAULT_SETTINGS = {
    autoPlayLast:false, gaplessPlayback:false, crossfade:false,
    defaultShuffle:false, rememberVolume:true, rememberQueue:false,
    minimizeToTray:true, startMinimized:false, showTrayControls:true,
    mprisEnabled:true,
    animationsEnabled:true, showVisualizer:true, visualizerMode:'nebula', showVisualizerBackdrop:true, compactMode:false, showAlbumColors:true,
    fadeInOnPlay:false, replayGainEnabled:true,
    showBtnEqualizer:true,
    theme:'fuchsia',
  };

  function normalizeSettings(settings) {
    const next = { ...settings };
    delete next.continueOnStart;
    delete next.hardwareAccel;
    return next;
  }

  function loadQueueSnapshot(library) {
    const queueRaw = localStorage.getItem('neonpulse_queue');
    const idxRaw   = localStorage.getItem('neonpulse_queue_idx');
    const lastId   = JSON.parse(localStorage.getItem('neonpulse_last_song') || 'null');
    const lastPos  = JSON.parse(localStorage.getItem('neonpulse_last_pos') || '0');
    const wasPlaying = JSON.parse(localStorage.getItem('neonpulse_was_playing') || 'false');

    let savedIds = [];
    let savedIdx = 0;

    if (queueRaw) {
      const parsed = JSON.parse(queueRaw);
      if (Array.isArray(parsed)) {
        savedIds = parsed;
        savedIdx = idxRaw !== null ? JSON.parse(idxRaw) : 0;
      } else if (parsed && Array.isArray(parsed.queue)) {
        savedIds = parsed.queue.map(song => typeof song === 'object' ? song.id : song).filter(Boolean);
        savedIdx = Number.isInteger(parsed.queueIndex) ? parsed.queueIndex : 0;
      }
    }

    if (savedIds.length === 0 && lastId) {
      savedIds = [lastId];
      savedIdx = 0;
    }

    const songs = savedIds.map(id => library.find(s => s.id === id)).filter(Boolean);
    if (songs.length === 0) return { songs: [], idx: -1, song: null, lastPos, wasPlaying };

    const idx = Math.max(0, Math.min(Number(savedIdx) || 0, songs.length - 1));
    return { songs, idx, song: songs[idx], lastPos, wasPlaying };
  }

  // ─────────────────────────────────────────────────────────────

  // UI
  const [activeView,      setActiveViewRaw] = useState('home');
  const [isTransitioning, setTransitioning] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [isSidebarOpen,   setSidebarOpen]   = useState(true);
  const [isNowPlaying,    setIsNowPlaying]  = useState(false);
  const [isQueueOpen,     setIsQueueOpen]   = useState(false);
  const [showSleepTimer,  setShowSleepTimer] = useState(false);
  const [showEqualizer,   setShowEqualizer]  = useState(false);
  const [closingOverlay,  setClosingOverlay] = useState(null);
  const [sleepSeconds,    setSleepSeconds]   = useState(0);
  const [bulkEditSongs,   setBulkEditSongs]  = useState(null); // null = zamknięty
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

  // Stacje radiowe (manifest + własne)
  const [radioStations,       setRadioStations]       = useState([]);
  const [radioHiddenStations, setRadioHiddenStations]  = useState([]);
  const radio = useRadioPlayer();

  // Smart
  const [smartPlaylists, setSmartPlaylists] = useState(DEFAULT_SMART);
  const [activeSmartId,  setActiveSmartId]  = useState(null);
  const [newSmartName, setNewSmartName]     = useState('');
  const [newSmartYearFrom, setNewSmartYearFrom] = useState('');
  const [newSmartYearTo,   setNewSmartYearTo]   = useState('');
  const [newSmartFavOnly,  setNewSmartFavOnly]  = useState(false);
  const [newSmartGenre,    setNewSmartGenre]    = useState('');
  const [newSmartArtist,   setNewSmartArtist]   = useState('');
  const [newSmartLimit,    setNewSmartLimit]    = useState('');
  const [newSmartSortBy,   setNewSmartSortBy]   = useState('');
  const [newSmartSortDir,  setNewSmartSortDir]  = useState('asc');

  // Settings
  const [settings, setSettings] = useState(() => {
    try { return normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('neonpulse_settings')||'{}') }); }
    catch { return DEFAULT_SETTINGS; }
  });

  // Player hook
  const player = usePlayer(settings, (name) => setToasts(prev => { const id = Date.now(); setTimeout(() => setToasts(p => p.filter(item => item.id !== id)), 4000); return [...prev, { id, msg: t('cannotPlayTrack', { ns: 'player', name }), type: 'error' }]; }));

  // ─── Wzajemne wykluczanie: radio i biblioteka lokalna nie grają jednocześnie ──
  useEffect(() => {
    if (player.isPlaying && player.currentSong && radio.currentStation && radio.isPlaying) {
      radio.stop({ silentTakeover: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isPlaying, player.currentSong]);

  // radio.play/toggle opakowane tak, by zawsze wyciszały odtwarzacz plików
  // lokalnych przed startem stacji - inaczej oba grałyby jednocześnie.
  // Celowo BEZ useMemo: to tylko dwie funkcje-wrappery, koszt tworzenia ich
  // na nowo przy każdym renderze jest znikomy, a useMemo tutaj wcześniej
  // ryzykował przekazanie nieaktualnego obiektu radio dalej w drzewo (stare
  // domknięcie), gdy zależności [radio, player] nie złapały zmiany na czas.
  const radioControls = {
    ...radio,
    play: (station) => { player.setIsPlaying(false); radio.play(station); },
    toggle: (station) => { player.setIsPlaying(false); radio.toggle(station); },
  };

  // Czy aktualnie gra stacja radiowa (a nie plik lokalny) - używane m.in.
  // do przełączania panelu equalizera i paska odtwarzacza w tryb radiowy.
  const radioActiveNow = !!(radio.currentStation && radio.isPlaying);

  // ─── Last.fm scrobbling ─────────────────────────────────────
  const lastfm = useLastFm(player.currentSong, player.isPlaying, player.progress);

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

  // ─── Aktualizuj tłumaczenia menu traya przy zmianie języka ────
  useEffect(() => {
    updateTrayTranslations();
  }, [i18n.language, t, updateTrayTranslations]);

  // ─── Inicjalizuj tłumaczenia traya przy starcie ──────────────
  useEffect(() => {
    updateTrayTranslations();
  }, [updateTrayTranslations]);

  // ─── Sleep Timer ─────────────────────────────────────────────
  useEffect(() => {
    if (!sleepSeconds || sleepSeconds <= 0) return;
    const interval = setInterval(() => {
      setSleepSeconds(prev => {
        if (prev <= 1) {
          player.setIsPlaying(false);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepSeconds > 0]);

  // ─── Wyślij ustawienia systemowe do electron przy starcie ───
  useEffect(() => {
    ipcRenderer.send('app:settings', {
      minimizeToTray:   settings.minimizeToTray,
      startMinimized:   settings.startMinimized,
      showTrayControls: settings.showTrayControls,
      mprisEnabled:     settings.mprisEnabled,
      startup:          true,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Przywróć kolejkę / ostatni utwór po starcie ────────────
  const restoredRef = React.useRef(false);
  useEffect(() => {
    // Uruchamia się raz gdy biblioteka się załaduje
    if (library.length === 0) return;
    if (restoredRef.current) return;
    restoredRef.current = true;

    // Radio ma pierwszeństwo nad utworem: jeśli ostatnio (przed zamknięciem)
    // grała stacja radiowa, wznów ją zamiast utworu z kolejki - w przeciwnym
    // razie zostaje w library/favorites view bez sensu wskrzeszać starą kolejkę.
    if (settings.autoPlayLast) {
      try {
        const lastRadio = JSON.parse(localStorage.getItem('neonpulse_last_radio') || 'null');
        if (lastRadio?.url) {
          setActiveViewRaw('radio');
          setTimeout(() => radioControls.play(lastRadio), 400);
          return;
        }
      } catch {}
    }

    try {
      const { songs, idx, song, lastPos, wasPlaying } = loadQueueSnapshot(library);
      const shouldPlay = settings.autoPlayLast && song;

      if (song && (settings.autoPlayLast || settings.rememberQueue)) {
        player.setQueue(songs);
        player.setQueueIndex(idx);
        player.setCurrentSong(song);

        if (lastPos > 0 && player.audioRef?.current) {
          setTimeout(() => {
            if (player.audioRef.current) player.audioRef.current.currentTime = lastPos;
          }, 300);
        }
      }

      if (!shouldPlay) {
        setActiveViewRaw(library.some(s => s.isFavorite) ? 'favorites' : 'library');
        return;
      }

      setActiveViewRaw('home');
      setTimeout(() => player.setIsPlaying(true), 400);
    } catch (e) {
      console.warn('[restore]', e);
      setActiveViewRaw(library.some(s => s.isFavorite) ? 'favorites' : 'library');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  // ─── Zapisz stan odtwarzania przy zamknięciu ────────────────
  useEffect(() => {
    const save = () => {
      try {
        // Radio ma pierwszeństwo: jeśli grało w momencie zamknięcia, to ono
        // powinno wznowić się przy starcie, a nie ostatni utwór z kolejki.
        if (radio.currentStation && radio.isPlaying) {
          localStorage.setItem('neonpulse_was_playing', JSON.stringify(false));
          localStorage.setItem('neonpulse_last_radio', JSON.stringify(radio.currentStation));
        } else {
          localStorage.setItem('neonpulse_was_playing', JSON.stringify(player.isPlaying));
          localStorage.removeItem('neonpulse_last_radio');
        }
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
  }, [player.isPlaying, player.queue, player.queueIndex, player.progress, radio.currentStation, radio.isPlaying]);

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
          showToast(t('serverConnectionError', { ns: 'common' }), 'error');
        }
      }
    }
  }, [t]);

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

  // ─── Stacje radiowe (manifest + własne) ─────────────────────
  const fetchStations = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API_URL}/stations`),
        fetch(`${API_URL}/stations/hidden`),
      ]);
      if (r1.ok) setRadioStations((await r1.json()).stations || []);
      if (r2.ok) setRadioHiddenStations((await r2.json()).stations || []);
    } catch (e) { console.error('[stations]', e); }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

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
  // Źródło danych: dla plików lokalnych prawdziwy AnalyserNode z usePlayer.
  // Dla radia celowo NIE podpinamy Web Audio API pod strumień (patrz
  // useRadioPlayer.js - ryzyko wyciszenia audio, potwierdzone w praktyce).
  // Wizualizator dla radia dostaje syntetyczny, oscylujący "puls" zamiast
  // realnego widma - bezpieczne rozwiązanie kosztem wizualnej wierności.
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    const visualizerAsBackdrop = activeView !== 'home' && settings.showAlbumColors && settings.showVisualizerBackdrop;
    const activeAnalyser = radio.isPlaying ? makeFakeAnalyser() : player.analyserRef.current;
    if ((activeView !== 'home' && !visualizerAsBackdrop) || !settings.showVisualizer ||
        !canvasRef.current || !activeAnalyser) return;

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const analyser = activeAnalyser;
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
    const PARTICLE_COUNT = 28;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * 1, y: Math.random() * 1,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.0004 + 0.0001,
      angle: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    // ── Gwiazdki (rating) ──────────────────────────────────────
    // Im wyższy rating tym więcej gwiazdek i silniejszy efekt
    const rating = player.currentSong?.rating || 0;
    const STAR_COUNT = rating * 8; // ograniczone dla płynności
    const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
      x:        Math.random(),
      y:        Math.random(),
      baseSize: Math.random() * 1.8 + 0.4,
      twinkleSpeed: Math.random() * 0.03 + 0.01,
      twinkleOffset: Math.random() * Math.PI * 2,
      orbitR:   Math.random() * 0.008 + 0.002,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: (Math.random() * 0.002 + 0.0005) * (Math.random() > 0.5 ? 1 : -1),
      // Gwiazdki przy wyższym ratingu są jaśniejsze i większe
      brightness: 0.3 + (rating / 5) * 0.5 + Math.random() * 0.2,
      // Kształt 4-5-6 ramion zależnie od numeru
      spikes: i % 3 === 0 ? 6 : i % 3 === 1 ? 5 : 4,
    }));

    // Funkcja rysowania gwiazdy wieloramiennej
    function drawStar(ctx, x, y, spikes, outerR, innerR, alpha, color) {
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(x, y - outerR);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(
          x + Math.cos(rot) * outerR,
          y + Math.sin(rot) * outerR
        );
        rot += step;
        ctx.lineTo(
          x + Math.cos(rot) * innerR,
          y + Math.sin(rot) * innerR
        );
        rot += step;
      }
      ctx.lineTo(x, y - outerR);
      ctx.closePath();
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.fill();
      // Delikatny blask wokół gwiazdy
      const glow = ctx.createRadialGradient(x, y, 0, x, y, outerR * 3);
      glow.addColorStop(0, `rgba(${color},${alpha * 0.4})`);
      glow.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, outerR * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    let t = 0;
    let lastFrame = 0;

    const render = (ts) => {
      animFrameRef.current = requestAnimationFrame(render);
      if (ts - lastFrame < 33) return; // ~30fps, mniej obciąża Teraz gramy
      lastFrame = ts;
      t += 0.012;

      analyser.getByteFrequencyData(freqBuf);
      analyser.getByteTimeDomainData(timeBuf);

      // Bass / mid / treble energy
      const bass   = freqBuf.slice(0, 8).reduce((a,b)=>a+b,0)  / (8*255);
      const mid    = freqBuf.slice(8, 48).reduce((a,b)=>a+b,0) / (40*255);
      const treble = freqBuf.slice(48).reduce((a,b)=>a+b,0)    / (freqBuf.length*255);
      const energy = (bass * 0.6 + mid * 0.3 + treble * 0.1);
      const playing = player.isPlaying || radio.isPlaying;

      // Wyczyść
      ctx.clearRect(0, 0, w, h);
      const visualizerMode = settings.visualizerMode || 'nebula';

      if (visualizerMode === 'bars') {
        const bars = 42;
        const barW = w / bars;
        const baseY = h * 0.58;
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, `rgba(${accentRgb},${0.08 + bass * 0.16})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < bars; i++) {
          const fi = Math.floor((i / bars) * freqBuf.length * 0.85);
          const v = playing ? freqBuf[fi] / 255 : 0.08 + Math.sin(t + i * 0.2) * 0.03;
          const bh = Math.max(3, v * h * 0.48);
          const mix = i / bars;
          const color = mix < 0.5 ? accentRgb : accentRgb2;
          ctx.fillStyle = `rgba(${color},${0.28 + v * 0.62})`;
          const x = i * barW + barW * 0.16;
          const y = baseY - bh / 2;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, barW * 0.68, bh, 5);
          else ctx.rect(x, y, barW * 0.68, bh);
          ctx.fill();
        }
        return;
      }

      if (visualizerMode === 'tunnel') {
        const cx = w * 0.5, cy = h * 0.5;
        const rings = 18;
        ctx.fillStyle = `rgba(${accentRgb2},${0.06 + treble * 0.08})`;
        ctx.fillRect(0, 0, w, h);
        for (let i = rings; i >= 1; i--) {
          const ratio = i / rings;
          const twist = t * (0.6 + treble * 2) + i * 0.45;
          const r = Math.min(w, h) * ratio * (0.43 + bass * 0.11);
          const sides = 5 + (i % 3);
          ctx.beginPath();
          for (let p = 0; p <= sides; p++) {
            const a = (p / sides) * Math.PI * 2 + twist;
            const wobble = 1 + Math.sin(a * 3 + t + mid * 4) * 0.08;
            const x = cx + Math.cos(a) * r * wobble;
            const y = cy + Math.sin(a) * r * wobble;
            if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(${i % 2 ? accentRgb : accentRgb2},${0.12 + ratio * 0.35})`;
          ctx.lineWidth = 1 + ratio * 3;
          ctx.stroke();
        }
        return;
      }

      if (visualizerMode === 'aurora') {
        const bg = ctx.createRadialGradient(w * 0.2, h * 0.25, 0, w * 0.5, h * 0.5, Math.max(w, h));
        bg.addColorStop(0, `rgba(${accentRgb},${0.11 + bass * 0.12})`);
        bg.addColorStop(0.55, `rgba(${accentRgb2},${0.07 + mid * 0.1})`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        for (let band = 0; band < 5; band++) {
          ctx.beginPath();
          const yBase = h * (0.2 + band * 0.13);
          ctx.moveTo(0, yBase);
          for (let x = 0; x <= w; x += 12) {
            const fi = Math.floor((x / w) * freqBuf.length);
            const tone = playing ? freqBuf[fi] / 255 : 0.12;
            const y = yBase + Math.sin(x * 0.011 + t * (1.5 + band * 0.25) + band) * h * 0.055 + tone * h * 0.16;
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(${band % 2 ? accentRgb : accentRgb2},${0.18 + energy * 0.28})`;
          ctx.lineWidth = 2 + band * 0.7;
          ctx.shadowColor = `rgba(${band % 2 ? accentRgb : accentRgb2},0.45)`;
          ctx.shadowBlur = 18;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        return;
      }

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
      const BARS = 72;
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


      // ── 4b. Gwiazdki w rytm muzyki (rating) ───────────────────
      if (stars.length > 0) {
        for (const s of stars) {
          // Mruganie w rytm muzyki
          s.twinkleOffset += s.twinkleSpeed * (1 + (playing ? treble * 4 : 0));
          const twinkle = 0.5 + 0.5 * Math.sin(s.twinkleOffset);
          // Pulsacja na bass
          const bassPulse = playing ? bass * 0.6 : 0;
          const pulseTwinkle = twinkle + bassPulse * 0.4;

          // Orbitowanie
          s.orbitAngle += s.orbitSpeed * (1 + (playing ? energy * 2 : 0));
          const ox = s.x + Math.sin(s.orbitAngle) * s.orbitR;
          const oy = s.y + Math.cos(s.orbitAngle) * s.orbitR;

          const px = ox * w;
          const py = oy * h;

          // Rozmiar pulsuje z basem
          const outerR = s.baseSize * (1.5 + pulseTwinkle * 0.8 + (playing ? bass * 2.5 : 0));
          const innerR = outerR * 0.4;

          // Alpha – delikatne, zależne od brightness i rytmu
          const alpha = s.brightness * pulseTwinkle * (0.4 + (playing ? energy * 0.5 : 0.1));

          // Kolor: mix accent + biały (im wyższy rating tym bielsze)
          const whiteMix = (rating - 1) / 4; // 0 przy 1★, 1 przy 5★
          const sr = Math.round(parseInt(accentRgb.split(',')[0]) * (1 - whiteMix * 0.6) + 255 * whiteMix * 0.6);
          const sg = Math.round(parseInt(accentRgb.split(',')[1]) * (1 - whiteMix * 0.5) + 255 * whiteMix * 0.5);
          const sb = Math.round(parseInt(accentRgb.split(',')[2]) * (1 - whiteMix * 0.3) + 255 * whiteMix * 0.3);
          const starColor = `${sr},${sg},${sb}`;

          drawStar(ctx, px, py, s.spikes, outerR, innerR, alpha, starColor);
        }
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
  }, [activeView, player.isPlaying, radio.isPlaying, settings.showVisualizer, settings.showAlbumColors, settings.showVisualizerBackdrop, settings.visualizerMode, settings.theme, player.currentSong?.id, player.currentSong?.rating]);

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

  // currentSong z aktualnym ratingiem z library (bez modyfikacji player.currentSong)
  const enrichedCurrentSong = useMemo(() => {
    if (!player.currentSong) return null;
    const fromLib = library.find(s => s.id === player.currentSong.id);
    if (!fromLib) return player.currentSong;
    return { ...player.currentSong, rating: fromLib.rating, isFavorite: fromLib.isFavorite };
  }, [player.currentSong, library]);

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
        showToast(t('foldersAddedToLibrary', { ns: 'common', count: unique.length }), 'success');
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
  }, [showToast, t]);

  const openCtx = (e, song) => { e.preventDefault(); setCtxMenu({ visible:true, x:e.clientX, y:e.clientY, song }); };

  const updateRating = useCallback((id, rating) => {
    fetch(`${API_URL}/rating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rating }),
    }).then(() => {
      setLibrary(prev => prev.map(s => s.id === id ? { ...s, rating } : s));
    });
  }, [API_URL]);

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
          showToast(t('coverFetchSearching', { ns: 'common' }), 'info');
          try {
            const r = await fetch(`${API_URL}/covers/fetch/${song.id}`, { method: 'POST' });
            const data = await r.json();
            if (data.ok && data.cover) {
              setLibrary(prev => prev.map(s => s.id === song.id ? { ...s, cover: data.cover } : s));
              if (player.currentSong?.id === song.id)
                player.setCurrentSong({ ...player.currentSong, cover: data.cover });
              showToast(t('coverUpdated', { ns: 'common' }), 'success');
            } else {
              showToast(data.reason || t('coverNotFound', { ns: 'common' }), 'warn');
            }
          } catch {
            showToast(t('coverFetchConnectionError', { ns: 'common' }), 'error');
          }
        })();
        break;
      case 'open-folder':
        ipcRenderer.invoke('open-path', song.path);
        break;
      case 'copy-path':
        showToast(t('pathCopied', { ns: 'common' }), 'success');
        break;
    }
    if (action.startsWith('rate-')) {
      const rating = Number(action.replace('rate-', ''));
      updateRating(song.id, rating);
      return;
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
      artistIncludes: newSmartArtist.trim() || undefined,
      limit:   newSmartLimit   ? Number(newSmartLimit)  : undefined,
      sortBy:  newSmartSortBy  || undefined,
      sortDir: newSmartSortDir || 'asc',
    };
    const id = `user-${Date.now()}`;
    setSmartPlaylists(prev => [...prev, { id, name:newSmartName.trim(), description:'Twoja smart playlista.', rules }]);
    setActiveSmartId(id);
    setNewSmartName(''); setNewSmartYearFrom(''); setNewSmartYearTo('');
    setNewSmartFavOnly(false); setNewSmartGenre('');
    setNewSmartArtist(''); setNewSmartLimit(''); setNewSmartSortBy(''); setNewSmartSortDir('asc');
    setActiveViewRaw('smart');
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => {
      const next = normalizeSettings({ ...prev, [key]:value });
      try { localStorage.setItem('neonpulse_settings', JSON.stringify(next)); } catch {}
      // Przekaż ustawienia systemowe do electron-main
      ipcRenderer.send('app:settings', {
        minimizeToTray:   next.minimizeToTray,
        startMinimized:   next.startMinimized,
        showTrayControls: next.showTrayControls,
        mprisEnabled:     next.mprisEnabled,
      });
      return next;
    });
  };

  const closeOverlay = useCallback((name, closeFn) => {
    if (!settings.animationsEnabled) {
      closeFn();
      return;
    }
    setClosingOverlay(name);
    setTimeout(() => {
      closeFn();
      setClosingOverlay(null);
    }, 150);
  }, [settings.animationsEnabled]);

  const toggleQueue = useCallback(() => {
    if (isQueueOpen) closeOverlay('queue', () => setIsQueueOpen(false));
    else setIsQueueOpen(true);
  }, [isQueueOpen, closeOverlay]);

  const toggleNowPlaying = useCallback(() => {
    if (isNowPlaying) closeOverlay('nowPlaying', () => setIsNowPlaying(false));
    else setIsNowPlaying(true);
  }, [isNowPlaying, closeOverlay]);

  const toggleEqualizer = useCallback(() => {
    if (showEqualizer) closeOverlay('equalizer', () => setShowEqualizer(false));
    else setShowEqualizer(true);
  }, [showEqualizer, closeOverlay]);

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

        {activeView !== 'home' && settings.showAlbumColors && settings.showVisualizer && settings.showVisualizerBackdrop && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-[0.18]"
            style={{ mixBlendMode: 'screen' }}
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
              placeholder={t('searchPlaceholder', { ns: 'common' })}
              className="w-full bg-zinc-900/70 border border-zinc-800/60 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none transition-all"
              style={{ '--tw-ring-color': 'var(--accent-border)' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
              onBlur={e  => e.target.style.borderColor = ''}
            />
          </div>
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
                {radioActiveNow ? (
                  <div className="flex flex-col items-center gap-6 max-w-5xl w-full">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-10 w-full justify-center">
                      {/* Cover / favicon stacji */}
                      <div className="relative group flex-shrink-0">
                        <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-2xl shadow-2xl border border-white/5 overflow-hidden bg-zinc-900 flex items-center justify-center">
                          {radio.currentStation.favicon ? (
                            <img
                              src={radio.currentStation.favicon}
                              className="w-full h-full object-cover"
                              alt={radio.currentStation.name}
                              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <RadioIcon size={72} className="text-emerald-500/40" style={{ display: radio.currentStation.favicon ? 'none' : 'flex' }} />
                        </div>
                        {/* Live indicator */}
                        <div className="absolute bottom-3 right-3 flex gap-0.5 items-end">
                          {[1,2,3,4].map(i => (
                            <div key={i} className="w-0.5 rounded-full bg-emerald-400 animate-pulse"
                              style={{ height:`${8+i*3}px`, animationDelay:`${i*100}ms` }} />
                          ))}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="text-center md:text-left space-y-2 min-w-0 flex-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> {t('liveNow', { ns: 'radio' })}
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black leading-none tracking-tight">{radio.currentStation.name}</h1>
                        {radio.nowPlaying?.title ? (
                          <h2 className="text-xl md:text-3xl text-zinc-300 font-bold">
                            {radio.nowPlaying.artist ? `${radio.nowPlaying.artist} — ${radio.nowPlaying.title}` : radio.nowPlaying.title}
                          </h2>
                        ) : radio.currentStation.genre ? (
                          <h2 className="text-xl md:text-3xl text-zinc-300 font-bold">{radio.currentStation.genre}</h2>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : player.currentSong ? (
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
                          <Music2 size={11} /> {player.currentSong.genre || t('unknownGenre', { ns: 'common' })}
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
                    <h2 className="text-2xl font-bold text-zinc-500">{t('silenceInEther', { ns: 'common' })}</h2>
                    <p className="text-sm text-zinc-700 mt-2">
                      {library.length === 0 ? t('addMusicFolderInSettings', { ns: 'common' }) : t('chooseTrackFromLibrary', { ns: 'common' })}
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
                    {activeView==='library'   && t('library', { ns: 'common' })}
                    {activeView==='favorites' && <span className="flex items-center gap-2 text-red-400"><Heart size={22} className="fill-red-400"/>{t('favorites', { ns: 'common' })}</span>}
                    {activeView==='mix-80'    && t('80sMix', { ns: 'library' })}
                    {activeView==='mix-90'    && t('90sMix', { ns: 'library' })}
                    {activeView==='mix-00'    && t('2000sMix', { ns: 'library' })}
                    {activeView==='smart'     && t('smartMixes', { ns: 'library' })}
                  </h2>
                  <p className="text-xs text-zinc-600 mt-0.5">{pluralTracks(displayList.length, t)}</p>
                </div>
                {displayList.length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={() => player.playFromList(displayList[0], displayList)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold accent-gradient hover:opacity-90 shadow-md transition-all">
                      <Play size={14} className="ml-0.5" /> {t('play', { ns: 'common' })}
                    </button>
                    <button onClick={() => { player.setIsShuffle(true); player.playFromList(displayList[Math.floor(Math.random()*displayList.length)], displayList); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold transition-colors">
                      <Shuffle size={14} /> {t('shufflePlay', { ns: 'common' })}
                    </button>
                  </div>
                )}
              </div>

              {/* Smart panel */}
              {activeView === 'smart' && (
                <div className="flex gap-5 mb-5 flex-col lg:flex-row">
                  <div className="w-full lg:w-60 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
                    <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-3"><Sparkles size={12} className="accent-text"/>{t('definedSmartPlaylists', { ns: 'library' })}</h3>
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
                    <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-3"><Mic2 size={12} className="accent-text"/>{t('newSmartPlaylist', { ns: 'library' })}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        [t('smartFields.name', { ns: 'library' }),    newSmartName,    setNewSmartName,    'text',   t('smartPlaceholders.name', { ns: 'library' })],
                        [t('smartFields.artist', { ns: 'library' }),  newSmartArtist,  setNewSmartArtist,  'text',   t('smartPlaceholders.artist', { ns: 'library' })],
                        [t('smartFields.genres', { ns: 'library' }),  newSmartGenre,   setNewSmartGenre,   'text',   t('smartPlaceholders.genres', { ns: 'library' })],
                        [t('smartFields.yearFrom', { ns: 'library' }),   newSmartYearFrom,setNewSmartYearFrom,'number', '1990'],
                        [t('smartFields.yearTo', { ns: 'library' }),  newSmartYearTo,  setNewSmartYearTo,  'number', '2010'],
                        [t('smartFields.limit', { ns: 'library' }),    newSmartLimit,   setNewSmartLimit,   'number', t('smartPlaceholders.limit', { ns: 'library' })],
                      ].map(([lbl,val,set,type,ph]) => (
                        <div key={lbl}>
                          <label className="text-[10px] text-zinc-600 uppercase tracking-wide">{lbl}</label>
                          <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                            className="w-full mt-1 bg-black/40 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-white placeholder-zinc-700" />
                        </div>
                      ))}
                      <div className="col-span-full grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-zinc-600 uppercase tracking-wide">{t('smartFields.sortBy', { ns: 'library' })}</label>
                          <select value={newSmartSortBy} onChange={e=>setNewSmartSortBy(e.target.value)}
                            className="w-full mt-1 bg-black/40 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
                            <option value="">{t('default', { ns: 'common' })}</option>
                            <option value="title">{t('title', { ns: 'common' })}</option>
                            <option value="artist">{t('artist', { ns: 'common' })}</option>
                            <option value="album">{t('album', { ns: 'common' })}</option>
                            <option value="year">{t('year', { ns: 'common' })}</option>
                            <option value="duration">{t('duration', { ns: 'common' })}</option>
                            <option value="random">{t('random', { ns: 'common' })}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-600 uppercase tracking-wide">{t('smartFields.sortDirection', { ns: 'library' })}</label>
                          <select value={newSmartSortDir} onChange={e=>setNewSmartSortDir(e.target.value)}
                            className="w-full mt-1 bg-black/40 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
                            <option value="asc">{t('ascending', { ns: 'common' })}</option>
                            <option value="desc">{t('descending', { ns: 'common' })}</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 col-span-full">
                        <input id="sf" type="checkbox" checked={newSmartFavOnly} onChange={e=>setNewSmartFavOnly(e.target.checked)} className="w-3.5 h-3.5" />
                        <label htmlFor="sf" className="text-xs text-zinc-500">{t('smartFields.favoritesOnly', { ns: 'library' })}</label>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button type="submit" className="px-4 py-1.5 text-xs rounded-full accent-gradient font-semibold">{t('save', { ns: 'common' })}</button>
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
                onBulkEdit={setBulkEditSongs}
                autoScrollCurrent={activeView === 'library' && !!player.currentSong}
                animationsEnabled={settings.animationsEnabled}
                emptyMessage={library.length===0 ? t('libraryEmptyAddFolder', { ns: 'library' }) : t('emptyResults', { ns: 'common' })}
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
              <h2 className="text-3xl font-black uppercase tracking-tight mb-1">{t('albums', { ns: 'common' })}</h2>
              <p className="text-xs text-zinc-600 mb-5">{t('albumCount', { ns: 'common', count: Object.keys(groupedAlbums).length })}</p>
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
                    <p className="text-[10px] text-zinc-700">{pluralTracks(songs.length, t)}</p>
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
              <h2 className="text-3xl font-black uppercase tracking-tight mb-1">{t('artists', { ns: 'common' })}</h2>
              <p className="text-xs text-zinc-600 mb-5">{t('artistCount', { ns: 'common', count: Object.keys(groupedArtists).length })}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Object.entries(groupedArtists).map(([name, songs]) => (
                  <div key={name} className="bg-zinc-900/40 border border-zinc-800/50 p-3 rounded-xl flex items-center gap-3 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer group"
                    onClick={() => setSelectedArtist(name)}>
                    <img src={getCoverSrc(songs[0].cover)||COVER_PLACEHOLDER(48)} className="w-12 h-12 rounded-full object-cover flex-shrink-0" loading="lazy" alt="" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate text-sm group-hover:accent-text transition-colors">{name}</h3>
                      <p className="text-xs text-zinc-600">{pluralTracks(songs.length, t)}</p>
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

          {/* ── STACJE RADIOWE ── */}
          {activeView === 'radio' && (
            <RadioView
              stations={radioStations}
              hiddenStations={radioHiddenStations}
              radio={radioControls}
              onRefresh={fetchStations}
            />
          )}

          {/* ── USTAWIENIA ── */}
          {activeView === 'settings' && (
            <SettingsView
              musicPaths={musicPaths} library={library} scanInfo={scanInfo}
              onAddFolder={handleBrowseFolder} onRemovePath={handleRemovePath} onRescan={handleRescan}
              settings={settings} onSettingChange={handleSettingChange}
              lastfm={lastfm}
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
            onAction={action => handleCtxAction(action, ctxMenu.song)}
            onRatingChange={(id, rating) => {
              updateRating(id, rating);
              setCtxMenu(prev => prev.song?.id === id ? { ...prev, song: { ...prev.song, rating } } : prev);
            }}
          />
        )}

        {/* Now Playing – pełnoekranowy widok */}
        {isNowPlaying && (
          <NowPlayingView
            currentSong={enrichedCurrentSong}
            isPlaying={player.isPlaying}
            progress={player.progress}
            volume={player.volume}
            isMuted={player.isMuted}
            repeatMode={player.repeatMode}
            isShuffle={player.isShuffle}
            queue={player.queue}
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
            onClose={() => closeOverlay('nowPlaying', () => setIsNowPlaying(false))}
            onSleepTimer={() => setShowSleepTimer(true)}
            sleepRemaining={sleepSeconds}
            audioRef={player.audioRef}
            animationsEnabled={settings.animationsEnabled}
            isClosing={closingOverlay === 'nowPlaying'}
          />
        )}

        {/* Bulk Tag Editor */}
        {bulkEditSongs && (
          <BulkTagEditorModal
            songs={bulkEditSongs}
            onClose={() => setBulkEditSongs(null)}
            onSaved={updated => {
              setLibrary(prev => {
                const map = Object.fromEntries(updated.map(s => [s.id, s]));
                return prev.map(s => map[s.id] ? { ...s, ...map[s.id] } : s);
              });
              setBulkEditSongs(null);
            }}
          />
        )}

        {/* Sleep Timer */}
        {showSleepTimer && (
          <SleepTimerModal
            currentTimer={sleepSeconds}
            onSet={secs => setSleepSeconds(secs || 0)}
            onClose={() => closeOverlay('sleepTimer', () => setShowSleepTimer(false))}
            animationsEnabled={settings.animationsEnabled}
            isClosing={closingOverlay === 'sleepTimer'}
          />
        )}

        {showEqualizer && (
          <div className={`fixed right-6 bottom-28 z-[210] w-[min(420px,calc(100vw-2rem))] shadow-2xl ${
            settings.animationsEnabled ? (closingOverlay === 'equalizer' ? 'np-pop-exit' : 'np-pop-enter') : ''
          }`}>
            <div className="relative">
              <button
                onClick={() => closeOverlay('equalizer', () => setShowEqualizer(false))}
                className="absolute -right-2 -top-2 z-10 p-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors shadow-lg"
                title={t('close', { ns: 'common' })}
              >
                <X size={14} />
              </button>
              {radioActiveNow ? (
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 text-center">
                  <p className="text-sm text-zinc-400">{t('eqUnavailableForStation', { ns: 'radio' })}</p>
                </div>
              ) : (
                <EqualizerPanel setEqGain={player.setEqGain} eqFiltersRef={player.eqFiltersRef} EQ_FREQS={player.EQ_FREQS} />
              )}
            </div>
          </div>
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
              showToast(t('importedPlaylistToast', { ns: 'common', name, count: songIds.length }), 'success');
            }}
          />
        )}

        {/* Kolejka */}
        {isQueueOpen && (
          <QueuePanel queue={player.queue} queueIndex={player.queueIndex} currentSong={player.currentSong}
            onSelect={(song, idx) => { player.setQueueIndex(idx); player.setCurrentSong(song); player.setIsPlaying(true); }}
            onClose={() => closeOverlay('queue', () => setIsQueueOpen(false))}
            onRemove={player.removeFromQueue}
            onReorder={player.reorderQueue}
            animationsEnabled={settings.animationsEnabled}
            isClosing={closingOverlay === 'queue'} />
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
          currentSong={enrichedCurrentSong} isPlaying={player.isPlaying}
          progress={player.progress} volume={player.volume} isMuted={player.isMuted}
          repeatMode={player.repeatMode} isShuffle={player.isShuffle} queue={player.queue}
          setIsMuted={player.setIsMuted} setVolume={player.setVolume}
          setIsShuffle={player.setIsShuffle} cycleRepeat={player.cycleRepeat}
          handlePlayPause={player.handlePlayPause} handleNext={player.handleNext}
          handlePrev={player.handlePrev} seekTo={player.seekTo}
          handleVolumeScroll={player.handleVolumeScroll}
          onToggleFavorite={toggleFavorite}
          onShowQueue={toggleQueue} isQueueOpen={isQueueOpen}
          onGoHome={() => setActiveView('home')} displayList={displayList}
          onGoAlbum={() => player.currentSong?.album && setActiveView('albums', { album: player.currentSong.album })}
          onGoArtist={() => player.currentSong?.artist && setActiveView('artists', { artist: player.currentSong.artist })}
          settings={settings}
          onNowPlaying={toggleNowPlaying} isNowPlaying={isNowPlaying}
          onSleepTimer={() => setShowSleepTimer(true)} sleepRemaining={sleepSeconds}
          onRatingChange={(id, rating) => updateRating(id, rating)}
          onEqualizer={toggleEqualizer} isEqualizerOpen={showEqualizer}
          radio={radioControls} onGoRadio={() => setActiveView('radio')}
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
            <p className="text-lg font-semibold">{t('dragMusicFolderTitle', { ns: 'common' })}</p>
            <p className="text-sm text-zinc-400">{t('dragMusicFolderSubtitle', { ns: 'common' })}</p>
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

// ─── Syntetyczny "analyser" dla radia ──────────────────────────
// Radio celowo nie przechodzi przez Web Audio API (ryzyko wyciszenia
// strumieni bez CORS - patrz useRadioPlayer.js), więc wizualizator dla
// radia dostaje ten fejkowy generator zamiast prawdziwego widma FM.
// Implementuje tylko to, czego rysująca funkcja realnie używa.
function makeFakeAnalyser() {
  const FFT_SIZE = 256;
  const BIN_COUNT = FFT_SIZE / 2;
  return {
    fftSize: FFT_SIZE,
    frequencyBinCount: BIN_COUNT,
    getByteFrequencyData(buf) {
      const t = performance.now() / 1000;
      for (let i = 0; i < buf.length; i++) {
        // Kilka nałożonych fal o różnych częstotliwościach + lekki szum,
        // niżej pasmo "basowe" mocniejsze niż wysokie - przypomina realne widmo.
        const decay = 1 - i / buf.length;
        const wave = Math.sin(t * 2.2 + i * 0.35) * 0.5 + 0.5;
        const wave2 = Math.sin(t * 3.7 - i * 0.12) * 0.5 + 0.5;
        const noise = Math.random() * 0.15;
        buf[i] = Math.min(255, Math.floor((wave * 0.6 + wave2 * 0.3 + noise) * decay * 210 + 20));
      }
    },
    getByteTimeDomainData(buf) {
      const t = performance.now() / 1000;
      for (let i = 0; i < buf.length; i++) {
        buf[i] = 128 + Math.floor(Math.sin(t * 4 + i * 0.2) * 40);
      }
    },
  };
}

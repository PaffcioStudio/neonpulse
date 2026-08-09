import { useState, useRef, useCallback, useEffect } from 'react';
import { ipcRenderer } from '../ipc';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api'
  : 'http://localhost:3001/api';

const STORAGE_KEY = 'neonpulse_radio_volume';

function loadVolume() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v !== null ? JSON.parse(v) : 80;
  } catch { return 80; }
}

// Odtwarzacz radia internetowego – celowo odseparowany od usePlayer().
// Strumienie live nie mają duration/seek/crossfade/gapless, więc mieszanie
// tej logiki z silnikiem plików lokalnych tylko komplikowałoby oba.
//
// WAŻNE: ten hook celowo NIGDY nie podpina radiowego <audio> pod Web Audio
// API (AudioContext/createMediaElementSource) - ani dla EQ, ani dla
// wizualizacji. Próby zrobienia tego bezpiecznie (m.in. z watchdogiem na
// zdarzeniu 'timeupdate') zawiodły w praktyce: 'timeupdate' leci nawet gdy
// realnie nic nie słychać, więc nie da się niezawodnie wykryć wyciszenia
// spowodowanego brakiem CORS na serwerze streamu. Skoro nie da się tego
// zrobić bezpiecznie, nie robimy tego wcale - działający dźwięk jest
// ważniejszy niż equalizer czy wizualizacja przy radiu.
//
// open.fm (type:"openfm") to specjalny przypadek: URL streamu jest podpisanym,
// wygasającym tokenem (.m3u8/HLS), więc zamiast stałego station.url mamy
// station.slug - świeży URL jest pobierany z backendu tuż przed KAŻDYM
// odtworzeniem, a playback idzie przez hls.js (Electron 28 / Chromium ~120
// nie ma natywnego odtwarzania HLS - to dodano dopiero w Chrome 142+).
export function useRadioPlayer() {
  const [currentStation, setCurrentStation] = useState(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [hasError,  setHasError]    = useState(false);
  const [volume,    setVolume]      = useState(loadVolume());
  const [isMuted,   setIsMuted]     = useState(false);
  const [nowPlaying, setNowPlaying] = useState(null); // { title, artist } z LanBeats /status

  const audioRef = useRef(new Audio());
  const lanbeatsPollRef = useRef(null);
  const hlsRef = useRef(null);
  const playTokenRef = useRef(0); // rośnie przy każdym play()/stop() - chroni przed race condition async tokenu

  // Wyślij aktualny stan radia do procesu głównego (MPRIS + menu traya).
  // Stacja radiowa jako "title", metadane now-playing (jeśli są, np. z
  // LanBeats) jako "artist" - dzięki temu w KDE/GNOME i w tray widać co
  // faktycznie gra, tak samo jak dla plików lokalnych. Stream live nie ma
  // długości, więc duration/position zawsze 0 (standardowy sposób oznaczenia
  // "live" w MPRIS - odtwarzacze pokazują wtedy pasek postępu jako pusty/brak).
  const pushMprisState = useCallback((station, playing, np) => {
    if (!station) {
      ipcRenderer.send('player:update', {
        title: '', artist: '', album: '', cover: '',
        duration: 0, position: 0, isPlaying: false, volume: 1,
      });
      return;
    }
    const title  = np?.title ? np.title : station.name;
    const artist = np?.title ? (np.artist || station.name) : (station.genre || '');
    ipcRenderer.send('player:update', {
      title, artist, album: station.genre || '', cover: station.favicon || '',
      duration: 0, position: 0, isPlaying: playing,
      volume: 1,
    });
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = (isMuted ? 0 : volume) / 100;

    const onPlaying = () => { setIsLoading(false); setHasError(false); };
    const onWaiting = () => setIsLoading(true);
    // UWAGA: gdy gra hls.js (open.fm), NIE reagujemy na natywny 'error' na
    // <audio> - MediaSource/SourceBuffer generuje takie zdarzenia jako
    // normalną część swojej wewnętrznej pracy (przełączanie segmentów,
    // bufor), a hls.js sam się z nich odzyskuje. Reagowanie na nie tutaj
    // fałszywie gasiło isPlaying mimo że dźwięk grał dalej bez przerwy -
    // błędy dla streamów HLS obsługuje wyłącznie Hls.Events.ERROR (patrz
    // playHls poniżej), ten listener jest tylko dla zwykłych <audio src>.
    const onError = () => {
      if (hlsRef.current) return;
      setIsLoading(false); setHasError(true); setIsPlaying(false);
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error',   onError);
    audio.addEventListener('stalled', onWaiting);

    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error',   onError);
      audio.removeEventListener('stalled', onWaiting);
    };
  }, []);

  useEffect(() => {
    audioRef.current.volume = (isMuted ? 0 : volume) / 100;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(volume)); } catch {}
  }, [volume, isMuted]);

  // Gdy LanBeats zmieni utwór (nowPlaying), odśwież MPRIS/tray bez czekania
  // na kolejne play() - inaczej tytuł "utknąłby" na pierwszym utworze sesji.
  useEffect(() => {
    if (currentStation && isPlaying) {
      pushMprisState(currentStation, true, nowPlaying);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying]);

  const stopLanbeatsPoll = useCallback(() => {
    if (lanbeatsPollRef.current) {
      clearInterval(lanbeatsPollRef.current);
      lanbeatsPollRef.current = null;
    }
    setNowPlaying(null);
  }, []);

  // LanBeats – dociągnij metadane now-playing przez backend proxy (unika CORS)
  const startLanbeatsPoll = useCallback((streamUrl) => {
    stopLanbeatsPoll();
    let base;
    try { base = new URL(streamUrl).origin; } catch { return; }

    const poll = async () => {
      try {
        const r = await fetch(`${API_URL}/stations/lanbeats-status?base=${encodeURIComponent(base)}`);
        if (!r.ok) return;
        const d = await r.json();
        const np = d.now_playing || {};
        setNowPlaying({ title: np.title || np.file || '', artist: np.artist || '' });
      } catch { /* cichy fail – nie psuj odtwarzania dla samych metadanych */ }
    };
    poll();
    lanbeatsPollRef.current = setInterval(poll, 5000);
  }, [stopLanbeatsPoll]);

  // Pobierz świeży, podpisany URL streamu open.fm dla danego slug.
  const fetchOpenfmUrl = useCallback(async (slug) => {
    const r = await fetch(`${API_URL}/stations/openfm/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const data = await r.json();
    if (!r.ok || !data.url) throw new Error(data.error || 'Nie udało się pobrać URL streamu open.fm');
    return data.url;
  }, []);

  // Odtwórz strumień HLS (.m3u8) przez hls.js - Electron 28 nie ma natywnego
  // odtwarzania HLS. myToken chroni przed race condition: jeśli w międzyczasie
  // ktoś kliknął stop albo zmienił stację, ten wynik jest po prostu ignorowany.
  // hls.js ładowany dynamicznie (~500KB) - nie warto go ciągnąć do initial
  // bundle dla wszystkich, skoro open.fm to tylko jeden z typów stacji.
  const playHls = useCallback(async (url, myToken) => {
    destroyHls();
    const audio = audioRef.current;
    const { default: Hls } = await import('hls.js');
    if (playTokenRef.current !== myToken) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (playTokenRef.current !== myToken) return;
        if (data.fatal) {
          // Najczęstsza przyczyna fatal błędu tutaj: token w URL wygasł.
          // Zamiast zostawić ciszę, poddajemy się - UI pokaże błąd, user
          // może kliknąć ponownie (co pobierze świeży token od nowa).
          setHasError(true); setIsLoading(false); setIsPlaying(false);
          destroyHls();
        }
      });
      hls.loadSource(url);
      hls.attachMedia(audio);
      audio.play().catch(() => {
        if (playTokenRef.current === myToken) { setHasError(true); setIsLoading(false); setIsPlaying(false); }
      });
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      // Fallback dla ewentualnego natywnego wsparcia (Safari itp.)
      audio.src = url;
      audio.load();
      audio.play().catch(() => {
        if (playTokenRef.current === myToken) { setHasError(true); setIsLoading(false); setIsPlaying(false); }
      });
    } else {
      setHasError(true); setIsLoading(false); setIsPlaying(false);
    }
  }, [destroyHls]);

  const play = useCallback((station) => {
    if (!station) return;
    const audio = audioRef.current;
    setHasError(false);
    setIsLoading(true);
    setCurrentStation(station);
    setIsPlaying(true);
    stopLanbeatsPoll();
    destroyHls();

    const myToken = ++playTokenRef.current;

    if (station.type === 'openfm') {
      if (!station.slug) { setHasError(true); setIsLoading(false); setIsPlaying(false); return; }
      audio.src = '';
      fetchOpenfmUrl(station.slug)
        .then(url => { if (playTokenRef.current === myToken) playHls(url, myToken); })
        .catch(() => { if (playTokenRef.current === myToken) { setHasError(true); setIsLoading(false); setIsPlaying(false); } });
      pushMprisState(station, true, null);
      return;
    }

    if (!station.url) { setHasError(true); setIsLoading(false); setIsPlaying(false); return; }

    // Bez cache-bustingu w query stringu: serwery Icecast/Shoutcast (SHOUTcast v1
    // szczególnie) często nie tolerują nieznanych parametrów URL i zrywają
    // połączenie albo odpowiadają pustym/błędnym strumieniem. To jest stream
    // na żywo, nie plik statyczny - przeglądarka i tak nigdy go nie cache'uje.
    if (audio.src !== station.url) {
      audio.src = station.url;
      audio.load();
    }
    audio.play().catch(() => { setHasError(true); setIsLoading(false); setIsPlaying(false); });

    pushMprisState(station, true, null);

    if (station.type === 'lanbeats') startLanbeatsPoll(station.url);
  }, [startLanbeatsPoll, stopLanbeatsPoll, pushMprisState, fetchOpenfmUrl, playHls, destroyHls]);

  const stop = useCallback((opts = {}) => {
    ++playTokenRef.current; // unieważnia ewentualny trwający fetch tokenu open.fm
    destroyHls();
    const audio = audioRef.current;
    audio.pause();
    audio.src = '';
    setIsPlaying(false);
    setIsLoading(false);
    stopLanbeatsPoll();
    // Gdy radio jest zatrzymywane bo przejmuje je player plików lokalnych
    // (silentTakeover), NIE czyść MPRIS/tray pustym stanem - usePlayer i tak
    // zaraz nadpisze je poprawnymi danymi utworu. Wysłanie pustki tutaj
    // stworzyłoby wyścig i migotanie w kliencie MPRIS.
    if (!opts.silentTakeover) pushMprisState(null, false, null);
  }, [stopLanbeatsPoll, pushMprisState, destroyHls]);

  const toggle = useCallback((station) => {
    if (isPlaying && currentStation?.id === station?.id) stop();
    else play(station);
  }, [isPlaying, currentStation, play, stop]);

  useEffect(() => () => { stopLanbeatsPoll(); destroyHls(); audioRef.current.pause(); }, [stopLanbeatsPoll, destroyHls]);

  return {
    currentStation, isPlaying, isLoading, hasError, nowPlaying,
    volume, setVolume, isMuted, setIsMuted,
    play, stop, toggle,
    eqAvailable: false, // EQ dla radia trwale wyłączone - patrz komentarz na górze pliku
  };
}

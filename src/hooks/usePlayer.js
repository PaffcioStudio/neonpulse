import { useState, useEffect, useRef, useCallback } from 'react';
import { shuffleArray, getCoverSrc } from '../utils';

import { ipcRenderer } from '../ipc';

export const REPEAT_MODES = { OFF: 'off', ALL: 'all', ONE: 'one' };

const STORAGE_KEYS = {
  volume:    'neonpulse_volume',
  queue:     'neonpulse_queue',
  lastSong:  'neonpulse_last_song',
  lastPos:   'neonpulse_last_pos',
  queueIdx:  'neonpulse_queue_idx',
};

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Crossfade engine ─────────────────────────────────────────
// Tworzymy drugi element audio wyłącznie do przeładowania/fade-out
const CROSSFADE_SEC = 2;

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api'
  : 'http://localhost:3001/api';

function getAudioSrc(song) {
  if (!song) return '';
  const version = encodeURIComponent(song.mtime || song.filesize || '');
  if (song.id) return `${API_URL}/audio/${encodeURIComponent(song.id)}?v=${version}`;
  if (song.path) return `${API_URL}/audio?path=${encodeURIComponent(song.path)}&v=${version}`;
  return '';
}

function toAbsoluteUrl(url) {
  try { return new URL(url, window.location.href).href; }
  catch { return url; }
}

export function usePlayer(settings, onError) {
  const rememberVol = settings?.rememberVolume !== false;
  const initVol     = rememberVol ? load(STORAGE_KEYS.volume, 100) : 100;

  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [volume,      setVolume]      = useState(initVol);
  const [isMuted,     setIsMuted]     = useState(false);
  const [repeatMode,  setRepeatMode]  = useState(REPEAT_MODES.OFF);
  const [isShuffle,   setIsShuffle]   = useState(false);
  const shuffleHistoryRef = useRef(new Set()); // id-ki już odtworzonych w trybie shuffle
  const [queue,       setQueue]       = useState([]);
  const [queueIndex,  setQueueIndex]  = useState(-1);

  const currentSongRef = useRef(null);
  const audioRef      = useRef(new Audio());
  const audioFadeRef  = useRef(new Audio()); // drugi element do crossfade
  const audioCtxRef   = useRef(null);
  const analyserRef   = useRef(null);
  const sourceRef     = useRef(null);
  const eqFiltersRef  = useRef([]); // 10 BiquadFilterNode
  const gainNodeRef    = useRef(null); // ReplayGain GainNode
  const fadeTimerRef   = useRef(null); // fade-in timer

  // 10-pasmowy EQ – częstotliwości środkowe (Hz)
  const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const crossfadeTimer = useRef(null);
  const gaplessTimer   = useRef(null);

  // Aktualne wartości bez re-renderów (do callbacków)
  const settingsRef    = useRef(settings);
  const volumeRef      = useRef(initVol);
  const isMutedRef     = useRef(false);
  const repeatModeRef  = useRef(REPEAT_MODES.OFF);
  const queueRef       = useRef([]);
  const queueIndexRef  = useRef(-1);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { volumeRef.current   = volume;    }, [volume]);
  useEffect(() => { isMutedRef.current  = isMuted;   }, [isMuted]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { queueRef.current    = queue;      }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);

  // Refy do handleNext/handlePrev – zawsze aktualna wersja bez stałego dependency
  const handleNextRef = useRef(null);
  const handlePrevRef = useRef(null);

  // ─── DefaultShuffle przy starcie ─────────────────────────────
  useEffect(() => {
    if (settings?.defaultShuffle) setIsShuffle(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Zapisz kolejkę + pozycję przy zamknięciu ─────────────────
  useEffect(() => {
    const onUnload = () => {
      if (queueRef.current.length > 0) {
        save(STORAGE_KEYS.queue,    queueRef.current.map(s => s.id));
        save(STORAGE_KEYS.queueIdx, queueIndexRef.current);
      }
      if (audioRef.current && !audioRef.current.paused) {
        save(STORAGE_KEYS.lastPos, audioRef.current.currentTime);
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // ─── Audio Context ───────────────────────────────────────────
  // AudioContext NIE może być tworzony automatycznie - przeglądarki i Electron
  // wymagają gestu użytkownika. Tworzymy go przy pierwszym play().
  function getOrCreateAudioCtx(audio) {
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new Ctx();
    analyserRef.current = audioCtxRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    analyserRef.current.smoothingTimeConstant = 0.75;

    // Buduj 10 filtrów peaking EQ
    eqFiltersRef.current = EQ_FREQS.map((freq, i) => {
      const f = audioCtxRef.current.createBiquadFilter();
      f.type = (i === 0) ? 'lowshelf' : (i === EQ_FREQS.length - 1) ? 'highshelf' : 'peaking';
      f.frequency.value = freq;
      f.gain.value = 0;
      f.Q.value = 1.4;
      return f;
    });

    // Wczytaj zapisane wzmocnienia EQ z localStorage
    try {
      const savedEq = localStorage.getItem('neonpulse_eq_gains');
      if (savedEq) {
        const gains = JSON.parse(savedEq);
        if (Array.isArray(gains) && gains.length === 10) {
          gains.forEach((g, i) => {
            if (eqFiltersRef.current[i]) eqFiltersRef.current[i].gain.value = g;
          });
        }
      }
    } catch {}

    try {
      sourceRef.current = audioCtxRef.current.createMediaElementSource(audio);
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.gain.value = 1.0;
      // source -> gainNode -> eq[0] -> ... -> eq[9] -> analyser -> destination
      let node = sourceRef.current;
      node.connect(gainNodeRef.current);
      node = gainNodeRef.current;
      for (const f of eqFiltersRef.current) {
        node.connect(f);
        node = f;
      }
      node.connect(analyserRef.current);
      analyserRef.current.connect(audioCtxRef.current.destination);
    } catch {}
    return audioCtxRef.current;
  }

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = initVol / 100;

    const onTimeUpdate = () => {
      setProgress(audio.currentTime);
      // Zapisz pozycję co 5s dla opcji przywracania startu
      if ((settingsRef.current?.autoPlayLast || settingsRef.current?.rememberQueue) && Math.floor(audio.currentTime) % 5 === 0) {
        save(STORAGE_KEYS.lastPos, audio.currentTime);
      }
      // Gapless – prebuffer następny 10s przed końcem
      scheduleGapless(audio);
      // Crossfade – zacznij fade-out CROSSFADE_SEC przed końcem
      scheduleCrossfade(audio);
    };
    const onEnded = () => handleTrackEnd();
    const onAudioError = () => {
      const song = currentSongRef.current;
      const name = song?.title || song?.path?.split('/').pop() || audio.src || '?';
      if (onError) onError(name);
      handleTrackEnd();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onAudioError);

    // MPRIS position ticker – co 1s dla płynnego paska w KDE/GNOME
    const ticker = setInterval(() => {
      if (!audio.paused && audio.currentTime > 0) {
        ipcRenderer.send('player:position', Math.floor(audio.currentTime * 1_000_000));
      }
    }, 1000);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onAudioError);
      clearInterval(ticker);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Gapless – prebuffer ─────────────────────────────────────
  function scheduleGapless(audio) {
    if (!settingsRef.current?.gaplessPlayback) return;
    if (!audio.duration || !isFinite(audio.duration)) return;
    const remaining = audio.duration - audio.currentTime;
    if (remaining > 12 || remaining < 0) return; // zaczyna prebuffer 12s przed końcem
    if (gaplessTimer.current) return; // już zaplanowano

    const q    = queueRef.current;
    const idx  = queueIndexRef.current;
    const next = q[idx + 1];
    if (!next) return;

    const fadeAudio = audioFadeRef.current;
    fadeAudio.src    = getAudioSrc(next);
    fadeAudio.volume = 0;
    fadeAudio.load();
    fadeAudio.play().catch(() => {});
    fadeAudio.pause(); // tylko prebuffer
    gaplessTimer.current = true;
  }

  // ─── Crossfade ───────────────────────────────────────────────
  function scheduleCrossfade(audio) {
    if (!settingsRef.current?.crossfade) return;
    if (crossfadeTimer.current) return;
    if (!audio.duration || !isFinite(audio.duration)) return;
    const remaining = audio.duration - audio.currentTime;
    if (remaining > CROSSFADE_SEC + 0.5) return;

    const q    = queueRef.current;
    const idx  = queueIndexRef.current;
    const next = q[idx + 1];
    if (!next) return;

    crossfadeTimer.current = true;
    const vol = isMutedRef.current ? 0 : volumeRef.current / 100;
    const fadeAudio = audioFadeRef.current;

    // Uruchom następny z głośnością 0
    fadeAudio.src    = getAudioSrc(next);
    fadeAudio.volume = 0;
    fadeAudio.load();
    fadeAudio.play().catch(() => {});

    // Fade out główny, fade in nowy
    const steps = 30;
    const step  = CROSSFADE_SEC * 1000 / steps;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      const ratio = i / steps;
      audio.volume    = vol * (1 - ratio);
      fadeAudio.volume = vol * ratio;
      if (i >= steps) {
        clearInterval(timer);
        // Zamień role: fade staje się głównym
        audio.pause();
        audio.src = '';
        // Przesuń stan
        const nextIdx = idx + 1;
        setQueueIndex(nextIdx);
        setCurrentSong(next);
        // Nie ruszaj isPlaying – zostaje true
        // Przełącz audio – teraz fadeAudio gra, a audioRef dostanie nowy src
        audioRef.current.src    = getAudioSrc(next);
        audioRef.current.volume = vol;
        // Synchronizuj pozycję
        audioRef.current.currentTime = fadeAudio.currentTime;
        audioRef.current.play().catch(() => {});
        fadeAudio.pause();
        fadeAudio.src = '';
        crossfadeTimer.current = null;
        gaplessTimer.current   = null;
      }
    }, step);
  }

  // ─── Zmiana głośności ────────────────────────────────────────
  useEffect(() => {
    const v = isMuted ? 0 : volume / 100;
    audioRef.current.volume = v;
    if (settingsRef.current?.rememberVolume !== false) save(STORAGE_KEYS.volume, volume);
  }, [volume, isMuted]);

  // ─── Zapamiętaj kolejkę ──────────────────────────────────────
  useEffect(() => {
    if ((settings?.rememberQueue || settings?.autoPlayLast) && queue.length > 0) {
      save(STORAGE_KEYS.queue, queue.map(s => s.id));
      save(STORAGE_KEYS.queueIdx, queueIndex);
    }
  }, [queue, queueIndex, settings?.rememberQueue, settings?.autoPlayLast]);

  // ─── ReplayGain: ustaw gain na podstawie tagu utworu ────────
  const applyReplayGain = useCallback((song) => {
    if (!gainNodeRef.current || !song) return;
    if (!settingsRef.current?.replayGainEnabled) {
      gainNodeRef.current.gain.value = 1.0;
      return;
    }
    const rg = song.replaygain ?? 0; // dB
    // dB -> linear: 10^(dB/20), clamp do max 4.0 żeby uniknąć clippingu
    const linear = Math.min(4.0, Math.pow(10, rg / 20));
    gainNodeRef.current.gain.value = linear;
  }, []);

  // ─── Fade-in: delikatne wejście głośności przy starcie ───────
  const applyFadeIn = useCallback((targetVol) => {
    if (!gainNodeRef.current || !audioCtxRef.current) return;
    if (!settingsRef.current?.fadeInOnPlay) return;
    const ctx  = audioCtxRef.current;
    const gain = gainNodeRef.current.gain;
    const rg   = gain.value; // aktualny gain po ReplayGain
    gain.setValueAtTime(0, ctx.currentTime);
    gain.linearRampToValueAtTime(rg, ctx.currentTime + 0.8);
  }, []);

  // ─── Zmiana utworu ───────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!currentSong) return;

    crossfadeTimer.current = null;
    gaplessTimer.current   = null;

    const url = getAudioSrc(currentSong);
    if (decodeURI(audio.src || '') !== decodeURI(toAbsoluteUrl(url))) {
      audio.src = url;
      audio.load();
    }
    audio.volume = isMuted ? 0 : volume / 100;

    // Zachowaj ostatni utwór dla opcji startowego odtwarzania / wznowienia.
    if (settings?.autoPlayLast || settings?.rememberQueue) {
      const lastId  = load(STORAGE_KEYS.lastSong, null);
      const lastPos = load(STORAGE_KEYS.lastPos,  0);
      if (lastId === currentSong.id && lastPos > 0) {
        audio.currentTime = lastPos;
      }
      save(STORAGE_KEYS.lastSong, currentSong.id);
      save(STORAGE_KEYS.lastPos,  0);
    }

    if (isPlaying) {
      const ctx = getOrCreateAudioCtx(audio);
      ctx.state === 'suspended' && ctx.resume();
      applyReplayGain(currentSong);
      applyFadeIn(audio.volume);
      audio.play().catch(e => console.error('[PLAY]', e));
    }

    ipcRenderer.send('player:update', {
      title: currentSong.title, artist: currentSong.artist,
      album: currentSong.album, cover: getCoverSrc(currentSong.cover) || '',
      duration: currentSong.duration, position: audio.currentTime, isPlaying,
      volume: isMuted ? 0 : volume / 100,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  // ─── Play/Pause ──────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (isPlaying) {
      const ctx = getOrCreateAudioCtx(audio);
      ctx.state === 'suspended' && ctx.resume();
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    if (currentSong) {
      ipcRenderer.send('player:update', {
        title: currentSong.title, artist: currentSong.artist,
        album: currentSong.album, cover: getCoverSrc(currentSong.cover) || '',
        duration: currentSong.duration, position: audio.currentTime, isPlaying,
        volume: isMuted ? 0 : volume / 100,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // ─── IPC: komendy ────────────────────────────────────────────
  useEffect(() => {
    const handler = (_, cmd) => {
      switch (cmd) {
        case 'play':      setIsPlaying(true);    break;
        case 'pause':     setIsPlaying(false);   break;
        case 'playpause': setIsPlaying(p => !p); break;
        case 'next':      handleNextRef.current?.();  break;
        case 'previous':  handlePrevRef.current?.();  break;
      }
    };
    ipcRenderer.on('player:command', handler);
    return () => ipcRenderer.removeListener('player:command', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── IPC: głośność z tray ────────────────────────────────────
  useEffect(() => {
    const handler = (_, delta) => {
      setIsMuted(false);
      setVolume(v => {
        const next = Math.max(0, Math.min(100, v + Math.round(delta * 100)));
        audioRef.current.volume = next / 100;
        return next;
      });
    };
    ipcRenderer.on('player:volume-delta', handler);
    return () => ipcRenderer.removeListener('player:volume-delta', handler);
  }, []);

  // ─── IPC: seek z systemu (MPRIS pasek postępu, klawisze) ───────
  useEffect(() => {
    const handler = (_, seconds) => {
      if (audioRef.current && !isNaN(seconds)) {
        audioRef.current.currentTime = seconds;
        setProgress(seconds);
      }
    };
    // app:seek-to - wysyłane przez electron-main gdy użytkownik przesuwa pasek w KDE/GNOME
    ipcRenderer.on('app:seek-to', handler);
    return () => ipcRenderer.removeListener('app:seek-to', handler);
  }, []);

  // ─── Shuffle: wybierz następny indeks bez powtórzeń ─────────
  const pickNextIdx = useCallback((q, currentIdx) => {
    if (!isShuffle || q.length <= 1) {
      return (currentIdx + 1) % q.length;
    }
    const notPlayed = q
      .map((song, index) => ({ song, index }))
      .filter(({ song, index }) => index !== currentIdx && !shuffleHistoryRef.current.has(song.id))
      .map(({ index }) => index);
    if (notPlayed.length === 0) {
      // Cały cykl odtworzony – reset historii
      shuffleHistoryRef.current.clear();
      const all = q.map((_, i) => i).filter(i => i !== currentIdx);
      if (all.length === 0) return currentIdx;
      return all[Math.floor(Math.random() * all.length)];
    }
    return notPlayed[Math.floor(Math.random() * notPlayed.length)];
  }, [isShuffle]);

  // ─── Track end handler ───────────────────────────────────────
  const handleTrackEnd = useCallback(() => {
    crossfadeTimer.current = null;
    gaplessTimer.current   = null;
    setQueue(prevQ => {
      setQueueIndex(prevIdx => {
        if (repeatModeRef.current === REPEAT_MODES.ONE) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
          return prevIdx;
        }
        if (prevQ[prevIdx]) shuffleHistoryRef.current.add(prevQ[prevIdx].id);
        const next = pickNextIdx(prevQ, prevIdx);
        // Jeśli shuffle i wróciło do tego samego – wszystko odtworzone
        if (next === prevIdx && prevQ.length > 1 && repeatModeRef.current !== REPEAT_MODES.ALL) {
          setIsPlaying(false);
          return prevIdx;
        }
        if (next <= prevIdx && !isShuffle) {
          // koniec listy bez repeat
          if (repeatModeRef.current === REPEAT_MODES.ALL) {
            shuffleHistoryRef.current.clear();
            setCurrentSong(prevQ[0]);
            setIsPlaying(true);
            return 0;
          }
          setIsPlaying(false);
          return prevIdx;
        }
        setCurrentSong(prevQ[next]);
        setIsPlaying(true);
        return next;
      });
      return prevQ;
    });
  }, [pickNextIdx, isShuffle]);

  const handleNext = useCallback(() => {
    crossfadeTimer.current = null;
    gaplessTimer.current   = null;
    const q = queueRef.current, idx = queueIndexRef.current;
    if (!q.length) return;
    if (q[idx]) shuffleHistoryRef.current.add(q[idx].id);
    const next = pickNextIdx(q, idx);
    setQueueIndex(next); setCurrentSong(q[next]); setIsPlaying(true);
  }, [pickNextIdx]);

  const handlePrev = useCallback(() => {
    crossfadeTimer.current = null;
    if (audioRef.current.currentTime > 3) { audioRef.current.currentTime = 0; return; }
    const q = queueRef.current, idx = queueIndexRef.current;
    if (!q.length) return;
    const prev = (idx - 1 + q.length) % q.length;
    setQueueIndex(prev); setCurrentSong(q[prev]); setIsPlaying(true);
  }, []);

  // Aktualizuj refy po każdej zmianie (żeby IPC handler zawsze miał aktualną wersję)
  useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);
  useEffect(() => { handlePrevRef.current = handlePrev; }, [handlePrev]);

  const removeFromQueue = useCallback((removeIdx) => {
    setQueue(prev => {
      const next = prev.filter((_, i) => i !== removeIdx);
      setQueueIndex(prevIdx => {
        if (removeIdx < prevIdx) return prevIdx - 1;
        if (removeIdx === prevIdx) {
          const playNext = Math.min(prevIdx, next.length - 1);
          if (playNext >= 0) { setCurrentSong(next[playNext]); setIsPlaying(true); }
          else { setIsPlaying(false); }
          return playNext;
        }
        return prevIdx;
      });
      return next;
    });
  }, []);

  const reorderQueue = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setQueue(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setQueueIndex(prevIdx => {
        if (prevIdx === fromIdx) return toIdx;
        if (fromIdx < prevIdx && toIdx >= prevIdx) return prevIdx - 1;
        if (fromIdx > prevIdx && toIdx <= prevIdx) return prevIdx + 1;
        return prevIdx;
      });
      return next;
    });
  }, []);

  const playFromList = useCallback((song, list) => {
    if (!song) return;
    crossfadeTimer.current = null;
    gaplessTimer.current   = null;
    let q = isShuffle ? shuffleArray(list) : [...list];
    const idx = q.findIndex(s => s.id === song.id);
    if (idx > 0) { const [item] = q.splice(idx, 1); q.unshift(item); }
    setQueue(q); setQueueIndex(0); setCurrentSong(song); setIsPlaying(true);
  }, [isShuffle]);

  const addToQueue = useCallback((song) => {
    setQueue(prev => {
      const next = [...prev, song];
      if (prev.length === 0) { setQueueIndex(0); setCurrentSong(song); setIsPlaying(true); }
      return next;
    });
  }, []);

  const playNextInQueue = useCallback((song) => {
    const q = queueRef.current, idx = queueIndexRef.current;
    if (q.length === 0) { playFromList(song, [song]); return; }
    setQueue(prev => { const nq = [...prev]; nq.splice(idx + 1, 0, song); return nq; });
  }, [playFromList]);

  const handlePlayPause = useCallback((displayList) => {
    if (!currentSong && displayList?.length > 0) { playFromList(displayList[0], displayList); return; }
    setIsPlaying(p => !p);
  }, [currentSong, playFromList]);

  const cycleRepeat = () =>
    setRepeatMode(m => m === REPEAT_MODES.OFF ? REPEAT_MODES.ALL : m === REPEAT_MODES.ALL ? REPEAT_MODES.ONE : REPEAT_MODES.OFF);

  const seekTo = (ratio) => {
    crossfadeTimer.current = null;
    const dur = audioRef.current.duration;
    if (Number.isFinite(dur)) {
      const newPos = Math.max(0, Math.min(1, ratio)) * dur;
      audioRef.current.currentTime = newPos;
      // Natychmiast poinformuj MPRIS o nowej pozycji (pełna obsługa seek bar w KDE/GNOME)
      ipcRenderer.send('player:position', Math.floor(newPos * 1_000_000));
      ipcRenderer.send('player:seeked',   Math.floor(newPos * 1_000_000));
    }
  };

  const handleVolumeScroll = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    setIsMuted(false);
    setVolume(v => Math.max(0, Math.min(100, v + delta)));
  }, []);

  return {
    currentSong, setCurrentSong,
    isPlaying, setIsPlaying,
    progress, setProgress,
    volume, setVolume,
    isMuted, setIsMuted,
    repeatMode, cycleRepeat,
    isShuffle, setIsShuffle,
    queue, setQueue,
    queueIndex, setQueueIndex,
    audioRef, analyserRef, eqFiltersRef, EQ_FREQS,
    playFromList, addToQueue, playNextInQueue, removeFromQueue, reorderQueue,
    handlePlayPause, handleNext, handlePrev,
    seekTo, handleVolumeScroll,
    setEqGain: (bandIndex, gainDb) => {
      const f = eqFiltersRef.current[bandIndex];
      if (f) f.gain.value = gainDb;
    },
  };
}

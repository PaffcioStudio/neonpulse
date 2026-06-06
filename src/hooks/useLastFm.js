/**
 * useLastFm – hook do Last.fm scrobblowania
 * - updateNowPlaying przy zmianie utworu
 * - scrobble gdy utwór odtworzony >50% lub >4 minuty
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api' : 'http://localhost:3001/api';

export function useLastFm(currentSong, isPlaying, progress) {
  const [config,     setConfig]     = useState(null); // { configured, username, hasSession }
  const [lastfmOn,   setLastfmOn]   = useState(() => {
    try {
      const saved = localStorage.getItem('neonpulse_lastfm_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch { return true; }
  });

  const scrobbledRef  = useRef(null);  // id ostatnio scrobblowanego
  const startTimeRef  = useRef(null);  // timestamp startu bieżącego
  const songStartRef  = useRef(null);  // currentSong przy starcie

  // Wczytaj konfigurację
  const loadConfig = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/lastfm/config`);
      if (r.ok) setConfig(await r.json());
    } catch {}
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const isActive = lastfmOn && config?.hasSession;

  // Now Playing przy zmianie utworu
  useEffect(() => {
    if (!isActive || !currentSong || !isPlaying) return;
    startTimeRef.current  = Date.now();
    songStartRef.current  = currentSong;

    fetch(`${API_URL}/lastfm/nowplaying`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist:   currentSong.artist,
        title:    currentSong.title,
        album:    currentSong.album,
        duration: currentSong.duration,
      }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id, isPlaying, isActive]);

  // Scrobble gdy >50% lub >240s i nie scrobblowano jeszcze tego
  useEffect(() => {
    if (!isActive || !currentSong || !isPlaying) return;
    if (scrobbledRef.current === currentSong.id) return;

    const dur = currentSong.duration || 0;
    const threshold = Math.min(dur * 0.5, 240);
    if (threshold > 0 && progress >= threshold) {
      scrobbledRef.current = currentSong.id;
      fetch(`${API_URL}/lastfm/scrobble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist:    currentSong.artist,
          title:     currentSong.title,
          album:     currentSong.album,
          duration:  currentSong.duration,
          timestamp: Math.floor((startTimeRef.current || Date.now()) / 1000),
        }),
      }).catch(() => {});
    }
  }, [currentSong?.id, progress, isPlaying, isActive]);

  // Reset scrobble na zmianie utworu
  useEffect(() => {
    scrobbledRef.current = null;
    startTimeRef.current = Date.now();
  }, [currentSong?.id]);

  const toggleLastfm = useCallback((val) => {
    const next = val !== undefined ? val : !lastfmOn;
    setLastfmOn(next);
    try { localStorage.setItem('neonpulse_lastfm_enabled', JSON.stringify(next)); } catch {}
  }, [lastfmOn]);

  return { config, loadConfig, lastfmOn, toggleLastfm, isActive };
}

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, Heart, Shuffle, SkipBack, Play, Pause,
  SkipForward, Repeat, Repeat1, Volume2, VolumeX,
  ListOrdered, Mic2, Moon, MoreHorizontal
} from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER, formatTime } from '../../utils';
import { REPEAT_MODES } from '../../hooks/usePlayer';
import HeartButton from '../HeartButton';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api'
  : 'http://localhost:3001/api';

function parseLrc(raw) {
  if (!raw) return null;
  const lines = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (m) lines.push({ time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() });
  }
  return lines.length ? lines.sort((a, b) => a.time - b.time) : null;
}

function findActiveLine(lines, t) {
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) idx = i; else break;
  }
  return idx;
}

export default function NowPlayingView({
  currentSong, isPlaying, progress, volume, isMuted,
  repeatMode, isShuffle, queue,
  handlePlayPause, handleNext, handlePrev, seekTo,
  setVolume, setIsMuted, setIsShuffle, cycleRepeat,
  onToggleFavorite, onClose, displayList,
  onSleepTimer, sleepRemaining,
  audioRef, animationsEnabled = true, isClosing = false,
}) {
  const [tab, setTab] = useState('cover'); // cover | lyrics | queue
  const [lyrics, setLyrics] = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lrcParsed, setLrcParsed] = useState(null);
  const activeLineRef = useRef(null);
  const lyricsContainerRef = useRef(null);

  const RepeatIcon  = repeatMode === REPEAT_MODES.ONE ? Repeat1 : Repeat;
  const repeatActive = repeatMode !== REPEAT_MODES.OFF;
  const progressPct = currentSong?.duration ? (progress / currentSong.duration) * 100 : 0;
  const cover = getCoverSrc(currentSong?.cover);

  /* Fetch lyrics when switching to lyrics tab */
  useEffect(() => {
    if (tab !== 'lyrics' || !currentSong) return;
    let cancelled = false;
    setLyrics(null); setLrcParsed(null); setLyricsLoading(true);

    const load = async () => {
      // 1. Embedded w obiekcie piosenki (z DB – bez fetcha)
      if (currentSong.lyrics && currentSong.lyrics.trim()) {
        const parsed = parseLrc(currentSong.lyrics);
        if (!cancelled) {
          if (parsed) setLrcParsed(parsed);
          else setLyrics(currentSong.lyrics);
          setLyricsLoading(false);
        }
        return;
      }

      // 2. Plik .lrc obok pliku audio
      try {
        const lrcPath = currentSong.path.replace(/\.[^.]+$/, '.lrc');
        const r = await fetch(`${API_URL}/lyrics?path=${encodeURIComponent(lrcPath)}`);
        if (!cancelled && r.ok && r.status !== 204) {
          const text = await r.text();
          if (text.trim()) {
            const parsed = parseLrc(text);
            if (parsed) setLrcParsed(parsed);
            else setLyrics(text);
            setLyricsLoading(false);
            return;
          }
        }
      } catch {}

      // 3. Embedded z pliku audio (live read)
      try {
        const r = await fetch(`${API_URL}/lyrics/embedded?songId=${currentSong.id}`);
        if (!cancelled && r.ok) {
          const data = await r.json();
          if (data.lyrics && data.lyrics.trim()) {
            const parsed = parseLrc(data.lyrics);
            if (parsed) setLrcParsed(parsed);
            else setLyrics(data.lyrics);
          }
        }
      } catch {}

      if (!cancelled) setLyricsLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [tab, currentSong?.id, currentSong?.path, currentSong?.lyrics]);

  /* Auto-scroll active lyric line */
  const activeLine = lrcParsed ? findActiveLine(lrcParsed, progress) : -1;
  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLine]);

  /* Ambient color from cover - simple approach using canvas */
  const [ambientColor, setAmbientColor] = useState('rgba(30,10,50,0.9)');
  useEffect(() => {
    if (!currentSong?.cover) { setAmbientColor('rgba(20,10,40,0.9)'); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 4; canvas.height = 4;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 4, 4);
        const d = ctx.getImageData(0, 0, 4, 4).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
        const n = d.length / 4;
        // Przyciemnij do tła
        r = Math.floor(r / n * 0.35);
        g = Math.floor(g / n * 0.35);
        b = Math.floor(b / n * 0.35);
        setAmbientColor(`rgb(${r},${g},${b})`);
      } catch { setAmbientColor('rgba(20,10,40,0.9)'); }
    };
    img.onerror = () => setAmbientColor('rgba(20,10,40,0.9)');
    img.src = getCoverSrc(currentSong.cover);
  }, [currentSong?.cover]);

  return (
    <div className={`fixed inset-0 z-[150] flex flex-col overflow-hidden ${
      animationsEnabled ? (isClosing ? 'np-full-exit' : 'np-full-enter') : ''
    }`}
      style={{ background: `linear-gradient(180deg, ${ambientColor} 0%, #09090b 100%)` }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2 flex-shrink-0">
        <button onClick={onClose}
          className="p-2 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
          <ChevronDown size={22} />
        </button>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {[
            { id: 'cover',  icon: null,       label: 'Teraz' },
            { id: 'lyrics', icon: Mic2,        label: 'Tekst' },
            { id: 'queue',  icon: ListOrdered, label: 'Kolejka' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === id ? 'accent-gradient text-white shadow' : 'text-zinc-500 hover:text-zinc-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <button onClick={() => onSleepTimer?.()}
          title="Wyłącznik czasowy"
          className={`p-2 rounded-xl transition-colors relative ${
            sleepRemaining > 0 ? 'text-indigo-400 bg-indigo-400/10' : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/10'
          }`}>
          <Moon size={18} />
          {sleepRemaining > 0 && (
            <span className="absolute -top-1 -right-1 text-[9px] bg-indigo-500 text-white rounded-full px-1 font-bold leading-tight">
              {Math.ceil(sleepRemaining / 60)}m
            </span>
          )}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-hidden px-6">

        {/* ── COVER TAB ── */}
        {tab === 'cover' && (
          <div className="flex flex-col items-center justify-center flex-1 w-full max-w-sm gap-6">
            {/* Album art */}
            <div className="relative group">
              <div className="absolute inset-0 rounded-3xl blur-2xl opacity-40 scale-95"
                style={{ background: `radial-gradient(circle, ${ambientColor}, transparent)` }} />
              <img
                src={cover || COVER_PLACEHOLDER(280)}
                onError={e => { e.target.src = COVER_PLACEHOLDER(280); }}
                alt="okładka"
                className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl object-cover shadow-2xl border border-white/10"
                style={{ boxShadow: `0 24px 60px ${ambientColor}` }}
              />
            </div>

            {/* Song info */}
            <div className="w-full flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-white truncate leading-tight">
                  {currentSong?.title || 'Nic nie gra'}
                </h2>
                <p className="text-zinc-400 text-sm mt-1 truncate">
                  {currentSong?.artist || ''}
                  {currentSong?.album ? <span className="text-zinc-600"> · {currentSong.album}</span> : ''}
                </p>
              </div>
              {currentSong && (
                <HeartButton
                  isFavorite={!!currentSong.isFavorite}
                  onToggle={() => onToggleFavorite(currentSong.id)}
                  size={22}
                  className="flex-shrink-0 mt-1"
                />
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full space-y-1">
              <div className="relative h-1.5 bg-zinc-800 rounded-full cursor-pointer group/seek"
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  seekTo((e.clientX - r.left) / r.width);
                }}>
                <div className={`h-full accent-gradient rounded-full transition-none relative ${
                  isPlaying && animationsEnabled ? 'progress-pulse' : ''
                }`}
                  style={{ width: `${progressPct}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity"
                    style={{ boxShadow: '0 0 8px var(--accent-glow)' }} />
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-600 tabular-nums">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(currentSong?.duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="w-full flex items-center justify-between">
              <button onClick={() => setIsShuffle(p => !p)}
                className={`p-2 rounded-xl transition-colors ${isShuffle ? 'accent-text' : 'text-zinc-600 hover:text-zinc-300'}`}>
                <Shuffle size={20} />
              </button>
              <button onClick={handlePrev}
                className="p-2 rounded-xl text-zinc-300 hover:text-white transition-colors">
                <SkipBack size={28} fill="currentColor" />
              </button>
              <button
                onClick={() => handlePlayPause(displayList)}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-xl"
                style={{ background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))', boxShadow: '0 8px 32px var(--accent-glow)' }}
              >
                {isPlaying
                  ? <Pause size={28} fill="white" className="text-white" />
                  : <Play  size={28} fill="white" className="text-white ml-1" />}
              </button>
              <button onClick={handleNext}
                className="p-2 rounded-xl text-zinc-300 hover:text-white transition-colors">
                <SkipForward size={28} fill="currentColor" />
              </button>
              <button onClick={cycleRepeat}
                className={`p-2 rounded-xl transition-colors ${repeatActive ? 'accent-text' : 'text-zinc-600 hover:text-zinc-300'}`}>
                <RepeatIcon size={20} />
              </button>
            </div>

            {/* Volume */}
            <div className="w-full flex items-center gap-3">
              <button onClick={() => setIsMuted(m => !m)} className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <div className="flex-1 relative h-1.5 bg-zinc-800 rounded-full cursor-pointer"
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const v = Math.round(((e.clientX - r.left) / r.width) * 100);
                  setVolume(Math.max(0, Math.min(100, v)));
                  setIsMuted(false);
                }}>
                <div className="h-full accent-gradient rounded-full"
                  style={{ width: `${isMuted ? 0 : volume}%` }} />
              </div>
              <span className="text-[11px] text-zinc-600 tabular-nums w-7 text-right flex-shrink-0">
                {isMuted ? 0 : volume}
              </span>
            </div>
          </div>
        )}

        {/* ── LYRICS TAB ── */}
        {tab === 'lyrics' && (
          <div ref={lyricsContainerRef}
            className="flex-1 w-full max-w-lg overflow-y-auto custom-scrollbar py-4 space-y-1">
            {lyricsLoading && (
              <div className="text-center text-zinc-600 py-16 text-sm">Ładuję tekst…</div>
            )}
            {!lyricsLoading && !lrcParsed && !lyrics && (
              <div className="text-center text-zinc-700 py-16">
                <Mic2 size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Brak tekstu dla tego utworu</p>
              </div>
            )}
            {/* LRC z podświetleniem */}
            {lrcParsed && lrcParsed.map((line, i) => (
              <p key={i}
                ref={i === activeLine ? activeLineRef : null}
                onClick={() => seekTo(line.time / currentSong?.duration)}
                className={`text-center py-1 px-4 rounded-lg cursor-pointer transition-all duration-300 leading-relaxed ${
                  i === activeLine
                    ? 'text-white text-lg font-bold accent-text scale-105'
                    : i === activeLine - 1 || i === activeLine + 1
                    ? 'text-zinc-400 text-base'
                    : 'text-zinc-700 text-sm'
                }`}
              >
                {line.text || '\u00a0'}
              </p>
            ))}
            {/* Zwykły tekst */}
            {!lrcParsed && lyrics && (
              <pre className="text-zinc-400 text-sm whitespace-pre-wrap text-center leading-relaxed font-sans px-4">
                {lyrics}
              </pre>
            )}
          </div>
        )}

        {/* ── QUEUE TAB ── */}
        {tab === 'queue' && (
          <div className="flex-1 w-full max-w-lg overflow-y-auto custom-scrollbar py-2">
            {queue.length === 0 ? (
              <div className="text-center text-zinc-700 py-16">
                <ListOrdered size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Kolejka jest pusta</p>
              </div>
            ) : queue.map((song, i) => {
              const isCurrent = song.id === currentSong?.id;
              return (
                <div key={`${song.id}-${i}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isCurrent ? 'bg-white/8 accent-border-subtle border' : 'border border-transparent hover:bg-white/5'
                  }`}
                  onClick={() => handlePlayPause(queue, i)}>
                  <div className="w-6 text-center flex-shrink-0">
                    {isCurrent
                      ? <Volume2 size={13} className="accent-text mx-auto" />
                      : <span className="text-xs text-zinc-700">{i + 1}</span>}
                  </div>
                  <img src={getCoverSrc(song.cover)} onError={e => { e.target.src = COVER_PLACEHOLDER(32); }}
                    alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-zinc-800" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium truncate ${isCurrent ? 'accent-text' : 'text-white'}`}>
                      {song.title || song.path?.split('/').pop()}
                    </p>
                    <p className="text-[11px] text-zinc-600 truncate">{song.artist}</p>
                  </div>
                  <span className="text-[11px] text-zinc-700 flex-shrink-0">{formatTime(song.duration)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

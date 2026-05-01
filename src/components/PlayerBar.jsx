import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle,
         Volume2, VolumeX, ListOrdered, Minimize2, Maximize2, Moon } from 'lucide-react';
import { formatTime, formatTimeRemaining, getCoverSrc, COVER_PLACEHOLDER } from '../utils';
import { REPEAT_MODES } from '../hooks/usePlayer';
import HeartButton from './HeartButton';

export default function PlayerBar({
  currentSong, isPlaying, progress, volume, isMuted, repeatMode, isShuffle,
  queue, setIsMuted, setVolume, setIsShuffle, cycleRepeat,
  handlePlayPause, handleNext, handlePrev, seekTo, handleVolumeScroll,
  onToggleFavorite, onShowQueue, isQueueOpen, onGoHome, displayList,
  settings, onMiniPlayer, isMiniPlayer,
  onNowPlaying, isNowPlaying, onSleepTimer, sleepRemaining,
}) {
  const [showRemaining, setShowRemaining] = useState(false);
  const volumeWrapRef = useRef(null);
  const progressPct = currentSong?.duration ? (progress / currentSong.duration) * 100 : 0;
  const RepeatIcon = repeatMode === REPEAT_MODES.ONE ? Repeat1 : Repeat;
  const repeatActive = repeatMode !== REPEAT_MODES.OFF;

  useEffect(() => {
    const el = volumeWrapRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleVolumeScroll, { passive: false });
    return () => el.removeEventListener('wheel', handleVolumeScroll);
  }, [handleVolumeScroll]);

  const cover = getCoverSrc(currentSong?.cover);

  return (
    <div className="h-24 bg-zinc-950/95 backdrop-blur border-t border-zinc-800/60 px-6 flex items-center justify-between z-50 flex-shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">

      {/* ── Info ── */}
      <div className="w-[28%] flex items-center gap-3 min-w-0">
        {currentSong ? (
          <>
            <img
              src={cover || COVER_PLACEHOLDER(56)}
              className="w-13 h-13 w-[52px] h-[52px] rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 shadow-md"
              onClick={onGoHome}
              alt=""
            />
            <div className="overflow-hidden">
              <h4
                className="font-semibold text-sm truncate cursor-pointer hover:accent-text transition-colors leading-tight"
                onClick={onGoHome}
              >
                {currentSong.title}
              </h4>
              <p className="text-xs text-zinc-500 truncate mt-0.5">{currentSong.artist}</p>
            </div>
            <HeartButton
              isFavorite={!!currentSong.isFavorite}
              onToggle={() => onToggleFavorite(currentSong.id)}
              size={17}
              className="ml-1 flex-shrink-0"
            />
          </>
        ) : (
          <p className="text-xs text-zinc-700">Nic nie gra</p>
        )}
      </div>

      {/* ── Kontrolki + pasek ── */}
      <div className="flex flex-col items-center w-[44%]">
        <div className="flex items-center gap-5 mb-2">
          <button onClick={() => setIsShuffle(p => !p)} title="Losowo"
            className={`transition-all hover:scale-110 ${isShuffle ? 'accent-text' : 'text-zinc-500 hover:text-white'}`}>
            <Shuffle size={16} />
          </button>
          <button onClick={handlePrev} className="text-zinc-400 hover:text-white hover:scale-110 transition-all">
            <SkipBack size={22} />
          </button>
          {/* Przycisk play/pause z motywem */}
          <button
            onClick={() => handlePlayPause(displayList)}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg accent-glow-bg"
            style={{ background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))' }}
          >
            {isPlaying
              ? <Pause size={20} fill="white" className="text-white" />
              : <Play  size={20} fill="white" className="text-white ml-0.5" />}
          </button>
          <button onClick={handleNext} className="text-zinc-400 hover:text-white hover:scale-110 transition-all">
            <SkipForward size={22} />
          </button>
          <button onClick={cycleRepeat} title={`Powtarzanie: ${repeatMode}`}
            className={`transition-all hover:scale-110 ${repeatActive ? 'accent-text' : 'text-zinc-500 hover:text-white'}`}>
            <RepeatIcon size={16} />
          </button>
        </div>

        {/* Seekbar */}
        <div className="w-full flex items-center gap-3 text-xs font-mono text-zinc-600">
          <span className="w-10 text-right tabular-nums">{formatTime(progress)}</span>

          <div
            className="flex-1 h-1.5 bg-zinc-800 rounded-full cursor-pointer group relative"
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              seekTo((e.clientX - r.left) / r.width);
            }}
          >
            <div
              className="h-full accent-progress rounded-full relative pointer-events-none"
              style={{ width: `${progressPct}%`, willChange: 'width' }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity pointer-events-none" />
            </div>
          </div>

          <button
            className="w-14 text-left tabular-nums hover:accent-text transition-colors select-none"
            onClick={() => setShowRemaining(r => !r)}
            title={showRemaining ? 'Pokaż czas trwania' : 'Pokaż czas pozostały'}
          >
            {showRemaining
              ? formatTimeRemaining(progress, currentSong?.duration)
              : formatTime(currentSong?.duration)}
          </button>
        </div>
      </div>

      {/* ── Głośność ── */}
      <div className="w-[28%] flex justify-end items-center gap-3">
        <button
          onClick={onShowQueue}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
            isQueueOpen
              ? 'accent-border accent-text accent-bg'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
          }`}
        >
          <ListOrdered size={12} /> {queue.length}
        </button>
        <button
          onClick={onMiniPlayer}
          title={isMiniPlayer ? 'Zamknij Mini Player' : 'Mini Player'}
          className={`hidden md:flex p-2 rounded-full border transition-colors ${
            isMiniPlayer
              ? 'accent-border accent-text accent-bg'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
          }`}
        >
          <Minimize2 size={12} />
        </button>

        <button
          onClick={onNowPlaying}
          title={isNowPlaying ? 'Zamknij Now Playing' : 'Now Playing'}
          className={`hidden md:flex p-2 rounded-full border transition-colors ${
            isNowPlaying
              ? 'accent-border accent-text accent-bg'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
          }`}
        >
          <Maximize2 size={12} />
        </button>

        <button
          onClick={onSleepTimer}
          title={sleepRemaining > 0 ? `Sleep Timer: ${Math.ceil(sleepRemaining / 60)} min` : 'Sleep Timer'}
          className={`hidden md:flex p-2 rounded-full border transition-colors relative ${
            sleepRemaining > 0
              ? 'border-indigo-500/50 text-indigo-400 bg-indigo-500/10'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
          }`}
        >
          <Moon size={12} />
          {sleepRemaining > 0 && (
            <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-indigo-500 text-white rounded-full px-1 font-bold leading-tight">
              {Math.ceil(sleepRemaining / 60)}
            </span>
          )}
        </button>

        <div ref={volumeWrapRef} className="flex items-center gap-2">
          <button onClick={() => setIsMuted(m => !m)} className="text-zinc-500 hover:text-white transition-colors">
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range" min="0" max="100"
            value={isMuted ? 0 : volume}
            onChange={e => { setVolume(Number(e.target.value)); setIsMuted(false); }}
            className="w-22 w-[88px] h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
            style={{ accentColor: 'var(--accent-from)' }}
          />
          <span className="text-[10px] text-zinc-700 w-7 tabular-nums">{isMuted ? 0 : volume}%</span>
        </div>
      </div>
    </div>
  );
}

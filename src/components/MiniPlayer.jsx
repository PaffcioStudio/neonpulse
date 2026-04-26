import React, { useRef, useState, useEffect } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, X, Minus,
  Volume2, VolumeX, Repeat, Repeat1, Shuffle, GripHorizontal
} from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER, formatTime } from '../utils';
import { REPEAT_MODES } from '../hooks/usePlayer';
import HeartButton from './HeartButton';

export default function MiniPlayer({
  currentSong, isPlaying, progress, volume, isMuted, repeatMode, isShuffle,
  handlePlayPause, handleNext, handlePrev, seekTo,
  setVolume, setIsMuted, setIsShuffle, cycleRepeat,
  onToggleFavorite, onClose, onExpand, displayList,
}) {
  const dragRef = useRef(null);
  const dragging = useRef(false);
  const offset   = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: window.innerWidth - 440, y: window.innerHeight - 180 });
  const [showVolume, setShowVolume] = useState(false);

  const cover = getCoverSrc(currentSong?.cover);
  const progressPct = currentSong?.duration ? (progress / currentSong.duration) * 100 : 0;
  const RepeatIcon = repeatMode === REPEAT_MODES.ONE ? Repeat1 : Repeat;
  const repeatActive = repeatMode !== REPEAT_MODES.OFF;

  // Dragging logic
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 400, clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 110, clientY - offset.current.y)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const onDragStart = (e) => {
    dragging.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };
    e.preventDefault();
  };

  return (
    <div
      ref={dragRef}
      className="fixed z-[999] select-none"
      style={{ left: pos.x, top: pos.y, width: 400 }}
    >
      <div className="rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.7)] border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-xl">

        {/* Progress bar – top edge */}
        <div className="h-0.5 bg-zinc-800 relative cursor-pointer"
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - r.left) / r.width);
          }}>
          <div className="h-full accent-progress transition-none" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Main row */}
        <div className="flex items-center gap-3 px-3 py-2.5">

          {/* Drag handle */}
          <div
            className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            <GripHorizontal size={14} />
          </div>

          {/* Cover */}
          <img
            src={cover || COVER_PLACEHOLDER(40)}
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 shadow cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onExpand}
          />

          {/* Info */}
          <div className="min-w-0 flex-1 cursor-pointer" onClick={onExpand}>
            <p className="text-xs font-semibold text-white truncate leading-tight">
              {currentSong?.title || 'Nic nie gra'}
            </p>
            <p className="text-[11px] text-zinc-500 truncate mt-0.5">
              {currentSong?.artist || ''}
            </p>
          </div>

          {/* Heart */}
          {currentSong && (
            <HeartButton
              isFavorite={!!currentSong.isFavorite}
              onToggle={() => onToggleFavorite(currentSong.id)}
              size={14}
              className="flex-shrink-0"
            />
          )}

          {/* Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setIsShuffle(p => !p)}
              className={`p-1.5 rounded-lg transition-colors ${isShuffle ? 'accent-text' : 'text-zinc-600 hover:text-zinc-300'}`}>
              <Shuffle size={12} />
            </button>
            <button onClick={handlePrev}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors">
              <SkipBack size={16} />
            </button>
            <button
              onClick={() => handlePlayPause(displayList)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md accent-glow-bg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))' }}
            >
              {isPlaying
                ? <Pause size={14} fill="white" className="text-white" />
                : <Play  size={14} fill="white" className="text-white ml-0.5" />}
            </button>
            <button onClick={handleNext}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors">
              <SkipForward size={16} />
            </button>
            <button onClick={cycleRepeat}
              className={`p-1.5 rounded-lg transition-colors ${repeatActive ? 'accent-text' : 'text-zinc-600 hover:text-zinc-300'}`}>
              <RepeatIcon size={12} />
            </button>
          </div>

          {/* Volume toggle */}
          <button
            onClick={() => setShowVolume(v => !v)}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            {isMuted || volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>

          {/* Close */}
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
            <X size={13} />
          </button>
        </div>

        {/* Volume row – collapsible */}
        {showVolume && (
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <button onClick={() => setIsMuted(m => !m)} className="text-zinc-500 hover:text-white transition-colors">
              {isMuted || volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <input
              type="range" min="0" max="100"
              value={isMuted ? 0 : volume}
              onChange={e => { setVolume(Number(e.target.value)); setIsMuted(false); }}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer bg-zinc-800"
              style={{ accentColor: 'var(--accent-from)' }}
            />
            <span className="text-[10px] text-zinc-600 w-7 tabular-nums text-right">
              {isMuted ? 0 : volume}%
            </span>
            <span className="text-[10px] text-zinc-700 tabular-nums">
              {formatTime(progress)} / {formatTime(currentSong?.duration)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

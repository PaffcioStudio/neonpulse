import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle,
         Volume2, VolumeX, ListOrdered, Maximize2, Moon, Star, SlidersHorizontal, Radio, Square, Loader2 } from 'lucide-react';
import { formatTime, formatTimeRemaining, getCoverSrc, COVER_PLACEHOLDER } from '../utils';
import { REPEAT_MODES } from '../hooks/usePlayer';
import HeartButton from './HeartButton';

export default function PlayerBar({
  currentSong, isPlaying, progress, volume, isMuted, repeatMode, isShuffle,
  queue, setIsMuted, setVolume, setIsShuffle, cycleRepeat,
  handlePlayPause, handleNext, handlePrev, seekTo, handleVolumeScroll,
  onToggleFavorite, onShowQueue, isQueueOpen, onGoHome, onGoAlbum, onGoArtist, displayList,
  settings,
  onNowPlaying, isNowPlaying, onSleepTimer, sleepRemaining,
  onRatingChange, onEqualizer, isEqualizerOpen,
  radio, onGoRadio,
}) {
  const { t } = useTranslation(['common', 'player', 'radio']);
  const [showRemaining, setShowRemaining] = useState(false);
  const volumeWrapRef = useRef(null);
  const progressPct = currentSong?.duration ? (progress / currentSong.duration) * 100 : 0;
  const RepeatIcon = repeatMode === REPEAT_MODES.ONE ? Repeat1 : Repeat;
  const repeatActive = repeatMode !== REPEAT_MODES.OFF;

  // Gdy stacja radiowa aktualnie gra, cały pasek przełącza się w tryb radiowy:
  // brak sensu w seek/next/prev/EQ dla strumienia live, więc pokazujemy
  // uproszczone info + play/stop. Głośność działa tak samo (na audio radiowym).
  const radioActive = !!(radio?.currentStation && radio?.isPlaying);

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
        {radioActive ? (
          <>
            <div
              className="w-[52px] h-[52px] rounded-lg flex items-center justify-center flex-shrink-0 shadow-md cursor-pointer bg-emerald-500/10 border border-emerald-500/30 overflow-hidden"
              onClick={onGoRadio}
            >
              {radio.currentStation.favicon
                ? <img src={radio.currentStation.favicon} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                : null}
              <Radio size={22} className="text-emerald-400" style={{ display: radio.currentStation.favicon ? 'none' : 'flex' }} />
            </div>
            <div className="overflow-hidden">
              <h4
                className="font-semibold text-sm truncate cursor-pointer hover:accent-text transition-colors leading-tight"
                onClick={onGoRadio}
              >
                {radio.currentStation.name}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                <p className="text-xs text-zinc-500 truncate">
                  {radio.nowPlaying?.title
                    ? (radio.nowPlaying.artist ? `${radio.nowPlaying.artist} — ${radio.nowPlaying.title}` : radio.nowPlaying.title)
                    : t('liveNow', { ns: 'radio' })}
                </p>
              </div>
            </div>
          </>
        ) : currentSong ? (
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
                onClick={onGoAlbum}
                title={currentSong.album ? `${t('album', { ns: 'common' })}: ${currentSong.album}` : t('album', { ns: 'common' })}
              >
                {currentSong.title}
              </h4>
              <button
                type="button"
                className="block max-w-full text-xs text-zinc-500 truncate mt-0.5 hover:accent-text transition-colors text-left"
                onClick={onGoArtist}
                title={currentSong.artist ? `${t('artist', { ns: 'common' })}: ${currentSong.artist}` : t('artist', { ns: 'common' })}
              >
                {currentSong.artist}
              </button>
            </div>
            <HeartButton
              isFavorite={!!currentSong.isFavorite}
              onToggle={() => onToggleFavorite(currentSong.id)}
              size={17}
              className="ml-1 flex-shrink-0"
            />
            {/* Gwiazdki – ocena */}
            <div className="hidden sm:flex items-center gap-0.5 ml-2 flex-shrink-0">
              {[1,2,3,4,5].map(n => {
                const filled = n <= (currentSong.rating || 0);
                return (
                  <button
                    key={n}
                    onClick={() => onRatingChange?.(currentSong.id, n === currentSong.rating ? 0 : n)}
                    title={`${n} ${t('star', { ns: 'player' })}`}
                    className="group/star relative transition-transform hover:scale-125 active:scale-95 duration-100"
                    style={{ transition: 'transform 120ms cubic-bezier(0.34,1.56,0.64,1)' }}
                  >
                    <Star
                      size={13}
                      className={`transition-all duration-150 ${
                        filled
                          ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]'
                          : 'text-zinc-700 group-hover/star:text-zinc-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-700">{t('nothingPlaying', { ns: 'player' })}</p>
        )}
      </div>

      {/* ── Kontrolki + pasek ── */}
      <div className="flex flex-col items-center w-[44%]">
        {radioActive ? (
          <div className="flex items-center gap-5">
            <button
              onClick={() => radio.toggle(radio.currentStation)}
              className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg accent-glow-bg"
              style={{ background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))' }}
            >
              {radio.isLoading
                ? <Loader2 size={18} className="animate-spin text-white" />
                : <Square size={16} fill="white" className="text-white" />}
            </button>
            <span className="text-[11px] text-zinc-600 uppercase tracking-wide">{t('liveNow', { ns: 'radio' })}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-5 mb-2">
              <button onClick={() => setIsShuffle(p => !p)} title={t('shuffle', { ns: 'player' })}
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
              <button onClick={cycleRepeat} title={t('repeatMode', { ns: 'player', mode: repeatMode })}
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
                  className={`h-full accent-progress rounded-full relative pointer-events-none ${
                    isPlaying && settings?.animationsEnabled ? 'progress-pulse' : ''
                  }`}
                  style={{ width: `${progressPct}%`, willChange: 'width' }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity pointer-events-none" />
                </div>
              </div>

              <button
                className="w-14 text-left tabular-nums hover:accent-text transition-colors select-none"
                onClick={() => setShowRemaining(r => !r)}
                title={showRemaining ? t('showDuration', { ns: 'player' }) : t('showRemaining', { ns: 'player' })}
              >
                {showRemaining
                  ? formatTimeRemaining(progress, currentSong?.duration)
                  : formatTime(currentSong?.duration)}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Głośność ── */}
      <div className="w-[28%] flex justify-end items-center gap-3">
        {!radioActive && (
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
        )}
        {!radioActive && (settings?.showBtnNowPlaying ?? false) && (
          <button
            onClick={onNowPlaying}
            title={isNowPlaying ? t('closeNowPlaying', { ns: 'player' }) : t('openNowPlaying', { ns: 'player' })}
            className={`hidden md:flex p-2 rounded-full border transition-colors ${
              isNowPlaying
                ? 'accent-border accent-text accent-bg'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
            }`}
          >
            <Maximize2 size={12} />
          </button>
        )}

        {!radioActive && (settings?.showBtnSleepTimer ?? true) && (
          <button
            onClick={onSleepTimer}
            title={sleepRemaining > 0 ? `${t('sleepTimer', { ns: 'player' })}: ${Math.ceil(sleepRemaining / 60)} min` : t('sleepTimer', { ns: 'player' })}
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
        )}

        {!radioActive && (settings?.showBtnEqualizer ?? true) && (
          <button
            onClick={onEqualizer}
            title={isEqualizerOpen ? t('closeEqualizer', { ns: 'player' }) : t('equalizer', { ns: 'player' })}
            className={`hidden md:flex p-2 rounded-full border transition-colors ${
              isEqualizerOpen
                ? 'accent-border accent-text accent-bg'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-white'
            }`}
          >
            <SlidersHorizontal size={12} />
          </button>
        )}

        <div ref={volumeWrapRef} className="flex items-center gap-2">
          <button
            onClick={() => radioActive ? radio.setIsMuted(m => !m) : setIsMuted(m => !m)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            {(radioActive ? (radio.isMuted || radio.volume === 0) : (isMuted || volume === 0))
              ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range" min="0" max="100"
            value={radioActive ? (radio.isMuted ? 0 : radio.volume) : (isMuted ? 0 : volume)}
            onChange={e => {
              const v = Number(e.target.value);
              if (radioActive) { radio.setVolume(v); radio.setIsMuted(false); }
              else { setVolume(v); setIsMuted(false); }
            }}
            className="w-22 w-[88px] h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
            style={{ accentColor: 'var(--accent-from)' }}
          />
          <span className="text-[10px] text-zinc-700 w-7 tabular-nums">
            {radioActive ? (radio.isMuted ? 0 : radio.volume) : (isMuted ? 0 : volume)}%
          </span>
        </div>
      </div>
    </div>
  );
}

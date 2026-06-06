import React, { useCallback, memo, useState, useMemo, useEffect, useRef } from 'react';
import { Play, Volume2, Heart, MoreVertical, Music2, ChevronUp, ChevronDown, ChevronsUpDown, Star, Tag } from 'lucide-react';
import { formatTime, getCoverSrc, COVER_PLACEHOLDER } from '../../utils';

const TrackRow = memo(function TrackRow({ song, index, isCurrent, isPlaying, compact, selected, onPlay, onFavorite, onContextMenu, onSelect, rowRef }) {
  return (
    <div
      ref={rowRef}
      className={`relative flex items-center gap-3 px-3 rounded-lg cursor-pointer group transition-all border ${
        compact ? 'py-1.5' : 'py-2.5'
      } ${
        selected
          ? 'bg-white/[0.055] border-accent/45 shadow-[inset_3px_0_0_var(--accent-from)]'
          : isCurrent
          ? 'bg-white/[0.05] border-white/[0.08] accent-border-subtle'
          : 'border-transparent hover:bg-white/[0.04] hover:border-white/[0.04]'
      }`}
      onClick={e => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) { e.preventDefault(); onSelect?.(); }
        else onPlay();
      }}
      onContextMenu={onContextMenu}
    >
      {/* Numer / play / checkbox */}
      <div className="w-7 text-center flex-shrink-0 flex items-center justify-center">
        {selected ? (
          <div className="w-4 h-4 rounded-md accent-gradient flex items-center justify-center shadow-[0_0_10px_var(--accent-glow)]">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        ) : isCurrent && isPlaying ? (
          <Volume2 size={13} className="accent-text animate-pulse" />
        ) : isCurrent ? (
          <Volume2 size={13} className="accent-text opacity-60" />
        ) : (
          <>
            <span className="text-zinc-600 text-xs group-hover:hidden">{index + 1}</span>
            <Play size={11} fill="currentColor" className="text-zinc-400 hidden group-hover:block" />
          </>
        )}
      </div>

      {/* Okładka */}
      {!compact && (
        <img
          src={getCoverSrc(song.cover)}
          onError={e => { e.target.src = COVER_PLACEHOLDER(); }}
          alt=""
          className="w-9 h-9 rounded object-cover flex-shrink-0 border border-zinc-800"
        />
      )}

      {/* Tytuł */}
      <div className={`min-w-0 ${compact ? 'w-[35%]' : 'w-[30%]'} flex-shrink-0`}>
        <div className={`font-medium truncate ${isCurrent ? 'accent-text' : 'text-white'} ${compact ? 'text-xs' : 'text-sm'}`}>
          {song.title || song.path?.split('/').pop()}
        </div>
        {/* Gwiazdki – tylko gdy rating > 0 */}
        {song.rating > 0 && (
          <div className="flex gap-px mt-0.5">
            {[1,2,3,4,5].map(n => (
              <Star key={n} size={8} className={n <= song.rating ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-800'} />
            ))}
          </div>
        )}
      </div>

      {/* Artysta */}
      <div className="hidden sm:block min-w-0 w-[22%] flex-shrink-0">
        <div className="text-zinc-500 text-xs truncate">{song.artist || '—'}</div>
      </div>

      {/* Album */}
      <div className="hidden md:block min-w-0 flex-1">
        <div className="text-zinc-600 text-xs truncate">{song.album || ''}</div>
      </div>

      {/* Rok */}
      <div className="hidden lg:block w-10 text-right text-xs text-zinc-600 flex-shrink-0">
        {song.year || ''}
      </div>

      {/* Czas */}
      <div className="w-9 text-right text-xs text-zinc-500 flex-shrink-0 tabular-nums">
        {formatTime(song.duration)}
      </div>

      {/* Akcje */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e => { e.stopPropagation(); onFavorite(); }}
          className={`p-1.5 rounded transition-colors ${song.isFavorite ? 'text-red-400' : 'text-zinc-600 hover:text-zinc-300'}`}>
          <Heart size={12} fill={song.isFavorite ? 'currentColor' : 'none'} />
        </button>
        <button onClick={e => { e.stopPropagation(); onContextMenu(e); }} className="text-zinc-700 hover:text-zinc-300 transition-colors p-1.5">
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  );
});

function SortHeader({ label, field, sort, onSort, className = '' }) {
  const active = sort.field === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors select-none ${
        active ? 'text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'
      } ${className}`}
    >
      {label}
      {active
        ? sort.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
        : <ChevronsUpDown size={10} className="opacity-30" />}
    </button>
  );
}

export default function TrackList({ songs, currentSong, isPlaying, compact, onPlay, onFavorite, onContextMenu, emptyMessage, showSort = true, onBulkEdit, autoScrollCurrent = false, animationsEnabled = true }) {
  const [sort, setSort] = useState({ field: null, dir: 'asc' });
  const [selected, setSelected] = useState(new Set());
  const currentRowRef = useRef(null);
  const didAutoScrollRef = useRef(false);

  const handleSort = (field) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    );
  };

  const sorted = useMemo(() => {
    if (!sort.field) return songs;
    return [...songs].sort((a, b) => {
      let va = a[sort.field] ?? '';
      let vb = b[sort.field] ?? '';
      if (sort.field === 'duration' || sort.field === 'year') {
        va = Number(va) || 0; vb = Number(vb) || 0;
        return sort.dir === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
      return sort.dir === 'asc' ? va.localeCompare(vb, 'pl') : vb.localeCompare(va, 'pl');
    });
  }, [songs, sort]);

  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => setSelected(new Set());
  const selectedSongs = sorted.filter(s => selected.has(s.id));

  useEffect(() => {
    if (!autoScrollCurrent || !currentSong?.id || didAutoScrollRef.current) return;
    if (!sorted.some(s => s.id === currentSong.id)) return;
    didAutoScrollRef.current = true;
    setTimeout(() => {
      currentRowRef.current?.scrollIntoView({
        block: 'center',
        behavior: animationsEnabled ? 'smooth' : 'auto',
      });
    }, 80);
  }, [autoScrollCurrent, currentSong?.id, sorted, animationsEnabled]);

  const handlePlay = useCallback((song) => {
    setSelected(new Set());
    onPlay(song);
  }, [onPlay]);

  if (songs.length === 0) {
    return (
      <div className="text-center text-zinc-600 py-24">
        <Music2 size={48} className="mx-auto mb-4 opacity-20" />
        <p className="text-sm">{emptyMessage || 'Brak utworów.'}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Pasek zaznaczenia wielu */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-zinc-900/80 border border-accent/35 rounded-xl text-xs shadow-[0_0_18px_rgba(0,0,0,0.25)]">
          <span className="accent-text font-semibold">{selected.size} zaznaczonych</span>
          <button onClick={() => onBulkEdit?.(selectedSongs)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg accent-gradient text-white font-medium">
            <Tag size={11} /> Edytuj tagi
          </button>
          <button onClick={clearSelection} className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors">
            Anuluj
          </button>
        </div>
      )}

      {showSort && (
        <div className="flex items-center gap-3 px-3 pb-2 border-b border-zinc-800/50 mb-1">
          <div className="w-7 flex-shrink-0" />
          {!compact && <div className="w-9 flex-shrink-0" />}
          <SortHeader label="Tytuł" field="title" sort={sort} onSort={handleSort}
            className={compact ? 'w-[35%] flex-shrink-0' : 'w-[30%] flex-shrink-0'} />
          <SortHeader label="Artysta" field="artist" sort={sort} onSort={handleSort}
            className="hidden sm:flex w-[22%] flex-shrink-0" />
          <SortHeader label="Album" field="album" sort={sort} onSort={handleSort}
            className="hidden md:flex flex-1" />
          <SortHeader label="Rok" field="year" sort={sort} onSort={handleSort}
            className="hidden lg:flex w-10 justify-end" />
          <SortHeader label="Czas" field="duration" sort={sort} onSort={handleSort}
            className="w-9 justify-end" />
          <div className="w-14 flex-shrink-0" />
        </div>
      )}
      <p className="text-[10px] text-zinc-700 px-3 mb-1">Ctrl+klik aby zaznaczyć wiele</p>
      <div className="space-y-0.5">
        {sorted.map((song, i) => (
          <TrackRow
            key={song.id}
            song={song}
            index={i}
            isCurrent={currentSong?.id === song.id}
            isPlaying={isPlaying}
            compact={compact}
            selected={selected.has(song.id)}
            rowRef={currentSong?.id === song.id ? currentRowRef : null}
            onPlay={() => handlePlay(song)}
            onFavorite={() => onFavorite(song.id)}
            onContextMenu={e => onContextMenu(e, song)}
            onSelect={() => toggleSelect(song.id)}
          />
        ))}
      </div>
    </div>
  );
}

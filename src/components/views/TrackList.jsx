import React, { useCallback, memo, useState, useMemo } from 'react';
import { Play, Volume2, Heart, MoreVertical, Music2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { formatTime, getCoverSrc, COVER_PLACEHOLDER } from '../../utils';

const TrackRow = memo(function TrackRow({ song, index, isCurrent, isPlaying, compact, onPlay, onFavorite, onContextMenu }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 rounded-lg cursor-pointer group transition-colors border ${
        compact ? 'py-1.5' : 'py-2.5'
      } ${
        isCurrent
          ? 'bg-white/[0.05] border-white/[0.08] accent-border-subtle'
          : 'border-transparent hover:bg-white/[0.04] hover:border-white/[0.04]'
      }`}
      onClick={onPlay}
      onContextMenu={onContextMenu}
    >
      {/* Numer / play indicator */}
      <div className="w-7 text-center flex-shrink-0 flex items-center justify-center">
        {isCurrent && isPlaying ? (
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

export default function TrackList({ songs, currentSong, isPlaying, compact, onPlay, onFavorite, onContextMenu, emptyMessage, showSort = true }) {
  const [sort, setSort] = useState({ field: null, dir: 'asc' });

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

  const handlePlay = useCallback((song) => onPlay(song), [onPlay]);

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
      <div className="space-y-0.5">
        {sorted.map((song, i) => (
          <TrackRow
            key={song.id}
            song={song}
            index={i}
            isCurrent={currentSong?.id === song.id}
            isPlaying={isPlaying}
            compact={compact}
            onPlay={() => handlePlay(song)}
            onFavorite={() => onFavorite(song.id)}
            onContextMenu={e => onContextMenu(e, song)}
          />
        ))}
      </div>
    </div>
  );
}

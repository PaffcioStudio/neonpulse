import React from 'react';
import { Play, Shuffle, ArrowLeft } from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER, pluralTracks, formatTime } from '../../utils';
import TrackList from './TrackList';

export default function AlbumDetailView({ album, songs, currentSong, isPlaying, compact, onPlay, onBack, onFavorite, onContextMenu }) {
  const cover = getCoverSrc(songs[0]?.cover);
  const totalDuration = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
  const year = songs[0]?.year;

  return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-5 text-sm">
        <ArrowLeft size={16} /> Wszystkie albumy
      </button>

      {/* Hero albumu */}
      <div className="flex items-end gap-6 mb-8">
        <div className="relative flex-shrink-0">
          {cover && (
            <div className="absolute -inset-4 rounded-2xl blur-2xl opacity-25"
              style={{ backgroundImage: `url(${cover})`, backgroundSize: 'cover' }} />
          )}
          <img
            src={cover || COVER_PLACEHOLDER(160)}
            className="relative w-36 h-36 md:w-44 md:h-44 rounded-2xl object-cover border border-white/10 shadow-2xl"
            alt={album}
          />
        </div>
        <div className="flex-1 min-w-0 pb-1">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Album</p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight">{album}</h1>
          <p className="text-sm text-zinc-400 mt-1 font-medium">{songs[0]?.artist}</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {year > 0 ? `${year} • ` : ''}{pluralTracks(songs.length)} • {formatTime(totalDuration)}
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onPlay(songs[0], songs)}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold accent-gradient hover:opacity-90 shadow-md transition-all"
            >
              <Play size={14} className="ml-0.5" /> Odtwórz
            </button>
            <button
              onClick={() => {
                const shuffled = [...songs].sort(() => Math.random() - 0.5);
                onPlay(shuffled[0], shuffled);
              }}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold transition-colors"
            >
              <Shuffle size={14} /> Losowo
            </button>
          </div>
        </div>
      </div>

      <TrackList
        songs={songs}
        currentSong={currentSong}
        isPlaying={isPlaying}
        compact={compact}
        onPlay={song => onPlay(song, songs)}
        onFavorite={onFavorite}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

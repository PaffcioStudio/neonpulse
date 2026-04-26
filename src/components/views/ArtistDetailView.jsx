import React, { useMemo } from 'react';
import { Play, Shuffle, ArrowLeft, Music2 } from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER, pluralTracks } from '../../utils';
import TrackList from './TrackList';

export default function ArtistDetailView({ artist, songs, currentSong, isPlaying, compact, onPlay, onBack, onFavorite, onContextMenu }) {
  const albums = useMemo(() => {
    const g = {};
    songs.forEach(s => {
      const k = s.album || 'Nieznany album';
      if (!g[k]) g[k] = { name: k, cover: s.cover, songs: [] };
      g[k].songs.push(s);
    });
    return Object.values(g).sort((a, b) => {
      const ya = a.songs[0]?.year || 0, yb = b.songs[0]?.year || 0;
      return yb - ya;
    });
  }, [songs]);

  const cover = getCoverSrc(songs[0]?.cover);

  return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-5 text-sm">
        <ArrowLeft size={16} /> Wszyscy artyści
      </button>

      {/* Hero artysty */}
      <div className="flex items-end gap-6 mb-8">
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-2 rounded-full blur-xl opacity-30" style={{ background: 'var(--accent-from)' }} />
          <img
            src={cover || COVER_PLACEHOLDER(120)}
            className="relative w-28 h-28 rounded-full object-cover border-2 border-white/10 shadow-2xl"
            alt={artist}
          />
        </div>
        <div className="flex-1 min-w-0 pb-1">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Artysta</p>
          <h1 className="text-4xl md:text-5xl font-black truncate">{artist}</h1>
          <p className="text-sm text-zinc-500 mt-1">{pluralTracks(songs.length)} • {albums.length} {albums.length === 1 ? 'album' : 'albumów'}</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onPlay(songs[0], songs)}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold accent-gradient hover:opacity-90 shadow-md transition-all"
            >
              <Play size={14} className="ml-0.5" /> Odtwórz wszystko
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

      {/* Albumy artysty */}
      {albums.map(album => (
        <div key={album.name} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={getCoverSrc(album.cover) || COVER_PLACEHOLDER(40)}
              className="w-10 h-10 rounded-lg object-cover shadow-md"
              alt={album.name}
            />
            <div>
              <h2 className="font-bold text-base">{album.name}</h2>
              {album.songs[0]?.year > 0 && (
                <p className="text-xs text-zinc-600">{album.songs[0].year} • {pluralTracks(album.songs.length)}</p>
              )}
            </div>
            <button
              onClick={() => onPlay(album.songs[0], album.songs)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs transition-colors"
            >
              <Play size={12} /> Odtwórz album
            </button>
          </div>
          <TrackList
            songs={album.songs}
            currentSong={currentSong}
            isPlaying={isPlaying}
            compact={compact}
            onPlay={song => onPlay(song, album.songs)}
            onFavorite={onFavorite}
            onContextMenu={onContextMenu}
          />
        </div>
      ))}
    </div>
  );
}

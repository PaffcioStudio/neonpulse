import React, { useMemo, useState } from 'react';
import { Tag, Play, Shuffle, ArrowLeft } from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER, pluralTracks } from '../../utils';
import TrackList from './TrackList';

const GENRE_COLORS = [
  ['#d946ef','#6366f1'], ['#06b6d4','#3b82f6'], ['#22c55e','#10b981'],
  ['#f97316','#f59e0b'], ['#f43f5e','#ec4899'], ['#8b5cf6','#6366f1'],
  ['#14b8a6','#06b6d4'], ['#f59e0b','#ef4444'],
];

export default function GenresView({ library, currentSong, isPlaying, compact, onPlay, onFavorite, onContextMenu }) {
  const [selectedGenre, setSelectedGenre] = useState(null);

  const genres = useMemo(() => {
    const map = {};
    library.forEach(s => {
      const g = (s.genre || 'Inne').trim();
      if (!map[g]) map[g] = [];
      map[g].push(s);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [library]);

  if (selectedGenre) {
    const [name, songs] = selectedGenre;
    const colorIdx = genres.findIndex(([n]) => n === name);
    const [from] = GENRE_COLORS[colorIdx % GENRE_COLORS.length];
    return (
      <div className="p-6">
        <button onClick={() => setSelectedGenre(null)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-5 text-sm">
          <ArrowLeft size={16} /> Wszystkie gatunki
        </button>
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${from}44, #000)` }}>
            <Tag size={28} style={{ color: from }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-0.5">Gatunek</p>
            <h1 className="text-3xl font-black">{name}</h1>
            <p className="text-xs text-zinc-500 mt-0.5">{pluralTracks(songs.length)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onPlay(songs[0], songs)} className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold accent-gradient hover:opacity-90 shadow-md transition-all">
              <Play size={14} className="ml-0.5" /> Odtwórz
            </button>
            <button onClick={() => { const s=[...songs].sort(()=>Math.random()-0.5); onPlay(s[0],s); }} className="flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold transition-colors">
              <Shuffle size={14} /> Losowo
            </button>
          </div>
        </div>
        <TrackList songs={songs} currentSong={currentSong} isPlaying={isPlaying} compact={compact}
          onPlay={song => onPlay(song, songs)} onFavorite={onFavorite} onContextMenu={onContextMenu} />
      </div>
    );
  }

  if (genres.length === 0) {
    return (
      <div className="p-6 text-center text-zinc-600 py-24">
        <Tag size={48} className="mx-auto mb-3 opacity-20" /><p>Brak gatunków w bibliotece</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-3xl font-black uppercase tracking-tight mb-1">Gatunki</h2>
      <p className="text-xs text-zinc-500 mb-6">{genres.length} gatunków</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {genres.map(([name, songs], idx) => {
          const [from, to] = GENRE_COLORS[idx % GENRE_COLORS.length];
          const covers = [...new Set(songs.map(s => s.cover).filter(Boolean))].slice(0, 4);
          const isCurrentGenre = currentSong && songs.some(s => s.id === currentSong.id);
          return (
            <div key={name} onClick={() => setSelectedGenre([name, songs])}
              className={`group relative cursor-pointer rounded-2xl overflow-hidden border transition-all hover:scale-[1.02] hover:shadow-xl ${isCurrentGenre ? 'border-white/20' : 'border-zinc-800/60 hover:border-zinc-700'}`}>
              <div className="aspect-square relative">
                {covers.length >= 4 ? (
                  <div className="grid grid-cols-2 w-full h-full">
                    {covers.slice(0,4).map((c,i) => <img key={i} src={getCoverSrc(c)} className="w-full h-full object-cover" loading="lazy" alt="" />)}
                  </div>
                ) : covers.length > 0 ? (
                  <img src={getCoverSrc(covers[0])} className="w-full h-full object-cover" loading="lazy" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                    <Tag size={32} className="text-white/60" />
                  </div>
                )}
                <div className="absolute inset-0 opacity-60 group-hover:opacity-80 transition-opacity" style={{ background: `linear-gradient(to top, ${from}cc 0%, transparent 60%)` }} />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                    <Play size={20} className="text-black ml-0.5" fill="black" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="font-bold text-sm text-white leading-tight truncate drop-shadow">{name}</h3>
                <p className="text-[11px] text-white/60 mt-0.5">{pluralTracks(songs.length)}</p>
              </div>
              {isCurrentGenre && <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ background: from }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

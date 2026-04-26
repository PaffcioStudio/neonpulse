import React, { useState, useRef, useCallback } from 'react';
import {
  Play, SkipForward, ListOrdered, Heart, HeartOff,
  Users, Disc3, ListPlus, ChevronRight, Plus, Check, Tag
} from 'lucide-react';

export default function ContextMenu({ x, y, song, onAction, playlists = [] }) {
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [newPlName, setNewPlName]         = useState('');
  const [showNewPl, setShowNewPl]         = useState(false);
  const [justAdded, setJustAdded]         = useState(null);
  const hideTimer = useRef(null);

  if (!song) return null;

  const top  = Math.min(y, window.innerHeight - 400);
  const left = Math.min(x, window.innerWidth  - 240);

  const openSub  = () => { clearTimeout(hideTimer.current); setShowPlaylists(true); };
  const closeSub = () => { hideTimer.current = setTimeout(() => setShowPlaylists(false), 120); };

  const handleAddToExisting = (plId) => {
    setJustAdded(plId);
    onAction(`add-pl-${plId}`);
    setTimeout(() => setJustAdded(null), 1200);
  };

  const handleCreateAndAdd = (e) => {
    e.stopPropagation();
    const name = newPlName.trim();
    if (!name) return;
    onAction(`new-pl:${name}`);
    setNewPlName('');
    setShowNewPl(false);
    setShowPlaylists(false);
  };

  const subLeft = left + 224 + 4 > window.innerWidth ? -192 : '100%';

  return (
    <div
      style={{ top, left }}
      className="fixed z-[100] bg-zinc-900 border border-zinc-700/70 rounded-xl shadow-2xl w-56 overflow-visible text-sm"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-zinc-800">
        <div className="font-semibold text-sm truncate text-white">{song.title}</div>
        <div className="text-[11px] text-zinc-500 truncate mt-0.5">{song.artist}</div>
      </div>

      <div className="py-1">
        {/* Główne akcje */}
        {[
          ['play-now',  <Play size={13}/>,        'Odtwórz teraz'],
          ['play-next', <SkipForward size={13}/>, 'Odtwórz jako następny'],
          ['add-queue', <ListOrdered size={13}/>, 'Dodaj do kolejki'],
        ].map(([action, icon, label]) => (
          <button key={action} onClick={() => onAction(action)}
            className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 flex items-center gap-2.5 transition-colors">
            <span className="text-zinc-500">{icon}</span>{label}
          </button>
        ))}

        {/* Dodaj do playlisty – submenu */}
        <div className="relative">
          <button
            onMouseEnter={openSub}
            onMouseLeave={closeSub}
            className={`w-full text-left px-3 py-2 text-zinc-200 flex items-center gap-2.5 transition-colors ${showPlaylists ? 'bg-white/[0.07]' : 'hover:bg-white/[0.07]'}`}
          >
            <span className="text-zinc-500"><ListPlus size={13}/></span>
            Dodaj do playlisty
            <ChevronRight size={11} className={`ml-auto transition-transform duration-150 ${showPlaylists ? 'rotate-90 text-zinc-400' : 'text-zinc-600'}`} />
          </button>

          {showPlaylists && (
            <div
              onMouseEnter={openSub}
              onMouseLeave={closeSub}
              style={{ left: subLeft }}
              className="absolute top-0 w-52 bg-zinc-900 border border-zinc-700/70 rounded-xl shadow-2xl py-1 ml-1 z-[110]"
            >
              {/* Istniejące playlisty */}
              {playlists.length > 0 ? (
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {playlists.map(pl => (
                    <button key={pl.id} onClick={() => handleAddToExisting(pl.id)}
                      className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 text-xs flex items-center gap-2 transition-colors">
                      {justAdded === pl.id
                        ? <Check size={12} className="text-green-400 flex-shrink-0" />
                        : <ListPlus size={11} className="text-zinc-600 flex-shrink-0" />}
                      <span className="truncate">{pl.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 px-3 py-2">Brak playlist</p>
              )}

              {/* Nowa playlista */}
              <div className="border-t border-zinc-800 mt-1 pt-1">
                {showNewPl ? (
                  <div className="px-2 py-1.5 flex gap-1" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={newPlName}
                      onChange={e => setNewPlName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateAndAdd(e);
                        if (e.key === 'Escape') { setShowNewPl(false); setNewPlName(''); }
                      }}
                      placeholder="Nazwa playlisty…"
                      className="flex-1 bg-black/40 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                    />
                    <button
                      onClick={handleCreateAndAdd}
                      disabled={!newPlName.trim()}
                      className="px-2 py-1 rounded-lg accent-gradient text-xs font-semibold disabled:opacity-40"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setShowNewPl(true); }}
                    className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-400 hover:text-white text-xs flex items-center gap-2 transition-colors"
                  >
                    <Plus size={12} className="text-zinc-500" />
                    Nowa playlista…
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ulubione */}
        <button onClick={() => onAction('toggle-fav')}
          className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 flex items-center gap-2.5 transition-colors">
          <span className="text-zinc-500">
            {song.isFavorite ? <HeartOff size={13}/> : <Heart size={13}/>}
          </span>
          {song.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
        </button>

        <div className="border-t border-zinc-800 my-1" />

        {/* Nawigacja */}
        {[
          ['go-artist', <Users size={13}/>,  'Przejdź do artysty'],
          ['go-album',  <Disc3 size={13}/>,  'Przejdź do albumu'],
        ].map(([action, icon, label]) => (
          <button key={action} onClick={() => onAction(action)}
            className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 flex items-center gap-2.5 transition-colors">
            <span className="text-zinc-500">{icon}</span>{label}
          </button>
        ))}

        <div className="border-t border-zinc-800 my-1" />

        {/* Edycja */}
        <button onClick={() => onAction('edit-tags')}
          className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 flex items-center gap-2.5 transition-colors">
          <span className="text-zinc-500"><Tag size={13}/></span>
          Edytuj tagi…
        </button>
        <button onClick={() => onAction('fetch-cover')}
          className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 flex items-center gap-2.5 transition-colors">
          <span className="text-zinc-500"><Disc3 size={13}/></span>
          Pobierz okładkę…
        </button>
      </div>
    </div>
  );
}

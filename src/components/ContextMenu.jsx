import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play, SkipForward, ListOrdered, Heart, HeartOff,
  Users, Disc3, ListPlus, ChevronRight, Plus, Check, Tag,
  FolderOpen, Copy, Star
} from 'lucide-react';

export default function ContextMenu({ x, y, song, onAction, playlists = [], onRatingChange }) {
  const { t } = useTranslation(['common', 'library', 'player']);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [newPlName, setNewPlName]         = useState('');
  const [showNewPl, setShowNewPl]         = useState(false);
  const [justAdded, setJustAdded]         = useState(null);
  const [localRating, setLocalRating]     = useState(song?.rating || 0);
  const [pos, setPos]                     = useState({ top: y, left: x });
  const menuRef  = useRef(null);
  const hideTimer = useRef(null);

  // Sync jeśli song się zmieni (nowe otwarcie menu)
  React.useEffect(() => { setLocalRating(song?.rating || 0); }, [song?.id, song?.rating]);

  // Po wyrenderowaniu mierzymy rzeczywistą wysokość i korygujemy pozycję
  React.useEffect(() => {
    if (!menuRef.current) return;
    const { offsetWidth: mw, offsetHeight: mh } = menuRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 8;
    setPos({
      top:  Math.min(y, vh - mh - MARGIN),
      left: Math.min(x, vw - mw - MARGIN),
    });
  }, [x, y]);

  if (!song) return null;

  const subLeft = pos.left + 224 + 4 > window.innerWidth ? -192 : '100%';

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

  return (
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left }}
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
          ['play-now',  <Play size={13}/>,        t('playNow', { ns: 'player' })],
          ['play-next', <SkipForward size={13}/>, t('playNext', { ns: 'player' })],
          ['add-queue', <ListOrdered size={13}/>, t('addToQueue', { ns: 'common' })],
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
            {t('addToPlaylist', { ns: 'common' })}
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
                <p className="text-xs text-zinc-600 px-3 py-2">{t('noPlaylists', { ns: 'common' })}</p>
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
                      placeholder={t('playlistNamePlaceholder', { ns: 'library' })}
                      className="flex-1 bg-black/40 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                    />
                    <button
                      onClick={handleCreateAndAdd}
                      disabled={!newPlName.trim()}
                      className="px-2 py-1 rounded-lg accent-gradient text-xs font-semibold disabled:opacity-40"
                    >
                      {t('ok', { ns: 'common' })}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setShowNewPl(true); }}
                    className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-400 hover:text-white text-xs flex items-center gap-2 transition-colors"
                  >
                    <Plus size={12} className="text-zinc-500" />
                    {t('newPlaylist', { ns: 'library' })}…
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
          {song.isFavorite ? t('removeFromFavorites', { ns: 'common' }) : t('addToFavorites', { ns: 'common' })}
        </button>

        <div className="border-t border-zinc-800 my-1" />

        {/* Nawigacja */}
        {[
          ['go-artist', <Users size={13}/>,  t('goToArtist', { ns: 'library' })],
          ['go-album',  <Disc3 size={13}/>,  t('goToAlbum', { ns: 'library' })],
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
          {t('editTags', { ns: 'library' })}…
        </button>
        <button onClick={() => onAction('fetch-cover')}
          className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 flex items-center gap-2.5 transition-colors">
          <span className="text-zinc-500"><Disc3 size={13}/></span>
          {t('downloadCover', { ns: 'library' })}…
        </button>

        <div className="border-t border-zinc-800 my-1" />

        {/* Ocena */}
        <div className="px-3 py-2 flex items-center gap-1.5">
          <span className="text-zinc-600 text-xs mr-1">{t('rating', { ns: 'common' })}:</span>
          {[1,2,3,4,5].map(n => {
            const newRating = n === localRating ? 0 : n;
            return (
              <button key={n} onClick={() => {
                setLocalRating(newRating);
                onRatingChange?.(song.id, newRating);
                onAction(`rate-${newRating}`);
              }}
                className="transition-all hover:scale-125" title={`${n} ${t('star', { ns: 'player' })}`}>
                <Star size={14} className={n <= localRating ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-700 hover:text-zinc-500'} />
              </button>
            );
          })}
        </div>

        <div className="border-t border-zinc-800 my-1" />

        {/* Plik */}
        <button onClick={() => onAction('open-folder')}
          className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 flex items-center gap-2.5 transition-colors">
          <span className="text-zinc-500"><FolderOpen size={13}/></span>
          {t('openLocation', { ns: 'library' })}
        </button>
        <button onClick={() => { navigator.clipboard?.writeText(song.path); onAction('copy-path'); }}
          className="w-full text-left px-3 py-2 hover:bg-white/[0.07] text-zinc-200 flex items-center gap-2.5 transition-colors">
          <span className="text-zinc-500"><Copy size={13}/></span>
          {t('copyPath', { ns: 'common' })}
        </button>
      </div>
    </div>
  );
}

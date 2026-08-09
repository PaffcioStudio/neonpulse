import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListPlus, Play, Trash2, Pencil, Music2, X, Check, Shuffle, Volume2 } from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER, pluralTracks } from '../../utils';

export default function PlaylistsView({ library, playlists, onCreatePlaylist, onDeletePlaylist, onRenamePlaylist, currentSong, onPlay, onContextMenu }) {
  const { t } = useTranslation(['common', 'library']);
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [editingId,  setEditingId]  = useState(null);
  const [editName,   setEditName]   = useState('');
  const [activeId,   setActiveId]   = useState(null);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreatePlaylist(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  const handleRenameSubmit = (id) => {
    if (editName.trim()) onRenamePlaylist(id, editName.trim());
    setEditingId(null);
  };

  const activePlaylist = playlists.find(p => p.id === activeId);
  const activeSongs    = activePlaylist
    ? activePlaylist.songIds.map(id => library.find(s => s.id === id)).filter(Boolean)
    : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight">{t('playlistsTitle', { ns: 'library' })}</h2>
          <p className="text-xs text-zinc-500 mt-1">{t('playlistCount', { ns: 'common', count: playlists.length })}</p>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all accent-gradient hover:opacity-90 shadow-md">
          <ListPlus size={16} /> {t('newPlaylist', { ns: 'library' })}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 flex gap-3 items-center bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <ListPlus size={18} className="text-zinc-500 flex-shrink-0" />
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
            placeholder={t('playlistNamePlaceholderDots', { ns: 'library' })}
            className="flex-1 bg-transparent text-sm focus:outline-none text-white placeholder-zinc-600"
          />
          <button type="submit" className="text-green-400 hover:text-green-300 transition-colors"><Check size={18} /></button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={18} /></button>
        </form>
      )}

      {playlists.length === 0 && !showCreate ? (
        <div className="text-center py-24 text-zinc-600">
          <ListPlus size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t('noPlaylistsCreateFirst', { ns: 'library' })}</p>
        </div>
      ) : (
        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Lista playlist */}
          <div className="w-full lg:w-72 space-y-2 flex-shrink-0">
            {playlists.map(pl => {
              const songs    = pl.songIds.map(id => library.find(s => s.id === id)).filter(Boolean);
              const cover    = songs[0]?.cover;
              const isActive = pl.id === activeId;

              return (
                <div key={pl.id}
                  onClick={() => setActiveId(isActive ? null : pl.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${
                    isActive ? 'border-zinc-600 bg-white/[0.06]' : 'border-zinc-800/60 hover:border-zinc-700 hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Cover lub ikona Lucide */}
                  <img src={getCoverSrc(cover)} onError={e => { e.target.src = COVER_PLACEHOLDER(); }} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" loading="lazy" alt="" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {editingId === pl.id ? (
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={() => handleRenameSubmit(pl.id)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(pl.id); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        className="bg-transparent border-b border-zinc-600 text-sm w-full focus:outline-none text-white"
                      />
                    ) : (
                      <p className="font-semibold text-sm truncate">{pl.name}</p>
                    )}
                    <p className="text-xs text-zinc-500 mt-0.5">{pluralTracks(songs.length, t)}</p>
                  </div>

                  {/* Akcje */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingId(pl.id); setEditName(pl.name); }}
                      className="text-zinc-600 hover:text-white p-1 rounded transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => { onDeletePlaylist(pl.id); if (activeId === pl.id) setActiveId(null); }}
                      className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                    {songs.length > 0 && (
                      <button onClick={() => onPlay(songs[0], songs)}
                        className="text-zinc-600 hover:text-white p-1 rounded transition-colors">
                        <Play size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zawartość aktywnej playlisty */}
          {activePlaylist && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black">{activePlaylist.name}</h3>
                  <p className="text-xs text-zinc-500">{pluralTracks(activeSongs.length, t)}</p>
                </div>
                {activeSongs.length > 0 && (
                  <button onClick={() => onPlay(activeSongs[0], activeSongs)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold accent-gradient hover:opacity-90">
                    <Play size={12} /> {t('play', { ns: 'common' })}
                  </button>
                )}
              </div>

              {activeSongs.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                  <Music2 size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{t('playlistEmpty', { ns: 'library' })}</p>
                  <p className="text-xs mt-1">{t('playlistAddHint', { ns: 'library' })}</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {activeSongs.map((s, i) => {
                    const isCur = currentSong?.id === s.id;
                    return (
                      <div key={s.id}
                        onClick={() => onPlay(s, activeSongs)}
                        onContextMenu={onContextMenu ? (e) => onContextMenu(e, s) : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
                          isCur ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Numer/ikona */}
                        <span className="w-6 flex-shrink-0 flex items-center justify-center">
                          {isCur
                            ? <Volume2 size={12} className="accent-text animate-pulse" />
                            : <span className="text-[11px] text-zinc-600 group-hover:hidden">{i + 1}</span>
                          }
                          {!isCur && <Play size={11} className="hidden group-hover:block text-zinc-400" />}
                        </span>
                        {/* Okładka */}
                        <img src={getCoverSrc(s.cover)} onError={e => { e.target.src = COVER_PLACEHOLDER(); }} className="w-9 h-9 rounded object-cover flex-shrink-0" loading="lazy" alt="" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isCur ? 'accent-text' : ''}`}>{s.title}</p>
                          <p className="text-xs text-zinc-500 truncate">{s.artist}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

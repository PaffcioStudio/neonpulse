import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Trash2, RefreshCw, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER } from '../../utils';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api' : 'http://localhost:3001/api';

function formatDur(sec) {
  if (!sec) return '--:--';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function DuplicatesView({ onLibraryChange }) {
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState(new Set());
  const [selected,    setSelected]    = useState(new Set());
  const [deleting,    setDeleting]    = useState(false);
  const [done,        setDone]        = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setDone(null);
    try {
      const r = await fetch(`${API_URL}/duplicates`);
      const data = await r.json();
      setGroups(data);
      setExpanded(new Set(data.map(g => g.key)));
      const autoSel = new Set();
      data.forEach(g => g.songs.slice(1).forEach(s => autoSel.add(s.id)));
      setSelected(autoSel);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleGroup = (key) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const toggleSong = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleDeleteClick = () => {
    if (!selected.size || deleting) return;
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      const r = await fetch(`${API_URL}/duplicates`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const data = await r.json();
      setDone({ removed: data.removed });
      onLibraryChange?.();
      await load();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const totalDupes = groups.reduce((acc, g) => acc + g.songs.length - 1, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <Copy size={18} className="text-accent" />
        <h2 className="text-lg font-bold text-white">Duplikaty</h2>
        <span className="ml-1 text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
          {groups.length} grup · {totalDupes} duplikatów
        </span>
        <button onClick={load}
          className="ml-auto p-2 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {done && (
        <div className="mx-6 mb-3 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center gap-2">
          <CheckSquare size={13} />
          Usunięto {done.removed} {done.removed === 1 ? 'utwór' : 'utwory'} z dysku i biblioteki
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          <RefreshCw size={16} className="animate-spin mr-2" /> Szukam duplikatów…
        </div>
      ) : groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
          <Copy size={40} className="opacity-30" />
          <p className="text-sm">Brak duplikatów w bibliotece</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 pb-3">
            <p className="text-xs text-zinc-500">
              Zaznaczone zostaną usunięte. Pierwszy wpis w grupie jest zachowany domyślnie.
            </p>
            <div className="ml-auto flex items-center gap-2">
              {selected.size > 0 && (
                <span className="text-xs text-zinc-500">{selected.size} zaznaczonych</span>
              )}
              <button
                onClick={handleDeleteClick}
                disabled={!selected.size || deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30
                           text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-40 transition-colors">
                <Trash2 size={12} />
                {deleting ? 'Usuwam…' : 'Usuń zaznaczone'}
              </button>
            </div>
          </div>

          {/* Groups */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-3 pb-6">
            {groups.map(group => (
              <div key={group.key} className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
                >
                  {expanded.has(group.key)
                    ? <ChevronDown size={13} className="text-zinc-500 flex-shrink-0" />
                    : <ChevronRight size={13} className="text-zinc-500 flex-shrink-0" />}
                  <span className="text-sm font-semibold text-white truncate">{group.key}</span>
                  <span className="ml-auto text-xs text-zinc-500 flex-shrink-0">{group.songs.length} wersji</span>
                </button>

                {expanded.has(group.key) && (
                  <div className="border-t border-zinc-700/40 divide-y divide-zinc-700/30">
                    {group.songs.map((s, i) => {
                      const isSelected = selected.has(s.id);
                      const isKeep     = i === 0 && !isSelected;
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleSong(s.id)}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                            ${isSelected ? 'bg-red-600/10' : 'hover:bg-white/[0.03]'}`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected
                              ? <CheckSquare size={13} className="text-red-400" />
                              : <Square size={13} className={isKeep ? 'text-green-500' : 'text-zinc-600'} />}
                          </div>
                          <img
                            src={getCoverSrc(s.cover)}
                            onError={e => { e.target.src = COVER_PLACEHOLDER; }}
                            alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-zinc-700/30"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-white truncate">{s.title}</div>
                            <div className="text-[11px] text-zinc-400 truncate">{s.artist}</div>
                            <div className="text-[10px] text-zinc-600 truncate font-mono">{s.path}</div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-[11px] text-zinc-500">{formatDur(s.duration)}</div>
                            <div className="text-[10px] text-zinc-600">{formatSize(s.filesize)}</div>
                          </div>
                          {i === 0 && (
                            <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium
                              ${isSelected ? 'bg-zinc-700 text-zinc-500' : 'bg-green-500/20 text-green-400'}`}>
                              {isSelected ? 'usuwasz' : 'zachowaj'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal potwierdzenia */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <h3 className="text-white font-semibold text-base">
                Usunąć {selected.size} {selected.size === 1 ? 'utwór' : 'utwory'}?
              </h3>
            </div>
            <p className="text-zinc-400 text-sm mb-1">
              Zaznaczone pliki zostaną trwale usunięte{' '}
              <span className="text-red-400 font-medium">z dysku</span> — tej operacji nie można cofnąć.
            </p>
            <p className="text-zinc-600 text-xs mb-5">
              Wpisy zostaną również usunięte z biblioteki i ulubionych.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm bg-red-600/30 hover:bg-red-600/50 text-red-300 hover:text-red-200 font-medium transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Usuń z dysku
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

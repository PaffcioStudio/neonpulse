import React, { useState, useEffect, useCallback } from 'react';
import { FileX2, Trash2, RefreshCw, CheckSquare, Square, AlertTriangle } from 'lucide-react';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api' : 'http://localhost:3001/api';

export default function MissingFilesView({ onLibraryChange }) {
  const [missing,  setMissing]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [done,     setDone]     = useState(null); // { removed }

  const load = useCallback(async () => {
    setLoading(true);
    setDone(null);
    try {
      const r = await fetch(`${API_URL}/missing`);
      const data = await r.json();
      setMissing(data);
      setSelected(new Set());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAll = () => {
    if (selected.size === missing.length) setSelected(new Set());
    else setSelected(new Set(missing.map(s => s.id)));
  };

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleDelete = async () => {
    if (!selected.size || deleting) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API_URL}/missing`, {
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <FileX2 size={18} className="text-accent" />
        <h2 className="text-lg font-bold text-white">Brakujące pliki</h2>
        <span className="ml-1 text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
          {missing.length}
        </span>
        <button onClick={load}
          className="ml-auto p-2 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {done && (
        <div className="mx-6 mb-3 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center gap-2">
          <CheckSquare size={13} />
          Usunięto {done.removed} {done.removed === 1 ? 'wpis' : 'wpisy'} z biblioteki
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          <RefreshCw size={16} className="animate-spin mr-2" /> Sprawdzam pliki…
        </div>
      ) : missing.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
          <FileX2 size={40} className="opacity-30" />
          <p className="text-sm">Wszystkie pliki są na miejscu</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 pb-3">
            <button onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
              {selected.size === missing.length
                ? <CheckSquare size={13} className="text-accent" />
                : <Square size={13} />}
              {selected.size === missing.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
            <div className="ml-auto flex items-center gap-2">
              {selected.size > 0 && (
                <span className="text-xs text-zinc-500">{selected.size} zaznaczonych</span>
              )}
              <button
                onClick={handleDelete}
                disabled={!selected.size || deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30
                           text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-40 transition-colors">
                <Trash2 size={12} />
                {deleting ? 'Usuwam…' : 'Usuń z biblioteki'}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="mx-6 mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400/80 text-xs flex items-center gap-2">
            <AlertTriangle size={12} />
            Te pliki są w bazie, ale nie istnieją na dysku. Możesz je usunąć z biblioteki.
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-1 pb-6">
            {missing.map(s => (
              <div
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
                  ${selected.has(s.id) ? 'bg-red-600/10 border border-red-600/20' : 'hover:bg-white/[0.04] border border-transparent'}`}
              >
                <div className="flex-shrink-0">
                  {selected.has(s.id)
                    ? <CheckSquare size={14} className="text-red-400" />
                    : <Square size={14} className="text-zinc-600" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{s.title}</div>
                  <div className="text-xs text-zinc-500 truncate">{s.artist}</div>
                  <div className="text-[11px] text-zinc-600 truncate mt-0.5 font-mono">{s.path}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

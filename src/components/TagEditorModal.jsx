import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Tag, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER } from '../utils';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api'
  : 'http://localhost:3001/api';

export default function TagEditorModal({ song, onClose, onSaved }) {
  const [fields, setFields] = useState({
    title:  '',
    artist: '',
    album:  '',
    year:   '',
    genre:  '',
  });
  const [dirty,   setDirty]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState(null); // null | 'success' | 'error'
  const [errMsg,  setErrMsg]  = useState('');
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (!song) return;
    setFields({
      title:  song.title  || '',
      artist: song.artist || '',
      album:  song.album  || '',
      year:   song.year   ? String(song.year) : '',
      genre:  song.genre  || '',
    });
    setDirty(false);
    setStatus(null);
    setTimeout(() => firstInputRef.current?.focus(), 80);
  }, [song]);

  if (!song) return null;

  const handleChange = (key, val) => {
    setFields(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setStatus(null);
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const body = { ...fields, year: fields.year ? Number(fields.year) : 0 };
      const r = await fetch(`${API_URL}/tags/${song.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Błąd serwera');
      setStatus('success');
      setDirty(false);
      onSaved?.(data.song);
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      setStatus('error');
      setErrMsg(err.message || 'Nieznany błąd');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
  };

  const ext = song.path?.split('.').pop()?.toLowerCase() || '';
  const nonMp3 = !['mp3'].includes(ext);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <div className="p-1.5 rounded-lg bg-white/5">
            <Tag size={15} className="text-accent" />
          </div>
          <span className="font-semibold text-white text-sm">Edytor tagów</span>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Cover + plik */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-2">
          <img
            src={getCoverSrc(song.cover)}
            onError={e => { e.target.src = COVER_PLACEHOLDER; }}
            alt="okładka"
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-zinc-700/40"
          />
          <div className="min-w-0">
            <div className="text-xs text-zinc-400 font-medium truncate">{song.path?.split('/').pop()}</div>
            <div className="text-[11px] text-zinc-600 mt-0.5 uppercase tracking-wide">.{ext}</div>
            {nonMp3 && (
              <div className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
                <AlertCircle size={10} />
                Tylko DB – zapis tagów w pliku wymaga MP3
              </div>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="px-5 pt-2 pb-4 space-y-3">
          {[
            { key: 'title',  label: 'Tytuł',   placeholder: 'Nazwa utworu',     ref: firstInputRef },
            { key: 'artist', label: 'Artysta',  placeholder: 'Wykonawca' },
            { key: 'album',  label: 'Album',    placeholder: 'Nazwa albumu' },
            { key: 'genre',  label: 'Gatunek',  placeholder: 'np. Rock, Pop…' },
          ].map(({ key, label, placeholder, ref }) => (
            <div key={key}>
              <label className="block text-[11px] text-zinc-500 font-medium mb-1 uppercase tracking-wide">
                {label}
              </label>
              <input
                ref={ref}
                type="text"
                value={fields[key]}
                onChange={e => handleChange(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-black/40 border border-zinc-700/70 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600
                           focus:outline-none focus:border-accent/60 focus:bg-black/60 transition-colors"
              />
            </div>
          ))}

          {/* Rok osobno – węższe */}
          <div className="flex items-end gap-3">
            <div className="w-28">
              <label className="block text-[11px] text-zinc-500 font-medium mb-1 uppercase tracking-wide">Rok</label>
              <input
                type="number"
                value={fields.year}
                onChange={e => handleChange('year', e.target.value)}
                placeholder="2024"
                min="1900" max="2099"
                className="w-full bg-black/40 border border-zinc-700/70 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600
                           focus:outline-none focus:border-accent/60 focus:bg-black/60 transition-colors"
              />
            </div>
            <div className="text-[11px] text-zinc-600 pb-2.5">
              Ctrl+S aby zapisać
            </div>
          </div>
        </div>

        {/* Status bar */}
        {status && (
          <div className={`mx-5 mb-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${
            status === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {status === 'success'
              ? <><CheckCircle2 size={13} /> Zapisano pomyślnie</>
              : <><AlertCircle size={13} /> {errMsg}</>
            }
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold accent-gradient text-white
                       disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity"
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" />Zapisuję…</>
              : <><Save size={13} />Zapisz tagi</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

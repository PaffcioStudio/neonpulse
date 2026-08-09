import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, Download, ListMusic, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api' : 'http://localhost:3001/api';

// ── Import ────────────────────────────────────────────────────────
function ImportTab({ onImported, onClose }) {
  const { t } = useTranslation(['modals', 'common']);
  const [dragging,  setDragging]  = useState(false);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null); // { name, songIds, missing }
  const [plName,    setPlName]    = useState('');
  const [error,     setError]     = useState('');
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setResult(null);
    setImporting(true);
    try {
      const content = await file.text();
      const r = await fetch(`${API_URL}/playlists/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: file.name }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('importError', { ns: 'modals' }));
      setResult(data);
      setPlName(data.name || file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setError(e.message || t('importError', { ns: 'modals' }));
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirm = () => {
    if (!result || !plName.trim()) return;
    onImported({ name: plName.trim(), songIds: result.songIds });
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-2xl border-2 border-dashed cursor-pointer transition-colors
          ${dragging ? 'border-accent/60 bg-accent/5' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/30'}`}
      >
        <input ref={fileRef} type="file" accept=".m3u,.m3u8,.pls,.xspf" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        {importing
          ? <Loader2 size={28} className="animate-spin text-accent" />
          : <Upload size={28} className="text-zinc-500" />}
        <div className="text-center">
          <p className="text-sm text-zinc-300 font-medium">{t('dropFileOrClick', { ns: 'modals' })}</p>
          <p className="text-xs text-zinc-600 mt-1">{t('supportedFormats', { ns: 'modals' })}</p>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-xs space-y-1">
            <div className="flex justify-between text-zinc-300">
              <span>{t('foundInLibrary', { ns: 'modals' })}</span>
              <span className="text-green-400 font-semibold">{result.songIds.length}</span>
            </div>
            {result.missing.length > 0 && (
              <div className="flex justify-between text-zinc-500">
                <span>{t('missingInLibrary', { ns: 'modals' })}</span>
                <span className="text-amber-400">{result.missing.length}</span>
              </div>
            )}
          </div>

          {result.songIds.length > 0 && (
            <div>
              <label className="block text-[11px] text-zinc-500 font-medium mb-1 uppercase tracking-wide">
                {t('playlistNameLabel', { ns: 'modals' })}
              </label>
              <input
                autoFocus
                value={plName}
                onChange={e => setPlName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder={t('playlistNamePlaceholder', { ns: 'modals' })}
                className="w-full bg-black/40 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white
                           focus:outline-none focus:border-accent/60 transition-colors"
              />
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!result.songIds.length || !plName.trim()}
            className="w-full py-2 rounded-xl accent-gradient text-sm font-semibold text-white
                       disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={14} />
            {t('importPlaylistButton', { ns: 'modals' }).replace('{{count}}', result.songIds.length)}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────
function ExportTab({ playlists }) {
  const { t } = useTranslation(['modals', 'common']);
  const [selectedPl, setSelectedPl] = useState('');
  const [exporting,  setExporting]  = useState(false);

  const handleExport = async () => {
    const pl = playlists.find(p => p.id === selectedPl);
    if (!pl || exporting) return;
    setExporting(true);
    try {
      const ids = pl.songIds.join(',');
      const name = encodeURIComponent(pl.name);
      const url = `${API_URL}/playlists/export?ids=${ids}&name=${name}`;
      const r = await fetch(url);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${pl.name}.m3u`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">{t('exportPlaylistTitle', { ns: 'modals' })}</p>

      {playlists.length === 0 ? (
        <div className="text-center py-8 text-zinc-600 text-sm">
          <ListMusic size={32} className="mx-auto mb-2 opacity-30" />
          {t('noPlaylistsToExport', { ns: 'modals' })}
        </div>
      ) : (
        <>
          <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
            {playlists.map(pl => (
              <button
                key={pl.id}
                onClick={() => setSelectedPl(pl.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2
                  ${selectedPl === pl.id
                    ? 'bg-accent/15 border border-accent/30 text-white'
                    : 'hover:bg-white/[0.05] text-zinc-300 border border-transparent'}`}
              >
                <ListMusic size={13} className="text-zinc-500 flex-shrink-0" />
                <span className="truncate">{pl.name}</span>
                <span className="ml-auto text-xs text-zinc-600">{pl.songIds.length} {t('tracks', { ns: 'common' })}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            disabled={!selectedPl || exporting}
            className="w-full py-2 rounded-xl accent-gradient text-sm font-semibold text-white
                       disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {exporting
              ? <><Loader2 size={14} className="animate-spin" /> {t('exporting', { ns: 'modals' })}…</>
              : <><Download size={14} /> {t('exportAsM3U', { ns: 'modals' })}</>
            }
          </button>
        </>
      )}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────
export default function ImportExportModal({ playlists, onClose, onImported }) {
  const { t } = useTranslation(['modals', 'common']);
  const [tab, setTab] = useState('import');

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <ListMusic size={15} className="text-accent" />
          <span className="font-semibold text-white text-sm">{t('playlistsModalTitle', { ns: 'modals' })}</span>
          <button onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {[['import', t('importTab', { ns: 'modals' })], ['export', t('exportTab', { ns: 'modals' })]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors
                ${tab === id ? 'text-white border-b-2 border-accent' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4">
          {tab === 'import'
            ? <ImportTab onImported={onImported} onClose={onClose} />
            : <ExportTab playlists={playlists} />}
        </div>
      </div>
    </div>
  );
}

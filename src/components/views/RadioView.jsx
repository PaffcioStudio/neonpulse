import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Radio, Plus, Play, Square, Upload, Trash2, Pencil, EyeOff, Eye,
  X, Check, Loader2, AlertCircle, Search, Signal, ImageOff, Globe,
} from 'lucide-react';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api' : 'http://localhost:3001/api';

function OpenfmBrowser({ onClose, onAdd, existingSlugs, t }) {
  const [stations, setStations] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [query, setQuery]       = useState('');
  const [addedSlugs, setAddedSlugs] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/stations/openfm/list`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || t('openfmListError', { ns: 'radio' }));
        if (!cancelled) setStations(data.stations || []);
      } catch (e) {
        if (!cancelled) setError(e.message || t('openfmListError', { ns: 'radio' }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const filtered = useMemo(() => {
    if (!stations) return [];
    if (!query.trim()) return stations;
    const q = query.toLowerCase();
    return stations.filter(s => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));
  }, [stations, query]);

  const handleAdd = async (station) => {
    await onAdd(station);
    setAddedSlugs(prev => new Set(prev).add(station.slug));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h3 className="font-bold flex items-center gap-2">
            <Globe size={18} className="accent-text" /> {t('browseOpenfm', { ns: 'radio' })}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <input
              value={query} onChange={e => setQuery(e.target.value)} autoFocus
              placeholder={t('search', { ns: 'radio' })}
              className="w-full bg-zinc-800/60 border border-zinc-700 rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-3 custom-scrollbar">
          {loading && (
            <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
              <Loader2 size={18} className="animate-spin" /> {t('loading', { ns: 'common' })}
            </div>
          )}
          {!loading && error && (
            <div className="text-center py-16 text-amber-400 text-sm px-4">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-16 text-zinc-600 text-sm">{t('faviconNoResults', { ns: 'radio' })}</div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-1.5">
              {filtered.map(s => {
                const already = existingSlugs.has(s.slug) || addedSlugs.has(s.slug);
                return (
                  <div key={s.slug} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[11px] text-zinc-600 truncate font-mono">{s.slug}</p>
                    </div>
                    <button
                      onClick={() => !already && handleAdd(s)}
                      disabled={already}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        already
                          ? 'text-emerald-400 border border-emerald-500/30 cursor-default'
                          : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {already ? <><Check size={12} /> {t('added', { ns: 'radio' })}</> : <><Plus size={12} /> {t('addStation', { ns: 'radio' })}</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StationForm({ initial, onSubmit, onCancel, t }) {
  const [name, setName]       = useState(initial?.name || '');
  const [url, setUrl]         = useState(initial?.url || '');
  const [genre, setGenre]     = useState(initial?.genre || '');
  const [favicon, setFavicon] = useState(initial?.favicon || '');
  const [faviconResults, setFaviconResults] = useState(null);
  const [faviconSearching, setFaviconSearching] = useState(false);
  const [faviconError, setFaviconError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    onSubmit({ name: name.trim(), url: url.trim(), genre: genre.trim(), favicon: favicon.trim() });
  };

  const searchFavicon = async () => {
    if (!name.trim()) return;
    setFaviconSearching(true);
    setFaviconError('');
    setFaviconResults(null);
    try {
      const r = await fetch(`${API_URL}/stations/lookup-favicon?name=${encodeURIComponent(name.trim())}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('faviconSearchError', { ns: 'radio' }));
      if (!data.results?.length) { setFaviconError(t('faviconNoResults', { ns: 'radio' })); return; }
      setFaviconResults(data.results);
    } catch (e) {
      setFaviconError(e.message || t('faviconSearchError', { ns: 'radio' }));
    } finally {
      setFaviconSearching(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">{t('stationName', { ns: 'radio' })}</label>
        <input
          type="text" autoComplete="off" spellCheck="false"
          value={name} onChange={e => setName(e.target.value)} autoFocus
          placeholder={t('stationNamePlaceholder', { ns: 'radio' })}
          className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none text-white placeholder-zinc-600"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">{t('stationUrl', { ns: 'radio' })}</label>
        <input
          type="text" autoComplete="off" spellCheck="false"
          value={url} onChange={e => setUrl(e.target.value)}
          placeholder={t('stationUrlPlaceholder', { ns: 'radio' })}
          className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none text-white placeholder-zinc-600 font-mono"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">{t('stationGenre', { ns: 'radio' })}</label>
        <input
          type="text" autoComplete="off" spellCheck="false"
          value={genre} onChange={e => setGenre(e.target.value)}
          placeholder={t('stationGenrePlaceholder', { ns: 'radio' })}
          className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none text-white placeholder-zinc-600"
        />
      </div>

      {/* Ikonka stacji */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1">{t('stationIcon', { ns: 'radio' })}</label>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {favicon
              ? <img key={favicon} src={favicon} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              : <ImageOff size={14} className="text-zinc-600" />}
          </div>
          <input
            type="text" autoComplete="off" spellCheck="false"
            value={favicon} onChange={e => setFavicon(e.target.value)}
            placeholder={t('stationIconUrlPlaceholder', { ns: 'radio' })}
            className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-xs focus:outline-none text-white placeholder-zinc-600 font-mono"
          />
          <button
            type="button" onClick={searchFavicon} disabled={!name.trim() || faviconSearching}
            title={t('findIcon', { ns: 'radio' })}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-700 text-zinc-300 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {faviconSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {t('findIcon', { ns: 'radio' })}
          </button>
        </div>
        {faviconError && <p className="text-[11px] text-amber-400 mt-1.5">{faviconError}</p>}
        {faviconResults && (
          <div className="flex flex-wrap gap-2 mt-2">
            {faviconResults.map((r, i) => (
              <button
                key={r.favicon + i} type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFavicon(r.favicon); setFaviconResults(null); }}
                title={`${r.name}${r.country ? ' · ' + r.country : ''}`}
                className="w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-500 overflow-hidden transition-colors flex-shrink-0"
              >
                <img src={r.favicon} alt="" className="w-full h-full object-cover" onError={e => { e.target.parentElement.style.display = 'none'; }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
          {t('cancel', { ns: 'common' })}
        </button>
        <button type="submit"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold accent-gradient hover:opacity-90">
          <Check size={13} /> {t('save', { ns: 'common' })}
        </button>
      </div>
    </form>
  );
}

function StationRow({ station, isActive, isPlaying, isLoading, hasError, onToggle, onEdit, onDelete, onHide, onUnhide, t }) {
  const isHiddenList = station.isHidden;
  const [iconFailed, setIconFailed] = useState(false);
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all group ${
      isActive ? 'border-zinc-600 bg-white/[0.06]' : 'border-zinc-800/60 hover:border-zinc-700 hover:bg-white/[0.03]'
    }`}>
      {/* Play button */}
      <button
        onClick={() => onToggle(station)}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all overflow-hidden ${
          isActive ? 'accent-gradient' : (station.favicon && !iconFailed) ? 'bg-zinc-800' : 'bg-zinc-800 hover:bg-zinc-700'
        }`}
      >
        {isActive && isLoading
          ? <Loader2 size={16} className="animate-spin text-white" />
          : isActive && isPlaying
            ? <Square size={13} fill="white" className="text-white" />
            : station.favicon && !iconFailed
              ? <img src={station.favicon} alt="" className="w-full h-full object-cover" onError={() => setIconFailed(true)} />
              : <Play size={15} fill="white" className="text-white ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate">{station.name}</p>
          {isActive && isPlaying && !hasError && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {t('liveNow', { ns: 'radio' })}
            </span>
          )}
          {isActive && hasError && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 flex-shrink-0">
              <AlertCircle size={10} /> {t('streamError', { ns: 'radio' })}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 truncate">
          {station.type === 'openfm'
            ? `open.fm${station.genre ? ' · ' + station.genre : ''}`
            : station.genre || (station.source === 'manifest' ? t('predefined', { ns: 'radio' }) : t('custom', { ns: 'radio' }))}
        </p>
      </div>

      {/* Akcje */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {station.source === 'user' && (
          <>
            {station.type !== 'openfm' && (
              <button onClick={() => onEdit(station)} title={t('editStation', { ns: 'radio' })}
                className="text-zinc-600 hover:text-white p-1.5 rounded transition-colors">
                <Pencil size={13} />
              </button>
            )}
            <button onClick={() => onDelete(station)} title={t('deleteStation', { ns: 'radio' })}
              className="text-zinc-600 hover:text-red-400 p-1.5 rounded transition-colors">
              <Trash2 size={13} />
            </button>
          </>
        )}
        {station.source === 'manifest' && !isHiddenList && (
          <button onClick={() => onHide(station)} title={t('hideStation', { ns: 'radio' })}
            className="text-zinc-600 hover:text-white p-1.5 rounded transition-colors">
            <EyeOff size={13} />
          </button>
        )}
        {isHiddenList && (
          <button onClick={() => onUnhide(station)} title={t('unhideStation', { ns: 'radio' })}
            className="text-zinc-600 hover:text-white p-1.5 rounded transition-colors">
            <Eye size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function RadioView({ stations, hiddenStations, radio, onRefresh }) {
  const { t } = useTranslation(['common', 'radio']);
  const [showAdd, setShowAdd]   = useState(false);
  const [editing, setEditing]   = useState(null);
  const [showHidden, setShowHidden] = useState(false);
  const [showOpenfm, setShowOpenfm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [importError, setImportError] = useState('');
  const [importMsg, setImportMsg]     = useState('');
  const fileRef = useRef();

  const existingOpenfmSlugs = useMemo(
    () => new Set(stations.filter(s => s.type === 'openfm').map(s => s.slug)),
    [stations]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return stations;
    const q = searchQuery.toLowerCase();
    return stations.filter(s => s.name.toLowerCase().includes(q) || (s.genre || '').toLowerCase().includes(q));
  }, [stations, searchQuery]);

  // Jednorazowo (per zamontowanie widoku) dociągnij brakujące ikonki dla
  // stacji z manifestu przez Radio-Browser. Backend sam pomija stacje, które
  // już mają favicon albo już są w cache - więc kolejne wizyty w tej
  // zakładce nic nie robią, dopóki ktoś nie doda nowej stacji do manifestu.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/stations/auto-fetch-favicons`, { method: 'POST' });
        const data = await r.json();
        if (!cancelled && data.updated > 0) onRefresh();
      } catch { /* cichy fail - brak ikonek nie blokuje niczego */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (payload) => {
    await fetch(`${API_URL}/stations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setShowAdd(false);
    onRefresh();
  };

  // Stacja open.fm nie ma stałego "url" (token wygasa) - zapisujemy slug,
  // świeży URL dociąga useRadioPlayer tuż przed każdym odtworzeniem.
  const handleAddOpenfm = async (openfmStation) => {
    await fetch(`${API_URL}/stations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: openfmStation.name,
        url: `openfm:${openfmStation.slug}`, // placeholder - realny URL nigdy nie jest z niego czytany dla type:openfm
        slug: openfmStation.slug,
        type: 'openfm',
        genre: '',
      }),
    });
    onRefresh();
  };

  const handleEditSubmit = async (payload) => {
    await fetch(`${API_URL}/stations/${editing.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setEditing(null);
    onRefresh();
  };

  const handleDelete = async (station) => {
    if (radio.currentStation?.id === station.id) radio.stop();
    await fetch(`${API_URL}/stations/${station.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const handleHide = async (station) => {
    if (radio.currentStation?.id === station.id) radio.stop();
    await fetch(`${API_URL}/stations/${station.id}/hide`, { method: 'POST' });
    onRefresh();
  };

  const handleUnhide = async (station) => {
    await fetch(`${API_URL}/stations/${station.id}/unhide`, { method: 'POST' });
    onRefresh();
  };

  const handleFile = async (file) => {
    if (!file) return;
    setImportError(''); setImportMsg('');
    try {
      const content = await file.text();
      const r = await fetch(`${API_URL}/stations/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: file.name }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('importError', { ns: 'radio' }));
      setImportMsg(t('importedStations', { ns: 'radio', count: data.count }));
      onRefresh();
    } catch (e) {
      setImportError(e.message || t('importError', { ns: 'radio' }));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Radio size={26} className="accent-text" />
            {t('radioStationsTitle', { ns: 'radio' })}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">{t('stationCount', { ns: 'radio', count: stations.length })}</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".m3u,.m3u8,.xml,.xspf" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />
          <button onClick={() => setShowOpenfm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-all">
            <Globe size={15} /> {t('browseOpenfm', { ns: 'radio' })}
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-all">
            <Upload size={15} /> {t('importFromFile', { ns: 'radio' })}
          </button>
          <button onClick={() => { setShowAdd(s => !s); setEditing(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all accent-gradient hover:opacity-90 shadow-md">
            <Plus size={16} /> {t('addStation', { ns: 'radio' })}
          </button>
        </div>
      </div>

      {(importError || importMsg) && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-xs ${importError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
          {importError || importMsg}
        </div>
      )}

      {showAdd && (
        <div className="mb-6">
          <StationForm t={t} onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {editing && (
        <div className="mb-6">
          <StationForm t={t} initial={editing} onSubmit={handleEditSubmit} onCancel={() => setEditing(null)} />
        </div>
      )}

      {/* Wyszukiwarka */}
      {stations.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('search', { ns: 'radio' })}
            className="w-full bg-zinc-900/70 border border-zinc-800/60 rounded-full py-1.5 pl-9 pr-4 text-sm focus:outline-none"
          />
        </div>
      )}

      {stations.length === 0 && !showAdd ? (
        <div className="text-center py-24 text-zinc-600">
          <Signal size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t('noStations', { ns: 'radio' })}</p>
          <p className="text-xs mt-1 max-w-sm mx-auto">{t('noStationsHint', { ns: 'radio' })}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(station => (
            <StationRow
              key={station.id}
              station={station}
              isActive={radio.currentStation?.id === station.id}
              isPlaying={radio.isPlaying}
              isLoading={radio.isLoading}
              hasError={radio.hasError}
              onToggle={radio.toggle}
              onEdit={setEditing}
              onDelete={handleDelete}
              onHide={handleHide}
              onUnhide={handleUnhide}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Ukryte stacje */}
      {hiddenStations.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowHidden(s => !s)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5">
            <EyeOff size={12} /> {t('hiddenStations', { ns: 'radio' })} ({hiddenStations.length})
          </button>
          {showHidden && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-zinc-600 mb-2">{t('hiddenStationsHint', { ns: 'radio' })}</p>
              {hiddenStations.map(station => (
                <StationRow
                  key={station.id}
                  station={{ ...station, isHidden: true }}
                  isActive={false} isPlaying={false} isLoading={false} hasError={false}
                  onToggle={() => {}} onEdit={setEditing} onDelete={handleDelete}
                  onHide={handleHide} onUnhide={handleUnhide}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showOpenfm && (
        <OpenfmBrowser
          t={t}
          onClose={() => setShowOpenfm(false)}
          onAdd={handleAddOpenfm}
          existingSlugs={existingOpenfmSlugs}
        />
      )}
    </div>
  );
}

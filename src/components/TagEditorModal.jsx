import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Tag, Loader2, AlertCircle, CheckCircle2, Search, Music2, ChevronRight, RotateCcw, Check } from 'lucide-react';
import { getCoverSrc, COVER_PLACEHOLDER } from '../utils';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api'
  : 'http://localhost:3001/api';

const FIELD_LABELS = { title: 'Tytuł', artist: 'Artysta', album: 'Album', genre: 'Gatunek', year: 'Rok' };

function FieldDiff({ original, proposed }) {
  const changed = proposed && proposed !== original;
  return (
    <div className="min-w-0">
      {changed && original && (
        <div className="text-zinc-500 line-through text-[10px] truncate leading-tight">{original}</div>
      )}
      <div className={`text-xs truncate font-medium leading-tight mt-0.5 ${changed ? 'text-accent' : 'text-zinc-300'}`}>
        {proposed || <span className="text-zinc-600 italic font-normal">brak</span>}
      </div>
    </div>
  );
}

/* Stylowany checkbox */
function FancyCheckbox({ checked, onChange, label, children }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded flex items-center justify-center border transition-all
          ${checked
            ? 'bg-accent border-transparent accent-gradient'
            : 'bg-transparent border-zinc-600 group-hover:border-zinc-400'
          }`}
      >
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

export default function TagEditorModal({ song, onClose, onSaved }) {
  const [fields, setFields] = useState({ title: '', artist: '', album: '', year: '', genre: '' });
  const [originalFields, setOriginalFields] = useState({});
  const [dirty,   setDirty]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState(null);
  const [errMsg,  setErrMsg]  = useState('');

  const [lookupOpen,    setLookupOpen]    = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupError,   setLookupError]   = useState('');
  const [selectedIdx,   setSelectedIdx]   = useState(0);
  const [acceptedFields, setAcceptedFields] = useState({ title: true, artist: true, album: true, year: true, genre: true });

  const firstInputRef = useRef(null);

  useEffect(() => {
    if (!song) return;
    const f = {
      title:  song.title  || '',
      artist: song.artist || '',
      album:  song.album  || '',
      year:   song.year   ? String(song.year) : '',
      genre:  song.genre  || '',
    };
    setFields(f);
    setOriginalFields(f);
    setDirty(false);
    setStatus(null);
    setLookupOpen(false);
    setLookupResults([]);
    setTimeout(() => firstInputRef.current?.focus(), 80);
  }, [song]);

  if (!song) return null;

  const handleChange = (key, val) => {
    setFields(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setStatus(null);
  };

  const handleReset = () => {
    setFields(originalFields);
    setDirty(false);
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
      setOriginalFields(fields);
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
    if (e.key === 'Escape') { lookupOpen ? setLookupOpen(false) : onClose(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
  };

  const handleLookup = async () => {
    setLookupLoading(true);
    setLookupError('');
    setLookupResults([]);
    setLookupOpen(true);
    setSelectedIdx(0);
    setAcceptedFields({ title: true, artist: true, album: true, year: true, genre: true });
    try {
      const r = await fetch(`${API_URL}/tags/lookup/${song.id}`);
      const data = await r.json();
      if (data.ok && data.results?.length) {
        setLookupResults(data.results);
      } else {
        setLookupError(data.reason || 'Brak wyników');
      }
    } catch {
      setLookupError('Błąd połączenia z siecią');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleApplyLookup = () => {
    const result = lookupResults[selectedIdx];
    if (!result) return;
    const updated = { ...fields };
    Object.keys(acceptedFields).forEach(key => {
      if (acceptedFields[key] && result[key]) updated[key] = result[key];
    });
    setFields(updated);
    setDirty(true);
    setStatus(null);
    setLookupOpen(false);
  };

  const selectedResult = lookupResults[selectedIdx];
  const ext = song.path?.split('.').pop()?.toLowerCase() || '';
  const nonMp3 = !['mp3'].includes(ext);

  /* Pola formularza */
  const formFields = [
    { key: 'title',  label: 'Tytuł',   placeholder: 'Nazwa utworu', ref: firstInputRef },
    { key: 'artist', label: 'Artysta',  placeholder: 'Wykonawca' },
    { key: 'album',  label: 'Album',    placeholder: 'Nazwa albumu' },
    { key: 'genre',  label: 'Gatunek',  placeholder: 'np. Rock, Pop…' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/*
        Szerokość modala rośnie gdy panel wyników jest otwarty:
        max-w-md (pojedynczy) → max-w-3xl z grid 2-kolumnowym
      */}
      <div
        className={`relative w-full bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden animate-fade-in transition-all duration-300
          ${lookupOpen ? 'max-w-3xl' : 'max-w-md'}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <div className="p-1.5 rounded-lg bg-white/5">
            <Tag size={15} className="text-accent" />
          </div>
          <span className="font-semibold text-white text-sm">Edytor tagów</span>
          {lookupOpen && (
            <span className="ml-1 text-[11px] text-zinc-500 flex items-center gap-1">
              <Music2 size={11} className="text-accent" /> Wyniki online
            </span>
          )}
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Główny layout: grid 2-kol gdy lookup otwarty */}
        <div className={`${lookupOpen ? 'grid grid-cols-2 divide-x divide-zinc-800' : ''}`}>

          {/* ── LEWA / JEDYNA kolumna: formularz ── */}
          <div className="flex flex-col">
            {/* Cover + plik + przycisk lookup */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3">
              <img
                src={getCoverSrc(song.cover)}
                onError={e => { e.target.src = COVER_PLACEHOLDER; }}
                alt="okładka"
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-zinc-700/40"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-400 font-medium truncate">{song.path?.split('/').pop()}</div>
                <div className="text-[11px] text-zinc-600 mt-0.5 uppercase tracking-wide">.{ext}</div>
                {nonMp3 && (
                  <div className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> Tylko DB – zapis tagów w pliku wymaga MP3
                  </div>
                )}
              </div>
              <button
                onClick={lookupOpen ? () => setLookupOpen(false) : handleLookup}
                disabled={lookupLoading}
                title={lookupOpen ? 'Zamknij wyniki' : 'Wyszukaj tagi online (MusicBrainz + iTunes)'}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed
                           ${lookupOpen
                             ? 'bg-zinc-700/60 hover:bg-zinc-700 text-zinc-300 border border-zinc-600'
                             : 'bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 hover:border-accent/50'
                           }`}
              >
                {lookupLoading
                  ? <Loader2 size={12} className="animate-spin" />
                  : lookupOpen ? <X size={12} /> : <Search size={12} />
                }
                {lookupOpen ? 'Zamknij' : 'Szukaj online'}
              </button>
            </div>

            {/* Fields */}
            <div className="px-5 pb-3 space-y-3 flex-1">
              {formFields.map(({ key, label, placeholder, ref }) => (
                <div key={key}>
                  <label className="block text-[11px] text-zinc-500 font-medium mb-1 uppercase tracking-wide">{label}</label>
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
                <div className="text-[11px] text-zinc-600 pb-2.5">Ctrl+S aby zapisać</div>
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
            <div className="px-5 pb-5 flex justify-end gap-2 border-t border-zinc-800/60 pt-3">
              {dirty && (
                <button
                  onClick={handleReset}
                  title="Przywróć oryginalne tagi"
                  className="px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw size={13} /> Resetuj
                </button>
              )}
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

          {/* ── PRAWA kolumna: wyniki lookup ── */}
          {lookupOpen && (
            <div className="flex flex-col min-h-0" style={{ maxHeight: '560px' }}>
              {/* Header prawej kolumny */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-800/30">
                <Music2 size={13} className="text-accent flex-shrink-0" />
                <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wide">Wyniki online</span>
                {lookupResults.length > 0 && (
                  <span className="ml-auto text-[11px] text-zinc-500">{lookupResults.length} wyników</span>
                )}
              </div>

              {/* Loading */}
              {lookupLoading && (
                <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-zinc-400">
                  <Loader2 size={24} className="animate-spin text-accent" />
                  <span className="text-xs">Szukam w MusicBrainz i iTunes…</span>
                </div>
              )}

              {/* Error */}
              {lookupError && !lookupLoading && (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-amber-400/80">
                  <AlertCircle size={22} />
                  <span className="text-xs text-center">{lookupError}</span>
                </div>
              )}

              {/* Lista wyników */}
              {lookupResults.length > 0 && (
                <>
                  <div
                    className="overflow-y-auto flex-shrink-0 tag-lookup-scroll"
                    style={{ maxHeight: '180px' }}
                  >
                    {lookupResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedIdx(i)}
                        className={`w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors border-b border-zinc-800/50 last:border-0
                          ${i === selectedIdx ? 'bg-accent/10' : 'hover:bg-white/5'}`}
                      >
                        <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors
                          ${i === selectedIdx ? 'bg-accent' : 'bg-zinc-700'}`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">{r.title}</div>
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {r.artist}{r.album ? ` • ${r.album}` : ''}{r.year ? ` (${r.year})` : ''}
                          </div>
                          <div className="text-[10px] text-zinc-600 mt-0.5">
                            {r.source}{r.genre ? ` · ${r.genre}` : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Panel zastąpienia pól */}
                  {selectedResult && (
                    <div className="px-4 py-3 bg-zinc-800/20 border-t border-zinc-700/50 flex-1 overflow-y-auto tag-lookup-scroll">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-3 font-semibold">
                        Które pola zastąpić
                      </div>
                      <div className="space-y-2.5 mb-4">
                        {Object.keys(acceptedFields).map(key => (
                          <FancyCheckbox
                            key={key}
                            checked={acceptedFields[key]}
                            onChange={val => setAcceptedFields(prev => ({ ...prev, [key]: val }))}
                          >
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wide leading-none mb-1">
                              {FIELD_LABELS[key]}
                            </div>
                            <FieldDiff original={fields[key]} proposed={selectedResult[key]} />
                          </FancyCheckbox>
                        ))}
                      </div>
                      <button
                        onClick={handleApplyLookup}
                        className="w-full py-2 rounded-xl text-xs font-semibold accent-gradient text-white hover:opacity-90 transition-opacity"
                      >
                        Zastosuj zaznaczone
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

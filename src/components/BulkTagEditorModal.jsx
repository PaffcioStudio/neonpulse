import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Tag, Loader2, AlertCircle, CheckCircle2, Users, Disc3, Music2, Calendar, Radio } from 'lucide-react';

const API_URL = (typeof window !== 'undefined' && window.location?.protocol === 'http:')
  ? '/api'
  : 'http://localhost:3001/api';

export default function BulkTagEditorModal({ songs, onClose, onSaved }) {
  const { t } = useTranslation(['modals', 'common']);
  const [fields, setFields]   = useState({ artist: '', album: '', genre: '', year: '' });
  const [enabled, setEnabled] = useState({ artist: false, album: false, genre: false, year: false });
  const [saving,  setSaving]  = useState(false);
  const [status,  setStatus]  = useState(null);
  const [errMsg,  setErrMsg]  = useState('');

  const anyEnabled = Object.values(enabled).some(Boolean);
  const fieldsConfig = [
    { key: 'artist', label: t('bulkFieldLabels.artist', { ns: 'modals' }), icon: Users, placeholder: t('bulkFieldPlaceholders.artist', { ns: 'modals' }) },
    { key: 'album', label: t('bulkFieldLabels.album', { ns: 'modals' }), icon: Disc3, placeholder: t('bulkFieldPlaceholders.album', { ns: 'modals' }) },
    { key: 'genre', label: t('bulkFieldLabels.genre', { ns: 'modals' }), icon: Radio, placeholder: t('bulkFieldPlaceholders.genre', { ns: 'modals' }) },
    { key: 'year', label: t('bulkFieldLabels.year', { ns: 'modals' }), icon: Calendar, placeholder: t('bulkFieldPlaceholders.year', { ns: 'modals' }), type: 'number' },
  ];

  const handleSave = async () => {
    if (!anyEnabled || saving) return;
    setSaving(true); setStatus(null);
    const toSend = Object.fromEntries(
      Object.entries(fields).filter(([k]) => enabled[k] && fields[k] !== '')
    );
    try {
      const r = await fetch(`${API_URL}/bulk-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: songs.map(s => s.id), fields: toSend }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('serverError', { ns: 'modals' }));
      setStatus('success');
      onSaved?.(songs.map(s => ({ ...s, ...toSend })));
      setTimeout(() => { setStatus(null); onClose(); }, 1500);
    } catch (err) {
      setStatus('error');
      setErrMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <div className="p-1.5 rounded-lg bg-white/5">
            <Tag size={15} className="text-accent" />
          </div>
          <div>
            <span className="font-semibold text-white text-sm">{t('bulkEditTitle', { ns: 'modals' })}</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {songs.length} {songs.length === 1 ? t('bulkEditSubtitle', { ns: 'modals' }).replace('{{count}}', songs.length) : t('bulkEditSubtitle_plural', { ns: 'modals' }).replace('{{count}}', songs.length)}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Lista wybranych */}
        <div className="px-5 pt-3 pb-2">
          <p className="text-[11px] text-zinc-600 mb-2 uppercase tracking-wide">{t('selectedTracksLabel', { ns: 'modals' })}</p>
          <div className="max-h-28 overflow-y-auto tag-lookup-scroll space-y-1 pr-1">
            {songs.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs text-zinc-400">
                <Music2 size={10} className="text-zinc-700 flex-shrink-0" />
                <span className="truncate">{s.title || s.path?.split('/').pop()}</span>
                {s.artist && <span className="text-zinc-600 flex-shrink-0">– {s.artist}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Pola */}
        <div className="px-5 py-3 space-y-3 border-t border-zinc-800/60">
          <p className="text-[11px] text-zinc-500">{t('selectFieldsToOverwrite', { ns: 'modals' })}</p>
          {fieldsConfig.map(({ key, label, icon: Icon, placeholder, type }) => (
            <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              enabled[key] ? 'border-accent/30 bg-accent/5' : 'border-zinc-800/60 bg-zinc-800/20'
            }`}>
              <div
                onClick={() => setEnabled(p => ({ ...p, [key]: !p[key] }))}
                className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 cursor-pointer border transition-all ${
                  enabled[key] ? 'accent-gradient border-transparent' : 'border-zinc-600 bg-transparent'
                }`}
              >
                {enabled[key] && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <Icon size={13} className={enabled[key] ? 'accent-text flex-shrink-0' : 'text-zinc-600 flex-shrink-0'} />
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">{label}</label>
                <input
                  type={type || 'text'}
                  value={fields[key]}
                  onChange={e => { setFields(p => ({ ...p, [key]: e.target.value })); setEnabled(p => ({ ...p, [key]: true })); }}
                  placeholder={placeholder}
                  disabled={!enabled[key]}
                  className="w-full bg-transparent text-sm text-white placeholder-zinc-700 focus:outline-none disabled:opacity-30 transition-opacity"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Status */}
        {status && (
          <div className={`mx-5 mb-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${
            status === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {status === 'success'
              ? <><CheckCircle2 size={13} /> {t('saveSuccess', { ns: 'modals' }).replace('{{count}}', songs.length)}</>
              : <><AlertCircle size={13} /> {errMsg}</>}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-end gap-2 border-t border-zinc-800/60 pt-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            {t('cancel', { ns: 'modals' })}
          </button>
          <button onClick={handleSave} disabled={!anyEnabled || saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold accent-gradient text-white disabled:opacity-40 flex items-center gap-2 transition-opacity">
            {saving
              ? <><Loader2 size={13} className="animate-spin" />{t('saving', { ns: 'modals' })}…</>
              : <><Save size={13} />{t('applyToCount', { ns: 'modals' }).replace('{{count}}', songs.length)}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

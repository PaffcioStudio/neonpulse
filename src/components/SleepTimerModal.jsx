import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Moon, Timer, CheckCircle2 } from 'lucide-react';

export default function SleepTimerModal({ onClose, onSet, currentTimer, animationsEnabled = true, isClosing = false }) {
  const { t } = useTranslation(['modals', 'common']);

  const PRESETS = [
    { label: t('preset15min', { ns: 'modals' }), value: 15 },
    { label: t('preset30min', { ns: 'modals' }), value: 30 },
    { label: t('preset45min', { ns: 'modals' }), value: 45 },
    { label: t('preset1h', { ns: 'modals' }), value: 60 },
    { label: t('preset1h30min', { ns: 'modals' }), value: 90 },
    { label: t('preset2h', { ns: 'modals' }), value: 120 },
  ];
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (currentTimer) {
      const mins = Math.round(currentTimer / 60);
      const preset = PRESETS.find(p => p.value === mins);
      if (preset) setSelected(preset.value);
      else { setSelected('custom'); setCustom(String(mins)); }
    }
    setTimeout(() => inputRef.current?.focus?.(), 60);
  }, []);

  const handleSet = () => {
    let mins = selected === 'custom' ? Number(custom) : selected;
    if (!mins || mins <= 0 || mins > 600) return;
    onSet(mins * 60);
    onClose();
  };

  const handleCancel = () => {
    onSet(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className={`relative w-full max-w-sm bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden ${
        animationsEnabled ? (isClosing ? 'np-pop-exit' : 'np-pop-enter') : ''
      }`}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <div className="p-1.5 rounded-lg bg-indigo-500/15">
            <Moon size={15} className="text-indigo-400" />
          </div>
          <span className="font-semibold text-white text-sm">{t('sleepTimerTitle', { ns: 'modals' })}</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-zinc-500">{t('sleepTimerDescription', { ns: 'modals' })}</p>

          {/* Presety */}
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map(p => (
              <button key={p.value} onClick={() => { setSelected(p.value); setCustom(''); }}
                className={`py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 border ${
                  selected === p.value
                    ? 'accent-gradient text-white border-transparent shadow-md'
                    : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
                style={selected === p.value ? { boxShadow: '0 2px 12px var(--accent-glow)' } : {}}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom */}
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected('custom')}
              className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors flex-shrink-0 ${
                selected === 'custom'
                  ? 'accent-text border-accent/40 bg-accent/10'
                  : 'text-zinc-500 border-zinc-700 hover:text-zinc-300'
              }`}>
              {t('customTime', { ns: 'modals' })}
            </button>
            <input
              ref={inputRef}
              type="number" min="1" max="600"
              value={custom}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setCustom(''); setSelected('custom'); return; }
                const next = Math.max(1, Math.min(600, Number(raw) || 1));
                setCustom(String(next));
                setSelected('custom');
              }}
              placeholder={t('minutes', { ns: 'modals' })}
              className="number-clean flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <span className="text-xs text-zinc-600 flex-shrink-0">{t('minLabel', { ns: 'modals' })}</span>
          </div>

          {/* Informacja o aktywnym wyłączniku */}
          {currentTimer > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs">
              <Timer size={12} className="flex-shrink-0" />
              {t('sleepTimerActive', { ns: 'modals' }).replace('{{minutes}}', Math.ceil(currentTimer / 60))}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2 justify-end">
          {currentTimer > 0 && (
            <button onClick={handleCancel}
              className="px-4 py-2 rounded-xl text-xs text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors">
              {t('cancelSleepTimer', { ns: 'modals' })}
            </button>
          )}
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            {t('close', { ns: 'modals' })}
          </button>
          <button onClick={handleSet} disabled={!selected || (selected === 'custom' && (!custom || Number(custom) < 1 || Number(custom) > 600))}
            className="px-4 py-2 rounded-xl text-sm font-semibold accent-gradient text-white disabled:opacity-40 flex items-center gap-1.5 transition-opacity">
            <CheckCircle2 size={13} /> {t('set', { ns: 'modals' })}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { X, Moon, Timer, CheckCircle2 } from 'lucide-react';

const PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 godz', value: 60 },
  { label: '1.5 godz', value: 90 },
  { label: '2 godz', value: 120 },
];

export default function SleepTimerModal({ onClose, onSet, currentTimer }) {
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
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <div className="p-1.5 rounded-lg bg-indigo-500/15">
            <Moon size={15} className="text-indigo-400" />
          </div>
          <span className="font-semibold text-white text-sm">Sleep Timer</span>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-zinc-500">Odtwarzanie zatrzyma się automatycznie po wybranym czasie.</p>

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
              Własny
            </button>
            <input
              ref={inputRef}
              type="number" min="1" max="600"
              value={custom}
              onChange={e => { setCustom(e.target.value); setSelected('custom'); }}
              placeholder="minuty"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <span className="text-xs text-zinc-600 flex-shrink-0">min</span>
          </div>

          {/* Aktywny timer info */}
          {currentTimer > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs">
              <Timer size={12} className="flex-shrink-0" />
              Aktywny timer: {Math.ceil(currentTimer / 60)} min pozostało
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2 justify-end">
          {currentTimer > 0 && (
            <button onClick={handleCancel}
              className="px-4 py-2 rounded-xl text-xs text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors">
              Anuluj timer
            </button>
          )}
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            Zamknij
          </button>
          <button onClick={handleSet} disabled={!selected || (selected === 'custom' && !custom)}
            className="px-4 py-2 rounded-xl text-sm font-semibold accent-gradient text-white disabled:opacity-40 flex items-center gap-1.5 transition-opacity">
            <CheckCircle2 size={13} /> Ustaw
          </button>
        </div>
      </div>
    </div>
  );
}

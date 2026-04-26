import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';

const PRESETS = {
  'Płaski':       [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  'Bass Boost':   [+8, +6, +4, +2,  0,  0,  0,  0,  0,  0],
  'Treble Boost': [ 0,  0,  0,  0,  0, +2, +4, +6, +7, +8],
  'V-Shape':      [+6, +4, +1, -2, -4, -4, -2, +1, +4, +6],
  'Vocal':        [-2, -2,  0, +4, +6, +5, +4,  0, -2, -2],
  'Rock':         [+5, +3,  0, -2, -2,  0, +3, +5, +6, +6],
  'Jazz':         [+4, +2,  0, +3, +4, +3,  0,  0,  0,  0],
  'Pop':          [-2, +2, +4, +5, +4, +3, +2,  0, -1, -2],
  'Electronic':   [+5, +4, +1,  0, -3, +2, +1, +3, +5, +6],
  'Classical':    [+4, +3, +2,  0,  0,  0,  0, -2, -3, -4],
};

const BAND_LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const TRACK_H = 140; // px height of the slider track
const MIN = -12, MAX = 12;

function gainToPercent(g) {
  // 0% = top (MAX), 100% = bottom (MIN)
  return (MAX - g) / (MAX - MIN);
}

function EqBand({ gain, index, onChange }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const getGainFromY = (clientY) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const raw = MAX - ratio * (MAX - MIN);
    return Math.round(raw / 0.5) * 0.5;
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    onChange(index, getGainFromY(e.clientY));
    const onMove = (ev) => { if (dragging.current) onChange(index, getGainFromY(ev.clientY)); };
    const onUp   = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onTouchStart = (e) => {
    dragging.current = true;
    onChange(index, getGainFromY(e.touches[0].clientY));
    const onMove = (ev) => { if (dragging.current) onChange(index, getGainFromY(ev.touches[0].clientY)); };
    const onEnd  = () => { dragging.current = false; window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  };

  const pct    = gainToPercent(gain);          // 0=top 1=bottom
  const thumbY = pct * TRACK_H;
  const isPos  = gain > 0;
  const isNeg  = gain < 0;
  const midY   = TRACK_H / 2;

  const fillTop    = isPos ? thumbY  : midY;
  const fillBottom = isPos ? midY    : thumbY;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      {/* Wartość dB */}
      <span className={`text-[10px] font-bold tabular-nums leading-none ${isPos ? 'accent-text' : isNeg ? 'text-zinc-500' : 'text-zinc-600'}`}>
        {gain > 0 ? `+${gain}` : gain}
      </span>

      {/* Track */}
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="relative cursor-ns-resize select-none"
        style={{ width: 20, height: TRACK_H }}
      >
        {/* Ścieżka tła */}
        <div className="absolute inset-x-0 rounded-full bg-zinc-800" style={{ top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 4 }} />

        {/* Wypełnienie (fill) */}
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            width: 4,
            top: fillTop,
            height: Math.max(1, fillBottom - fillTop),
            background: isPos
              ? 'linear-gradient(180deg, var(--accent-from), var(--accent-mid))'
              : isNeg
              ? 'rgba(99,102,241,0.45)'
              : 'transparent',
          }}
        />

        {/* Linia środkowa (0 dB) */}
        <div className="absolute left-0 right-0" style={{ top: midY - 0.5, height: 1, background: 'rgba(255,255,255,0.08)' }} />

        {/* Thumb */}
        <div
          className="absolute rounded-full shadow-lg transition-transform duration-75"
          style={{
            left: '50%',
            top: thumbY,
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            background: isPos
              ? 'linear-gradient(135deg, var(--accent-from), var(--accent-to))'
              : isNeg
              ? '#6366f1'
              : '#52525b',
            boxShadow: isPos
              ? '0 0 8px var(--accent-glow)'
              : isNeg
              ? '0 0 6px rgba(99,102,241,0.4)'
              : 'none',
            border: '2px solid rgba(255,255,255,0.15)',
          }}
        />
      </div>

      {/* Label Hz */}
      <span className="text-[9px] text-zinc-600 font-medium leading-none">{BAND_LABELS[index]}</span>
    </div>
  );
}

export default function EqualizerPanel({ eqFiltersRef, setEqGain, EQ_FREQS }) {
  const [gains, setGains] = useState(() => {
    try {
      const saved = localStorage.getItem('neonpulse_eq_gains');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 10) return parsed;
      }
    } catch {}
    return Array(10).fill(0);
  });

  const [activePreset, setActivePreset] = useState(() => {
    try { return localStorage.getItem('neonpulse_eq_preset') || 'Płaski'; } catch { return 'Płaski'; }
  });

  // Zastosuj zapisane wzmocnienia do filtrów audio przy montowaniu panelu
  // (usePlayer już je ładuje przy starcie, ale panel może być zamontowany później
  //  jeśli AudioContext jeszcze nie istniał — re-aplikuj dla pewności)
  const appliedOnMount = useRef(false);
  useEffect(() => {
    if (appliedOnMount.current) return;
    appliedOnMount.current = true;
    gains.forEach((g, i) => setEqGain(i, g));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyGains = useCallback((newGains, presetName) => {
    newGains.forEach((g, i) => setEqGain(i, g));
    setGains(newGains);
    try {
      localStorage.setItem('neonpulse_eq_gains', JSON.stringify(newGains));
      if (presetName !== undefined) localStorage.setItem('neonpulse_eq_preset', presetName);
    } catch {}
  }, [setEqGain]);

  const handleBand = (i, val) => {
    const g = [...gains];
    g[i] = val;
    setActivePreset('');
    applyGains(g, '');
  };

  const applyPreset = (name) => {
    setActivePreset(name);
    applyGains([...PRESETS[name]], name);
  };

  const reset = () => applyPreset('Płaski');

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 select-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="accent-text" />
          <span className="text-sm font-bold uppercase tracking-widest text-zinc-300">Equalizer</span>
        </div>
        <button onClick={reset} className="text-zinc-600 hover:text-zinc-300 transition-colors" title="Resetuj">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Presety */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {Object.keys(PRESETS).map(name => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
              activePreset === name
                ? 'accent-gradient text-white border-transparent'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Suwaki */}
      <div className="flex items-stretch justify-between gap-2">
        {gains.map((g, i) => (
          <EqBand key={i} gain={g} index={i} onChange={handleBand} />
        ))}
      </div>

      <p className="text-[10px] text-zinc-700 text-center mt-3">Hz — zakres ±12 dB</p>
    </div>
  );
}

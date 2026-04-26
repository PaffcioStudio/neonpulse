import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Mic2, FileText, RefreshCw } from 'lucide-react';

const API_URL = '/api';

// Parsowanie pliku .lrc: "[mm:ss.xx] tekst"
function parseLrc(raw) {
  if (!raw) return null;
  const lines = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (m) {
      const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
      lines.push({ time, text: m[3].trim() });
    }
  }
  if (lines.length === 0) return null;
  return lines.sort((a, b) => a.time - b.time);
}

function findActiveLine(lines, currentTime) {
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) idx = i;
    else break;
  }
  return idx;
}

export default function LyricsView({ currentSong, audioRef }) {
  const containerRef = useRef(null);
  const activeRef    = useRef(null);

  const [lrcRaw,      setLrcRaw]      = useState(null);   // .lrc z dysku
  const [embedded,    setEmbedded]    = useState(null);   // tekst embedded w tagu
  const [loading,     setLoading]     = useState(false);
  const [source,      setSource]      = useState(null);   // 'lrc' | 'embedded' | 'db' | null
  const [currentTime, setCurrentTime] = useState(0);

  // RAF – aktualny czas odtwarzania
  useEffect(() => {
    let raf;
    const tick = () => {
      setCurrentTime(audioRef?.current?.currentTime || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioRef]);

  // Ładuj tekst przy zmianie utworu
  useEffect(() => {
    if (!currentSong?.path) {
      setLrcRaw(null); setEmbedded(null); setSource(null);
      return;
    }

    setLrcRaw(null); setEmbedded(null); setSource(null);
    setLoading(true);

    let cancelled = false;

    const load = async () => {
      // 1. Tekst embedded w polu lyrics obiektu piosenki (z DB)
      if (currentSong.lyrics && currentSong.lyrics.trim()) {
        const parsed = parseLrc(currentSong.lyrics);
        if (!cancelled) {
          if (parsed) { setLrcRaw(currentSong.lyrics); setSource('lrc'); }
          else         { setEmbedded(currentSong.lyrics); setSource('db'); }
          setLoading(false);
        }
        return;
      }

      // 2. Plik .lrc obok pliku audio
      try {
        const lrcPath = currentSong.path.replace(/\.[^.]+$/, '.lrc');
        const r = await fetch(`${API_URL}/lyrics?path=${encodeURIComponent(lrcPath)}`);
        // 204 = brak pliku (cicho), 200 = jest plik
        if (r.ok && r.status === 200) {
          const text = await r.text();
          if (text && text.trim() && !cancelled) {
            setLrcRaw(text); setSource('lrc'); setLoading(false);
            return;
          }
        }
      } catch { /* ignoruj */ }

      // 3. Odczyt embedded z pliku na żywo (USLT/SYLT/vorbis)
      if (currentSong.id) {
        try {
          const r = await fetch(`${API_URL}/lyrics/embedded?songId=${currentSong.id}`);
          if (r.ok) {
            const data = await r.json();
            if (data.lyrics && data.lyrics.trim() && !cancelled) {
              const parsed = parseLrc(data.lyrics);
              if (parsed) { setLrcRaw(data.lyrics); setSource('lrc'); }
              else         { setEmbedded(data.lyrics); setSource('embedded'); }
              setLoading(false);
              return;
            }
          }
        } catch { /* ignoruj */ }
      }

      if (!cancelled) { setSource(null); setLoading(false); }
    };

    load();
    return () => { cancelled = true; };
  }, [currentSong?.id, currentSong?.path, currentSong?.lyrics]);

  const parsed = useMemo(() => parseLrc(lrcRaw), [lrcRaw]);
  const activeLine = useMemo(
    () => parsed ? findActiveLine(parsed, currentTime) : -1,
    [parsed, currentTime]
  );

  // Scroll do aktywnej linii
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLine]);

  if (!currentSong) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-700 py-24">
        <Mic2 size={48} className="opacity-20" />
        <p className="text-sm">Brak aktywnego utworu</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 flex-shrink-0">
        <Mic2 size={18} className="text-accent" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-white truncate">{currentSong.title}</h2>
          <p className="text-xs text-zinc-500 truncate">{currentSong.artist}</p>
        </div>
        {source === 'lrc' && (
          <span className="text-[11px] text-accent/70 bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full flex-shrink-0">
            .lrc sync
          </span>
        )}
        {(source === 'embedded' || source === 'db') && (
          <span className="text-[11px] text-zinc-500 bg-zinc-800 border border-zinc-700/50 px-2 py-0.5 rounded-full flex-shrink-0">
            embedded
          </span>
        )}
      </div>

      {/* Lyrics body */}
      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-32">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-zinc-700 text-sm">
            <RefreshCw size={14} className="animate-spin" /> Ładowanie…
          </div>
        ) : parsed ? (
          /* Zsynchronizowane .lrc */
          <div className="space-y-2 py-12 text-center">
            {parsed.map((line, i) => (
              <div
                key={i}
                ref={i === activeLine ? activeRef : null}
                className={`text-base leading-relaxed transition-all duration-300 px-4 py-1 rounded-xl ${
                  i === activeLine
                    ? 'text-white font-semibold scale-105 accent-text'
                    : i < activeLine
                      ? 'text-zinc-600 text-sm'
                      : 'text-zinc-500 text-sm'
                }`}
              >
                {line.text || <span className="opacity-30">·</span>}
              </div>
            ))}
          </div>
        ) : embedded ? (
          /* Zwykły tekst embedded */
          <div className="py-8">
            <p className="whitespace-pre-line text-zinc-300 text-sm leading-loose text-center">
              {embedded}
            </p>
          </div>
        ) : (
          /* Brak tekstu */
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-zinc-700">
            <FileText size={40} className="opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-600">Brak tekstu</p>
              <p className="text-xs text-zinc-700 mt-1">
                Umieść plik <span className="font-mono text-zinc-600">.lrc</span> obok pliku audio<br/>
                lub dodaj tekst (USLT) przez edytor tagów
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

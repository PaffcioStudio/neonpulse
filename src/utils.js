// ─── Czas ─────────────────────────────────────────────────────
export const formatTime = (s) => {
  if (!s || !Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};
export const formatTimeRemaining = (cur, dur) => {
  if (!dur || !Number.isFinite(dur)) return '-0:00';
  return `-${formatTime(Math.max(0, dur - (cur||0)))}`;
};

// ─── Okładki ──────────────────────────────────────────────────
// Placeholder okładki – wbudowany base64 (działa zawsze: dev, build, Electron)
const _PLACEHOLDER_URL = 'data:image/png;base64,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';
export const COVER_PLACEHOLDER = (_size) => _PLACEHOLDER_URL;

export const getCoverSrc = (p) => {
  if (!p) return _PLACEHOLDER_URL;
  if (p.startsWith('http') || p.startsWith('data:')) return p;
  return `file://${encodeURI(p)}`;
};

// ─── Shuffle ──────────────────────────────────────────────────
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Smart filtry ─────────────────────────────────────────────
export function filterBySmartRules(list, rules) {
  let result = list.filter(t => {
    if (!t) return false;
    if (rules.favoritesOnly && !t.isFavorite) return false;
    if (rules.yearFrom && t.year && Number(t.year) < Number(rules.yearFrom)) return false;
    if (rules.yearTo   && t.year && Number(t.year) > Number(rules.yearTo))   return false;
    if (rules.genreIncludes?.length > 0) {
      const g = (t.genre || '').toLowerCase();
      if (!rules.genreIncludes.some(kw => g.includes(kw.toLowerCase()))) return false;
    }
    if (rules.titleIncludes  && !(t.title||'').toLowerCase().includes(rules.titleIncludes.toLowerCase()))  return false;
    if (rules.artistIncludes && !(t.artist||'').toLowerCase().includes(rules.artistIncludes.toLowerCase())) return false;
    if (rules.folderIncludes && !(t.path||'').toLowerCase().includes(rules.folderIncludes.toLowerCase()))   return false;
    return true;
  });

  // Sortowanie
  if (rules.sortBy) {
    const dir = rules.sortDir === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => {
      if (rules.sortBy === 'random') return Math.random() - 0.5;
      let va = a[rules.sortBy] ?? ''; let vb = b[rules.sortBy] ?? '';
      if (rules.sortBy === 'duration' || rules.sortBy === 'year') {
        return dir * ((Number(va)||0) - (Number(vb)||0));
      }
      return dir * String(va).toLowerCase().localeCompare(String(vb).toLowerCase(), 'pl');
    });
  }

  // Limit
  if (rules.limit && Number(rules.limit) > 0) {
    result = result.slice(0, Number(rules.limit));
  }

  return result;
}

// ─── Odmiana ──────────────────────────────────────────────────
export const pluralTracks = (n) =>
  n === 1 ? '1 utwór' : n < 5 ? `${n} utwory` : `${n} utworów`;

// ─── Dominujący kolor z okładki (canvas) ──────────────────────
export function extractDominantColor(imgSrc, callback) {
  if (!imgSrc) { callback(null); return; }
  const img = new window.Image();
  if (!imgSrc.startsWith('http')) { /* file:// - no crossOrigin needed */ } else { img.crossOrigin = 'anonymous'; }
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        // Ignoruj bardzo ciemne i bardzo jasne piksele
        const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
        if (brightness > 20 && brightness < 230) {
          r += data[i]; g += data[i+1]; b += data[i+2]; count++;
        }
      }
      if (count === 0) { callback(null); return; }
      r = Math.floor(r/count); g = Math.floor(g/count); b = Math.floor(b/count);
      // Wzmocnij nasycenie
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      const boost = max > 0 ? Math.min(255/max, 1.8) : 1;
      callback(`rgb(${Math.min(255,Math.floor(r*boost))},${Math.min(255,Math.floor(g*boost))},${Math.min(255,Math.floor(b*boost))})`);
    } catch { callback(null); }
  };
  img.onerror = () => callback(null);
  img.src = imgSrc;
}

// ─── Motywy ───────────────────────────────────────────────────
export const THEMES = [
  { id: 'fuchsia', label: 'Fuchsia', from: '#d946ef', to: '#6366f1' },
  { id: 'cyan',    label: 'Cyan',    from: '#06b6d4', to: '#3b82f6' },
  { id: 'green',   label: 'Neon',    from: '#22c55e', to: '#10b981' },
  { id: 'orange',  label: 'Amber',   from: '#f97316', to: '#f59e0b' },
  { id: 'rose',    label: 'Rose',    from: '#f43f5e', to: '#ec4899' },
];

export function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId || 'fuchsia');
}

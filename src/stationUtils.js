const STATION_GRADIENTS = [
  ['#7C3AED', '#2563EB'],
  ['#DB2777', '#9333EA'],
  ['#EA580C', '#DC2626'],
  ['#059669', '#0D9488'],
  ['#0891B2', '#4F46E5'],
  ['#CA8A04', '#EA580C'],
  ['#BE123C', '#7C3AED'],
  ['#4F46E5', '#9333EA'],
];

/** Usuwa emoji z nazw stacji, nie naruszając zwykłego tekstu. */
export function stripEmoji(value) {
  return String(value ?? '')
    .replace(/[#*0-9]\uFE0F?\u20E3/gu, '')
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*/gu, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function getStationInitial(name) {
  return stripEmoji(name).charAt(0).toLocaleUpperCase() || '♪';
}

/** Kolor stabilny dla danej stacji, aby placeholder nie zmieniał się między renderami. */
export function getStationPlaceholderStyle(station) {
  const seed = String(station?.slug || station?.id || station?.name || '?').toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const [from, to] = STATION_GRADIENTS[hash % STATION_GRADIENTS.length];
  return { background: `linear-gradient(135deg, ${from}, ${to})` };
}

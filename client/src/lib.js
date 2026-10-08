export function tileSrc(key) {
  if (!key) return '/assets/tiles/backs/back_green.png';
  const m = key.match(/^(wan|bamboo|dots)(\d)$/);
  if (m) return `/assets/tiles/${m[1]}/${m[1]}_${m[2]}.png`;
  if (['east', 'south', 'west', 'north'].includes(key)) return `/assets/tiles/winds/${key}.png`;
  if (['red', 'green', 'white'].includes(key)) return `/assets/tiles/dragons/${key}_dragon.png`;
  if (/^flower\d$/.test(key)) return `/assets/tiles/flowers/flower_${key.slice(-1)}.png`;
  return `/assets/tiles/seasons/${key}.png`;
}

export const TILE_NAMES = {
  east: 'East', south: 'South', west: 'West', north: 'North', red: 'Red Dragon', green: 'Green Dragon', white: 'White Dragon',
};
export function tileName(key) {
  const m = key?.match(/^(wan|bamboo|dots)(\d)$/);
  if (m) return `${m[2]} ${{ wan: 'Characters', bamboo: 'Bamboo', dots: 'Dots' }[m[1]]}`;
  return TILE_NAMES[key] || key;
}

export function formatTime(ms) {
  if (ms == null) return '--:--';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
export const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
export const val = (v) => (v == null ? '—' : v);

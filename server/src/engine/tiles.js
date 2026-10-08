// Tile definitions. Index 0-33 are playable tiles, 34-41 are bonus (flower/season) tiles.
import { randomInt } from 'node:crypto';

export const SUITS = ['wan', 'bamboo', 'dots'];
export const KEYS = [];
for (const s of SUITS) for (let n = 1; n <= 9; n++) KEYS.push(`${s}${n}`);
KEYS.push('east', 'south', 'west', 'north', 'red', 'green', 'white');
KEYS.push('flower1', 'flower2', 'flower3', 'flower4', 'spring', 'summer', 'autumn', 'winter');
export const IDX = Object.fromEntries(KEYS.map((k, i) => [k, i]));

export const WINDS = ['east', 'south', 'west', 'north'];
export const isBonusKey = (k) => IDX[k] >= 34;
export const isSuitIdx = (i) => i < 27;
export const isHonorIdx = (i) => i >= 27 && i < 34;
export const isTerminalIdx = (i) => i < 27 && (i % 9 === 0 || i % 9 === 8);
export const suitOf = (i) => (i < 27 ? Math.floor(i / 9) : -1);

/** Build a tile set. tileSet: 136 (no bonus tiles) or 144 (adds 4 flowers + 4 seasons). */
export function buildTileSet(tileSet = 136) {
  const tiles = [];
  let id = 0;
  for (let i = 0; i < 34; i++) for (let c = 0; c < 4; c++) tiles.push({ id: id++, key: KEYS[i] });
  if (tileSet === 144) for (let i = 34; i < 42; i++) tiles.push({ id: id++, key: KEYS[i] });
  return tiles;
}

/** Fisher-Yates with a cryptographically secure RNG (server-side only). */
export function shuffle(arr, rand = randomInt) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sortTiles = (tiles) => tiles.slice().sort((a, b) => IDX[a.key] - IDX[b.key] || a.id - b.id);

// Scoring engine (independent of UI and game flow).
// Supported scoring is deliberately a simplified, documented subset - see SCORING_RULES.
import { IDX, isSuitIdx, isHonorIdx, isTerminalIdx, suitOf, WINDS } from './tiles.js';
import { countsOf, decompositions, checkWin, shanten } from './hand.js';

export const SCORING_RULES = {
  supported: [
    { name: 'Winning hand', points: 30, note: 'Base for any valid win (4 sets + pair, Seven Pairs, Thirteen Orphans).' },
    { name: 'Self-drawn win', points: 10 },
    { name: 'Concealed hand', points: 20, note: 'No claimed melds (concealed Kongs allowed).' },
    { name: 'Dealer win', points: 10 },
    { name: 'All Chows', points: 20, note: 'Four Chows and a non-honor pair.' },
    { name: 'All Pongs', points: 40, note: 'Four Pongs/Kongs and a pair.' },
    { name: 'Mixed one suit', points: 40, note: 'One suit plus honors.' },
    { name: 'Pure one suit', points: 80 },
    { name: 'All honors', points: 120 },
    { name: 'Dragon Pong / Kong', points: 10, note: 'Each. Big Three Dragons = 60, Little Three Dragons = 30.' },
    { name: 'Seat wind / Round wind Pong', points: 10, note: 'Each (round wind is always East).' },
    { name: 'Kong', points: 10, note: 'Open Kong 10, concealed Kong 20, each.' },
    { name: 'Flower / Season tile', points: 5, note: 'Each (144-tile set only).' },
    { name: 'Last tile from the wall', points: 20, note: 'Self-drawn on the final wall tile.' },
    { name: 'Win on Kong replacement', points: 20 },
    { name: 'Seven Pairs', points: 60, note: 'Special hand.' },
    { name: 'Thirteen Orphans', points: 200, note: 'Special hand.' },
  ],
  loserScore: 'If you do not win, your score is "hand progress": 5 points for each step your hand is from being ready (0-40).',
  unsupported: [
    'Robbing a Kong',
    'Full MCR fan list (e.g. Pure Straight, Mixed Triple Chow, Four Concealed Pongs)',
    'Payment transfers between players (the score is a hand score, not a bankroll)',
    'Multiple rounds / dealer rotation',
  ],
};

/**
 * @param hand      tiles still concealed in the hand INCLUDING the winning tile
 * @param melds     [{type:'chow'|'pong'|'kong', tiles:[{key}], open:boolean}]
 * @param flowers   bonus tiles
 * @param ctx       {selfDrawn, seatWind, isDealer, lastTile, afterKong}
 */
export function scoreWin(hand, melds, flowers, ctx) {
  const counts = countsOf(hand);
  const winType = checkWin(counts, melds.length);
  if (!winType) return null;
  const items = [];
  const add = (label, points) => items.push({ label, points });
  add('Winning hand', 30);
  if (ctx.selfDrawn) add('Self-drawn win', 10);
  if (ctx.isDealer) add('Dealer win', 10);
  if (ctx.lastTile && ctx.selfDrawn) add('Last tile from the wall', 20);
  if (ctx.afterKong && ctx.selfDrawn) add('Win on Kong replacement', 20);
  if (flowers.length) add(`Flower/Season tiles ×${flowers.length}`, 5 * flowers.length);
  const claimed = melds.some((m) => m.open);
  if (!claimed) add('Concealed hand', 20);
  const kongOpen = melds.filter((m) => m.type === 'kong' && m.open).length;
  const kongHidden = melds.filter((m) => m.type === 'kong' && !m.open).length;
  if (kongOpen) add(`Open Kong ×${kongOpen}`, 10 * kongOpen);
  if (kongHidden) add(`Concealed Kong ×${kongHidden}`, 20 * kongHidden);

  if (winType === 'thirteenOrphans') {
    add('Thirteen Orphans', 200);
    return finish(items, winType);
  }
  if (winType === 'sevenPairs') {
    add('Seven Pairs', 60);
    const all = allTileIdx(counts, melds);
    suitBonus(all, add);
    return finish(items, winType);
  }

  // Regular hand: choose the best-scoring decomposition.
  const meldSets = melds.map((m) => ({ type: m.type === 'chow' ? 'chow' : 'pong', i: IDX[m.tiles[0].key], kong: m.type === 'kong' }));
  let best = null;
  for (const d of decompositions(counts, melds.length)) {
    const sets = [...meldSets, ...d.sets];
    const extra = [];
    const e = (label, points) => extra.push({ label, points });
    if (sets.every((s) => s.type === 'chow') && !isHonorIdx(d.pair)) e('All Chows', 20);
    if (sets.every((s) => s.type === 'pong')) e('All Pongs', 40);
    const pongs = sets.filter((s) => s.type === 'pong');
    const dragons = pongs.filter((s) => s.i >= 31).length;
    if (dragons === 3) e('Big Three Dragons', 60);
    else if (dragons === 2 && d.pair >= 31) { e('Little Three Dragons', 30); e('Dragon Pong ×2', 20); }
    else if (dragons) e(`Dragon Pong ×${dragons}`, 10 * dragons);
    const seat = IDX[ctx.seatWind];
    if (pongs.some((s) => s.i === seat)) e('Seat wind Pong', 10);
    if (pongs.some((s) => s.i === IDX.east)) e('Round wind Pong', 10);
    const tileIdx = [d.pair, d.pair];
    for (const s of sets) tileIdx.push(...(s.type === 'chow' ? [s.i, s.i + 1, s.i + 2] : [s.i, s.i, s.i]));
    suitBonus(tileIdx, e);
    const total = extra.reduce((a, x) => a + x.points, 0);
    if (!best || total > best.total) best = { total, extra };
  }
  items.push(...best.extra);
  return finish(items, winType);
}

function allTileIdx(counts, melds) {
  const out = [];
  counts.forEach((n, i) => { for (let k = 0; k < n; k++) out.push(i); });
  for (const m of melds) for (const t of m.tiles) out.push(IDX[t.key]);
  return out;
}

function suitBonus(idxs, add) {
  const suits = new Set(idxs.filter(isSuitIdx).map(suitOf));
  const hasHonor = idxs.some(isHonorIdx);
  if (suits.size === 0 && hasHonor) add('All honors', 120);
  else if (suits.size === 1 && !hasHonor) add('Pure one suit', 80);
  else if (suits.size === 1 && hasHonor) add('Mixed one suit', 40);
}

function finish(items, handType) {
  return { handType, items, total: items.reduce((a, x) => a + x.points, 0) };
}

/** Score for a seat that did not win: progress toward a ready hand. */
export function progressScore(hand, melds) {
  const counts = countsOf(hand);
  // Hand may hold one extra tile; use the best shanten after any single discard.
  const total = counts.reduce((a, b) => a + b, 0);
  let s;
  if (total % 3 === 2) {
    s = 8;
    for (let i = 0; i < 34; i++) if (counts[i]) { counts[i]--; s = Math.min(s, shanten(counts, melds.length)); counts[i]++; }
  } else s = shanten(counts, melds.length);
  const points = Math.max(0, 8 - Math.max(s, 0)) * 5;
  return { shanten: s, total: points, items: [{ label: `Hand progress (${s <= 0 ? 'ready' : s + ' away'})`, points }] };
}

export { WINDS };

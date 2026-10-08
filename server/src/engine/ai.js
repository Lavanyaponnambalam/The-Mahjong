// AI opponents. They only ever receive a "knowledge" object built from their own hand
// plus public information (discards and open melds) - never other players' hands or the wall.
import { IDX, KEYS, isSuitIdx, isHonorIdx, isTerminalIdx } from './tiles.js';
import { countsOf, shanten, checkWin } from './hand.js';

export const PERSONAS = {
  chen: {
    id: 'chen', name: 'Master Chen', emoji: '🧓', style: 'Strategic', avatar: '/assets/characters/ai_master_chen.png',
    lines: ['Patience wins the hand.', 'A quiet tile is a safe tile.', 'Hmm. Interesting.'],
  },
  panda: {
    id: 'panda', name: 'Lucky Panda', emoji: '🐼', style: 'Friendly', avatar: '/assets/characters/ai_panda.png',
    lines: ['Good luck, friend!', 'Ooh, snacks later!', 'I just like the shiny tiles.'],
  },
  ninja: {
    id: 'ninja', name: 'Tile Ninja', emoji: '😈', style: 'Aggressive', avatar: '/assets/characters/ai_tile_ninja.png',
    lines: ['Too slow.', 'Strike first.', 'No mercy at this table.'],
  },
};
export const AI_ORDER = ['chen', 'panda', 'ninja'];

const rnd = () => Math.random();
const idxOf = (t) => IDX[t.key];

function heuristicValue(i, counts, know) {
  const c = counts[i];
  let v = 0;
  if (c >= 3) v += 12;
  else if (c === 2) v += 7;
  if (isSuitIdx(i)) {
    const pos = i % 9;
    const at = (d) => (pos + d >= 0 && pos + d <= 8 ? counts[i + d] : 0);
    v += (at(-1) + at(1)) * 4 + (at(-2) + at(2)) * 2;
    if (pos >= 2 && pos <= 6) v += 1.5;
    if (isTerminalIdx(i)) v -= 1;
  } else {
    const valuable = i >= 31 || i === IDX[know.seatWind] || i === IDX.east;
    if (valuable) v += 2;
    if (c === 1) v -= 2;
  }
  return v;
}

function safety(i, know) {
  // Lower is safer. Tiles an opponent already discarded are the safest we can publicly know.
  if (know.recentDiscards.includes(KEYS[i])) return 0;
  if (isHonorIdx(i)) return know.remaining[i] <= 1 ? 1 : 2;
  if (isTerminalIdx(i)) return 3;
  return 5;
}

/** Choose a tile (id) to discard from a hand that has just gained a tile. */
export function chooseDiscard(know) {
  const { hand, difficulty, persona } = know;
  const counts = countsOf(hand);
  const distinct = [...new Set(hand.map(idxOf))].filter((i) => i < 34);
  const pickId = (i) => hand.find((t) => idxOf(t) === i).id;

  if (difficulty === 'easy' && rnd() < 0.35) return hand[Math.floor(rnd() * hand.length)].id;

  if (difficulty === 'easy' || difficulty === 'normal') {
    let best = null;
    for (const i of distinct) {
      const v = heuristicValue(i, counts, know) + (difficulty === 'easy' ? rnd() * 4 : rnd() * 0.5);
      if (!best || v < best.v) best = { i, v };
    }
    return pickId(best.i);
  }

  // Hard: minimise shanten, then maximise useful-tile count, then prefer safer discards.
  let best = null;
  const careful = persona !== 'ninja' && know.threat;
  for (const i of distinct) {
    counts[i]--;
    const s = shanten(counts, know.melds.length);
    let ukeire = 0;
    for (let j = 0; j < 34; j++) {
      if (know.remaining[j] <= 0 || j === i) continue;
      if (isSuitIdx(j)) {
        const pos = j % 9;
        let near = counts[j] > 0;
        for (let d = -2; d <= 2 && !near; d++) if (pos + d >= 0 && pos + d <= 8 && counts[j + d] > 0) near = true;
        if (!near) continue;
      } else if (counts[j] === 0) continue;
      counts[j]++;
      if (shanten(counts, know.melds.length) < s) ukeire += know.remaining[j];
      counts[j]--;
    }
    counts[i]++;
    const score = -s * 100 + ukeire * 2 - (careful ? safety(i, know) * 3 : safety(i, know) * 0.5) + heuristicValue(i, counts, know) * -0.2 + rnd() * 0.1;
    if (!best || score > best.score) best = { i, score };
  }
  return pickId(best.i);
}

function bestAfterClaim(counts, meldCount) {
  // Shanten after claiming (melds+1) and discarding the best tile.
  let best = 8;
  for (let i = 0; i < 34; i++) {
    if (!counts[i]) continue;
    counts[i]--;
    best = Math.min(best, shanten(counts, meldCount));
    counts[i]++;
  }
  return best;
}

/**
 * Decide whether to claim a discard. options = {win, pong, kong, chow:[[tileA,tileB],...]}.
 * Returns {type, tiles?} or null.
 */
export function decideClaim(know, tile, options) {
  if (options.win) return { type: 'win' };
  const { difficulty, persona } = know;
  const i = IDX[tile.key];
  const counts = countsOf(know.hand);
  const base = shanten(counts, know.melds.length);
  const valuable = i >= 31 || i === IDX[know.seatWind] || i === IDX.east;

  if (difficulty === 'easy') {
    if (options.pong && rnd() < (valuable ? 0.45 : 0.15)) return { type: 'pong' };
    if (options.chow?.length && rnd() < 0.1) return { type: 'chow', tiles: options.chow[0].map((t) => t.id) };
    return null;
  }

  const lean = persona === 'ninja' ? 1 : persona === 'panda' ? -1 : 0; // aggression
  const mustImprove = base >= 3 && !valuable && lean <= 0;
  if (mustImprove) return null;

  if (options.kong) {
    const c = counts.slice(); c[i] -= 3;
    if (shanten(c, know.melds.length + 1) <= base) return { type: 'kong' };
  }
  if (options.pong) {
    const c = counts.slice(); c[i] -= 2;
    const after = bestAfterClaim(c, know.melds.length + 1);
    if (after < base || (after === base && (valuable || lean > 0))) {
      if (persona !== 'panda' || after < base || rnd() < 0.6) return { type: 'pong' };
    }
  }
  if (options.chow?.length) {
    let pick = null;
    for (const combo of options.chow) {
      const c = counts.slice();
      combo.forEach((t) => c[idxOf(t)]--);
      const after = bestAfterClaim(c, know.melds.length + 1);
      if (!pick || after < pick.after) pick = { after, combo };
    }
    const need = difficulty === 'hard' ? base - 1 : base - (lean > 0 ? 0 : 1);
    if (pick && pick.after <= need && base <= 3) return { type: 'chow', tiles: pick.combo.map((t) => t.id) };
  }
  return null;
}

/** Concealed / added Kong decision on the AI's own turn. kongs=[{key, kind}] */
export function chooseKong(know, kongs) {
  if (know.difficulty === 'easy' || !kongs.length) return null;
  const counts = countsOf(know.hand);
  const base = shanten(counts, know.melds.length);
  for (const k of kongs) {
    if (k.kind === 'added') return k;
    const c = counts.slice(); c[IDX[k.key]] -= 4;
    if (shanten(c, know.melds.length + 1) <= base) return k;
  }
  return null;
}

export { checkWin };

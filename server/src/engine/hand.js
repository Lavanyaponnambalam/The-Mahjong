// Hand analysis: counts, win detection, decompositions, shanten.
import { IDX, isSuitIdx, isTerminalIdx, isHonorIdx } from './tiles.js';

export function countsOf(tiles) {
  const c = new Array(34).fill(0);
  for (const t of tiles) {
    const i = IDX[t.key];
    if (i < 34) c[i]++;
  }
  return c;
}

const canChow = (i) => isSuitIdx(i) && i % 9 <= 6;

function makeSets(c, n) {
  if (n === 0) return c.every((x) => x === 0);
  let i = 0;
  while (i < 34 && c[i] === 0) i++;
  if (i >= 34) return false;
  if (c[i] >= 3) {
    c[i] -= 3;
    const ok = makeSets(c, n - 1);
    c[i] += 3;
    if (ok) return true;
  }
  if (canChow(i) && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--;
    const ok = makeSets(c, n - 1);
    c[i]++; c[i + 1]++; c[i + 2]++;
    if (ok) return true;
  }
  return false;
}

export function isRegularWin(counts, meldCount = 0) {
  const need = 4 - meldCount;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== need * 3 + 2) return false;
  const c = counts.slice();
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) {
      c[p] -= 2;
      const ok = makeSets(c, need);
      c[p] += 2;
      if (ok) return true;
    }
  }
  return false;
}

export function isSevenPairs(counts) {
  let pairs = 0;
  for (const x of counts) {
    if (x === 2) pairs++;
    else if (x !== 0) return false;
  }
  return pairs === 7;
}

export function isThirteenOrphans(counts) {
  let pair = false;
  for (let i = 0; i < 34; i++) {
    const orphan = isTerminalIdx(i) || isHonorIdx(i);
    if (orphan) {
      if (counts[i] === 0 || counts[i] > 2) return false;
      if (counts[i] === 2) { if (pair) return false; pair = true; }
    } else if (counts[i] !== 0) return false;
  }
  return pair;
}

/** Returns 'regular' | 'sevenPairs' | 'thirteenOrphans' | null for a full winning hand. */
export function checkWin(counts, meldCount = 0) {
  if (isRegularWin(counts, meldCount)) return 'regular';
  if (meldCount === 0) {
    if (isSevenPairs(counts)) return 'sevenPairs';
    if (isThirteenOrphans(counts)) return 'thirteenOrphans';
  }
  return null;
}

/** All distinct decompositions into (4 - meldCount) sets + pair. Set = {type:'chow'|'pong', i}. */
export function decompositions(counts, meldCount = 0) {
  const need = 4 - meldCount;
  const out = new Map();
  const c = counts.slice();
  const walk = (n, sets, pair) => {
    if (n === 0) {
      if (c.every((x) => x === 0)) {
        const key = pair + '|' + sets.map((s) => s.type[0] + s.i).sort().join(',');
        out.set(key, { pair, sets: sets.slice() });
      }
      return;
    }
    let i = 0;
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) return;
    if (c[i] >= 3) {
      c[i] -= 3; sets.push({ type: 'pong', i });
      walk(n - 1, sets, pair);
      sets.pop(); c[i] += 3;
    }
    if (canChow(i) && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ type: 'chow', i });
      walk(n - 1, sets, pair);
      sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
    }
  };
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) {
      c[p] -= 2;
      walk(need, [], p);
      c[p] += 2;
    }
  }
  return [...out.values()];
}

/** Standard shanten for a 4-sets + pair hand (-1 = complete). meldCount = declared melds. */
export function shanten(counts, meldCount = 0) {
  const c = counts.slice();
  let best = 8;
  const dfs = (start, sets, partials, pair) => {
    let i = start;
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) {
      const s = sets + meldCount;
      const p = Math.min(partials, 4 - s);
      const v = 8 - 2 * s - p - (pair ? 1 : 0);
      if (v < best) best = v;
      return;
    }
    if (c[i] >= 3) { c[i] -= 3; dfs(i, sets + 1, partials, pair); c[i] += 3; }
    if (c[i] >= 2) {
      c[i] -= 2;
      if (!pair) dfs(i, sets, partials, true);
      dfs(i, sets, partials + 1, pair);
      c[i] += 2;
    }
    if (isSuitIdx(i)) {
      const pos = i % 9;
      if (pos <= 6 && c[i + 1] && c[i + 2]) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        dfs(i, sets + 1, partials, pair);
        c[i]++; c[i + 1]++; c[i + 2]++;
      }
      if (pos <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; dfs(i, sets, partials + 1, pair); c[i]++; c[i + 1]++; }
      if (pos <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; dfs(i, sets, partials + 1, pair); c[i]++; c[i + 2]++; }
    }
    c[i]--; dfs(i, sets, partials, pair); c[i]++;
  };
  dfs(0, 0, 0, false);
  return best;
}

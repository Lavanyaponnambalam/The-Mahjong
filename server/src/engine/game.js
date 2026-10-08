// Authoritative game engine: wall, deal, turns, claims (Chow/Pong/Kong), win detection and scoring.
// Pure logic - no I/O. The server persists `state` and exposes it through view.js.
// Seats are generic; a seat is human or AI, so human multiplayer can be added later.
import { randomInt } from 'node:crypto';
import { IDX, KEYS, WINDS, buildTileSet, shuffle, sortTiles, isBonusKey, isSuitIdx } from './tiles.js';
import { countsOf, checkWin } from './hand.js';
import { scoreWin, progressScore } from './scoring.js';
import { PERSONAS, AI_ORDER, chooseDiscard, decideClaim, chooseKong } from './ai.js';

export const RESERVE = 14;
export const MODES = {
  solo: { players: 4, label: 'Solo practice', difficulty: 'easy' },
  two: { players: 2, label: '2 players' },
  three: { players: 3, label: '3 players' },
  four: { players: 4, label: '4 players' },
};

export class RuleError extends Error {
  constructor(message) { super(message); this.code = 'ILLEGAL_ACTION'; }
}

export function newGame({ mode = 'four', difficulty = 'normal', tileSet = 136, humanSeat = 0, rand = randomInt } = {}) {
  const cfg = MODES[mode];
  if (!cfg) throw new RuleError('Unknown game mode');
  if (![136, 144].includes(tileSet)) throw new RuleError('Tile set must be 136 or 144');
  const n = cfg.players;
  const diff = cfg.difficulty || difficulty;
  if (!['easy', 'normal', 'hard'].includes(diff)) throw new RuleError('Unknown difficulty');
  const dealer = rand(0, n);
  const wall = shuffle(buildTileSet(tileSet), rand);
  let aiCount = 0;
  const seats = [];
  for (let s = 0; s < n; s++) {
    const human = s === humanSeat;
    seats.push({
      seat: s, human, persona: human ? null : AI_ORDER[aiCount++],
      wind: WINDS[(s - dealer + n) % n],
      hand: [], melds: [], flowers: [], discards: [],
    });
  }
  const state = {
    config: { mode, numPlayers: n, difficulty: diff, tileSet, humanSeat },
    wall, dealer, turn: dealer, phase: 'turn', seats,
    pending: null, lastDiscard: null, lastDrawn: null, drawnFromKong: false,
    moves: 0, log: [], result: null, thinkingFor: null,
  };
  // Deal 13 each in turn order (bonus tiles replaced from the back of the wall).
  for (let r = 0; r < 13; r++) for (let k = 0; k < n; k++) seats[(dealer + k) % n].hand.push(wall.shift());
  for (let k = 0; k < n; k++) replaceBonus(state, seats[(dealer + k) % n]);
  // Dealer receives the 14th tile.
  const d = seats[dealer];
  d.hand.push(wall.shift());
  replaceBonus(state, d);
  state.lastDrawn = d.hand[d.hand.length - 1].id;
  return state;
}

function replaceBonus(state, seat) {
  for (;;) {
    const i = seat.hand.findIndex((t) => isBonusKey(t.key));
    if (i < 0) return;
    const [t] = seat.hand.splice(i, 1);
    seat.flowers.push(t);
    const r = state.wall.pop();
    if (r) seat.hand.push(r);
  }
}

export const liveLeft = (state) => state.wall.length - RESERVE;
const nextSeat = (state, s) => (s + 1) % state.config.numPlayers;
const prevSeat = (state, s) => (s + state.config.numPlayers - 1) % state.config.numPlayers;
const isHuman = (state, s) => state.seats[s].human;

function record(state, seat, actionType, tile = null) {
  state.log.push({ seat, human: isHuman(state, seat), actionType, tile: tile ? tile.key ?? tile : null, at: Date.now() });
  // Move definition (used everywhere): each of the human's Draw, Discard, Chow, Pong, Kong, Mahjong actions.
  if (isHuman(state, seat) && ['draw', 'discard', 'chow', 'pong', 'kong', 'mahjong'].includes(actionType)) state.moves++;
}

const ev = (ctx, type, data = {}) => ctx?.emit?.({ type, ...data });

function take(seat, id) {
  const i = seat.hand.findIndex((t) => t.id === id);
  if (i < 0) throw new RuleError('Tile is not in your hand');
  return seat.hand.splice(i, 1)[0];
}

/** Draw a tile for `seat`; bonus tiles are replaced from the back. Returns the tile or null if the wall is empty. */
function draw(state, seat, ctx, fromBack = false) {
  const s = state.seats[seat];
  for (;;) {
    if (liveLeft(state) <= 0) return null;
    const t = fromBack ? state.wall.pop() : state.wall.shift();
    fromBack = true; // replacement draws always come from the back
    if (isBonusKey(t.key)) {
      s.flowers.push(t);
      record(state, seat, 'flower', t);
      ev(ctx, 'flower', { seat, tile: t });
      continue;
    }
    s.hand.push(t);
    return t;
  }
}

// ---------------------------------------------------------------- options

export function turnOptions(state, seat) {
  const s = state.seats[seat];
  const counts = countsOf(s.hand);
  const canWin = state.lastDrawn != null && !!checkWin(counts, s.melds.length);
  const kongs = [];
  counts.forEach((c, i) => { if (c === 4) kongs.push({ key: KEYS[i], kind: 'concealed' }); });
  for (const m of s.melds) if (m.type === 'pong' && counts[IDX[m.tiles[0].key]] >= 1) kongs.push({ key: m.tiles[0].key, kind: 'added' });
  return { canWin, kongs };
}

function claimOptionsFor(state, seat, tile, from) {
  const s = state.seats[seat];
  const counts = countsOf(s.hand);
  const i = IDX[tile.key];
  const opts = { win: false, pong: false, kong: false, chow: [] };
  const withTile = counts.slice(); withTile[i]++;
  opts.win = !!checkWin(withTile, s.melds.length);
  opts.pong = counts[i] >= 2;
  opts.kong = counts[i] >= 3 && liveLeft(state) > 0;
  if (seat === nextSeat(state, from) && isSuitIdx(i)) { // Chow only from the player on your left
    const pos = i % 9;
    const pick = (d) => s.hand.find((t) => IDX[t.key] === i + d);
    for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
      if (pos + a < 0 || pos + b > 8) continue;
      const ta = pick(a), tb = pick(b);
      if (ta && tb) opts.chow.push([ta, tb]);
    }
  }
  return opts;
}

export function claimOptionsView(state, seat) {
  const p = state.pending;
  if (!p || !p.options[seat]) return null;
  const o = p.options[seat];
  return { tile: p.tile, from: p.from, win: o.win, pong: o.pong, kong: o.kong, chow: o.chow.map((c) => c.map((t) => t.id)) };
}

function knowledge(state, seat) {
  const s = state.seats[seat];
  const remaining = new Array(34).fill(4);
  const see = (t) => { const i = IDX[t.key]; if (i < 34) remaining[i]--; };
  s.hand.forEach(see);
  for (const o of state.seats) {
    o.discards.forEach(see);
    for (const m of o.melds) {
      if (o.seat === seat || m.open) m.tiles.forEach((t) => see(t));
    }
  }
  const others = state.seats.filter((o) => o.seat !== seat);
  return {
    difficulty: state.config.difficulty, persona: s.persona, hand: s.hand, melds: s.melds,
    seatWind: s.wind, isDealer: seat === state.dealer, remaining,
    recentDiscards: others.flatMap((o) => o.discards.slice(-6).map((t) => t.key)),
    threat: others.some((o) => o.melds.length >= 2),
  };
}

// ---------------------------------------------------------------- actions

function discardTile(state, seat, id, ctx) {
  const s = state.seats[seat];
  const t = take(s, id);
  if (isBonusKey(t.key)) { s.hand.push(t); throw new RuleError('Bonus tiles cannot be discarded'); }
  s.discards.push(t);
  state.lastDiscard = { tile: t, from: seat };
  state.lastDrawn = null; state.drawnFromKong = false;
  record(state, seat, 'discard', t);
  ev(ctx, 'discard', { seat, tile: t });
  beginClaims(state, t, seat, ctx);
}

function kongFromTurn(state, seat, key, ctx) {
  const s = state.seats[seat];
  const opt = turnOptions(state, seat).kongs.find((k) => k.key === key);
  if (!opt) throw new RuleError('You cannot declare a Kong with that tile');
  if (liveLeft(state) <= 0) throw new RuleError('No tiles left for a replacement draw');
  if (opt.kind === 'concealed') {
    const tiles = s.hand.filter((t) => t.key === key);
    tiles.forEach((t) => take(s, t.id));
    s.melds.push({ type: 'kong', tiles, open: false });
  } else {
    const m = s.melds.find((x) => x.type === 'pong' && x.tiles[0].key === key);
    const t = s.hand.find((x) => x.key === key);
    take(s, t.id); m.tiles.push(t); m.type = 'kong';
  }
  record(state, seat, 'kong', key);
  ev(ctx, 'kong', { seat, key, kind: opt.kind });
  replacementDraw(state, seat, ctx);
}

function replacementDraw(state, seat, ctx) {
  const t = draw(state, seat, ctx, true);
  if (!t) return endDraw(state, ctx);
  state.lastDrawn = t.id; state.drawnFromKong = true;
  state.phase = 'turn'; state.turn = seat;
  ev(ctx, 'draw', { seat, tile: t, replacement: true });
}

function beginClaims(state, tile, from, ctx) {
  const options = {};
  const aiClaims = [];
  const n = state.config.numPlayers;
  for (let k = 1; k < n; k++) {
    const seat = (from + k) % n;
    const o = claimOptionsFor(state, seat, tile, from);
    if (!(o.win || o.pong || o.kong || o.chow.length)) continue;
    if (isHuman(state, seat)) options[seat] = o;
    else {
      const c = decideClaim(knowledge(state, seat), tile, o);
      if (c) aiClaims.push({ seat, ...c, order: k });
    }
  }
  const humanSeats = Object.keys(options).map(Number);
  const aiWin = aiClaims.some((c) => c.type === 'win');
  const humanCanWin = humanSeats.some((h) => options[h].win);
  if (humanSeats.length && !(aiWin && !humanCanWin)) {
    state.pending = { tile, from, options, aiClaims };
    state.phase = 'claim';
    return;
  }
  resolveClaims(state, tile, from, aiClaims, [], ctx);
}

const PRIORITY = { win: 3, kong: 2, pong: 2, chow: 1 };

function resolveClaims(state, tile, from, aiClaims, humanClaims, ctx) {
  state.pending = null;
  const n = state.config.numPlayers;
  const all = [...aiClaims, ...humanClaims.map((c) => ({ ...c, order: (c.seat - from + n) % n }))];
  all.sort((a, b) => PRIORITY[b.type] - PRIORITY[a.type] || a.order - b.order);
  const win = all[0];
  if (!win) {
    state.turn = nextSeat(state, from);
    state.phase = 'draw';
    return;
  }
  executeClaim(state, win, tile, from, ctx);
}

function executeClaim(state, c, tile, from, ctx) {
  const s = state.seats[c.seat];
  const src = state.seats[from];
  // The claimed tile leaves the discarder's pile - it becomes part of a meld (or the winning hand).
  src.discards.pop();
  state.lastDiscard = null;
  if (c.type === 'win') return declareWin(state, c.seat, { selfDrawn: false, tile, from }, ctx);
  let meld;
  if (c.type === 'pong' || c.type === 'kong') {
    const need = c.type === 'pong' ? 2 : 3;
    const own = s.hand.filter((t) => t.key === tile.key).slice(0, need);
    own.forEach((t) => take(s, t.id));
    meld = { type: c.type, tiles: [...own, tile], open: true, from };
  } else {
    const own = c.tiles.map((id) => take(s, id));
    meld = { type: 'chow', tiles: sortTiles([...own, tile]), open: true, from };
  }
  s.melds.push(meld);
  record(state, c.seat, c.type, tile);
  ev(ctx, c.type, { seat: c.seat, key: tile.key, from });
  state.turn = c.seat; state.lastDrawn = null; state.drawnFromKong = false;
  state.phase = 'turn';
  if (c.type === 'kong') replacementDraw(state, c.seat, ctx);
}

function declareWin(state, seat, { selfDrawn, tile, from }, ctx) {
  const s = state.seats[seat];
  if (!selfDrawn) s.hand.push(tile);
  const sc = scoreWin(s.hand, s.melds, s.flowers, {
    selfDrawn, seatWind: s.wind, isDealer: seat === state.dealer,
    lastTile: liveLeft(state) === 0, afterKong: state.drawnFromKong,
  });
  if (!sc) { if (!selfDrawn) s.hand.pop(); throw new RuleError('That is not a winning hand'); }
  record(state, seat, 'mahjong', tile ?? null);
  finish(state, { winner: seat, winType: selfDrawn ? 'self' : 'discard', from: selfDrawn ? null : from, winTile: tile?.key ?? null, sc }, ctx);
  ev(ctx, 'win', { seat, selfDrawn });
}

function endDraw(state, ctx) {
  finish(state, { winner: null, winType: 'draw' }, ctx);
  ev(ctx, 'drawGame', {});
}

function finish(state, { winner, winType, from = null, winTile = null, sc = null }, ctx) {
  state.phase = 'ended';
  state.pending = null;
  const scores = state.seats.map((s) => {
    if (s.seat === winner) return { seat: s.seat, total: sc.total, items: sc.items, handType: sc.handType, won: true };
    const p = progressScore(s.hand, s.melds);
    return { seat: s.seat, total: p.total, items: p.items, handType: null, won: false };
  });
  const h = state.config.humanSeat;
  state.result = {
    winner, winType, from, winTile, scores,
    humanScore: scores[h].total,
    humanResult: winner === h ? 'WIN' : winner == null ? 'DRAW' : 'LOSS',
  };
}

// ---------------------------------------------------------------- driver

function aiTurn(state, seat, ctx) {
  const s = state.seats[seat];
  const know = knowledge(state, seat);
  if (state.lastDrawn != null && checkWin(countsOf(s.hand), s.melds.length)) {
    const t = s.hand.find((x) => x.id === state.lastDrawn);
    return declareWin(state, seat, { selfDrawn: true, tile: t, from: null }, ctx);
  }
  const k = chooseKong(know, turnOptions(state, seat).kongs);
  if (k && liveLeft(state) > 0) return kongFromTurn(state, seat, k.key, ctx);
  discardTile(state, seat, chooseDiscard(know), ctx);
}

/** Advance the game until the human must decide something (or the game ends). */
export function run(state, ctx) {
  let guard = 0;
  while (state.phase !== 'ended' && guard++ < 500) {
    if (state.phase === 'draw') {
      const seat = state.turn;
      if (!isHuman(state, seat)) ev(ctx, 'thinking', { seat });
      const t = draw(state, seat, ctx);
      if (!t) { endDraw(state, ctx); break; }
      state.lastDrawn = t.id; state.drawnFromKong = false;
      record(state, seat, 'draw', t);
      ev(ctx, 'draw', { seat, tile: t });
      state.phase = 'turn';
    }
    if (state.phase === 'turn') {
      if (isHuman(state, state.turn)) break;
      if (state.lastDrawn == null) ev(ctx, 'thinking', { seat: state.turn });
      aiTurn(state, state.turn, ctx);
      continue;
    }
    if (state.phase === 'claim') break; // waiting for a human claim decision
  }
  return state;
}

/** Apply a human action. Throws RuleError for anything illegal. */
export function act(state, seat, action, ctx) {
  if (state.phase === 'ended') throw new RuleError('This game is over');
  if (!isHuman(state, seat)) throw new RuleError('Not a human seat');
  const { type } = action;
  if (state.phase === 'turn') {
    if (state.turn !== seat) throw new RuleError('It is not your turn');
    if (type === 'discard') {
      if (!Number.isInteger(action.tileId)) throw new RuleError('Choose a tile to discard');
      discardTile(state, seat, action.tileId, ctx);
    } else if (type === 'kong') kongFromTurn(state, seat, String(action.key), ctx);
    else if (type === 'win') {
      if (!turnOptions(state, seat).canWin) throw new RuleError('You do not have a winning hand');
      const t = state.seats[seat].hand.find((x) => x.id === state.lastDrawn);
      declareWin(state, seat, { selfDrawn: true, tile: t, from: null }, ctx);
    } else throw new RuleError('That action is not available right now');
  } else if (state.phase === 'claim') {
    const p = state.pending;
    const o = p?.options[seat];
    if (!o) throw new RuleError('You have no claim to make');
    let claim = null;
    if (type === 'pass') claim = null;
    else if (type === 'win' && o.win) claim = { seat, type: 'win' };
    else if (type === 'pong' && o.pong) claim = { seat, type: 'pong' };
    else if (type === 'kong' && o.kong) claim = { seat, type: 'kong' };
    else if (type === 'chow' && o.chow.length) {
      const ids = (action.tiles || []).map(Number).sort();
      const match = o.chow.find((c) => c.map((t) => t.id).sort().join() === ids.join());
      if (!match) throw new RuleError('Invalid Chow selection');
      claim = { seat, type: 'chow', tiles: match.map((t) => t.id) };
    } else throw new RuleError('That claim is not legal');
    resolveClaims(state, p.tile, p.from, p.aiClaims, claim ? [claim] : [], ctx);
  } else throw new RuleError('Nothing to do right now');
  return run(state, ctx);
}

export { PERSONAS };

import { db } from '../db.js';
import { newGame, act, run, RuleError, MODES } from '../engine/game.js';
import { viewFor, liveScoreFor } from '../engine/view.js';
import { PERSONAS } from '../engine/ai.js';
import { SCORING_RULES } from '../engine/scoring.js';
import { HttpError, getPlayer, playerDto } from './players.js';

const seatName = (state, seat, you = 'You') => (state.seats[seat].human ? you : PERSONAS[state.seats[seat].persona].name);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Turn an engine event into a status message (never reveals hidden tiles). */
function describe(state, e) {
  const who = e.seat != null ? seatName(state, e.seat) : '';
  const human = e.seat != null && state.seats[e.seat].human;
  const verb = (you, other) => (human ? `You ${you}` : `${who} ${other}`);
  switch (e.type) {
    case 'thinking': return `${who} is thinking...`;
    case 'draw': return e.replacement ? verb('drew a replacement tile.', 'drew a replacement tile.') : verb('drew a tile.', 'drew a tile.');
    case 'flower': return verb('drew a bonus tile and replaced it.', 'drew a bonus tile and replaced it.');
    case 'discard': return verb('discarded.', 'discarded a tile.');
    case 'chow': return verb('claimed a Chow!', 'claimed a Chow!');
    case 'pong': return verb('called Pong!', 'called Pong!');
    case 'kong': return verb('declared a Kong!', 'declared a Kong!');
    case 'win': return human ? 'MAHJONG!' : `${who} declared Mahjong!`;
    case 'drawGame': return 'The wall is empty - drawn game.';
    default: return '';
  }
}

function makeCtx(state, frames) {
  const seat = state.config.humanSeat;
  return {
    emit(e) {
      const frame = { event: { type: e.type, seat: e.seat ?? null, msg: describe(state, e) }, view: viewFor(state, seat) };
      // Public tile info only: discards, claims and bonus tiles; the human's own draw.
      if (['discard', 'flower'].includes(e.type) && e.tile) frame.event.tile = e.tile.key;
      if (['pong', 'chow', 'kong'].includes(e.type)) frame.event.tile = e.key;
      if (e.type === 'draw' && e.seat === seat && e.tile) frame.event.tile = e.tile.key;
      if (e.seat != null && !state.seats[e.seat].human && ['pong', 'chow', 'kong', 'win'].includes(e.type) && Math.random() < 0.5) {
        frame.event.chat = pick(PERSONAS[state.seats[e.seat].persona].lines);
      }
      frames.push(frame);
    },
  };
}

async function flushActions(conn, gameId, state, playerId) {
  const start = state.flushed || 0;
  const rows = state.log.slice(start).map((a) => [gameId, a.human ? playerId : null, a.seat, a.actionType, a.tile, new Date(a.at)]);
  if (rows.length) await conn.query('INSERT INTO game_actions (game_id, player_id, seat, action_type, tile, created_at) VALUES ?', [rows]);
  state.flushed = state.log.length;
}

const timing = (g) => ({ startedAt: new Date(g.started_at).getTime(), serverNow: Date.now() });

export async function startGame(playerId, { mode = 'four', difficulty = 'normal', tileSet = 136 } = {}) {
  const player = await getPlayer(playerId);
  if (!MODES[mode]) throw new HttpError(400, 'Unknown game mode.', 'BAD_MODE');
  let state;
  try { state = newGame({ mode, difficulty, tileSet: Number(tileSet) }); } catch (e) { throw new HttpError(400, e.message, 'BAD_CONFIG'); }
  const frames = [];
  run(state, makeCtx(state, frames));
  const startedAt = new Date();
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE games SET status='abandoned', state=NULL WHERE player_id=? AND status='active'", [player.playerId]);
    const [res] = await conn.query(
      'INSERT INTO games (player_id, game_mode, number_of_players, difficulty, tile_set, status, started_at, state) VALUES (?,?,?,?,?,?,?,?)',
      [player.playerId, mode, state.config.numPlayers, state.config.difficulty, state.config.tileSet, 'active', startedAt, null]);
    const gameId = res.insertId;
    await flushActions(conn, gameId, state, player.playerId);
    await conn.query('UPDATE games SET state=? WHERE game_id=?', [JSON.stringify(state), gameId]);
    await conn.commit();
    return { gameId, frames, view: viewFor(state, 0, { gameId, startedAt: startedAt.getTime(), serverNow: Date.now(), liveScore: liveScoreFor(state) }) };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

async function loadGame(conn, gameId, playerId, lock = false) {
  const [rows] = await conn.query(`SELECT * FROM games WHERE game_id = ? AND player_id = ?${lock ? ' FOR UPDATE' : ''}`, [Number(gameId) || 0, Number(playerId) || 0]);
  if (!rows[0]) throw new HttpError(404, 'Game not found.', 'GAME_NOT_FOUND');
  return rows[0];
}

export async function getGame(gameId, playerId) {
  const g = await loadGame(db(), gameId, playerId);
  if (g.status === 'active') {
    const state = JSON.parse(g.state);
    return { status: 'active', view: viewFor(state, state.config.humanSeat, { gameId: g.game_id, ...timing(g), liveScore: liveScoreFor(state) }) };
  }
  if (g.status === 'completed') return { status: 'completed', summary: JSON.parse(g.details), gameId: g.game_id };
  throw new HttpError(410, 'That game was abandoned.', 'GAME_ABANDONED');
}

export async function getActiveGame(playerId) {
  const [rows] = await db().query("SELECT game_id FROM games WHERE player_id=? AND status='active' ORDER BY game_id DESC LIMIT 1", [Number(playerId) || 0]);
  return rows[0] ? { gameId: rows[0].game_id } : null;
}

export async function performAction(gameId, playerId, action) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const g = await loadGame(conn, gameId, playerId, true);
    if (g.status !== 'active') throw new HttpError(409, 'This game is already finished.', 'GAME_FINISHED');
    const state = JSON.parse(g.state);
    const frames = [];
    const seat = state.config.humanSeat;
    const safe = { type: String(action?.type || ''), tileId: Number.isInteger(action?.tileId) ? action.tileId : undefined, key: action?.key, tiles: Array.isArray(action?.tiles) ? action.tiles : undefined };
    try { act(state, seat, safe, makeCtx(state, frames)); } catch (e) {
      if (e instanceof RuleError) throw new HttpError(400, e.message, e.code);
      throw e;
    }
    await flushActions(conn, g.game_id, state, g.player_id);
    let summary = null;
    if (state.phase === 'ended') summary = await completeGame(conn, g, state);
    else await conn.query('UPDATE games SET state=? WHERE game_id=?', [JSON.stringify(state), g.game_id]);
    await conn.commit();
    const extra = { gameId: g.game_id, ...timing(g), liveScore: liveScoreFor(state) };
    const last = frames.length ? frames[frames.length - 1] : null;
    if (summary) { extra.timeMs = summary.timeTaken; }
    const view = viewFor(state, seat, extra);
    if (last) last.view = view;
    return { frames, view, completed: !!summary, summary };
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

/** Finalise a game: the server computes time, moves and score - the client never supplies them. */
async function completeGame(conn, g, state) {
  const now = new Date();
  const timeMs = Math.max(0, now.getTime() - new Date(g.started_at).getTime());
  const r = state.result;
  const moves = state.moves;
  const score = r.humanScore;
  const [prows] = await conn.query('SELECT * FROM players WHERE player_id = ? FOR UPDATE', [g.player_id]);
  const before = playerDto(prows[0]);
  const won = r.humanResult === 'WIN';
  const prev = { score: before.bestScore, time: before.bestTime, moves: before.bestMoves };
  const next = { ...prev };
  const newBest = { score: false, time: false, moves: false };
  if (won) {
    if (prev.score == null || score > prev.score) { next.score = score; newBest.score = true; }
    if (prev.time == null || timeMs < prev.time) { next.time = timeMs; newBest.time = true; }
    if (prev.moves == null || moves < prev.moves) { next.moves = moves; newBest.moves = true; }
  }
  const gameNumber = before.gamesPlayed + 1;
  await conn.query(
    `UPDATE players SET games_played=games_played+1, games_won=games_won+?, games_lost=games_lost+?,
       best_score=?, best_time_ms=?, best_moves=?, total_score=total_score+?, total_moves=total_moves+?,
       total_play_time_ms=total_play_time_ms+?, last_played_at=? WHERE player_id=?`,
    [won ? 1 : 0, won ? 0 : 1, next.score, next.time, next.moves, score, moves, timeMs, now, g.player_id]);
  const winnerName = r.winner == null ? null : seatName(state, r.winner, before.username);
  const summary = {
    gameId: g.game_id, gameNumber, username: before.username, mode: g.game_mode, players: g.number_of_players, difficulty: g.difficulty,
    result: r.humanResult, score, timeTaken: timeMs, moves, winner: winnerName, winType: r.winType, winTile: r.winTile,
    completedAt: now.getTime(),
    breakdown: r.scores[state.config.humanSeat].items, handType: r.scores[state.config.humanSeat].handType,
    seats: state.seats.map((s) => ({ seat: s.seat, name: seatName(state, s.seat, before.username), emoji: s.persona ? PERSONAS[s.persona].emoji : '👤', score: r.scores[s.seat].total, won: r.scores[s.seat].won, items: r.scores[s.seat].items })),
    records: { previous: prev, current: next, newBest, anyNew: Object.values(newBest).some(Boolean), firstWin: won && prev.score == null },
    rules: { supported: SCORING_RULES.supported.map((x) => x.name), unsupported: SCORING_RULES.unsupported },
  };
  await conn.query(
    `UPDATE games SET status='completed', game_number=?, score=?, time_ms=?, moves=?, result=?, winner=?, completed_at=?, state=NULL, details=? WHERE game_id=?`,
    [gameNumber, score, timeMs, moves, r.humanResult, winnerName, now, JSON.stringify(summary), g.game_id]);
  return summary;
}

export async function gameDetails(gameId, playerId) {
  const g = await loadGame(db(), gameId, playerId);
  if (g.status !== 'completed') throw new HttpError(404, 'Game not completed.', 'GAME_NOT_COMPLETED');
  const [acts] = await db().query('SELECT seat, player_id, action_type, tile, created_at FROM game_actions WHERE game_id=? ORDER BY action_id', [g.game_id]);
  return { summary: JSON.parse(g.details), actions: acts.map((a) => ({ seat: a.seat, byPlayer: a.player_id != null, type: a.action_type, tile: a.tile, at: a.created_at })) };
}

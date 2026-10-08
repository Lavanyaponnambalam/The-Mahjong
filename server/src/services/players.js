import { db } from '../db.js';

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export function cleanUsername(raw) {
  const name = String(raw ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!name) throw new HttpError(400, 'Please enter a username.', 'USERNAME_REQUIRED');
  if ([...name].length > 20) throw new HttpError(400, 'Usernames can be up to 20 characters.', 'USERNAME_TOO_LONG');
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) throw new HttpError(400, 'Use letters, numbers, spaces, - _ . or \' only.', 'USERNAME_INVALID');
  return name;
}

export function playerDto(r) {
  if (!r) return null;
  return {
    playerId: r.player_id, username: r.username, createdAt: r.created_at, lastPlayedAt: r.last_played_at,
    gamesPlayed: r.games_played, gamesWon: r.games_won, gamesLost: r.games_lost,
    bestScore: r.best_score, bestTime: r.best_time_ms, bestMoves: r.best_moves,
    averageScore: r.games_played ? Math.round(r.total_score / r.games_played) : 0,
    totalMoves: r.total_moves, totalPlayTime: Number(r.total_play_time_ms),
  };
}

/** Find (case-insensitively) or create a player by username. */
export async function findOrCreatePlayer(rawName) {
  const username = cleanUsername(rawName);
  const key = username.toLowerCase();
  const pool = db();
  const [rows] = await pool.query('SELECT * FROM players WHERE username_key = ?', [key]);
  if (rows[0]) return { player: playerDto(rows[0]), created: false };
  try {
    const [res] = await pool.query('INSERT INTO players (username, username_key) VALUES (?, ?)', [username, key]);
    const [r] = await pool.query('SELECT * FROM players WHERE player_id = ?', [res.insertId]);
    return { player: playerDto(r[0]), created: true };
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') { // two tabs created the same name at once
      const [r] = await pool.query('SELECT * FROM players WHERE username_key = ?', [key]);
      return { player: playerDto(r[0]), created: false };
    }
    throw e;
  }
}

export async function getPlayer(id) {
  const [r] = await db().query('SELECT * FROM players WHERE player_id = ?', [Number(id) || 0]);
  if (!r[0]) throw new HttpError(404, 'Player not found.', 'PLAYER_NOT_FOUND');
  return playerDto(r[0]);
}

export async function listPlayers(ids) {
  const list = String(ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 24);
  if (!list.length) return [];
  const [rows] = await db().query('SELECT * FROM players WHERE player_id IN (?) ORDER BY last_played_at DESC, player_id', [list]);
  return rows.map(playerDto);
}

export async function getHistory(playerId, limit = 50, offset = 0) {
  const player = await getPlayer(playerId);
  const [rows] = await db().query(
    `SELECT game_id, game_number, game_mode, number_of_players, difficulty, score, time_ms, moves, result, winner, completed_at
       FROM games WHERE player_id = ? AND status = 'completed' ORDER BY game_id DESC LIMIT ? OFFSET ?`,
    [player.playerId, Math.min(Number(limit) || 50, 200), Number(offset) || 0]);
  return {
    player,
    games: rows.map((g) => ({
      gameId: g.game_id, gameNumber: g.game_number, mode: g.game_mode, players: g.number_of_players, difficulty: g.difficulty,
      score: g.score, timeTaken: g.time_ms, moves: g.moves, result: g.result, winner: g.winner, completedAt: g.completed_at,
    })),
  };
}

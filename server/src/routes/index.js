import { Router } from 'express';
import { findOrCreatePlayer, getPlayer, listPlayers, getHistory } from '../services/players.js';
import { startGame, getGame, getActiveGame, performAction, gameDetails } from '../services/games.js';
import { SCORING_RULES } from '../engine/scoring.js';
import { MODES } from '../engine/game.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((d) => d !== undefined && res.json(d)).catch(next);
export const api = Router();

api.get('/health', wrap(async () => ({ ok: true })));
api.get('/rules', wrap(async () => ({ scoring: SCORING_RULES, modes: MODES })));

// Players - identity is just a username (case-insensitive). No auth.
api.post('/players', wrap(async (req) => findOrCreatePlayer(req.body?.username)));
api.get('/players', wrap(async (req) => ({ players: await listPlayers(req.query.ids) })));
api.get('/players/:id', wrap(async (req) => ({ player: await getPlayer(req.params.id) })));
api.get('/players/:id/history', wrap(async (req) => getHistory(req.params.id, req.query.limit, req.query.offset)));
api.get('/players/:id/active-game', wrap(async (req) => ({ active: await getActiveGame(req.params.id) })));

// Games - the server owns the wall, the rules, the timer, the move count and the score.
api.post('/games', wrap(async (req) => startGame(req.body?.playerId, req.body || {})));
api.get('/games/:id', wrap(async (req) => getGame(req.params.id, req.query.playerId)));
api.get('/games/:id/details', wrap(async (req) => gameDetails(req.params.id, req.query.playerId)));
api.post('/games/:id/actions', wrap(async (req) => performAction(req.params.id, req.body?.playerId, req.body?.action)));

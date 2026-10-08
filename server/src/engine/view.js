// Builds the per-player view of a game. Hidden information (other hands, the wall) never leaves the server.
import { sortTiles } from './tiles.js';
import { liveLeft, turnOptions, claimOptionsView } from './game.js';
import { scoreWin, progressScore } from './scoring.js';
import { PERSONAS } from './ai.js';

const pub = (t) => ({ id: t.id, key: t.key });

export function viewFor(state, seatIdx, extra = {}) {
  const ended = state.phase === 'ended';
  const seats = state.seats.map((s) => {
    const you = s.seat === seatIdx;
    const reveal = you || ended;
    const p = s.persona ? PERSONAS[s.persona] : null;
    return {
      seat: s.seat, isYou: you, wind: s.wind, isDealer: s.seat === state.dealer,
      persona: p ? { id: p.id, name: p.name, emoji: p.emoji, style: p.style, avatar: p.avatar } : null,
      handCount: s.hand.length,
      hand: reveal ? sortTiles(s.hand).map(pub) : null,
      melds: s.melds.map((m) => ({
        type: m.type, open: m.open,
        tiles: m.open || reveal ? m.tiles.map(pub) : m.tiles.map((t) => ({ id: t.id, key: null })),
      })),
      flowers: s.flowers.map(pub),
      discards: s.discards.map(pub),
    };
  });
  const you = state.seats[seatIdx];
  const myTurn = state.phase === 'turn' && state.turn === seatIdx;
  const claim = state.phase === 'claim' ? claimOptionsView(state, seatIdx) : null;
  return {
    config: state.config, phase: state.phase, turn: state.turn, dealer: state.dealer,
    wallLeft: Math.max(0, liveLeft(state)), moves: state.moves,
    lastDiscard: state.lastDiscard ? { ...pub(state.lastDiscard.tile), from: state.lastDiscard.from } : null,
    seats,
    you: {
      seat: seatIdx, wind: you.wind,
      drawnId: myTurn ? state.lastDrawn : null,
      turnOptions: myTurn ? turnOptions(state, seatIdx) : null,
      claim,
    },
    result: ended ? state.result : null,
    ...extra,
  };
}

/** Live score preview for the human: the real win score if the hand is complete, otherwise hand progress. */
export function liveScoreFor(state) {
  if (state.phase === 'ended') return state.result.humanScore;
  const seat = state.config.humanSeat;
  const s = state.seats[seat];
  if (state.phase === 'turn' && state.turn === seat && turnOptions(state, seat).canWin) {
    const sc = scoreWin(s.hand, s.melds, s.flowers, { selfDrawn: true, seatWind: s.wind, isDealer: seat === state.dealer, lastTile: false, afterKong: state.drawnFromKong });
    if (sc) return sc.total;
  }
  return progressScore(s.hand, s.melds).total;
}

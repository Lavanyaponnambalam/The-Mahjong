import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTileSet, shuffle, IDX } from '../src/engine/tiles.js';
import { countsOf, checkWin, shanten, isRegularWin } from '../src/engine/hand.js';
import { scoreWin, progressScore } from '../src/engine/scoring.js';
import { newGame, act, run, turnOptions, RuleError, liveLeft, RESERVE } from '../src/engine/game.js';
import { viewFor } from '../src/engine/view.js';
import { chooseDiscard } from '../src/engine/ai.js';

const T = (...keys) => keys.map((key, id) => ({ id: 1000 + id, key }));
const c = (...keys) => countsOf(T(...keys));

test('tile sets: 136 and 144, shuffle keeps tiles', () => {
  assert.equal(buildTileSet(136).length, 136);
  assert.equal(buildTileSet(144).length, 144);
  const s = shuffle(buildTileSet(144));
  assert.deepEqual(s.map((t) => t.id).sort((a, b) => a - b), buildTileSet(144).map((t) => t.id));
});

test('win detection: regular, seven pairs, thirteen orphans, invalid', () => {
  const win = c('wan1','wan2','wan3','bamboo3','bamboo4','bamboo5','dots7','dots7','dots7','red','red','red','east','east');
  assert.equal(checkWin(win, 0), 'regular');
  assert.equal(checkWin(c('wan1','wan1','wan4','wan4','dots2','dots2','bamboo9','bamboo9','east','east','red','red','north','north'), 0), 'sevenPairs');
  assert.equal(checkWin(c('wan1','wan9','bamboo1','bamboo9','dots1','dots9','east','south','west','north','red','green','white','white'), 0), 'thirteenOrphans');
  assert.equal(checkWin(c('wan1','wan2','wan4','bamboo3','bamboo4','bamboo5','dots7','dots7','dots7','red','red','red','east','east'), 0), null);
  // with one declared meld, 11 concealed tiles are needed
  assert.ok(isRegularWin(c('wan1','wan2','wan3','bamboo3','bamboo4','bamboo5','dots7','dots7','dots7','east','east'), 1));
});

test('shanten', () => {
  assert.equal(shanten(c('wan1','wan2','wan3','bamboo3','bamboo4','bamboo5','dots7','dots7','dots7','red','red','red','east','east')), -1);
  assert.equal(shanten(c('wan1','wan2','wan3','bamboo3','bamboo4','bamboo5','dots7','dots7','dots7','red','red','red','east')), 0);
});

test('scoring: concealed all-pongs, pure suit, special hands', () => {
  const hand = T('wan1','wan1','wan1','wan2','wan2','wan2','wan3','wan3','wan3','wan5','wan5','wan5','wan9','wan9');
  const s = scoreWin(hand, [], [], { selfDrawn: true, seatWind: 'east', isDealer: false });
  const labels = s.items.map((i) => i.label);
  assert.ok(labels.includes('All Pongs') && labels.includes('Pure one suit') && labels.includes('Concealed hand'));
  assert.equal(s.total, s.items.reduce((a, i) => a + i.points, 0));
  const t = scoreWin(T('wan1','wan9','bamboo1','bamboo9','dots1','dots9','east','south','west','north','red','green','white','white'), [], [], { selfDrawn: false, seatWind: 'east' });
  assert.ok(t.items.some((i) => i.label === 'Thirteen Orphans'));
  assert.equal(scoreWin(T('wan1','wan2','wan4','bamboo3','bamboo4','bamboo5','dots7','dots7','dots7','red','red','red','east','east'), [], [], {}), null);
  assert.equal(progressScore(T('wan1','wan2','wan3','bamboo3','bamboo4','bamboo5','dots7','dots7','dots7','red','red','red','east'), []).total, 40);
});

function force(state, seat, keys) {
  const s = state.seats[seat];
  s.hand = keys.map((key, i) => ({ id: 5000 + seat * 100 + i, key }));
}

test('deal: dealer 14, others 13, wall size', () => {
  for (const [mode, n] of [['four', 4], ['three', 3], ['two', 2], ['solo', 4]]) {
    const g = newGame({ mode, tileSet: 136 });
    assert.equal(g.seats.length, n);
    g.seats.forEach((s) => assert.equal(s.hand.length + s.flowers.length * 0, s.seat === g.dealer ? 14 : 13));
    assert.equal(g.wall.length, 136 - 13 * n - 1);
  }
  const g = newGame({ mode: 'four', tileSet: 144 });
  g.seats.forEach((s) => assert.ok(s.hand.every((t) => IDX[t.key] < 34)));
});

test('illegal actions are rejected', () => {
  const g = newGame({ mode: 'four', humanSeat: 0 });
  g.dealer = 0; g.turn = 0; g.phase = 'turn'; g.lastDrawn = null;
  assert.throws(() => act(g, 0, { type: 'win' }), RuleError);
  assert.throws(() => act(g, 0, { type: 'discard', tileId: 99999 }), RuleError);
  assert.throws(() => act(g, 0, { type: 'kong', key: 'east' }), RuleError);
  assert.throws(() => act(g, 0, { type: 'pong' }), RuleError);
  g.turn = 1;
  assert.throws(() => act(g, 0, { type: 'discard', tileId: g.seats[0].hand[0].id }), RuleError);
});

test('Chow only from the left player; Pong from anyone; Kong gives replacement draw', () => {
  const mk = () => {
    const g = newGame({ mode: 'four', humanSeat: 0 });
    g.seats.forEach((s) => { s.melds = []; s.discards = []; });
    g.seats.forEach((s) => force(g, s.seat, ['wan1','wan4','wan7','bamboo2','bamboo5','bamboo8','dots3','dots6','dots9','south','west','north','green']));
    return g;
  };
  // seat 3 (left of seat 0) discards wan5; human has wan4 wan6 -> chow allowed
  let g = mk();
  force(g, 0, ['wan4','wan6','wan1','wan9','bamboo1','bamboo9','dots1','dots9','east','south','west','north','red']);
  g.dealer = 3; g.turn = 3; g.phase = 'turn'; g.lastDrawn = null;
  force(g, 3, ['wan5','wan9','bamboo1','bamboo9','dots1','dots9','east','south','west','north','red','green','white','white']);
  g.seats[3].hand[0] = { id: 9001, key: 'wan5' };
  // make AI seats unlikely to interfere by calling discard directly via act on a human-like seat 3
  g.seats[3].human = true; g.config.humanSeat = 3;
  g.seats[0].human = true;
  act(g, 3, { type: 'discard', tileId: 9001 });
  assert.equal(g.phase, 'claim');
  assert.equal(g.pending.options[0].chow.length, 1);
  // seat 2 is not next in line after the discarder (seat 0): no chow for them even with 4/6
  g = mk();
  force(g, 2, ['wan4','wan6','wan1','wan9','bamboo1','bamboo9','dots1','dots9','east','south','west','north','red']);
  g.seats[2].human = true; g.seats[0].human = true;
  g.dealer = 0; g.turn = 0; g.phase = 'turn'; g.lastDrawn = null;
  force(g, 0, ['wan5','wan9','bamboo1','bamboo9','dots1','dots9','east','south','west','north','red','green','white','white']);
  g.seats[0].hand[0] = { id: 9002, key: 'wan5' };
  act(g, 0, { type: 'discard', tileId: 9002 });
  assert.equal(g.pending?.options?.[2]?.chow?.length ?? 0, 0);
  // pong from anyone + open kong with replacement draw
  g = mk();
  force(g, 2, ['east','east','east','wan1','wan9','bamboo1','bamboo9','dots1','dots9','south','west','north','red']);
  g.seats[2].human = true; g.seats[0].human = true; g.config.humanSeat = 2;
  g.dealer = 0; g.turn = 0; g.phase = 'turn'; g.lastDrawn = null;
  force(g, 0, ['east','wan9','bamboo1','bamboo9','dots1','dots9','south','west','north','red','green','white','white','white']);
  g.seats[0].hand[0] = { id: 9003, key: 'east' };
  act(g, 0, { type: 'discard', tileId: 9003 });
  assert.ok(g.pending.options[2].pong && g.pending.options[2].kong);
  const wallBefore = g.wall.length;
  act(g, 2, { type: 'kong' });
  assert.equal(g.seats[2].melds[0].type, 'kong');
  assert.equal(g.seats[2].melds[0].tiles.length, 4);
  assert.equal(g.wall.length, wallBefore - 1);
  assert.equal(g.phase, 'turn'); assert.equal(g.turn, 2);
});

test('declaring Mahjong with a valid hand ends the game and scores it', () => {
  const g = newGame({ mode: 'four', humanSeat: 0 });
  g.dealer = 0; g.turn = 0; g.phase = 'turn';
  force(g, 0, ['wan1','wan2','wan3','bamboo3','bamboo4','bamboo5','dots7','dots7','dots7','red','red','red','east','east']);
  g.lastDrawn = g.seats[0].hand[13].id;
  assert.ok(turnOptions(g, 0).canWin);
  act(g, 0, { type: 'win' });
  assert.equal(g.phase, 'ended');
  assert.equal(g.result.humanResult, 'WIN');
  assert.ok(g.result.humanScore >= 30);
  assert.equal(g.moves, 1);
});

test('AI never sees hidden info in views; views hide opponents and wall', () => {
  const g = newGame({ mode: 'four', humanSeat: 0 });
  run(g, {});
  const v = viewFor(g, 0);
  assert.equal(v.seats[1].hand, null);
  assert.ok(Array.isArray(v.seats[0].hand));
  assert.equal(JSON.stringify(v).includes('"wall"'), false);
});

test('simulation: 300 random full games stay consistent', () => {
  let wins = 0, draws = 0, humanWins = 0;
  for (let n = 0; n < 300; n++) {
    const mode = ['four', 'three', 'two', 'solo'][n % 4];
    const g = newGame({ mode, difficulty: ['easy', 'normal', 'hard'][n % 3], tileSet: n % 2 ? 144 : 136, humanSeat: n % 3 === 0 ? 0 : 0 });
    run(g, {});
    let guard = 0;
    while (g.phase !== 'ended' && guard++ < 300) {
      const you = g.seats[0];
      if (g.phase === 'claim') {
        const o = g.pending.options[0];
        act(g, 0, o.win ? { type: 'win' } : { type: 'pass' });
      } else {
        const opts = turnOptions(g, 0);
        if (opts.canWin) act(g, 0, { type: 'win' });
        else {
          const know = { difficulty: 'normal', persona: 'chen', hand: you.hand, melds: you.melds, seatWind: you.wind, remaining: new Array(34).fill(2), recentDiscards: [], threat: false };
          act(g, 0, { type: 'discard', tileId: chooseDiscard(know) });
        }
      }
      const total = g.wall.length + g.seats.reduce((a, s) => a + s.hand.length + s.discards.length + s.flowers.length + s.melds.reduce((b, m) => b + m.tiles.length, 0), 0);
      assert.equal(total, g.config.tileSet);
    }
    assert.equal(g.phase, 'ended');
    if (g.result.winner == null) draws++; else { wins++; assert.ok(g.result.scores[g.result.winner].total >= 30); }
    if (g.result.humanResult === 'WIN') humanWins++;
    assert.ok(liveLeft(g) >= -1 && g.wall.length >= 0 && RESERVE === 14);
  }
  console.log({ wins, draws, humanWins });
});

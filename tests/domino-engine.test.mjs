import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeMoves,
  applyPass,
  estimateBeliefs,
  fullSet,
  initialGame,
  legalMovesFor,
  samplePossibleHands,
  seededRandom,
  engineTesting,
} from '../app/domino-engine.ts';

function placed(id, left, right, player = 0) {
  return { id, a: Math.min(left, right), b: Math.max(left, right), left, right, player };
}

function tile(a, b) {
  return { id: `${Math.min(a, b)}-${Math.max(a, b)}`, a: Math.min(a, b), b: Math.max(a, b) };
}

function playingGame(overrides = {}) {
  return {
    ...initialGame(),
    phase: 'playing',
    hands: [[tile(1, 5), tile(8, 9), tile(2, 2)], [tile(0, 2), tile(3, 3)], [tile(4, 6), tile(6, 7)]],
    chain: [placed('board', 1, 9)],
    current: 0,
    ...overrides,
  };
}

test('double-nine set contains 55 unique tiles', () => {
  const set = fullSet();
  assert.equal(set.length, 55);
  assert.equal(new Set(set.map(({ id }) => id)).size, 55);
});

test('legal moves are oriented correctly on both ends', () => {
  const game = playingGame();
  const moves = legalMovesFor(game.hands[0], game.chain);
  const left = moves.find((move) => move.tile.id === '1-5');
  const right = moves.find((move) => move.tile.id === '8-9');
  assert.deepEqual({ side: left.side, newLeft: left.newLeft, newRight: left.newRight }, { side: 'left', newLeft: 5, newRight: 9 });
  assert.deepEqual({ side: right.side, newLeft: right.newLeft, newRight: right.newRight }, { side: 'right', newLeft: 1, newRight: 8 });
});

test('a pass records both open values as certain voids', () => {
  const passed = applyPass(playingGame({ current: 1 }));
  assert.deepEqual([...passed.voids[1]].sort(), [1, 9]);
  assert.equal(passed.current, 2);
});

test('three passes use low pips and tied low totals score no point', () => {
  let game = playingGame({
    hands: [[tile(0, 4)], [tile(1, 3)], [tile(2, 3)]],
    chain: [placed('blocked', 8, 9)],
    scores: [2, 4, 6],
  });
  game = applyPass(game);
  game = applyPass(game);
  game = applyPass(game);
  assert.equal(game.phase, 'roundEnd');
  assert.equal(game.result.winner, null);
  assert.deepEqual(game.scores, [2, 4, 6]);
});

test('sampled hidden hands obey passes and never reuse known tiles', () => {
  const deck = fullSet();
  const game = playingGame({
    hands: [deck.slice(12, 22), deck.slice(22, 28), deck.slice(28, 35)],
    chain: [placed(deck[0].id, deck[0].a, deck[0].b)],
    voids: [new Set(), new Set([0]), new Set([9])],
  });
  const sampled = samplePossibleHands(game, 0, seededRandom('sampling-test'));
  assert.ok(sampled);
  assert.equal(sampled[1].length, 6);
  assert.equal(sampled[2].length, 7);
  assert.ok(sampled[1].every((candidate) => candidate.a !== 0 && candidate.b !== 0));
  assert.ok(sampled[2].every((candidate) => candidate.a !== 9 && candidate.b !== 9));
  const visibleAndSampled = [...sampled.flat(), ...game.chain];
  assert.equal(new Set(visibleAndSampled.map(({ id }) => id)).size, visibleAndSampled.length);
});

test('the analyzer does not change when the real hidden tile identities change', () => {
  const deck = fullSet().filter(({ id }) => !['1-5', '8-9', '2-2', 'board'].includes(id));
  const base = playingGame({ hands: [[tile(1, 5), tile(8, 9), tile(2, 2)], deck.slice(0, 4), deck.slice(4, 8)] });
  const alternate = { ...base, hands: [base.hands[0], deck.slice(12, 16), deck.slice(20, 24)] };
  const summarize = (game) => analyzeMoves(game, 70).map((move) => [move.tile.id, move.side, move.winRate, move.evidence.nextPassRate]);
  assert.deepEqual(summarize(base), summarize(alternate));
});

test('choosing one end is probabilistic evidence; only a pass is certain', () => {
  const event = { kind: 'play', player: 1, tile: tile(0, 1), side: 'left', endsBefore: [1, 9], nextVoids: [] };
  const game = playingGame({ events: [event] });
  const beforePass = estimateBeliefs(game, 0, 100).find(({ player }) => player === 1);
  assert.ok(!beforePass.certainOut.includes(9));
  const afterPass = estimateBeliefs({ ...game, voids: [new Set(), new Set([9]), new Set()] }, 0, 100).find(({ player }) => player === 1);
  assert.ok(afterPass.certainOut.includes(9));
});

test('known voids are reflected in simulated immediate-pass evidence', () => {
  const game = playingGame({
    hands: [[tile(1, 5), tile(1, 2)], [tile(3, 4), tile(4, 6)], [tile(0, 7), tile(2, 8)]],
    voids: [new Set(), new Set([5, 9]), new Set()],
  });
  const move = analyzeMoves(game, 80).find((candidate) => candidate.tile.id === '1-5');
  assert.ok(move.evidence.nextPassRate > 99);
});

test('the exact endgame solver finds a forced final-tile win', () => {
  const hands = [[tile(0, 1)], [tile(1, 2)], [tile(2, 3)]];
  const result = engineTesting.solveEndgame(hands, 0, 9, 0, 0, new Map());
  assert.equal(result.winner, 0);
  assert.equal(result.reason, 'empty');
});

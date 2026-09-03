import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeMoves,
  applyMove,
  applyPass,
  buildRoundReview,
  chooseCasualMove,
  chooseInformationSafeMove,
  createBeliefState,
  createDecisionRecord,
  createOpponentStyles,
  detectStrategicPhase,
  estimateBeliefs,
  fullSet,
  informationSafeMoveForecast,
  initialGame,
  legalMovesFor,
  mergeMoveAnalyses,
  samplePossibleHands,
  seededRandom,
  updateBeliefState,
  updateOpponentStyles,
  engineTesting,
} from '../app/domino-engine.ts';

function placed(id, left, right, player = 0) {
  return { id, a: Math.min(left, right), b: Math.max(left, right), left, right, player };
}

function tile(a, b) {
  return { id: `${Math.min(a, b)}-${Math.max(a, b)}`, a: Math.min(a, b), b: Math.max(a, b) };
}

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
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
  const summarize = (game) => analyzeMoves(game, 70).map((move) => [
    move.tile.id,
    move.side,
    move.winRate,
    move.evidence.nextPassRate,
    move.samples,
    move.treeSearch.informationSets,
    move.treeSearch.deepestPly,
  ]);
  assert.deepEqual(summarize(base), summarize(alternate));
});

test('persistent beliefs ignore the real hidden tile identities and survive unchanged state', () => {
  const ownHand = [tile(1, 5), tile(8, 9), tile(2, 2)];
  const deck = fullSet().filter(({ id }) => ![...ownHand.map((candidate) => candidate.id), '1-9'].includes(id));
  const base = playingGame({
    hands: [ownHand, deck.slice(0, 5), deck.slice(5, 10)],
    chain: [placed('1-9', 1, 9)],
  });
  const alternate = { ...base, hands: [ownHand, deck.slice(15, 20), deck.slice(25, 30)] };
  const first = createBeliefState(base, 0, 140);
  const second = createBeliefState(alternate, 0, 140);

  assert.deepEqual(first.particles, second.particles);
  assert.strictEqual(updateBeliefState(first, base, 0, 140), first);
  const ranked = analyzeMoves(base, 999, first);
  const search = ranked[0].treeSearch;
  assert.equal(ranked.reduce((sum, move) => sum + move.samples, 0), search.baseIterations);
  assert.equal(ranked.reduce((sum, move) => sum + move.treeSearch.visits, 0), search.extraIterations);
  assert.equal(search.uniqueDeals, Math.min(120, first.particles.length));
});

test('a pass eliminates impossible particles and replenishes a thin pool', () => {
  const deck = fullSet();
  const ownHand = deck.filter(({ a }) => a >= 2).slice(0, 10);
  const excluded = new Set([...ownHand.map(({ id }) => id), '0-1']);
  const available = deck.filter(({ id }) => !excluded.has(id));
  const passerHand = available.filter(({ a, b }) => a > 1 && b > 1).slice(0, 5);
  const used = new Set(passerHand.map(({ id }) => id));
  const otherHand = available.filter(({ id }) => !used.has(id)).slice(0, 5);
  const game = playingGame({
    hands: [ownHand, passerHand, otherHand],
    chain: [placed('0-1', 0, 1)],
    current: 1,
  });
  const beliefs = createBeliefState(game, 0, 240);
  const updated = updateBeliefState(beliefs, applyPass(game), 0, 240);

  assert.equal(updated.eventCount, 1);
  assert.equal(updated.hardEvidenceUpdates, 1);
  assert.ok(updated.particles.every((particle) => particle.hands[1].every(({ a, b }) => a > 1 && b > 1)));
  assert.ok(updated.diagnostics.eliminatedLastUpdate > 0);
  assert.equal(updated.diagnostics.resampledLastUpdate, true);
  assert.equal(updated.diagnostics.particleCount, 240);
  assert.notEqual(updated.diagnostics.confidence, 'low');
});

test('an observed tile reweights ownership-consistent particles and removes the public tile', () => {
  const ownHand = [tile(0, 0), tile(2, 2), tile(3, 3), tile(4, 4), tile(5, 5)];
  const playerHand = [tile(1, 4), tile(2, 6), tile(6, 8), tile(7, 7), tile(0, 3)];
  const excluded = new Set([...ownHand, ...playerHand, tile(1, 9)].map(({ id }) => id));
  const otherHand = fullSet().filter(({ id }) => !excluded.has(id)).slice(0, 5);
  const game = playingGame({
    hands: [ownHand, playerHand, otherHand],
    chain: [placed('1-9', 1, 9)],
    current: 1,
  });
  const beliefs = createBeliefState(game, 0, 240);
  const observedMove = legalMovesFor(playerHand, game.chain).find(({ tile: candidate }) => candidate.id === '1-4');
  const updated = updateBeliefState(beliefs, applyMove(game, observedMove), 0, 240);

  assert.equal(updated.choiceUpdates, 1);
  assert.equal(updated.diagnostics.reweightedLastUpdate, 1);
  assert.ok(updated.diagnostics.eliminatedLastUpdate > 0);
  assert.ok(updated.particles.every((particle) => particle.hands.every((hand) => hand.every(({ id }) => id !== '1-4'))));
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

test('strategy phases follow the state of the round', () => {
  const deck = fullSet();
  const opening = playingGame({
    hands: [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)],
    chain: [],
  });
  const middle = playingGame({
    hands: [deck.slice(0, 6), deck.slice(10, 16), deck.slice(20, 26)],
  });
  const late = playingGame({
    hands: [deck.slice(0, 4), deck.slice(10, 15), deck.slice(20, 25)],
  });
  const block = playingGame({
    hands: [deck.slice(0, 6), deck.slice(10, 16), deck.slice(20, 26)],
    consecutivePasses: 2,
  });

  assert.equal(detectStrategicPhase(opening), 'opening');
  assert.equal(detectStrategicPhase(middle), 'middle');
  assert.equal(detectStrategicPhase(late), 'late');
  assert.equal(detectStrategicPhase(block), 'block');
});

test('phase-aware strategy creates two proven unavailable ends', () => {
  const userHand = [tile(3, 6), tile(2, 3), tile(8, 9), tile(1, 1)];
  const excluded = new Set([...userHand.map(({ id }) => id), '3-8']);
  const available = fullSet().filter(({ id }) => !excluded.has(id));
  const game = playingGame({
    hands: [userHand, available.slice(0, 5), available.slice(5, 10)],
    chain: [placed('3-8', 3, 8, 2)],
    voids: [new Set(), new Set([6, 8]), new Set()],
  });
  const chosen = chooseCasualMove(game, legalMovesFor(userHand, game.chain));

  assert.equal(`${chosen.tile.id}:${chosen.side}`, '3-6:left');
  assert.equal(detectStrategicPhase(game), 'late');
});

test('three-turn search forecasts replies and a route back to the board', () => {
  const ownHand = [tile(0, 0), tile(3, 4), tile(5, 8), tile(0, 7), tile(3, 3), tile(1, 1)];
  const excluded = new Set([...ownHand.map(({ id }) => id), '3-5']);
  const available = fullSet().filter(({ id }) => !excluded.has(id));
  const game = playingGame({
    hands: [ownHand, available.slice(0, 5), available.slice(5, 10)],
    chain: [placed('3-5', 5, 3, 2)],
  });
  const moves = legalMovesFor(ownHand, game.chain);
  const forecasts = moves.map((move) => ({ move, forecast: informationSafeMoveForecast(game, move) }));
  const vulnerable = forecasts.find(({ move }) => move.tile.id === '3-4');
  const selected = chooseInformationSafeMove(game, moves);

  assert.ok(forecasts.every(({ forecast }) => forecast.plies === 3));
  assert.ok(forecasts.every(({ forecast }) => forecast.exploredBranches > 1));
  assert.ok(forecasts.every(({ forecast }) => forecast.returnRate >= 0 && forecast.returnRate <= 1));
  assert.ok(vulnerable.forecast.returnRate < 0.5);
  assert.equal(`${selected.tile.id}:${selected.side}`, '5-8:left');
});

test('three-turn search cannot see real opponent tile identities', () => {
  const ownHand = [tile(0, 0), tile(3, 4), tile(5, 8), tile(0, 7), tile(3, 3), tile(1, 1)];
  const excluded = new Set([...ownHand.map(({ id }) => id), '3-5']);
  const available = fullSet().filter(({ id }) => !excluded.has(id));
  const base = playingGame({
    hands: [ownHand, available.slice(0, 5), available.slice(5, 10)],
    chain: [placed('3-5', 5, 3, 2)],
  });
  const alternate = { ...base, hands: [ownHand, available.slice(15, 20), available.slice(25, 30)] };
  const summarize = (game) => {
    const moves = legalMovesFor(game.hands[0], game.chain);
    return {
      forecasts: moves.map((move) => [`${move.tile.id}:${move.side}`, informationSafeMoveForecast(game, move)]),
      choice: (() => {
        const chosen = chooseInformationSafeMove(game, moves);
        return `${chosen.tile.id}:${chosen.side}`;
      })(),
    };
  };

  assert.deepEqual(summarize(base), summarize(alternate));
});

test('information-set tree search grows beyond three turns and focuses visits', () => {
  const ownHand = [tile(1, 5), tile(1, 7), tile(1, 9), tile(3, 9), tile(5, 8), tile(2, 2), tile(4, 6), tile(0, 3), tile(6, 8), tile(7, 7)];
  const available = fullSet().filter(({ id }) => !ownHand.some((candidate) => candidate.id === id));
  const game = playingGame({
    hands: [ownHand, available.slice(0, 10), available.slice(10, 20)],
    chain: [placed('board', 1, 9, 2)],
  });
  const ranked = analyzeMoves(game, 80);
  const search = ranked[0].treeSearch;
  const visits = ranked.map((move) => move.treeSearch.visits);

  assert.ok(search.deepestPly > 3);
  assert.ok(search.informationSets > ranked.length);
  assert.ok(search.uniqueDeals > 1);
  assert.ok(search.averageTreePlies > 1);
  assert.ok(search.averageTreePlies <= search.deepestPly);
  assert.ok(search.revisitedActionRate > 0 && search.revisitedActionRate <= 1);
  assert.ok(search.multiVisitInformationSets > 0);
  assert.equal(visits.reduce((sum, count) => sum + count, 0), search.extraIterations);
  const pairedBaseVisits = search.baseIterations / ranked.length;
  assert.ok(Number.isInteger(pairedBaseVisits));
  assert.ok(ranked.every((move) => move.samples === pairedBaseVisits));
  assert.ok(ranked.every((move) => move.treeSearch.pairedBaseWins.length === pairedBaseVisits));
  assert.ok(ranked.every((move) => move.treeSearch.pairedBaseWeights.length === pairedBaseVisits));
  assert.ok(ranked.every((move) => move.treeSearch.pairedBaseWins.every((value) => value === 0 || value === 1)));
  assert.ok(Math.max(...visits) > 0);
  assert.ok(visits.filter((count) => count > 0).length <= 2);
});

test('close information-set decisions receive an additional simulation budget', () => {
  const ownHand = [tile(1, 5), tile(1, 7), tile(1, 9), tile(3, 9), tile(5, 8), tile(2, 2), tile(4, 6), tile(0, 3), tile(6, 8), tile(7, 7)];
  const available = fullSet().filter(({ id }) => !ownHand.some((candidate) => candidate.id === id));
  const game = playingGame({
    hands: [ownHand, available.slice(0, 10), available.slice(10, 20)],
    chain: [placed('board', 1, 9, 2)],
  });
  const first = analyzeMoves(game, 80);
  const second = analyzeMoves(game, 80);

  assert.equal(first[0].treeSearch.closeDecision, true);
  assert.ok(first[0].treeSearch.extraIterations > 0);
  assert.deepEqual(
    first.map((move) => [moveKey(move), move.winRate, move.samples, move.treeSearch.averageUtility]),
    second.map((move) => [moveKey(move), move.winRate, move.samples, move.treeSearch.averageUtility]),
  );
});

test('the exact endgame solver finds a forced final-tile win', () => {
  const hands = [[tile(0, 1)], [tile(1, 2)], [tile(2, 3)]];
  const result = engineTesting.solveEndgame(hands, 0, 9, 0, 0, new Map());
  assert.equal(result.winner, 0);
  assert.equal(result.reason, 'empty');
});

test('tree utility matches the one-point round scoring rule', () => {
  assert.deepEqual(engineTesting.outcomeUtility({ winner: 1, reason: 'empty', nextPlayerPassed: false, pips: [3, 0, 7] }), [0, 1, 0]);
  assert.deepEqual(engineTesting.outcomeUtility({ winner: null, reason: 'blocked', nextPlayerPassed: false, pips: [5, 5, 12] }), [0, 0, 0]);
});

test('opponent style learning uses only public events and sampled hands', () => {
  const ownHand = [tile(0, 0), tile(2, 2), tile(3, 3), tile(4, 4), tile(5, 5)];
  const firstHidden = [tile(1, 4), tile(1, 6), tile(2, 9), tile(5, 8), tile(7, 7)];
  const excluded = new Set([...ownHand, ...firstHidden, tile(1, 9)].map(({ id }) => id));
  const available = fullSet().filter(({ id }) => !excluded.has(id));
  const base = playingGame({
    hands: [ownHand, firstHidden, available.slice(0, 5)],
    chain: [placed('1-9', 1, 9, 2)],
    current: 1,
  });
  const alternateHidden = [tile(1, 4), ...available.slice(10, 14)];
  const alternate = { ...base, hands: [ownHand, alternateHidden, available.slice(20, 25)] };
  const observed = legalMovesFor(firstHidden, base.chain).find((move) => move.tile.id === '1-4' && move.side === 'left');
  const alternateObserved = legalMovesFor(alternateHidden, alternate.chain).find((move) => move.tile.id === '1-4' && move.side === 'left');
  const afterBase = applyMove(base, observed);
  const afterAlternate = applyMove(alternate, alternateObserved);
  const baseBeliefs = createBeliefState(afterBase, 0, 90);
  const alternateBeliefs = createBeliefState(afterAlternate, 0, 90);
  const learned = updateOpponentStyles(createOpponentStyles(), afterBase, baseBeliefs);
  const learnedAlternate = updateOpponentStyles(createOpponentStyles(), afterAlternate, alternateBeliefs);

  assert.deepEqual(learned, learnedAlternate);
  assert.equal(learned.find(({ player }) => player === 1).observedChoices, 1);
  assert.equal(learned.find(({ player }) => player === 1).lastEventCount, 1);
});

test('decision records contain information-safe evidence and ignore real hidden identities', () => {
  const ownHand = [tile(1, 5), tile(8, 9), tile(2, 2)];
  const available = fullSet().filter(({ id }) => ![...ownHand.map((candidate) => candidate.id), '1-9'].includes(id));
  const base = playingGame({ hands: [ownHand, available.slice(0, 4), available.slice(4, 8)], chain: [placed('1-9', 1, 9)] });
  const alternate = { ...base, hands: [ownHand, available.slice(12, 16), available.slice(20, 24)] };
  const firstBeliefs = createBeliefState(base, 0, 36);
  const secondBeliefs = createBeliefState(alternate, 0, 36);
  const firstRanked = analyzeMoves(base, 36, firstBeliefs, undefined, { representativeLimit: 24 });
  const secondRanked = analyzeMoves(alternate, 36, secondBeliefs, undefined, { representativeLimit: 24 });
  const firstReads = estimateBeliefs(base, 0, 36, firstBeliefs);
  const secondReads = estimateBeliefs(alternate, 0, 36, secondBeliefs);
  const firstRecord = createDecisionRecord(base, firstRanked, firstRanked.at(-1), firstReads, firstBeliefs);
  const secondRecord = createDecisionRecord(alternate, secondRanked, secondRanked.at(-1), secondReads, secondBeliefs);

  assert.deepEqual(firstRecord, secondRecord);
  const serialized = JSON.stringify(firstRecord);
  assert.ok(!serialized.includes(`\"id\":\"${available[0].id}\"`));
  assert.equal(firstRecord.options[0].pairedWins.length, 24);
});

test('post-round review separates confident mistakes from revealed hindsight', () => {
  const option = (key, a, b, wins) => ({
    key,
    tile: tile(a, b),
    side: 'left',
    newLeft: b,
    newRight: 9,
    winRate: wins[0] * 100,
    margin: 0,
    samples: wins.length,
    nextPassRate: a === 1 ? 70 : 20,
    blockedWinRate: 10,
    emptyWinRate: 40,
    averagePipsWhenLosing: 12,
    retainedEndMatches: a === 1 ? 2 : 0,
    returnRate: a === 1 ? 0.7 : 0.2,
    pairedWins: wins,
    pairedWeights: wins.map(() => 1),
  });
  const best = option('1-5:left', 1, 5, Array(12).fill(1));
  const chosen = option('1-2:left', 1, 2, Array(12).fill(0));
  const record = {
    id: 'review-1',
    round: 1,
    eventCount: 0,
    phase: 'middle',
    hand: [tile(1, 5), tile(1, 2)],
    handSizes: [2, 2, 2],
    ends: [1, 9],
    chosenKey: chosen.key,
    bestKey: best.key,
    options: [best, chosen],
    knownEvidence: [],
    inferredEvidence: ['Rosa looked less likely to hold 9.'],
    beliefs: [{ player: 1, certainOut: [], softReads: [{ value: 9, direction: 'less', probability: 0.25, strength: 'moderate' }] }],
    beliefConfidence: 'high',
    recommendationReason: 'The stronger move preserved control.',
  };
  const finalGame = playingGame({
    phase: 'roundEnd',
    hands: [[tile(0, 0)], [tile(3, 9)], [tile(4, 4)]],
    events: [],
    result: { winner: 2, reason: 'empty', pips: [0, 12, 8], matchWinner: null },
  });
  const review = buildRoundReview(finalGame, [record]);

  assert.equal(review.biggestMistake.verdict, 'big-mistake');
  assert.equal(review.biggestMistake.interval[0], 100);
  assert.match(review.biggestMistake.revealed, /did hold 9/);
  assert.deepEqual(review.beliefChecks, { correct: 0, total: 1 });
});

test('multicore analysis shards merge to the same paired release evaluation', () => {
  const ownHand = [tile(1, 5), tile(1, 7), tile(8, 9), tile(2, 2)];
  const available = fullSet().filter(({ id }) => ![...ownHand.map((candidate) => candidate.id), '1-9'].includes(id));
  const game = playingGame({ hands: [ownHand, available.slice(0, 5), available.slice(5, 10)], chain: [placed('1-9', 1, 9)] });
  const beliefs = createBeliefState(game, 0, 30);
  const single = analyzeMoves(game, 30, beliefs, undefined, { representativeLimit: 24 });
  const merged = mergeMoveAnalyses(Array.from({ length: 3 }, (_, shardIndex) => analyzeMoves(
    game,
    30,
    beliefs,
    undefined,
    { representativeLimit: 24, shardIndex, shardCount: 3 },
  )));

  assert.deepEqual(merged.map(moveKey), single.map(moveKey));
  merged.forEach((move, index) => {
    assert.ok(Math.abs(move.winRate - single[index].winRate) < 1e-9);
    assert.equal(move.samples, 24);
    assert.equal(move.treeSearch.pairedBaseWins.length, 24);
    assert.equal(move.treeSearch.pairedBaseWeights.length, 24);
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeMoves,
  createBeliefState,
} from '../app/domino-engine.ts';
import { informationSafeBenchmarkGame } from '../scripts/analyzer-reliability-core.mjs';
import {
  collectRootRacingCorpus,
  evaluateRootRacingPosition,
  rankedMovePrefix,
  replayRootRace,
  requiredRootRacingSamples,
  selectRootRacingSurvivors,
} from '../scripts/root-racing-core.mjs';

function fakeMove(index, wins) {
  return {
    tile: { id: `${index}-${index}`, a: index, b: index },
    side: 'left',
    placedLeft: index,
    placedRight: index,
    newLeft: index,
    newRight: index,
    samples: wins.length,
    effectiveSamples: wins.length,
    winRate: wins.reduce((sum, won) => sum + won, 0) / wins.length * 100,
    margin: 0,
    heuristic: -index,
    lookahead: { score: -index, returnRate: 0, exploredBranches: 0, plies: 3 },
    treeSearch: {
      visits: 0,
      averageUtility: 0,
      informationSets: 0,
      multiVisitInformationSets: 0,
      deepestPly: 0,
      averageTreePlies: 0,
      revisitedActionRate: 0,
      uniqueDeals: wins.length,
      baseIterations: wins.length,
      extraIterations: 0,
      closeDecision: false,
      pairedBaseWins: wins,
      pairedBaseWeights: wins.map(() => 1),
      pairedTreeWins: [],
    },
    evidence: {
      nextPassRate: 0,
      blockedWinRate: 0,
      emptyWinRate: 0,
      averagePipsWhenLosing: 0,
      retainedEndMatches: 0,
    },
  };
}

function fixtureMoves(samples = 30) {
  return [
    fakeMove(0, Array(samples).fill(1)),
    fakeMove(1, Array.from({ length: samples }, (_, index) => index % 2)),
    fakeMove(2, Array(samples).fill(0)),
    fakeMove(3, Array(samples).fill(0)),
    fakeMove(4, Array(samples).fill(0)),
  ];
}

const raceConfig = {
  id: 'test-race',
  initialSamples: 4,
  minimumSurvivors: 2,
  practicalGap: 1,
  minimumGap: 3,
  batches: 2,
  minimumPositiveBatchAgreement: 1,
  minimumPracticalBatchAgreement: 1,
};

test('root racing spends the exact fixed root budget and retains its protected finalists', () => {
  const raced = replayRootRace(fixtureMoves(), raceConfig, 10);
  assert.equal(raced.rootEvaluations, 50);
  assert.deepEqual(raced.survivorKeys, ['0-0:left', '1-1:left']);
  assert.equal(Object.values(raced.allocations).reduce((sum, value) => sum + value, 0), 38);
  assert.equal(raced.ranked[0].samples, 19);
  assert.equal(requiredRootRacingSamples(5, raceConfig, 10), 19);
});

test('root racing exactly reproduces fixed sampling when no move is eliminated', () => {
  const full = fixtureMoves();
  const config = { ...raceConfig, minimumGap: 200 };
  const raced = replayRootRace(full, config, 10);
  const control = rankedMovePrefix(full, 10);
  assert.deepEqual(raced.survivorKeys.sort(), control.map((move) => `${move.tile.id}:${move.side}`).sort());
  assert.deepEqual(
    raced.ranked.map((move) => ({ key: `${move.tile.id}:${move.side}`, wins: move.treeSearch.pairedBaseWins })),
    control.map((move) => ({ key: `${move.tile.id}:${move.side}`, wins: move.treeSearch.pairedBaseWins })),
  );
});

test('survivor selection cannot inspect outcomes after the first-stage prefix', () => {
  const first = fixtureMoves();
  const altered = first.map((move) => ({
    ...move,
    treeSearch: {
      ...move.treeSearch,
      pairedBaseWins: move.treeSearch.pairedBaseWins.map((won, index) => (
        index < raceConfig.initialSamples ? won : 1 - won
      )),
    },
  }));
  assert.deepEqual(
    selectRootRacingSurvivors(first, raceConfig, 10).survivorKeys,
    selectRootRacingSurvivors(altered, raceConfig, 10).survivorKeys,
  );
});

test('disabling extra tree search preserves every paired baseline outcome', () => {
  const [position] = collectRootRacingCorpus({
    openingPositions: 1,
    safetyPositions: 0,
    openingMinimumBranching: 2,
    seed: 'root-racing-tree-disable-test',
  });
  const safeGame = informationSafeBenchmarkGame(position.game);
  const belief = createBeliefState(safeGame, 0, 900, undefined, 'root-racing-tree-disable-test');
  const options = { representativeLimit: 8, representativePoolSize: 8 };
  const current = analyzeMoves(safeGame, belief.targetCount, belief, undefined, options);
  const disabled = analyzeMoves(safeGame, belief.targetCount, belief, undefined, {
    ...options,
    extraTreeSearch: 'disabled',
  });
  assert.deepEqual(
    disabled.map((move) => ({
      key: `${move.tile.id}:${move.side}`,
      wins: move.treeSearch.pairedBaseWins,
      weights: move.treeSearch.pairedBaseWeights,
    })),
    current.map((move) => ({
      key: `${move.tile.id}:${move.side}`,
      wins: move.treeSearch.pairedBaseWins,
      weights: move.treeSearch.pairedBaseWeights,
    })),
  );
  assert.ok(current.every((move) => move.treeSearch.extraIterations >= 0));
  assert.ok(disabled.every((move) => move.treeSearch.extraIterations === 0));
});

function withoutTiming(result) {
  return {
    ...result,
    reference: { ...result.reference, elapsedMs: 0 },
    trials: result.trials.map((trial) => ({
      ...trial,
      collectionElapsedMs: 0,
    })),
  };
}

test('root-racing evaluation cannot inspect the real hidden hands', async () => {
  const [position] = collectRootRacingCorpus({
    openingPositions: 1,
    safetyPositions: 0,
    openingMinimumBranching: 2,
    seed: 'root-racing-hidden-safety-test',
  });
  const hidden = [...position.game.hands[1], ...position.game.hands[2]].reverse();
  const firstSize = position.game.hands[1].length;
  const alternate = {
    ...position,
    game: {
      ...position.game,
      hands: [
        position.game.hands[0],
        hidden.slice(0, firstSize),
        hidden.slice(firstSize),
      ],
    },
  };
  const options = {
    repetitions: 1,
    referenceBudget: 8,
    rootBudget: 4,
    ceilingBudget: 8,
    configs: [{ ...raceConfig, initialSamples: 2 }],
    seed: 'root-racing-hidden-safety-test',
  };
  const first = await evaluateRootRacingPosition(position, options);
  const second = await evaluateRootRacingPosition(alternate, options);
  assert.deepEqual(withoutTiming(first), withoutTiming(second));
});

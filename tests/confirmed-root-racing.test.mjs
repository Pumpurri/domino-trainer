import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectConfirmedRootRacingCorpus,
  confirmedChoiceAssessment,
  confirmedRootRacingEnabled,
  deserializeRootRacingTrace,
  evaluateConfirmedRootRacingPosition,
  replayConfirmedRootRace,
  serializeRootRacingTrace,
} from '../scripts/confirmed-root-racing-core.mjs';
import { evaluateConfirmedRootRacingGrid } from '../scripts/confirmed-root-racing-calibration-core.mjs';

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
      retainedEndMatches: index,
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

const config = {
  id: 'confirmed-test',
  initialSamples: 4,
  confirmationSamples: 2,
  minimumSurvivors: 2,
  practicalGap: 1,
  minimumGap: 3,
  batches: 2,
  minimumPositiveBatchAgreement: 1,
  minimumPracticalBatchAgreement: 1,
  confirmationBatches: 2,
  minimumFreshGap: 1,
};

test('confirmed root racing spends the exact budget and keeps every finalist at the evidence floor', () => {
  const raced = replayConfirmedRootRace(fixtureMoves(), config, 10);
  assert.equal(raced.rootEvaluations, 50);
  assert.deepEqual(raced.provisionalEliminatedKeys, ['2-2:left', '3-3:left', '4-4:left']);
  assert.deepEqual(raced.eliminatedKeys, ['2-2:left', '3-3:left', '4-4:left']);
  assert.equal(Object.values(raced.allocations).reduce((sum, value) => sum + value, 0), 50);
  assert.ok(raced.minimumSurvivorSamples >= 10);
  assert.ok(raced.confirmations.every(({ confirmed }) => confirmed));
});

test('a contradictory fresh batch rescues a provisional elimination', () => {
  const moves = fixtureMoves();
  moves[0].treeSearch.pairedBaseWins[4] = 0;
  moves[0].treeSearch.pairedBaseWins[5] = 0;
  moves[2].treeSearch.pairedBaseWins[4] = 1;
  moves[2].treeSearch.pairedBaseWins[5] = 1;
  const raced = replayConfirmedRootRace(moves, config, 10);
  assert.ok(raced.provisionalEliminatedKeys.includes('2-2:left'));
  assert.ok(!raced.eliminatedKeys.includes('2-2:left'));
  assert.equal(raced.allocations['2-2:left'], 10);
});

test('confirmed root racing is explicitly limited to high-branching openings', () => {
  assert.equal(confirmedRootRacingEnabled('opening', 6), true);
  assert.equal(confirmedRootRacingEnabled('opening', 5), false);
  for (const phase of ['middle', 'late', 'block']) {
    assert.equal(confirmedRootRacingEnabled(phase, 10), false);
  }
});

test('saved replay traces exactly reconstruct paired outcomes and decisions', () => {
  const moves = fixtureMoves();
  const trace = serializeRootRacingTrace(moves);
  const restored = deserializeRootRacingTrace(trace);
  assert.deepEqual(
    restored.map((move) => ({
      key: `${move.tile.id}:${move.side}`,
      wins: move.treeSearch.pairedBaseWins,
      weights: move.treeSearch.pairedBaseWeights,
      retainedEndMatches: move.evidence.retainedEndMatches,
    })),
    moves.map((move) => ({
      key: `${move.tile.id}:${move.side}`,
      wins: move.treeSearch.pairedBaseWins,
      weights: move.treeSearch.pairedBaseWeights,
      retainedEndMatches: move.evidence.retainedEndMatches,
    })),
  );
  assert.equal(replayConfirmedRootRace(restored, config, 10).ranked[0].tile.id, '0-0');
});

test('post-decision confirmation uses equal paired evidence for the recommendation and played move', () => {
  const assessment = confirmedChoiceAssessment(fixtureMoves(), '0-0:left', '2-2:left', 10);
  assert.equal(assessment.confidentMistake, true);
  assert.equal(assessment.gap, 100);
});

test('saved traces support deterministic confirmation-grid replay without simulation', () => {
  const moves = fixtureMoves();
  const source = {
    config: { version: 'test-source', seed: 'test-source-seed' },
    positions: [{
      id: 'opening-high-01',
      branching: moves.length,
      playedKey: '2-2:left',
      reference: {
        topKey: '0-0:left',
        acceptableTopKeys: ['0-0:left'],
        rates: Object.fromEntries(moves.map((move) => [`${move.tile.id}:${move.side}`, move.winRate])),
        confidentMistake: true,
      },
      trials: [{
        repetition: 0,
        variants: {
          'control-120': {
            topKey: '0-0:left',
            exactTopAgreement: true,
            acceptableTopAgreement: true,
            withinOnePoint: true,
            regret: 0,
            verdict: 'best',
            mistakeLabelAgreement: true,
            falsePositiveMistake: false,
            selectedSamples: 10,
            selectedEffectiveSamples: 10,
            rootEvaluations: 50,
            postDecisionEvaluations: 0,
            referenceBestSurvived: true,
          },
          'ceiling-500': {
            topKey: '0-0:left',
            exactTopAgreement: true,
            acceptableTopAgreement: true,
            withinOnePoint: true,
            regret: 0,
            verdict: 'best',
            mistakeLabelAgreement: true,
            falsePositiveMistake: false,
            selectedSamples: 30,
            selectedEffectiveSamples: 30,
            rootEvaluations: 150,
            postDecisionEvaluations: 0,
            referenceBestSurvived: true,
          },
        },
        replay: serializeRootRacingTrace(moves),
      }],
    }],
  };
  const options = {
    configs: [{
      ...config,
      minimumFreshPositiveBatchAgreement: 1,
      minimumFreshNonnegativeBatchAgreement: 1,
    }],
    rootBudget: 10,
    confidenceResamples: 10,
    seed: 'confirmation-grid-test',
  };
  const first = evaluateConfirmedRootRacingGrid(source, options);
  const second = evaluateConfirmedRootRacingGrid(source, options);
  assert.deepEqual(first, second);
  assert.equal(first.candidates.length, 1);
  assert.equal(first.candidates[0].diagnostics.confirmedEliminations, 3);
});

function withoutTiming(result) {
  return {
    ...result,
    reference: { ...result.reference, elapsedMs: 0 },
    trials: result.trials.map((trial) => ({ ...trial, collectionElapsedMs: 0 })),
  };
}

test('confirmed root-racing evaluation cannot inspect real hidden hands', async () => {
  const [position] = collectConfirmedRootRacingCorpus({
    positions: 1,
    minimumBranching: 6,
    seed: 'confirmed-root-racing-hidden-safety-test',
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
  const quickConfig = {
    ...config,
    initialSamples: 2,
    confirmationSamples: 2,
    minimumPositiveBatchAgreement: 0.5,
    minimumPracticalBatchAgreement: 0.5,
  };
  const options = {
    repetitions: 1,
    referenceBudget: 8,
    rootBudget: 4,
    ceilingBudget: 8,
    config: quickConfig,
    seed: 'confirmed-root-racing-hidden-safety-test',
  };
  const first = await evaluateConfirmedRootRacingPosition(position, options);
  const second = await evaluateConfirmedRootRacingPosition(alternate, options);
  assert.deepEqual(withoutTiming(first), withoutTiming(second));
});

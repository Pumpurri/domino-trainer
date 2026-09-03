import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  adaptiveMinimumSamples,
  classifyAdaptiveChoice,
  clusteredRatedMoveDifference,
  plausibleBestMoveKeys,
  runAdaptiveAnalysis,
} from '../app/adaptive-analysis.ts';
import { prepareReliabilityCheckpoint } from '../scripts/analyzer-reliability-checkpoint.mjs';

function ratedMove(id, wins) {
  const [a, b] = id.split('-').map(Number);
  const samples = wins.length;
  const winRate = samples ? wins.reduce((sum, won) => sum + won, 0) / samples * 100 : 0;
  return {
    tile: { id, a, b },
    side: 'left',
    placedLeft: b,
    placedRight: a,
    newLeft: b,
    newRight: 9,
    samples,
    effectiveSamples: samples,
    winRate,
    margin: 0,
    heuristic: 0,
    lookahead: { score: 0, returnRate: 0, exploredBranches: 0, plies: 3 },
    treeSearch: {
      visits: 0,
      averageUtility: 0,
      informationSets: 0,
      multiVisitInformationSets: 0,
      deepestPly: 0,
      averageTreePlies: 0,
      revisitedActionRate: 0,
      uniqueDeals: samples,
      baseIterations: samples * 2,
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

function decisiveBatch(samples) {
  return [
    ratedMove('1-2', Array(samples).fill(1)),
    ratedMove('1-3', Array(samples).fill(0)),
  ];
}

function ambiguousBatch(samples) {
  const shared = Array.from({ length: samples }, (_, index) => index % 2);
  return [ratedMove('1-2', shared), ratedMove('1-3', shared)];
}

test('adaptive analysis requires a fresh confirming batch before an early stop', async () => {
  const batches = [];
  const result = await runAdaptiveAnalysis({
    stages: [4, 8, 12, 16],
    minimumSamples: 4,
    playedKey: '1-2:left',
    analyzeBatch: (samples) => {
      batches.push(samples);
      return decisiveBatch(samples);
    },
  });

  assert.deepEqual(batches, [4, 4, 4]);
  assert.equal(result.samplesUsed, 12);
  assert.equal(result.stopReason, 'clear');
  assert.equal(result.recommendationConfidence, 'clear');
  assert.equal(result.ranked[0].samples, 12);
  assert.equal(result.stages[1].recommendationCandidate, true);
  assert.equal(result.stages[1].confirmationPassed, false);
  assert.equal(result.stages[2].confirmationPassed, true);
});

test('adaptive analysis spends its full budget and stays cautious on an unresolved decision', async () => {
  const batches = [];
  const result = await runAdaptiveAnalysis({
    stages: [4, 8, 12],
    minimumSamples: 4,
    playedKey: '1-3:left',
    analyzeBatch: (samples) => {
      batches.push(samples);
      return ambiguousBatch(samples);
    },
  });

  assert.deepEqual(batches, [4, 4, 4]);
  assert.equal(result.samplesUsed, 12);
  assert.equal(result.stopReason, 'hard-cap');
  assert.equal(result.recommendationConfidence, 'uncertain');
  assert.equal(result.choice.verdict, 'close');
  assert.equal(result.choice.confidentMistake, false);
  assert.equal(result.choice.assessment, 'acceptable');
  assert.ok(result.samplesUsed <= 12);
  assert.equal(classifyAdaptiveChoice(result.ranked, '1-3:left').verdict, 'close');
});

test('between-batch uncertainty widens a pooled interval when independent batches disagree', () => {
  const first = [
    ratedMove('1-2', [1, 1, 1, 1, 1, 1, 1, 1]),
    ratedMove('1-3', [0, 0, 0, 0, 0, 0, 0, 0]),
  ];
  const second = [
    ratedMove('1-2', [0, 0, 0, 0, 0, 0, 0, 0]),
    ratedMove('1-3', [1, 1, 1, 1, 1, 1, 1, 1]),
  ];
  const difference = clusteredRatedMoveDifference([first, second], '1-2:left', '1-3:left');

  assert.ok(difference.betweenBatchSpread > 0);
  assert.ok(difference.interval[0] < difference.pooledInterval[0]);
  assert.ok(difference.interval[1] > difference.pooledInterval[1]);
  assert.deepEqual(difference.batchGaps, [100, -100]);
});

test('statistically equivalent leaders share one acceptable best-move set', () => {
  const batch = ambiguousBatch(12);
  const keys = plausibleBestMoveKeys(batch, [batch], 1);
  const choice = classifyAdaptiveChoice(batch, '1-3:left', { batches: [batch, batch] });

  assert.deepEqual(keys, ['1-2:left', '1-3:left']);
  assert.equal(choice.assessment, 'acceptable');
  assert.equal(choice.mistakeConfidence, 'clear');
  assert.equal(choice.confidentMistake, false);
});

test('mistake labels require practical and consistent independent-batch evidence', () => {
  const consistent = [decisiveBatch(12), decisiveBatch(12)];
  const consistentRanked = consistent[0];
  const mistake = classifyAdaptiveChoice(consistentRanked, '1-3:left', { batches: consistent });
  const conflicting = [
    decisiveBatch(12),
    decisiveBatch(12),
    decisiveBatch(12),
    [ratedMove('1-2', Array(12).fill(0)), ratedMove('1-3', Array(12).fill(1))],
  ];
  const uncertain = classifyAdaptiveChoice(consistentRanked, '1-3:left', { batches: conflicting });

  assert.equal(mistake.confidentMistake, true);
  assert.equal(mistake.mistakeConfidence, 'clear');
  assert.equal(mistake.assessment, 'mistake');
  assert.equal(uncertain.confidentMistake, false);
  assert.equal(uncertain.mistakeConfidence, 'uncertain');
});

test('minimum adaptive budgets increase for opening and highly branched decisions', () => {
  assert.equal(adaptiveMinimumSamples({ phase: 'late', branching: 2 }), 250);
  assert.equal(adaptiveMinimumSamples({ phase: 'opening', branching: 2 }), 500);
  assert.equal(adaptiveMinimumSamples({ phase: 'middle', branching: 4 }), 500);
  assert.equal(adaptiveMinimumSamples({ phase: 'block', branching: 7 }), 1000);
});

test('adaptive checkpoint resumes completed positions and rejects incompatible configuration', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'mesa-reliability-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const config = { seed: 'checkpoint-test', budgets: [4], workers: 1 };
  const created = await prepareReliabilityCheckpoint({ directory, config });
  await created.save({ id: 'opening-01', score: 1 });

  const resumed = await prepareReliabilityCheckpoint({ directory, config, resume: true });
  assert.deepEqual(resumed.results, [{ id: 'opening-01', score: 1 }]);
  assert.ok(resumed.completedIds.has('opening-01'));
  await assert.rejects(
    prepareReliabilityCheckpoint({ directory, config: { ...config, workers: 2 }, resume: true }),
    /configuration does not match/,
  );
});

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  classifyAdaptiveChoice,
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

test('adaptive analysis accumulates batches and stops an easy decision after two stable checks', async () => {
  const batches = [];
  const result = await runAdaptiveAnalysis({
    stages: [4, 8, 12],
    playedKey: '1-2:left',
    analyzeBatch: (samples) => {
      batches.push(samples);
      return decisiveBatch(samples);
    },
  });

  assert.deepEqual(batches, [4, 4]);
  assert.equal(result.samplesUsed, 8);
  assert.equal(result.stopReason, 'clear');
  assert.equal(result.recommendationConfidence, 'clear');
  assert.equal(result.ranked[0].samples, 8);
  assert.equal(result.stages.at(-1).stableChecks, 2);
});

test('adaptive analysis spends its full budget and stays cautious on an unresolved decision', async () => {
  const batches = [];
  const result = await runAdaptiveAnalysis({
    stages: [4, 8, 12],
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
  assert.ok(result.samplesUsed <= 12);
  assert.equal(classifyAdaptiveChoice(result.ranked, '1-3:left').verdict, 'close');
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

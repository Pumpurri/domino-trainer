import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calibrationAdjustedBeliefState,
  calibrationAdjustedStyles,
  calibrationSummary,
  createEmptyTrainingProgress,
  opponentArchetype,
  parseTrainingProgress,
  progressSummary,
  recordDrillAttempt,
  recordRoundProgress,
  serializeTrainingDataset,
  targetedDrills,
} from '../app/training.ts';

function tile(a, b, id = `${Math.min(a, b)}-${Math.max(a, b)}`) {
  return { id, a: Math.min(a, b), b: Math.max(a, b) };
}

function option(key, winRate) {
  const [tileId, side] = key.split(':');
  const [a, b] = tileId.split('-').map(Number);
  return {
    key,
    tile: tile(a, b),
    side,
    newLeft: b,
    newRight: 7,
    winRate,
    margin: 2,
    samples: 120,
    nextPassRate: winRate,
    blockedWinRate: 10,
    emptyWinRate: 30,
    averagePipsWhenLosing: 12,
    retainedEndMatches: winRate > 50 ? 2 : 0,
    returnRate: winRate > 50 ? 0.7 : 0.2,
    pairedWins: Array(12).fill(winRate > 50 ? 1 : 0),
    pairedWeights: Array(12).fill(1),
  };
}

function reviewWithGap(gap) {
  const best = option('1-6:left', 60);
  const chosen = option('4-9:right', 60 - gap);
  const record = {
    id: `decision-${gap}`,
    round: 1,
    eventCount: 2,
    phase: 'middle',
    hand: [tile(1, 6), tile(4, 9), tile(2, 5)],
    handSizes: [3, 3, 3],
    ends: [1, 9],
    chosenKey: chosen.key,
    bestKey: best.key,
    options: [best, chosen],
    knownEvidence: ['Rosa had certainly passed out of 6 and 9.'],
    inferredEvidence: [],
    beliefs: [],
    beliefConfidence: 'high',
    publicState: {
      chain: [{ ...tile(1, 9), left: 1, right: 9, player: 2 }],
      starter: 0,
      voids: [[], [6, 9], []],
      consecutivePasses: 0,
      events: [{ kind: 'pass', player: 1, endsBefore: [6, 9] }],
    },
    probabilityForecasts: [{ player: 1, value: 6, probability: 0 }],
    styleProfiles: [],
    recommendationReason: 'Force the known pass.',
  };
  const decision = {
    record,
    chosen,
    best,
    verdict: gap >= 20 ? 'big-mistake' : 'mistake',
    winRateGap: gap,
    interval: [Math.max(1, gap - 3), gap + 3],
    confidence: 'high',
    known: record.knownEvidence[0],
    inferred: 'No soft read.',
    simulated: 'The better move forced more passes.',
    uncertainty: 'The comparison is estimated.',
    revealed: 'Audited after the round.',
    beliefChecks: { correct: 1, total: 1 },
  };
  return {
    round: 1,
    decisions: [decision],
    biggestMistake: decision,
    bestDecision: null,
    closeCalls: 0,
    beliefChecks: { correct: 1, total: 1 },
    calibration: {
      belief: [{ player: 1, label: 'holds-6', forecast: 0, observed: 0, confidence: 'high' }],
      style: [],
    },
    opponentStartingHands: [{ player: 1, tiles: [tile(9, 9, 'SECRET-HIDDEN')] }],
  };
}

test('every targeted drill has multiple legal options and a legal answer', () => {
  assert.equal(targetedDrills.length, 6);
  targetedDrills.forEach((drill) => {
    assert.ok(drill.options.length >= 2, drill.id);
    assert.ok(drill.options.some((move) => `${move.tile.id}:${move.side}` === drill.bestKey), drill.id);
  });
  const sideDrill = targetedDrills.find(({ id }) => id === 'correct-side');
  assert.deepEqual(
    sideDrill.options.filter(({ tile: candidate }) => candidate.id === '2-7').map(({ side }) => side).sort(),
    ['left', 'right'],
  );
});

test('progress is idempotent, tracks rolling improvement, and records drill mastery', () => {
  let progress = createEmptyTrainingProgress();
  for (let index = 0; index < 20; index += 1) {
    progress = recordRoundProgress(progress, reviewWithGap(index < 10 ? 20 : 5), `round-${index}`, `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`);
  }
  const unchanged = recordRoundProgress(progress, reviewWithGap(5), 'round-19');
  assert.equal(unchanged, progress);
  progress = recordDrillAttempt(progress, 'drill:force-pass', 'pass-exploitation', true);
  progress = recordDrillAttempt(progress, 'drill:force-pass', 'pass-exploitation', true);
  progress = recordDrillAttempt(progress, 'drill:force-pass', 'pass-exploitation', true);
  const summary = progressSummary(progress);
  assert.equal(summary.rounds, 20);
  assert.equal(summary.windows[0].averageLoss, 5);
  assert.equal(summary.windows[0].changeFromPrevious, -15);
  assert.equal(summary.masteredDrills, 1);
  assert.equal(parseTrainingProgress(JSON.stringify(progress)).rounds.length, 20);
});

test('deep review replaces live labels and cannot be overwritten by a later live report', () => {
  const liveReview = reviewWithGap(20);
  const deepReview = reviewWithGap(5);
  let progress = recordRoundProgress(createEmptyTrainingProgress(), liveReview, 'round-deep');
  assert.equal(progress.rounds[0].analysisQuality, 'live');
  assert.equal(progress.examples[0].estimatedWinRateLost, 20);

  const deepRecordId = deepReview.decisions[0].record.id;
  progress = recordRoundProgress(progress, deepReview, 'round-deep', '2026-09-03T01:00:00.000Z', {
    analysisQuality: 'deep',
    deepReview: {
      sampleCount: 500,
      analyzed: 1,
      agreed: 0,
      changedRecommendations: 1,
      unstableDecisions: 1,
    },
    comparisons: [{
      recordId: deepRecordId,
      analyzed: true,
      agreed: false,
      liveBestKey: '4-9:right',
      deepBestKey: '1-6:left',
      liveVerdict: 'best',
      deepVerdict: 'mistake',
      liveWinRateGap: 0,
      deepWinRateGap: 5,
      unstable: true,
    }],
  });

  assert.equal(progress.rounds.length, 1);
  assert.equal(progress.rounds[0].analysisQuality, 'deep');
  assert.equal(progress.examples.length, 1);
  assert.equal(progress.examples[0].analysisQuality, 'deep');
  assert.equal(progress.examples[0].estimatedWinRateLost, 5);
  assert.equal(progress.examples[0].recommendationChanged, true);
  assert.equal(progress.beliefCalibration.length, 1);
  const deepProgress = progress;
  progress = recordRoundProgress(progress, liveReview, 'round-deep');
  assert.equal(progress, deepProgress);

  const summary = progressSummary(progress);
  assert.equal(summary.deepReview.rounds, 1);
  assert.equal(summary.deepReview.agreementRate, 0);
  assert.equal(summary.deepReview.changedRecommendations, 1);
  assert.equal(summary.deepReview.unstableDecisions, 1);
});

test('calibration groups claimed probabilities against observed rates', () => {
  const summary = calibrationSummary([
    { player: 1, label: 'holds-1', forecast: 0.1, observed: 0, confidence: 'high' },
    { player: 1, label: 'holds-2', forecast: 0.9, observed: 1, confidence: 'high' },
  ]);
  assert.equal(summary.samples, 2);
  assert.ok(Math.abs(summary.meanSquaredError - 0.01) < 1e-12);
  assert.equal(summary.buckets[0].observedRate, 0);
  assert.equal(summary.buckets[4].observedRate, 1);
});

test('poor calibration lowers belief and style confidence without changing hidden facts', () => {
  const weakSummary = calibrationSummary(Array.from({ length: 50 }, (_, index) => ({
    player: 1,
    label: `miss-${index}`,
    forecast: 1,
    observed: 0,
    confidence: 'high',
  })));
  const belief = {
    perspective: 0,
    round: 2,
    eventCount: 3,
    targetCount: 2,
    ownHandSignature: '1-2',
    particles: [
      { hands: [[], [tile(1, 3)], []], weight: 1.8 },
      { hands: [[], [tile(4, 5)], []], weight: 0.2 },
    ],
    hardEvidenceUpdates: 0,
    choiceUpdates: 0,
    resampleCount: 0,
    diagnostics: {
      particleCount: 2,
      effectiveSamples: 1.22,
      uniqueDeals: 2,
      confidence: 'high',
      eliminatedLastUpdate: 0,
      reweightedLastUpdate: 0,
      resampledLastUpdate: false,
    },
  };
  const adjustedBelief = calibrationAdjustedBeliefState(belief, weakSummary);
  assert.equal(adjustedBelief.diagnostics.confidence, 'low');
  assert.ok(adjustedBelief.particles[0].weight < belief.particles[0].weight);

  const style = {
    player: 1,
    observedChoices: 12,
    doubleOpportunities: 4,
    blockOpportunities: 4,
    highPipTendency: 0.9,
    doubleTendency: 0.7,
    controlTendency: 0.55,
    blockTendency: 0.52,
    strategicConsistency: 0.7,
    unpredictability: 0.3,
    confidence: 'high',
    lastRound: 2,
    lastEventCount: 3,
  };
  assert.equal(opponentArchetype(style), 'Pip shedder');
  const adjustedStyle = calibrationAdjustedStyles([style], weakSummary)[0];
  assert.equal(adjustedStyle.confidence, 'low');
  assert.ok(adjustedStyle.highPipTendency < style.highPipTendency);
  assert.equal(opponentArchetype({ ...style, highPipTendency: 0.52, controlTendency: 0.88 }), 'End controller');
});

test('dataset export excludes revealed opponent hands and keeps safe decision labels', () => {
  const progress = recordRoundProgress(createEmptyTrainingProgress(), reviewWithGap(20), 'round-safe');
  const exported = serializeTrainingDataset(progress, '2026-09-03T00:00:00.000Z');
  assert.ok(exported.includes('mesa-quince-information-safe-v2'));
  assert.ok(exported.includes('1-6:left'));
  assert.ok(!exported.includes('SECRET-HIDDEN'));
  assert.ok(!exported.includes('opponentStartingHands'));
  assert.ok(!exported.includes('pairedWins'));
});

test('dataset exports deep-review provenance without hidden hands', () => {
  const review = reviewWithGap(5);
  const recordId = review.decisions[0].record.id;
  const progress = recordRoundProgress(createEmptyTrainingProgress(), review, 'round-deep-safe', undefined, {
    analysisQuality: 'deep',
    deepReview: { sampleCount: 500, analyzed: 1, agreed: 1, changedRecommendations: 0, unstableDecisions: 0 },
    comparisons: [{
      recordId, analyzed: true, agreed: true,
      liveBestKey: '1-6:left', deepBestKey: '1-6:left',
      liveVerdict: 'mistake', deepVerdict: 'mistake',
      liveWinRateGap: 5, deepWinRateGap: 5, unstable: false,
    }],
  });
  const exported = serializeTrainingDataset(progress, '2026-09-03T00:00:00.000Z');
  assert.ok(exported.includes('"analysisQuality": "deep"'));
  assert.ok(exported.includes('"liveBestKey": "1-6:left"'));
  assert.ok(exported.includes('"recommendationChanged": false'));
  assert.ok(!exported.includes('SECRET-HIDDEN'));
  assert.ok(!exported.includes('opponentStartingHands'));
});

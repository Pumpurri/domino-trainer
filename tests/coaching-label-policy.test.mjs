import assert from 'node:assert/strict';
import test from 'node:test';
import {
  coachingLabelGate,
  evaluateCoachingLabelPolicy,
  referenceLabel,
  replayCoachingLabel,
  v3ReleaseGate,
} from '../scripts/coaching-label-policy.mjs';

const policy = {
  practicalGap: 1.5,
  minimumGap: 4,
  minimumBatchAgreement: 0.75,
  minimumPracticalBatchAgreement: 0.5,
};

function trial(overrides = {}) {
  return {
    topKey: '1-2:left',
    playedInPlausibleBest: false,
    choiceGap: 6,
    choiceInterval: [2, 10],
    choiceBatchGaps: [7, 6, 5, 6],
    ...overrides,
  };
}

test('material reference labels retain an explicit uncertainty class', () => {
  assert.equal(referenceLabel({ gap: 5, interval: [2, 8] }), 'mistake');
  assert.equal(referenceLabel({ gap: 0, interval: [0, 0] }), 'acceptable');
  assert.equal(referenceLabel({ gap: 3, interval: [1, 5] }), 'uncertain');
});

test('policy replay recalculates batch agreement for each practical threshold', () => {
  const borderline = trial({ choiceGap: 4, choiceInterval: [1.2, 6.8], choiceBatchGaps: [1.1, 1.3, 2, 2.4] });
  assert.equal(replayCoachingLabel(borderline, '1-3:left', policy), 'uncertain');
  assert.equal(replayCoachingLabel(borderline, '1-3:left', { ...policy, practicalGap: 1 }), 'mistake');
  assert.equal(replayCoachingLabel(trial(), '1-3:left', policy), 'mistake');
  assert.equal(replayCoachingLabel(trial({ playedInPlausibleBest: true }), '1-3:left', policy), 'uncertain');
  assert.equal(replayCoachingLabel(trial(), '1-2:left', policy), 'acceptable');
  assert.throws(() => replayCoachingLabel(trial({ choiceBatchGaps: [] }), '1-3:left', policy), /Independent batch gaps/);
});

test('selective gate counts uncertain answers separately from confident errors', () => {
  const positions = [
    { id: 'opening-01', playedKey: '1-3:left', reference: { gap: 5, interval: [2, 8] }, adaptive: { trials: [
      trial(),
      trial({ choiceInterval: [0, 10] }),
      trial({ topKey: '1-3:left' }),
    ] } },
    { id: 'late-01', playedKey: '1-3:left', reference: { gap: 0, interval: [0, 0] }, adaptive: { trials: [
      trial({ topKey: '1-3:left' }),
      trial({ choiceInterval: [0, 10] }),
      trial(),
    ] } },
  ];
  const result = evaluateCoachingLabelPolicy(positions, policy);
  assert.equal(result.counts.detectedMistake, 1);
  assert.equal(result.counts.uncertainMistake, 1);
  assert.equal(result.counts.confidentMiss, 1);
  assert.equal(result.counts.correctAcceptable, 1);
  assert.equal(result.counts.uncertainAcceptable, 1);
  assert.equal(result.counts.falseAccusation, 1);
  assert.equal(result.rates.coverage, 4 / 6);
  assert.equal(result.rates.decidedAccuracy, 0.5);
  assert.equal(coachingLabelGate(result).passed, false);
});

test('V3 release gate combines selective labels with the frozen move checks', () => {
  const metric = (mean) => ({ mean, low: mean, high: mean });
  const summary = {
    overall: { 2000: { withinOnePoint: metric(0.97), meanRegret: metric(0.1), repeatAcceptability: metric(0.93) } },
    adaptive: {
      withinOnePoint: metric(0.97),
      meanRegret: metric(0.1),
      repeatAcceptability: metric(0.94),
      recommendationSetStability: metric(0.99),
      samplesUsed: { mean: metric(1800) },
    },
  };
  const labels = {
    resolvedPositions: 180,
    referenceMistakes: 25,
    rates: { coverage: 0.8, mistakeRecall: 0.8, decidedAccuracy: 0.99, falseAccusation: 0.005, confidentMiss: 0 },
  };
  assert.equal(v3ReleaseGate(summary, labels, 400).passed, true);
  assert.equal(v3ReleaseGate({
    ...summary,
    adaptive: { ...summary.adaptive, samplesUsed: { mean: metric(1901) } },
  }, labels, 400).passed, false);
});

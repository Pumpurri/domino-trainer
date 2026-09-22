import assert from 'node:assert/strict';
import test from 'node:test';
import { labelOutcome, summarizeCoachingLabels } from '../scripts/coaching-label-audit.mjs';

function trial(overrides = {}) {
  return {
    repetition: 0,
    mistakeAbstained: false,
    mistakeAssessment: 'acceptable',
    confidentMistake: false,
    samplesUsed: 1000,
    choiceGap: 0,
    choiceInterval: [0, 0],
    choiceBatchAgreement: 1,
    choicePracticalBatchAgreement: 1,
    playedInPlausibleBest: false,
    ...overrides,
  };
}

test('uncertainty is neither a confident miss nor a false accusation', () => {
  assert.equal(labelOutcome(trial({ mistakeAbstained: true }), { confidentMistake: true }), 'uncertain-mistake');
  assert.equal(labelOutcome(trial({ mistakeAbstained: true }), { confidentMistake: false }), 'uncertain-acceptable');
  assert.equal(labelOutcome(trial(), { confidentMistake: true }), 'confident-miss');
  assert.equal(labelOutcome(trial({ mistakeAssessment: 'mistake', confidentMistake: true }), { confidentMistake: false }), 'false-accusation');
});

test('label audit separates decisions, abstentions, and overlapping causes', () => {
  const positions = [
    {
      id: 'opening-01', phase: 'opening', reference: { confidentMistake: true, gap: 3.5, interval: [0.5, 6.5] },
      adaptive: { trials: [
        trial({ mistakeAbstained: true, mistakeAssessment: 'uncertain', samplesUsed: 2000, choiceGap: 2, choiceInterval: [-1, 5], choiceBatchAgreement: 0.5, choicePracticalBatchAgreement: 0.25, playedInPlausibleBest: true }),
        trial({ mistakeAssessment: 'mistake', confidentMistake: true }),
        trial(),
      ] },
    },
    {
      id: 'late-01', phase: 'late', reference: { confidentMistake: false, gap: 0, interval: [0, 0] },
      adaptive: { trials: [
        trial({ mistakeAssessment: 'mistake', confidentMistake: true }),
        trial({ mistakeAbstained: true, mistakeAssessment: 'uncertain' }),
        trial(),
      ] },
    },
  ];
  const audit = summarizeCoachingLabels(positions);
  assert.equal(audit.trials, 6);
  assert.deepEqual(Object.values(audit.counts), [1, 1, 1, 1, 1, 1]);
  assert.equal(audit.uncertainMistakeCauses.atCap, 1);
  assert.equal(audit.uncertainMistakeCauses.belowMinimumGap, 1);
  assert.equal(audit.uncertainMistakeCauses.referenceBelowMinimumGap, 1);
  assert.equal(audit.rates.decidedAccuracy, 0.5);
  assert.equal(audit.rates.referenceMistakeRecall, 1 / 3);
});

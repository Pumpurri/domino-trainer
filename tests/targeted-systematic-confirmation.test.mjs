import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectTargetedConfirmationCorpus,
  evaluateTargetedConfirmationPosition,
  summarizeTargetedConfirmation,
} from '../scripts/targeted-systematic-confirmation-core.mjs';

const candidates = [
  { id: 'confirm-2', samples: 2 },
  { id: 'confirm-4', samples: 4 },
];

test('targeted confirmation gives the recommendation and played move equal fresh evidence', async () => {
  const [position] = collectTargetedConfirmationCorpus({
    positions: 1,
    minimumBranching: 2,
    seed: 'targeted-confirmation-test',
  });
  const result = await evaluateTargetedConfirmationPosition(position, {
    repetitions: 1,
    baseBudget: 6,
    referenceBudget: 12,
    closeGap: 100,
    candidates,
    seed: 'targeted-confirmation-test',
  });

  assert.equal(result.trials[0].variants['control-120'].triggered, true);
  for (const candidate of candidates) {
    const variant = result.trials[0].variants[candidate.id];
    assert.equal(variant.equalDecisionEvidence, true);
    assert.equal(variant.selectedSamples, 6 + candidate.samples);
    assert.equal(variant.playedSamples, 6 + candidate.samples);
    assert.ok(variant.confirmationKeys.includes(result.playedKey));
    assert.deepEqual(variant.initialLeaderKeys, variant.confirmationKeys.filter((key) => (
      variant.initialLeaderKeys.includes(key)
    )));
  }

  const summary = summarizeTargetedConfirmation([result], {
    seed: 'targeted-confirmation-test',
    confidenceResamples: 10,
    baseBudget: 6,
    candidates,
  });
  assert.deepEqual(Object.keys(summary.candidates), candidates.map(({ id }) => id));
  assert.equal(summary.triggerRate.mean, 1);
  for (const candidate of candidates) {
    assert.equal(summary.candidates[candidate.id].gate.checks.exactAndEqualDecisionEvidence, true);
  }
});

test('targeted confirmation ignores real hidden hands', async () => {
  const [position] = collectTargetedConfirmationCorpus({
    positions: 1,
    minimumBranching: 2,
    seed: 'targeted-confirmation-hidden-test',
  });
  const alternate = structuredClone(position);
  alternate.game.hands[1] = [...alternate.game.hands[1]].reverse();
  alternate.game.hands[2] = [...alternate.game.hands[2]].reverse();
  const options = {
    repetitions: 1,
    baseBudget: 4,
    referenceBudget: 8,
    closeGap: 100,
    candidates: [{ id: 'confirm-2', samples: 2 }],
    seed: 'targeted-confirmation-hidden-test',
  };
  const first = await evaluateTargetedConfirmationPosition(position, options);
  const second = await evaluateTargetedConfirmationPosition(alternate, options);
  const stripTiming = (value) => JSON.parse(JSON.stringify(value, (key, item) => (
    key === 'elapsedMs' ? undefined : item
  )));
  assert.deepEqual(stripTiming(first), stripTiming(second));
});

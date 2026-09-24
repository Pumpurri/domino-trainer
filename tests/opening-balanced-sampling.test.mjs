import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPENING_BALANCED_CANDIDATES,
  OPENING_BALANCED_VARIANTS,
  collectOpeningBalancedCorpus,
  evaluateOpeningBalancedPosition,
  summarizeOpeningBalanced,
} from '../scripts/opening-balanced-sampling-core.mjs';

test('opening-balanced study uses paired fixed budgets and produces every candidate comparison', async () => {
  const [position] = collectOpeningBalancedCorpus({
    positions: 1,
    minimumBranching: 2,
    seed: 'opening-balanced-test',
  });
  const result = await evaluateOpeningBalancedPosition(position, {
    repetitions: 1,
    budget: 6,
    referenceBudget: 12,
    seed: 'opening-balanced-test',
  });

  assert.equal(result.phase, 'opening');
  assert.equal(result.reference.independentTopKeys.length, 2);
  assert.equal(result.trials.length, 1);
  assert.deepEqual(Object.keys(result.trials[0].variants), OPENING_BALANCED_VARIANTS);
  for (const variant of OPENING_BALANCED_VARIANTS) {
    assert.equal(result.trials[0].variants[variant].samplesUsed, 6, variant);
    assert.equal(result.trials[0].variants[variant].exactSampleBudget, true, variant);
  }

  const summary = summarizeOpeningBalanced([result], {
    seed: 'opening-balanced-test',
    confidenceResamples: 10,
    budget: 6,
  });
  assert.deepEqual(Object.keys(summary.candidates), OPENING_BALANCED_CANDIDATES);
  for (const candidate of OPENING_BALANCED_CANDIDATES) {
    assert.equal(typeof summary.candidates[candidate].gate.passed, 'boolean');
    assert.equal(summary.candidates[candidate].gate.checks.exactSampleBudget, true);
  }
});

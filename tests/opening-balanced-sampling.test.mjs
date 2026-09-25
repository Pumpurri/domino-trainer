import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPENING_BALANCED_CANDIDATES,
  OPENING_BALANCED_VARIANTS,
  collectOpeningBalancedCorpus,
  evaluateOpeningBalancedPosition,
  summarizeOpeningBalanced,
} from '../scripts/opening-balanced-sampling-core.mjs';
import {
  OPENING_REFINEMENT_CANDIDATES,
  OPENING_REFINEMENT_VARIANTS,
  OPENING_REFINEMENT_VERSION,
  collectOpeningRefinementCorpus,
  evaluateOpeningRefinementPosition,
  summarizeOpeningRefinement,
} from '../scripts/opening-balanced-refinement-core.mjs';

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

test('opening refinement locks gentler response-only candidates and a stricter sample floor', async () => {
  const [position] = collectOpeningRefinementCorpus({
    positions: 1,
    minimumBranching: 2,
    seed: 'opening-refinement-test',
  });
  const result = await evaluateOpeningRefinementPosition(position, {
    repetitions: 1,
    budget: 6,
    referenceBudget: 12,
    seed: 'opening-refinement-test',
  });
  assert.deepEqual(Object.keys(result.trials[0].variants), OPENING_REFINEMENT_VARIANTS);
  for (const variant of OPENING_REFINEMENT_VARIANTS) {
    assert.equal(result.trials[0].variants[variant].samplesUsed, 6, variant);
    assert.equal(result.trials[0].variants[variant].exactSampleBudget, true, variant);
  }

  const summary = summarizeOpeningRefinement([result], {
    seed: 'opening-refinement-test',
    confidenceResamples: 10,
    budget: 6,
  });
  assert.equal(summary.version, OPENING_REFINEMENT_VERSION);
  assert.deepEqual(Object.keys(summary.candidates), OPENING_REFINEMENT_CANDIDATES);
  for (const candidate of OPENING_REFINEMENT_CANDIDATES) {
    assert.equal(summary.candidates[candidate].gate.checks.exactSampleBudget, true);
    const expectedFloor = summary.candidates[candidate].candidate.effectiveSamples.mean >= 5.7 - 1e-12;
    assert.equal(summary.candidates[candidate].gate.checks.effectiveSamplesPreserved, expectedFloor);
  }
});

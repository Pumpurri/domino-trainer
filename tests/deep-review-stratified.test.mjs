import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEEP_REVIEW_SAFETY_PHASES,
  collectDeepReviewStratifiedCorpus,
  deepReviewRepresentativePolicy,
  evaluateDeepReviewStratifiedPosition,
  summarizeDeepReviewStratified,
} from '../scripts/deep-review-stratified-core.mjs';

function withoutTiming(result) {
  if (result.phase !== 'middle') return result;
  return {
    ...result,
    references: Object.fromEntries(Object.entries(result.references).map(([policy, reference]) => [
      policy,
      { ...reference, elapsedMs: 0 },
    ])),
    trials: result.trials.map((trial) => ({
      ...trial,
      variants: Object.fromEntries(Object.entries(trial.variants).map(([variant, data]) => [
        variant,
        { ...data, elapsedMs: 0 },
      ])),
    })),
  };
}

test('Deep Review stratification corpus includes fresh middle and phase-safety positions', () => {
  const positions = collectDeepReviewStratifiedCorpus({
    middlePositions: 2,
    safetyPositionsPerPhase: 1,
    middleMinimumBranching: 3,
    seed: 'deep-review-stratified-corpus-test',
  });
  assert.equal(positions.filter(({ phase }) => phase === 'middle').length, 2);
  for (const phase of DEEP_REVIEW_SAFETY_PHASES) {
    assert.equal(positions.filter((position) => position.phase === phase).length, 1);
  }
  assert.ok(positions.filter(({ phase }) => phase === 'middle').every(({ branching }) => branching >= 3));
});

test('Deep Review stratification applies only in middle play', () => {
  assert.equal(deepReviewRepresentativePolicy('middle'), 'public-stratified');
  for (const phase of DEEP_REVIEW_SAFETY_PHASES) {
    assert.equal(deepReviewRepresentativePolicy(phase), 'systematic');
  }
});

test('Deep Review holdout uses exact paired budgets and exact non-middle reuse', async () => {
  const positions = collectDeepReviewStratifiedCorpus({
    middlePositions: 1,
    safetyPositionsPerPhase: 1,
    middleMinimumBranching: 2,
    seed: 'deep-review-stratified-evaluation-test',
  });
  const results = [];
  for (const position of positions) {
    results.push(await evaluateDeepReviewStratifiedPosition(position, {
      budget: 8,
      repetitions: 2,
      referenceBudget: 12,
      seed: 'deep-review-stratified-evaluation-test',
    }));
  }
  const middle = results.find(({ phase }) => phase === 'middle');
  assert.equal(middle.trials.length, 2);
  for (const trial of middle.trials) {
    assert.equal(trial.variants.systematic.samplesUsed, 8);
    assert.equal(trial.variants['public-stratified'].samplesUsed, 8);
    assert.equal(trial.variants.systematic.referenceScores.length, 2);
  }
  for (const safety of results.filter(({ phase }) => phase !== 'middle')) {
    assert.equal(safety.safety.candidatePolicy, 'systematic');
    assert.equal(safety.safety.exactReuse, true);
    assert.equal(safety.safety.topKey, safety.safety.candidateTopKey);
  }
  const summary = summarizeDeepReviewStratified(results, {
    budget: 8,
    seed: 'deep-review-stratified-evaluation-test',
    confidenceResamples: 10,
  });
  assert.equal(summary.gate.safetyMismatches, 0);
  assert.equal(typeof summary.gate.passed, 'boolean');
});

test('Deep Review stratification holdout cannot inspect real hidden hands', async () => {
  const [position] = collectDeepReviewStratifiedCorpus({
    middlePositions: 1,
    safetyPositionsPerPhase: 1,
    middleMinimumBranching: 2,
    seed: 'deep-review-stratified-hidden-safety-test',
  }).filter(({ phase }) => phase === 'middle');
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
    budget: 8,
    repetitions: 1,
    referenceBudget: 12,
    seed: 'deep-review-stratified-hidden-safety-test',
  };
  const [first, second] = await Promise.all([
    evaluateDeepReviewStratifiedPosition(position, options),
    evaluateDeepReviewStratifiedPosition(alternate, options),
  ]);
  assert.deepEqual(withoutTiming(first), withoutTiming(second));
});

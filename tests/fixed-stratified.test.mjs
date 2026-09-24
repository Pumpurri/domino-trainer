import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectFixedStratifiedCorpus,
  evaluateFixedStratifiedPosition,
  summarizeFixedStratified,
} from '../scripts/fixed-stratified-core.mjs';

function withoutTiming(result) {
  return {
    ...result,
    reference: { ...result.reference, elapsedMs: 0 },
    budgets: Object.fromEntries(Object.entries(result.budgets).map(([budget, value]) => [
      budget,
      {
        trials: value.trials.map((trial) => ({
          ...trial,
          variants: Object.fromEntries(Object.entries(trial.variants).map(([variant, data]) => [
            variant,
            { ...data, elapsedMs: 0 },
          ])),
        })),
      },
    ])),
  };
}

test('fixed stratified corpus contains fresh difficult middle-game decisions', () => {
  const positions = collectFixedStratifiedCorpus({
    positions: 2,
    minimumBranching: 3,
    seed: 'fixed-stratified-corpus-test',
  });
  assert.equal(positions.length, 2);
  assert.ok(positions.every((position) => position.phase === 'middle'));
  assert.ok(positions.every((position) => position.branching >= 3));
});

test('fixed stratified evaluation gives both samplers identical nominal budgets', async () => {
  const [position] = collectFixedStratifiedCorpus({
    positions: 1,
    minimumBranching: 2,
    seed: 'fixed-stratified-evaluation-test',
  });
  const evaluated = await evaluateFixedStratifiedPosition(position, {
    budgets: [4, 8],
    repetitions: 2,
    referenceBudget: 12,
    seed: 'fixed-stratified-evaluation-test',
  });
  for (const budget of [4, 8]) {
    assert.equal(evaluated.budgets[budget].trials.length, 2);
    for (const trial of evaluated.budgets[budget].trials) {
      assert.equal(trial.variants.systematic.samplesUsed, budget);
      assert.equal(trial.variants['public-stratified'].samplesUsed, budget);
    }
  }
  const summary = summarizeFixedStratified([evaluated], {
    budgets: [4, 8],
    seed: 'fixed-stratified-evaluation-test',
    confidenceResamples: 10,
  });
  assert.equal(summary.budgets[4].gate.checks.exactSampleBudget, true);
  assert.equal(summary.budgets[8].gate.checks.exactSampleBudget, true);
});

test('fixed stratified benchmark cannot inspect real hidden hands', async () => {
  const [position] = collectFixedStratifiedCorpus({
    positions: 1,
    minimumBranching: 2,
    seed: 'fixed-stratified-hidden-safety-test',
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
  const options = {
    budgets: [4, 8],
    repetitions: 1,
    referenceBudget: 12,
    seed: 'fixed-stratified-hidden-safety-test',
  };
  const [first, second] = await Promise.all([
    evaluateFixedStratifiedPosition(position, options),
    evaluateFixedStratifiedPosition(alternate, options),
  ]);
  assert.deepEqual(withoutTiming(first), withoutTiming(second));
});

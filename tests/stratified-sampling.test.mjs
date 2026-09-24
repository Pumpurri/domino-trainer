import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectStratifiedSamplingCorpus,
  evaluateStratifiedSamplingPosition,
  summarizeStratifiedSampling,
} from '../scripts/stratified-sampling-core.mjs';

test('stratified sampling pairs both representative policies on difficult decisions', async () => {
  const [position] = collectStratifiedSamplingCorpus({
    positionsPerGroup: 1,
    openingMinimumBranching: 2,
    middleMinimumBranching: 2,
    seed: 'stratified-evaluation-test',
  });
  const evaluated = await evaluateStratifiedSamplingPosition(position, {
    repetitions: 1,
    stages: [4, 8],
    referenceBudget: 12,
    forensicBudget: 8,
    seed: 'stratified-evaluation-test',
  });

  assert.deepEqual(Object.keys(evaluated.trials[0].variants), ['systematic', 'public-stratified']);
  assert.equal(evaluated.forensic.budget, 8);
  assert.equal(evaluated.forensic.strata.reduce((sum, row) => sum + row.samples, 0), 8);
  assert.ok(Math.abs(evaluated.forensic.strata.reduce((sum, row) => sum + row.posteriorMass, 0) - 1) < 1e-9);
  assert.ok(evaluated.forensic.stratifiedMassCoverage >= evaluated.forensic.systematicMassCoverage - 1e-12);

  const summary = summarizeStratifiedSampling([evaluated], {
    seed: 'stratified-evaluation-test',
    confidenceResamples: 10,
  });
  assert.equal(summary.positions, 1);
  assert.equal(typeof summary.gate.passed, 'boolean');
  assert.equal(summary.overall.variants.systematic.samplesUsed.mean > 0, true);
});

test('stratified sampling benchmark never reads real hidden hands', async () => {
  const [position] = collectStratifiedSamplingCorpus({
    positionsPerGroup: 1,
    openingMinimumBranching: 2,
    middleMinimumBranching: 2,
    seed: 'stratified-hidden-safety-test',
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
    repetitions: 1,
    stages: [4, 8],
    referenceBudget: 12,
    forensicBudget: 8,
    seed: 'stratified-hidden-safety-test',
  };
  const [first, second] = await Promise.all([
    evaluateStratifiedSamplingPosition(position, options),
    evaluateStratifiedSamplingPosition(alternate, options),
  ]);
  assert.deepEqual(first, second);
});

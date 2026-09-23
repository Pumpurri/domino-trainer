import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SAMPLER_ABLATION_GROUPS,
  collectSamplerAblationCorpus,
  evaluateSamplerAblationPosition,
  summarizeSamplerAblation,
} from '../scripts/sampler-ablation-core.mjs';

test('sampler-ablation corpus targets difficult opening and middle decisions', () => {
  const positions = collectSamplerAblationCorpus({
    positionsPerGroup: 1,
    openingMinimumBranching: 4,
    middleMinimumBranching: 3,
    seed: 'sampler-ablation-corpus-test',
  });
  assert.deepEqual(positions.map(({ group }) => group), SAMPLER_ABLATION_GROUPS);
  assert.ok(positions.find(({ group }) => group === 'opening-high').branching >= 4);
  assert.ok(positions.find(({ group }) => group === 'middle-wide').branching >= 3);
});

test('paired sampler ablation proves shared one-shot and staged evidence equivalence', async () => {
  const [position] = collectSamplerAblationCorpus({
    positionsPerGroup: 1,
    openingMinimumBranching: 2,
    middleMinimumBranching: 2,
    seed: 'sampler-ablation-evaluation-test',
  });
  const evaluated = await evaluateSamplerAblationPosition(position, {
    repetitions: 1,
    stages: [4, 8],
    referenceBudget: 12,
    seed: 'sampler-ablation-evaluation-test',
  });
  const aggregation = evaluated.trials[0].comparisons.oneShotVsSharedStaged;
  assert.deepEqual(aggregation, {
    sameTop: true,
    sameRanking: true,
    outcomeMismatches: 0,
    weightMismatches: 0,
    sampleMismatches: 0,
    maxWinRateDifference: 0,
  });
  assert.equal(
    evaluated.trials[0].variants.sharedStaged.topKey,
    evaluated.trials[0].variants.sharedAdaptiveForced.topKey,
  );

  const summary = summarizeSamplerAblation([evaluated], {
    seed: 'sampler-ablation-evaluation-test',
    confidenceResamples: 10,
  });
  assert.equal(summary.diagnosis.aggregationDefect, false);
  assert.equal(summary.comparisons.sharedReplay.outcomeMismatches, 0);
  assert.equal(summary.overall.variants.oneShot.samplesUsed.mean, 8);
  assert.ok(summary.overall.variants.sharedAdaptiveEarly.samplesUsed.mean <= 8);
});

test('sampler ablation never reads opponents real hidden tiles', async () => {
  const [position] = collectSamplerAblationCorpus({
    positionsPerGroup: 1,
    openingMinimumBranching: 2,
    middleMinimumBranching: 2,
    seed: 'sampler-ablation-hidden-safety',
  });
  const alternate = {
    ...position,
    game: {
      ...position.game,
      hands: [
        position.game.hands[0],
        [...position.game.hands[2]].reverse(),
        [...position.game.hands[1]].reverse(),
      ],
    },
  };
  const options = {
    repetitions: 1,
    stages: [4, 8],
    referenceBudget: 12,
    seed: 'sampler-ablation-hidden-safety',
  };
  const [first, second] = await Promise.all([
    evaluateSamplerAblationPosition(position, options),
    evaluateSamplerAblationPosition(alternate, options),
  ]);
  assert.deepEqual(first, second);
});

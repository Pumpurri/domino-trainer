import assert from 'node:assert/strict';
import test from 'node:test';
import { legalMovesFor } from '../app/domino-engine.ts';
import {
  STRATEGIES,
  STRATEGY_LINEUPS,
  createMatchedDeal,
  runMatchedBenchmark,
  wilsonInterval,
} from '../scripts/benchmark-core.mjs';
import { runMatchedBenchmarkParallel } from '../scripts/benchmark-parallel.mjs';
import { strategicScenarios } from '../scripts/strategic-scenarios.mjs';
import {
  RELIABILITY_PHASES,
  adaptiveReliabilityGate,
  collectDecisionCorpus,
  evaluateReliabilityPosition,
  informationSafeBenchmarkGame,
  summarizeReliability,
} from '../scripts/analyzer-reliability-core.mjs';
import { evaluateReliabilityParallel } from '../scripts/analyzer-reliability-parallel.mjs';

test('matched schedule puts every strategy in every seat equally', () => {
  for (const strategy of STRATEGIES) {
    const seatCounts = [0, 1, 2].map((seat) => STRATEGY_LINEUPS.filter((lineup) => lineup[seat] === strategy).length);
    assert.deepEqual(seatCounts, [2, 2, 2]);
  }
});

test('matched deals are deterministic and contain 30 dealt plus 25 sleeping tiles', () => {
  const first = createMatchedDeal(4, 'fixed-seed');
  const second = createMatchedDeal(4, 'fixed-seed');
  assert.deepEqual(first, second);
  assert.deepEqual(first.hands.map((hand) => hand.length), [10, 10, 10]);
  assert.equal(first.sleepers.length, 25);
  assert.equal(new Set([...first.hands.flat(), ...first.sleepers].map(({ id }) => id)).size, 55);
});

test('Wilson interval contains its observed win rate', () => {
  const interval = wilsonInterval(37, 100);
  assert.equal(interval.rate, 0.37);
  assert.ok(interval.low < interval.rate);
  assert.ok(interval.high > interval.rate);
});

test('strategic scenario labels always name legal moves', () => {
  for (const scenario of strategicScenarios) {
    const legal = new Set(legalMovesFor(scenario.game.hands[0], scenario.game.chain).map((move) => `${move.tile.id}:${move.side}`));
    assert.ok(scenario.expected.some((move) => legal.has(move)), `${scenario.id} has no legal expected move`);
  }
});

test('one matched deal produces a balanced 18-round evaluation', () => {
  const result = runMatchedBenchmark({ dealCount: 1, strongSamples: 8, seed: 'tiny-benchmark' });
  assert.equal(result.outcomes.rounds, 18);
  for (const strategy of STRATEGIES) {
    const stats = result.strategies[strategy];
    assert.equal(stats.appearances, 18);
    assert.deepEqual(stats.bySeat.map(({ trials }) => trials), [6, 6, 6]);
    assert.equal(stats.whenStarting.trials, 6);
    assert.equal(stats.whenNotStarting.trials, 12);
    assert.ok(stats.bySeatAndStarter.flat().every(({ trials }) => trials === 2));
  }
});

test('parallel and single-threaded benchmarks produce identical game results', async () => {
  const options = { dealCount: 2, strongSamples: 6, seed: 'parallel-check', confidenceResamples: 40 };
  const sequential = runMatchedBenchmark(options);
  const parallel = await runMatchedBenchmarkParallel({ ...options, workerCount: 2 });
  assert.deepEqual(parallel, sequential);
});

test('reliability corpus is balanced across realistic strategic phases', () => {
  const positions = collectDecisionCorpus({ positionsPerPhase: 1, seed: 'reliability-corpus-test' });
  assert.deepEqual(positions.map(({ phase }) => phase), RELIABILITY_PHASES);
  positions.forEach((position) => {
    assert.ok(legalMovesFor(position.game.hands[0], position.game.chain).length > 1);
    const safe = informationSafeBenchmarkGame(position.game);
    assert.deepEqual(safe.hands[0], position.game.hands[0]);
    assert.ok(safe.hands.slice(1).flat().every(({ a, b }) => a === -1 && b === -1));
  });
});

test('adaptive release gate requires absolute quality, baseline noninferiority, and sample savings', () => {
  const metric = (mean) => ({ mean, low: mean, high: mean });
  const adaptive = {
    withinOnePoint: metric(0.94),
    meanRegret: metric(0.12),
    mistakeLabelAgreement: metric(0.96),
    falsePositiveMistakes: metric(0.01),
    repeatAcceptability: metric(0.91),
    recommendationSetStability: metric(0.98),
    samplesUsed: { mean: metric(900) },
  };
  const baseline = {
    withinOnePoint: metric(0.95),
    meanRegret: metric(0.1),
    repeatAcceptability: metric(0.93),
  };

  assert.equal(adaptiveReliabilityGate(adaptive, 80, baseline, 1000).passed, true);
  assert.equal(adaptiveReliabilityGate({
    ...adaptive,
    samplesUsed: { mean: metric(951) },
  }, 80, baseline, 1000).passed, false);
});

test('reliability evaluation compares independent budgets against one reference', async () => {
  const [position] = collectDecisionCorpus({ positionsPerPhase: 1, seed: 'reliability-evaluation-test' });
  const evaluated = await evaluateReliabilityPosition(position, {
    budgets: [4, 8],
    repetitions: 2,
    referenceBudget: 12,
    adaptiveStages: [4, 8],
    seed: 'reliability-evaluation-test',
  });
  assert.equal(evaluated.budgets[4].trials.length, 2);
  assert.equal(evaluated.budgets[8].trials.length, 2);
  assert.ok(evaluated.reference.acceptableTopKeys.includes(evaluated.reference.topKey));
  assert.ok(evaluated.budgets[4].trials.every(({ regret }) => regret >= 0));
  assert.ok(evaluated.budgets[8].trials.every(({ intervalCoverage }) => typeof intervalCoverage === 'boolean'));
  assert.ok(evaluated.adaptive.trials.every(({ recommendationKeys, mistakeConfidence }) => (
    recommendationKeys.length >= 1 && ['clear', 'uncertain'].includes(mistakeConfidence)
  )));
  const summary = summarizeReliability([evaluated], {
    budgets: [4, 8],
    seed: 'reliability-evaluation-test',
    confidenceResamples: 20,
  });
  assert.equal(summary.positions, 1);
  assert.equal(summary.overall[4].trials, 2);
  assert.equal(summary.overall[8].positions, 1);
  assert.equal(Object.values(summary.branchingCounts).reduce((sum, count) => sum + count, 0), 1);
  assert.equal(summary.adaptive.trials, 2);
  assert.ok(summary.adaptive.samplesUsed.maximum <= 8);
  assert.ok(summary.adaptive.recommendationSetSize.mean >= 1);
  assert.ok(summary.adaptive.mistakeAbstentionRate.mean >= 0);
});

test('fixed and adaptive reliability analysis ignore changed real hidden hands', async () => {
  const [position] = collectDecisionCorpus({ positionsPerPhase: 1, seed: 'reliability-hidden-safety' });
  const reversedHidden = position.game.hands.slice(1).map((hand) => [...hand].reverse());
  const alternate = {
    ...position,
    game: { ...position.game, hands: [position.game.hands[0], ...reversedHidden.reverse()] },
  };
  const options = {
    budgets: [4],
    repetitions: 1,
    referenceBudget: 8,
    adaptiveStages: [4, 8],
    seed: 'reliability-hidden-safety',
  };
  const [first, second] = await Promise.all([
    evaluateReliabilityPosition(position, options),
    evaluateReliabilityPosition(alternate, options),
  ]);
  const decisionSignature = (result) => ({
    reference: [
      result.reference.topKey,
      result.reference.acceptableTopKeys,
      result.reference.verdict,
      result.reference.confidentMistake,
    ],
    fixed: result.budgets[4].trials.map(({ topKey, verdict, confidentMistake }) => [topKey, verdict, confidentMistake]),
    adaptive: result.adaptive.trials.map(({
      topKey,
      verdict,
      recommendationConfidence,
      recommendationKeys,
      mistakeConfidence,
      samplesUsed,
    }) => (
      [topKey, verdict, recommendationConfidence, recommendationKeys, mistakeConfidence, samplesUsed]
    )),
  });
  assert.deepEqual(decisionSignature(first), decisionSignature(second));
});

test('parallel reliability workers preserve deterministic decisions and labels', async () => {
  const positions = collectDecisionCorpus({ positionsPerPhase: 1, seed: 'reliability-parallel-test' }).slice(0, 2);
  const options = { budgets: [4], repetitions: 1, referenceBudget: 8, adaptiveStages: [4, 8], seed: 'reliability-parallel-test' };
  const sequential = await Promise.all(positions.map((position) => evaluateReliabilityPosition(position, options)));
  const parallel = await evaluateReliabilityParallel({ positions, options, workerCount: 2 });
  const decisions = (results) => results.map((result) => ({
    id: result.id,
    referenceTop: result.reference.topKey,
    referenceVerdict: result.reference.verdict,
    trialTop: result.budgets[4].trials[0].topKey,
    trialVerdict: result.budgets[4].trials[0].verdict,
    trialRegret: result.budgets[4].trials[0].regret,
  })).sort((left, right) => left.id.localeCompare(right.id));
  assert.deepEqual(decisions(parallel), decisions(sequential));
});

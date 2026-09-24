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
  adaptiveSamplingDevelopmentGate,
  adaptiveSelectionDevelopmentGate,
  collectDecisionCorpus,
  evaluateAnalyzerRolloutPosition,
  evaluateReliabilityPosition,
  informationSafeBenchmarkGame,
  summarizeReliability,
} from '../scripts/analyzer-reliability-core.mjs';
import {
  evaluatePositionsParallel,
  evaluateReliabilityParallel,
} from '../scripts/analyzer-reliability-parallel.mjs';
import {
  ROLLOUT_POLICIES,
  ROLLOUT_POLICY_LINEUPS,
  rolloutPolicyDevelopmentGate,
  runRolloutPolicyDeal,
  summarizeRolloutPolicyBenchmark,
} from '../scripts/rollout-policy-core.mjs';
import {
  analyzerRolloutPromotionGate,
  summarizeAnalyzerRollout,
} from '../scripts/analyzer-rollout-core.mjs';

test('matched schedule puts every strategy in every seat equally', () => {
  for (const strategy of STRATEGIES) {
    const seatCounts = [0, 1, 2].map((seat) => STRATEGY_LINEUPS.filter((lineup) => lineup[seat] === strategy).length);
    assert.deepEqual(seatCounts, [2, 2, 2]);
  }
});

test('rollout-policy schedule balances every policy across seats and omissions', () => {
  assert.equal(ROLLOUT_POLICY_LINEUPS.length, 24);
  for (const policy of ROLLOUT_POLICIES) {
    assert.equal(ROLLOUT_POLICY_LINEUPS.filter((lineup) => lineup.includes(policy)).length, 18);
    assert.deepEqual(
      [0, 1, 2].map((seat) => ROLLOUT_POLICY_LINEUPS.filter((lineup) => lineup[seat] === policy).length),
      [6, 6, 6],
    );
  }
});

test('one rollout-policy deal produces balanced phase-aware results', () => {
  const result = runRolloutPolicyDeal({ dealIndex: 0, seed: 'rollout-policy-deal-test' });
  assert.equal(result.rounds, 72);
  for (const policy of ROLLOUT_POLICIES) {
    const stats = result.strategies[policy];
    assert.equal(stats.appearances, 54);
    assert.deepEqual(stats.bySeat.map(({ trials }) => trials), [18, 18, 18]);
    assert.deepEqual(stats.byStarter.map(({ trials }) => trials), [18, 18, 18]);
    assert.equal(stats.whenStarting.trials, 18);
    assert.equal(stats.whenNotStarting.trials, 36);
    assert.ok(stats.decisions > 0);
  }
});

test('rollout-policy summary and diagnostic gate use paired complete deals', () => {
  const clusters = [0, 1].map((dealIndex) => runRolloutPolicyDeal({
    dealIndex,
    seed: 'rollout-policy-summary-test',
  }));
  const summary = summarizeRolloutPolicyBenchmark(clusters, {
    seed: 'rollout-policy-summary-test',
    confidenceResamples: 20,
  });
  assert.equal(summary.deals, 2);
  assert.equal(summary.rounds, 144);
  assert.deepEqual(Object.keys(summary.strategies), ROLLOUT_POLICIES);
  assert.deepEqual(Object.keys(summary.comparisons), ROLLOUT_POLICIES.slice(1));
  assert.ok(Object.values(summary.comparisons).every(({ gate }) => (
    typeof gate.passed === 'boolean'
  )));

  const metric = (mean, low = mean, high = mean) => ({ mean, low, high });
  const passing = {
    winRateDifference: metric(0.01, -0.005, 0.025),
    blockedWinRateDifference: metric(-0.01),
    losingPipsDifference: metric(0.5),
    phaseWinRateDifferences: Object.fromEntries(
      ['opening', 'middle', 'late', 'block'].map((phase) => [phase, metric(phase === 'middle' ? 0.02 : 0)]),
    ),
  };
  assert.equal(rolloutPolicyDevelopmentGate(passing).passed, true);
  assert.equal(rolloutPolicyDevelopmentGate({
    ...passing,
    phaseWinRateDifferences: { ...passing.phaseWinRateDifferences, opening: metric(-0.021) },
  }).passed, false);
});

test('parallel rollout-policy workers preserve deterministic deal results', async () => {
  const positions = [0, 1];
  const options = { seed: 'rollout-policy-parallel-test' };
  const sequential = positions.map((dealIndex) => runRolloutPolicyDeal({ dealIndex, ...options }));
  const parallel = await evaluatePositionsParallel({
    positions,
    options,
    workerCount: 2,
    workerUrl: new URL('../scripts/rollout-policy-worker.mjs', import.meta.url),
  });
  assert.deepEqual(parallel, sequential);
});

test('paired analyzer rollout evaluation is information-safe and summarizes both references', async () => {
  const position = collectDecisionCorpus({
    positionsPerPhase: 1,
    seed: 'analyzer-rollout-safety-test',
  }).find(({ phase }) => phase === 'middle');
  const hidden = [...position.game.hands[1], ...position.game.hands[2]].reverse();
  const firstHiddenSize = position.game.hands[1].length;
  const alternate = {
    ...position,
    game: {
      ...position.game,
      hands: [
        position.game.hands[0],
        hidden.slice(0, firstHiddenSize),
        hidden.slice(firstHiddenSize),
      ],
    },
  };
  const options = {
    repetitions: 1,
    referenceBudget: 12,
    adaptiveStages: [4, 8],
    seed: 'analyzer-rollout-safety-test',
  };
  const [first, second] = await Promise.all([
    evaluateAnalyzerRolloutPosition(position, options),
    evaluateAnalyzerRolloutPosition(alternate, options),
  ]);
  const signature = (result) => ({
    references: Object.fromEntries(Object.entries(result.references).map(([policy, reference]) => [
      policy,
      [reference.topKey, reference.acceptableTopKeys, reference.verdict, reference.rates],
    ])),
    policies: Object.fromEntries(Object.entries(result.policies).map(([policy, value]) => [
      policy,
      value.trials.map(({ topKey, regret, withinOnePoint, verdict, samplesUsed }) => (
        [topKey, regret, withinOnePoint, verdict, samplesUsed]
      )),
    ])),
    paired: result.paired,
  });
  assert.deepEqual(signature(first), signature(second));
  const summary = summarizeAnalyzerRollout([first], {
    seed: options.seed,
    confidenceResamples: 10,
  });
  assert.equal(summary.positions, 1);
  assert.equal(summary.policies.current.trials, 1);
  assert.equal(summary.policies['exhaustive-forecast'].trials, 1);
  assert.equal(typeof summary.gate.passed, 'boolean');
});

test('analyzer rollout promotion gate requires robust quality and controlled cost', () => {
  const metric = (mean, low = mean, high = mean) => ({ mean, low, high });
  const policy = {
    withinOnePoint: metric(0.95),
    meanRegret: metric(0.1),
    mistakeLabelAgreement: metric(0.98),
    falsePositiveMistakes: metric(0.01),
    repeatAcceptability: metric(0.92),
    samplesUsed: metric(1000),
    runtimeMs: metric(1000),
    exactOracleAgreement: metric(0.8),
  };
  const comparison = {
    selectionChangeRate: metric(0.1),
    ownWithinOneDifference: metric(0),
    ownRegretDifference: metric(0),
    repeatAcceptabilityDifference: metric(0),
    mistakeLabelAgreementDifference: metric(0),
    falsePositiveDifference: metric(0),
    robustRegretDifference: metric(-0.02, -0.05, 0.05),
    bothReferencesWithinOneDifference: metric(0),
    exactOracleAgreementDifference: metric(0),
  };
  const summary = {
    policies: { current: policy, 'exhaustive-forecast': policy },
    comparison,
    byPhase: Object.fromEntries(['opening', 'middle', 'late', 'block'].map((phase) => [
      phase,
      { comparison: { robustRegretDifference: metric(0) } },
    ])),
  };
  assert.equal(analyzerRolloutPromotionGate(summary).passed, true);
  assert.equal(analyzerRolloutPromotionGate({
    ...summary,
    comparison: { ...comparison, robustRegretDifference: metric(0.01, -0.01, 0.05) },
  }).passed, false);
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

test('selection development gate requires changed decisions and preserves shared evidence', () => {
  const metric = (mean) => ({ mean, low: mean, high: mean });
  const control = {
    repeatAcceptability: metric(0.89),
    withinOnePoint: metric(0.95),
    meanRegret: metric(0.11),
    mistakeLabelAgreement: metric(0.92),
    falsePositiveMistakes: metric(0.01),
    samplesUsed: { mean: metric(1775) },
  };
  const candidate = {
    ...control,
    selectionChangeRate: metric(0.03),
    repeatAcceptability: metric(0.9),
    withinOnePoint: metric(0.945),
    meanRegret: metric(0.12),
  };

  assert.equal(adaptiveSelectionDevelopmentGate(candidate, control).passed, true);
  assert.equal(adaptiveSelectionDevelopmentGate({
    ...candidate,
    selectionChangeRate: metric(0),
  }, control).passed, false);
});

test('phase-aware sampling gate requires middle-game regret improvement and preserved quality', () => {
  const metric = (mean) => ({ mean, low: mean, high: mean });
  const control = {
    repeatAcceptability: metric(0.91),
    withinOnePoint: metric(0.95),
    meanRegret: metric(0.14),
    mistakeLabelAgreement: metric(0.96),
    falsePositiveMistakes: metric(0.01),
    samplesUsed: { mean: metric(1800) },
  };
  const candidate = {
    ...control,
    repeatAcceptability: metric(0.92),
    withinOnePoint: metric(0.945),
    meanRegret: metric(0.15),
    samplesUsed: { mean: metric(1750) },
  };
  const middleControl = { meanRegret: metric(0.25) };
  const middleCandidate = {
    meanRegret: metric(0.21),
    selectionChangeRate: metric(0.08),
  };

  assert.equal(adaptiveSamplingDevelopmentGate(
    candidate,
    control,
    middleCandidate,
    middleControl,
  ).passed, true);
  assert.equal(adaptiveSamplingDevelopmentGate(
    candidate,
    control,
    { ...middleCandidate, meanRegret: metric(0.23) },
    middleControl,
  ).passed, false);
});

test('reliability evaluation compares independent budgets against one reference', async () => {
  const [position] = collectDecisionCorpus({ positionsPerPhase: 1, seed: 'reliability-evaluation-test' });
  const evaluated = await evaluateReliabilityPosition(position, {
    budgets: [4, 8],
    repetitions: 2,
    referenceBudget: 12,
    adaptiveStages: [4, 8],
    adaptiveSelectionPolicies: ['confidence-adjusted', 'downside-protected'],
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
  assert.ok(evaluated.adaptive.trials.every(({ choiceBatchGaps }) => choiceBatchGaps.length >= 2));
  assert.deepEqual(Object.keys(evaluated.adaptiveVariants), ['confidence-adjusted', 'downside-protected']);
  assert.ok(evaluated.adaptiveVariants['confidence-adjusted'].trials.every(({ selectionEvidence }) => (
    selectionEvidence.length >= 1
  )));
  assert.deepEqual(
    evaluated.adaptiveVariants['confidence-adjusted'].trials.map(({ samplesUsed }) => samplesUsed),
    evaluated.adaptive.trials.map(({ samplesUsed }) => samplesUsed),
  );
  assert.deepEqual(
    evaluated.adaptiveVariants['confidence-adjusted'].trials.map(({ mistakeAssessment }) => mistakeAssessment),
    evaluated.adaptive.trials.map(({ mistakeAssessment }) => mistakeAssessment),
  );
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
  assert.equal(summary.adaptiveVariants['confidence-adjusted'].trials, 2);
  assert.equal(summary.adaptiveVariants['downside-protected'].samplesUsed.mean.mean, summary.adaptive.samplesUsed.mean.mean);
});

test('paired refinement reuses reference, fixed budgets, and the exact pre-refinement control', async () => {
  const [position] = collectDecisionCorpus({ positionsPerPhase: 1, seed: 'paired-refinement-reuse-test' });
  const shared = {
    budgets: [4, 8],
    repetitions: 1,
    referenceBudget: 12,
    adaptiveStages: [4, 8],
    adaptiveRefinementMaximumGap: 100,
    seed: 'paired-refinement-reuse-test',
  };
  const [standaloneControl, paired] = await Promise.all([
    evaluateReliabilityPosition(position, { ...shared, adaptiveRefinementSamples: 0 }),
    evaluateReliabilityPosition(position, { ...shared, adaptiveRefinementSamples: 4 }),
  ]);
  const withoutTiming = (value) => {
    if (Array.isArray(value)) return value.map(withoutTiming);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['elapsedMs', 'runtimeMs'].includes(key))
      .map(([key, entry]) => [key, withoutTiming(entry)]));
  };

  assert.deepEqual(withoutTiming(paired.reference), withoutTiming(standaloneControl.reference));
  assert.deepEqual(withoutTiming(paired.budgets), withoutTiming(standaloneControl.budgets));
  assert.deepEqual(withoutTiming(paired.adaptiveControl), withoutTiming(standaloneControl.adaptive));
  assert.ok(paired.adaptive.trials[0].samplesUsed >= paired.adaptiveControl.trials[0].samplesUsed);

  const summaryOptions = {
    budgets: shared.budgets,
    seed: shared.seed,
    confidenceResamples: 20,
  };
  const controlSummary = summarizeReliability([standaloneControl], summaryOptions);
  const pairedSummary = summarizeReliability([paired], summaryOptions);
  assert.deepEqual(withoutTiming(pairedSummary.reference), withoutTiming(controlSummary.reference));
  assert.deepEqual(withoutTiming(pairedSummary.overall), withoutTiming(controlSummary.overall));
  assert.deepEqual(withoutTiming(pairedSummary.adaptiveControl), withoutTiming(controlSummary.adaptive));
  assert.equal(pairedSummary.adaptiveControl.trials, 1);
  assert.equal(pairedSummary.adaptive.trials, 1);
});

test('phase-aware sampling changes only middle-game evidence and reuses every other control trial', async () => {
  const positions = collectDecisionCorpus({ positionsPerPhase: 1, seed: 'phase-aware-sampling-test' });
  const opening = positions.find(({ phase }) => phase === 'opening');
  const middle = positions.find(({ phase }) => phase === 'middle');
  const options = {
    budgets: [4],
    repetitions: 2,
    referenceBudget: 8,
    adaptiveStages: [4, 8],
    adaptiveSamplingPolicies: ['phase-aware'],
    seed: 'phase-aware-sampling-test',
  };
  const [openingResult, middleResult] = await Promise.all([
    evaluateReliabilityPosition(opening, options),
    evaluateReliabilityPosition(middle, options),
  ]);
  const withoutSamplingFields = (trial) => Object.fromEntries(
    Object.entries(trial).filter(([key]) => ![
      'samplingPolicy',
      'selectionChanged',
      'reusedControl',
    ].includes(key)),
  );

  assert.deepEqual(
    openingResult.adaptiveSamplingVariants['phase-aware'].trials.map(withoutSamplingFields),
    openingResult.adaptive.trials,
  );
  assert.ok(openingResult.adaptiveSamplingVariants['phase-aware'].trials.every((trial) => (
    trial.reusedControl && !trial.selectionChanged
  )));
  assert.ok(middleResult.adaptiveSamplingVariants['phase-aware'].trials.every((trial) => (
    !trial.reusedControl && trial.samplesUsed <= 8
  )));

  const summary = summarizeReliability([openingResult, middleResult], {
    budgets: options.budgets,
    seed: options.seed,
    confidenceResamples: 20,
  });
  assert.equal(summary.adaptiveSamplingVariants['phase-aware'].trials, 4);
  assert.equal(summary.adaptiveSamplingVariantsByPhase['phase-aware'].middle.trials, 2);
});

test('fixed and adaptive reliability analysis ignore changed real hidden hands', async () => {
  const position = collectDecisionCorpus({
    positionsPerPhase: 1,
    seed: 'reliability-hidden-safety',
  }).find(({ phase }) => phase === 'middle');
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
    adaptiveSelectionPolicies: ['batch-consensus'],
    adaptiveSamplingPolicies: ['phase-aware'],
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
    adaptiveVariant: result.adaptiveVariants['batch-consensus'].trials.map(({ topKey, samplesUsed }) => (
      [topKey, samplesUsed]
    )),
    samplingVariant: result.adaptiveSamplingVariants['phase-aware'].trials.map(({
      topKey,
      verdict,
      mistakeConfidence,
      samplesUsed,
    }) => [topKey, verdict, mistakeConfidence, samplesUsed]),
  });
  assert.deepEqual(decisionSignature(first), decisionSignature(second));
});

test('parallel reliability workers preserve deterministic decisions and labels', async () => {
  const positions = collectDecisionCorpus({ positionsPerPhase: 1, seed: 'reliability-parallel-test' }).slice(0, 2);
  const options = {
    budgets: [4],
    repetitions: 1,
    referenceBudget: 8,
    adaptiveStages: [4, 8],
    adaptiveSelectionPolicies: ['downside-protected'],
    adaptiveSamplingPolicies: ['phase-aware'],
    seed: 'reliability-parallel-test',
  };
  const sequential = await Promise.all(positions.map((position) => evaluateReliabilityPosition(position, options)));
  const parallel = await evaluateReliabilityParallel({ positions, options, workerCount: 2 });
  const decisions = (results) => results.map((result) => ({
    id: result.id,
    referenceTop: result.reference.topKey,
    referenceVerdict: result.reference.verdict,
    trialTop: result.budgets[4].trials[0].topKey,
    trialVerdict: result.budgets[4].trials[0].verdict,
    trialRegret: result.budgets[4].trials[0].regret,
    selectionTop: result.adaptiveVariants['downside-protected'].trials[0].topKey,
    samplingTop: result.adaptiveSamplingVariants['phase-aware'].trials[0].topKey,
  })).sort((left, right) => left.id.localeCompare(right.id));
  assert.deepEqual(decisions(parallel), decisions(sequential));
});

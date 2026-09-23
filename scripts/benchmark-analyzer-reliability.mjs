import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  ADAPTIVE_SELECTION_POLICIES,
  ADAPTIVE_SELECTION_VERSION,
  DEFAULT_ADAPTIVE_MISTAKE_POLICY,
  DEFAULT_ADAPTIVE_REFINEMENT_MAXIMUM_GAP,
  adaptiveAnalysisVersion,
  DEFAULT_ADAPTIVE_STAGES,
} from '../app/adaptive-analysis.ts';
import {
  RELIABILITY_BRANCHING_BANDS,
  RELIABILITY_PHASES,
  adaptiveReliabilityGate,
  adaptiveSelectionDevelopmentGate,
  collectDecisionCorpus,
  reliabilityGate,
  summarizeReliability,
} from './analyzer-reliability-core.mjs';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluateReliabilityParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function positiveInteger(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function nonnegativeInteger(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a nonnegative integer.`);
  return parsed;
}

function nonnegativeNumber(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a nonnegative number.`);
  return parsed;
}

function fraction(value, fallback, label) {
  const parsed = nonnegativeNumber(value, fallback, label);
  if (parsed > 1) throw new Error(`${label} must be between zero and one.`);
  return parsed;
}

function numberList(value, fallback, label) {
  const entries = (value ?? fallback).split(',').map((entry) => Number(entry.trim()));
  if (!entries.length || entries.some((entry) => !Number.isInteger(entry) || entry <= 0)) {
    throw new Error(`${label} must be a comma-separated list of positive integers.`);
  }
  return [...new Set(entries)].sort((left, right) => left - right);
}

function selectionPolicyList(value) {
  if (!value) return [];
  const policies = [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))];
  const invalid = policies.filter((policy) => !ADAPTIVE_SELECTION_POLICIES.includes(policy));
  if (invalid.length) throw new Error(`Unknown adaptive selection policies: ${invalid.join(', ')}.`);
  return policies.filter((policy) => policy !== 'mean');
}

function percent(metric) {
  return `${(metric.mean * 100).toFixed(1)}% [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

function points(metric) {
  return `${metric.mean.toFixed(2)} [${metric.low.toFixed(2)}, ${metric.high.toFixed(2)}]`;
}

function metricRow(label, row) {
  return `${label} | ${percent(row.exactTopAgreement)} | ${percent(row.topAgreement)} | ${percent(row.withinOnePoint)} | ${points(row.meanRegret)} | ${percent(row.mistakeLabelAgreement)} | ${percent(row.falsePositiveMistakes)} | ${percent(row.falseNegativeMistakes)} | ${percent(row.mistakeAbstentionRate)} | ${percent(row.decidedMistakeAccuracy)} | ${percent(row.repeatAcceptability)} | ${percent(row.recommendationSetStability)} | ${Math.round(row.runtimeMs.mean)} / ${Math.round(row.runtimeMs.p95)} ms`;
}

function selectionLabel(policy) {
  return policy.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function printTable(title, fixed, adaptive, budgets, adaptiveControl, adaptiveVariants = {}) {
  console.log(`\n${title}`);
  console.log('Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time');
  console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
  budgets.forEach((budget) => console.log(metricRow(`Fixed ${budget}`, fixed[budget])));
  if (adaptiveControl?.trials) console.log(metricRow('Adaptive control', adaptiveControl));
  if (adaptive?.trials) console.log(metricRow(
    adaptiveControl ? 'Adaptive refined' : Object.keys(adaptiveVariants).length ? 'Adaptive mean' : 'Adaptive',
    adaptive,
  ));
  Object.entries(adaptiveVariants).forEach(([policy, row]) => {
    if (row?.trials) console.log(metricRow(`Selection ${selectionLabel(policy)}`, row));
  });
}

function markdownTable(fixed, adaptive, budgets, adaptiveControl, adaptiveVariants = {}) {
  return [
    '| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...budgets.map((budget) => `| ${metricRow(`Fixed ${budget}`, fixed[budget])} |`),
    ...(adaptiveControl?.trials ? [`| ${metricRow('Adaptive control', adaptiveControl)} |`] : []),
    ...(adaptive?.trials ? [`| ${metricRow(
      adaptiveControl ? 'Adaptive refined' : Object.keys(adaptiveVariants).length ? 'Adaptive mean' : 'Adaptive',
      adaptive,
    )} |`] : []),
    ...Object.entries(adaptiveVariants)
      .filter(([, row]) => row?.trials)
      .map(([policy, row]) => `| ${metricRow(`Selection ${selectionLabel(policy)}`, row)} |`),
  ].join('\n');
}

function renderReport({
  config,
  summary,
  budgets,
  adaptiveGate,
  adaptiveVariantGates,
  selectionDecision,
}) {
  const comparisonBudget = Math.max(...budgets);
  const comparison = summary.overall[comparisonBudget];
  const sampleSavings = comparisonBudget
    ? (1 - summary.adaptive.samplesUsed.mean.mean / comparisonBudget) * 100
    : 0;
  const runtimeSavings = comparison.runtimeMs.mean
    ? (1 - summary.adaptive.runtimeMs.mean / comparison.runtimeMs.mean) * 100
    : 0;
  const falsePositiveChange = (summary.adaptive.falsePositiveMistakes.mean - comparison.falsePositiveMistakes.mean) * 100;
  const closeAllocation = summary.adaptive.samplesByReferenceClarity.clear.mean
    ? summary.adaptive.samplesByReferenceClarity.unclear.mean / summary.adaptive.samplesByReferenceClarity.clear.mean
    : 0;
  const failedChecks = Object.entries(adaptiveGate.checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => check);
  const matchedComparison = adaptiveGate.checks.withinOnePointNoninferior
    && adaptiveGate.checks.meanRegretNoninferior
    && adaptiveGate.checks.repeatAcceptabilityNoninferior;
  const stageTotal = Object.values(summary.adaptive.stoppingStages).reduce((sum, count) => sum + count, 0);
  const stageRows = Object.entries(summary.adaptive.stoppingStages).map(([stage, count]) => (
    `| ${stage} | ${count} | ${stageTotal ? (count / stageTotal * 100).toFixed(1) : '0.0'}% |`
  ));
  const gateRows = Object.entries(adaptiveGate.checks).map(([check, passed]) => `| ${check} | ${passed ? 'PASS' : 'FAIL'} |`);
  const phaseSections = RELIABILITY_PHASES.map((phase) => (
    `### ${phase}\n\n${markdownTable(
      summary.byPhase[phase],
      summary.adaptiveByPhase[phase],
      budgets,
      summary.adaptiveControlByPhase?.[phase],
      Object.fromEntries(Object.entries(summary.adaptiveVariantsByPhase).map(([policy, phases]) => (
        [policy, phases[phase]]
      ))),
    )}`
  ));
  const branchingSections = RELIABILITY_BRANCHING_BANDS
    .filter((band) => summary.branchingCounts[band])
    .map((band) => `### ${band}\n\n${markdownTable(
      summary.byBranching[band],
      summary.adaptiveByBranching[band],
      budgets,
      summary.adaptiveControlByBranching?.[band],
      Object.fromEntries(Object.entries(summary.adaptiveVariantsByBranching).map(([policy, bands]) => (
        [policy, bands[band]]
      ))),
    )}`);
  const pairedControlComparison = summary.adaptiveControl
    ? `\n\nThe V3 control and refined candidate share the same reference, fixed-budget results, and pre-refinement adaptive stages. The control is captured immediately before candidate-only refinement, so this comparison adds no duplicate simulations. Timing is reported separately because shared execution changes timing boundaries.`
    : '';
  const selectionGateRows = Object.entries(adaptiveVariantGates).flatMap(([policy, gate]) => (
    Object.entries(gate.checks).map(([check, passed]) => (
      `| ${selectionLabel(policy)} | ${check} | ${passed ? 'PASS' : 'FAIL'} |`
    ))
  ));
  const selectionConclusion = config.adaptiveSelectionPolicies?.length
    ? `\n\nThe V5 selection experiment evaluated ${config.adaptiveSelectionPolicies.length} policies from the same adaptive simulations. ${selectionDecision.selectedPolicy ? `The development winner is **${selectionLabel(selectionDecision.selectedPolicy)}**. It may advance to a separately locked holdout, but it is not a live-coach promotion.` : 'No policy passed every predeclared development check, so none may advance to a holdout or the live coach.'}`
    : '';
  return `# Mesa Quince adaptive analyzer reliability study

Generated: ${new Date().toISOString()}

## Configuration

- ${summary.positions} positions: ${RELIABILITY_PHASES.map((phase) => `${summary.phaseCounts[phase]} ${phase}`).join(', ')}
- ${config.repetitions} independent repetitions per analyzer
- Fixed budgets: ${budgets.join(', ')}
- Adaptive stages: ${config.adaptiveStages.join(', ')}
- Candidate-only refinement: ${config.adaptiveRefinementSamples ? `${config.adaptiveRefinementSamples} samples when the unresolved top-set gap is at most ${config.adaptiveRefinementMaximumGap} points` : 'disabled'}
- Paired pre-refinement control: ${config.captureAdaptiveControl ? 'captured from the same run' : 'not requested'}
- Robust selection policies: ${config.adaptiveSelectionPolicies?.length ? config.adaptiveSelectionPolicies.join(', ') : 'disabled'}
- Recommendation equivalence gap: ${config.adaptiveRecommendationGap} point(s)
- Mistake practical gap: ${config.adaptiveMistakePolicy.practicalGap} point(s)
- Mistake minimum estimated loss: ${config.adaptiveMistakePolicy.minimumGap} point(s)
- Mistake batch agreement: ${(config.adaptiveMistakePolicy.minimumBatchAgreement * 100).toFixed(0)}%
- Mistake practical batch agreement: ${(config.adaptiveMistakePolicy.minimumPracticalBatchAgreement * 100).toFixed(0)}%
- Independent reference: ${config.referenceBudget} samples
- Worker threads: ${config.workers}
- Seed: \`${config.seed}\`
- Adaptive implementation: \`${config.adaptiveVersion}\`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Conclusion

The adaptive analyzer **${adaptiveGate.passed ? 'passed' : 'failed'} the release gate** and ${adaptiveGate.passed ? 'can proceed to controlled release integration' : 'must remain outside the live coach'}. It ${matchedComparison ? 'matched or improved' : 'did not match'} fixed ${comparisonBudget} on the combined near-optimality, regret, and repeatability comparison. It used ${sampleSavings.toFixed(1)}% fewer paired samples and ${runtimeSavings.toFixed(1)}% less mean wall time, while its false-positive mistake rate changed by ${falsePositiveChange >= 0 ? '+' : ''}${falsePositiveChange.toFixed(2)} percentage points.

The sampler allocated more computation to harder decisions: reference-unclear positions used ${closeAllocation.toFixed(2)} times as many samples as reference-clear positions. Its median stopping budget was ${summary.adaptive.samplesUsed.p50}, ${(summary.adaptive.uncertainRate.mean * 100).toFixed(1)}% of recommendations ended uncertain, and ${(summary.adaptive.mistakeAbstentionRate.mean * 100).toFixed(1)}% of coaching labels abstained. Failed release checks: ${failedChecks.length ? failedChecks.join(', ') : 'none'}.

This adaptive sampler widens uncertainty when independent batches disagree, requires a fresh confirmation batch before early stopping, delays decisions according to phase and legal-move count, and treats statistically equivalent moves as one plausible-best set. Recommendation confidence and mistake confidence are separate, so the coach can abstain from a mistake label even when it still offers a tentative move.${pairedControlComparison}${selectionConclusion}

## Overall results

${markdownTable(summary.overall, summary.adaptive, budgets, summary.adaptiveControl, summary.adaptiveVariants)}

## Adaptive computation

- Mean samples: ${points(summary.adaptive.samplesUsed.mean)}
- Median samples: ${summary.adaptive.samplesUsed.p50}
- P95 samples: ${summary.adaptive.samplesUsed.p95}
- Maximum samples: ${summary.adaptive.samplesUsed.maximum}
- Hard-cap rate: ${percent(summary.adaptive.hardCapRate)}
- Uncertain-at-stop rate: ${percent(summary.adaptive.uncertainRate)}
- Candidate-refinement rate: ${percent(summary.adaptive.refinementRate)}
- Mean plausible-best set size: ${points(summary.adaptive.recommendationSetSize)}
- Coaching-label abstention rate: ${percent(summary.adaptive.mistakeAbstentionRate)}
- Accuracy among non-abstained coaching labels: ${percent(summary.adaptive.decidedMistakeAccuracy)}
- Mean samples on reference-clear positions: ${points(summary.adaptive.samplesByReferenceClarity.clear)}
- Mean samples on reference-unclear positions: ${points(summary.adaptive.samplesByReferenceClarity.unclear)}

| Stopping stage | Trials | Share |
| ---: | ---: | ---: |
${stageRows.join('\n')}

## Release gate

Adaptive result: **${adaptiveGate.passed ? 'PASS' : 'FAIL'}**

| Check | Result |
| --- | --- |
${gateRows.join('\n')}

${selectionGateRows.length ? `## V5 selection-development gates

Selected policy: **${selectionDecision.selectedPolicy ? selectionLabel(selectionDecision.selectedPolicy) : 'none'}**

| Policy | Check | Result |
| --- | --- | --- |
${selectionGateRows.join('\n')}
` : ''}

## Results by phase

${phaseSections.join('\n\n')}

## Results by legal-move count

${branchingSections.join('\n\n')}

## Exact endgame diagnostic

${summary.reference.exactPositions} positions were small enough for the deal-specific exact solver. The information-safe reference selected an exact winning action in ${summary.reference.exactPositions ? (summary.reference.exactOracleAgreement * 100).toFixed(1) : '0.0'}% of them. This is diagnostic only because the exact solver sees the realized hidden deal and the analyzer correctly does not.
`;
}

const quick = process.argv.includes('--quick');
const fixedOnly = process.argv.includes('--fixed-only');
const resume = process.argv.includes('--resume');
const positionsPerPhase = positiveInteger(
  argument('positions-per-phase') ?? process.env.MESA_RELIABILITY_POSITIONS_PER_PHASE,
  quick ? 1 : 4,
  'Positions per phase',
);
const repetitions = positiveInteger(
  argument('repetitions') ?? process.env.MESA_RELIABILITY_REPETITIONS,
  quick ? 1 : 3,
  'Independent repetitions',
);
const budgets = numberList(
  argument('budgets') ?? process.env.MESA_RELIABILITY_BUDGETS,
  quick ? '60,120' : '120,500,1000,2000',
  'Budgets',
);
const adaptiveStages = numberList(
  argument('adaptive-stages') ?? process.env.MESA_RELIABILITY_ADAPTIVE_STAGES,
  quick ? '60,120,250' : DEFAULT_ADAPTIVE_STAGES.join(','),
  'Adaptive stages',
);
const adaptiveRecommendationGap = nonnegativeNumber(
  argument('adaptive-recommendation-gap') ?? process.env.MESA_RELIABILITY_ADAPTIVE_RECOMMENDATION_GAP,
  1,
  'Adaptive recommendation gap',
);
const adaptiveSelectionPolicies = selectionPolicyList(
  argument('adaptive-selection-policies') ?? process.env.MESA_RELIABILITY_ADAPTIVE_SELECTION_POLICIES,
);
const adaptiveRefinementSamples = nonnegativeInteger(
  argument('adaptive-refinement-samples') ?? process.env.MESA_RELIABILITY_ADAPTIVE_REFINEMENT_SAMPLES,
  0,
  'Adaptive refinement sample count',
);
const adaptiveRefinementMaximumGap = nonnegativeNumber(
  argument('adaptive-refinement-max-gap') ?? process.env.MESA_RELIABILITY_ADAPTIVE_REFINEMENT_MAX_GAP,
  DEFAULT_ADAPTIVE_REFINEMENT_MAXIMUM_GAP,
  'Adaptive refinement maximum gap',
);
const adaptiveMistakePolicy = {
  ...DEFAULT_ADAPTIVE_MISTAKE_POLICY,
  practicalGap: nonnegativeNumber(
    argument('adaptive-mistake-practical-gap') ?? process.env.MESA_RELIABILITY_ADAPTIVE_MISTAKE_PRACTICAL_GAP,
    DEFAULT_ADAPTIVE_MISTAKE_POLICY.practicalGap,
    'Adaptive mistake practical gap',
  ),
  minimumGap: nonnegativeNumber(
    argument('adaptive-mistake-minimum-gap') ?? process.env.MESA_RELIABILITY_ADAPTIVE_MISTAKE_MINIMUM_GAP,
    DEFAULT_ADAPTIVE_MISTAKE_POLICY.minimumGap,
    'Adaptive mistake minimum gap',
  ),
  minimumBatchAgreement: fraction(
    argument('adaptive-mistake-batch-agreement') ?? process.env.MESA_RELIABILITY_ADAPTIVE_MISTAKE_BATCH_AGREEMENT,
    DEFAULT_ADAPTIVE_MISTAKE_POLICY.minimumBatchAgreement,
    'Adaptive mistake batch agreement',
  ),
  minimumPracticalBatchAgreement: fraction(
    argument('adaptive-mistake-practical-batch-agreement')
      ?? process.env.MESA_RELIABILITY_ADAPTIVE_MISTAKE_PRACTICAL_BATCH_AGREEMENT,
    DEFAULT_ADAPTIVE_MISTAKE_POLICY.minimumPracticalBatchAgreement,
    'Adaptive mistake practical batch agreement',
  ),
};
const referenceBudget = positiveInteger(
  argument('reference-samples') ?? process.env.MESA_RELIABILITY_REFERENCE_SAMPLES,
  quick ? 500 : 4000,
  'Reference sample count',
);
const confidenceResamples = positiveInteger(
  argument('confidence-resamples') ?? process.env.MESA_RELIABILITY_CONFIDENCE_RESAMPLES,
  quick ? 400 : 2000,
  'Confidence resample count',
);
const seed = argument('seed') ?? process.env.MESA_RELIABILITY_SEED ?? 'mesa-quince-reliability-v1';
const jsonPath = argument('json');
const reportPath = argument('report');
const checkpointPath = argument('checkpoint');
const positionCount = positionsPerPhase * RELIABILITY_PHASES.length;
const workers = positiveInteger(
  argument('workers') ?? process.env.MESA_RELIABILITY_WORKERS,
  reliabilityWorkerCount(positionCount),
  'Worker count',
);
const config = {
  schema: 3,
  seed,
  positionsPerPhase,
  repetitions,
  budgets,
  referenceBudget,
  confidenceResamples,
  workers,
  includeAdaptive: !fixedOnly,
  adaptiveStages,
  adaptiveVersion: adaptiveAnalysisVersion(adaptiveRefinementSamples),
  ...(adaptiveSelectionPolicies.length ? {
    adaptiveSelectionVersion: ADAPTIVE_SELECTION_VERSION,
    adaptiveSelectionPolicies,
  } : {}),
  adaptiveRecommendationGap,
  adaptiveMistakePolicy,
  ...(adaptiveRefinementSamples > 0 ? {
    adaptiveRefinementSamples,
    adaptiveRefinementMaximumGap,
    captureAdaptiveControl: true,
  } : {}),
};

console.log('MESA QUINCE ANALYZER RELIABILITY BENCHMARK');
console.log(`Collecting ${positionsPerPhase} realistic positions from each phase.`);
const positions = collectDecisionCorpus({ positionsPerPhase, seed, maxDeals: Math.max(2400, positionsPerPhase * 80) });
console.log(`Comparing fixed ${budgets.join(', ')} samples${fixedOnly ? '' : ` and adaptive ${adaptiveStages.join(' / ')}`} against an independent ${referenceBudget}-sample reference.`);
console.log(`${repetitions} independent runs per analyzer, ${workers} worker threads.`);

let checkpoint = null;
let priorResults = [];
if (checkpointPath) {
  checkpoint = await prepareReliabilityCheckpoint({ directory: checkpointPath, config, resume });
  const expectedIds = new Set(positions.map(({ id }) => id));
  const unexpected = checkpoint.results.filter(({ id }) => !expectedIds.has(id));
  if (unexpected.length) throw new Error(`Checkpoint contains positions outside this corpus: ${unexpected.map(({ id }) => id).join(', ')}`);
  priorResults = checkpoint.results;
  console.log(`Checkpoint: ${checkpoint.root} (${priorResults.length}/${positions.length} complete).`);
} else if (resume) {
  throw new Error('--resume requires --checkpoint=PATH.');
}

const completedIds = new Set(priorResults.map(({ id }) => id));
const pendingPositions = positions.filter(({ id }) => !completedIds.has(id));
let completed = priorResults.length;
const freshResults = pendingPositions.length
  ? await evaluateReliabilityParallel({
    positions: pendingPositions,
    options: {
      budgets,
      repetitions,
      referenceBudget,
      seed,
      includeAdaptive: !fixedOnly,
      adaptiveStages,
      adaptiveRecommendationGap,
      adaptiveMistakePolicy,
      adaptiveRefinementSamples,
      adaptiveRefinementMaximumGap,
      adaptiveSelectionPolicies,
    },
    workerCount: workers,
    onProgress: (positionId) => {
      completed += 1;
      console.log(`Progress: ${completed}/${positions.length} positions (${positionId})`);
    },
    onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
  })
  : [];
const results = [...priorResults, ...freshResults].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeReliability(results, { budgets, seed, confidenceResamples });

console.log(`\nCORPUS\n${summary.positions} positions | ${RELIABILITY_PHASES.map((phase) => `${phase} ${summary.phaseCounts[phase]}`).join(' | ')}`);
console.log(`Reference marked ${summary.reference.clearRecommendations}/${summary.positions} recommendations statistically clear.`);
printTable(
  'OVERALL RELIABILITY',
  summary.overall,
  summary.adaptive,
  budgets,
  summary.adaptiveControl,
  summary.adaptiveVariants,
);
RELIABILITY_PHASES.forEach((phase) => printTable(
  `${phase.toUpperCase()} RELIABILITY`,
  summary.byPhase[phase],
  summary.adaptiveByPhase[phase],
  budgets,
  summary.adaptiveControlByPhase?.[phase],
  Object.fromEntries(Object.entries(summary.adaptiveVariantsByPhase).map(([policy, phases]) => (
    [policy, phases[phase]]
  ))),
));
RELIABILITY_BRANCHING_BANDS.forEach((band) => {
  if (summary.branchingCounts[band]) printTable(
    `${band.toUpperCase()} (${summary.branchingCounts[band]} POSITIONS)`,
    summary.byBranching[band],
    summary.adaptiveByBranching[band],
    budgets,
    summary.adaptiveControlByBranching?.[band],
    Object.fromEntries(Object.entries(summary.adaptiveVariantsByBranching).map(([policy, bands]) => (
      [policy, bands[band]]
    ))),
  );
});

if (summary.reference.exactPositions) {
  console.log(`\nDEAL-SPECIFIC EXACT ENDGAMES\n${summary.reference.exactPositions} positions were small enough to solve with revealed hands.`);
  console.log(`The information-safe reference selected a deal-specific winning action in ${(summary.reference.exactOracleAgreement * 100).toFixed(1)}% of them.`);
  console.log('This is a diagnostic only. The exact solver sees the realized hidden deal, while the analyzer correctly does not.');
}

const fixedGates = Object.fromEntries(budgets.map((budget) => [budget, reliabilityGate(summary.overall[budget], summary.positions)]));
const adaptiveBaselineBudget = Math.max(...budgets);
const adaptiveGate = adaptiveReliabilityGate(
  summary.adaptive,
  summary.positions,
  summary.overall[adaptiveBaselineBudget],
  adaptiveBaselineBudget,
);
const adaptiveVariantGates = Object.fromEntries(Object.entries(summary.adaptiveVariants).map(([policy, row]) => [
  policy,
  adaptiveSelectionDevelopmentGate(row, summary.adaptive),
]));
const passingSelectionPolicies = Object.entries(adaptiveVariantGates)
  .filter(([, gate]) => gate.passed)
  .map(([policy]) => policy)
  .sort((left, right) => (
    summary.adaptiveVariants[right].repeatAcceptability.mean
      - summary.adaptiveVariants[left].repeatAcceptability.mean
    || summary.adaptiveVariants[left].meanRegret.mean
      - summary.adaptiveVariants[right].meanRegret.mean
    || summary.adaptiveVariants[right].withinOnePoint.mean
      - summary.adaptiveVariants[left].withinOnePoint.mean
    || left.localeCompare(right)
  ));
const selectionDecision = {
  selectedPolicy: passingSelectionPolicies[0] ?? null,
  passingPolicies: passingSelectionPolicies,
};
console.log('\nGATE');
budgets.forEach((budget) => console.log(`Fixed ${budget}: ${fixedGates[budget].passed ? 'PASS' : 'FAIL'}`));
if (!fixedOnly) {
  console.log(`Adaptive: ${adaptiveGate.passed ? 'PASS' : 'FAIL'}`);
  console.log(`Adaptive samples: mean ${summary.adaptive.samplesUsed.mean.mean.toFixed(0)}, p50 ${summary.adaptive.samplesUsed.p50}, p95 ${summary.adaptive.samplesUsed.p95}, maximum ${summary.adaptive.samplesUsed.maximum}.`);
  console.log(`Adaptive stopped uncertain in ${(summary.adaptive.uncertainRate.mean * 100).toFixed(1)}% of trials.`);
}
Object.entries(adaptiveVariantGates).forEach(([policy, gate]) => {
  console.log(`Selection ${selectionLabel(policy)}: ${gate.passed ? 'PASS' : 'FAIL'}`);
});
if (adaptiveSelectionPolicies.length) {
  console.log(`V5 development winner: ${selectionDecision.selectedPolicy ? selectionLabel(selectionDecision.selectedPolicy) : 'none'}.`);
}

const output = {
  generatedAt: new Date().toISOString(),
  config,
  corpus: results.map(({ id, phase, branching, handSizes, eventCount, playedKey, exactOracleKeys }) => ({ id, phase, branching, handSizes, eventCount, playedKey, exactOracleKeys })),
  summary,
  gates: { fixed: fixedGates, adaptive: adaptiveGate, adaptiveVariants: adaptiveVariantGates },
  selectionDecision,
  positions: results,
};
if (jsonPath) {
  const destination = resolve(process.cwd(), jsonPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Saved machine-readable results to ${destination}`);
}
if (reportPath) {
  const destination = resolve(process.cwd(), reportPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, renderReport({
    config,
    summary,
    budgets,
    adaptiveGate,
    adaptiveVariantGates,
    selectionDecision,
  }));
  console.log(`Saved Markdown report to ${destination}`);
}

console.log('\nNOTES');
console.log('- Each phase contributes the same number of positions. Confidence intervals resample complete positions, not individual repeated runs.');
console.log('- Each fixed run, adaptive batch, and reference uses independently seeded plausible hidden deals consistent with public evidence. Every legal move within one batch receives the same paired deals.');
console.log('- Adaptive stages accumulate prior paired outcomes, widen intervals for between-batch disagreement, and require a fresh independent confirmation batch before stopping early.');
if (adaptiveRefinementSamples > 0) {
  console.log(`- Unresolved close decisions receive one ${adaptiveRefinementSamples}-sample paired batch restricted to their plausible-best candidates.`);
  console.log('- The reference, fixed budgets, and ordinary adaptive stages run once. The pre-refinement V3 control is snapshotted before the V4 batch.');
}
if (adaptiveSelectionPolicies.length) {
  console.log(`- ${adaptiveSelectionPolicies.length} robust selectors reuse the same adaptive batches and add no simulation samples.`);
  console.log('- Coaching labels remain frozen to the shared adaptive evidence, so this experiment changes move selection only.');
}
console.log('- Phase and legal-move count set minimum budgets. Statistically equivalent leaders are reported as one plausible-best set.');
console.log('- Recommendation confidence is independent from mistake-label confidence; unclear mistake labels abstain.');
console.log('- Regret is the reference win-rate gap between its leading move and the tested analyzer selected move.');
console.log('- The reference is a larger independent estimate, not perfect ground truth.');

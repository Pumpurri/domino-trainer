import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  ADAPTIVE_ANALYSIS_VERSION,
  DEFAULT_ADAPTIVE_STAGES,
} from '../app/adaptive-analysis.ts';
import {
  RELIABILITY_BRANCHING_BANDS,
  RELIABILITY_PHASES,
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

function numberList(value, fallback, label) {
  const entries = (value ?? fallback).split(',').map((entry) => Number(entry.trim()));
  if (!entries.length || entries.some((entry) => !Number.isInteger(entry) || entry <= 0)) {
    throw new Error(`${label} must be a comma-separated list of positive integers.`);
  }
  return [...new Set(entries)].sort((left, right) => left - right);
}

function percent(metric) {
  return `${(metric.mean * 100).toFixed(1)}% [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

function points(metric) {
  return `${metric.mean.toFixed(2)} [${metric.low.toFixed(2)}, ${metric.high.toFixed(2)}]`;
}

function metricRow(label, row) {
  return `${label} | ${percent(row.topAgreement)} | ${percent(row.withinOnePoint)} | ${points(row.meanRegret)} | ${percent(row.mistakeLabelAgreement)} | ${percent(row.falsePositiveMistakes)} | ${percent(row.falseNegativeMistakes)} | ${percent(row.intervalCoverage)} | ${percent(row.repeatAcceptability)} | ${Math.round(row.runtimeMs.mean)} / ${Math.round(row.runtimeMs.p95)} ms`;
}

function printTable(title, fixed, adaptive, budgets) {
  console.log(`\n${title}`);
  console.log('Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time');
  console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
  budgets.forEach((budget) => console.log(metricRow(`Fixed ${budget}`, fixed[budget])));
  if (adaptive?.trials) console.log(metricRow('Adaptive', adaptive));
}

function markdownTable(fixed, adaptive, budgets) {
  return [
    '| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...budgets.map((budget) => `| ${metricRow(`Fixed ${budget}`, fixed[budget])} |`),
    ...(adaptive?.trials ? [`| ${metricRow('Adaptive', adaptive)} |`] : []),
  ].join('\n');
}

function renderReport({ config, summary, budgets, adaptiveGate }) {
  const stageTotal = Object.values(summary.adaptive.stoppingStages).reduce((sum, count) => sum + count, 0);
  const stageRows = Object.entries(summary.adaptive.stoppingStages).map(([stage, count]) => (
    `| ${stage} | ${count} | ${stageTotal ? (count / stageTotal * 100).toFixed(1) : '0.0'}% |`
  ));
  const gateRows = Object.entries(adaptiveGate.checks).map(([check, passed]) => `| ${check} | ${passed ? 'PASS' : 'FAIL'} |`);
  const phaseSections = RELIABILITY_PHASES.map((phase) => (
    `### ${phase}\n\n${markdownTable(summary.byPhase[phase], summary.adaptiveByPhase[phase], budgets)}`
  ));
  const branchingSections = RELIABILITY_BRANCHING_BANDS
    .filter((band) => summary.branchingCounts[band])
    .map((band) => `### ${band}\n\n${markdownTable(summary.byBranching[band], summary.adaptiveByBranching[band], budgets)}`);
  return `# Mesa Quince adaptive analyzer reliability study

Generated: ${new Date().toISOString()}

## Configuration

- ${summary.positions} positions: ${RELIABILITY_PHASES.map((phase) => `${summary.phaseCounts[phase]} ${phase}`).join(', ')}
- ${config.repetitions} independent repetitions per analyzer
- Fixed budgets: ${budgets.join(', ')}
- Adaptive stages: ${config.adaptiveStages.join(', ')}
- Independent reference: ${config.referenceBudget} samples
- Worker threads: ${config.workers}
- Seed: \`${config.seed}\`
- Adaptive implementation: \`${config.adaptiveVersion}\`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Overall results

${markdownTable(summary.overall, summary.adaptive, budgets)}

## Adaptive computation

- Mean samples: ${points(summary.adaptive.samplesUsed.mean)}
- Median samples: ${summary.adaptive.samplesUsed.p50}
- P95 samples: ${summary.adaptive.samplesUsed.p95}
- Maximum samples: ${summary.adaptive.samplesUsed.maximum}
- Hard-cap rate: ${percent(summary.adaptive.hardCapRate)}
- Uncertain-at-stop rate: ${percent(summary.adaptive.uncertainRate)}
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
  quick ? 2 : 3,
  'Independent repetitions',
);
const budgets = numberList(
  argument('budgets') ?? process.env.MESA_RELIABILITY_BUDGETS,
  '120,500,1000,2000',
  'Budgets',
);
const adaptiveStages = numberList(
  argument('adaptive-stages') ?? process.env.MESA_RELIABILITY_ADAPTIVE_STAGES,
  DEFAULT_ADAPTIVE_STAGES.join(','),
  'Adaptive stages',
);
const referenceBudget = positiveInteger(
  argument('reference-samples') ?? process.env.MESA_RELIABILITY_REFERENCE_SAMPLES,
  quick ? 2000 : 4000,
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
  schema: 2,
  seed,
  positionsPerPhase,
  repetitions,
  budgets,
  referenceBudget,
  confidenceResamples,
  workers,
  includeAdaptive: !fixedOnly,
  adaptiveStages,
  adaptiveVersion: ADAPTIVE_ANALYSIS_VERSION,
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
    options: { budgets, repetitions, referenceBudget, seed, includeAdaptive: !fixedOnly, adaptiveStages },
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
printTable('OVERALL RELIABILITY', summary.overall, summary.adaptive, budgets);
RELIABILITY_PHASES.forEach((phase) => printTable(
  `${phase.toUpperCase()} RELIABILITY`,
  summary.byPhase[phase],
  summary.adaptiveByPhase[phase],
  budgets,
));
RELIABILITY_BRANCHING_BANDS.forEach((band) => {
  if (summary.branchingCounts[band]) printTable(
    `${band.toUpperCase()} (${summary.branchingCounts[band]} POSITIONS)`,
    summary.byBranching[band],
    summary.adaptiveByBranching[band],
    budgets,
  );
});

if (summary.reference.exactPositions) {
  console.log(`\nDEAL-SPECIFIC EXACT ENDGAMES\n${summary.reference.exactPositions} positions were small enough to solve with revealed hands.`);
  console.log(`The information-safe reference selected a deal-specific winning action in ${(summary.reference.exactOracleAgreement * 100).toFixed(1)}% of them.`);
  console.log('This is a diagnostic only. The exact solver sees the realized hidden deal, while the analyzer correctly does not.');
}

const fixedGates = Object.fromEntries(budgets.map((budget) => [budget, reliabilityGate(summary.overall[budget], summary.positions)]));
const adaptiveGate = reliabilityGate(summary.adaptive, summary.positions);
console.log('\nGATE');
budgets.forEach((budget) => console.log(`Fixed ${budget}: ${fixedGates[budget].passed ? 'PASS' : 'FAIL'}`));
if (!fixedOnly) {
  console.log(`Adaptive: ${adaptiveGate.passed ? 'PASS' : 'FAIL'}`);
  console.log(`Adaptive samples: mean ${summary.adaptive.samplesUsed.mean.mean.toFixed(0)}, p50 ${summary.adaptive.samplesUsed.p50}, p95 ${summary.adaptive.samplesUsed.p95}, maximum ${summary.adaptive.samplesUsed.maximum}.`);
  console.log(`Adaptive stopped uncertain in ${(summary.adaptive.uncertainRate.mean * 100).toFixed(1)}% of trials.`);
}

const output = {
  generatedAt: new Date().toISOString(),
  config,
  corpus: results.map(({ id, phase, branching, handSizes, eventCount, playedKey, exactOracleKeys }) => ({ id, phase, branching, handSizes, eventCount, playedKey, exactOracleKeys })),
  summary,
  gates: { fixed: fixedGates, adaptive: adaptiveGate },
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
  await writeFile(destination, renderReport({ config, summary, budgets, adaptiveGate }));
  console.log(`Saved Markdown report to ${destination}`);
}

console.log('\nNOTES');
console.log('- Each phase contributes the same number of positions. Confidence intervals resample complete positions, not individual repeated runs.');
console.log('- Each fixed run, adaptive batch, and reference uses independently seeded plausible hidden deals consistent with public evidence. Every legal move within one batch receives the same paired deals.');
console.log('- Adaptive stages accumulate prior paired outcomes and require the same leader across at least two checks before stopping early.');
console.log('- Regret is the reference win-rate gap between its leading move and the tested analyzer selected move.');
console.log('- The reference is a larger independent estimate, not perfect ground truth.');

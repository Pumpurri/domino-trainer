import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  RELIABILITY_BRANCHING_BANDS,
  RELIABILITY_PHASES,
  collectDecisionCorpus,
  summarizeReliability,
} from './analyzer-reliability-core.mjs';
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

function budgetList(value) {
  const budgets = (value ?? '120,500,1000,2000').split(',').map((entry) => Number(entry.trim()));
  if (!budgets.length || budgets.some((budget) => !Number.isInteger(budget) || budget <= 0)) {
    throw new Error('Budgets must be a comma-separated list of positive integers.');
  }
  return [...new Set(budgets)].sort((left, right) => left - right);
}

function percent(metric) {
  return `${(metric.mean * 100).toFixed(1)}% [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

function points(metric) {
  return `${metric.mean.toFixed(2)} [${metric.low.toFixed(2)}, ${metric.high.toFixed(2)}]`;
}

function printTable(title, summary, budgets) {
  console.log(`\n${title}`);
  console.log('Samples | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | Label flips | Interval coverage | Repeat acceptable | Mean / p95 time');
  console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
  budgets.forEach((budget) => {
    const row = summary[budget];
    console.log(`${budget} | ${percent(row.topAgreement)} | ${percent(row.withinOnePoint)} | ${points(row.meanRegret)} | ${percent(row.mistakeLabelAgreement)} | ${percent(row.falsePositiveMistakes)} | ${percent({ mean: 1 - row.exactLabelAgreement.mean, low: 1 - row.exactLabelAgreement.high, high: 1 - row.exactLabelAgreement.low })} | ${percent(row.intervalCoverage)} | ${percent(row.repeatAcceptability)} | ${Math.round(row.runtimeMs.mean)} / ${Math.round(row.runtimeMs.p95)} ms`);
  });
}

const quick = process.argv.includes('--quick');
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
const budgets = budgetList(argument('budgets') ?? process.env.MESA_RELIABILITY_BUDGETS);
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
const positionCount = positionsPerPhase * RELIABILITY_PHASES.length;
const workers = positiveInteger(
  argument('workers') ?? process.env.MESA_RELIABILITY_WORKERS,
  reliabilityWorkerCount(positionCount),
  'Worker count',
);

console.log('MESA QUINCE ANALYZER RELIABILITY BENCHMARK');
console.log(`Collecting ${positionsPerPhase} realistic positions from each phase.`);
const positions = collectDecisionCorpus({ positionsPerPhase, seed });
console.log(`Comparing ${budgets.join(', ')} samples against an independent ${referenceBudget}-sample reference.`);
console.log(`${repetitions} independent runs per budget, ${workers} worker threads.`);

let completed = 0;
const results = await evaluateReliabilityParallel({
  positions,
  options: { budgets, repetitions, referenceBudget, seed },
  workerCount: workers,
  onProgress: (positionId) => {
    completed += 1;
    console.log(`Progress: ${completed}/${positions.length} positions (${positionId})`);
  },
});
const summary = summarizeReliability(results, { budgets, seed, confidenceResamples });

console.log(`\nCORPUS\n${summary.positions} positions | ${RELIABILITY_PHASES.map((phase) => `${phase} ${summary.phaseCounts[phase]}`).join(' | ')}`);
console.log(`Reference marked ${summary.reference.clearRecommendations}/${summary.positions} recommendations statistically clear.`);
printTable('OVERALL RELIABILITY', summary.overall, budgets);
RELIABILITY_PHASES.forEach((phase) => printTable(`${phase.toUpperCase()} RELIABILITY`, summary.byPhase[phase], budgets));
RELIABILITY_BRANCHING_BANDS.forEach((band) => {
  if (summary.branchingCounts[band]) printTable(`${band.toUpperCase()} (${summary.branchingCounts[band]} POSITIONS)`, summary.byBranching[band], budgets);
});

if (summary.reference.exactPositions) {
  console.log(`\nDEAL-SPECIFIC EXACT ENDGAMES\n${summary.reference.exactPositions} positions were small enough to solve with revealed hands.`);
  console.log(`The information-safe reference selected a deal-specific winning action in ${(summary.reference.exactOracleAgreement * 100).toFixed(1)}% of them.`);
  console.log('This is a diagnostic only. The exact solver sees the realized hidden deal, while the analyzer correctly does not.');
}

const qualified = budgets.filter((budget) => {
  const row = summary.overall[budget];
  return summary.positions >= 16
    && row.withinOnePoint.mean >= 0.9
    && row.meanRegret.mean <= 1
    && row.mistakeLabelAgreement.mean >= 0.95
    && row.falsePositiveMistakes.mean <= 0.02
    && row.repeatAcceptability.mean >= 0.9;
});
console.log('\nGATE');
console.log(qualified.length
  ? `${qualified[0]} samples is the smallest tested budget meeting the provisional near-optimality, regret, mistake-label, false-positive, and repeatability thresholds.`
  : summary.positions < 16
    ? `This ${summary.positions}-position run is a smoke test. Run at least 16 balanced positions before selecting a production threshold.`
    : 'No tested budget met every provisional reliability threshold. Keep fixed budgets and collect a larger corpus before enabling adaptive stopping.');

if (jsonPath) {
  const destination = resolve(process.cwd(), jsonPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    config: { seed, positionsPerPhase, repetitions, budgets, referenceBudget, confidenceResamples, workers },
    corpus: results.map(({ id, phase, branching, handSizes, eventCount, playedKey, exactOracleKeys }) => ({ id, phase, branching, handSizes, eventCount, playedKey, exactOracleKeys })),
    summary,
    positions: results,
  }, null, 2)}\n`);
  console.log(`Saved machine-readable results to ${destination}`);
}

console.log('\nNOTES');
console.log('- Each phase contributes the same number of positions. Confidence intervals resample complete positions, not individual repeated runs.');
console.log('- Each budget and the reference use independently seeded plausible hidden deals consistent with public evidence.');
console.log('- Regret is the reference win-rate gap between its leading move and the tested budget\'s selected move.');
console.log('- A false positive means the tested budget called the played move a confident mistake while the reference did not.');
console.log('- The reference is a larger independent estimate, not perfect ground truth.');

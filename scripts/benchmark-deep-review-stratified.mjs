import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluatePositionsParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';
import {
  DEEP_REVIEW_SAFETY_PHASES,
  DEEP_REVIEW_STRATIFIED_VERSION,
  DEEP_REVIEW_VARIANTS,
  collectDeepReviewStratifiedCorpus,
  summarizeDeepReviewStratified,
} from './deep-review-stratified-core.mjs';

const LABELS = {
  systematic: 'Current systematic Deep Review',
  'public-stratified': 'Middle-only stratified Deep Review',
};

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

function percent(metric) {
  return `${(metric.mean * 100).toFixed(1)}% [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

function points(metric) {
  return `${metric.mean.toFixed(3)} [${metric.low.toFixed(3)}, ${metric.high.toFixed(3)}]`;
}

function variantTable(summary) {
  return [
    '| Variant | Within 1 point under both | Robust regret | Worst regret | Repeat acceptable | Repeat top | Label agreement | False positives | Effective samples | Mean ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...DEEP_REVIEW_VARIANTS.map((variant) => {
      const row = summary.variants[variant];
      return `| ${LABELS[variant]} | ${percent(row.withinBothReferences)} | ${points(row.robustRegret)} | ${points(row.worstRegret)} | ${percent(row.repeatAcceptability)} | ${percent(row.repeatTopStability)} | ${percent(row.mistakeLabelAgreement)} | ${percent(row.falsePositiveMistake)} | ${row.effectiveSamples.mean.toFixed(1)} | ${row.elapsedMs.mean.toFixed(0)} |`;
    }),
  ].join('\n');
}

function effectTable(effect) {
  return [
    '| Within both | Robust regret | Worst regret | Repeat acceptable | Label agreement | False positives | Effective samples | Runtime ratio |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| ${percent(effect.withinBothReferences)} | ${points(effect.robustRegret)} | ${points(effect.worstRegret)} | ${percent(effect.repeatAcceptability)} | ${percent(effect.mistakeLabelAgreement)} | ${percent(effect.falsePositiveMistake)} | ${points(effect.effectiveSamples)} | ${percent(effect.runtimeRatio)} |`,
  ].join('\n');
}

function checksTable(gate) {
  return [
    '| Check | Result |',
    '| --- | --- |',
    ...Object.entries(gate.checks).map(([name, passed]) => `| ${name} | ${passed ? 'PASS' : 'FAIL'} |`),
  ].join('\n');
}

function renderReport(config, summary) {
  return `# Mesa Quince Deep Review-only middle stratification holdout

Generated: ${new Date().toISOString()}

## Locked protocol

- Version: ${config.version}
- Seed: ${config.seed}
- Fresh difficult middle positions: ${config.middlePositions}
- Minimum middle branching: ${config.middleMinimumBranching}
- Non-middle safety positions: ${config.safetyPositionsPerPhase} per phase
- Middle repetitions: ${config.repetitions}
- Fixed Deep Review budget: ${config.budget}
- Independent references: ${config.referenceBudget} systematic plus ${config.referenceBudget} stratified samples
- Workers: ${config.workers}

Every paired middle trial gives both samplers the same independently generated belief pool, and evaluation order alternates. Recommendations are scored under two separately seeded high-budget references so neither representative policy supplies the sole target. Opening, late, and likely-block safety positions route the candidate to the current systematic sampler and must reuse the exact control analysis. Real opponent hands and sleeping tiles are removed before belief generation.

The candidate must pass every locked check: at least 5% selection changes, improved repeat acceptability, lower average two-reference regret, a robust-regret upper interval no worse than 0.10 point, worst-reference regret no more than 0.05 point worse, within-one-point-under-both no more than one percentage point worse, no increase in false accusations, label agreement no more than one point worse, at least 95% weighted effective samples, no more than 20% mean paired runtime overhead, exact 500-sample budgets, and zero non-middle routing differences.

Overall result: **${summary.gate.passed ? 'PASS' : 'FAIL'}**

Reference top-move agreement: **${percent(summary.referenceTopAgreement)}**

Selection change rate: **${percent(summary.selectionChangeRate)}**

## Middle-game results

${variantTable(summary)}

## Candidate minus control effects

Positive deltas favor the candidate for within-both quality, repeat acceptability, and label agreement. Negative deltas favor the candidate for regret, false positives, and runtime.

${effectTable(summary.effect)}

## Locked gate

${checksTable(summary.gate)}

## Non-middle safety

- Opening positions: ${summary.safetyByPhase.opening}
- Late positions: ${summary.safetyByPhase.late}
- Likely-block positions: ${summary.safetyByPhase.block}
- Exact routing mismatches: ${summary.gate.safetyMismatches}
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const middlePositions = positiveInteger(argument('middle-positions'), quick ? 1 : 100, 'Middle positions');
const safetyPositionsPerPhase = positiveInteger(argument('safety-positions-per-phase'), quick ? 1 : 20, 'Safety positions per phase');
const middleMinimumBranching = positiveInteger(argument('middle-minimum-branching'), quick ? 2 : 4, 'Middle minimum branching');
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 5, 'Repetitions');
const budget = positiveInteger(argument('samples'), quick ? 8 : 500, 'Samples');
const referenceBudget = positiveInteger(argument('reference-samples'), quick ? 12 : 5000, 'Reference samples');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), quick ? 40 : 2000, 'Confidence resamples');
const seed = argument('seed') ?? 'mesa-quince-deep-review-stratified-v1';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const positionCount = middlePositions + safetyPositionsPerPhase * DEEP_REVIEW_SAFETY_PHASES.length;
const workers = positiveInteger(argument('workers'), reliabilityWorkerCount(positionCount), 'Workers');
const config = {
  schema: 1,
  version: DEEP_REVIEW_STRATIFIED_VERSION,
  seed,
  middlePositions,
  safetyPositionsPerPhase,
  middleMinimumBranching,
  repetitions,
  budget,
  referenceBudget,
  confidenceResamples,
  workers,
};

console.log('MESA QUINCE DEEP REVIEW-ONLY MIDDLE STRATIFICATION');
console.log(`Collecting ${middlePositions} difficult middle positions and ${safetyPositionsPerPhase} safety positions per other phase.`);
console.log(`${repetitions} repetitions at ${budget} samples, two ${referenceBudget}-sample references, ${workers} workers.`);
const corpus = collectDeepReviewStratifiedCorpus({
  middlePositions,
  safetyPositionsPerPhase,
  middleMinimumBranching,
  seed,
});

let checkpoint = null;
let priorResults = [];
if (checkpointPath) {
  checkpoint = await prepareReliabilityCheckpoint({ directory: checkpointPath, config, resume });
  const expectedIds = new Set(corpus.map(({ id }) => id));
  const unexpected = checkpoint.results.filter(({ id }) => !expectedIds.has(id));
  if (unexpected.length) throw new Error(`Checkpoint contains unexpected positions: ${unexpected.map(({ id }) => id).join(', ')}.`);
  priorResults = checkpoint.results;
  console.log(`Checkpoint: ${checkpoint.root} (${priorResults.length}/${corpus.length} complete).`);
} else if (resume) {
  throw new Error('--resume requires --checkpoint=PATH.');
}

const completedIds = new Set(priorResults.map(({ id }) => id));
const pending = corpus.filter(({ id }) => !completedIds.has(id));
let completed = priorResults.length;
const fresh = pending.length ? await evaluatePositionsParallel({
  positions: pending,
  options: { budget, repetitions, referenceBudget, seed },
  workerCount: workers,
  workerUrl: new URL('./deep-review-stratified-worker.mjs', import.meta.url),
  onProgress: (positionId) => {
    completed += 1;
    console.log(`Progress: ${completed}/${corpus.length} positions (${positionId})`);
  },
  onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
}) : [];
const results = [...priorResults, ...fresh].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeDeepReviewStratified(results, { budget, seed, confidenceResamples });

console.log(`Reference agreement: ${percent(summary.referenceTopAgreement)}`);
console.log(`Selection changes: ${percent(summary.selectionChangeRate)}`);
console.log(`Repeat delta: ${percent(summary.effect.repeatAcceptability)}`);
console.log(`Robust-regret delta: ${points(summary.effect.robustRegret)}`);
console.log(`Runtime ratio: ${percent(summary.effect.runtimeRatio)}`);
console.log(`Non-middle mismatches: ${summary.gate.safetyMismatches}`);
console.log(`Locked gate: ${summary.gate.passed ? 'PASS' : 'FAIL'}`);

const output = {
  generatedAt: new Date().toISOString(),
  config,
  summary,
  corpus: results.map(({ id, phase, branching, handSizes, eventCount, playedKey }) => ({
    id, phase, branching, handSizes, eventCount, playedKey,
  })),
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
  await writeFile(destination, renderReport(config, summary));
  console.log(`Saved Markdown report to ${destination}`);
}

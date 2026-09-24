import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluatePositionsParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';
import {
  FIXED_STRATIFIED_VARIANTS,
  FIXED_STRATIFIED_VERSION,
  collectFixedStratifiedCorpus,
  summarizeFixedStratified,
} from './fixed-stratified-core.mjs';

const LABELS = {
  systematic: 'Current systematic sampler',
  'public-stratified': 'Public-information stratified sampler',
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

function numberList(value, fallback, label) {
  const entries = (value ?? fallback).split(',').map((entry) => Number(entry.trim()));
  if (!entries.length || entries.some((entry) => !Number.isInteger(entry) || entry <= 0)) {
    throw new Error(`${label} must contain positive integers.`);
  }
  const unique = [...new Set(entries)].sort((left, right) => left - right);
  if (unique.length !== entries.length) throw new Error(`${label} cannot contain duplicates.`);
  return unique;
}

function percent(metric) {
  return `${(metric.mean * 100).toFixed(1)}% [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

function points(metric) {
  return `${metric.mean.toFixed(3)} [${metric.low.toFixed(3)}, ${metric.high.toFixed(3)}]`;
}

function milliseconds(metric) {
  return `${metric.mean.toFixed(0)} [${metric.low.toFixed(0)}, ${metric.high.toFixed(0)}]`;
}

function variantTable(summary) {
  return [
    '| Variant | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Effective samples | Mean ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...FIXED_STRATIFIED_VARIANTS.map((variant) => {
      const row = summary.variants[variant];
      return `| ${LABELS[variant]} | ${percent(row.withinOnePoint)} | ${points(row.meanRegret)} | ${percent(row.repeatAcceptability)} | ${percent(row.repeatTopStability)} | ${percent(row.mistakeLabelAgreement)} | ${percent(row.falsePositiveMistake)} | ${row.effectiveSamples.mean.toFixed(1)} | ${row.elapsedMs.mean.toFixed(0)} |`;
    }),
  ].join('\n');
}

function effectTable(effect) {
  return [
    '| Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Effective samples | Runtime ratio | Mean ms delta |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| ${percent(effect.withinOnePoint)} | ${points(effect.meanRegret)} | ${percent(effect.repeatAcceptability)} | ${percent(effect.mistakeLabelAgreement)} | ${percent(effect.falsePositiveMistake)} | ${points(effect.effectiveSamples)} | ${percent(effect.runtimeRatio)} | ${milliseconds(effect.elapsedMs)} |`,
  ].join('\n');
}

function checksTable(checks) {
  return [
    '| Check | Result |',
    '| --- | --- |',
    ...Object.entries(checks).map(([name, passed]) => `| ${name} | ${passed ? 'PASS' : 'FAIL'} |`),
  ].join('\n');
}

function renderReport(config, summary) {
  const budgetSections = config.budgets.map((budget) => {
    const result = summary.budgets[budget];
    return `## ${budget}-sample budget

Selection change rate: **${percent(result.selectionChangeRate)}**

${variantTable(result)}

### Candidate minus control effects

Positive deltas favor the candidate for within-one-point quality, repeat acceptability, label agreement, and effective samples. Negative deltas favor the candidate for regret, false positives, and runtime.

${effectTable(result.effect)}

### Locked gate: ${result.gate.passed ? 'PASS' : 'FAIL'}

${checksTable(result.gate.checks)}`;
  }).join('\n\n');
  return `# Mesa Quince fixed-budget middle-game stratification study

Generated: ${new Date().toISOString()}

## Locked protocol

- Version: ${config.version}
- Seed: ${config.seed}
- Fresh difficult middle-game positions: ${config.positions}
- Minimum legal moves: ${config.minimumBranching}
- Independent repetitions per budget: ${config.repetitions}
- Fixed budgets: ${config.budgets.join(', ')}
- Independent reference: ${config.referenceBudget} samples
- Workers: ${config.workers}

At each repetition and budget, both samplers receive the same independently generated belief pool. Evaluation order alternates by position, repetition, and budget. Every result must contain exactly the requested number of root samples. Real opponent hands and sleeping tiles are removed before belief generation.

Each budget must independently pass every locked check: at least 5% of recommendations change, repeat acceptability improves, mean regret declines, within-one-point quality falls by no more than one percentage point, false-positive mistake calls do not increase, label agreement falls by no more than one point, weighted effective samples remain at least 95% of nominal, mean paired runtime rises by no more than 20%, and every trial uses the exact fixed budget.

Passing both budgets selects middle-only stratification for a fresh balanced 200-position validation. It does not change the live coach directly.

Overall result: **${summary.gate.passed ? 'PASS' : 'FAIL'}**

${budgetSections}
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const positions = positiveInteger(argument('positions'), quick ? 1 : 60, 'Positions');
const minimumBranching = positiveInteger(argument('minimum-branching'), quick ? 2 : 4, 'Minimum branching');
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 5, 'Repetitions');
const budgets = numberList(argument('budgets'), quick ? '4,8' : '120,500', 'Budgets');
const referenceBudget = positiveInteger(argument('reference-samples'), quick ? 12 : 5000, 'Reference samples');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), quick ? 40 : 1000, 'Confidence resamples');
const seed = argument('seed') ?? 'mesa-quince-fixed-stratified-middle-v1';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const workers = positiveInteger(argument('workers'), reliabilityWorkerCount(positions), 'Workers');
const config = {
  schema: 1,
  version: FIXED_STRATIFIED_VERSION,
  seed,
  positions,
  minimumBranching,
  repetitions,
  budgets,
  referenceBudget,
  confidenceResamples,
  workers,
};

console.log('MESA QUINCE FIXED-BUDGET MIDDLE-GAME STRATIFICATION');
console.log(`Collecting ${positions} fresh middle positions with at least ${minimumBranching} legal moves.`);
console.log(`${repetitions} repetitions at ${budgets.join(' and ')} samples, ${workers} workers, ${referenceBudget}-sample reference.`);
const corpus = collectFixedStratifiedCorpus({ positions, minimumBranching, seed });

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
  options: { budgets, repetitions, referenceBudget, seed },
  workerCount: workers,
  workerUrl: new URL('./fixed-stratified-worker.mjs', import.meta.url),
  onProgress: (positionId) => {
    completed += 1;
    console.log(`Progress: ${completed}/${corpus.length} positions (${positionId})`);
  },
  onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
}) : [];
const results = [...priorResults, ...fresh].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeFixedStratified(results, { budgets, seed, confidenceResamples });

for (const budget of budgets) {
  const result = summary.budgets[budget];
  console.log(`${budget} samples: changes ${percent(result.selectionChangeRate)}, repeat delta ${percent(result.effect.repeatAcceptability)}, regret delta ${points(result.effect.meanRegret)}, runtime ${percent(result.effect.runtimeRatio)}, gate ${result.gate.passed ? 'PASS' : 'FAIL'}`);
}
console.log(`Overall locked gate: ${summary.gate.passed ? 'PASS' : 'FAIL'}`);

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

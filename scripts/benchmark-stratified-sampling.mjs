import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DEFAULT_ADAPTIVE_STAGES } from '../app/adaptive-analysis.ts';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluatePositionsParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';
import {
  STRATIFIED_GROUPS,
  STRATIFIED_SAMPLING_VERSION,
  STRATIFIED_VARIANTS,
  collectStratifiedSamplingCorpus,
  summarizeStratifiedSampling,
} from './stratified-sampling-core.mjs';

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
  if (entries.length < 2 || entries.some((entry) => !Number.isInteger(entry) || entry <= 0)) {
    throw new Error(`${label} must contain at least two positive integers.`);
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

function variantRow(variant, metric) {
  return `| ${LABELS[variant]} | ${percent(metric.withinOnePoint)} | ${points(metric.meanRegret)} | ${percent(metric.repeatAcceptability)} | ${percent(metric.mistakeLabelAgreement)} | ${percent(metric.falsePositiveMistake)} | ${metric.samplesUsed.mean.toFixed(1)} |`;
}

function variantTable(group) {
  return [
    '| Variant | Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Mean samples |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...STRATIFIED_VARIANTS.map((variant) => variantRow(variant, group.variants[variant])),
  ].join('\n');
}

function effectTable(summary) {
  return [
    '| Scope | Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Samples |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ['Overall', summary.effect],
    ...STRATIFIED_GROUPS.map((group) => [group, summary.byGroup[group].effect]),
  ].map((row, index) => {
    if (index < 2) return row;
    const [label, effect] = row;
    return `| ${label} | ${percent(effect.withinOnePoint)} | ${points(effect.meanRegret)} | ${percent(effect.repeatAcceptability)} | ${percent(effect.mistakeLabelAgreement)} | ${percent(effect.falsePositiveMistake)} | ${points(effect.samplesUsed)} |`;
  }).join('\n');
}

function checkRows(checks) {
  return Object.entries(checks).map(([name, passed]) => `| ${name} | ${passed ? 'PASS' : 'FAIL'} |`).join('\n');
}

function forensicRows(positions) {
  return positions
    .map((position) => {
      const leader = position.forensic.strata[0];
      return `| ${position.id} | ${position.reference.topKey} vs ${position.reference.runnerUpKey} | ${position.forensic.poolStrata} | ${(position.forensic.systematicMassCoverage * 100).toFixed(1)}% | ${(position.forensic.stratifiedMassCoverage * 100).toFixed(1)}% | ${leader?.signature ?? 'none'} | ${leader ? leader.contribution.toFixed(2) : '0.00'} |`;
    })
    .join('\n');
}

function renderReport(config, summary, positions) {
  const groupSections = STRATIFIED_GROUPS.map((group) => (
    `## ${group}\n\n${variantTable(summary.byGroup[group])}`
  )).join('\n\n');
  return `# Mesa Quince public-information stratified sampling study

Generated: ${new Date().toISOString()}

## Locked protocol

- Version: ${config.version}
- Seed: ${config.seed}
- Corpus: ${config.positionsPerGroup} difficult positions per group
- Groups: opening with at least ${config.openingMinimumBranching} legal moves; middle with at least ${config.middleMinimumBranching}
- Repetitions: ${config.repetitions}
- Adaptive stages: ${config.stages.join(', ')}
- Independent reference: ${config.referenceBudget} samples
- Root-value forensic audit: ${config.forensicBudget} samples
- Workers: ${config.workers}

Both analyzers receive the same independently generated belief pool at every stage. The candidate partitions plausible hidden deals using only sampled hands and public state: each opponent's ability to play left, right, both, or neither; immediate one-tile exit threats; and ownership of open-end doubles among the sampled players or sleepers. Every retained stratum keeps its posterior mass through analysis weights. No real opponent hand or sleeping tile is supplied to either analyzer.

Promotion requires all locked checks to pass: the candidate must change at least 5% of decisions, improve repeat acceptability, lower mean regret, avoid increasing false accusations, preserve label agreement within one point, use no more samples, and avoid a material opening or middle regression. This is a targeted development study, not a release study. A passing candidate still requires a fresh 200-position validation.

## Overall results

${variantTable(summary.overall)}

Selection change rate: **${percent(summary.selectionChangeRate)}**

## Paired candidate minus control effects

Positive deltas favor the candidate for within-one-point quality, repeat acceptability, and label agreement. Negative deltas favor the candidate for regret, false positives, and samples.

${effectTable(summary)}

## Locked gate

Overall result: **${summary.gate.passed ? 'PASS' : 'FAIL'}**

| Check | Result |
| --- | --- |
${checkRows(summary.gate.checks)}

## Forensic coverage

- Mean plausible strata in the belief pool: ${summary.forensic.meanPoolStrata.toFixed(1)}
- Mean posterior mass represented by current sampling: ${(summary.forensic.meanSystematicMassCoverage * 100).toFixed(1)}%
- Mean posterior mass represented by stratified sampling: ${(summary.forensic.meanStratifiedMassCoverage * 100).toFixed(1)}%
- Mean weighted effective samples in the ${config.forensicBudget}-sample audit: ${summary.forensic.meanEffectiveSamples.toFixed(1)}

The final columns below identify the sampled public-information stratum contributing the largest absolute share of the reference leader's estimated advantage over its runner-up. A signature records each opponent's left/right playability mask and exit threat, followed by sampled ownership of the open-end doubles.

| Position | Reference comparison | Pool strata | Current mass coverage | Stratified mass coverage | Largest contributor | Contribution points |
| --- | --- | ---: | ---: | ---: | --- | ---: |
${forensicRows(positions)}

${groupSections}
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const positionsPerGroup = positiveInteger(argument('positions-per-group'), quick ? 1 : 24, 'Positions per group');
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 3, 'Repetitions');
const stages = numberList(argument('stages'), quick ? '4,8' : DEFAULT_ADAPTIVE_STAGES.join(','), 'Stages');
const referenceBudget = positiveInteger(argument('reference-samples'), quick ? 12 : 5000, 'Reference samples');
const forensicBudget = positiveInteger(argument('forensic-samples'), quick ? 8 : 500, 'Forensic samples');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), quick ? 40 : 1000, 'Confidence resamples');
const openingMinimumBranching = positiveInteger(argument('opening-minimum-branching'), quick ? 2 : 6, 'Opening minimum branching');
const middleMinimumBranching = positiveInteger(argument('middle-minimum-branching'), quick ? 2 : 4, 'Middle minimum branching');
const seed = argument('seed') ?? 'mesa-quince-stratified-sampling-v1';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const positionCount = positionsPerGroup * STRATIFIED_GROUPS.length;
const workers = positiveInteger(argument('workers'), reliabilityWorkerCount(positionCount), 'Workers');
const config = {
  schema: 1,
  version: STRATIFIED_SAMPLING_VERSION,
  seed,
  positionsPerGroup,
  repetitions,
  stages,
  referenceBudget,
  forensicBudget,
  confidenceResamples,
  openingMinimumBranching,
  middleMinimumBranching,
  workers,
};

console.log('MESA QUINCE PUBLIC-INFORMATION STRATIFIED SAMPLING');
console.log(`Collecting ${positionsPerGroup} difficult positions in each group.`);
const positions = collectStratifiedSamplingCorpus({
  positionsPerGroup,
  openingMinimumBranching,
  middleMinimumBranching,
  seed,
});
console.log(`${repetitions} repetitions, ${workers} workers, ${referenceBudget}-sample independent reference.`);

let checkpoint = null;
let priorResults = [];
if (checkpointPath) {
  checkpoint = await prepareReliabilityCheckpoint({ directory: checkpointPath, config, resume });
  const expectedIds = new Set(positions.map(({ id }) => id));
  const unexpected = checkpoint.results.filter(({ id }) => !expectedIds.has(id));
  if (unexpected.length) throw new Error(`Checkpoint contains unexpected positions: ${unexpected.map(({ id }) => id).join(', ')}.`);
  priorResults = checkpoint.results;
  console.log(`Checkpoint: ${checkpoint.root} (${priorResults.length}/${positions.length} complete).`);
} else if (resume) {
  throw new Error('--resume requires --checkpoint=PATH.');
}

const completedIds = new Set(priorResults.map(({ id }) => id));
const pending = positions.filter(({ id }) => !completedIds.has(id));
let completed = priorResults.length;
const fresh = pending.length ? await evaluatePositionsParallel({
  positions: pending,
  options: {
    repetitions,
    stages,
    referenceBudget,
    forensicBudget,
    seed,
  },
  workerCount: workers,
  workerUrl: new URL('./stratified-sampling-worker.mjs', import.meta.url),
  onProgress: (positionId) => {
    completed += 1;
    console.log(`Progress: ${completed}/${positions.length} positions (${positionId})`);
  },
  onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
}) : [];
const results = [...priorResults, ...fresh].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeStratifiedSampling(results, { seed, confidenceResamples });

console.log(`Selection changes: ${percent(summary.selectionChangeRate)}`);
console.log(`Repeat-acceptability delta: ${percent(summary.effect.repeatAcceptability)}`);
console.log(`Mean-regret delta: ${points(summary.effect.meanRegret)}`);
console.log(`Sample delta: ${points(summary.effect.samplesUsed)}`);
console.log(`Locked gate: ${summary.gate.passed ? 'PASS' : 'FAIL'}`);

const output = {
  generatedAt: new Date().toISOString(),
  config,
  summary,
  corpus: results.map(({ id, group, phase, branching, handSizes, eventCount, playedKey }) => ({
    id, group, phase, branching, handSizes, eventCount, playedKey,
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
  await writeFile(destination, renderReport(config, summary, results));
  console.log(`Saved Markdown report to ${destination}`);
}

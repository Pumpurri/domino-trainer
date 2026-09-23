import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DEFAULT_ADAPTIVE_STAGES } from '../app/adaptive-analysis.ts';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluatePositionsParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';
import {
  SAMPLER_ABLATION_GROUPS,
  SAMPLER_ABLATION_VARIANTS,
  SAMPLER_ABLATION_VERSION,
  collectSamplerAblationCorpus,
  summarizeSamplerAblation,
} from './sampler-ablation-core.mjs';

const VARIANT_LABELS = {
  oneShot: 'Shared one-shot',
  sharedStaged: 'Shared staged merge',
  sharedAdaptiveEarly: 'Shared adaptive early',
  sharedAdaptiveForced: 'Shared adaptive forced',
  independentStaged: 'Independent staged merge',
  independentAdaptiveEarly: 'Current independent adaptive',
  independentAdaptiveForced: 'Independent adaptive forced',
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

function nonnegativeNumber(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be nonnegative.`);
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

function variantRow(variant, row) {
  return `${VARIANT_LABELS[variant]} | ${percent(row.exactTopAgreement)} | ${percent(row.acceptableTopAgreement)} | ${percent(row.withinOnePoint)} | ${points(row.meanRegret)} | ${percent(row.repeatAcceptability)} | ${percent(row.repeatTopStability)} | ${row.samplesUsed.mean.toFixed(0)} / ${row.samplesUsed.p95.toFixed(0)}`;
}

function markdownTable(group) {
  return [
    '| Variant | Exact top | Acceptable top | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Mean / p95 samples |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...SAMPLER_ABLATION_VARIANTS.map((variant) => `| ${variantRow(variant, group.variants[variant])} |`),
  ].join('\n');
}

function printTable(title, group) {
  console.log(`\n${title}`);
  console.log('Variant | Exact top | Acceptable top | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Mean / p95 samples');
  console.log('--- | --- | --- | --- | --- | --- | --- | ---');
  SAMPLER_ABLATION_VARIANTS.forEach((variant) => console.log(variantRow(variant, group.variants[variant])));
}

function effectRow(label, effect) {
  return `| ${label} | ${percent(effect.withinOnePoint)} | ${points(effect.meanRegret)} | ${percent(effect.repeatAcceptability)} | ${points(effect.samplesUsed)} |`;
}

function comparisonRow(label, comparison) {
  return `| ${label} | ${comparison.topMismatches} | ${comparison.rankingMismatches} | ${comparison.outcomeMismatches} | ${comparison.weightMismatches} | ${comparison.sampleMismatches} | ${comparison.maximumWinRateDifference.toExponential(2)} |`;
}

function renderReport(config, summary) {
  const groupSections = SAMPLER_ABLATION_GROUPS.map((group) => (
    `## ${group}\n\n${markdownTable(summary.byGroup[group])}`
  )).join('\n\n');
  return `# Mesa Quince paired sampler-ablation study

Generated: ${new Date().toISOString()}

## Locked configuration

- Version: ${SAMPLER_ABLATION_VERSION}
- Seed: ${config.seed}
- Positions: ${config.positionsPerGroup} per targeted group
- Repetitions: ${config.repetitions}
- Stages: ${config.stages.join(', ')}
- Reference: ${config.referenceBudget} independent samples
- Opening minimum legal moves: ${config.openingMinimumBranching}
- Middle minimum legal moves: ${config.middleMinimumBranching}
- Workers: ${config.workers}

The shared one-shot and shared staged variants consume the same representative particle pool in the same order. The independent variants preserve the current behavior of rebuilding a belief sample for every stage. No opponent's real hidden hand is supplied to any analyzer.

## Overall results

${markdownTable(summary.overall)}

## Exact evidence-equivalence checks

| Comparison | Top mismatches | Ranking mismatches | Outcome mismatches | Weight mismatches | Sample mismatches | Maximum win-rate difference |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${comparisonRow('One-shot vs shared staged', summary.comparisons.aggregation)}
${comparisonRow('Shared staged vs forced replay', summary.comparisons.sharedReplay)}
${comparisonRow('Independent staged vs forced replay', summary.comparisons.independentReplay)}

## Paired effects

Positive within-one-point and repeat deltas favor the candidate. Negative regret and sample deltas favor the candidate.

| Candidate vs baseline | Within 1 point delta | Mean-regret delta | Repeat-acceptable delta | Sample delta |
| --- | ---: | ---: | ---: | ---: |
${effectRow('Shared early vs shared forced', summary.effects.sharedEarlyStopping)}
${effectRow('Independent early vs independent forced', summary.effects.independentEarlyStopping)}
${effectRow('Independent forced vs shared forced', summary.effects.independentStageSampling)}

## Diagnosis

- Aggregation defect: **${summary.diagnosis.aggregationDefect ? 'YES' : 'NO'}**
- Shared-pool early-stopping harm: **${summary.diagnosis.sharedEarlyStoppingHarm ? 'YES' : 'NO'}**
- Current independent early-stopping harm: **${summary.diagnosis.independentEarlyStoppingHarm ? 'YES' : 'NO'}**
- Independent stage-sampling harm: **${summary.diagnosis.independentStageSamplingHarm ? 'YES' : 'NO'}**

${groupSections}
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const positionsPerGroup = positiveInteger(
  argument('positions-per-group'),
  quick ? 1 : 24,
  'Positions per group',
);
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 3, 'Repetitions');
const stages = numberList(
  argument('stages'),
  quick ? '4,8' : DEFAULT_ADAPTIVE_STAGES.join(','),
  'Stages',
);
const referenceBudget = positiveInteger(
  argument('reference-samples'),
  quick ? 12 : 5000,
  'Reference samples',
);
const confidenceResamples = positiveInteger(
  argument('confidence-resamples'),
  quick ? 40 : 1000,
  'Confidence resamples',
);
const openingMinimumBranching = positiveInteger(
  argument('opening-minimum-branching'),
  quick ? 2 : 6,
  'Opening minimum branching',
);
const middleMinimumBranching = positiveInteger(
  argument('middle-minimum-branching'),
  quick ? 2 : 4,
  'Middle minimum branching',
);
const recommendationPracticalGap = nonnegativeNumber(
  argument('recommendation-gap'),
  1,
  'Recommendation gap',
);
const seed = argument('seed') ?? 'mesa-quince-sampler-ablation-v1';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const positionCount = positionsPerGroup * SAMPLER_ABLATION_GROUPS.length;
const workers = positiveInteger(
  argument('workers'),
  reliabilityWorkerCount(positionCount),
  'Workers',
);
const config = {
  schema: 1,
  version: SAMPLER_ABLATION_VERSION,
  seed,
  positionsPerGroup,
  repetitions,
  stages,
  referenceBudget,
  confidenceResamples,
  openingMinimumBranching,
  middleMinimumBranching,
  recommendationPracticalGap,
  workers,
};

console.log('MESA QUINCE PAIRED SAMPLER ABLATION');
console.log(`Collecting ${positionsPerGroup} positions in each targeted group.`);
const positions = collectSamplerAblationCorpus({
  positionsPerGroup,
  openingMinimumBranching,
  middleMinimumBranching,
  seed,
});
console.log(`Comparing one-shot, shared staged, and current independent-stage sampling at ${stages.at(-1)} samples.`);
console.log(`${repetitions} repetitions, ${workers} worker threads, independent ${referenceBudget}-sample reference.`);

let checkpoint = null;
let priorResults = [];
if (checkpointPath) {
  checkpoint = await prepareReliabilityCheckpoint({ directory: checkpointPath, config, resume });
  const expectedIds = new Set(positions.map(({ id }) => id));
  const unexpected = checkpoint.results.filter(({ id }) => !expectedIds.has(id));
  if (unexpected.length) {
    throw new Error(`Checkpoint contains positions outside this corpus: ${unexpected.map(({ id }) => id).join(', ')}.`);
  }
  priorResults = checkpoint.results;
  console.log(`Checkpoint: ${checkpoint.root} (${priorResults.length}/${positions.length} complete).`);
} else if (resume) {
  throw new Error('--resume requires --checkpoint=PATH.');
}

const completedIds = new Set(priorResults.map(({ id }) => id));
const pendingPositions = positions.filter(({ id }) => !completedIds.has(id));
let completed = priorResults.length;
const freshResults = pendingPositions.length
  ? await evaluatePositionsParallel({
    positions: pendingPositions,
    options: {
      repetitions,
      stages,
      referenceBudget,
      recommendationPracticalGap,
      seed,
    },
    workerCount: workers,
    workerUrl: new URL('./sampler-ablation-worker.mjs', import.meta.url),
    onProgress: (positionId) => {
      completed += 1;
      console.log(`Progress: ${completed}/${positions.length} positions (${positionId})`);
    },
    onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
  })
  : [];
const results = [...priorResults, ...freshResults].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeSamplerAblation(results, { seed, confidenceResamples });

printTable('OVERALL', summary.overall);
SAMPLER_ABLATION_GROUPS.forEach((group) => printTable(group.toUpperCase(), summary.byGroup[group]));
console.log('\nDIAGNOSIS');
console.log(`Aggregation defect: ${summary.diagnosis.aggregationDefect ? 'YES' : 'NO'}`);
console.log(`Shared early-stopping harm: ${summary.diagnosis.sharedEarlyStoppingHarm ? 'YES' : 'NO'}`);
console.log(`Independent early-stopping harm: ${summary.diagnosis.independentEarlyStoppingHarm ? 'YES' : 'NO'}`);
console.log(`Independent stage-sampling harm: ${summary.diagnosis.independentStageSamplingHarm ? 'YES' : 'NO'}`);

const output = {
  generatedAt: new Date().toISOString(),
  config,
  corpus: results.map(({ id, group, phase, branching, handSizes, eventCount, playedKey }) => ({
    id, group, phase, branching, handSizes, eventCount, playedKey,
  })),
  summary,
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

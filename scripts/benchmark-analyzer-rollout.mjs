import { mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_ADAPTIVE_MISTAKE_POLICY,
  DEFAULT_ADAPTIVE_STAGES,
} from '../app/adaptive-analysis.ts';
import {
  collectDecisionCorpus,
} from './analyzer-reliability-core.mjs';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import { evaluatePositionsParallel } from './analyzer-reliability-parallel.mjs';
import {
  ANALYZER_ROLLOUT_PHASES,
  ANALYZER_ROLLOUT_VERSION,
  summarizeAnalyzerRollout,
} from './analyzer-rollout-core.mjs';

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

function signedPercent(metric) {
  return `${metric.mean >= 0 ? '+' : ''}${(metric.mean * 100).toFixed(1)} pp [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

function points(metric) {
  return `${metric.mean.toFixed(3)} [${metric.low.toFixed(3)}, ${metric.high.toFixed(3)}]`;
}

function signedPoints(metric) {
  return `${metric.mean >= 0 ? '+' : ''}${metric.mean.toFixed(3)} [${metric.low.toFixed(3)}, ${metric.high.toFixed(3)}]`;
}

function policyLabel(policy) {
  return policy === 'current' ? 'Current rollout' : 'Exhaustive forecast';
}

function policyTable(group) {
  return [
    '| Analyzer | Within 1 point | Mean own-reference regret | Mistake-label agreement | False positives | Repeat acceptable | Mean samples | Mean time |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(group.policies).map(([policy, row]) => (
      `| ${policyLabel(policy)} | ${percent(row.withinOnePoint)} | ${points(row.meanRegret)} | ${percent(row.mistakeLabelAgreement)} | ${percent(row.falsePositiveMistakes)} | ${percent(row.repeatAcceptability)} | ${points(row.samplesUsed)} | ${Math.round(row.runtimeMs.mean)} ms |`
    )),
  ].join('\n');
}

function comparisonTable(group) {
  const row = group.comparison;
  return [
    '| Changed choices | Own within-1 difference | Own regret difference | Robust two-reference regret difference | Worst-reference regret difference | Within 1 under both references | Sample difference | Runtime difference |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| ${percent(row.selectionChangeRate)} | ${signedPercent(row.ownWithinOneDifference)} | ${signedPoints(row.ownRegretDifference)} | ${signedPoints(row.robustRegretDifference)} | ${signedPoints(row.worstRegretDifference)} | ${signedPercent(row.bothReferencesWithinOneDifference)} | ${signedPoints(row.sampleDifference)} | ${signedPoints(row.runtimeDifferenceMs)} ms |`,
  ].join('\n');
}

function renderReport(config, summary) {
  const gateRows = Object.entries(summary.gate.checks).map(([check, passed]) => (
    `| ${check} | ${passed ? 'PASS' : 'FAIL'} |`
  ));
  const phaseSections = ANALYZER_ROLLOUT_PHASES.map((phase) => `### ${phase}

Reference agreement: ${percent(summary.byPhase[phase].referenceAgreement)}

${policyTable(summary.byPhase[phase])}

${comparisonTable(summary.byPhase[phase])}`);
  return `# Mesa Quince exhaustive-rollout analyzer study

Generated: ${new Date().toISOString()}

## Configuration

- Version: \`${ANALYZER_ROLLOUT_VERSION}\`
- Positions: ${summary.positions}, balanced as ${ANALYZER_ROLLOUT_PHASES.map((phase) => `${summary.phaseCounts[phase]} ${phase}`).join(', ')}
- Repetitions per analyzer: ${config.repetitions}
- Adaptive stages: ${config.adaptiveStages.join(', ')}
- Independent reference samples per policy: ${config.referenceBudget}
- Confidence resamples: ${config.confidenceResamples}
- Worker threads: ${config.workers}
- Seed: \`${config.seed}\`

The current and exhaustive analyzers receive identical information-safe hidden-deal samples at every adaptive stage. Each is scored against its own independently sampled high-budget reference. To avoid favoring either model, the promotion gate also scores both selected moves under both high-budget references and requires the candidate to improve or tie their average regret. The earlier 8,640-round self-play diagnostic provides the independent strategic-performance signal.

Opponent hands and sleeping tiles are replaced with placeholders before either analyzer runs. The realized hidden deal is used only by the small exact-endgame diagnostic.

## Result

Promotion gate: **${summary.gate.passed ? 'PASS' : 'FAIL'}**

${summary.gate.passed ? 'Exhaustive forecasting passed the locked analyzer-quality and cost controls and may replace the current analyzer rollout after product verification.' : 'Exhaustive forecasting failed at least one locked check and must remain outside the live analyzer.'}

High-budget reference agreement: ${percent(summary.referenceAgreement)}

## Overall quality

${policyTable(summary)}

## Paired comparison

${comparisonTable(summary)}

Positive percentage differences favor exhaustive forecasting. Negative regret differences favor exhaustive forecasting.

## Promotion gate

| Check | Result |
| --- | --- |
${gateRows.join('\n')}

## Results by phase

${phaseSections.join('\n\n')}
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const positionsPerPhase = positiveInteger(argument('positions-per-phase'), quick ? 1 : 50, 'Positions per phase');
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 3, 'Repetition count');
const adaptiveStages = numberList(
  argument('adaptive-stages'),
  quick ? '60,120,250' : DEFAULT_ADAPTIVE_STAGES.join(','),
  'Adaptive stages',
);
const referenceBudget = positiveInteger(argument('reference-samples'), quick ? 500 : 5000, 'Reference sample count');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), quick ? 100 : 1000, 'Confidence resample count');
const seed = argument('seed') ?? 'mesa-quince-analyzer-rollout-v1';
const positionCount = positionsPerPhase * ANALYZER_ROLLOUT_PHASES.length;
const workers = positiveInteger(
  argument('workers'),
  Math.max(1, Math.min(positionCount, Math.max(1, availableParallelism() - 1), 8)),
  'Worker count',
);
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const config = {
  schema: 1,
  version: ANALYZER_ROLLOUT_VERSION,
  seed,
  positionsPerPhase,
  repetitions,
  adaptiveStages,
  referenceBudget,
  confidenceResamples,
  workers,
  adaptiveRecommendationGap: 1,
  adaptiveMistakePolicy: DEFAULT_ADAPTIVE_MISTAKE_POLICY,
  policies: ['current', 'exhaustive-forecast'],
};

console.log('MESA QUINCE EXHAUSTIVE-ROLLOUT ANALYZER STUDY');
console.log(`${positionCount} fresh positions, ${repetitions} repetitions, ${workers} worker threads.`);
console.log(`Adaptive stages ${adaptiveStages.join(' / ')} with independent ${referenceBudget}-sample references.`);

const positions = collectDecisionCorpus({
  positionsPerPhase,
  seed,
  maxDeals: Math.max(2400, positionsPerPhase * 80),
});
let checkpoint = null;
let priorResults = [];
if (checkpointPath) {
  checkpoint = await prepareReliabilityCheckpoint({ directory: checkpointPath, config, resume });
  priorResults = checkpoint.results;
  console.log(`Checkpoint: ${checkpoint.root} (${priorResults.length}/${positionCount} complete).`);
} else if (resume) {
  throw new Error('--resume requires --checkpoint=PATH.');
}

const completedIds = new Set(priorResults.map(({ id }) => id));
const pending = positions.filter(({ id }) => !completedIds.has(id));
let completed = priorResults.length;
const freshResults = pending.length
  ? await evaluatePositionsParallel({
    positions: pending,
    options: {
      repetitions,
      referenceBudget,
      adaptiveStages,
      adaptiveRecommendationGap: 1,
      adaptiveMistakePolicy: DEFAULT_ADAPTIVE_MISTAKE_POLICY,
      seed,
    },
    workerCount: workers,
    workerUrl: new URL('./analyzer-rollout-worker.mjs', import.meta.url),
    onProgress: (positionId) => {
      completed += 1;
      console.log(`Progress: ${completed}/${positionCount} positions (${positionId})`);
    },
    onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
  })
  : [];
const results = [...priorResults, ...freshResults].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeAnalyzerRollout(results, { seed, confidenceResamples });

console.log(`\nOVERALL\n${policyTable(summary)}`);
console.log(`\nPAIRED COMPARISON\n${comparisonTable(summary)}`);
console.log(`\nReference agreement: ${percent(summary.referenceAgreement)}`);
console.log(`Promotion gate: ${summary.gate.passed ? 'PASS' : 'FAIL'}`);
Object.entries(summary.gate.checks).forEach(([check, passed]) => {
  console.log(`- ${check}: ${passed ? 'PASS' : 'FAIL'}`);
});

const output = {
  generatedAt: new Date().toISOString(),
  config,
  summary,
  corpus: results.map(({ id, phase, branching, handSizes, eventCount, playedKey, exactOracleKeys }) => ({
    id,
    phase,
    branching,
    handSizes,
    eventCount,
    playedKey,
    exactOracleKeys,
  })),
  positions: results,
};
if (jsonPath) {
  const destination = resolve(jsonPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Saved ${destination}`);
}
if (reportPath) {
  const destination = resolve(reportPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, renderReport(config, summary));
  console.log(`Saved ${destination}`);
}

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluatePositionsParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';
import {
  ROOT_RACING_CONFIGS,
  ROOT_RACING_VERSION,
  collectRootRacingCorpus,
  summarizeRootRacing,
} from './root-racing-core.mjs';

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

function candidateTable(group, configs) {
  return [
    '| Candidate | Within 1 point | Regret | Repeat acceptable | Ref best survives | Selected samples | Changes vs 120 | Gate |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...configs.map(({ id }) => {
      const result = group.candidates[id];
      const variant = result.variant;
      return `| ${id} | ${percent(variant.withinOnePoint)} | ${points(variant.meanRegret)} | ${percent(variant.repeatAcceptability)} | ${percent(variant.referenceBestSurvival)} | ${variant.selectedSamples.mean.toFixed(1)} | ${percent(result.selectionChangeRate)} | ${result.gate.passed ? 'PASS' : 'FAIL'} |`;
    }),
  ].join('\n');
}

function effectTable(group, configs) {
  return [
    '| Candidate | Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...configs.map(({ id }) => {
      const effect = group.candidates[id].effect;
      return `| ${id} | ${percent(effect.withinOnePoint)} | ${points(effect.meanRegret)} | ${percent(effect.repeatAcceptability)} | ${percent(effect.mistakeLabelAgreement)} | ${percent(effect.falsePositiveMistake)} | ${points(effect.selectedEffectiveSamples)} |`;
    }),
  ].join('\n');
}

function checksTable(checks) {
  return [
    '| Check | Result |',
    '| --- | --- |',
    ...Object.entries(checks).map(([name, passed]) => `| ${name} | ${passed ? 'PASS' : 'FAIL'} |`),
  ].join('\n');
}

function renderReport(config, summary, positions) {
  const groups = Object.entries(summary.groups).map(([groupName, group]) => {
    const checks = config.configs.map(({ id }) => (
      `### ${id} locked checks\n\n${checksTable(group.candidates[id].gate.checks)}`
    )).join('\n\n');
    return `## ${groupName}\n\n${candidateTable(group, config.configs)}\n\n### Candidate minus current 120-sample effects\n\nPositive quality deltas and negative regret or false-positive deltas favor root racing.\n\n${effectTable(group, config.configs)}\n\n${checks}`;
  }).join('\n\n');
  const referencesAgree = positions.filter((position) => position.reference.independentTopAgreement).length;
  return `# Mesa Quince paired root-racing development study

Generated: ${new Date().toISOString()}

## Locked protocol

- Version: ${config.version}
- Seed: ${config.seed}
- Difficult opening positions: ${config.openingPositions}
- Middle-game safety positions: ${config.safetyPositions}
- Independent repetitions: ${config.repetitions}
- Current budget: ${config.rootBudget} samples per legal move
- Comparison ceiling: ${config.ceilingBudget} samples per legal move
- Independent references: two runs of ${config.referenceBudget} samples per position
- Workers: ${config.workers}
- Candidates: ${config.configs.map(({ id, initialSamples }) => `${id} (${initialSamples} initial samples)`).join(', ')}

Each candidate spends exactly the current analyzer's total root-evaluation budget. Every legal move receives the initial paired sample. A move is eliminated only when it is outside the protected top three, its paired 95% interval clears a one-point practical gap, its estimated deficit is at least three points, and its mini-batches agree. Saved evaluations are redistributed among survivors. All policies replay the same independently generated belief pool, and real hidden hands are removed before sampling.

This development study can select a candidate for a new locked holdout. It cannot release a live policy. Offline replay establishes quality and exact compute counts, but a selected candidate still needs direct runtime measurement, a fresh stress holdout, balanced safety validation, and matched self-play.

Independent reference top moves agreed on ${referencesAgree}/${positions.length} positions.

Advancing candidates: **${summary.advancingCandidates.length ? summary.advancingCandidates.join(', ') : 'none'}**

Overall development gate: **${summary.gate.passed ? 'PASS' : 'FAIL'}**

${groups}
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const openingPositions = positiveInteger(argument('opening-positions'), quick ? 1 : 24, 'Opening positions');
const safetyPositions = positiveInteger(argument('safety-positions'), quick ? 1 : 12, 'Safety positions');
const openingMinimumBranching = positiveInteger(argument('opening-minimum-branching'), quick ? 2 : 6, 'Opening minimum branching');
const safetyMinimumBranching = positiveInteger(argument('safety-minimum-branching'), quick ? 2 : 4, 'Safety minimum branching');
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 5, 'Repetitions');
const referenceBudget = positiveInteger(argument('reference-samples'), quick ? 8 : 5000, 'Reference samples');
const rootBudget = positiveInteger(argument('root-budget'), quick ? 4 : 120, 'Root budget');
const ceilingBudget = positiveInteger(argument('ceiling-budget'), quick ? 8 : 500, 'Ceiling budget');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), quick ? 40 : 1000, 'Confidence resamples');
const seed = argument('seed') ?? 'mesa-quince-root-racing-development-v1';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const positionCount = openingPositions + safetyPositions;
const workers = positiveInteger(argument('workers'), reliabilityWorkerCount(positionCount), 'Workers');
const configs = quick ? [{
  id: 'race-2',
  initialSamples: 2,
  minimumSurvivors: 2,
  practicalGap: 1,
  minimumGap: 3,
  batches: 2,
  minimumPositiveBatchAgreement: 0.5,
  minimumPracticalBatchAgreement: 0.5,
}] : ROOT_RACING_CONFIGS;
const config = {
  schema: 1,
  version: ROOT_RACING_VERSION,
  seed,
  openingPositions,
  safetyPositions,
  openingMinimumBranching,
  safetyMinimumBranching,
  repetitions,
  referenceBudget,
  rootBudget,
  ceilingBudget,
  confidenceResamples,
  configs,
  workers,
};

console.log('MESA QUINCE PAIRED ROOT-RACING DEVELOPMENT STUDY');
console.log(`Collecting ${openingPositions} difficult openings and ${safetyPositions} middle-game safety positions.`);
console.log(`${repetitions} paired repetitions, two ${referenceBudget}-sample references, ${workers} workers.`);
const corpus = collectRootRacingCorpus({
  openingPositions,
  safetyPositions,
  openingMinimumBranching,
  safetyMinimumBranching,
  seed,
});

let checkpoint = null;
let priorResults = [];
if (checkpointPath) {
  checkpoint = await prepareReliabilityCheckpoint({ directory: checkpointPath, config, resume });
  const expectedIds = new Set(corpus.map(({ id }) => id));
  const unexpected = checkpoint.results.filter(({ id }) => !expectedIds.has(id));
  if (unexpected.length) {
    throw new Error(`Checkpoint contains unexpected positions: ${unexpected.map(({ id }) => id).join(', ')}.`);
  }
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
  options: { repetitions, referenceBudget, rootBudget, ceilingBudget, configs, seed },
  workerCount: workers,
  workerUrl: new URL('./root-racing-worker.mjs', import.meta.url),
  onProgress: (positionId) => {
    completed += 1;
    console.log(`Progress: ${completed}/${corpus.length} positions (${positionId})`);
  },
  onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
}) : [];
const results = [...priorResults, ...fresh].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeRootRacing(results, { configs, rootBudget, seed, confidenceResamples });

for (const candidate of configs.map(({ id }) => id)) {
  const opening = summary.groups['opening-high'].candidates[candidate];
  console.log(`${candidate}: within-1 delta ${percent(opening.effect.withinOnePoint)}, regret delta ${points(opening.effect.meanRegret)}, survival ${percent(opening.variant.referenceBestSurvival)}, gate ${opening.gate.passed ? 'PASS' : 'FAIL'}`);
}
console.log(`Advancing candidates: ${summary.advancingCandidates.join(', ') || 'none'}`);

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

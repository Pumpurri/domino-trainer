import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluatePositionsParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';
import {
  TARGETED_CONFIRMATION_CANDIDATES,
  TARGETED_CONFIRMATION_VERSION,
  collectTargetedConfirmationCorpus,
  summarizeTargetedConfirmation,
} from './targeted-systematic-confirmation-core.mjs';

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

function positiveNumber(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be positive.`);
  return parsed;
}

function percent(metric) {
  return `${(metric.mean * 100).toFixed(1)}% [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

function points(metric) {
  return `${metric.mean.toFixed(3)} [${metric.low.toFixed(3)}, ${metric.high.toFixed(3)}]`;
}

function variantTable(summary) {
  const rows = [
    ['Current 120', summary.control],
    ...TARGETED_CONFIRMATION_CANDIDATES.map(({ id, samples }) => [
      `120 + targeted ${samples}`,
      summary.candidates[id].candidate,
    ]),
  ];
  return [
    '| Policy | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Selected samples | Mean overhead | Mean ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(([label, result]) => `| ${label} | ${percent(result.withinOnePoint)} | ${points(result.meanRegret)} | ${percent(result.repeatAcceptability)} | ${percent(result.repeatTopStability)} | ${percent(result.mistakeLabelAgreement)} | ${percent(result.falsePositiveMistake)} | ${result.selectedSamples.mean.toFixed(1)} | ${percent(result.overheadRatio)} | ${result.elapsedMs.mean.toFixed(0)} |`),
  ].join('\n');
}

function candidateSection(candidate, result) {
  return `## 120 + targeted ${candidate.samples}: ${result.gate.passed ? 'PASS' : 'FAIL'}

Recommendation change rate: **${percent(result.selectionChangeRate)}**

| Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${percent(result.effect.withinOnePoint)} | ${points(result.effect.meanRegret)} | ${percent(result.effect.repeatAcceptability)} | ${percent(result.effect.mistakeLabelAgreement)} | ${percent(result.effect.falsePositiveMistake)} | ${points(result.effect.selectedEffectiveSamples)} |

| Gate check | Result |
| --- | --- |
${Object.entries(result.gate.checks).map(([name, passed]) => `| ${name} | ${passed ? 'PASS' : 'FAIL'} |`).join('\n')}`;
}

function renderReport(config, summary, positions) {
  const referencesAgree = positions.filter((position) => position.reference.independentTopAgreement).length;
  return `# Mesa Quince targeted systematic confirmation study

Generated: ${new Date().toISOString()}

## Locked protocol

- Version: ${config.version}
- Seed: ${config.seed}
- Fresh difficult opening positions: ${config.positions}
- Minimum legal moves: ${config.minimumBranching}
- Independent repetitions: ${config.repetitions}
- Base systematic samples per move: ${config.baseBudget}
- Close-decision trigger: initial top-two gap at most ${config.closeGap} points
- Fresh confirmation budgets: ${config.candidates.map(({ samples }) => samples).join(', ')}
- Independent references: two runs of ${config.referenceBudget} samples
- Workers: ${config.workers}

Every legal move first receives the same ${config.baseBudget} systematic samples. On a close decision, only the initial top two moves and the player's actual move receive fresh confirmation evidence. The player's move cannot influence which moves are eligible for the recommendation. It is included only so the coaching label compares the recommendation and played move using equal evidence. Confirmation variants share one belief pool but use nested prefixes, so larger budgets strictly add evidence instead of changing earlier samples.

Real opponent hands and sleeping tiles are removed before belief generation. Independent reference top moves agreed on ${referencesAgree}/${positions.length} positions.

Overall result: **${summary.gate.passed ? 'PASS' : 'FAIL'}**

Selected candidate: **${summary.selectedCandidate ?? 'none'}**

Close-decision trigger rate: **${percent(summary.triggerRate)}**

${variantTable(summary)}

${config.candidates.map((candidate) => candidateSection(candidate, summary.candidates[candidate.id])).join('\n\n')}

A passing candidate still requires a fresh holdout and direct live-latency validation before changing the coach.
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const positions = positiveInteger(argument('positions'), quick ? 1 : 24, 'Positions');
const minimumBranching = positiveInteger(argument('minimum-branching'), quick ? 2 : 6, 'Minimum branching');
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 5, 'Repetitions');
const baseBudget = positiveInteger(argument('base-samples'), quick ? 6 : 120, 'Base samples');
const referenceBudget = positiveInteger(argument('reference-samples'), quick ? 12 : 5000, 'Reference samples');
const closeGap = positiveNumber(argument('close-gap'), quick ? 100 : 3, 'Close gap');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), quick ? 40 : 1000, 'Confidence resamples');
const workers = positiveInteger(argument('workers'), reliabilityWorkerCount(positions), 'Workers');
const seed = argument('seed') ?? 'mesa-quince-targeted-confirmation-v1';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const candidates = quick
  ? [
    { id: 'confirm-2', samples: 2 },
    { id: 'confirm-4', samples: 4 },
    { id: 'confirm-6', samples: 6 },
  ]
  : TARGETED_CONFIRMATION_CANDIDATES;
const config = {
  schema: 1,
  version: TARGETED_CONFIRMATION_VERSION,
  seed,
  positions,
  minimumBranching,
  repetitions,
  baseBudget,
  referenceBudget,
  closeGap,
  confidenceResamples,
  candidates,
  workers,
};

console.log('MESA QUINCE TARGETED SYSTEMATIC CONFIRMATION STUDY');
console.log(`Collecting ${positions} fresh openings with at least ${minimumBranching} legal moves.`);
console.log(`${repetitions} repetitions at ${baseBudget} base samples, two ${referenceBudget}-sample references, ${workers} workers.`);
const corpus = collectTargetedConfirmationCorpus({ positions, minimumBranching, seed });

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
  options: { repetitions, baseBudget, referenceBudget, closeGap, candidates, seed },
  workerCount: workers,
  workerUrl: new URL('./targeted-systematic-confirmation-worker.mjs', import.meta.url),
  onProgress: (positionId) => {
    completed += 1;
    console.log(`Progress: ${completed}/${corpus.length} positions (${positionId})`);
  },
  onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
}) : [];
const results = [...priorResults, ...fresh].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeTargetedConfirmation(results, {
  seed,
  confidenceResamples,
  baseBudget,
  candidates,
});

console.log(`Close-decision trigger rate: ${percent(summary.triggerRate)}`);
for (const candidate of candidates) {
  const result = summary.candidates[candidate.id];
  console.log(`${candidate.id}: changes ${percent(result.selectionChangeRate)}, within-one delta ${percent(result.effect.withinOnePoint)}, regret delta ${points(result.effect.meanRegret)}, overhead ${percent(result.candidate.overheadRatio)}, gate ${result.gate.passed ? 'PASS' : 'FAIL'}`);
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
  await writeFile(destination, renderReport(config, summary, results));
  console.log(`Saved Markdown report to ${destination}`);
}

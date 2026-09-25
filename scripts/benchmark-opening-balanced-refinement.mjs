import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluatePositionsParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';
import {
  OPENING_REFINEMENT_CANDIDATES,
  OPENING_REFINEMENT_VARIANTS,
  OPENING_REFINEMENT_VERSION,
  collectOpeningRefinementCorpus,
  summarizeOpeningRefinement,
} from './opening-balanced-refinement-core.mjs';

const LABELS = {
  systematic: 'Systematic control',
  'opening-response-balanced-10': 'Response balanced 10%',
  'opening-response-balanced-20': 'Response balanced 20%',
  'opening-response-balanced-25': 'Response balanced 25%',
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
  const rows = [
    ['systematic', summary.control],
    ...OPENING_REFINEMENT_CANDIDATES.map((candidate) => [candidate, summary.candidates[candidate].candidate]),
  ];
  return [
    '| Variant | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Effective samples | Mean ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(([variant, result]) => `| ${LABELS[variant]} | ${percent(result.withinOnePoint)} | ${points(result.meanRegret)} | ${percent(result.repeatAcceptability)} | ${percent(result.repeatTopStability)} | ${percent(result.mistakeLabelAgreement)} | ${percent(result.falsePositiveMistake)} | ${result.effectiveSamples.mean.toFixed(1)} | ${result.elapsedMs.mean.toFixed(0)} |`),
  ].join('\n');
}

function candidateSection(candidate, result) {
  return `## ${LABELS[candidate]}: ${result.gate.passed ? 'PASS' : 'FAIL'}

Selection change rate: **${percent(result.selectionChangeRate)}**

| Within 1 point delta | Mean regret delta | Repeat acceptable delta | Label delta | False-positive delta | Effective-sample delta | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ${percent(result.effect.withinOnePoint)} | ${points(result.effect.meanRegret)} | ${percent(result.effect.repeatAcceptability)} | ${percent(result.effect.mistakeLabelAgreement)} | ${percent(result.effect.falsePositiveMistake)} | ${points(result.effect.effectiveSamples)} | ${percent(result.effect.runtimeRatio)} |

| Gate check | Result |
| --- | --- |
${Object.entries(result.gate.checks).map(([name, passed]) => `| ${name} | ${passed ? 'PASS' : 'FAIL'} |`).join('\n')}`;
}

function renderReport(config, summary) {
  return `# Mesa Quince opening-balanced refinement development study

Generated: ${new Date().toISOString()}

## Locked protocol

- Version: ${config.version}
- Seed: ${config.seed}
- Fresh difficult opening positions: ${config.positions}
- Minimum legal moves: ${config.minimumBranching}
- Independent repetitions: ${config.repetitions}
- Fixed samples per legal move: ${config.budget}
- Independent references: 2 × ${config.referenceBudget} samples
- Workers: ${config.workers}

All variants use the same belief pool within each repetition. Candidate proposals use only plausible belief particles and public or player-known information. Importance weights correct proposal sampling back to the posterior. Real opponent hands and sleeping tiles are removed before belief generation.

Overall result: **${summary.gate.passed ? 'PASS' : 'FAIL'}**

Selected candidate: **${summary.selectedCandidate ? LABELS[summary.selectedCandidate] : 'none'}**

${variantTable(summary)}

${OPENING_REFINEMENT_CANDIDATES.map((candidate) => candidateSection(candidate, summary.candidates[candidate])).join('\n\n')}
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const positions = positiveInteger(argument('positions'), quick ? 1 : 36, 'Positions');
const minimumBranching = positiveInteger(argument('minimum-branching'), quick ? 2 : 6, 'Minimum branching');
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 5, 'Repetitions');
const budget = positiveInteger(argument('samples'), quick ? 6 : 120, 'Samples');
const referenceBudget = positiveInteger(argument('reference-samples'), quick ? 12 : 5000, 'Reference samples');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), quick ? 40 : 1000, 'Confidence resamples');
const seed = argument('seed') ?? 'mesa-quince-opening-balanced-refinement-v2';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const workers = positiveInteger(argument('workers'), reliabilityWorkerCount(positions), 'Workers');
const config = {
  schema: 1,
  version: OPENING_REFINEMENT_VERSION,
  seed,
  positions,
  minimumBranching,
  repetitions,
  budget,
  referenceBudget,
  confidenceResamples,
  variants: OPENING_REFINEMENT_VARIANTS,
  workers,
};

console.log('MESA QUINCE OPENING-BALANCED REFINEMENT STUDY');
console.log(`Collecting ${positions} fresh opening positions with at least ${minimumBranching} legal moves.`);
console.log(`${repetitions} repetitions at ${budget} samples, two ${referenceBudget}-sample references, ${workers} workers.`);
const corpus = collectOpeningRefinementCorpus({ positions, minimumBranching, seed });

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
  options: { repetitions, budget, referenceBudget, seed },
  workerCount: workers,
  workerUrl: new URL('./opening-balanced-refinement-worker.mjs', import.meta.url),
  onProgress: (positionId) => {
    completed += 1;
    console.log(`Progress: ${completed}/${corpus.length} positions (${positionId})`);
  },
  onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
}) : [];
const results = [...priorResults, ...fresh].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeOpeningRefinement(results, { seed, confidenceResamples, budget });

for (const candidate of OPENING_REFINEMENT_CANDIDATES) {
  const result = summary.candidates[candidate];
  console.log(`${LABELS[candidate]}: changes ${percent(result.selectionChangeRate)}, within-one delta ${percent(result.effect.withinOnePoint)}, regret delta ${points(result.effect.meanRegret)}, ESS ${result.candidate.effectiveSamples.mean.toFixed(1)}, gate ${result.gate.passed ? 'PASS' : 'FAIL'}`);
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

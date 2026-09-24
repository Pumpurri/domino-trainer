import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import {
  evaluatePositionsParallel,
  reliabilityWorkerCount,
} from './analyzer-reliability-parallel.mjs';
import {
  CONFIRMED_ROOT_RACING_CONFIG,
  CONFIRMED_ROOT_RACING_VERSION,
  collectConfirmedRootRacingCorpus,
  summarizeConfirmedRootRacing,
} from './confirmed-root-racing-core.mjs';

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

function checksTable(checks) {
  return [
    '| Check | Result |',
    '| --- | --- |',
    ...Object.entries(checks).map(([name, passed]) => `| ${name} | ${passed ? 'PASS' : 'FAIL'} |`),
  ].join('\n');
}

function variantTable(summary) {
  return [
    '| Policy | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Selected samples |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| Current 120 | ${percent(summary.control.withinOnePoint)} | ${points(summary.control.meanRegret)} | ${percent(summary.control.repeatAcceptability)} | ${percent(summary.control.repeatTopStability)} | ${percent(summary.control.mistakeLabelAgreement)} | ${percent(summary.control.falsePositiveMistake)} | ${summary.control.selectedSamples.mean.toFixed(1)} |`,
    `| Confirmed race-40 | ${percent(summary.candidate.withinOnePoint)} | ${points(summary.candidate.meanRegret)} | ${percent(summary.candidate.repeatAcceptability)} | ${percent(summary.candidate.repeatTopStability)} | ${percent(summary.candidate.mistakeLabelAgreement)} | ${percent(summary.candidate.falsePositiveMistake)} | ${summary.candidate.selectedSamples.mean.toFixed(1)} |`,
    `| 500 ceiling | ${percent(summary.ceiling.withinOnePoint)} | ${points(summary.ceiling.meanRegret)} | ${percent(summary.ceiling.repeatAcceptability)} | ${percent(summary.ceiling.repeatTopStability)} | ${percent(summary.ceiling.mistakeLabelAgreement)} | ${percent(summary.ceiling.falsePositiveMistake)} | ${summary.ceiling.selectedSamples.mean.toFixed(1)} |`,
  ].join('\n');
}

function renderReport(config, summary, positions) {
  const referencesAgree = positions.filter((position) => position.reference.independentTopAgreement).length;
  return `# Mesa Quince confirmed root-racing development study

Generated: ${new Date().toISOString()}

## Locked protocol

- Version: ${config.version}
- Seed: ${config.seed}
- Fresh difficult opening positions: ${config.positions}
- Minimum legal moves: ${config.minimumBranching}
- Independent repetitions: ${config.repetitions}
- Current recommendation budget: ${config.rootBudget} samples per legal move
- Comparison ceiling: ${config.ceilingBudget} samples per legal move
- Independent references: two runs of ${config.referenceBudget} samples per position
- Workers: ${config.workers}
- Initial evidence: ${config.candidate.initialSamples} samples per move
- Fresh confirmation: ${config.candidate.confirmationSamples} samples for provisional eliminations and their leader

The policy is eligible only during openings with at least six legal moves. Middle, late, and block phases retain the current analyzer exactly. Every move receives the initial paired evidence. A move can be eliminated only if the initial stage marks it dominated and a fresh confirmation batch independently keeps the same leader ahead. The recommendation always spends exactly the current total root budget, and every finalist retains at least 120 samples.

If the player chooses an eliminated move, post-decision analysis extends that move to 120 paired samples before issuing a mistake label. That confirmation does not influence the earlier recommendation and its mean overhead must remain at most 2% of the recommendation budget.

Each saved repetition contains the common particle weights and every move's 500 paired outcomes. Future threshold studies can replay this evidence without rerunning simulations or changing the reference.

Real opponent hands and sleeping tiles are removed before belief generation. Independent reference top moves agreed on ${referencesAgree}/${positions.length} positions.

## Result: **${summary.gate.passed ? 'PASS' : 'FAIL'}**

${variantTable(summary)}

## Candidate minus current 120

| Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${percent(summary.effect.withinOnePoint)} | ${points(summary.effect.meanRegret)} | ${percent(summary.effect.repeatAcceptability)} | ${percent(summary.effect.mistakeLabelAgreement)} | ${percent(summary.effect.falsePositiveMistake)} | ${points(summary.effect.selectedEffectiveSamples)} |

- Recommendation changes: ${percent(summary.selectionChangeRate)}
- Reference-best survival: ${percent(summary.candidate.referenceBestSurvival)}
- Minimum finalist samples: ${summary.candidate.minimumSurvivorSamples.mean.toFixed(1)}
- Mean post-decision overhead: ${percent(summary.postDecisionOverheadRatio)}

## Locked checks

${checksTable(summary.gate.checks)}

Passing selects the frozen candidate for direct runtime measurement and a fresh holdout. It does not change the live coach by itself.
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const positions = positiveInteger(argument('positions'), quick ? 1 : 24, 'Positions');
const minimumBranching = positiveInteger(argument('minimum-branching'), 6, 'Minimum branching');
const repetitions = positiveInteger(argument('repetitions'), quick ? 1 : 5, 'Repetitions');
const referenceBudget = positiveInteger(argument('reference-samples'), quick ? 8 : 5000, 'Reference samples');
const rootBudget = positiveInteger(argument('root-budget'), quick ? 4 : 120, 'Root budget');
const ceilingBudget = positiveInteger(argument('ceiling-budget'), quick ? 8 : 500, 'Ceiling budget');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), quick ? 40 : 1000, 'Confidence resamples');
const workers = positiveInteger(argument('workers'), reliabilityWorkerCount(positions), 'Workers');
const seed = argument('seed') ?? 'mesa-quince-confirmed-root-racing-development-v2';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const candidate = quick ? {
  ...CONFIRMED_ROOT_RACING_CONFIG,
  initialSamples: 2,
  confirmationSamples: 2,
  batches: 2,
  confirmationBatches: 2,
  minimumPositiveBatchAgreement: 0.5,
  minimumPracticalBatchAgreement: 0.5,
} : CONFIRMED_ROOT_RACING_CONFIG;
const config = {
  schema: 1,
  version: CONFIRMED_ROOT_RACING_VERSION,
  seed,
  positions,
  minimumBranching,
  repetitions,
  referenceBudget,
  rootBudget,
  ceilingBudget,
  confidenceResamples,
  candidate,
  workers,
};

console.log('MESA QUINCE CONFIRMED ROOT-RACING DEVELOPMENT STUDY');
console.log(`Collecting ${positions} fresh openings with at least ${minimumBranching} legal moves.`);
console.log(`${repetitions} paired repetitions, two ${referenceBudget}-sample references, ${workers} workers.`);
const corpus = collectConfirmedRootRacingCorpus({ positions, minimumBranching, seed });

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
  options: { repetitions, referenceBudget, rootBudget, ceilingBudget, config: candidate, seed },
  workerCount: workers,
  workerUrl: new URL('./confirmed-root-racing-worker.mjs', import.meta.url),
  onProgress: (positionId) => {
    completed += 1;
    console.log(`Progress: ${completed}/${corpus.length} positions (${positionId})`);
  },
  onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
}) : [];
const results = [...priorResults, ...fresh].sort((left, right) => left.id.localeCompare(right.id));
const summary = summarizeConfirmedRootRacing(results, { seed, confidenceResamples, rootBudget });

console.log(`Within-1 delta: ${percent(summary.effect.withinOnePoint)}`);
console.log(`Regret delta: ${points(summary.effect.meanRegret)}`);
console.log(`Reference-best survival: ${percent(summary.candidate.referenceBestSurvival)}`);
console.log(`False-positive delta: ${percent(summary.effect.falsePositiveMistake)}`);
console.log(`Mean post-decision overhead: ${percent(summary.postDecisionOverheadRatio)}`);
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

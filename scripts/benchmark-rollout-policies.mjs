import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { availableParallelism } from 'node:os';
import { prepareReliabilityCheckpoint } from './analyzer-reliability-checkpoint.mjs';
import { evaluatePositionsParallel } from './analyzer-reliability-parallel.mjs';
import {
  ROLLOUT_PHASES,
  ROLLOUT_POLICIES,
  ROLLOUT_POLICY_LINEUPS,
  ROLLOUT_POLICY_VERSION,
  summarizeRolloutPolicyBenchmark,
} from './rollout-policy-core.mjs';

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

function policyLabel(policy) {
  return policy.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function percent(metric) {
  return `${(metric.mean * 100).toFixed(2)}% [${(metric.low * 100).toFixed(2)}, ${(metric.high * 100).toFixed(2)}]`;
}

function points(metric) {
  return `${metric.mean.toFixed(2)} [${metric.low.toFixed(2)}, ${metric.high.toFixed(2)}]`;
}

function signedPercent(metric) {
  const value = (metric.mean * 100).toFixed(2);
  return `${metric.mean >= 0 ? '+' : ''}${value} pp [${(metric.low * 100).toFixed(2)}, ${(metric.high * 100).toFixed(2)}]`;
}

function signedPoints(metric) {
  return `${metric.mean >= 0 ? '+' : ''}${metric.mean.toFixed(2)} [${metric.low.toFixed(2)}, ${metric.high.toFixed(2)}]`;
}

function strategyTable(summary) {
  return [
    '| Policy | Win rate | Average end pips | Average losing pips | Blocked win rate | Decisions |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...ROLLOUT_POLICIES.map((policy) => {
      const row = summary.strategies[policy];
      return `| ${policyLabel(policy)} | ${percent(row.winRate)} | ${points(row.averageEndPips)} | ${points(row.averageLosingPips)} | ${percent(row.blocked.winRate)} | ${row.decisions} |`;
    }),
  ].join('\n');
}

function comparisonTable(summary) {
  return [
    '| Candidate | Overall win difference | Blocked win difference | Losing-pip difference | Opening | Middle | Late | Block | Gate |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...Object.entries(summary.comparisons).map(([policy, row]) => (
      `| ${policyLabel(policy)} | ${signedPercent(row.winRateDifference)} | ${signedPercent(row.blockedWinRateDifference)} | ${signedPoints(row.losingPipsDifference)} | ${signedPercent(row.phaseWinRateDifferences.opening)} | ${signedPercent(row.phaseWinRateDifferences.middle)} | ${signedPercent(row.phaseWinRateDifferences.late)} | ${signedPercent(row.phaseWinRateDifferences.block)} | ${row.gate.passed ? 'PASS' : 'FAIL'} |`
    )),
  ].join('\n');
}

function phaseTable(summary, phase) {
  return [
    '| Policy | Eligible rounds | Decisions | Conditional win rate |',
    '| --- | ---: | ---: | ---: |',
    ...ROLLOUT_POLICIES.map((policy) => {
      const row = summary.strategies[policy].byPhase[phase];
      return `| ${policyLabel(policy)} | ${row.rounds} | ${row.decisions} | ${percent(row.winRate)} |`;
    }),
  ].join('\n');
}

function gateTable(summary) {
  const rows = Object.entries(summary.comparisons).flatMap(([policy, comparison]) => (
    Object.entries(comparison.gate.checks).map(([check, passed]) => (
      `| ${policyLabel(policy)} | ${check} | ${passed ? 'PASS' : 'FAIL'} |`
    ))
  ));
  return [
    '| Candidate | Check | Result |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function renderReport(config, summary) {
  const selected = summary.decision.selectedPolicy;
  return `# Mesa Quince rollout-policy diagnostic

Generated: ${new Date().toISOString()}

## Configuration

- Version: \`${ROLLOUT_POLICY_VERSION}\`
- Deals: ${config.deals}
- Rounds per deal: ${ROLLOUT_POLICY_LINEUPS.length * 3}
- Total rounds: ${summary.rounds}
- Policies: ${ROLLOUT_POLICIES.join(', ')}
- Worker threads: ${config.workers}
- Confidence resamples: ${config.confidenceResamples}
- Seed: \`${config.seed}\`

Every deal is replayed for every three-policy combination, every seat permutation, and every starter. Each policy therefore receives the same number of appearances in every seat and starting position. Policies may inspect only their own hand, public events, hand sizes, proven voids, and the open ends.

This is a development diagnostic, not a live-coach release study. ${selected ? `The selected direction is **${policyLabel(selected)}**. It may advance only to a separately seeded analyzer experiment.` : 'No candidate passed every locked diagnostic check, so none should be wired into the analyzer.'}

## Overall results

${strategyTable(summary)}

## Paired differences from the current rollout

${comparisonTable(summary)}

Positive win-rate differences favor the candidate. Negative losing-pip differences favor the candidate.

## Diagnostic gates

${gateTable(summary)}

## Results by strategic phase

${ROLLOUT_PHASES.map((phase) => `### ${phase}\n\n${phaseTable(summary, phase)}`).join('\n\n')}

Phase win rates are conditional on rounds in which that policy faced at least one multi-move decision in the named phase. Complete deals, not individual decisions or rounds, are resampled for confidence intervals.
`;
}

const quick = process.argv.includes('--quick');
const resume = process.argv.includes('--resume');
const deals = positiveInteger(argument('deals'), quick ? 2 : 120, 'Deal count');
const confidenceResamples = positiveInteger(
  argument('confidence-resamples'),
  quick ? 100 : 2000,
  'Confidence resample count',
);
const workers = positiveInteger(
  argument('workers'),
  Math.max(1, Math.min(deals, Math.max(1, availableParallelism() - 1), 8)),
  'Worker count',
);
const seed = argument('seed') ?? 'mesa-quince-rollout-policy-v1';
const checkpointPath = argument('checkpoint');
const jsonPath = argument('json');
const reportPath = argument('report');
const config = {
  schema: 1,
  version: ROLLOUT_POLICY_VERSION,
  deals,
  seed,
  confidenceResamples,
  workers,
  policies: ROLLOUT_POLICIES,
  lineups: ROLLOUT_POLICY_LINEUPS,
};

console.log('MESA QUINCE ROLLOUT-POLICY DIAGNOSTIC');
console.log(`${deals} matched deals, ${ROLLOUT_POLICY_LINEUPS.length * 3} rounds per deal, ${workers} worker threads.`);

const dealIndices = Array.from({ length: deals }, (_, index) => index);
let checkpoint = null;
let priorResults = [];
if (checkpointPath) {
  checkpoint = await prepareReliabilityCheckpoint({ directory: checkpointPath, config, resume });
  priorResults = checkpoint.results;
  console.log(`Checkpoint: ${checkpoint.root} (${priorResults.length}/${deals} complete).`);
} else if (resume) {
  throw new Error('--resume requires --checkpoint=PATH.');
}
const completed = new Set(priorResults.map(({ dealIndex }) => dealIndex));
const pending = dealIndices.filter((dealIndex) => !completed.has(dealIndex));
let completedCount = priorResults.length;
const freshResults = pending.length
  ? await evaluatePositionsParallel({
    positions: pending,
    options: { seed },
    workerCount: workers,
    workerUrl: new URL('./rollout-policy-worker.mjs', import.meta.url),
    onProgress: (id) => {
      completedCount += 1;
      console.log(`Progress: ${completedCount}/${deals} deals (${id})`);
    },
    onResult: checkpoint ? (result) => checkpoint.save(result) : undefined,
  })
  : [];
const results = [...priorResults, ...freshResults].sort((left, right) => left.dealIndex - right.dealIndex);
const summary = summarizeRolloutPolicyBenchmark(results, { seed, confidenceResamples });

console.log(`\n${strategyTable(summary)}`);
console.log(`\n${comparisonTable(summary)}`);
console.log(`\nSelected direction: ${summary.decision.selectedPolicy ? policyLabel(summary.decision.selectedPolicy) : 'none'}.`);

const output = {
  generatedAt: new Date().toISOString(),
  config,
  summary,
  deals: results,
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

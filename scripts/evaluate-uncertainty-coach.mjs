import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { seededRandom } from '../app/domino-engine.ts';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function intersects(left, right) {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  const rightSet = new Set(right);
  return [...new Set(left)].filter((value) => rightSet.has(value)).length / union.size;
}

function positionMetrics(position, budget) {
  const trials = position.budgets[String(budget)].trials;
  const reference = position.reference.uncertaintyCoach;
  if (!reference) throw new Error(`Position ${position.id} has no uncertainty-aware reference.`);
  const pairs = [];
  for (let left = 0; left < trials.length; left += 1) {
    for (let right = left + 1; right < trials.length; right += 1) pairs.push([trials[left], trials[right]]);
  }
  const sharedAcrossRuns = trials.length
    ? trials[0].uncertaintyCoach.plausibleBestKeys.some((key) => (
      trials.every((trial) => trial.uncertaintyCoach.plausibleBestKeys.includes(key))
    ))
    : true;
  return {
    trials: trials.length,
    referenceTopCoverage: average(trials.map((trial) => (
      trial.uncertaintyCoach.plausibleBestKeys.includes(position.reference.topKey) ? 1 : 0
    ))),
    referenceSetCoverage: average(trials.map((trial) => (
      intersects(trial.uncertaintyCoach.plausibleBestKeys, reference.plausibleBestKeys) ? 1 : 0
    ))),
    currentReferenceSetCoverage: average(trials.map((trial) => (
      reference.plausibleBestKeys.includes(trial.topKey) ? 1 : 0
    ))),
    falseAccusations: average(trials.map((trial) => (
      trial.uncertaintyCoach.assessment === 'mistake' && reference.assessment !== 'mistake' ? 1 : 0
    ))),
    currentFalseAccusations: average(trials.map((trial) => trial.falsePositiveMistake ? 1 : 0)),
    labelAgreement: average(trials.map((trial) => (
      trial.uncertaintyCoach.assessment === reference.assessment ? 1 : 0
    ))),
    setSize: average(trials.map((trial) => trial.uncertaintyCoach.plausibleBestKeys.length)),
    multipleOptions: average(trials.map((trial) => trial.uncertaintyCoach.plausibleBestKeys.length > 1 ? 1 : 0)),
    allLegal: average(trials.map((trial) => (
      trial.uncertaintyCoach.plausibleBestKeys.length >= position.branching ? 1 : 0
    ))),
    repeatSetJaccard: pairs.length ? average(pairs.map(([left, right]) => jaccard(
      left.uncertaintyCoach.plausibleBestKeys,
      right.uncertaintyCoach.plausibleBestKeys,
    ))) : 1,
    repeatSharedOption: sharedAcrossRuns ? 1 : 0,
    repeatExactTop: new Set(trials.map((trial) => trial.topKey)).size <= 1 ? 1 : 0,
    runtimeMs: average(trials.map((trial) => trial.elapsedMs)),
  };
}

const metricNames = [
  'referenceTopCoverage',
  'referenceSetCoverage',
  'currentReferenceSetCoverage',
  'falseAccusations',
  'currentFalseAccusations',
  'labelAgreement',
  'setSize',
  'multipleOptions',
  'allLegal',
  'repeatSetJaccard',
  'repeatSharedOption',
  'repeatExactTop',
  'runtimeMs',
];

function summarizeRows(rows, seed, resamples) {
  const point = Object.fromEntries(metricNames.map((name) => [name, average(rows.map((row) => row[name]))]));
  const random = seededRandom(seed);
  const distributions = Object.fromEntries(metricNames.map((name) => [name, []]));
  for (let sample = 0; sample < resamples; sample += 1) {
    const selected = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]);
    metricNames.forEach((name) => distributions[name].push(average(selected.map((row) => row[name]))));
  }
  return Object.fromEntries(metricNames.map((name) => {
    const values = distributions[name].sort((left, right) => left - right);
    const low = values[Math.floor(values.length * 0.025)] ?? point[name];
    const high = values[Math.min(values.length - 1, Math.floor(values.length * 0.975))] ?? point[name];
    return [name, { mean: point[name], low, high }];
  }));
}

function gate(summary) {
  const checks = {
    referenceTopCoverage: summary.referenceTopCoverage.low >= 0.9,
    referenceSetCoverage: summary.referenceSetCoverage.low >= 0.95,
    improvesCoverage: summary.referenceSetCoverage.mean >= summary.currentReferenceSetCoverage.mean,
    repeatSharedOption: summary.repeatSharedOption.low >= 0.85,
    repeatSetJaccard: summary.repeatSetJaccard.low >= 0.7,
    falseAccusations: summary.falseAccusations.high <= 0.02,
    noFalseAccusationIncrease: summary.falseAccusations.mean <= summary.currentFalseAccusations.mean,
    averageSetSize: summary.setSize.high <= 2.5,
    allLegalRate: summary.allLegal.high <= 0.15,
    exercised: summary.multipleOptions.low >= 0.05,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

function percent(metric) {
  return `${(metric.mean * 100).toFixed(1)}% [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

function number(metric, digits = 2) {
  return `${metric.mean.toFixed(digits)} [${metric.low.toFixed(digits)}, ${metric.high.toFixed(digits)}]`;
}

function report(result) {
  const rows = result.budgets.map(({ budget, summary, gate: resultGate }) => `| ${budget} | ${percent(summary.referenceTopCoverage)} | ${percent(summary.referenceSetCoverage)} | ${percent(summary.currentReferenceSetCoverage)} | ${percent(summary.repeatSharedOption)} | ${percent(summary.repeatSetJaccard)} | ${percent(summary.falseAccusations)} | ${number(summary.setSize)} | ${percent(summary.allLegal)} | ${resultGate.passed ? 'PASS' : 'FAIL'} |`);
  const checks = result.budgets.flatMap(({ budget, gate: resultGate }) => (
    Object.entries(resultGate.checks).map(([name, passed]) => `| ${budget} | ${name} | ${passed ? 'PASS' : 'FAIL'} |`)
  ));
  return `# Mesa Quince uncertainty-aware coaching validation

Generated: ${result.generatedAt}

## Locked protocol

- Seed: ${result.config.seed}
- Positions: ${result.config.positions}, balanced across opening, middle, late, and likely-block play
- Independent repetitions per position: ${result.config.repetitions}
- Fixed budgets: ${result.config.budgets.join(', ')} samples
- Independent reference: ${result.config.referenceBudget} samples
- Bootstrap resamples: ${result.config.confidenceResamples}

The candidate does not change move simulation or ranking. It changes coaching semantics only. Moves whose paired interval does not clear a one-point practical advantage form the strong-option set. A mistake requires at least four estimated win-rate points lost, a paired lower bound above 1.5 points, and consistent direction across four interleaved evidence groups. Real opponent hands and sleeping tiles are unavailable to every analysis.

Each budget must pass every locked check. The checks require strong reference coverage, repeatable sets, no increase in false accusations, bounded set breadth, and enough multi-option decisions to prove the candidate was exercised.

Overall result: **${result.passed ? 'PASS' : 'FAIL'}**

## Results

| Budget | Reference top covered | Reference set covered | Current single-top coverage | Shared option across repeats | Pairwise set similarity | False accusations | Mean set size | All legal moves accepted | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows.join('\n')}

## Locked checks

| Budget | Check | Result |
| ---: | --- | --- |
${checks.join('\n')}
`;
}

const inputPath = argument('input');
if (!inputPath) throw new Error('--input=PATH is required.');
const jsonPath = argument('json');
const reportPath = argument('report');
const confidenceResamples = Number(argument('confidence-resamples') ?? 2000);
if (!Number.isInteger(confidenceResamples) || confidenceResamples <= 0) {
  throw new Error('Confidence resamples must be a positive integer.');
}
const input = JSON.parse(await readFile(resolve(process.cwd(), inputPath), 'utf8'));
const budgets = input.config.budgets;
const evaluated = budgets.map((budget) => {
  const rows = input.positions.map((position) => positionMetrics(position, budget));
  const summary = summarizeRows(rows, `${input.config.seed}|uncertainty-coach|${budget}`, confidenceResamples);
  return { budget, summary, gate: gate(summary) };
});
const result = {
  generatedAt: new Date().toISOString(),
  config: {
    seed: input.config.seed,
    positions: input.positions.length,
    repetitions: input.config.repetitions,
    budgets,
    referenceBudget: input.config.referenceBudget,
    confidenceResamples,
  },
  passed: evaluated.every((entry) => entry.gate.passed),
  budgets: evaluated,
};

console.log(`Uncertainty-aware coach: ${result.passed ? 'PASS' : 'FAIL'}`);
evaluated.forEach(({ budget, summary, gate: resultGate }) => {
  console.log(`${budget}: ${resultGate.passed ? 'PASS' : 'FAIL'} | reference set ${percent(summary.referenceSetCoverage)} | repeat shared option ${percent(summary.repeatSharedOption)} | false accusations ${percent(summary.falseAccusations)} | mean set ${number(summary.setSize)}`);
});
if (jsonPath) await writeFile(resolve(process.cwd(), jsonPath), `${JSON.stringify(result, null, 2)}\n`);
if (reportPath) await writeFile(resolve(process.cwd(), reportPath), report(result));

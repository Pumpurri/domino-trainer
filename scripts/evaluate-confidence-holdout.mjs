import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { seededRandom } from '../app/domino-engine.ts';

const practicalGap = 1.5;

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function confidence(trial) {
  if (trial.coachV3Confidence) return trial.coachV3Confidence;
  const alternative = trial.coachV2Evidence?.alternative;
  return {
    primaryKey: trial.topKey,
    recommendationKeys: [trial.topKey],
    confidence: !alternative || alternative.interval[0] > practicalGap ? 'clear' : 'close',
  };
}

function emptyCounts() {
  return {
    trials: 0,
    primaryUnchanged: 0,
    exactlyOneRecommendation: 0,
    clear: 0,
    clearWithinOnePoint: 0,
    close: 0,
    closeWithinOnePoint: 0,
    confidenceAgreement: 0,
    repeatPairs: 0,
    repeatAgreement: 0,
  };
}

function positionCounts(position, budget) {
  const counts = emptyCounts();
  const reference = confidence({
    ...position.reference,
    topKey: position.reference.topKey,
  });
  const labels = [];
  for (const trial of position.budgets[String(budget)].trials) {
    const candidate = confidence(trial);
    labels.push(candidate.confidence);
    counts.trials += 1;
    counts.primaryUnchanged += candidate.primaryKey === trial.topKey ? 1 : 0;
    counts.exactlyOneRecommendation += candidate.recommendationKeys.length === 1
      && candidate.recommendationKeys[0] === trial.topKey ? 1 : 0;
    counts.confidenceAgreement += candidate.confidence === reference.confidence ? 1 : 0;
    if (candidate.confidence === 'clear') {
      counts.clear += 1;
      counts.clearWithinOnePoint += trial.withinOnePoint ? 1 : 0;
    } else {
      counts.close += 1;
      counts.closeWithinOnePoint += trial.withinOnePoint ? 1 : 0;
    }
  }
  for (let left = 0; left < labels.length; left += 1) {
    for (let right = left + 1; right < labels.length; right += 1) {
      counts.repeatPairs += 1;
      counts.repeatAgreement += labels[left] === labels[right] ? 1 : 0;
    }
  }
  return counts;
}

function addCounts(rows) {
  const total = emptyCounts();
  for (const row of rows) {
    for (const key of Object.keys(total)) total[key] += row[key];
  }
  return total;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function metrics(rows) {
  const counts = addCounts(rows);
  const clearWithinOnePoint = ratio(counts.clearWithinOnePoint, counts.clear);
  const closeWithinOnePoint = ratio(counts.closeWithinOnePoint, counts.close);
  return {
    primaryUnchanged: ratio(counts.primaryUnchanged, counts.trials),
    exactlyOneRecommendation: ratio(counts.exactlyOneRecommendation, counts.trials),
    clearRate: ratio(counts.clear, counts.trials),
    clearWithinOnePoint,
    closeWithinOnePoint,
    qualitySeparation: clearWithinOnePoint - closeWithinOnePoint,
    confidenceAgreement: ratio(counts.confidenceAgreement, counts.trials),
    repeatAgreement: ratio(counts.repeatAgreement, counts.repeatPairs),
  };
}

const metricNames = Object.keys(metrics([]));

function summarize(rows, seed, resamples) {
  const point = metrics(rows);
  const distributions = Object.fromEntries(metricNames.map((name) => [name, []]));
  const random = seededRandom(seed);
  for (let sample = 0; sample < resamples; sample += 1) {
    const selected = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]);
    const sampleMetrics = metrics(selected);
    metricNames.forEach((name) => distributions[name].push(sampleMetrics[name]));
  }
  return Object.fromEntries(metricNames.map((name) => {
    const values = distributions[name].sort((left, right) => left - right);
    return [name, {
      mean: point[name],
      low: values[Math.floor(values.length * 0.025)] ?? point[name],
      high: values[Math.min(values.length - 1, Math.floor(values.length * 0.975))] ?? point[name],
    }];
  }));
}

function gate(summary, phases) {
  const checks = {
    primaryUnchanged: summary.primaryUnchanged.mean === 1,
    exactlyOneRecommendation: summary.exactlyOneRecommendation.mean === 1,
    clearConfidenceExercised: summary.clearRate.low >= 0.1,
    clearRecommendationQuality: summary.clearWithinOnePoint.low >= 0.9,
    phaseClearRecommendationQuality: Object.values(phases).every(({ clear, summary: phaseSummary }) => (
      clear > 0 && phaseSummary.clearWithinOnePoint.mean >= 0.8
    )),
    confidenceDiscriminates: summary.qualitySeparation.low >= 0.05,
    confidenceAgreement: summary.confidenceAgreement.low >= 0.5,
    repeatAgreement: summary.repeatAgreement.low >= 0.75,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

function percent(metric) {
  return `${(metric.mean * 100).toFixed(1)}% [${(metric.low * 100).toFixed(1)}, ${(metric.high * 100).toFixed(1)}]`;
}

const inputPath = argument('input');
if (!inputPath) throw new Error('--input=PATH is required.');
const study = argument('study') ?? 'holdout';
if (!['development', 'holdout'].includes(study)) throw new Error('--study must be development or holdout.');
const jsonPath = argument('json');
const reportPath = argument('report');
const confidenceResamples = Number(argument('confidence-resamples') ?? 2000);
if (!Number.isInteger(confidenceResamples) || confidenceResamples <= 0) {
  throw new Error('Confidence resamples must be a positive integer.');
}
const input = JSON.parse(await readFile(resolve(process.cwd(), inputPath), 'utf8'));
const evaluated = input.config.budgets.map((budget) => {
  const rows = input.positions.map((position) => positionCounts(position, budget));
  const summary = summarize(rows, `${input.config.seed}|confidence-only|${budget}`, confidenceResamples);
  const phases = Object.fromEntries([...new Set(input.positions.map((position) => position.phase))].map((phase) => {
    const phaseRows = input.positions
      .filter((position) => position.phase === phase)
      .map((position) => positionCounts(position, budget));
    return [phase, {
      clear: addCounts(phaseRows).clear,
      summary: summarize(
        phaseRows,
        `${input.config.seed}|confidence-only|${budget}|${phase}`,
        confidenceResamples,
      ),
    }];
  }));
  return { budget, summary, phases, gate: gate(summary, phases) };
});
const result = {
  generatedAt: new Date().toISOString(),
  source: inputPath,
  study,
  config: {
    seed: input.config.seed,
    positions: input.positions.length,
    repetitions: input.config.repetitions,
    budgets: input.config.budgets,
    referenceBudget: input.config.referenceBudget,
    confidenceResamples,
    practicalGap,
  },
  passed: evaluated.every((entry) => entry.gate.passed),
  budgets: evaluated,
};

console.log(`Confidence-only coach ${study}: ${result.passed ? 'PASS' : 'FAIL'}`);
evaluated.forEach(({ budget, summary, gate: resultGate }) => {
  console.log(`${budget}: ${resultGate.passed ? 'PASS' : 'FAIL'} | clear ${percent(summary.clearRate)} | quality ${percent(summary.clearWithinOnePoint)} | separation ${percent(summary.qualitySeparation)} | repeat ${percent(summary.repeatAgreement)}`);
});

const rows = evaluated.map(({ budget, summary, gate: resultGate }) => `| ${budget} | ${percent(summary.clearRate)} | ${percent(summary.clearWithinOnePoint)} | ${percent(summary.closeWithinOnePoint)} | ${percent(summary.qualitySeparation)} | ${percent(summary.confidenceAgreement)} | ${percent(summary.repeatAgreement)} | ${resultGate.passed ? 'PASS' : 'FAIL'} |`);
const phaseRows = evaluated.flatMap(({ budget, phases }) => (
  Object.entries(phases).map(([phase, result]) => `| ${budget} | ${phase} | ${result.clear} | ${percent(result.summary.clearWithinOnePoint)} |`)
));
const checks = evaluated.flatMap(({ budget, gate: resultGate }) => (
  Object.entries(resultGate.checks).map(([name, passed]) => `| ${budget} | ${name} | ${passed ? 'PASS' : 'FAIL'} |`)
));
const report = `# Mesa Quince confidence-only coach ${study === 'development' ? 'development audit' : 'validation'}

Generated: ${result.generatedAt}

The candidate preserves the existing primary recommendation and all current mistake verdicts. It labels the recommendation clear only when the paired 95% lower advantage over the runner-up exceeds ${practicalGap} points; every other recommendation is a close call.

Overall result: **${result.passed ? 'PASS' : 'FAIL'}**

| Budget | Clear rate | Clear within one point | Close within one point | Quality separation | Reference-confidence agreement | Repeat agreement | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows.join('\n')}

## Phase safety

Each phase must produce at least one clear recommendation, and at least 80% of its clear recommendations must be within one point of the independent reference by point estimate.

| Budget | Phase | Clear trials | Clear within one point |
| ---: | --- | ---: | ---: |
${phaseRows.join('\n')}

## Locked checks

| Budget | Check | Result |
| ---: | --- | --- |
${checks.join('\n')}
`;

if (jsonPath) await writeFile(resolve(process.cwd(), jsonPath), `${JSON.stringify(result, null, 2)}\n`);
if (reportPath) await writeFile(resolve(process.cwd(), reportPath), report);

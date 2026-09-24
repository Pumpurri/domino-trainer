import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { seededRandom } from '../app/domino-engine.ts';

const practicalGap = 1.5;

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function assessment(trial, playedKey) {
  if (trial.coachV2) return trial.coachV2;
  const good = trial.topKey === playedKey || trial.uncertaintyCoach.gap <= practicalGap;
  return {
    primaryKey: trial.topKey,
    recommendationKeys: [trial.topKey],
    recommendationConfidence: !trial.coachV2Evidence.alternative
      || trial.coachV2Evidence.alternative.interval[0] > practicalGap
      ? 'clear'
      : 'uncertain',
    assessment: good
      ? 'acceptable'
      : trial.uncertaintyCoach.assessment === 'mistake'
        ? 'mistake'
        : 'uncertain',
  };
}

function emptyCounts() {
  return {
    trials: 0,
    primaryUnchanged: 0,
    exactlyOneRecommendation: 0,
    falseAccusations: 0,
    currentFalseAccusations: 0,
    falseReassurance: 0,
    labelAgreement: 0,
    decided: 0,
    good: 0,
    goodCorrect: 0,
    mistakes: 0,
    mistakesCorrect: 0,
    uncertain: 0,
    clear: 0,
    clearWithinOnePoint: 0,
    unclear: 0,
    unclearWithinOnePoint: 0,
    confidenceAgreement: 0,
  };
}

function positionCounts(position, budget) {
  const counts = emptyCounts();
  const reference = assessment({
    ...position.reference,
    topKey: position.reference.topKey,
  }, position.playedKey);
  for (const trial of position.budgets[String(budget)].trials) {
    const candidate = assessment(trial, position.playedKey);
    counts.trials += 1;
    counts.primaryUnchanged += candidate.primaryKey === trial.topKey ? 1 : 0;
    counts.exactlyOneRecommendation += candidate.recommendationKeys.length === 1
      && candidate.recommendationKeys[0] === trial.topKey ? 1 : 0;
    counts.falseAccusations += candidate.assessment === 'mistake'
      && reference.assessment !== 'mistake' ? 1 : 0;
    counts.currentFalseAccusations += trial.falsePositiveMistake ? 1 : 0;
    counts.falseReassurance += candidate.assessment === 'acceptable'
      && reference.assessment === 'mistake' ? 1 : 0;
    counts.labelAgreement += candidate.assessment === reference.assessment ? 1 : 0;
    counts.decided += candidate.assessment !== 'uncertain' ? 1 : 0;
    counts.good += candidate.assessment === 'acceptable' ? 1 : 0;
    counts.goodCorrect += candidate.assessment === 'acceptable'
      && reference.assessment === 'acceptable' ? 1 : 0;
    counts.mistakes += candidate.assessment === 'mistake' ? 1 : 0;
    counts.mistakesCorrect += candidate.assessment === 'mistake'
      && reference.assessment === 'mistake' ? 1 : 0;
    counts.uncertain += candidate.assessment === 'uncertain' ? 1 : 0;
    counts.confidenceAgreement += candidate.recommendationConfidence
      === reference.recommendationConfidence ? 1 : 0;
    if (candidate.recommendationConfidence === 'clear') {
      counts.clear += 1;
      counts.clearWithinOnePoint += trial.withinOnePoint ? 1 : 0;
    } else {
      counts.unclear += 1;
      counts.unclearWithinOnePoint += trial.withinOnePoint ? 1 : 0;
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
  return {
    primaryUnchanged: ratio(counts.primaryUnchanged, counts.trials),
    exactlyOneRecommendation: ratio(counts.exactlyOneRecommendation, counts.trials),
    falseAccusations: ratio(counts.falseAccusations, counts.trials),
    currentFalseAccusations: ratio(counts.currentFalseAccusations, counts.trials),
    falseReassurance: ratio(counts.falseReassurance, counts.trials),
    labelAgreement: ratio(counts.labelAgreement, counts.trials),
    decidedCoverage: ratio(counts.decided, counts.trials),
    goodPrecision: ratio(counts.goodCorrect, counts.good),
    mistakePrecision: ratio(counts.mistakesCorrect, counts.mistakes),
    uncertainRate: ratio(counts.uncertain, counts.trials),
    clearRate: ratio(counts.clear, counts.trials),
    clearWithinOnePoint: ratio(counts.clearWithinOnePoint, counts.clear),
    unclearWithinOnePoint: ratio(counts.unclearWithinOnePoint, counts.unclear),
    confidenceAgreement: ratio(counts.confidenceAgreement, counts.trials),
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

function gate(summary) {
  const checks = {
    primaryUnchanged: summary.primaryUnchanged.mean === 1,
    exactlyOneRecommendation: summary.exactlyOneRecommendation.mean === 1,
    falseAccusations: summary.falseAccusations.high <= 0.02,
    noFalseAccusationIncrease: summary.falseAccusations.mean <= summary.currentFalseAccusations.mean,
    falseReassurance: summary.falseReassurance.high <= 0.03,
    goodPrecision: summary.goodPrecision.low >= 0.85,
    mistakePrecision: summary.mistakePrecision.mean >= 0.8,
    labelAgreement: summary.labelAgreement.low >= 0.6,
    decidedCoverage: summary.decidedCoverage.low >= 0.55,
    uncertaintyExercised: summary.uncertainRate.low >= 0.1,
    clearConfidenceExercised: summary.clearRate.low >= 0.1,
    clearRecommendationQuality: summary.clearWithinOnePoint.low >= 0.9,
    confidenceDiscriminates: summary.clearWithinOnePoint.mean >= summary.unclearWithinOnePoint.mean,
    confidenceAgreement: summary.confidenceAgreement.low >= 0.5,
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
  const summary = summarize(rows, `${input.config.seed}|coach-v2|${budget}`, confidenceResamples);
  return { budget, summary, gate: gate(summary) };
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

console.log(`Coach V2 ${study}: ${result.passed ? 'PASS' : 'FAIL'}`);
evaluated.forEach(({ budget, summary, gate: resultGate }) => {
  console.log(`${budget}: ${resultGate.passed ? 'PASS' : 'FAIL'} | labels ${percent(summary.labelAgreement)} | false accusation ${percent(summary.falseAccusations)} | good precision ${percent(summary.goodPrecision)} | clear quality ${percent(summary.clearWithinOnePoint)}`);
});

const rows = evaluated.map(({ budget, summary, gate: resultGate }) => `| ${budget} | ${percent(summary.labelAgreement)} | ${percent(summary.decidedCoverage)} | ${percent(summary.falseAccusations)} | ${percent(summary.falseReassurance)} | ${percent(summary.goodPrecision)} | ${percent(summary.mistakePrecision)} | ${percent(summary.clearRate)} | ${percent(summary.clearWithinOnePoint)} | ${percent(summary.confidenceAgreement)} | ${resultGate.passed ? 'PASS' : 'FAIL'} |`);
const checks = evaluated.flatMap(({ budget, gate: resultGate }) => (
  Object.entries(resultGate.checks).map(([name, passed]) => `| ${budget} | ${name} | ${passed ? 'PASS' : 'FAIL'} |`)
));
const report = `# Mesa Quince Coach V2 ${study === 'development' ? 'development calibration' : 'validation'}

Generated: ${result.generatedAt}

Coach V2 always retains exactly one existing primary recommendation. It labels that recommendation clear only when its paired 95% lower advantage over the runner-up exceeds ${practicalGap} points. The played move is good when it is the primary move or falls within ${practicalGap} estimated points, a likely mistake only under the existing conservative four-batch mistake rule, and uncertain otherwise.

Overall result: **${result.passed ? 'PASS' : 'FAIL'}**

| Budget | Three-way agreement | Decided coverage | False accusation | False reassurance | Good precision | Mistake precision | Clear rate | Clear within one point | Confidence agreement | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows.join('\n')}

## Locked checks

| Budget | Check | Result |
| ---: | --- | --- |
${checks.join('\n')}
`;

if (jsonPath) await writeFile(resolve(process.cwd(), jsonPath), `${JSON.stringify(result, null, 2)}\n`);
if (reportPath) await writeFile(resolve(process.cwd(), reportPath), report);

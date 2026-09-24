import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  const rightSet = new Set(right);
  return [...new Set(left)].filter((value) => rightSet.has(value)).length / union.size;
}

function qualifies(evidence, policy) {
  const alternative = evidence?.alternative;
  if (!alternative || alternative.batchGaps.length !== 4) return false;
  const nearBatchAgreement = average(alternative.batchGaps.map((gap) => (
    gap <= policy.maximumBatchGap ? 1 : 0
  )));
  return alternative.gap <= policy.maximumGap
    && alternative.interval[0] <= policy.maximumLowerBound
    && alternative.topTwoBatchAgreement >= policy.minimumTopTwoBatchAgreement
    && nearBatchAgreement >= policy.minimumNearBatchAgreement;
}

function recommendationKeys(trial, policy) {
  const keys = [trial.topKey];
  if (qualifies(trial.coachV2Evidence, policy)) keys.push(trial.coachV2Evidence.alternative.key);
  return keys;
}

function policies() {
  const rows = [];
  for (const maximumGap of [0.5, 1, 1.5, 2, 3]) {
    for (const maximumLowerBound of [0, 0.5, 1]) {
      for (const minimumTopTwoBatchAgreement of [0.5, 0.75, 1]) {
        for (const maximumBatchGap of [2, 4, 6]) {
          for (const minimumNearBatchAgreement of [0.5, 0.75, 1]) {
            rows.push({
              maximumGap,
              maximumLowerBound,
              minimumTopTwoBatchAgreement,
              maximumBatchGap,
              minimumNearBatchAgreement,
            });
          }
        }
      }
    }
  }
  return rows;
}

function evaluateBudget(input, budget, policy) {
  let trials = 0;
  let secondaryShown = 0;
  let secondaryAccepted = 0;
  let referenceTopCovered = 0;
  let primaryReferenceTop = 0;
  let allLegalWide = 0;
  let wideTrials = 0;
  let pairCount = 0;
  let pairJaccard = 0;
  let secondaryPairCount = 0;
  let secondaryPairAgreement = 0;

  for (const position of input.positions) {
    const positionTrials = position.budgets[String(budget)].trials;
    const sets = positionTrials.map((trial) => recommendationKeys(trial, policy));
    positionTrials.forEach((trial, index) => {
      const keys = sets[index];
      const secondary = keys[1];
      trials += 1;
      primaryReferenceTop += trial.topKey === position.reference.topKey ? 1 : 0;
      referenceTopCovered += keys.includes(position.reference.topKey) ? 1 : 0;
      if (secondary) {
        secondaryShown += 1;
        const referenceBestRate = position.reference.rates[position.reference.topKey];
        const secondaryReferenceRate = position.reference.rates[secondary];
        secondaryAccepted += secondaryReferenceRate !== undefined
          && referenceBestRate - secondaryReferenceRate <= 1 ? 1 : 0;
      }
      if (position.branching >= 3) {
        wideTrials += 1;
        allLegalWide += keys.length >= position.branching ? 1 : 0;
      }
    });
    for (let left = 0; left < sets.length; left += 1) {
      for (let right = left + 1; right < sets.length; right += 1) {
        pairCount += 1;
        pairJaccard += jaccard(sets[left], sets[right]);
        if (sets[left][1] && sets[right][1]) {
          secondaryPairCount += 1;
          secondaryPairAgreement += sets[left][1] === sets[right][1] ? 1 : 0;
        }
      }
    }
  }

  return {
    budget,
    trials,
    secondaryRate: secondaryShown / trials,
    secondaryPrecision: secondaryShown ? secondaryAccepted / secondaryShown : 0,
    correctSecondaryRate: secondaryAccepted / trials,
    incorrectSecondaryRate: (secondaryShown - secondaryAccepted) / trials,
    referenceTopCoverage: referenceTopCovered / trials,
    primaryReferenceTopCoverage: primaryReferenceTop / trials,
    referenceTopCoverageGain: (referenceTopCovered - primaryReferenceTop) / trials,
    meanRecommendationCount: 1 + secondaryShown / trials,
    allLegalWideRate: wideTrials ? allLegalWide / wideTrials : 0,
    pairwiseSetJaccard: pairCount ? pairJaccard / pairCount : 1,
    secondaryPairAgreement: secondaryPairCount ? secondaryPairAgreement / secondaryPairCount : 1,
    secondaryPairs: secondaryPairCount,
  };
}

function passesDevelopment(metrics) {
  return metrics.every((row) => (
    row.secondaryRate >= 0.05
    && row.secondaryRate <= 0.35
    && row.secondaryPrecision >= 0.85
    && row.pairwiseSetJaccard >= 0.7
    && row.secondaryPairAgreement >= 0.7
    && row.allLegalWideRate === 0
    && row.referenceTopCoverage >= row.primaryReferenceTopCoverage
  ));
}

function candidateScore(metrics) {
  return average(metrics.map((row) => (
    row.correctSecondaryRate
    - row.incorrectSecondaryRate * 3
    + row.referenceTopCoverageGain
    + row.secondaryPairAgreement * 0.02
  )));
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

const inputPath = argument('input');
if (!inputPath) throw new Error('--input=PATH is required.');
const jsonPath = argument('json');
const reportPath = argument('report');
const input = JSON.parse(await readFile(resolve(process.cwd(), inputPath), 'utf8'));
if (!input.positions.every((position) => (
  position.reference.coachV2Evidence
  && input.config.budgets.every((budget) => position.budgets[String(budget)].trials.every((trial) => trial.coachV2Evidence))
))) {
  throw new Error('Input does not contain Coach V2 recommendation evidence.');
}

const candidates = policies().map((policy) => {
  const metrics = input.config.budgets.map((budget) => evaluateBudget(input, budget, policy));
  return { policy, metrics, passedDevelopment: passesDevelopment(metrics), score: candidateScore(metrics) };
}).sort((left, right) => (
  Number(right.passedDevelopment) - Number(left.passedDevelopment)
  || right.score - left.score
));
const selected = candidates[0];
const result = {
  generatedAt: new Date().toISOString(),
  source: inputPath,
  config: {
    seed: input.config.seed,
    positions: input.positions.length,
    repetitions: input.config.repetitions,
    budgets: input.config.budgets,
    referenceBudget: input.config.referenceBudget,
    policiesEvaluated: candidates.length,
  },
  selected,
  topCandidates: candidates.slice(0, 20),
};

console.log(`Coach V2 development: ${selected.passedDevelopment ? 'CANDIDATE SELECTED' : 'NO ELIGIBLE CANDIDATE'}`);
console.log(JSON.stringify(selected.policy));
selected.metrics.forEach((row) => {
  console.log(`${row.budget}: secondary ${percent(row.secondaryRate)} | precision ${percent(row.secondaryPrecision)} | coverage +${percent(row.referenceTopCoverageGain)} | repeat ${percent(row.secondaryPairAgreement)}`);
});

const report = `# Mesa Quince Coach V2 development selection

Generated: ${result.generatedAt}

This development pass separates the single primary recommendation from an optional runner-up. The optional move must be close by paired outcome, retain a bounded lower interval, stay near the primary across four interleaved evidence groups, and remain among the top two moves across those groups. The played-move mistake assessment remains the separately conservative uncertainty-aware decision.

The grid evaluated ${candidates.length} policies on the completed 200-position development corpus. A candidate had to show a runner-up on 5% to 35% of trials at both budgets, place at least 85% of shown runner-ups within one estimated win-rate point of the independent 5,000-sample leader, reach at least 70% repeat agreement and set similarity, never recommend every move when at least three were legal, and never reduce reference-top coverage.

Development selection: **${selected.passedDevelopment ? 'CANDIDATE SELECTED' : 'NO ELIGIBLE CANDIDATE'}**

Selected policy:

\`\`\`json
${JSON.stringify(selected.policy, null, 2)}
\`\`\`

| Budget | Runner-up shown | Runner-up precision | Reference-top coverage gain | Pairwise set similarity | Runner-up repeat agreement | Mean recommendations |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${selected.metrics.map((row) => `| ${row.budget} | ${percent(row.secondaryRate)} | ${percent(row.secondaryPrecision)} | ${percent(row.referenceTopCoverageGain)} | ${percent(row.pairwiseSetJaccard)} | ${percent(row.secondaryPairAgreement)} | ${row.meanRecommendationCount.toFixed(2)} |`).join('\n')}
`;

if (jsonPath) await writeFile(resolve(process.cwd(), jsonPath), `${JSON.stringify(result, null, 2)}\n`);
if (reportPath) await writeFile(resolve(process.cwd(), reportPath), report);

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function values(start, end, step) {
  const output = [];
  for (let value = start; value <= end + step / 10; value += step) output.push(Number(value.toFixed(4)));
  return output;
}

function percentage(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function policyKey(policy) {
  return `${policy.practicalGap}|${policy.minimumGap}|${policy.minimumBatchAgreement}|${policy.minimumPracticalBatchAgreement}`;
}

function assessTrial(trial, reference, policy) {
  const confidentMistake = !trial.playedInPlausibleBest
    && trial.choiceGap >= policy.minimumGap
    && trial.choiceInterval[0] > policy.practicalGap
    && trial.choiceBatchAgreement >= policy.minimumBatchAgreement
    && trial.choicePracticalBatchAgreement >= policy.minimumPracticalBatchAgreement;
  const decided = confidentMistake || trial.mistakeAssessment === 'acceptable';
  const correct = confidentMistake === reference.confidentMistake;
  return {
    confidentMistake,
    decided,
    correct,
    falsePositive: confidentMistake && !reference.confidentMistake,
    falseNegative: !confidentMistake && reference.confidentMistake,
    decidedCorrect: decided && correct,
  };
}

function evaluatePolicy(positions, policy) {
  const assessed = positions.flatMap((position) => position.adaptive.trials.map((trial) => (
    assessTrial(trial, position.reference, policy)
  )));
  const count = assessed.length;
  const decided = assessed.filter((trial) => trial.decided);
  const mistakeCalls = assessed.filter((trial) => trial.confidentMistake);
  return {
    policy,
    trials: count,
    labelAgreement: assessed.filter((trial) => trial.correct).length / count,
    falsePositiveRate: assessed.filter((trial) => trial.falsePositive).length / count,
    falseNegativeRate: assessed.filter((trial) => trial.falseNegative).length / count,
    abstentionRate: 1 - decided.length / count,
    decidedAccuracy: decided.length
      ? decided.filter((trial) => trial.decidedCorrect).length / decided.length
      : 0,
    mistakePrecision: mistakeCalls.length
      ? mistakeCalls.filter((trial) => !trial.falsePositive).length / mistakeCalls.length
      : 1,
  };
}

const input = resolve(argument('input') ?? 'outputs/adaptive-v2-development-80.json');
const output = argument('json') ? resolve(argument('json')) : null;
const report = JSON.parse(await readFile(input, 'utf8'));
if (!report.config?.seed?.includes('development')) {
  throw new Error('Label calibration is restricted to a development-seed report. Never tune on a held-out or frozen result.');
}
if (!report.positions?.length || report.positions.some((position) => !position.adaptive?.trials?.length)) {
  throw new Error('The input report does not contain adaptive trials.');
}

const candidates = [];
for (const practicalGap of values(0.5, 3, 0.5)) {
  for (const minimumGap of values(3, 7, 1)) {
    for (const minimumBatchAgreement of [0.6, 0.75, 0.8, 1]) {
      for (const minimumPracticalBatchAgreement of [0.5, 0.6, 0.75, 1]) {
        candidates.push(evaluatePolicy(report.positions, {
          practicalGap,
          minimumGap,
          minimumBatchAgreement,
          minimumPracticalBatchAgreement,
        }));
      }
    }
  }
}

const unique = [...new Map(candidates.map((candidate) => [policyKey(candidate.policy), candidate])).values()];
const eligible = unique.filter((candidate) => candidate.falsePositiveRate <= 0.02);
const ranked = (eligible.length ? eligible : unique).sort((left, right) => (
  right.labelAgreement - left.labelAgreement
  || left.falsePositiveRate - right.falsePositiveRate
  || right.decidedAccuracy - left.decidedAccuracy
  || left.abstentionRate - right.abstentionRate
  || left.policy.minimumGap - right.policy.minimumGap
));
const best = ranked[0];

console.log('MESA QUINCE ADAPTIVE LABEL CALIBRATION');
console.log(`Development report: ${input}`);
console.log(`Positions: ${report.positions.length} | Trials: ${best.trials}`);
console.log('Only the coaching-label policy is tuned. Move ranking and stopping are unchanged.');
console.log('\nTop development policies');
console.log('Practical gap | Minimum gap | Batch agreement | Practical agreement | Label agreement | False positives | False negatives | Abstention | Decided accuracy | Mistake precision');
console.log('--- | --- | --- | --- | --- | --- | --- | --- | --- | ---');
ranked.slice(0, 10).forEach((candidate) => {
  const policy = candidate.policy;
  console.log(`${policy.practicalGap} | ${policy.minimumGap} | ${percentage(policy.minimumBatchAgreement)} | ${percentage(policy.minimumPracticalBatchAgreement)} | ${percentage(candidate.labelAgreement)} | ${percentage(candidate.falsePositiveRate)} | ${percentage(candidate.falseNegativeRate)} | ${percentage(candidate.abstentionRate)} | ${percentage(candidate.decidedAccuracy)} | ${percentage(candidate.mistakePrecision)}`);
});

console.log('\nSelected development policy');
console.log(JSON.stringify(best, null, 2));
console.log('\nThis selection must be locked before running the new held-out 400-position study.');

if (output) {
  await writeFile(output, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: input,
    sourceSeed: report.config.seed,
    selected: best,
    candidates: ranked,
  }, null, 2)}\n`);
  console.log(`Saved calibration results to ${output}`);
}

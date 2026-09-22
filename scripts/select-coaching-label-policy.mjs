import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_ADAPTIVE_MISTAKE_POLICY } from '../app/adaptive-analysis.ts';
import {
  coachingLabelGate,
  evaluateCoachingLabelPolicy,
  MATERIAL_MISTAKE_TARGET,
  SELECTIVE_LABEL_GATE,
} from './coaching-label-policy.mjs';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const input = resolve(argument('input') ?? 'outputs/adaptive-v3-development-200.json');
const output = argument('json') ? resolve(argument('json')) : null;
const source = JSON.parse(await readFile(input, 'utf8'));
if (!source.config?.seed?.includes('development')) {
  throw new Error('Policy selection requires a development seed, never a held-out result.');
}
if (!source.positions?.length || source.positions.some((position) => (
  !position.adaptive?.trials?.length
  || position.adaptive.trials.some((trial) => !Array.isArray(trial.choiceBatchGaps))
))) throw new Error('Development results need complete adaptive trials with independent batch gaps.');

const candidates = [];
for (const practicalGap of [0.5, 1, 1.5]) {
  for (const minimumGap of [3, 3.5, 4]) {
    for (const minimumBatchAgreement of [0.6, 0.75, 0.8]) {
      for (const minimumPracticalBatchAgreement of [0.5, 0.6, 0.75]) {
        const policy = { practicalGap, minimumGap, minimumBatchAgreement, minimumPracticalBatchAgreement };
        const result = evaluateCoachingLabelPolicy(source.positions, policy);
        candidates.push({ ...result, gate: coachingLabelGate(result) });
      }
    }
  }
}
const baselinePolicy = Object.fromEntries(
  ['practicalGap', 'minimumGap', 'minimumBatchAgreement', 'minimumPracticalBatchAgreement']
    .map((key) => [key, DEFAULT_ADAPTIVE_MISTAKE_POLICY[key]]),
);
const baseline = evaluateCoachingLabelPolicy(source.positions, baselinePolicy);
const eligible = candidates.filter(({ gate }) => gate.passed);
const distance = (policy) => Object.keys(baselinePolicy)
  .reduce((sum, key) => sum + Math.abs(policy[key] - baselinePolicy[key]), 0);
eligible.sort((left, right) => (
  right.rates.mistakeRecall - left.rates.mistakeRecall
  || left.rates.falseAccusation - right.rates.falseAccusation
  || right.rates.decidedAccuracy - left.rates.decidedAccuracy
  || right.rates.coverage - left.rates.coverage
  || distance(left.policy) - distance(right.policy)
));
const selected = eligible[0] ?? { ...baseline, gate: coachingLabelGate(baseline) };
const selection = {
  sourceSeed: source.config.seed,
  sourcePositions: source.positions.length,
  target: MATERIAL_MISTAKE_TARGET,
  gate: SELECTIVE_LABEL_GATE,
  baseline,
  eligibleCandidates: eligible.length,
  selected,
  promotionRecommended: eligible.length > 0 && selected.rates.mistakeRecall > baseline.rates.mistakeRecall,
  topCandidates: eligible.slice(0, 10),
};
console.log(JSON.stringify(selection, null, 2));
if (output) await writeFile(output, `${JSON.stringify(selection, null, 2)}\n`);

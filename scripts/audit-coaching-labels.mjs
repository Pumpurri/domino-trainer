import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { summarizeCoachingLabels } from './coaching-label-audit.mjs';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const input = resolve(argument('input') ?? 'benchmarks/adaptive-v2-holdout-400.json');
const source = JSON.parse(await readFile(input, 'utf8'));
if (!source.positions?.length || source.positions.some((position) => !position.adaptive?.trials?.length)) {
  throw new Error('The input must contain completed adaptive reliability positions.');
}
const audit = summarizeCoachingLabels(
  source.positions,
  source.config.adaptiveMistakePolicy,
  source.config.adaptiveStages.at(-1),
);
const percent = (value) => `${(100 * value).toFixed(1)}%`;
const rows = Object.entries(audit.counts).map(([label, count]) => `| ${label} | ${count} | ${percent(count / audit.trials)} |`);
const causes = Object.entries(audit.uncertainMistakeCauses)
  .map(([label, count]) => `| ${label} | ${count} |`);
const report = `# Coaching-label disagreement audit

Source: \`${relative(process.cwd(), input)}\`
Reference: one independent ${source.config.referenceBudget}-sample analysis. Its mistake rule is less conservative than the adaptive rule; it is not ground truth.

${audit.positions} positions, ${audit.trials} independent adaptive trials.

| Outcome | Trials | Share |
| --- | ---: | ---: |
${rows.join('\n')}

- False accusations: ${percent(audit.rates.falseAccusation)} of all trials.
- Confident misses: ${percent(audit.rates.confidentMiss)} of all trials.
- Explicit uncertainty: ${percent(audit.rates.abstention)} of all trials.
- Correct among decided trials: ${percent(audit.rates.decidedAccuracy)} (pooled, not position-weighted).
- Detected reference mistakes: ${percent(audit.rates.referenceMistakeRecall)}; abstained on ${percent(audit.rates.referenceMistakeAbstention)}.

## Reasons an uncertain call disagreed with the reference

These conditions overlap and should not be summed. A gap below the threshold may also have a wide interval.

| Condition | Trials |
| --- | ---: |
${causes.join('\n')}

The frozen holdout is diagnostic only. Do not select a policy or revise a release threshold from these cases; use development data and a fresh holdout.
`;
console.log(report);
if (argument('json')) await writeFile(resolve(argument('json')), `${JSON.stringify(audit, null, 2)}\n`);
if (argument('report')) await writeFile(resolve(argument('report')), report);

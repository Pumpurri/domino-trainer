import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { evaluateCoachingLabelPolicy, v3ReleaseGate } from './coaching-label-policy.mjs';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const input = resolve(argument('input') ?? 'outputs/adaptive-v3-holdout-400.json');
const source = JSON.parse(await readFile(input, 'utf8'));
if (!source.config?.seed?.includes('holdout-v1') || !source.config.seed.includes('adaptive-v3')) {
  throw new Error('V3 release evaluation requires the frozen V3 holdout-v1 seed.');
}
if (source.config.adaptiveVersion !== 'adaptive-confirmed-v3-labels') {
  throw new Error(`Unexpected adaptive implementation ${source.config.adaptiveVersion}.`);
}
if (source.positions?.length !== 400) throw new Error('V3 release evaluation requires all 400 held-out positions.');
const labelResult = evaluateCoachingLabelPolicy(source.positions, source.config.adaptiveMistakePolicy);
const gate = v3ReleaseGate(source.summary, labelResult, source.positions.length);
const percent = (value) => `${(100 * value).toFixed(1)}%`;
const checks = Object.entries(gate.checks).map(([key, value]) => `| ${key} | ${value ? 'PASS' : 'FAIL'} |`);
const report = `# Mesa Quince V3 held-out release evaluation

Source: \`${relative(process.cwd(), input)}\`

Result: **${gate.passed ? 'PASS' : 'FAIL'}**. ${gate.passed ? 'V3 is eligible for controlled live integration.' : 'V3 must remain outside the live coach.'}

## Selective coaching labels

- Resolved reference positions: ${labelResult.resolvedPositions}/${labelResult.positions}
- Reference material mistakes: ${labelResult.referenceMistakes}
- Decided coverage: ${percent(labelResult.rates.coverage)}
- Material-mistake recall: ${percent(labelResult.rates.mistakeRecall)}
- Accuracy among decided labels: ${percent(labelResult.rates.decidedAccuracy)}
- False accusations: ${percent(labelResult.rates.falseAccusation)}
- Confident misses: ${percent(labelResult.rates.confidentMiss)}
- Explicit abstention: ${percent(labelResult.rates.abstention)}

## Release checks

| Check | Result |
| --- | --- |
${checks.join('\n')}
`;
console.log(report);
const result = { generatedAt: new Date().toISOString(), source: relative(process.cwd(), input), labelResult, gate };
if (argument('json')) await writeFile(resolve(argument('json')), `${JSON.stringify(result, null, 2)}\n`);
if (argument('report')) await writeFile(resolve(argument('report')), report);

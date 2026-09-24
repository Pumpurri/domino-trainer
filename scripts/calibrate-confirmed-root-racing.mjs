import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  CONFIRMED_ROOT_RACING_CALIBRATION_GRID,
  evaluateConfirmedRootRacingGrid,
} from './confirmed-root-racing-calibration-core.mjs';

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

function checks(checksByName) {
  return Object.entries(checksByName).filter(([, passed]) => !passed).map(([name]) => name).join(', ') || 'none';
}

function renderReport(result) {
  const rows = result.candidates.map(({ config, summary, diagnostics }) => (
    `| ${config.id} | ${percent(summary.selectionChangeRate)} | ${percent(summary.candidate.withinOnePoint)} | ${percent(summary.effect.withinOnePoint)} | ${points(summary.effect.meanRegret)} | ${percent(summary.candidate.referenceBestSurvival)} | ${percent(summary.effect.falsePositiveMistake)} | ${percent(summary.postDecisionOverheadRatio)} | ${diagnostics.confirmedEliminations} | ${summary.gate.passed ? 'PASS' : 'FAIL'} |`
  ));
  const failures = result.candidates.map(({ config, summary }) => (
    `- ${config.id}: ${checks(summary.gate.checks)}`
  )).join('\n');
  return `# Mesa Quince confirmed root-racing calibration

Generated: ${new Date().toISOString()}

## Protocol

Five predeclared confirmation policies were replayed against the exact saved V2 belief weights and paired outcomes. No games, beliefs, or references were resimulated. Every policy retains the locked 40-sample first stage, combined 60-sample statistical test, top-three protection, 120-per-move total recommendation budget, 120-sample finalist floor, and targeted post-play label confirmation.

The grid changes only the fresh confirmation requirement:

- strict-20: both fresh 10-sample mini-batches must favor the leader.
- nonnegative-20: at least one fresh mini-batch must favor the leader and neither may oppose it.
- directional-20: the combined fresh 20-sample result must favor the leader, with at least one favorable mini-batch.
- three-of-four-40: at least three of four fresh 10-sample mini-batches must favor the leader.
- majority-40: at least two of four fresh 10-sample mini-batches must favor the leader.

Candidates are ranked first by the complete locked V2 gate, then by within-one improvement, regret reduction, reference survival, and stable id. Development calibration cannot release a policy. A selected policy must be frozen before a fresh holdout.

## Results

| Candidate | Changes | Within 1 point | Within-1 delta | Regret delta | Ref-best survival | False-positive delta | Post-play overhead | Eliminations | Gate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows.join('\n')}

Selected candidate: **${result.selectedCandidate ?? 'none'}**

Overall calibration gate: **${result.gate.passed ? 'PASS' : 'FAIL'}**

## Failed checks

${failures}
`;
}

const inputArgument = argument('input') ?? 'benchmarks/confirmed-root-racing-development-v2-24.json';
const inputPath = resolve(process.cwd(), inputArgument);
const jsonPath = argument('json');
const reportPath = argument('report');
const confidenceResamples = positiveInteger(argument('confidence-resamples'), 2000, 'Confidence resamples');
const seed = argument('seed') ?? 'mesa-quince-confirmed-root-racing-calibration-v1';
const source = JSON.parse(await readFile(inputPath, 'utf8'));
const result = evaluateConfirmedRootRacingGrid(source, {
  configs: CONFIRMED_ROOT_RACING_CALIBRATION_GRID,
  rootBudget: source.config.rootBudget,
  confidenceResamples,
  seed,
});

console.log('MESA QUINCE CONFIRMED ROOT-RACING CALIBRATION');
for (const candidate of result.candidates) {
  console.log(`${candidate.config.id}: changes ${percent(candidate.summary.selectionChangeRate)}, within-1 delta ${percent(candidate.summary.effect.withinOnePoint)}, regret delta ${points(candidate.summary.effect.meanRegret)}, survival ${percent(candidate.summary.candidate.referenceBestSurvival)}, gate ${candidate.summary.gate.passed ? 'PASS' : 'FAIL'}`);
}
console.log(`Selected candidate: ${result.selectedCandidate ?? 'none'}`);

const output = {
  generatedAt: new Date().toISOString(),
  input: inputArgument,
  seed,
  confidenceResamples,
  result,
};
if (jsonPath) {
  const destination = resolve(process.cwd(), jsonPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Saved calibration data to ${destination}`);
}
if (reportPath) {
  const destination = resolve(process.cwd(), reportPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, renderReport(result));
  console.log(`Saved calibration report to ${destination}`);
}

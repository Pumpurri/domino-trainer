import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function signed(value, digits = 3) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

const inputArgument = argument('input') ?? 'benchmarks/adaptive-v6-development-200.json';
const inputPath = resolve(inputArgument);
const jsonPath = resolve(argument('json') ?? 'benchmarks/adaptive-v6-changed-trials.json');
const reportPath = resolve(argument('report') ?? 'benchmarks/adaptive-v6-changed-trials.md');
const input = JSON.parse(await readFile(inputPath, 'utf8'));
const changes = [];

for (const position of input.positions.filter(({ phase }) => phase === 'middle')) {
  const candidateTrials = position.adaptiveSamplingVariants?.['phase-aware']?.trials ?? [];
  position.adaptive.trials.forEach((control, repetition) => {
    const candidate = candidateTrials[repetition];
    if (!candidate || control.topKey === candidate.topKey) return;
    const regretChange = candidate.regret - control.regret;
    changes.push({
      positionId: position.id,
      repetition,
      branching: position.branching,
      handSizes: position.handSizes,
      eventCount: position.eventCount,
      referenceTopKey: position.reference.topKey,
      acceptableTopKeys: position.reference.acceptableTopKeys,
      controlTopKey: control.topKey,
      candidateTopKey: candidate.topKey,
      controlRegret: control.regret,
      candidateRegret: candidate.regret,
      regretChange,
      outcome: regretChange < 0 ? 'improved' : regretChange > 0 ? 'harmed' : 'tied',
      controlWithinOnePoint: control.withinOnePoint,
      candidateWithinOnePoint: candidate.withinOnePoint,
      controlSamples: control.samplesUsed,
      candidateSamples: candidate.samplesUsed,
      controlStopReason: control.stopReason,
      candidateStopReason: candidate.stopReason,
      controlStageLeaders: control.stages.map(({ topKey }) => topKey),
      candidateStageLeaders: candidate.stages.map(({ topKey }) => topKey),
      controlRecommendationKeys: control.recommendationKeys,
      candidateRecommendationKeys: candidate.recommendationKeys,
    });
  });
}

const count = (outcome) => changes.filter((change) => change.outcome === outcome).length;
const regretChange = changes.reduce((sum, change) => sum + change.regretChange, 0) / Math.max(1, changes.length);
const positionsChanged = new Set(changes.map(({ positionId }) => positionId)).size;
const byBranching = Object.fromEntries([...new Set(changes.map(({ branching }) => branching))]
  .sort((left, right) => left - right)
  .map((branching) => {
    const rows = changes.filter((change) => change.branching === branching);
    return [branching, {
      trials: rows.length,
      improved: rows.filter(({ outcome }) => outcome === 'improved').length,
      harmed: rows.filter(({ outcome }) => outcome === 'harmed').length,
      tied: rows.filter(({ outcome }) => outcome === 'tied').length,
      meanRegretChange: rows.reduce((sum, row) => sum + row.regretChange, 0) / rows.length,
    }];
  }));
const summary = {
  source: inputArgument,
  seed: input.config.seed,
  middleTrials: input.summary.adaptiveByPhase.middle.trials,
  changedTrials: changes.length,
  changedPositions: positionsChanged,
  improved: count('improved'),
  harmed: count('harmed'),
  tied: count('tied'),
  meanRegretChange: regretChange,
  totalRegretChange: changes.reduce((sum, change) => sum + change.regretChange, 0),
  byBranching,
};
const output = { generatedAt: new Date().toISOString(), summary, changes };

const rows = changes
  .sort((left, right) => right.regretChange - left.regretChange || left.positionId.localeCompare(right.positionId))
  .map((change) => (
    `| ${change.positionId} | ${change.repetition + 1} | ${change.branching} | ${change.controlTopKey} | ${change.candidateTopKey} | ${change.referenceTopKey} | ${change.controlRegret.toFixed(2)} | ${change.candidateRegret.toFixed(2)} | ${signed(change.regretChange, 2)} | ${change.outcome} |`
  ));
const stageRows = changes
  .sort((left, right) => left.positionId.localeCompare(right.positionId) || left.repetition - right.repetition)
  .map((change) => (
    `| ${change.positionId} | ${change.repetition + 1} | ${change.controlStageLeaders.join(' → ')} | ${change.candidateStageLeaders.join(' → ')} |`
  ));
const report = `# Adaptive V6 changed-trial forensic report

Generated: ${output.generatedAt}

## Summary

- Middle-game trials: ${summary.middleTrials}
- Changed trials: ${summary.changedTrials} across ${summary.changedPositions} positions
- Improved: ${summary.improved}
- Harmed: ${summary.harmed}
- Tied: ${summary.tied}
- Mean reference-regret change on changed trials: ${signed(summary.meanRegretChange)}
- Total reference-regret change: ${signed(summary.totalRegretChange)}

This report is diagnostic. It uses the opened V6 development corpus to explain the rejected candidate and cannot serve as future release evidence.

## Changed decisions

| Position | Repeat | Legal moves | Control | Candidate | Reference | Control regret | Candidate regret | Change | Outcome |
| --- | ---: | ---: | --- | --- | --- | ---: | ---: | ---: | --- |
${rows.join('\n')}

## Stage leader paths

| Position | Repeat | Independent-stage control | Persistent-pool candidate |
| --- | ---: | --- | --- |
${stageRows.join('\n')}
`;

await mkdir(dirname(jsonPath), { recursive: true });
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(output, null, 2)}\n`);
await writeFile(reportPath, report);
console.log(`Changed ${summary.changedTrials}/${summary.middleTrials} middle-game trials across ${summary.changedPositions} positions.`);
console.log(`${summary.improved} improved, ${summary.harmed} harmed, ${summary.tied} tied; mean regret change ${signed(summary.meanRegretChange)}.`);
console.log(`Saved ${jsonPath}`);
console.log(`Saved ${reportPath}`);

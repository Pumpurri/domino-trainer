import { seededRandom } from '../app/domino-engine.ts';

export const ANALYZER_ROLLOUT_VERSION = 'analyzer-rollout-v1';
export const ANALYZER_ROLLOUT_POLICIES = ['current', 'exhaustive-forecast'];
export const ANALYZER_ROLLOUT_PHASES = ['opening', 'middle', 'late', 'block'];

function percentile(sorted, probability) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function interval(values, seed, resamples) {
  if (!values.length) return { mean: 0, low: 0, high: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length < 2 || resamples <= 0) return { mean, low: mean, high: mean };
  const random = seededRandom(seed);
  const estimates = [];
  for (let sample = 0; sample < resamples; sample += 1) {
    let total = 0;
    for (let draw = 0; draw < values.length; draw += 1) {
      total += values[Math.floor(random() * values.length)];
    }
    estimates.push(total / values.length);
  }
  estimates.sort((left, right) => left - right);
  return {
    mean,
    low: percentile(estimates, 0.025),
    high: percentile(estimates, 0.975),
  };
}

function positionTrialValues(results, policy, read) {
  return results.map((position) => {
    const trials = position.policies[policy].trials;
    return trials.reduce((sum, trial) => sum + read(trial), 0) / trials.length;
  });
}

function policySummary(results, policy, seed, resamples) {
  const metric = (label, read) => interval(
    positionTrialValues(results, policy, read),
    `${seed}|${policy}|${label}`,
    resamples,
  );
  const exactPositions = results.filter(({ exactOracleKeys }) => exactOracleKeys);
  return {
    positions: results.length,
    trials: results.reduce((sum, position) => sum + position.policies[policy].trials.length, 0),
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    mistakeLabelAgreement: metric('mistake-label', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistakes: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    falseNegativeMistakes: metric('false-negative', (trial) => trial.falseNegativeMistake ? 1 : 0),
    repeatAcceptability: interval(
      results.map((position) => position.policies[policy].trials.every((trial) => trial.withinOnePoint) ? 1 : 0),
      `${seed}|${policy}|repeat-acceptable`,
      resamples,
    ),
    samplesUsed: metric('samples', (trial) => trial.samplesUsed),
    runtimeMs: metric('runtime', (trial) => trial.elapsedMs),
    exactOracleAgreement: exactPositions.length
      ? interval(
        exactPositions.map((position) => {
          const trials = position.policies[policy].trials;
          return trials.filter((trial) => trial.exactOracleAgreement).length / trials.length;
        }),
        `${seed}|${policy}|exact-oracle`,
        resamples,
      )
      : null,
  };
}

function pairedPositionValues(results, read) {
  return results.map((position) => (
    position.paired.reduce((sum, pair, index) => sum + read(
      pair,
      position.policies.current.trials[index],
      position.policies['exhaustive-forecast'].trials[index],
    ), 0) / position.paired.length
  ));
}

function pairedSummary(results, seed, resamples) {
  const metric = (label, read, source = results) => interval(
    pairedPositionValues(source, read),
    `${seed}|paired|${label}`,
    resamples,
  );
  const exactPositions = results.filter(({ exactOracleKeys }) => exactOracleKeys);
  return {
    selectionChangeRate: metric('selection-change', (pair) => pair.selectionChanged ? 1 : 0),
    ownWithinOneDifference: metric(
      'own-within-one-difference',
      (_pair, control, candidate) => (candidate.withinOnePoint ? 1 : 0) - (control.withinOnePoint ? 1 : 0),
    ),
    ownRegretDifference: metric(
      'own-regret-difference',
      (_pair, control, candidate) => candidate.regret - control.regret,
    ),
    repeatAcceptabilityDifference: interval(
      results.map((position) => (
        (position.policies['exhaustive-forecast'].trials.every((trial) => trial.withinOnePoint) ? 1 : 0)
        - (position.policies.current.trials.every((trial) => trial.withinOnePoint) ? 1 : 0)
      )),
      `${seed}|paired|repeat-acceptable-difference`,
      resamples,
    ),
    mistakeLabelAgreementDifference: metric(
      'mistake-label-difference',
      (_pair, control, candidate) => (
        (candidate.mistakeLabelAgreement ? 1 : 0) - (control.mistakeLabelAgreement ? 1 : 0)
      ),
    ),
    falsePositiveDifference: metric(
      'false-positive-difference',
      (_pair, control, candidate) => (
        (candidate.falsePositiveMistake ? 1 : 0) - (control.falsePositiveMistake ? 1 : 0)
      ),
    ),
    robustRegretDifference: metric(
      'robust-regret-difference',
      (pair) => pair.candidateRobustRegret - pair.controlRobustRegret,
    ),
    worstRegretDifference: metric(
      'worst-regret-difference',
      (pair) => pair.candidateWorstRegret - pair.controlWorstRegret,
    ),
    bothReferencesWithinOneDifference: metric(
      'both-references-within-one-difference',
      (pair) => (
        (pair.candidateWithinOneOnBoth ? 1 : 0) - (pair.controlWithinOneOnBoth ? 1 : 0)
      ),
    ),
    sampleDifference: metric(
      'sample-difference',
      (_pair, control, candidate) => candidate.samplesUsed - control.samplesUsed,
    ),
    runtimeDifferenceMs: metric(
      'runtime-difference',
      (_pair, control, candidate) => candidate.elapsedMs - control.elapsedMs,
    ),
    exactOracleAgreementDifference: exactPositions.length
      ? metric(
        'exact-oracle-difference',
        (_pair, control, candidate) => (
          (candidate.exactOracleAgreement ? 1 : 0) - (control.exactOracleAgreement ? 1 : 0)
        ),
        exactPositions,
      )
      : null,
  };
}

export function analyzerRolloutPromotionGate(summary) {
  const control = summary.policies.current;
  const candidate = summary.policies['exhaustive-forecast'];
  const comparison = summary.comparison;
  const checks = {
    changesDecisions: comparison.selectionChangeRate.mean >= 0.05,
    withinOnePointTarget: candidate.withinOnePoint.mean >= 0.9,
    meanRegretTarget: candidate.meanRegret.mean <= 1,
    mistakeLabelAgreementTarget: candidate.mistakeLabelAgreement.mean >= 0.95,
    falsePositiveTarget: candidate.falsePositiveMistakes.mean <= 0.02,
    repeatAcceptabilityTarget: candidate.repeatAcceptability.mean >= 0.9,
    ownWithinOneNoninferior: comparison.ownWithinOneDifference.mean >= -0.01,
    ownRegretNoninferior: comparison.ownRegretDifference.mean <= 0.02,
    repeatAcceptabilityNoninferior: comparison.repeatAcceptabilityDifference.mean >= 0,
    labelsPreserved: comparison.mistakeLabelAgreementDifference.mean >= 0,
    falseAccusationsPreserved: comparison.falsePositiveDifference.mean <= 0,
    robustRegretImproves: comparison.robustRegretDifference.mean <= 0,
    robustRegretUpperBound: comparison.robustRegretDifference.high <= 0.1,
    crossReferenceAcceptability: comparison.bothReferencesWithinOneDifference.mean >= -0.01,
    phaseRobustness: ANALYZER_ROLLOUT_PHASES.every((phase) => (
      summary.byPhase[phase].comparison.robustRegretDifference.mean <= 0.1
    )),
    exactOraclePreserved: !comparison.exactOracleAgreementDifference
      || comparison.exactOracleAgreementDifference.mean >= -0.02,
    sampleUseControlled: candidate.samplesUsed.mean <= control.samplesUsed.mean * 1.05,
    runtimeControlled: candidate.runtimeMs.mean <= control.runtimeMs.mean * 1.75,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function summarizeAnalyzerRollout(results, {
  seed = 'mesa-quince-analyzer-rollout-v1',
  confidenceResamples = 1000,
} = {}) {
  const summarizeGroup = (group, label) => ({
    positions: group.length,
    policies: Object.fromEntries(ANALYZER_ROLLOUT_POLICIES.map((policy) => [
      policy,
      policySummary(group, policy, `${seed}|${label}`, confidenceResamples),
    ])),
    comparison: pairedSummary(group, `${seed}|${label}`, confidenceResamples),
    referenceAgreement: interval(
      group.map((position) => (
        position.references.current.topKey === position.references['exhaustive-forecast'].topKey ? 1 : 0
      )),
      `${seed}|${label}|reference-agreement`,
      confidenceResamples,
    ),
  });
  const overall = summarizeGroup(results, 'overall');
  const summary = {
    version: ANALYZER_ROLLOUT_VERSION,
    positions: results.length,
    phaseCounts: Object.fromEntries(ANALYZER_ROLLOUT_PHASES.map((phase) => [
      phase,
      results.filter((position) => position.phase === phase).length,
    ])),
    ...overall,
    byPhase: Object.fromEntries(ANALYZER_ROLLOUT_PHASES.map((phase) => [
      phase,
      summarizeGroup(results.filter((position) => position.phase === phase), phase),
    ])),
  };
  return { ...summary, gate: analyzerRolloutPromotionGate(summary) };
}

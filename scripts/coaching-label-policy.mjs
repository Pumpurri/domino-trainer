export const MATERIAL_MISTAKE_TARGET = Object.freeze({ minimumGap: 4, practicalGap: 1.5 });
export const SELECTIVE_LABEL_GATE = Object.freeze({
  minimumResolvedPositions: 160,
  minimumReferenceMistakes: 20,
  minimumCoverage: 0.7,
  minimumMistakeRecall: 0.7,
  minimumDecidedAccuracy: 0.97,
  maximumFalseAccusation: 0.01,
  maximumConfidentMiss: 0.01,
});

export function referenceLabel(reference) {
  if (reference.gap >= MATERIAL_MISTAKE_TARGET.minimumGap
    && reference.interval[0] > MATERIAL_MISTAKE_TARGET.practicalGap) return 'mistake';
  if (reference.gap === 0 || reference.interval[1] < MATERIAL_MISTAKE_TARGET.minimumGap) return 'acceptable';
  return 'uncertain';
}

export function replayCoachingLabel(trial, playedKey, policy) {
  if (!Array.isArray(trial.choiceBatchGaps) || trial.choiceBatchGaps.length < 2) {
    throw new Error('Independent batch gaps are required for policy replay. Regenerate the development corpus.');
  }
  if (trial.topKey === playedKey || (trial.playedInPlausibleBest && trial.choiceInterval[1] <= policy.practicalGap)) {
    return 'acceptable';
  }
  if (trial.playedInPlausibleBest) return 'uncertain';
  const agreement = trial.choiceBatchGaps.filter((gap) => gap > 0).length / trial.choiceBatchGaps.length;
  const practicalAgreement = trial.choiceBatchGaps.filter((gap) => gap > policy.practicalGap).length / trial.choiceBatchGaps.length;
  return trial.choiceGap >= policy.minimumGap
    && trial.choiceInterval[0] > policy.practicalGap
    && agreement >= policy.minimumBatchAgreement
    && practicalAgreement >= policy.minimumPracticalBatchAgreement
    ? 'mistake'
    : 'uncertain';
}

export function evaluateCoachingLabelPolicy(positions, policy) {
  const counts = {
    detectedMistake: 0,
    falseAccusation: 0,
    confidentMiss: 0,
    correctAcceptable: 0,
    uncertainMistake: 0,
    uncertainAcceptable: 0,
    referenceUncertain: 0,
  };
  let resolvedPositions = 0;
  let referenceMistakes = 0;
  for (const position of positions) {
    const target = referenceLabel(position.reference);
    if (target !== 'uncertain') resolvedPositions += 1;
    if (target === 'mistake') referenceMistakes += 1;
    for (const trial of position.adaptive.trials) {
      const label = replayCoachingLabel(trial, position.playedKey, policy);
      if (target === 'uncertain') counts.referenceUncertain += 1;
      else if (target === 'mistake' && label === 'mistake') counts.detectedMistake += 1;
      else if (target === 'mistake' && label === 'acceptable') counts.confidentMiss += 1;
      else if (target === 'mistake') counts.uncertainMistake += 1;
      else if (label === 'mistake') counts.falseAccusation += 1;
      else if (label === 'acceptable') counts.correctAcceptable += 1;
      else counts.uncertainAcceptable += 1;
    }
  }
  const resolvedTrials = Object.values(counts).reduce((sum, value) => sum + value, 0) - counts.referenceUncertain;
  const decided = counts.detectedMistake + counts.falseAccusation + counts.confidentMiss + counts.correctAcceptable;
  return {
    policy,
    positions: positions.length,
    resolvedPositions,
    referenceMistakes,
    resolvedTrials,
    counts,
    rates: {
      coverage: decided / (resolvedTrials || 1),
      mistakeRecall: counts.detectedMistake / ((counts.detectedMistake + counts.confidentMiss + counts.uncertainMistake) || 1),
      decidedAccuracy: (counts.detectedMistake + counts.correctAcceptable) / (decided || 1),
      falseAccusation: counts.falseAccusation / (resolvedTrials || 1),
      confidentMiss: counts.confidentMiss / (resolvedTrials || 1),
      abstention: (counts.uncertainMistake + counts.uncertainAcceptable) / (resolvedTrials || 1),
    },
  };
}

export function coachingLabelGate(result, thresholds = SELECTIVE_LABEL_GATE) {
  const checks = {
    resolvedPositions: result.resolvedPositions >= thresholds.minimumResolvedPositions,
    referenceMistakes: result.referenceMistakes >= thresholds.minimumReferenceMistakes,
    coverage: result.rates.coverage >= thresholds.minimumCoverage,
    mistakeRecall: result.rates.mistakeRecall >= thresholds.minimumMistakeRecall,
    decidedAccuracy: result.rates.decidedAccuracy >= thresholds.minimumDecidedAccuracy,
    falseAccusation: result.rates.falseAccusation <= thresholds.maximumFalseAccusation,
    confidentMiss: result.rates.confidentMiss <= thresholds.maximumConfidentMiss,
  };
  return { passed: Object.values(checks).every(Boolean), checks, thresholds };
}

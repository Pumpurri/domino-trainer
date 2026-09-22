export function labelOutcome(trial, reference) {
  if (trial.mistakeAbstained) return reference.confidentMistake ? 'uncertain-mistake' : 'uncertain-acceptable';
  if (trial.mistakeAssessment === 'mistake' || trial.confidentMistake) {
    return reference.confidentMistake ? 'detected-mistake' : 'false-accusation';
  }
  return reference.confidentMistake ? 'confident-miss' : 'correct-acceptable';
}

export function summarizeCoachingLabels(positions, policy = {
  practicalGap: 1.5,
  minimumGap: 4,
  minimumBatchAgreement: 0.75,
  minimumPracticalBatchAgreement: 0.5,
}, hardCap = 2000) {
  const counts = {
    'detected-mistake': 0,
    'false-accusation': 0,
    'confident-miss': 0,
    'correct-acceptable': 0,
    'uncertain-mistake': 0,
    'uncertain-acceptable': 0,
  };
  const uncertainMistakeCauses = {
    atCap: 0,
    belowMinimumGap: 0,
    lowerBoundNotPractical: 0,
    lowBatchAgreement: 0,
    lowPracticalAgreement: 0,
    playedInPlausibleBest: 0,
    referenceBelowMinimumGap: 0,
    referenceLowerBoundNotPractical: 0,
  };
  const byPhase = {};
  const examples = [];
  for (const position of positions) {
    const phase = byPhase[position.phase] ??= Object.fromEntries(Object.keys(counts).map((key) => [key, 0]));
    for (const trial of position.adaptive.trials) {
      const outcome = labelOutcome(trial, position.reference);
      counts[outcome] += 1;
      phase[outcome] += 1;
      if (outcome !== 'uncertain-mistake') continue;
      if (trial.samplesUsed === hardCap) uncertainMistakeCauses.atCap += 1;
      if (trial.choiceGap < policy.minimumGap) uncertainMistakeCauses.belowMinimumGap += 1;
      if (trial.choiceInterval[0] <= policy.practicalGap) uncertainMistakeCauses.lowerBoundNotPractical += 1;
      if (trial.choiceBatchAgreement < policy.minimumBatchAgreement) uncertainMistakeCauses.lowBatchAgreement += 1;
      if (trial.choicePracticalBatchAgreement < policy.minimumPracticalBatchAgreement) uncertainMistakeCauses.lowPracticalAgreement += 1;
      if (trial.playedInPlausibleBest) uncertainMistakeCauses.playedInPlausibleBest += 1;
      if (position.reference.gap < policy.minimumGap) uncertainMistakeCauses.referenceBelowMinimumGap += 1;
      if (position.reference.interval[0] <= policy.practicalGap) uncertainMistakeCauses.referenceLowerBoundNotPractical += 1;
      examples.push({
        id: position.id,
        repetition: trial.repetition,
        referenceGap: position.reference.gap,
        estimatedGap: trial.choiceGap,
        estimatedInterval: trial.choiceInterval,
        samplesUsed: trial.samplesUsed,
      });
    }
  }
  const trials = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const referenceMistakes = counts['detected-mistake'] + counts['confident-miss'] + counts['uncertain-mistake'];
  const decided = trials - counts['uncertain-mistake'] - counts['uncertain-acceptable'];
  return {
    positions: positions.length,
    trials,
    policy,
    counts,
    byPhase,
    uncertainMistakeCauses,
    rates: {
      falseAccusation: counts['false-accusation'] / trials,
      confidentMiss: counts['confident-miss'] / trials,
      abstention: (trials - decided) / trials,
      decidedAccuracy: (counts['detected-mistake'] + counts['correct-acceptable']) / (decided || 1),
      referenceMistakeRecall: counts['detected-mistake'] / (referenceMistakes || 1),
      referenceMistakeAbstention: counts['uncertain-mistake'] / (referenceMistakes || 1),
    },
    examples,
  };
}

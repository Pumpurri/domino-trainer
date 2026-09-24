import {
  CONFIRMED_ROOT_RACING_CONFIG,
  CONFIRMED_ROOT_RACING_ID,
  confirmedChoiceAssessment,
  deserializeRootRacingTrace,
  replayConfirmedRootRace,
  summarizeConfirmedRootRacing,
} from './confirmed-root-racing-core.mjs';

export const CONFIRMED_ROOT_RACING_CALIBRATION_VERSION = 'confirmed-root-racing-calibration-v1';
export const CONFIRMED_ROOT_RACING_CALIBRATION_GRID = [
  {
    ...CONFIRMED_ROOT_RACING_CONFIG,
    id: 'strict-20',
  },
  {
    ...CONFIRMED_ROOT_RACING_CONFIG,
    id: 'nonnegative-20',
    minimumFreshPositiveBatchAgreement: 0.5,
    minimumFreshNonnegativeBatchAgreement: 1,
  },
  {
    ...CONFIRMED_ROOT_RACING_CONFIG,
    id: 'directional-20',
    minimumFreshPositiveBatchAgreement: 0.5,
    minimumFreshNonnegativeBatchAgreement: 0.5,
  },
  {
    ...CONFIRMED_ROOT_RACING_CONFIG,
    id: 'three-of-four-40',
    confirmationSamples: 40,
    confirmationBatches: 4,
    minimumFreshPositiveBatchAgreement: 0.75,
    minimumFreshNonnegativeBatchAgreement: 0.75,
  },
  {
    ...CONFIRMED_ROOT_RACING_CONFIG,
    id: 'majority-40',
    confirmationSamples: 40,
    confirmationBatches: 4,
    minimumFreshPositiveBatchAgreement: 0.5,
    minimumFreshNonnegativeBatchAgreement: 0.5,
  },
];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

function evaluatedCandidate(fullRanked, raced, position, rootBudget) {
  const topKey = moveKey(raced.ranked[0]);
  const referenceRate = position.reference.rates[topKey];
  if (referenceRate === undefined) throw new Error(`Reference rates are missing candidate move ${topKey}.`);
  const bestRate = Math.max(...Object.values(position.reference.rates));
  const choice = confirmedChoiceAssessment(fullRanked, topKey, position.playedKey, rootBudget);
  const chosenAllocation = raced.allocations[position.playedKey];
  const postDecisionEvaluations = raced.eliminatedKeys.includes(position.playedKey)
    ? Math.max(0, rootBudget - chosenAllocation)
    : 0;
  return {
    topKey,
    exactTopAgreement: topKey === position.reference.topKey,
    acceptableTopAgreement: position.reference.acceptableTopKeys.includes(topKey),
    withinOnePoint: bestRate - referenceRate <= 1,
    regret: Math.max(0, bestRate - referenceRate),
    verdict: choice.verdict,
    mistakeLabelAgreement: choice.confidentMistake === position.reference.confidentMistake,
    falsePositiveMistake: choice.confidentMistake && !position.reference.confidentMistake,
    selectedSamples: raced.ranked[0].samples,
    selectedEffectiveSamples: raced.ranked[0].effectiveSamples,
    rootEvaluations: raced.rootEvaluations,
    postDecisionEvaluations,
    referenceBestSurvived: raced.survivorKeys.includes(position.reference.topKey),
    minimumSurvivorSamples: raced.minimumSurvivorSamples,
    survivorCount: raced.survivorKeys.length,
    survivorKeys: raced.survivorKeys,
    eliminatedKeys: raced.eliminatedKeys,
    provisionalEliminatedKeys: raced.provisionalEliminatedKeys,
    allocations: raced.allocations,
    confirmations: raced.confirmations,
  };
}

function replayCandidate(source, config, rootBudget) {
  return source.positions.map((position) => ({
    ...position,
    trials: position.trials.map((trial) => {
      const fullRanked = deserializeRootRacingTrace(trial.replay);
      const raced = replayConfirmedRootRace(fullRanked, config, rootBudget);
      return {
        repetition: trial.repetition,
        variants: {
          'control-120': trial.variants['control-120'],
          'ceiling-500': trial.variants['ceiling-500'],
          [CONFIRMED_ROOT_RACING_ID]: evaluatedCandidate(fullRanked, raced, position, rootBudget),
        },
      };
    }),
  }));
}

function diagnostics(positions) {
  let provisionalEliminations = 0;
  let confirmedEliminations = 0;
  let changedRecommendations = 0;
  let postDecisionEvaluations = 0;
  const referenceSurvivalFailures = [];
  for (const position of positions) {
    for (const trial of position.trials) {
      const control = trial.variants['control-120'];
      const candidate = trial.variants[CONFIRMED_ROOT_RACING_ID];
      provisionalEliminations += candidate.provisionalEliminatedKeys.length;
      confirmedEliminations += candidate.eliminatedKeys.length;
      postDecisionEvaluations += candidate.postDecisionEvaluations;
      if (candidate.topKey !== control.topKey) changedRecommendations += 1;
      if (!candidate.referenceBestSurvived) {
        referenceSurvivalFailures.push({
          position: position.id,
          repetition: trial.repetition,
          referenceKey: position.reference.topKey,
          controlKey: control.topKey,
          candidateKey: candidate.topKey,
          controlRegret: control.regret,
          candidateRegret: candidate.regret,
          provisionalEliminatedKeys: candidate.provisionalEliminatedKeys,
          eliminatedKeys: candidate.eliminatedKeys,
        });
      }
    }
  }
  return {
    trials: positions.reduce((sum, position) => sum + position.trials.length, 0),
    provisionalEliminations,
    confirmedEliminations,
    changedRecommendations,
    postDecisionEvaluations,
    referenceSurvivalFailures,
  };
}

function candidateOrder(left, right) {
  return Number(right.summary.gate.passed) - Number(left.summary.gate.passed)
    || right.summary.effect.withinOnePoint.mean - left.summary.effect.withinOnePoint.mean
    || left.summary.effect.meanRegret.mean - right.summary.effect.meanRegret.mean
    || right.summary.candidate.referenceBestSurvival.mean - left.summary.candidate.referenceBestSurvival.mean
    || left.config.id.localeCompare(right.config.id);
}

export function evaluateConfirmedRootRacingGrid(source, {
  configs = CONFIRMED_ROOT_RACING_CALIBRATION_GRID,
  rootBudget = 120,
  confidenceResamples = 1000,
  seed = 'mesa-quince-confirmed-root-racing-calibration-v1',
} = {}) {
  if (!source?.positions?.length) throw new Error('Calibration requires saved root-racing positions.');
  const candidates = configs.map((config) => {
    const positions = replayCandidate(source, config, rootBudget);
    return {
      config,
      summary: summarizeConfirmedRootRacing(positions, {
        seed: `${seed}|${config.id}`,
        confidenceResamples,
        rootBudget,
      }),
      diagnostics: diagnostics(positions),
    };
  });
  const ranked = [...candidates].sort(candidateOrder);
  const selected = ranked.find(({ summary }) => summary.gate.passed) ?? null;
  return {
    version: CONFIRMED_ROOT_RACING_CALIBRATION_VERSION,
    sourceVersion: source.config?.version,
    sourceSeed: source.config?.seed,
    rootBudget,
    candidates,
    ranking: ranked.map(({ config }) => config.id),
    selectedCandidate: selected?.config.id ?? null,
    gate: { passed: Boolean(selected) },
  };
}

import {
  analyzeMoves,
  mergeMoveAnalyses,
  seededRandom,
} from '../app/domino-engine.ts';
import {
  pairedRatedMoveDifference,
  plausibleBestMoveKeys,
} from '../app/adaptive-analysis.ts';
import {
  classifyAnalyzedChoice,
  informationSafeBenchmarkGame,
} from './analyzer-reliability-core.mjs';
import {
  collectRootRacingCorpus,
} from './root-racing-core.mjs';
import { beliefForBudget } from './stratified-sampling-core.mjs';

export const TARGETED_CONFIRMATION_VERSION = 'targeted-systematic-confirmation-development-v1';
export const TARGETED_CONFIRMATION_CONTROL = 'control-120';
export const TARGETED_CONFIRMATION_CANDIDATES = [
  { id: 'confirm-40', samples: 40 },
  { id: 'confirm-80', samples: 80 },
  { id: 'confirm-120', samples: 120 },
];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

function rankMoves(moves) {
  return [...moves].sort((left, right) => (
    right.winRate - left.winRate
    || right.lookahead.score - left.lookahead.score
    || right.heuristic - left.heuristic
    || moveKey(left).localeCompare(moveKey(right))
  ));
}

export function collectTargetedConfirmationCorpus(options = {}) {
  return collectRootRacingCorpus({
    openingPositions: options.positions ?? 24,
    safetyPositions: 0,
    openingMinimumBranching: options.minimumBranching ?? 6,
    seed: options.seed ?? 'mesa-quince-targeted-confirmation-v1',
    maxDeals: options.maxDeals,
  });
}

function timedAnalysis(game, sampled, budget, options = {}) {
  const started = performance.now();
  const ranked = analyzeMoves(game, sampled.target, sampled.belief, undefined, {
    representativeLimit: budget,
    representativePoolSize: options.poolSize ?? budget,
    rootCandidateKeys: options.rootCandidateKeys,
    extraTreeSearch: 'disabled',
  });
  return { ranked, elapsedMs: performance.now() - started };
}

function independentAnalysis(game, budget, seedSalt) {
  const sampled = beliefForBudget(game, budget, seedSalt);
  return timedAnalysis(game, sampled, budget);
}

function evaluatedVariant(ranked, recommendationKey, position, reference, metadata = {}) {
  const recommendation = ranked.find((move) => moveKey(move) === recommendationKey);
  const played = ranked.find((move) => moveKey(move) === position.playedKey);
  if (!recommendation || !played) {
    throw new Error('Targeted confirmation is missing the recommendation or played move.');
  }
  const compared = rankMoves([recommendation, ...(recommendationKey === position.playedKey ? [] : [played])]);
  const referenceRate = reference.rates.get(recommendationKey);
  if (referenceRate === undefined) throw new Error(`Reference analysis is missing ${recommendationKey}.`);
  const choice = classifyAnalyzedChoice(compared, position.playedKey);
  return {
    topKey: recommendationKey,
    exactTopAgreement: recommendationKey === reference.topKey,
    acceptableTopAgreement: reference.acceptableKeys.includes(recommendationKey),
    withinOnePoint: reference.bestRate - referenceRate <= 1,
    regret: Math.max(0, reference.bestRate - referenceRate),
    verdict: choice.verdict,
    mistakeLabelAgreement: choice.confidentMistake === reference.choice.confidentMistake,
    falsePositiveMistake: choice.confidentMistake && !reference.choice.confidentMistake,
    selectedSamples: recommendation.samples,
    selectedEffectiveSamples: recommendation.effectiveSamples,
    playedSamples: played.samples,
    equalDecisionEvidence: recommendation.samples === played.samples,
    ...metadata,
  };
}

function targetedVariant(baseRanked, confirmationRanked, position, reference, {
  baseBudget,
  confirmationSamples,
  confirmationKeys,
  leaderKeys,
  triggered,
  baseElapsedMs,
  confirmationElapsedMs,
}) {
  const merged = triggered
    ? mergeMoveAnalyses([baseRanked, confirmationRanked])
    : baseRanked;
  const eligible = rankMoves(merged.filter((move) => leaderKeys.includes(moveKey(move))));
  const recommendationKey = moveKey(eligible[0]);
  const totalEvaluations = baseBudget * baseRanked.length
    + (triggered ? confirmationSamples * confirmationKeys.length : 0);
  return evaluatedVariant(merged, recommendationKey, position, reference, {
    triggered,
    initialLeaderKeys: leaderKeys,
    confirmationKeys: triggered ? confirmationKeys : [],
    confirmationSamples: triggered ? confirmationSamples : 0,
    recommendationEvaluations: totalEvaluations,
    overheadRatio: triggered
      ? confirmationSamples * confirmationKeys.length / (baseBudget * baseRanked.length)
      : 0,
    referenceBestCovered: !triggered || confirmationKeys.includes(reference.topKey),
    elapsedMs: baseElapsedMs + (triggered ? confirmationElapsedMs : 0),
  });
}

export async function evaluateTargetedConfirmationPosition(position, {
  repetitions = 5,
  baseBudget = 120,
  referenceBudget = 5000,
  closeGap = 3,
  recommendationPracticalGap = 1,
  candidates = TARGETED_CONFIRMATION_CANDIDATES,
  seed = 'mesa-quince-targeted-confirmation-v1',
} = {}) {
  if (position.phase !== 'opening' || position.branching < 6) {
    throw new Error(`Position ${position.id} is outside the targeted-confirmation scope.`);
  }
  const safeGame = informationSafeBenchmarkGame(position.game);
  const references = [0, 1].map((index) => independentAnalysis(
    safeGame,
    referenceBudget,
    `${seed}|${position.id}|reference-${index + 1}`,
  ));
  const referenceRanked = mergeMoveAnalyses(references.map(({ ranked }) => ranked));
  const reference = {
    topKey: moveKey(referenceRanked[0]),
    acceptableKeys: plausibleBestMoveKeys(
      referenceRanked,
      references.map(({ ranked }) => ranked),
      recommendationPracticalGap,
    ),
    rates: new Map(referenceRanked.map((move) => [moveKey(move), move.winRate])),
    bestRate: referenceRanked[0].winRate,
    choice: classifyAnalyzedChoice(referenceRanked, position.playedKey),
  };

  const maximumConfirmation = Math.max(...candidates.map(({ samples }) => samples));
  const trials = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const baseSampled = beliefForBudget(
      safeGame,
      baseBudget,
      `${seed}|${position.id}|repeat-${repetition}|base`,
    );
    const base = timedAnalysis(safeGame, baseSampled, baseBudget);
    const leaderKeys = base.ranked.slice(0, 2).map(moveKey);
    const initialDifference = pairedRatedMoveDifference(base.ranked[0], base.ranked[1]);
    const triggered = initialDifference.gap <= closeGap;
    const confirmationKeys = [...new Set([...leaderKeys, position.playedKey])];
    const confirmationSampled = triggered
      ? beliefForBudget(
        safeGame,
        maximumConfirmation,
        `${seed}|${position.id}|repeat-${repetition}|fresh-confirmation`,
      )
      : null;

    const control = evaluatedVariant(
      base.ranked,
      moveKey(base.ranked[0]),
      position,
      reference,
      {
        triggered,
        initialLeaderKeys: leaderKeys,
        confirmationKeys: [],
        confirmationSamples: 0,
        recommendationEvaluations: baseBudget * base.ranked.length,
        overheadRatio: 0,
        referenceBestCovered: true,
        elapsedMs: base.elapsedMs,
      },
    );
    const variants = { [TARGETED_CONFIRMATION_CONTROL]: control };
    for (const candidate of candidates) {
      let confirmation = { ranked: [], elapsedMs: 0 };
      if (triggered) {
        confirmation = timedAnalysis(safeGame, confirmationSampled, candidate.samples, {
          poolSize: maximumConfirmation,
          rootCandidateKeys: confirmationKeys,
        });
      }
      variants[candidate.id] = targetedVariant(
        base.ranked,
        confirmation.ranked,
        position,
        reference,
        {
          baseBudget,
          confirmationSamples: candidate.samples,
          confirmationKeys,
          leaderKeys,
          triggered,
          baseElapsedMs: base.elapsedMs,
          confirmationElapsedMs: confirmation.elapsedMs,
        },
      );
    }
    trials.push({
      repetition,
      initialGap: initialDifference.gap,
      initialInterval: initialDifference.interval,
      variants,
    });
  }

  return {
    id: position.id,
    group: position.group,
    phase: position.phase,
    branching: position.branching,
    handSizes: position.game.hands.map((hand) => hand.length),
    eventCount: position.game.events.length,
    playedKey: position.playedKey,
    reference: {
      budgetPerRun: referenceBudget,
      combinedSamples: referenceRanked[0].samples,
      topKey: reference.topKey,
      acceptableTopKeys: reference.acceptableKeys,
      independentTopKeys: references.map(({ ranked }) => moveKey(ranked[0])),
      independentTopAgreement: moveKey(references[0].ranked[0]) === moveKey(references[1].ranked[0]),
      verdict: reference.choice.verdict,
      confidentMistake: reference.choice.confidentMistake,
      elapsedMs: references.reduce((sum, result) => sum + result.elapsedMs, 0),
    },
    trials,
  };
}

function percentile(sorted, probability) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function interval(values, seed, resamples) {
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
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
  return { mean, low: percentile(estimates, 0.025), high: percentile(estimates, 0.975) };
}

function positionMeans(positions, variant, read) {
  return positions.map((position) => {
    const values = position.trials.map((trial) => read(trial.variants[variant]));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

function summarizeVariant(positions, variant, seed, resamples) {
  const metric = (label, read) => interval(
    positionMeans(positions, variant, read),
    `${seed}|${variant}|${label}`,
    resamples,
  );
  return {
    exactTopAgreement: metric('exact-top', (trial) => trial.exactTopAgreement ? 1 : 0),
    acceptableTopAgreement: metric('acceptable-top', (trial) => trial.acceptableTopAgreement ? 1 : 0),
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    mistakeLabelAgreement: metric('label', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistake: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    selectedSamples: metric('selected-samples', (trial) => trial.selectedSamples),
    selectedEffectiveSamples: metric('effective-samples', (trial) => trial.selectedEffectiveSamples),
    overheadRatio: metric('overhead', (trial) => trial.overheadRatio),
    elapsedMs: metric('elapsed', (trial) => trial.elapsedMs),
    referenceBestCoverage: metric('reference-coverage', (trial) => trial.referenceBestCovered ? 1 : 0),
    repeatAcceptability: interval(positions.map((position) => (
      position.trials.every((trial) => trial.variants[variant].withinOnePoint) ? 1 : 0
    )), `${seed}|${variant}|repeat-acceptable`, resamples),
    repeatTopStability: interval(positions.map((position) => (
      new Set(position.trials.map((trial) => trial.variants[variant].topKey)).size === 1 ? 1 : 0
    )), `${seed}|${variant}|repeat-top`, resamples),
  };
}

function summarizeEffect(positions, candidate, seed, resamples) {
  const metric = (label, read) => interval(positions.map((position) => {
    const values = position.trials.map((trial) => (
      read(trial.variants[candidate]) - read(trial.variants[TARGETED_CONFIRMATION_CONTROL])
    ));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }), `${seed}|${candidate}|effect|${label}`, resamples);
  return {
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    mistakeLabelAgreement: metric('label', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistake: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    selectedEffectiveSamples: metric('effective-samples', (trial) => trial.selectedEffectiveSamples),
    repeatAcceptability: interval(positions.map((position) => {
      const candidateValue = position.trials.every((trial) => trial.variants[candidate].withinOnePoint) ? 1 : 0;
      const controlValue = position.trials.every((trial) => trial.variants[TARGETED_CONFIRMATION_CONTROL].withinOnePoint) ? 1 : 0;
      return candidateValue - controlValue;
    }), `${seed}|${candidate}|effect|repeat-acceptable`, resamples),
  };
}

function candidateGate(positions, candidate, result, baseBudget) {
  const tolerance = 1e-12;
  const checks = {
    closeDecisionsExercised: result.triggerRate.mean >= 0.20 - tolerance,
    recommendationChanges: result.selectionChangeRate.mean >= 0.05 - tolerance,
    withinOnePointImproves: result.effect.withinOnePoint.mean > 0,
    regretImproves: result.effect.meanRegret.mean < 0,
    repeatAcceptabilityNoninferior: result.effect.repeatAcceptability.mean >= -tolerance,
    labelsPreserved: result.effect.mistakeLabelAgreement.mean >= -0.01 - tolerance,
    falsePositivesDoNotIncrease: result.effect.falsePositiveMistake.mean <= tolerance,
    referenceBestCoverage: result.candidate.referenceBestCoverage.mean >= 0.95 - tolerance,
    selectedEvidenceIncreases: result.effect.selectedEffectiveSamples.mean > 0,
    overheadControlled: result.candidate.overheadRatio.mean <= 0.30 + tolerance,
    exactAndEqualDecisionEvidence: positions.every((position) => position.trials.every((trial) => {
      const value = trial.variants[candidate];
      if (!value.triggered) return value.selectedSamples === baseBudget && value.playedSamples === baseBudget;
      return value.equalDecisionEvidence
        && value.selectedSamples === baseBudget + value.confirmationSamples
        && value.playedSamples === baseBudget + value.confirmationSamples;
    })),
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function summarizeTargetedConfirmation(positions, {
  seed = 'mesa-quince-targeted-confirmation-v1',
  confidenceResamples = 1000,
  baseBudget = 120,
  candidates = TARGETED_CONFIRMATION_CANDIDATES,
} = {}) {
  const control = summarizeVariant(
    positions,
    TARGETED_CONFIRMATION_CONTROL,
    `${seed}|control`,
    confidenceResamples,
  );
  const triggerRate = interval(positions.map((position) => (
    position.trials.filter((trial) => trial.variants[TARGETED_CONFIRMATION_CONTROL].triggered).length
      / position.trials.length
  )), `${seed}|trigger-rate`, confidenceResamples);
  const results = {};
  for (const candidate of candidates) {
    const candidateSummary = summarizeVariant(positions, candidate.id, `${seed}|${candidate.id}`, confidenceResamples);
    const effect = summarizeEffect(positions, candidate.id, seed, confidenceResamples);
    const selectionChangeRate = interval(positions.map((position) => (
      position.trials.filter((trial) => (
        trial.variants[candidate.id].topKey !== trial.variants[TARGETED_CONFIRMATION_CONTROL].topKey
      )).length / position.trials.length
    )), `${seed}|${candidate.id}|selection-change`, confidenceResamples);
    const result = { candidate: candidateSummary, effect, selectionChangeRate, triggerRate };
    result.gate = candidateGate(positions, candidate.id, result, baseBudget);
    results[candidate.id] = result;
  }
  const passing = candidates.map(({ id }) => id).filter((id) => results[id].gate.passed)
    .sort((left, right) => (
      results[left].effect.meanRegret.mean - results[right].effect.meanRegret.mean
      || results[right].effect.withinOnePoint.mean - results[left].effect.withinOnePoint.mean
      || results[left].candidate.overheadRatio.mean - results[right].candidate.overheadRatio.mean
    ));
  return {
    version: TARGETED_CONFIRMATION_VERSION,
    positions: positions.length,
    baseBudget,
    triggerRate,
    control,
    candidates: results,
    selectedCandidate: passing[0] ?? null,
    gate: { passed: passing.length > 0 },
  };
}

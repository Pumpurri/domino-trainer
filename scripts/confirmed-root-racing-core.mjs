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
  rankedMovePrefix,
  ratedMoveWindow,
  selectRootRacingSurvivors,
} from './root-racing-core.mjs';
import { beliefForBudget } from './stratified-sampling-core.mjs';

export const CONFIRMED_ROOT_RACING_VERSION = 'confirmed-root-racing-development-v2';
export const CONFIRMED_ROOT_RACING_ID = 'confirmed-race-40';
export const CONFIRMED_ROOT_RACING_CONFIG = {
  id: CONFIRMED_ROOT_RACING_ID,
  initialSamples: 40,
  confirmationSamples: 20,
  minimumSurvivors: 3,
  practicalGap: 1,
  minimumGap: 3,
  batches: 4,
  minimumPositiveBatchAgreement: 0.75,
  minimumPracticalBatchAgreement: 0.5,
  confirmationBatches: 2,
  minimumFreshGap: 1,
};
export const CONFIRMED_ROOT_RACING_ROOT_BUDGET = 120;
export const CONFIRMED_ROOT_RACING_CEILING_BUDGET = 500;

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

function moveForKey(moves, key) {
  const move = moves.find((candidate) => moveKey(candidate) === key);
  if (!move) throw new Error(`Root-racing trace is missing legal move ${key}.`);
  return move;
}

function batchGaps(better, candidate, batches) {
  const count = Math.min(better.samples, candidate.samples);
  return Array.from({ length: batches }, (_, batchIndex) => {
    const start = Math.floor(batchIndex * count / batches);
    const end = Math.floor((batchIndex + 1) * count / batches);
    if (end <= start) return 0;
    return pairedRatedMoveDifference(
      ratedMoveWindow(better, start, end),
      ratedMoveWindow(candidate, start, end),
    ).gap;
  });
}

function validateConfig(config, rootBudget) {
  if (!Number.isInteger(rootBudget) || rootBudget <= 0) {
    throw new Error('Confirmed root-racing budget must be a positive integer.');
  }
  if (!Number.isInteger(config.confirmationSamples) || config.confirmationSamples <= 0) {
    throw new Error('Confirmed root racing needs a positive confirmation batch.');
  }
  if (config.initialSamples + config.confirmationSamples > rootBudget) {
    throw new Error('Confirmation cannot exceed the fixed per-move root budget.');
  }
  if (!Number.isInteger(config.confirmationBatches) || config.confirmationBatches < 2) {
    throw new Error('Confirmation needs at least two fresh mini-batches.');
  }
}

export function confirmedRootRacingEnabled(phase, branching) {
  return phase === 'opening' && branching >= 6;
}

function confirmationEvidence(fullRanked, leaderKey, candidateKey, config) {
  const combinedSamples = config.initialSamples + config.confirmationSamples;
  const leader = moveForKey(fullRanked, leaderKey);
  const candidate = moveForKey(fullRanked, candidateKey);
  const combinedLeader = ratedMoveWindow(leader, 0, combinedSamples);
  const combinedCandidate = ratedMoveWindow(candidate, 0, combinedSamples);
  const freshLeader = ratedMoveWindow(leader, config.initialSamples, combinedSamples);
  const freshCandidate = ratedMoveWindow(candidate, config.initialSamples, combinedSamples);
  const combined = pairedRatedMoveDifference(combinedLeader, combinedCandidate);
  const fresh = pairedRatedMoveDifference(freshLeader, freshCandidate);
  const freshBatchGaps = batchGaps(freshLeader, freshCandidate, config.confirmationBatches);
  const confirmed = combined.gap >= config.minimumGap
    && combined.interval[0] > config.practicalGap
    && fresh.gap > config.minimumFreshGap
    && freshBatchGaps.every((gap) => gap > 0);
  return {
    key: candidateKey,
    confirmed,
    combinedGap: combined.gap,
    combinedInterval: combined.interval,
    freshGap: fresh.gap,
    freshInterval: fresh.interval,
    freshBatchGaps,
  };
}

function waterFillAllocations(counts, survivorKeys, remaining) {
  const ordered = [...survivorKeys].sort();
  while (remaining > 0) {
    const minimum = Math.min(...ordered.map((key) => counts.get(key)));
    const lowest = ordered.filter((key) => counts.get(key) === minimum);
    for (const key of lowest) {
      if (remaining <= 0) break;
      counts.set(key, counts.get(key) + 1);
      remaining -= 1;
    }
  }
}

export function replayConfirmedRootRace(
  fullRanked,
  config = CONFIRMED_ROOT_RACING_CONFIG,
  rootBudget = CONFIRMED_ROOT_RACING_ROOT_BUDGET,
) {
  validateConfig(config, rootBudget);
  if (fullRanked.length < 2) throw new Error('Confirmed root racing requires at least two legal moves.');
  const combinedSamples = config.initialSamples + config.confirmationSamples;
  if (fullRanked.some((move) => move.samples < Math.max(rootBudget, combinedSamples))) {
    throw new Error('Confirmed root-racing trace is too short.');
  }
  const provisional = selectRootRacingSurvivors(fullRanked, config, rootBudget);
  const leaderKey = moveKey(provisional.firstStage[0]);
  const confirmationKeys = provisional.eliminatedKeys.length
    ? [...new Set([leaderKey, ...provisional.eliminatedKeys])]
    : [];
  const confirmations = provisional.eliminatedKeys.map((candidateKey) => (
    confirmationEvidence(fullRanked, leaderKey, candidateKey, config)
  ));
  const eliminatedKeys = confirmations.filter(({ confirmed }) => confirmed).map(({ key }) => key).sort();
  const eliminatedSet = new Set(eliminatedKeys);
  const survivorKeys = fullRanked.map(moveKey).filter((key) => !eliminatedSet.has(key));
  const counts = new Map(fullRanked.map((move) => [moveKey(move), config.initialSamples]));
  confirmationKeys.forEach((key) => counts.set(key, combinedSamples));
  const rootEvaluations = rootBudget * fullRanked.length;
  const spentBeforeRefinement = [...counts.values()].reduce((sum, samples) => sum + samples, 0);
  if (spentBeforeRefinement > rootEvaluations) {
    throw new Error('Confirmed root racing spent more than its fixed root budget before refinement.');
  }
  waterFillAllocations(counts, survivorKeys, rootEvaluations - spentBeforeRefinement);
  const byKey = new Map(fullRanked.map((move) => [moveKey(move), move]));
  const survivors = rankMoves(survivorKeys.map((key) => (
    ratedMoveWindow(byKey.get(key), 0, counts.get(key))
  )));
  const eliminated = rankMoves(eliminatedKeys.map((key) => (
    ratedMoveWindow(byKey.get(key), 0, counts.get(key))
  )));
  const spent = [...counts.values()].reduce((sum, samples) => sum + samples, 0);
  if (spent !== rootEvaluations) {
    throw new Error(`Confirmed root race spent ${spent} evaluations instead of ${rootEvaluations}.`);
  }
  const minimumSurvivorSamples = Math.min(...survivors.map(({ samples }) => samples));
  if (minimumSurvivorSamples < rootBudget) {
    throw new Error('Confirmed root racing left a finalist below the current 120-sample evidence floor.');
  }
  return {
    ranked: [...survivors, ...eliminated],
    survivorKeys,
    eliminatedKeys,
    provisionalEliminatedKeys: provisional.eliminatedKeys,
    leaderKey,
    confirmationKeys,
    confirmations,
    allocations: Object.fromEntries([...counts].sort()),
    rootEvaluations,
    minimumSurvivorSamples,
  };
}

export function confirmedChoiceAssessment(
  fullRanked,
  recommendationKey,
  playedKey,
  samples = CONFIRMED_ROOT_RACING_ROOT_BUDGET,
) {
  const keys = [...new Set([recommendationKey, playedKey])];
  const compared = rankMoves(keys.map((key) => ratedMoveWindow(moveForKey(fullRanked, key), 0, samples)));
  return classifyAnalyzedChoice(compared, playedKey);
}

export function serializeRootRacingTrace(ranked) {
  if (!ranked.length) throw new Error('Cannot serialize an empty root-racing trace.');
  const weights = ranked[0].treeSearch.pairedBaseWeights;
  for (const move of ranked) {
    const candidateWeights = move.treeSearch.pairedBaseWeights;
    if (candidateWeights.length !== weights.length
      || candidateWeights.some((weight, index) => weight !== weights[index])) {
      throw new Error('Root-racing trace moves must share one paired weight sequence.');
    }
  }
  return {
    weights,
    moves: ranked.map((move) => ({
      tile: move.tile,
      side: move.side,
      placedLeft: move.placedLeft,
      placedRight: move.placedRight,
      newLeft: move.newLeft,
      newRight: move.newRight,
      heuristic: move.heuristic,
      lookahead: move.lookahead,
      retainedEndMatches: move.evidence.retainedEndMatches,
      wins: move.treeSearch.pairedBaseWins.map((won) => won ? '1' : '0').join(''),
    })),
  };
}

export function deserializeRootRacingTrace(trace) {
  return rankMoves(trace.moves.map((saved) => {
    const wins = [...saved.wins].map((value) => Number(value));
    if (wins.length !== trace.weights.length) {
      throw new Error(`Serialized move ${saved.tile.id}:${saved.side} has a mismatched outcome count.`);
    }
    const base = {
      tile: saved.tile,
      side: saved.side,
      placedLeft: saved.placedLeft,
      placedRight: saved.placedRight,
      newLeft: saved.newLeft,
      newRight: saved.newRight,
      samples: wins.length,
      effectiveSamples: 0,
      winRate: 0,
      margin: 100,
      heuristic: saved.heuristic,
      lookahead: saved.lookahead,
      treeSearch: {
        visits: 0,
        averageUtility: 0,
        informationSets: 0,
        multiVisitInformationSets: 0,
        deepestPly: 0,
        averageTreePlies: 0,
        revisitedActionRate: 0,
        uniqueDeals: wins.length,
        baseIterations: wins.length,
        extraIterations: 0,
        closeDecision: false,
        pairedBaseWins: wins,
        pairedBaseWeights: trace.weights,
        pairedTreeWins: [],
      },
      evidence: {
        nextPassRate: 0,
        blockedWinRate: 0,
        emptyWinRate: 0,
        averagePipsWhenLosing: 0,
        retainedEndMatches: saved.retainedEndMatches,
      },
    };
    return ratedMoveWindow(base, 0, wins.length);
  }));
}

function timedAnalysis(game, budget, seedSalt) {
  const sampled = beliefForBudget(game, budget, seedSalt);
  const started = performance.now();
  const ranked = analyzeMoves(game, sampled.target, sampled.belief, undefined, {
    representativeLimit: budget,
    representativePoolSize: budget,
    extraTreeSearch: 'disabled',
  });
  return { ranked, elapsedMs: performance.now() - started };
}

function evaluatedVariant(ranked, position, reference, choice, metadata = {}) {
  const topKey = moveKey(ranked[0]);
  const referenceRate = reference.rates.get(topKey);
  if (referenceRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
  return {
    topKey,
    exactTopAgreement: topKey === reference.topKey,
    acceptableTopAgreement: reference.acceptableKeys.includes(topKey),
    withinOnePoint: reference.bestRate - referenceRate <= 1,
    regret: Math.max(0, reference.bestRate - referenceRate),
    verdict: choice.verdict,
    mistakeLabelAgreement: choice.confidentMistake === reference.choice.confidentMistake,
    falsePositiveMistake: choice.confidentMistake && !reference.choice.confidentMistake,
    selectedSamples: ranked[0].samples,
    selectedEffectiveSamples: ranked[0].effectiveSamples,
    ...metadata,
  };
}

export async function evaluateConfirmedRootRacingPosition(position, {
  repetitions = 5,
  referenceBudget = 5000,
  rootBudget = CONFIRMED_ROOT_RACING_ROOT_BUDGET,
  ceilingBudget = CONFIRMED_ROOT_RACING_CEILING_BUDGET,
  config = CONFIRMED_ROOT_RACING_CONFIG,
  recommendationPracticalGap = 1,
  seed = 'mesa-quince-confirmed-root-racing-development-v2',
} = {}) {
  if (!confirmedRootRacingEnabled(position.phase, position.branching)) {
    throw new Error(`Position ${position.id} is outside the confirmed root-racing scope.`);
  }
  const safeGame = informationSafeBenchmarkGame(position.game);
  const [referenceA, referenceB] = [0, 1].map((index) => timedAnalysis(
    safeGame,
    referenceBudget,
    `${seed}|${position.id}|reference-${index + 1}`,
  ));
  const referenceRanked = mergeMoveAnalyses([referenceA.ranked, referenceB.ranked]);
  const reference = {
    topKey: moveKey(referenceRanked[0]),
    acceptableKeys: plausibleBestMoveKeys(
      referenceRanked,
      [referenceA.ranked, referenceB.ranked],
      recommendationPracticalGap,
    ),
    rates: new Map(referenceRanked.map((move) => [moveKey(move), move.winRate])),
    bestRate: referenceRanked[0].winRate,
    choice: classifyAnalyzedChoice(referenceRanked, position.playedKey),
  };
  const trials = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const full = timedAnalysis(
      safeGame,
      ceilingBudget,
      `${seed}|${position.id}|repeat-${repetition}|paired-pool`,
    );
    const control = rankedMovePrefix(full.ranked, rootBudget);
    const ceiling = rankedMovePrefix(full.ranked, ceilingBudget);
    const raced = replayConfirmedRootRace(full.ranked, config, rootBudget);
    const racedChoice = confirmedChoiceAssessment(
      full.ranked,
      moveKey(raced.ranked[0]),
      position.playedKey,
      rootBudget,
    );
    const chosenAllocation = raced.allocations[position.playedKey];
    const postDecisionEvaluations = raced.eliminatedKeys.includes(position.playedKey)
      ? Math.max(0, rootBudget - chosenAllocation)
      : 0;
    trials.push({
      repetition,
      collectionElapsedMs: full.elapsedMs,
      variants: {
        'control-120': evaluatedVariant(
          control,
          position,
          reference,
          classifyAnalyzedChoice(control, position.playedKey),
          {
            rootEvaluations: rootBudget * position.branching,
            postDecisionEvaluations: 0,
            referenceBestSurvived: true,
          },
        ),
        'ceiling-500': evaluatedVariant(
          ceiling,
          position,
          reference,
          classifyAnalyzedChoice(ceiling, position.playedKey),
          {
            rootEvaluations: ceilingBudget * position.branching,
            postDecisionEvaluations: 0,
            referenceBestSurvived: true,
          },
        ),
        [config.id]: evaluatedVariant(raced.ranked, position, reference, racedChoice, {
          rootEvaluations: raced.rootEvaluations,
          postDecisionEvaluations,
          referenceBestSurvived: raced.survivorKeys.includes(reference.topKey),
          minimumSurvivorSamples: raced.minimumSurvivorSamples,
          survivorCount: raced.survivorKeys.length,
          survivorKeys: raced.survivorKeys,
          eliminatedKeys: raced.eliminatedKeys,
          provisionalEliminatedKeys: raced.provisionalEliminatedKeys,
          allocations: raced.allocations,
          confirmations: raced.confirmations,
        }),
      },
      replay: serializeRootRacingTrace(full.ranked),
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
      rates: Object.fromEntries(reference.rates),
      independentTopKeys: [moveKey(referenceA.ranked[0]), moveKey(referenceB.ranked[0])],
      independentTopAgreement: moveKey(referenceA.ranked[0]) === moveKey(referenceB.ranked[0]),
      verdict: reference.choice.verdict,
      confidentMistake: reference.choice.confidentMistake,
      elapsedMs: referenceA.elapsedMs + referenceB.elapsedMs,
    },
    trials,
  };
}

export function collectConfirmedRootRacingCorpus(options = {}) {
  return collectRootRacingCorpus({
    openingPositions: options.positions ?? 24,
    safetyPositions: 0,
    openingMinimumBranching: options.minimumBranching ?? 6,
    seed: options.seed ?? 'mesa-quince-confirmed-root-racing-development-v2',
    maxDeals: options.maxDeals,
  });
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
    referenceBestSurvival: metric('reference-survival', (trial) => trial.referenceBestSurvived ? 1 : 0),
    minimumSurvivorSamples: metric('minimum-survivor-samples', (trial) => (
      trial.minimumSurvivorSamples ?? trial.selectedSamples
    )),
    survivorCount: metric('survivors', (trial) => trial.survivorCount ?? positions[0].branching),
    postDecisionEvaluations: metric('post-decision-evaluations', (trial) => trial.postDecisionEvaluations),
    repeatAcceptability: interval(positions.map((position) => (
      position.trials.every((trial) => trial.variants[variant].withinOnePoint) ? 1 : 0
    )), `${seed}|${variant}|repeat-acceptable`, resamples),
    repeatTopStability: interval(positions.map((position) => (
      new Set(position.trials.map((trial) => trial.variants[variant].topKey)).size === 1 ? 1 : 0
    )), `${seed}|${variant}|repeat-top`, resamples),
  };
}

function summarizeEffect(positions, candidate, seed, resamples) {
  const control = 'control-120';
  const metric = (label, read) => interval(positions.map((position) => {
    const values = position.trials.map((trial) => (
      read(trial.variants[candidate]) - read(trial.variants[control])
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
      const candidateAcceptable = position.trials.every((trial) => trial.variants[candidate].withinOnePoint) ? 1 : 0;
      const controlAcceptable = position.trials.every((trial) => trial.variants[control].withinOnePoint) ? 1 : 0;
      return candidateAcceptable - controlAcceptable;
    }), `${seed}|${candidate}|effect|repeat-acceptable`, resamples),
  };
}

export function confirmedRootRacingDevelopmentGate(
  positions,
  summary,
  rootBudget = CONFIRMED_ROOT_RACING_ROOT_BUDGET,
) {
  const tolerance = 1e-12;
  const candidate = CONFIRMED_ROOT_RACING_ID;
  const checks = {
    exercised: summary.selectionChangeRate.mean >= 0.05,
    referenceBestSurvival: summary.candidate.referenceBestSurvival.mean >= 0.98 - tolerance,
    withinOnePointImproves: summary.effect.withinOnePoint.mean > 0,
    regretImproves: summary.effect.meanRegret.mean < 0,
    repeatAcceptabilityNoninferior: summary.effect.repeatAcceptability.mean >= -tolerance,
    labelsPreserved: summary.effect.mistakeLabelAgreement.mean >= -0.01 - tolerance,
    falsePositivesDoNotIncrease: summary.effect.falsePositiveMistake.mean <= tolerance,
    effectiveSamplesIncrease: summary.effect.selectedEffectiveSamples.mean > 0,
    finalistsKeepCurrentEvidenceFloor: positions.every((position) => position.trials.every((trial) => (
      trial.variants[candidate].minimumSurvivorSamples >= rootBudget
    ))),
    exactRecommendationBudget: positions.every((position) => position.trials.every((trial) => (
      trial.variants[candidate].rootEvaluations === rootBudget * position.branching
    ))),
    postDecisionOverheadControlled: summary.postDecisionOverheadRatio.mean <= 0.02 + tolerance,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function summarizeConfirmedRootRacing(positions, {
  seed = 'mesa-quince-confirmed-root-racing-development-v2',
  confidenceResamples = 1000,
  rootBudget = CONFIRMED_ROOT_RACING_ROOT_BUDGET,
} = {}) {
  const candidate = CONFIRMED_ROOT_RACING_ID;
  const control = summarizeVariant(positions, 'control-120', `${seed}|control`, confidenceResamples);
  const ceiling = summarizeVariant(positions, 'ceiling-500', `${seed}|ceiling`, confidenceResamples);
  const candidateSummary = summarizeVariant(positions, candidate, `${seed}|candidate`, confidenceResamples);
  const effect = summarizeEffect(positions, candidate, seed, confidenceResamples);
  const selectionChangeRate = interval(positions.map((position) => (
    position.trials.filter((trial) => (
      trial.variants[candidate].topKey !== trial.variants['control-120'].topKey
    )).length / position.trials.length
  )), `${seed}|selection-change`, confidenceResamples);
  const postDecisionOverheadRatio = interval(positions.map((position) => {
    const ratios = position.trials.map((trial) => (
      trial.variants[candidate].postDecisionEvaluations / (rootBudget * position.branching)
    ));
    return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  }), `${seed}|post-decision-overhead`, confidenceResamples);
  const summary = {
    version: CONFIRMED_ROOT_RACING_VERSION,
    positions: positions.length,
    control,
    ceiling,
    candidate: candidateSummary,
    effect,
    selectionChangeRate,
    postDecisionOverheadRatio,
  };
  summary.gate = confirmedRootRacingDevelopmentGate(positions, summary, rootBudget);
  return summary;
}

import {
  analyzeMoves,
  applyMove,
  applyPass,
  chooseCasualMove,
  detectStrategicPhase,
  legalMovesFor,
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
import { createMatchedDeal, gameFromMatchedDeal } from './benchmark-core.mjs';
import { beliefForBudget } from './stratified-sampling-core.mjs';

export const ROOT_RACING_VERSION = 'paired-root-racing-development-v1';
export const ROOT_RACING_CONTROL_BUDGET = 120;
export const ROOT_RACING_CEILING_BUDGET = 500;
export const ROOT_RACING_CONFIGS = [
  {
    id: 'race-40',
    initialSamples: 40,
    minimumSurvivors: 3,
    practicalGap: 1,
    minimumGap: 3,
    batches: 4,
    minimumPositiveBatchAgreement: 0.75,
    minimumPracticalBatchAgreement: 0.5,
  },
  {
    id: 'race-60',
    initialSamples: 60,
    minimumSurvivors: 3,
    practicalGap: 1,
    minimumGap: 3,
    batches: 4,
    minimumPositiveBatchAgreement: 0.75,
    minimumPracticalBatchAgreement: 0.5,
  },
  {
    id: 'race-80',
    initialSamples: 80,
    minimumSurvivors: 3,
    practicalGap: 1,
    minimumGap: 3,
    batches: 4,
    minimumPositiveBatchAgreement: 0.75,
    minimumPracticalBatchAgreement: 0.5,
  },
];

export const ROOT_RACING_VARIANTS = [
  'control-120',
  'ceiling-500',
  ...ROOT_RACING_CONFIGS.map(({ id }) => id),
];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

function validateConfig(config, rootBudget) {
  if (!config?.id) throw new Error('A root-racing configuration needs an id.');
  if (!Number.isInteger(rootBudget) || rootBudget <= 0) throw new Error('Root budget must be a positive integer.');
  if (!Number.isInteger(config.initialSamples)
    || config.initialSamples <= 0
    || config.initialSamples > rootBudget) {
    throw new Error('Initial root-racing samples must be between one and the root budget.');
  }
  if (!Number.isInteger(config.minimumSurvivors) || config.minimumSurvivors <= 0) {
    throw new Error('Root racing must retain at least one survivor.');
  }
  if (!Number.isInteger(config.batches) || config.batches < 2) {
    throw new Error('Root racing needs at least two first-stage batches.');
  }
}

function weightedSummary(wins, weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const squaredWeight = weights.reduce((sum, weight) => sum + weight * weight, 0);
  const weightedWins = wins.reduce((sum, won, index) => sum + won * weights[index], 0);
  const winRate = totalWeight ? weightedWins / totalWeight * 100 : 0;
  const effectiveSamples = squaredWeight ? totalWeight * totalWeight / squaredWeight : 0;
  const proportion = winRate / 100;
  const margin = effectiveSamples
    ? 1.96 * Math.sqrt(proportion * (1 - proportion) / effectiveSamples) * 100
    : 100;
  return { effectiveSamples, winRate, margin };
}

export function ratedMoveWindow(move, start = 0, end = move.samples) {
  const wins = move.treeSearch.pairedBaseWins.slice(start, end);
  const weights = move.treeSearch.pairedBaseWeights.slice(start, end);
  if (!wins.length || wins.length !== weights.length) {
    throw new Error(`Move ${moveKey(move)} does not contain the requested paired outcome window.`);
  }
  const summary = weightedSummary(wins, weights);
  return {
    ...move,
    samples: wins.length,
    ...summary,
    treeSearch: {
      ...move.treeSearch,
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
      pairedBaseWeights: weights,
      pairedTreeWins: [],
    },
  };
}

function rankMoves(moves) {
  return [...moves].sort((left, right) => (
    right.winRate - left.winRate
    || right.lookahead.score - left.lookahead.score
    || right.heuristic - left.heuristic
    || moveKey(left).localeCompare(moveKey(right))
  ));
}

export function rankedMovePrefix(ranked, samples) {
  return rankMoves(ranked.map((move) => ratedMoveWindow(move, 0, samples)));
}

function batchGaps(better, candidate, batches) {
  const count = Math.min(better.samples, candidate.samples);
  return Array.from({ length: batches }, (_, batchIndex) => {
    const start = Math.floor(batchIndex * count / batches);
    const end = Math.floor((batchIndex + 1) * count / batches);
    if (end <= start) return 0;
    const left = ratedMoveWindow(better, start, end);
    const right = ratedMoveWindow(candidate, start, end);
    return pairedRatedMoveDifference(left, right).gap;
  });
}

export function selectRootRacingSurvivors(fullRanked, config, rootBudget = ROOT_RACING_CONTROL_BUDGET) {
  validateConfig(config, rootBudget);
  if (fullRanked.length < 2) throw new Error('Root racing requires at least two legal moves.');
  if (fullRanked.some((move) => move.samples < config.initialSamples)) {
    throw new Error('Root-racing outcomes do not contain the complete first stage.');
  }
  const firstStage = rankedMovePrefix(fullRanked, config.initialSamples);
  const leader = firstStage[0];
  const requiredSurvivors = Math.min(config.minimumSurvivors, firstStage.length);
  const protectedKeys = new Set(firstStage.slice(0, requiredSurvivors).map(moveKey));
  const evidence = firstStage.map((candidate) => {
    const key = moveKey(candidate);
    if (key === moveKey(leader)) {
      return { key, eliminated: false, gap: 0, interval: [0, 0], batchGaps: [] };
    }
    const difference = pairedRatedMoveDifference(leader, candidate);
    const gaps = batchGaps(leader, candidate, config.batches);
    const positiveAgreement = gaps.filter((gap) => gap > 0).length / gaps.length;
    const practicalAgreement = gaps.filter((gap) => gap > config.practicalGap).length / gaps.length;
    const statisticallyDominated = difference.gap >= config.minimumGap
      && difference.interval[0] > config.practicalGap
      && positiveAgreement >= config.minimumPositiveBatchAgreement
      && practicalAgreement >= config.minimumPracticalBatchAgreement;
    return {
      key,
      eliminated: !protectedKeys.has(key) && statisticallyDominated,
      gap: difference.gap,
      interval: difference.interval,
      batchGaps: gaps,
      positiveAgreement,
      practicalAgreement,
    };
  });
  const eliminated = new Set(evidence.filter((entry) => entry.eliminated).map(({ key }) => key));
  return {
    firstStage,
    survivorKeys: firstStage.map(moveKey).filter((key) => !eliminated.has(key)),
    eliminatedKeys: [...eliminated].sort(),
    evidence,
  };
}

function survivorAllocations(survivorKeys, firstStageSamples, rootEvaluations) {
  const initialEvaluations = firstStageSamples * survivorKeys.totalMoves;
  const remaining = rootEvaluations - initialEvaluations;
  if (remaining < 0) throw new Error('First-stage evaluations exceed the fixed root budget.');
  const baseExtra = Math.floor(remaining / survivorKeys.keys.length);
  const remainder = remaining % survivorKeys.keys.length;
  return new Map(survivorKeys.keys.map((key, index) => [
    key,
    firstStageSamples + baseExtra + (index < remainder ? 1 : 0),
  ]));
}

export function requiredRootRacingSamples(moveCount, config, rootBudget = ROOT_RACING_CONTROL_BUDGET) {
  validateConfig(config, rootBudget);
  const survivors = Math.min(config.minimumSurvivors, moveCount);
  const rootEvaluations = rootBudget * moveCount;
  const remaining = rootEvaluations - config.initialSamples * moveCount;
  return config.initialSamples + Math.ceil(remaining / survivors);
}

export function replayRootRace(fullRanked, config, rootBudget = ROOT_RACING_CONTROL_BUDGET) {
  const selection = selectRootRacingSurvivors(fullRanked, config, rootBudget);
  const rootEvaluations = rootBudget * fullRanked.length;
  const allocations = survivorAllocations({
    keys: selection.survivorKeys,
    totalMoves: fullRanked.length,
  }, config.initialSamples, rootEvaluations);
  const byKey = new Map(fullRanked.map((move) => [moveKey(move), move]));
  const survivors = rankMoves(selection.survivorKeys.map((key) => {
    const samples = allocations.get(key);
    const move = byKey.get(key);
    if (!move || move.samples < samples) {
      throw new Error(`Move ${key} does not contain ${samples} root-racing outcomes.`);
    }
    return ratedMoveWindow(move, 0, samples);
  }));
  const eliminated = rankMoves(selection.eliminatedKeys.map((key) => (
    ratedMoveWindow(byKey.get(key), 0, config.initialSamples)
  )));
  const spent = [...allocations.values()].reduce((sum, samples) => sum + samples, 0)
    + eliminated.length * config.initialSamples;
  if (spent !== rootEvaluations) {
    throw new Error(`Root race spent ${spent} evaluations instead of ${rootEvaluations}.`);
  }
  return {
    ranked: [...survivors, ...eliminated],
    survivorKeys: selection.survivorKeys,
    eliminatedKeys: selection.eliminatedKeys,
    allocations: Object.fromEntries([...allocations].sort()),
    evidence: selection.evidence,
    rootEvaluations,
    firstStageEvaluations: config.initialSamples * fullRanked.length,
  };
}

export function collectRootRacingCorpus({
  openingPositions = 24,
  safetyPositions = 12,
  openingMinimumBranching = 6,
  safetyMinimumBranching = 4,
  seed = 'mesa-quince-root-racing-development-v1',
  maxDeals = 20000,
} = {}) {
  const positions = [];
  let openingCount = 0;
  let safetyCount = 0;
  for (let dealIndex = 0; dealIndex < maxDeals; dealIndex += 1) {
    if (openingCount >= openingPositions && safetyCount >= safetyPositions) break;
    const deal = createMatchedDeal(dealIndex, seed);
    let game = gameFromMatchedDeal(deal, dealIndex % 3);
    for (let turn = 0; turn < 160 && game.phase === 'playing'; turn += 1) {
      const legal = legalMovesFor(game.hands[game.current], game.chain);
      if (!legal.length) {
        game = applyPass(game);
        continue;
      }
      const selected = chooseCasualMove(game, legal);
      if (game.current === 0 && legal.length > 1) {
        const phase = detectStrategicPhase(game, 0);
        if (phase === 'opening'
          && legal.length >= openingMinimumBranching
          && openingCount < openingPositions) {
          openingCount += 1;
          positions.push({
            id: `opening-high-${String(openingCount).padStart(2, '0')}`,
            group: 'opening-high',
            phase,
            branching: legal.length,
            game,
            playedKey: moveKey(selected),
          });
          break;
        }
        if (phase === 'middle'
          && legal.length >= safetyMinimumBranching
          && safetyCount < safetyPositions) {
          safetyCount += 1;
          positions.push({
            id: `middle-safety-${String(safetyCount).padStart(2, '0')}`,
            group: 'middle-safety',
            phase,
            branching: legal.length,
            game,
            playedKey: moveKey(selected),
          });
          break;
        }
      }
      game = applyMove(game, selected);
    }
  }
  if (openingCount < openingPositions || safetyCount < safetyPositions) {
    throw new Error(`Could not collect the requested root-racing corpus after ${maxDeals} deals.`);
  }
  return positions.sort((left, right) => left.id.localeCompare(right.id));
}

function timedAnalysis(game, budget, seedSalt) {
  const sampled = beliefForBudget(game, budget, seedSalt);
  const started = performance.now();
  const ranked = analyzeMoves(game, sampled.target, sampled.belief, undefined, {
    representativeLimit: budget,
    representativePoolSize: budget,
    extraTreeSearch: 'disabled',
  });
  return {
    ranked,
    elapsedMs: performance.now() - started,
    beliefRetries: sampled.retries,
  };
}

function evaluatedVariant(ranked, position, reference, metadata = {}) {
  const topKey = moveKey(ranked[0]);
  const referenceRate = reference.rates.get(topKey);
  if (referenceRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
  const choice = classifyAnalyzedChoice(ranked, position.playedKey);
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

export async function evaluateRootRacingPosition(position, {
  repetitions = 5,
  referenceBudget = 5000,
  rootBudget = ROOT_RACING_CONTROL_BUDGET,
  ceilingBudget = ROOT_RACING_CEILING_BUDGET,
  configs = ROOT_RACING_CONFIGS,
  recommendationPracticalGap = 1,
  seed = 'mesa-quince-root-racing-development-v1',
} = {}) {
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
  const requiredSamples = Math.max(
    ceilingBudget,
    ...configs.map((config) => requiredRootRacingSamples(position.branching, config, rootBudget)),
  );
  const trials = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const full = timedAnalysis(
      safeGame,
      requiredSamples,
      `${seed}|${position.id}|repeat-${repetition}|paired-pool`,
    );
    const control = rankedMovePrefix(full.ranked, rootBudget);
    const ceiling = rankedMovePrefix(full.ranked, ceilingBudget);
    const variants = {
      'control-120': evaluatedVariant(control, position, reference, {
        rootEvaluations: rootBudget * position.branching,
        survivorCount: position.branching,
        referenceBestSurvived: true,
      }),
      'ceiling-500': evaluatedVariant(ceiling, position, reference, {
        rootEvaluations: ceilingBudget * position.branching,
        survivorCount: position.branching,
        referenceBestSurvived: true,
      }),
    };
    for (const config of configs) {
      const raced = replayRootRace(full.ranked, config, rootBudget);
      variants[config.id] = evaluatedVariant(raced.ranked, position, reference, {
        rootEvaluations: raced.rootEvaluations,
        survivorCount: raced.survivorKeys.length,
        survivorKeys: raced.survivorKeys,
        eliminatedKeys: raced.eliminatedKeys,
        allocations: raced.allocations,
        referenceBestSurvived: raced.survivorKeys.includes(reference.topKey),
      });
    }
    trials.push({
      repetition,
      requiredSamples,
      collectionElapsedMs: full.elapsedMs,
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
      independentTopKeys: [moveKey(referenceA.ranked[0]), moveKey(referenceB.ranked[0])],
      independentTopAgreement: moveKey(referenceA.ranked[0]) === moveKey(referenceB.ranked[0]),
      verdict: reference.choice.verdict,
      confidentMistake: reference.choice.confidentMistake,
      elapsedMs: referenceA.elapsedMs + referenceB.elapsedMs,
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
    referenceBestSurvival: metric('reference-survival', (trial) => trial.referenceBestSurvived ? 1 : 0),
    survivorCount: metric('survivors', (trial) => trial.survivorCount),
    rootEvaluations: metric('root-evaluations', (trial) => trial.rootEvaluations),
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

export function rootRacingDevelopmentGate(positions, candidate, summary, rootBudget = ROOT_RACING_CONTROL_BUDGET) {
  const tolerance = 1e-12;
  const expectedRootEvaluations = (position) => rootBudget * position.branching;
  const checks = {
    exercised: summary.selectionChangeRate.mean >= 0.05,
    referenceBestSurvival: summary.variant.referenceBestSurvival.mean >= 0.98 - tolerance,
    withinOnePointImproves: summary.effect.withinOnePoint.mean > 0,
    regretImproves: summary.effect.meanRegret.mean < 0,
    repeatAcceptabilityNoninferior: summary.effect.repeatAcceptability.mean >= -tolerance,
    labelsPreserved: summary.effect.mistakeLabelAgreement.mean >= -0.01 - tolerance,
    falsePositivesDoNotIncrease: summary.effect.falsePositiveMistake.mean <= tolerance,
    effectiveSamplesIncrease: summary.effect.selectedEffectiveSamples.mean > 0,
    exactRootBudget: positions.every((position) => position.trials.every((trial) => (
      trial.variants[candidate].rootEvaluations === expectedRootEvaluations(position)
    ))),
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

function summarizeGroup(positions, variants, seed, resamples, rootBudget) {
  const variantSummaries = Object.fromEntries(variants.map((variant) => [
    variant,
    summarizeVariant(positions, variant, seed, resamples),
  ]));
  const candidates = {};
  for (const candidate of variants.filter((variant) => variant.startsWith('race-'))) {
    const effect = summarizeEffect(positions, candidate, seed, resamples);
    const selectionChangeRate = interval(positions.map((position) => (
      position.trials.filter((trial) => (
        trial.variants[candidate].topKey !== trial.variants['control-120'].topKey
      )).length / position.trials.length
    )), `${seed}|${candidate}|selection-change`, resamples);
    const summary = {
      variant: variantSummaries[candidate],
      control: variantSummaries['control-120'],
      effect,
      selectionChangeRate,
    };
    summary.gate = rootRacingDevelopmentGate(positions, candidate, summary, rootBudget);
    candidates[candidate] = summary;
  }
  return { positions: positions.length, variants: variantSummaries, candidates };
}

export function summarizeRootRacing(positions, {
  configs = ROOT_RACING_CONFIGS,
  rootBudget = ROOT_RACING_CONTROL_BUDGET,
  seed = 'mesa-quince-root-racing-development-v1',
  confidenceResamples = 1000,
} = {}) {
  const variants = ['control-120', 'ceiling-500', ...configs.map(({ id }) => id)];
  const groups = [...new Set(positions.map(({ group }) => group))];
  const overall = summarizeGroup(positions, variants, `${seed}|overall`, confidenceResamples, rootBudget);
  const byGroup = Object.fromEntries(groups.map((group) => [
    group,
    summarizeGroup(
      positions.filter((position) => position.group === group),
      variants,
      `${seed}|${group}`,
      confidenceResamples,
      rootBudget,
    ),
  ]));
  const opening = byGroup['opening-high'];
  const safety = byGroup['middle-safety'];
  const advancing = configs.map(({ id }) => id).filter((candidate) => (
    opening?.candidates[candidate].gate.passed
    && (!safety || (
      safety.candidates[candidate].effect.withinOnePoint.mean >= -0.01
      && safety.candidates[candidate].effect.meanRegret.mean <= 0.25
      && safety.candidates[candidate].effect.falsePositiveMistake.mean <= 0
    ))
  ));
  return {
    version: ROOT_RACING_VERSION,
    positions: positions.length,
    overall,
    groups: byGroup,
    advancingCandidates: advancing,
    gate: { passed: advancing.length > 0 },
  };
}

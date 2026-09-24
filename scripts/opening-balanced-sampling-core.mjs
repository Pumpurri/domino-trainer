import {
  analyzeMoves,
  mergeMoveAnalyses,
  seededRandom,
} from '../app/domino-engine.ts';
import { plausibleBestMoveKeys } from '../app/adaptive-analysis.ts';
import {
  classifyAnalyzedChoice,
  informationSafeBenchmarkGame,
} from './analyzer-reliability-core.mjs';
import { collectRootRacingCorpus } from './root-racing-core.mjs';
import { beliefForBudget } from './stratified-sampling-core.mjs';

export const OPENING_BALANCED_VERSION = 'opening-balanced-sampling-development-v1';
export const OPENING_BALANCED_CONTROL = 'systematic';
export const OPENING_BALANCED_CANDIDATES = [
  'opening-response-balanced-35',
  'opening-response-balanced-60',
  'opening-return-balanced-35',
  'opening-return-balanced-60',
];
export const OPENING_BALANCED_VARIANTS = [
  OPENING_BALANCED_CONTROL,
  ...OPENING_BALANCED_CANDIDATES,
];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

export function collectOpeningBalancedCorpus(options = {}) {
  return collectRootRacingCorpus({
    openingPositions: options.positions ?? 24,
    safetyPositions: 0,
    openingMinimumBranching: options.minimumBranching ?? 6,
    seed: options.seed ?? 'mesa-quince-opening-balanced-development-v1',
    maxDeals: options.maxDeals,
  });
}

function timedAnalysis(game, sampled, budget, representativePolicy) {
  const started = performance.now();
  const ranked = analyzeMoves(game, sampled.target, sampled.belief, undefined, {
    representativeLimit: budget,
    representativePoolSize: budget,
    representativePolicy,
    extraTreeSearch: 'disabled',
  });
  return { ranked, elapsedMs: performance.now() - started };
}

function independentAnalysis(game, budget, seedSalt) {
  const sampled = beliefForBudget(game, budget, seedSalt);
  return timedAnalysis(game, sampled, budget, OPENING_BALANCED_CONTROL);
}

function evaluatedVariant(analysis, position, reference, budget) {
  const topKey = moveKey(analysis.ranked[0]);
  const referenceRate = reference.rates.get(topKey);
  if (referenceRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
  const choice = classifyAnalyzedChoice(analysis.ranked, position.playedKey);
  return {
    topKey,
    samplesUsed: analysis.ranked[0].samples,
    exactSampleBudget: analysis.ranked.every((move) => move.samples === budget),
    effectiveSamples: analysis.ranked[0].effectiveSamples,
    elapsedMs: analysis.elapsedMs,
    exactTopAgreement: topKey === reference.topKey,
    acceptableTopAgreement: reference.acceptableKeys.includes(topKey),
    withinOnePoint: reference.bestRate - referenceRate <= 1,
    regret: Math.max(0, reference.bestRate - referenceRate),
    verdict: choice.verdict,
    mistakeLabelAgreement: choice.confidentMistake === reference.choice.confidentMistake,
    falsePositiveMistake: choice.confidentMistake && !reference.choice.confidentMistake,
  };
}

export async function evaluateOpeningBalancedPosition(position, {
  repetitions = 5,
  budget = 120,
  referenceBudget = 5000,
  recommendationPracticalGap = 1,
  seed = 'mesa-quince-opening-balanced-development-v1',
} = {}) {
  if (position.phase !== 'opening' || position.branching < 6) {
    throw new Error(`Position ${position.id} is outside the opening-balanced sampling scope.`);
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

  const trials = [];
  const positionNumber = Number(position.id.split('-').at(-1)) || 0;
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const sampled = beliefForBudget(
      safeGame,
      budget,
      `${seed}|${position.id}|repeat-${repetition}|shared-pool`,
    );
    const offset = (positionNumber + repetition) % OPENING_BALANCED_VARIANTS.length;
    const order = [
      ...OPENING_BALANCED_VARIANTS.slice(offset),
      ...OPENING_BALANCED_VARIANTS.slice(0, offset),
    ];
    const analyses = {};
    for (const policy of order) analyses[policy] = timedAnalysis(safeGame, sampled, budget, policy);
    const variants = Object.fromEntries(OPENING_BALANCED_VARIANTS.map((policy) => [
      policy,
      evaluatedVariant(analyses[policy], position, reference, budget),
    ]));
    trials.push({ repetition, variants });
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
    effectiveSamples: metric('effective-samples', (trial) => trial.effectiveSamples),
    elapsedMs: metric('elapsed-ms', (trial) => trial.elapsedMs),
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
      read(trial.variants[candidate]) - read(trial.variants[OPENING_BALANCED_CONTROL])
    ));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }), `${seed}|${candidate}|effect|${label}`, resamples);
  const runtimeRatios = positions.map((position) => {
    const candidateTime = position.trials.reduce((sum, trial) => sum + trial.variants[candidate].elapsedMs, 0);
    const controlTime = position.trials.reduce((sum, trial) => sum + trial.variants[OPENING_BALANCED_CONTROL].elapsedMs, 0);
    return controlTime ? candidateTime / controlTime - 1 : 0;
  });
  return {
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    mistakeLabelAgreement: metric('label', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistake: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    effectiveSamples: metric('effective-samples', (trial) => trial.effectiveSamples),
    runtimeRatio: interval(runtimeRatios, `${seed}|${candidate}|effect|runtime`, resamples),
    repeatAcceptability: interval(positions.map((position) => {
      const candidateAcceptable = position.trials.every((trial) => trial.variants[candidate].withinOnePoint) ? 1 : 0;
      const controlAcceptable = position.trials.every((trial) => trial.variants[OPENING_BALANCED_CONTROL].withinOnePoint) ? 1 : 0;
      return candidateAcceptable - controlAcceptable;
    }), `${seed}|${candidate}|effect|repeat-acceptable`, resamples),
  };
}

export function openingBalancedCandidateGate(positions, candidate, result, budget = 120) {
  const tolerance = 1e-12;
  const checks = {
    exercised: result.selectionChangeRate.mean >= 0.05 - tolerance,
    withinOnePointImproves: result.effect.withinOnePoint.mean > 0,
    regretImproves: result.effect.meanRegret.mean < 0,
    repeatAcceptabilityNoninferior: result.effect.repeatAcceptability.mean >= -tolerance,
    labelsPreserved: result.effect.mistakeLabelAgreement.mean >= -0.01 - tolerance,
    falsePositivesDoNotIncrease: result.effect.falsePositiveMistake.mean <= tolerance,
    effectiveSamplesPreserved: result.candidate.effectiveSamples.mean >= budget * 0.90 - tolerance,
    runtimeControlled: result.effect.runtimeRatio.mean <= 0.30 + tolerance,
    exactSampleBudget: positions.every((position) => position.trials.every((trial) => (
      trial.variants[candidate].exactSampleBudget
      && trial.variants[candidate].samplesUsed === budget
      && trial.variants[OPENING_BALANCED_CONTROL].exactSampleBudget
      && trial.variants[OPENING_BALANCED_CONTROL].samplesUsed === budget
    ))),
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function summarizeOpeningBalanced(positions, {
  seed = 'mesa-quince-opening-balanced-development-v1',
  confidenceResamples = 1000,
  budget = 120,
} = {}) {
  const control = summarizeVariant(positions, OPENING_BALANCED_CONTROL, `${seed}|control`, confidenceResamples);
  const candidates = {};
  for (const candidate of OPENING_BALANCED_CANDIDATES) {
    const candidateSummary = summarizeVariant(positions, candidate, `${seed}|${candidate}`, confidenceResamples);
    const effect = summarizeEffect(positions, candidate, seed, confidenceResamples);
    const selectionChangeRate = interval(positions.map((position) => (
      position.trials.filter((trial) => (
        trial.variants[candidate].topKey !== trial.variants[OPENING_BALANCED_CONTROL].topKey
      )).length / position.trials.length
    )), `${seed}|${candidate}|selection-change`, confidenceResamples);
    const result = { candidate: candidateSummary, effect, selectionChangeRate };
    result.gate = openingBalancedCandidateGate(positions, candidate, result, budget);
    candidates[candidate] = result;
  }
  const passing = OPENING_BALANCED_CANDIDATES.filter((candidate) => candidates[candidate].gate.passed)
    .sort((left, right) => (
      candidates[left].effect.meanRegret.mean - candidates[right].effect.meanRegret.mean
      || candidates[right].effect.withinOnePoint.mean - candidates[left].effect.withinOnePoint.mean
    ));
  return {
    version: OPENING_BALANCED_VERSION,
    positions: positions.length,
    budget,
    control,
    candidates,
    selectedCandidate: passing[0] ?? null,
    gate: { passed: passing.length > 0 },
  };
}

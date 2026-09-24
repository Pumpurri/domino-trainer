import {
  applyMove,
  applyPass,
  chooseCasualMove,
  detectStrategicPhase,
  legalMovesFor,
  seededRandom,
} from '../app/domino-engine.ts';
import { plausibleBestMoveKeys } from '../app/adaptive-analysis.ts';
import {
  classifyAnalyzedChoice,
  informationSafeBenchmarkGame,
} from './analyzer-reliability-core.mjs';
import { createMatchedDeal, gameFromMatchedDeal } from './benchmark-core.mjs';
import { analyzeBelief, beliefForBudget } from './stratified-sampling-core.mjs';

export const FIXED_STRATIFIED_VERSION = 'fixed-middle-stratified-v1';
export const FIXED_STRATIFIED_VARIANTS = ['systematic', 'public-stratified'];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

export function collectFixedStratifiedCorpus({
  positions = 60,
  minimumBranching = 4,
  seed = 'mesa-quince-fixed-stratified-middle-v1',
  maxDeals = 16000,
} = {}) {
  const corpus = [];
  for (let dealIndex = 0; dealIndex < maxDeals && corpus.length < positions; dealIndex += 1) {
    const deal = createMatchedDeal(dealIndex, seed);
    let game = gameFromMatchedDeal(deal, dealIndex % 3);
    for (let turn = 0; turn < 160 && game.phase === 'playing'; turn += 1) {
      const legal = legalMovesFor(game.hands[game.current], game.chain);
      if (!legal.length) {
        game = applyPass(game);
        continue;
      }
      const selected = chooseCasualMove(game, legal);
      if (game.current === 0
        && legal.length >= minimumBranching
        && detectStrategicPhase(game, 0) === 'middle') {
        corpus.push({
          id: `middle-fixed-${String(corpus.length + 1).padStart(2, '0')}`,
          phase: 'middle',
          branching: legal.length,
          game,
          playedKey: moveKey(selected),
        });
        break;
      }
      game = applyMove(game, selected);
    }
  }
  if (corpus.length < positions) {
    throw new Error(`Could not collect ${positions} difficult middle positions after ${maxDeals} deals.`);
  }
  return corpus;
}

function timedAnalysis(game, sampled, budget, representativePolicy) {
  const started = performance.now();
  const ranked = analyzeBelief(
    game,
    sampled.belief,
    sampled.target,
    budget,
    representativePolicy,
  );
  return { ranked, elapsedMs: performance.now() - started };
}

function evaluatedTrial(analysis, position, reference, budget) {
  const topKey = moveKey(analysis.ranked[0]);
  const referenceRate = reference.rates.get(topKey);
  if (referenceRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
  const choice = classifyAnalyzedChoice(analysis.ranked, position.playedKey);
  return {
    topKey,
    budget,
    samplesUsed: analysis.ranked[0].samples,
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

export async function evaluateFixedStratifiedPosition(position, {
  budgets = [120, 500],
  repetitions = 5,
  referenceBudget = 5000,
  recommendationPracticalGap = 1,
  seed = 'mesa-quince-fixed-stratified-middle-v1',
} = {}) {
  const safeGame = informationSafeBenchmarkGame(position.game);
  const referenceSample = beliefForBudget(
    safeGame,
    referenceBudget,
    `${seed}|${position.id}|reference`,
  );
  const referenceAnalysis = timedAnalysis(
    safeGame,
    referenceSample,
    referenceBudget,
    'systematic',
  );
  const referenceRanked = referenceAnalysis.ranked;
  const reference = {
    topKey: moveKey(referenceRanked[0]),
    acceptableKeys: plausibleBestMoveKeys(
      referenceRanked,
      [referenceRanked],
      recommendationPracticalGap,
    ),
    rates: new Map(referenceRanked.map((move) => [moveKey(move), move.winRate])),
    bestRate: referenceRanked[0].winRate,
    choice: classifyAnalyzedChoice(referenceRanked, position.playedKey),
  };
  const byBudget = Object.fromEntries(budgets.map((budget) => [budget, { trials: [] }]));
  const positionNumber = Number(position.id.split('-').at(-1)) || 0;

  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (let budgetIndex = 0; budgetIndex < budgets.length; budgetIndex += 1) {
      const budget = budgets[budgetIndex];
      const sampled = beliefForBudget(
        safeGame,
        budget,
        `${seed}|${position.id}|budget-${budget}|repeat-${repetition}`,
      );
      const order = (positionNumber + repetition + budgetIndex) % 2
        ? FIXED_STRATIFIED_VARIANTS
        : [...FIXED_STRATIFIED_VARIANTS].reverse();
      const analyses = {};
      for (const policy of order) analyses[policy] = timedAnalysis(safeGame, sampled, budget, policy);
      const variants = Object.fromEntries(FIXED_STRATIFIED_VARIANTS.map((policy) => [
        policy,
        evaluatedTrial(analyses[policy], position, reference, budget),
      ]));
      byBudget[budget].trials.push({
        repetition,
        variants,
        selectionChanged: variants.systematic.topKey !== variants['public-stratified'].topKey,
      });
    }
  }

  return {
    id: position.id,
    phase: position.phase,
    branching: position.branching,
    handSizes: position.game.hands.map((hand) => hand.length),
    eventCount: position.game.events.length,
    playedKey: position.playedKey,
    reference: {
      budget: referenceBudget,
      topKey: reference.topKey,
      acceptableTopKeys: reference.acceptableKeys,
      verdict: reference.choice.verdict,
      confidentMistake: reference.choice.confidentMistake,
      elapsedMs: referenceAnalysis.elapsedMs,
    },
    budgets: byBudget,
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

function summarizeVariant(positions, budget, variant, seed, resamples) {
  const positionMeans = (read) => positions.map((position) => {
    const values = position.budgets[budget].trials.map((trial) => read(trial.variants[variant]));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  const metric = (label, read) => interval(
    positionMeans(read),
    `${seed}|${budget}|${variant}|${label}`,
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
      position.budgets[budget].trials.every((trial) => trial.variants[variant].withinOnePoint) ? 1 : 0
    )), `${seed}|${budget}|${variant}|repeat-acceptable`, resamples),
    repeatTopStability: interval(positions.map((position) => (
      new Set(position.budgets[budget].trials.map((trial) => trial.variants[variant].topKey)).size === 1 ? 1 : 0
    )), `${seed}|${budget}|${variant}|repeat-top`, resamples),
  };
}

function pairedEffect(positions, budget, seed, resamples) {
  const metric = (label, read) => interval(positions.map((position) => {
    const differences = position.budgets[budget].trials.map((trial) => (
      read(trial.variants['public-stratified']) - read(trial.variants.systematic)
    ));
    return differences.reduce((sum, value) => sum + value, 0) / differences.length;
  }), `${seed}|${budget}|effect|${label}`, resamples);
  const runtimeRatios = positions.map((position) => {
    const trials = position.budgets[budget].trials;
    const control = trials.reduce((sum, trial) => sum + trial.variants.systematic.elapsedMs, 0);
    const candidate = trials.reduce((sum, trial) => sum + trial.variants['public-stratified'].elapsedMs, 0);
    return control ? candidate / control - 1 : 0;
  });
  return {
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    mistakeLabelAgreement: metric('label', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistake: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    effectiveSamples: metric('effective-samples', (trial) => trial.effectiveSamples),
    elapsedMs: metric('elapsed-ms', (trial) => trial.elapsedMs),
    runtimeRatio: interval(runtimeRatios, `${seed}|${budget}|effect|runtime-ratio`, resamples),
    repeatAcceptability: interval(positions.map((position) => {
      const candidate = position.budgets[budget].trials.every((trial) => (
        trial.variants['public-stratified'].withinOnePoint
      )) ? 1 : 0;
      const control = position.budgets[budget].trials.every((trial) => (
        trial.variants.systematic.withinOnePoint
      )) ? 1 : 0;
      return candidate - control;
    }), `${seed}|${budget}|effect|repeat-acceptable`, resamples),
  };
}

export function fixedStratifiedBudgetGate(positions, budget, summary) {
  const trials = positions.flatMap((position) => position.budgets[budget].trials);
  const tolerance = 1e-12;
  const checks = {
    exercised: summary.selectionChangeRate.mean >= 0.05,
    repeatAcceptabilityImproves: summary.effect.repeatAcceptability.mean > 0,
    regretImproves: summary.effect.meanRegret.mean < 0,
    withinOnePointNoninferior: summary.effect.withinOnePoint.mean >= -0.01 - tolerance,
    falsePositivesDoNotIncrease: summary.effect.falsePositiveMistake.mean <= tolerance,
    labelAgreementPreserved: summary.effect.mistakeLabelAgreement.mean >= -0.01 - tolerance,
    effectiveSamplesPreserved: summary.variants['public-stratified'].effectiveSamples.mean >= budget * 0.95 - tolerance,
    runtimeControlled: summary.effect.runtimeRatio.mean <= 0.20 + tolerance,
    exactSampleBudget: trials.every((trial) => FIXED_STRATIFIED_VARIANTS.every((variant) => (
      trial.variants[variant].samplesUsed === budget
    ))),
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function summarizeFixedStratified(positions, {
  budgets = [120, 500],
  seed = 'mesa-quince-fixed-stratified-middle-v1',
  confidenceResamples = 1000,
} = {}) {
  const byBudget = {};
  for (const budget of budgets) {
    const variants = Object.fromEntries(FIXED_STRATIFIED_VARIANTS.map((variant) => [
      variant,
      summarizeVariant(positions, budget, variant, seed, confidenceResamples),
    ]));
    const effect = pairedEffect(positions, budget, seed, confidenceResamples);
    const selectionChangeRate = interval(positions.map((position) => {
      const trials = position.budgets[budget].trials;
      return trials.filter((trial) => trial.selectionChanged).length / trials.length;
    }), `${seed}|${budget}|selection-change`, confidenceResamples);
    const summary = { positions: positions.length, variants, effect, selectionChangeRate };
    summary.gate = fixedStratifiedBudgetGate(positions, budget, summary);
    byBudget[budget] = summary;
  }
  return {
    version: FIXED_STRATIFIED_VERSION,
    positions: positions.length,
    budgets: byBudget,
    gate: {
      passed: budgets.every((budget) => byBudget[budget].gate.passed),
      budgetResults: Object.fromEntries(budgets.map((budget) => [budget, byBudget[budget].gate.passed])),
    },
  };
}

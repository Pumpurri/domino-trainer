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

export const DEEP_REVIEW_STRATIFIED_VERSION = 'deep-review-middle-stratified-v1';
export const DEEP_REVIEW_VARIANTS = ['systematic', 'public-stratified'];
export const DEEP_REVIEW_SAFETY_PHASES = ['opening', 'late', 'block'];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

export function deepReviewRepresentativePolicy(phase) {
  return phase === 'middle' ? 'public-stratified' : 'systematic';
}

export function collectDeepReviewStratifiedCorpus({
  middlePositions = 100,
  safetyPositionsPerPhase = 20,
  middleMinimumBranching = 4,
  seed = 'mesa-quince-deep-review-stratified-v1',
  maxDeals = 24000,
} = {}) {
  const targets = {
    middle: middlePositions,
    ...Object.fromEntries(DEEP_REVIEW_SAFETY_PHASES.map((phase) => [phase, safetyPositionsPerPhase])),
  };
  const counts = Object.fromEntries(Object.keys(targets).map((phase) => [phase, 0]));
  const corpus = [];
  for (let dealIndex = 0; dealIndex < maxDeals; dealIndex += 1) {
    if (Object.keys(targets).every((phase) => counts[phase] >= targets[phase])) break;
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
        const minimumBranching = phase === 'middle' ? middleMinimumBranching : 2;
        if (targets[phase] !== undefined
          && counts[phase] < targets[phase]
          && legal.length >= minimumBranching) {
          counts[phase] += 1;
          corpus.push({
            id: phase === 'middle'
              ? `middle-holdout-${String(counts[phase]).padStart(3, '0')}`
              : `${phase}-safety-${String(counts[phase]).padStart(2, '0')}`,
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
  const missing = Object.keys(targets).filter((phase) => counts[phase] < targets[phase]);
  if (missing.length) {
    throw new Error(`Could not collect enough ${missing.join(', ')} positions after ${maxDeals} deals.`);
  }
  const order = ['middle', ...DEEP_REVIEW_SAFETY_PHASES];
  return corpus.sort((left, right) => (
    order.indexOf(left.phase) - order.indexOf(right.phase) || left.id.localeCompare(right.id)
  ));
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

function buildReference(game, budget, seedSalt, representativePolicy, playedKey, practicalGap) {
  const sampled = beliefForBudget(game, budget, seedSalt);
  const analysis = timedAnalysis(game, sampled, budget, representativePolicy);
  const ranked = analysis.ranked;
  return {
    policy: representativePolicy,
    topKey: moveKey(ranked[0]),
    acceptableKeys: plausibleBestMoveKeys(ranked, [ranked], practicalGap),
    rates: new Map(ranked.map((move) => [moveKey(move), move.winRate])),
    bestRate: ranked[0].winRate,
    choice: classifyAnalyzedChoice(ranked, playedKey),
    elapsedMs: analysis.elapsedMs,
  };
}

function evaluatedTrial(analysis, position, references, budget) {
  const topKey = moveKey(analysis.ranked[0]);
  const choice = classifyAnalyzedChoice(analysis.ranked, position.playedKey);
  const scores = references.map((reference) => {
    const selectedRate = reference.rates.get(topKey);
    if (selectedRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
    const regret = Math.max(0, reference.bestRate - selectedRate);
    return {
      policy: reference.policy,
      regret,
      withinOnePoint: regret <= 1,
      exactTopAgreement: topKey === reference.topKey,
      acceptableTopAgreement: reference.acceptableKeys.includes(topKey),
      mistakeLabelAgreement: choice.confidentMistake === reference.choice.confidentMistake,
      falsePositiveMistake: choice.confidentMistake && !reference.choice.confidentMistake,
    };
  });
  return {
    topKey,
    budget,
    samplesUsed: analysis.ranked[0].samples,
    effectiveSamples: analysis.ranked[0].effectiveSamples,
    elapsedMs: analysis.elapsedMs,
    robustRegret: scores.reduce((sum, score) => sum + score.regret, 0) / scores.length,
    worstRegret: Math.max(...scores.map((score) => score.regret)),
    withinBothReferences: scores.every((score) => score.withinOnePoint),
    referenceAgreement: scores.reduce((sum, score) => sum + (score.exactTopAgreement ? 1 : 0), 0) / scores.length,
    acceptableReferenceAgreement: scores.reduce((sum, score) => sum + (score.acceptableTopAgreement ? 1 : 0), 0) / scores.length,
    mistakeLabelAgreement: scores.reduce((sum, score) => sum + (score.mistakeLabelAgreement ? 1 : 0), 0) / scores.length,
    falsePositiveMistake: scores.some((score) => score.falsePositiveMistake),
    referenceScores: scores,
  };
}

function safetyEvaluation(position, game, budget, seed) {
  const sampled = beliefForBudget(game, budget, `${seed}|${position.id}|phase-safety`);
  const analysis = timedAnalysis(game, sampled, budget, 'systematic');
  const candidatePolicy = deepReviewRepresentativePolicy(position.phase);
  const candidate = candidatePolicy === 'systematic' ? analysis : null;
  return {
    candidatePolicy,
    samplesUsed: analysis.ranked[0].samples,
    topKey: moveKey(analysis.ranked[0]),
    candidateTopKey: candidate ? moveKey(candidate.ranked[0]) : null,
    exactReuse: candidate === analysis,
  };
}

export async function evaluateDeepReviewStratifiedPosition(position, {
  budget = 500,
  repetitions = 5,
  referenceBudget = 5000,
  recommendationPracticalGap = 1,
  seed = 'mesa-quince-deep-review-stratified-v1',
} = {}) {
  const safeGame = informationSafeBenchmarkGame(position.game);
  if (position.phase !== 'middle') {
    return {
      id: position.id,
      phase: position.phase,
      branching: position.branching,
      handSizes: position.game.hands.map((hand) => hand.length),
      eventCount: position.game.events.length,
      playedKey: position.playedKey,
      safety: safetyEvaluation(position, safeGame, budget, seed),
    };
  }

  const references = DEEP_REVIEW_VARIANTS.map((policy) => buildReference(
    safeGame,
    referenceBudget,
    `${seed}|${position.id}|reference-${policy}`,
    policy,
    position.playedKey,
    recommendationPracticalGap,
  ));
  const trials = [];
  const positionNumber = Number(position.id.split('-').at(-1)) || 0;
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const sampled = beliefForBudget(
      safeGame,
      budget,
      `${seed}|${position.id}|budget-${budget}|repeat-${repetition}`,
    );
    const order = (positionNumber + repetition) % 2
      ? DEEP_REVIEW_VARIANTS
      : [...DEEP_REVIEW_VARIANTS].reverse();
    const analyses = {};
    for (const policy of order) analyses[policy] = timedAnalysis(safeGame, sampled, budget, policy);
    const variants = Object.fromEntries(DEEP_REVIEW_VARIANTS.map((policy) => [
      policy,
      evaluatedTrial(analyses[policy], position, references, budget),
    ]));
    trials.push({
      repetition,
      variants,
      selectionChanged: variants.systematic.topKey !== variants['public-stratified'].topKey,
    });
  }
  return {
    id: position.id,
    phase: position.phase,
    branching: position.branching,
    handSizes: position.game.hands.map((hand) => hand.length),
    eventCount: position.game.events.length,
    playedKey: position.playedKey,
    references: Object.fromEntries(references.map((reference) => [reference.policy, {
      budget: referenceBudget,
      topKey: reference.topKey,
      acceptableTopKeys: reference.acceptableKeys,
      verdict: reference.choice.verdict,
      confidentMistake: reference.choice.confidentMistake,
      elapsedMs: reference.elapsedMs,
    }])),
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

function summarizeVariant(positions, variant, seed, resamples) {
  const positionMeans = (read) => positions.map((position) => {
    const values = position.trials.map((trial) => read(trial.variants[variant]));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  const metric = (label, read) => interval(
    positionMeans(read),
    `${seed}|${variant}|${label}`,
    resamples,
  );
  return {
    withinBothReferences: metric('within-both', (trial) => trial.withinBothReferences ? 1 : 0),
    robustRegret: metric('robust-regret', (trial) => trial.robustRegret),
    worstRegret: metric('worst-regret', (trial) => trial.worstRegret),
    referenceAgreement: metric('reference-agreement', (trial) => trial.referenceAgreement),
    acceptableReferenceAgreement: metric('acceptable-reference', (trial) => trial.acceptableReferenceAgreement),
    mistakeLabelAgreement: metric('label', (trial) => trial.mistakeLabelAgreement),
    falsePositiveMistake: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    effectiveSamples: metric('effective-samples', (trial) => trial.effectiveSamples),
    elapsedMs: metric('elapsed-ms', (trial) => trial.elapsedMs),
    repeatAcceptability: interval(positions.map((position) => (
      position.trials.every((trial) => trial.variants[variant].withinBothReferences) ? 1 : 0
    )), `${seed}|${variant}|repeat-acceptable`, resamples),
    repeatTopStability: interval(positions.map((position) => (
      new Set(position.trials.map((trial) => trial.variants[variant].topKey)).size === 1 ? 1 : 0
    )), `${seed}|${variant}|repeat-top`, resamples),
  };
}

function pairedEffect(positions, seed, resamples) {
  const metric = (label, read) => interval(positions.map((position) => {
    const differences = position.trials.map((trial) => (
      read(trial.variants['public-stratified']) - read(trial.variants.systematic)
    ));
    return differences.reduce((sum, value) => sum + value, 0) / differences.length;
  }), `${seed}|effect|${label}`, resamples);
  const runtimeRatios = positions.map((position) => {
    const control = position.trials.reduce((sum, trial) => sum + trial.variants.systematic.elapsedMs, 0);
    const candidate = position.trials.reduce((sum, trial) => sum + trial.variants['public-stratified'].elapsedMs, 0);
    return control ? candidate / control - 1 : 0;
  });
  return {
    withinBothReferences: metric('within-both', (trial) => trial.withinBothReferences ? 1 : 0),
    robustRegret: metric('robust-regret', (trial) => trial.robustRegret),
    worstRegret: metric('worst-regret', (trial) => trial.worstRegret),
    mistakeLabelAgreement: metric('label', (trial) => trial.mistakeLabelAgreement),
    falsePositiveMistake: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    effectiveSamples: metric('effective-samples', (trial) => trial.effectiveSamples),
    runtimeRatio: interval(runtimeRatios, `${seed}|effect|runtime-ratio`, resamples),
    repeatAcceptability: interval(positions.map((position) => {
      const candidate = position.trials.every((trial) => trial.variants['public-stratified'].withinBothReferences) ? 1 : 0;
      const control = position.trials.every((trial) => trial.variants.systematic.withinBothReferences) ? 1 : 0;
      return candidate - control;
    }), `${seed}|effect|repeat-acceptable`, resamples),
  };
}

export function deepReviewStratifiedGate(middlePositions, safetyPositions, budget, summary) {
  const tolerance = 1e-12;
  const middleTrials = middlePositions.flatMap((position) => position.trials);
  const safetyMismatches = safetyPositions.filter((position) => (
    position.safety.candidatePolicy !== 'systematic'
    || !position.safety.exactReuse
    || position.safety.topKey !== position.safety.candidateTopKey
    || position.safety.samplesUsed !== budget
  )).length;
  const checks = {
    exercised: summary.selectionChangeRate.mean >= 0.05,
    repeatAcceptabilityImproves: summary.effect.repeatAcceptability.mean > 0,
    robustRegretImproves: summary.effect.robustRegret.mean < 0,
    robustRegretBounded: summary.effect.robustRegret.high <= 0.10 + tolerance,
    worstRegretNoninferior: summary.effect.worstRegret.mean <= 0.05 + tolerance,
    withinBothNoninferior: summary.effect.withinBothReferences.mean >= -0.01 - tolerance,
    falsePositivesDoNotIncrease: summary.effect.falsePositiveMistake.mean <= tolerance,
    labelAgreementPreserved: summary.effect.mistakeLabelAgreement.mean >= -0.01 - tolerance,
    effectiveSamplesPreserved: summary.variants['public-stratified'].effectiveSamples.mean >= budget * 0.95 - tolerance,
    runtimeControlled: summary.effect.runtimeRatio.mean <= 0.20 + tolerance,
    exactSampleBudget: middleTrials.every((trial) => DEEP_REVIEW_VARIANTS.every((variant) => (
      trial.variants[variant].samplesUsed === budget
    ))),
    nonMiddleUnchanged: safetyMismatches === 0,
  };
  return { passed: Object.values(checks).every(Boolean), checks, safetyMismatches };
}

export function summarizeDeepReviewStratified(positions, {
  budget = 500,
  seed = 'mesa-quince-deep-review-stratified-v1',
  confidenceResamples = 1000,
} = {}) {
  const middlePositions = positions.filter((position) => position.phase === 'middle');
  const safetyPositions = positions.filter((position) => position.phase !== 'middle');
  const variants = Object.fromEntries(DEEP_REVIEW_VARIANTS.map((variant) => [
    variant,
    summarizeVariant(middlePositions, variant, seed, confidenceResamples),
  ]));
  const effect = pairedEffect(middlePositions, seed, confidenceResamples);
  const selectionChangeRate = interval(middlePositions.map((position) => (
    position.trials.filter((trial) => trial.selectionChanged).length / position.trials.length
  )), `${seed}|selection-change`, confidenceResamples);
  const referenceTopAgreement = interval(middlePositions.map((position) => (
    position.references.systematic.topKey === position.references['public-stratified'].topKey ? 1 : 0
  )), `${seed}|reference-top-agreement`, confidenceResamples);
  const summary = {
    version: DEEP_REVIEW_STRATIFIED_VERSION,
    positions: positions.length,
    middlePositions: middlePositions.length,
    safetyPositions: safetyPositions.length,
    safetyByPhase: Object.fromEntries(DEEP_REVIEW_SAFETY_PHASES.map((phase) => [
      phase,
      safetyPositions.filter((position) => position.phase === phase).length,
    ])),
    variants,
    effect,
    selectionChangeRate,
    referenceTopAgreement,
  };
  summary.gate = deepReviewStratifiedGate(middlePositions, safetyPositions, budget, summary);
  return summary;
}

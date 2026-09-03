import {
  analyzeMoves,
  applyMove,
  applyPass,
  chooseCasualMove,
  createBeliefState,
  detectStrategicPhase,
  endsOf,
  engineTesting,
  legalMovesFor,
  seededRandom,
} from '../app/domino-engine.ts';
import { createMatchedDeal, gameFromMatchedDeal } from './benchmark-core.mjs';

export const RELIABILITY_PHASES = ['opening', 'middle', 'late', 'block'];
export const RELIABILITY_BRANCHING_BANDS = ['2 moves', '3 to 5 moves', '6 or more moves'];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

function branchingBand(branching) {
  if (branching <= 2) return '2 moves';
  if (branching <= 5) return '3 to 5 moves';
  return '6 or more moves';
}

function percentile(sorted, probability) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function informationSafeBenchmarkGame(game) {
  return {
    ...game,
    hands: game.hands.map((hand, player) => player === 0
      ? hand.map((tile) => ({ ...tile }))
      : hand.map((_, index) => ({ id: `reliability-hidden-${player}-${index}`, a: -1, b: -1 }))),
  };
}

export function collectDecisionCorpus({
  positionsPerPhase = 4,
  seed = 'mesa-quince-reliability-v1',
  maxDeals = 2400,
} = {}) {
  const positions = [];
  const counts = Object.fromEntries(RELIABILITY_PHASES.map((phase) => [phase, 0]));
  for (let dealIndex = 0; dealIndex < maxDeals; dealIndex += 1) {
    if (RELIABILITY_PHASES.every((phase) => counts[phase] >= positionsPerPhase)) break;
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
        if (counts[phase] < positionsPerPhase) {
          const phaseIndex = counts[phase];
          positions.push({
            id: `${phase}-${String(phaseIndex + 1).padStart(2, '0')}`,
            phase,
            game,
            playedKey: moveKey(selected),
          });
          counts[phase] += 1;
        }
      }
      game = applyMove(game, selected);
    }
  }
  const missing = RELIABILITY_PHASES.filter((phase) => counts[phase] < positionsPerPhase);
  if (missing.length) throw new Error(`Could not collect enough ${missing.join(', ')} positions after ${maxDeals} deals.`);
  return positions.sort((left, right) => (
    RELIABILITY_PHASES.indexOf(left.phase) - RELIABILITY_PHASES.indexOf(right.phase)
    || left.id.localeCompare(right.id)
  ));
}

export function particleCountForBudget(budget) {
  if (budget <= 120) return 900;
  if (budget <= 500) return 1200;
  return Math.ceil(budget * 1.5);
}

function pairedDifference(best, chosen) {
  if (!best || !chosen || moveKey(best) === moveKey(chosen)) return { gap: 0, interval: [0, 0] };
  const bestWins = best.treeSearch.pairedBaseWins;
  const chosenWins = chosen.treeSearch.pairedBaseWins;
  const bestWeights = best.treeSearch.pairedBaseWeights;
  const chosenWeights = chosen.treeSearch.pairedBaseWeights;
  const count = Math.min(bestWins.length, chosenWins.length, bestWeights.length, chosenWeights.length);
  if (!count) {
    const gap = best.winRate - chosen.winRate;
    const spread = Math.sqrt(best.margin ** 2 + chosen.margin ** 2);
    return { gap, interval: [gap - spread, gap + spread] };
  }
  const differences = Array.from({ length: count }, (_, index) => bestWins[index] - chosenWins[index]);
  const weights = Array.from({ length: count }, (_, index) => (bestWeights[index] + chosenWeights[index]) / 2);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const squaredWeight = weights.reduce((sum, weight) => sum + weight * weight, 0);
  const mean = totalWeight
    ? differences.reduce((sum, difference, index) => sum + difference * weights[index], 0) / totalWeight
    : 0;
  const variance = totalWeight
    ? differences.reduce((sum, difference, index) => sum + weights[index] * (difference - mean) ** 2, 0) / totalWeight
    : 0;
  const effectiveSamples = squaredWeight ? totalWeight * totalWeight / squaredWeight : count;
  const spread = 1.96 * Math.sqrt(variance / Math.max(1, effectiveSamples));
  return { gap: mean * 100, interval: [(mean - spread) * 100, (mean + spread) * 100] };
}

export function classifyAnalyzedChoice(ranked, playedKey) {
  const best = ranked[0];
  const chosen = ranked.find((move) => moveKey(move) === playedKey);
  if (!best || !chosen) throw new Error(`Played move ${playedKey} is missing from the analysis.`);
  const difference = pairedDifference(best, chosen);
  const definitelyWorse = moveKey(best) !== moveKey(chosen) && difference.interval[0] > 0;
  const verdict = moveKey(best) === moveKey(chosen)
    ? 'best'
    : !definitelyWorse || difference.gap < 3
      ? 'close'
      : difference.gap < 10
        ? 'slight'
        : difference.gap < 20
          ? 'mistake'
          : 'big-mistake';
  return {
    verdict,
    confidentMistake: ['slight', 'mistake', 'big-mistake'].includes(verdict) && difference.interval[0] > 0,
    gap: difference.gap,
    interval: difference.interval,
  };
}

function exactOracleKeys(game, maximumTiles = 15) {
  if (game.hands.reduce((sum, hand) => sum + hand.length, 0) > maximumTiles) return null;
  const legal = legalMovesFor(game.hands[0], game.chain);
  if (legal.length < 2) return null;
  const outcomes = legal.map((move) => {
    const next = applyMove(game, move);
    if (next.phase !== 'playing') return { key: moveKey(move), utility: next.result?.winner === 0 ? 1 : 0 };
    const [left, right] = endsOf(next.chain);
    const solved = engineTesting.solveEndgame(
      next.hands,
      left,
      right,
      next.current,
      next.consecutivePasses,
      new Map(),
    );
    return { key: moveKey(move), utility: solved.utility[0] };
  });
  const best = Math.max(...outcomes.map(({ utility }) => utility));
  return outcomes.filter(({ utility }) => utility === best).map(({ key }) => key);
}

function runAnalysis(safeGame, budget, seedSalt) {
  const particleCount = particleCountForBudget(budget);
  const beliefState = createBeliefState(safeGame, 0, particleCount, undefined, seedSalt);
  const started = performance.now();
  const ranked = analyzeMoves(safeGame, particleCount, beliefState, undefined, { representativeLimit: budget });
  return { ranked, elapsedMs: performance.now() - started };
}

export function evaluateReliabilityPosition(position, {
  budgets = [120, 500, 1000, 2000],
  repetitions = 2,
  referenceBudget = 2000,
  seed = 'mesa-quince-reliability-v1',
} = {}) {
  const safeGame = informationSafeBenchmarkGame(position.game);
  const reference = runAnalysis(safeGame, referenceBudget, `${seed}|${position.id}|reference`);
  const referenceTopKey = moveKey(reference.ranked[0]);
  const referenceChoice = classifyAnalyzedChoice(reference.ranked, position.playedKey);
  const referenceRates = new Map(reference.ranked.map((move) => [moveKey(move), move.winRate]));
  const referenceBestRate = reference.ranked[0].winRate;
  const exactKeys = exactOracleKeys(position.game);
  const byBudget = {};

  budgets.forEach((budget) => {
    const trials = [];
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const analysis = runAnalysis(safeGame, budget, `${seed}|${position.id}|budget-${budget}|repeat-${repetition}`);
      const topKey = moveKey(analysis.ranked[0]);
      const choice = classifyAnalyzedChoice(analysis.ranked, position.playedKey);
      const selectedReferenceRate = referenceRates.get(topKey);
      if (selectedReferenceRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
      trials.push({
        repetition,
        topKey,
        topAgreement: topKey === referenceTopKey,
        regret: Math.max(0, referenceBestRate - selectedReferenceRate),
        withinOnePoint: referenceBestRate - selectedReferenceRate <= 1,
        verdict: choice.verdict,
        exactLabelAgreement: choice.verdict === referenceChoice.verdict,
        mistakeLabelAgreement: choice.confidentMistake === referenceChoice.confidentMistake,
        falsePositiveMistake: choice.confidentMistake && !referenceChoice.confidentMistake,
        falseNegativeMistake: !choice.confidentMistake && referenceChoice.confidentMistake,
        intervalCoverage: choice.interval[0] <= referenceChoice.gap && choice.interval[1] >= referenceChoice.gap,
        exactOracleAgreement: exactKeys ? exactKeys.includes(topKey) : null,
        elapsedMs: analysis.elapsedMs,
      });
    }
    byBudget[budget] = { trials };
  });

  return {
    id: position.id,
    phase: position.phase,
    branching: legalMovesFor(position.game.hands[0], position.game.chain).length,
    handSizes: position.game.hands.map((hand) => hand.length),
    eventCount: position.game.events.length,
    playedKey: position.playedKey,
    reference: {
      budget: referenceBudget,
      topKey: referenceTopKey,
      verdict: referenceChoice.verdict,
      confidentMistake: referenceChoice.confidentMistake,
      gap: referenceChoice.gap,
      interval: referenceChoice.interval,
      clearRecommendation: reference.ranked.length < 2
        || pairedDifference(reference.ranked[0], reference.ranked[1]).interval[0] > 0,
      exactOracleAgreement: exactKeys ? exactKeys.includes(referenceTopKey) : null,
      elapsedMs: reference.elapsedMs,
    },
    exactOracleKeys: exactKeys,
    budgets: byBudget,
  };
}

function intervalForPositionMeans(values, seed, resamples) {
  if (!values.length) return { mean: 0, low: 0, high: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1 || resamples <= 0) return { mean, low: mean, high: mean };
  const random = seededRandom(seed);
  const estimates = [];
  for (let sample = 0; sample < resamples; sample += 1) {
    let total = 0;
    for (let draw = 0; draw < values.length; draw += 1) total += values[Math.floor(random() * values.length)];
    estimates.push(total / values.length);
  }
  estimates.sort((left, right) => left - right);
  return { mean, low: percentile(estimates, 0.025), high: percentile(estimates, 0.975) };
}

function summarizeBudget(positionResults, budget, seed, confidenceResamples) {
  const trialValues = (read) => positionResults.map((position) => {
    const trials = position.budgets[budget].trials;
    return trials.reduce((sum, trial) => sum + read(trial), 0) / trials.length;
  });
  const allTrials = positionResults.flatMap((position) => position.budgets[budget].trials);
  const stablePositions = positionResults.map((position) => {
    const keys = position.budgets[budget].trials.map(({ topKey }) => topKey);
    return new Set(keys).size === 1 ? 1 : 0;
  });
  const acceptablyStablePositions = positionResults.map((position) => (
    position.budgets[budget].trials.every(({ withinOnePoint }) => withinOnePoint) ? 1 : 0
  ));
  const exactPositions = positionResults.filter((position) => position.exactOracleKeys);
  const metric = (label, read) => intervalForPositionMeans(
    trialValues(read),
    `${seed}|${budget}|${label}`,
    confidenceResamples,
  );
  const runtimes = allTrials.map(({ elapsedMs }) => elapsedMs).sort((left, right) => left - right);
  return {
    positions: positionResults.length,
    trials: allTrials.length,
    topAgreement: metric('top-agreement', (trial) => trial.topAgreement ? 1 : 0),
    withinOnePoint: metric('within-one-point', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    exactLabelAgreement: metric('exact-label-agreement', (trial) => trial.exactLabelAgreement ? 1 : 0),
    mistakeLabelAgreement: metric('mistake-label-agreement', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistakes: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    falseNegativeMistakes: metric('false-negative', (trial) => trial.falseNegativeMistake ? 1 : 0),
    intervalCoverage: metric('interval-coverage', (trial) => trial.intervalCoverage ? 1 : 0),
    repeatStability: intervalForPositionMeans(stablePositions, `${seed}|${budget}|repeat-stability`, confidenceResamples),
    repeatAcceptability: intervalForPositionMeans(acceptablyStablePositions, `${seed}|${budget}|repeat-acceptability`, confidenceResamples),
    exactOracleAgreement: exactPositions.length
      ? intervalForPositionMeans(exactPositions.map((position) => {
        const trials = position.budgets[budget].trials;
        return trials.filter(({ exactOracleAgreement }) => exactOracleAgreement).length / trials.length;
      }), `${seed}|${budget}|exact-oracle`, confidenceResamples)
      : null,
    runtimeMs: {
      mean: runtimes.length ? runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length : 0,
      p95: percentile(runtimes, 0.95),
    },
  };
}

export function summarizeReliability(positionResults, {
  budgets = [120, 500, 1000, 2000],
  seed = 'mesa-quince-reliability-v1',
  confidenceResamples = 1000,
} = {}) {
  const summarizeGroup = (group, label) => Object.fromEntries(budgets.map((budget) => [
    budget,
    summarizeBudget(group, budget, `${seed}|${label}`, confidenceResamples),
  ]));
  const exactPositions = positionResults.filter((position) => position.exactOracleKeys);
  return {
    positions: positionResults.length,
    phaseCounts: Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
      phase,
      positionResults.filter((position) => position.phase === phase).length,
    ])),
    reference: {
      budget: positionResults[0]?.reference.budget ?? 0,
      clearRecommendations: positionResults.filter((position) => position.reference.clearRecommendation).length,
      exactPositions: exactPositions.length,
      exactOracleAgreement: exactPositions.length
        ? exactPositions.filter((position) => position.reference.exactOracleAgreement).length / exactPositions.length
        : null,
      runtimeMs: {
        mean: positionResults.length
          ? positionResults.reduce((sum, position) => sum + position.reference.elapsedMs, 0) / positionResults.length
          : 0,
      },
    },
    overall: summarizeGroup(positionResults, 'overall'),
    byPhase: Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
      phase,
      summarizeGroup(positionResults.filter((position) => position.phase === phase), phase),
    ])),
    branchingCounts: Object.fromEntries(RELIABILITY_BRANCHING_BANDS.map((band) => [
      band,
      positionResults.filter((position) => branchingBand(position.branching) === band).length,
    ])),
    byBranching: Object.fromEntries(RELIABILITY_BRANCHING_BANDS.map((band) => [
      band,
      summarizeGroup(positionResults.filter((position) => branchingBand(position.branching) === band), `branching-${band}`),
    ])),
  };
}

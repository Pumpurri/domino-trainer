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
import {
  ADAPTIVE_ANALYSIS_VERSION,
  DEFAULT_ADAPTIVE_STAGES,
  pairedRatedMoveDifference,
  runAdaptiveAnalysis,
} from '../app/adaptive-analysis.ts';
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

export function classifyAnalyzedChoice(ranked, playedKey) {
  const best = ranked[0];
  const chosen = ranked.find((move) => moveKey(move) === playedKey);
  if (!best || !chosen) throw new Error(`Played move ${playedKey} is missing from the analysis.`);
  const difference = pairedRatedMoveDifference(best, chosen);
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

async function runAdaptiveBenchmarkAnalysis(safeGame, playedKey, stages, seedSalt) {
  const started = performance.now();
  const adaptive = await runAdaptiveAnalysis({
    stages,
    playedKey,
    analyzeBatch: (batchSamples, stageIndex) => runAnalysis(
      safeGame,
      batchSamples,
      `${seedSalt}|stage-${stageIndex}|batch-${batchSamples}`,
    ).ranked,
  });
  return { adaptive, ranked: adaptive.ranked, elapsedMs: performance.now() - started };
}

function evaluatedTrial({
  repetition,
  ranked,
  elapsedMs,
  choice,
  referenceTopKey,
  referenceChoice,
  referenceRates,
  referenceBestRate,
  exactKeys,
  metadata = {},
}) {
  const topKey = moveKey(ranked[0]);
  const selectedReferenceRate = referenceRates.get(topKey);
  if (selectedReferenceRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
  return {
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
    elapsedMs,
    ...metadata,
  };
}

export async function evaluateReliabilityPosition(position, {
  budgets = [120, 500, 1000, 2000],
  repetitions = 2,
  referenceBudget = 2000,
  includeAdaptive = true,
  adaptiveStages = DEFAULT_ADAPTIVE_STAGES,
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

  for (const budget of budgets) {
    const trials = [];
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const analysis = runAnalysis(safeGame, budget, `${seed}|${position.id}|budget-${budget}|repeat-${repetition}`);
      const choice = classifyAnalyzedChoice(analysis.ranked, position.playedKey);
      trials.push(evaluatedTrial({
        repetition,
        ranked: analysis.ranked,
        elapsedMs: analysis.elapsedMs,
        choice,
        referenceTopKey,
        referenceChoice,
        referenceRates,
        referenceBestRate,
        exactKeys,
      }));
    }
    byBudget[budget] = { trials };
  }

  const adaptiveTrials = [];
  if (includeAdaptive) {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const analysis = await runAdaptiveBenchmarkAnalysis(
        safeGame,
        position.playedKey,
        adaptiveStages,
        `${seed}|${position.id}|adaptive|repeat-${repetition}`,
      );
      adaptiveTrials.push(evaluatedTrial({
        repetition,
        ranked: analysis.ranked,
        elapsedMs: analysis.elapsedMs,
        choice: analysis.adaptive.choice,
        referenceTopKey,
        referenceChoice,
        referenceRates,
        referenceBestRate,
        exactKeys,
        metadata: {
          samplesUsed: analysis.adaptive.samplesUsed,
          stoppedAt: analysis.adaptive.stoppedAt,
          stopReason: analysis.adaptive.stopReason,
          recommendationConfidence: analysis.adaptive.recommendationConfidence,
          stages: analysis.adaptive.stages,
        },
      }));
    }
  }

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
        || pairedRatedMoveDifference(reference.ranked[0], reference.ranked[1]).interval[0] > 0,
      exactOracleAgreement: exactKeys ? exactKeys.includes(referenceTopKey) : null,
      elapsedMs: reference.elapsedMs,
    },
    exactOracleKeys: exactKeys,
    budgets: byBudget,
    adaptive: includeAdaptive ? {
      version: ADAPTIVE_ANALYSIS_VERSION,
      stages: [...adaptiveStages],
      trials: adaptiveTrials,
    } : null,
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

function summarizeTrials(positionResults, trialsFor, seed, confidenceResamples) {
  const trialValues = (read) => positionResults.map((position) => {
    const trials = trialsFor(position);
    return trials.reduce((sum, trial) => sum + read(trial), 0) / trials.length;
  });
  const allTrials = positionResults.flatMap(trialsFor);
  const stablePositions = positionResults.map((position) => {
    const keys = trialsFor(position).map(({ topKey }) => topKey);
    return new Set(keys).size === 1 ? 1 : 0;
  });
  const acceptablyStablePositions = positionResults.map((position) => (
    trialsFor(position).every(({ withinOnePoint }) => withinOnePoint) ? 1 : 0
  ));
  const exactPositions = positionResults.filter((position) => position.exactOracleKeys);
  const metric = (label, read) => intervalForPositionMeans(
    trialValues(read),
    `${seed}|${label}`,
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
    repeatStability: intervalForPositionMeans(stablePositions, `${seed}|repeat-stability`, confidenceResamples),
    repeatAcceptability: intervalForPositionMeans(acceptablyStablePositions, `${seed}|repeat-acceptability`, confidenceResamples),
    exactOracleAgreement: exactPositions.length
      ? intervalForPositionMeans(exactPositions.map((position) => {
        const trials = trialsFor(position);
        return trials.filter(({ exactOracleAgreement }) => exactOracleAgreement).length / trials.length;
      }), `${seed}|exact-oracle`, confidenceResamples)
      : null,
    runtimeMs: {
      mean: runtimes.length ? runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length : 0,
      p95: percentile(runtimes, 0.95),
    },
  };
}

function summarizeBudget(positionResults, budget, seed, confidenceResamples) {
  return summarizeTrials(
    positionResults,
    (position) => position.budgets[budget].trials,
    `${seed}|budget-${budget}`,
    confidenceResamples,
  );
}

function summarizeAdaptive(positionResults, seed, confidenceResamples) {
  const relevant = positionResults.filter((position) => position.adaptive?.trials?.length);
  const trialsFor = (position) => position.adaptive.trials;
  const summary = summarizeTrials(relevant, trialsFor, `${seed}|adaptive`, confidenceResamples);
  const allTrials = relevant.flatMap(trialsFor);
  const samples = allTrials.map(({ samplesUsed }) => samplesUsed).sort((left, right) => left - right);
  const stoppingStages = {};
  allTrials.forEach(({ stoppedAt }) => {
    stoppingStages[stoppedAt] = (stoppingStages[stoppedAt] ?? 0) + 1;
  });
  const positionSampleMeans = relevant.map((position) => {
    const values = trialsFor(position).map(({ samplesUsed }) => samplesUsed);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  const rate = (label, read) => intervalForPositionMeans(relevant.map((position) => {
    const trials = trialsFor(position);
    return trials.reduce((sum, trial) => sum + read(trial), 0) / trials.length;
  }), `${seed}|adaptive|${label}`, confidenceResamples);
  const meanSamplesFor = (positions, label) => intervalForPositionMeans(positions.map((position) => {
    const trials = trialsFor(position);
    return trials.reduce((sum, trial) => sum + trial.samplesUsed, 0) / trials.length;
  }), `${seed}|adaptive|samples-${label}`, confidenceResamples);
  return {
    ...summary,
    samplesUsed: {
      mean: intervalForPositionMeans(positionSampleMeans, `${seed}|adaptive|samples`, confidenceResamples),
      p50: percentile(samples, 0.5),
      p95: percentile(samples, 0.95),
      maximum: samples.at(-1) ?? 0,
    },
    stoppingStages,
    hardCapRate: rate('hard-cap', (trial) => trial.stopReason === 'hard-cap' ? 1 : 0),
    uncertainRate: rate('uncertain', (trial) => trial.recommendationConfidence === 'uncertain' ? 1 : 0),
    samplesByReferenceClarity: {
      clear: meanSamplesFor(relevant.filter((position) => position.reference.clearRecommendation), 'clear'),
      unclear: meanSamplesFor(relevant.filter((position) => !position.reference.clearRecommendation), 'unclear'),
    },
  };
}

export function reliabilityGate(row, positions) {
  const checks = {
    corpusSize: positions >= 16,
    withinOnePoint: row.withinOnePoint.mean >= 0.9,
    meanRegret: row.meanRegret.mean <= 1,
    mistakeLabelAgreement: row.mistakeLabelAgreement.mean >= 0.95,
    falsePositiveMistakes: row.falsePositiveMistakes.mean <= 0.02,
    repeatAcceptability: row.repeatAcceptability.mean >= 0.9,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
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
  const summarizeAdaptiveGroup = (group, label) => summarizeAdaptive(
    group,
    `${seed}|${label}`,
    confidenceResamples,
  );
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
    adaptive: summarizeAdaptiveGroup(positionResults, 'overall'),
    byPhase: Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
      phase,
      summarizeGroup(positionResults.filter((position) => position.phase === phase), phase),
    ])),
    adaptiveByPhase: Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
      phase,
      summarizeAdaptiveGroup(positionResults.filter((position) => position.phase === phase), phase),
    ])),
    branchingCounts: Object.fromEntries(RELIABILITY_BRANCHING_BANDS.map((band) => [
      band,
      positionResults.filter((position) => branchingBand(position.branching) === band).length,
    ])),
    byBranching: Object.fromEntries(RELIABILITY_BRANCHING_BANDS.map((band) => [
      band,
      summarizeGroup(positionResults.filter((position) => branchingBand(position.branching) === band), `branching-${band}`),
    ])),
    adaptiveByBranching: Object.fromEntries(RELIABILITY_BRANCHING_BANDS.map((band) => [
      band,
      summarizeAdaptiveGroup(
        positionResults.filter((position) => branchingBand(position.branching) === band),
        `branching-${band}`,
      ),
    ])),
  };
}

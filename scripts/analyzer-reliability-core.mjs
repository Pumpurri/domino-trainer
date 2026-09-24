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
  ADAPTIVE_SAMPLING_VERSION,
  DEFAULT_ADAPTIVE_STAGES,
  ADAPTIVE_SELECTION_VERSION,
  adaptiveAnalysisVersion,
  pairedRatedMoveDifference,
  plausibleBestMoveKeys,
  runAdaptiveAnalysis,
  selectAdaptiveMove,
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

function runAnalysis(safeGame, budget, seedSalt, rootCandidateKeys, rolloutPolicy = 'current') {
  let particleTarget = particleCountForBudget(budget);
  let beliefState;
  let beliefRetries = 0;
  for (; beliefRetries < 4; beliefRetries += 1) {
    beliefState = createBeliefState(safeGame, 0, particleTarget, undefined, seedSalt);
    if (beliefState.particles.length >= budget) break;
    if (!beliefState.particles.length) break;
    particleTarget = Math.ceil(
      particleTarget * budget / beliefState.particles.length * 1.2,
    );
  }
  if (!beliefState || beliefState.particles.length < budget) {
    throw new Error(
      `Could not sample ${budget} valid hidden deals after ${beliefRetries} expanded attempts; found ${beliefState?.particles.length ?? 0}.`,
    );
  }
  const started = performance.now();
  const ranked = analyzeMoves(safeGame, particleTarget, beliefState, undefined, {
    representativeLimit: budget,
    rootCandidateKeys,
    rolloutPolicy,
  });
  return {
    ranked,
    elapsedMs: performance.now() - started,
    beliefRetries,
    beliefTarget: particleTarget,
  };
}

async function runAdaptiveBenchmarkAnalysis(
  safeGame,
  playedKey,
  phase,
  branching,
  stages,
  seedSalt,
  recommendationPracticalGap,
  mistakePolicy,
  refinementSamples,
  refinementMaximumGap,
  samplingMode = 'independent',
  rolloutPolicy = 'current',
) {
  const started = performance.now();
  let preRefinementElapsedMs = 0;
  let beliefRetries = 0;
  const batches = [];
  const finalBudget = stages.at(-1);
  const sharedBelief = samplingMode === 'shared-pool'
    ? createBeliefState(
      safeGame,
      0,
      particleCountForBudget(finalBudget),
      undefined,
      `${seedSalt}|shared-pool`,
    )
    : null;
  let sharedOffset = 0;
  const adaptive = await runAdaptiveAnalysis({
    stages,
    playedKey,
    phase,
    branching,
    recommendationPracticalGap,
    refinementSamples,
    refinementMaximumGap,
    mistakePolicy,
    analyzeBatch: (batchSamples, stageIndex, candidateKeys) => {
      if (sharedBelief && candidateKeys) {
        throw new Error('Shared-pool sampling does not support candidate-only refinement.');
      }
      const batch = sharedBelief
        ? (() => {
          const batchStarted = performance.now();
          const ranked = analyzeMoves(safeGame, sharedBelief.targetCount, sharedBelief, undefined, {
            representativeLimit: batchSamples,
            representativePoolSize: finalBudget,
            representativeOffset: sharedOffset,
            rolloutPolicy,
          });
          sharedOffset += batchSamples;
          return { ranked, elapsedMs: performance.now() - batchStarted };
        })()
        : runAnalysis(
          safeGame,
          batchSamples,
          `${seedSalt}|stage-${stageIndex}|batch-${batchSamples}`,
          candidateKeys,
          rolloutPolicy,
        );
      batches.push(batch.ranked);
      beliefRetries += batch.beliefRetries ?? 0;
      if (!candidateKeys) preRefinementElapsedMs += batch.elapsedMs;
      return batch.ranked;
    },
  });
  return {
    adaptive,
    ranked: adaptive.ranked,
    elapsedMs: performance.now() - started,
    preRefinementElapsedMs,
    batches,
    beliefRetries,
  };
}

function adaptiveTrialMetadata(snapshot, playedKey, refinementSamples = 0, refinementKeys = []) {
  return {
    samplesUsed: snapshot.samplesUsed,
    stoppedAt: snapshot.stoppedAt,
    stopReason: snapshot.stopReason,
    recommendationConfidence: snapshot.recommendationConfidence,
    recommendationKeys: snapshot.plausibleBestKeys,
    refinementSamples,
    refinementKeys,
    minimumSamples: snapshot.minimumSamples,
    mistakeConfidence: snapshot.choice?.mistakeConfidence ?? 'uncertain',
    mistakeAssessment: snapshot.choice?.assessment ?? 'uncertain',
    playedInPlausibleBest: snapshot.choice?.plausibleBestKeys.includes(playedKey) ?? false,
    choiceGap: snapshot.choice?.gap ?? 0,
    choiceInterval: snapshot.choice?.interval ?? [0, 0],
    choiceBatchAgreement: snapshot.choice?.batchAgreement ?? 0,
    choicePracticalBatchAgreement: snapshot.choice?.practicalBatchAgreement ?? 0,
    choiceBatchGaps: snapshot.choice?.batchGaps ?? [],
    stages: snapshot.stages,
  };
}

function evaluatedTrial({
  repetition,
  ranked,
  selectedKey,
  elapsedMs,
  choice,
  referenceTopKey,
  referenceBestKeys,
  referenceChoice,
  referenceRates,
  referenceBestRate,
  exactKeys,
  metadata = {},
}) {
  const topKey = selectedKey ?? moveKey(ranked[0]);
  const selectedReferenceRate = referenceRates.get(topKey);
  if (selectedReferenceRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
  return {
    repetition,
    topKey,
    exactTopAgreement: topKey === referenceTopKey,
    topAgreement: referenceBestKeys.includes(topKey),
    regret: Math.max(0, referenceBestRate - selectedReferenceRate),
    withinOnePoint: referenceBestRate - selectedReferenceRate <= 1,
    verdict: choice.verdict,
    exactLabelAgreement: choice.verdict === referenceChoice.verdict,
    mistakeLabelAgreement: choice.confidentMistake === referenceChoice.confidentMistake,
    falsePositiveMistake: choice.confidentMistake && !referenceChoice.confidentMistake,
    falseNegativeMistake: !choice.confidentMistake && referenceChoice.confidentMistake,
    mistakeAbstained: choice.mistakeConfidence === 'uncertain',
    mistakeDecisionCorrect: choice.mistakeConfidence === 'uncertain'
      ? null
      : choice.confidentMistake === referenceChoice.confidentMistake,
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
  adaptiveRecommendationGap = 1,
  adaptiveMistakePolicy,
  adaptiveRefinementSamples = 0,
  adaptiveRefinementMaximumGap = 3,
  adaptiveSelectionPolicies = [],
  adaptiveSamplingPolicies = [],
  rolloutPolicy = 'current',
  seed = 'mesa-quince-reliability-v1',
} = {}) {
  if (adaptiveSamplingPolicies.length && adaptiveRefinementSamples > 0) {
    throw new Error('Adaptive sampling experiments require candidate-only refinement to be disabled.');
  }
  const safeGame = informationSafeBenchmarkGame(position.game);
  const reference = runAnalysis(
    safeGame,
    referenceBudget,
    `${seed}|${position.id}|reference`,
    undefined,
    rolloutPolicy,
  );
  const referenceTopKey = moveKey(reference.ranked[0]);
  const referenceBestKeys = plausibleBestMoveKeys(reference.ranked, [reference.ranked], adaptiveRecommendationGap);
  const referenceChoice = classifyAnalyzedChoice(reference.ranked, position.playedKey);
  const referenceRates = new Map(reference.ranked.map((move) => [moveKey(move), move.winRate]));
  const referenceBestRate = reference.ranked[0].winRate;
  const exactKeys = exactOracleKeys(position.game);
  const byBudget = {};

  for (const budget of budgets) {
    const trials = [];
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const analysis = runAnalysis(
        safeGame,
        budget,
        `${seed}|${position.id}|budget-${budget}|repeat-${repetition}`,
        undefined,
        rolloutPolicy,
      );
      const choice = classifyAnalyzedChoice(analysis.ranked, position.playedKey);
      trials.push(evaluatedTrial({
        repetition,
        ranked: analysis.ranked,
        elapsedMs: analysis.elapsedMs,
        choice,
        referenceTopKey,
        referenceBestKeys,
        referenceChoice,
        referenceRates,
        referenceBestRate,
        exactKeys,
        metadata: { recommendationKeys: [moveKey(analysis.ranked[0])] },
      }));
    }
    byBudget[budget] = { trials };
  }

  const adaptiveTrials = [];
  const adaptiveControlTrials = [];
  const adaptiveVariantTrials = Object.fromEntries(adaptiveSelectionPolicies.map((policy) => [policy, []]));
  const adaptiveSamplingVariantTrials = Object.fromEntries(adaptiveSamplingPolicies.map((policy) => [policy, []]));
  if (includeAdaptive) {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const analysis = await runAdaptiveBenchmarkAnalysis(
        safeGame,
        position.playedKey,
        position.phase,
        legalMovesFor(position.game.hands[0], position.game.chain).length,
        adaptiveStages,
        `${seed}|${position.id}|adaptive|repeat-${repetition}`,
        adaptiveRecommendationGap,
        adaptiveMistakePolicy,
        adaptiveRefinementSamples,
        adaptiveRefinementMaximumGap,
        'independent',
        rolloutPolicy,
      );
      if (adaptiveRefinementSamples > 0) {
        const control = analysis.adaptive.preRefinement ?? analysis.adaptive;
        adaptiveControlTrials.push(evaluatedTrial({
          repetition,
          ranked: control.ranked,
          elapsedMs: analysis.preRefinementElapsedMs,
          choice: control.choice,
          referenceTopKey,
          referenceBestKeys,
          referenceChoice,
          referenceRates,
          referenceBestRate,
          exactKeys,
          metadata: adaptiveTrialMetadata(control, position.playedKey),
        }));
      }
      adaptiveTrials.push(evaluatedTrial({
        repetition,
        ranked: analysis.ranked,
        elapsedMs: analysis.elapsedMs,
        choice: analysis.adaptive.choice,
        referenceTopKey,
        referenceBestKeys,
        referenceChoice,
        referenceRates,
        referenceBestRate,
        exactKeys,
        metadata: adaptiveTrialMetadata(
          analysis.adaptive,
          position.playedKey,
          analysis.adaptive.refinementSamples,
          analysis.adaptive.refinementKeys,
        ),
      }));
      for (const policy of adaptiveSamplingPolicies) {
        if (policy !== 'phase-aware') throw new Error(`Unknown adaptive sampling policy: ${policy}.`);
        if (position.phase !== 'middle') {
          adaptiveSamplingVariantTrials[policy].push({
            ...adaptiveTrials.at(-1),
            samplingPolicy: policy,
            selectionChanged: false,
            reusedControl: true,
          });
          continue;
        }
        const candidate = await runAdaptiveBenchmarkAnalysis(
          safeGame,
          position.playedKey,
          position.phase,
          legalMovesFor(position.game.hands[0], position.game.chain).length,
          adaptiveStages,
          `${seed}|${position.id}|adaptive-sampling-${policy}|repeat-${repetition}`,
          adaptiveRecommendationGap,
          adaptiveMistakePolicy,
          0,
          adaptiveRefinementMaximumGap,
          'shared-pool',
          rolloutPolicy,
        );
        adaptiveSamplingVariantTrials[policy].push(evaluatedTrial({
          repetition,
          ranked: candidate.ranked,
          elapsedMs: candidate.elapsedMs,
          choice: candidate.adaptive.choice,
          referenceTopKey,
          referenceBestKeys,
          referenceChoice,
          referenceRates,
          referenceBestRate,
          exactKeys,
          metadata: {
            ...adaptiveTrialMetadata(candidate.adaptive, position.playedKey),
            samplingPolicy: policy,
            selectionChanged: moveKey(candidate.ranked[0]) !== moveKey(analysis.ranked[0]),
            reusedControl: false,
          },
        }));
      }
      for (const policy of adaptiveSelectionPolicies) {
        const selection = selectAdaptiveMove({
          ranked: analysis.ranked,
          batches: analysis.batches,
          plausibleBestKeys: analysis.adaptive.plausibleBestKeys,
          policy,
          practicalGap: adaptiveRecommendationGap,
        });
        adaptiveVariantTrials[policy].push(evaluatedTrial({
          repetition,
          ranked: analysis.ranked,
          selectedKey: selection.selectedKey,
          elapsedMs: analysis.elapsedMs,
          choice: analysis.adaptive.choice,
          referenceTopKey,
          referenceBestKeys,
          referenceChoice,
          referenceRates,
          referenceBestRate,
          exactKeys,
          metadata: {
            ...adaptiveTrialMetadata(
              analysis.adaptive,
              position.playedKey,
              analysis.adaptive.refinementSamples,
              analysis.adaptive.refinementKeys,
            ),
            selectionPolicy: policy,
            selectionChanged: selection.selectedKey !== moveKey(analysis.ranked[0]),
            selectionEvidence: selection.candidates,
          },
        }));
      }
    }
  }

  return {
    id: position.id,
    rolloutPolicy,
    phase: position.phase,
    branching: legalMovesFor(position.game.hands[0], position.game.chain).length,
    handSizes: position.game.hands.map((hand) => hand.length),
    eventCount: position.game.events.length,
    playedKey: position.playedKey,
    reference: {
      budget: referenceBudget,
      topKey: referenceTopKey,
      acceptableTopKeys: referenceBestKeys,
      verdict: referenceChoice.verdict,
      confidentMistake: referenceChoice.confidentMistake,
      gap: referenceChoice.gap,
      interval: referenceChoice.interval,
      rates: Object.fromEntries(reference.ranked.map((move) => [moveKey(move), move.winRate])),
      clearRecommendation: reference.ranked.length < 2
        || pairedRatedMoveDifference(reference.ranked[0], reference.ranked[1]).interval[0] > 0,
      exactOracleAgreement: exactKeys ? exactKeys.includes(referenceTopKey) : null,
      elapsedMs: reference.elapsedMs,
    },
    exactOracleKeys: exactKeys,
    budgets: byBudget,
    adaptive: includeAdaptive ? {
      version: adaptiveAnalysisVersion(adaptiveRefinementSamples),
      stages: [...adaptiveStages],
      refinementSamples: adaptiveRefinementSamples,
      refinementMaximumGap: adaptiveRefinementMaximumGap,
      trials: adaptiveTrials,
    } : null,
    adaptiveControl: includeAdaptive && adaptiveRefinementSamples > 0 ? {
      version: adaptiveAnalysisVersion(0),
      stages: [...adaptiveStages],
      refinementSamples: 0,
      refinementMaximumGap: adaptiveRefinementMaximumGap,
      trials: adaptiveControlTrials,
    } : null,
    adaptiveVariants: includeAdaptive ? Object.fromEntries(adaptiveSelectionPolicies.map((policy) => [policy, {
      version: ADAPTIVE_SELECTION_VERSION,
      selectionPolicy: policy,
      stages: [...adaptiveStages],
      trials: adaptiveVariantTrials[policy],
    }])) : {},
    adaptiveSamplingVariants: includeAdaptive ? Object.fromEntries(adaptiveSamplingPolicies.map((policy) => [policy, {
      version: ADAPTIVE_SAMPLING_VERSION,
      samplingPolicy: policy,
      stages: [...adaptiveStages],
      trials: adaptiveSamplingVariantTrials[policy],
    }])) : {},
  };
}

export async function evaluateAnalyzerRolloutPosition(position, {
  repetitions = 3,
  referenceBudget = 5000,
  adaptiveStages = DEFAULT_ADAPTIVE_STAGES,
  adaptiveRecommendationGap = 1,
  adaptiveMistakePolicy,
  seed = 'mesa-quince-analyzer-rollout-v1',
} = {}) {
  const safeGame = informationSafeBenchmarkGame(position.game);
  const exactKeys = exactOracleKeys(position.game);
  const policies = ['current', 'exhaustive-forecast'];
  const positionNumber = Number(position.id.split('-').at(-1)) || 0;
  const policyOrder = (offset = 0) => (
    (positionNumber + offset) % 2 ? policies : [...policies].reverse()
  );
  const references = {};
  const referenceInternals = {};

  for (const policy of policyOrder()) {
    const analysis = runAnalysis(
      safeGame,
      referenceBudget,
      `${seed}|${position.id}|reference`,
      undefined,
      policy,
    );
    const topKey = moveKey(analysis.ranked[0]);
    const bestKeys = plausibleBestMoveKeys(
      analysis.ranked,
      [analysis.ranked],
      adaptiveRecommendationGap,
    );
    const choice = classifyAnalyzedChoice(analysis.ranked, position.playedKey);
    const rates = new Map(analysis.ranked.map((move) => [moveKey(move), move.winRate]));
    referenceInternals[policy] = {
      topKey,
      bestKeys,
      choice,
      rates,
      bestRate: analysis.ranked[0].winRate,
    };
    references[policy] = {
      budget: referenceBudget,
      topKey,
      acceptableTopKeys: bestKeys,
      verdict: choice.verdict,
      confidentMistake: choice.confidentMistake,
      gap: choice.gap,
      interval: choice.interval,
      clearRecommendation: analysis.ranked.length < 2
        || pairedRatedMoveDifference(analysis.ranked[0], analysis.ranked[1]).interval[0] > 0,
      exactOracleAgreement: exactKeys ? exactKeys.includes(topKey) : null,
      elapsedMs: analysis.elapsedMs,
      beliefRetries: analysis.beliefRetries,
      beliefTarget: analysis.beliefTarget,
      rates: Object.fromEntries(rates),
    };
  }

  const trials = Object.fromEntries(policies.map((policy) => [policy, []]));
  const paired = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const analyses = {};
    for (const policy of policyOrder(repetition)) {
      analyses[policy] = await runAdaptiveBenchmarkAnalysis(
        safeGame,
        position.playedKey,
        position.phase,
        legalMovesFor(position.game.hands[0], position.game.chain).length,
        adaptiveStages,
        `${seed}|${position.id}|adaptive|repeat-${repetition}`,
        adaptiveRecommendationGap,
        adaptiveMistakePolicy,
        0,
        3,
        'independent',
        policy,
      );
      const reference = referenceInternals[policy];
      trials[policy].push(evaluatedTrial({
        repetition,
        ranked: analyses[policy].ranked,
        elapsedMs: analyses[policy].elapsedMs,
        choice: analyses[policy].adaptive.choice,
        referenceTopKey: reference.topKey,
        referenceBestKeys: reference.bestKeys,
        referenceChoice: reference.choice,
        referenceRates: reference.rates,
        referenceBestRate: reference.bestRate,
        exactKeys,
        metadata: {
          ...adaptiveTrialMetadata(analyses[policy].adaptive, position.playedKey),
          rolloutPolicy: policy,
          beliefRetries: analyses[policy].beliefRetries,
        },
      }));
    }

    const control = trials.current.at(-1);
    const candidate = trials['exhaustive-forecast'].at(-1);
    const regretUnder = (policy, key) => {
      const reference = referenceInternals[policy];
      const rate = reference.rates.get(key);
      if (rate === undefined) throw new Error(`Reference ${policy} is missing ${key}.`);
      return Math.max(0, reference.bestRate - rate);
    };
    const controlCurrentRegret = regretUnder('current', control.topKey);
    const controlExhaustiveRegret = regretUnder('exhaustive-forecast', control.topKey);
    const candidateCurrentRegret = regretUnder('current', candidate.topKey);
    const candidateExhaustiveRegret = regretUnder('exhaustive-forecast', candidate.topKey);
    paired.push({
      repetition,
      controlTopKey: control.topKey,
      candidateTopKey: candidate.topKey,
      selectionChanged: control.topKey !== candidate.topKey,
      controlCurrentRegret,
      controlExhaustiveRegret,
      candidateCurrentRegret,
      candidateExhaustiveRegret,
      controlRobustRegret: (controlCurrentRegret + controlExhaustiveRegret) / 2,
      candidateRobustRegret: (candidateCurrentRegret + candidateExhaustiveRegret) / 2,
      controlWorstRegret: Math.max(controlCurrentRegret, controlExhaustiveRegret),
      candidateWorstRegret: Math.max(candidateCurrentRegret, candidateExhaustiveRegret),
      controlWithinOneOnBoth: controlCurrentRegret <= 1 && controlExhaustiveRegret <= 1,
      candidateWithinOneOnBoth: candidateCurrentRegret <= 1 && candidateExhaustiveRegret <= 1,
    });
  }

  return {
    id: position.id,
    phase: position.phase,
    branching: legalMovesFor(position.game.hands[0], position.game.chain).length,
    handSizes: position.game.hands.map((hand) => hand.length),
    eventCount: position.game.events.length,
    playedKey: position.playedKey,
    exactOracleKeys: exactKeys,
    references,
    policies: Object.fromEntries(policies.map((policy) => [policy, {
      rolloutPolicy: policy,
      stages: [...adaptiveStages],
      trials: trials[policy],
    }])),
    paired,
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
  const recommendationSetStablePositions = positionResults.map((position) => {
    const sets = trialsFor(position).map((trial) => new Set(trial.recommendationKeys ?? [trial.topKey]));
    const intersection = sets.slice(1).reduce(
      (remaining, keys) => new Set([...remaining].filter((key) => keys.has(key))),
      sets[0] ?? new Set(),
    );
    return intersection.size > 0 ? 1 : 0;
  });
  const decidedMistakeValues = positionResults.flatMap((position) => {
    const decided = trialsFor(position).filter((trial) => trial.mistakeDecisionCorrect !== null);
    return decided.length
      ? [decided.filter((trial) => trial.mistakeDecisionCorrect).length / decided.length]
      : [];
  });
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
    exactTopAgreement: metric('exact-top-agreement', (trial) => trial.exactTopAgreement ? 1 : 0),
    topAgreement: metric('top-agreement', (trial) => trial.topAgreement ? 1 : 0),
    withinOnePoint: metric('within-one-point', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    exactLabelAgreement: metric('exact-label-agreement', (trial) => trial.exactLabelAgreement ? 1 : 0),
    mistakeLabelAgreement: metric('mistake-label-agreement', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistakes: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    falseNegativeMistakes: metric('false-negative', (trial) => trial.falseNegativeMistake ? 1 : 0),
    mistakeAbstentionRate: metric('mistake-abstention', (trial) => trial.mistakeAbstained ? 1 : 0),
    decidedMistakeAccuracy: intervalForPositionMeans(
      decidedMistakeValues,
      `${seed}|decided-mistake-accuracy`,
      confidenceResamples,
    ),
    intervalCoverage: metric('interval-coverage', (trial) => trial.intervalCoverage ? 1 : 0),
    repeatStability: intervalForPositionMeans(stablePositions, `${seed}|repeat-stability`, confidenceResamples),
    repeatAcceptability: intervalForPositionMeans(acceptablyStablePositions, `${seed}|repeat-acceptability`, confidenceResamples),
    recommendationSetStability: intervalForPositionMeans(
      recommendationSetStablePositions,
      `${seed}|recommendation-set-stability`,
      confidenceResamples,
    ),
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

function summarizeAdaptive(
  positionResults,
  seed,
  confidenceResamples,
  readAdaptive = (position) => position.adaptive,
) {
  const relevant = positionResults.filter((position) => readAdaptive(position)?.trials?.length);
  const trialsFor = (position) => readAdaptive(position).trials;
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
    refinementRate: rate('refinement', (trial) => trial.refinementSamples > 0 ? 1 : 0),
    selectionChangeRate: rate('selection-change', (trial) => trial.selectionChanged ? 1 : 0),
    recommendationSetSize: intervalForPositionMeans(relevant.map((position) => {
      const trials = trialsFor(position);
      return trials.reduce((sum, trial) => sum + (trial.recommendationKeys?.length ?? 1), 0) / trials.length;
    }), `${seed}|adaptive|recommendation-set-size`, confidenceResamples),
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

export function adaptiveReliabilityGate(row, positions, fixedBaseline, baselineBudget) {
  const absolute = reliabilityGate(row, positions).checks;
  const checks = {
    ...absolute,
    withinOnePointNoninferior: row.withinOnePoint.mean >= fixedBaseline.withinOnePoint.mean - 0.03,
    meanRegretNoninferior: row.meanRegret.mean <= fixedBaseline.meanRegret.mean + 0.05,
    repeatAcceptabilityNoninferior: row.repeatAcceptability.mean >= fixedBaseline.repeatAcceptability.mean - 0.05,
    recommendationSetStability: row.recommendationSetStability.mean >= 0.95,
    sampleSavings: row.samplesUsed.mean.mean <= baselineBudget * 0.95,
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
  const summarizeAdaptiveGroup = (
    group,
    label,
    readAdaptive = (position) => position.adaptive,
  ) => summarizeAdaptive(
    group,
    `${seed}|${label}`,
    confidenceResamples,
    readAdaptive,
  );
  const adaptiveVariantPolicies = [...new Set(positionResults.flatMap((position) => (
    Object.keys(position.adaptiveVariants ?? {})
  )))].sort();
  const adaptiveSamplingVariantPolicies = [...new Set(positionResults.flatMap((position) => (
    Object.keys(position.adaptiveSamplingVariants ?? {})
  )))].sort();
  const summarizeVariantGroup = (group, label, policy) => summarizeAdaptiveGroup(
    group,
    label,
    (position) => position.adaptiveVariants?.[policy],
  );
  const summarizeSamplingVariantGroup = (group, label, policy) => summarizeAdaptiveGroup(
    group,
    label,
    (position) => position.adaptiveSamplingVariants?.[policy],
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
    adaptiveControl: positionResults.some((position) => position.adaptiveControl?.trials?.length)
      ? summarizeAdaptiveGroup(positionResults, 'overall', (position) => position.adaptiveControl)
      : null,
    adaptiveVariants: Object.fromEntries(adaptiveVariantPolicies.map((policy) => [
      policy,
      summarizeVariantGroup(positionResults, 'overall', policy),
    ])),
    adaptiveSamplingVariants: Object.fromEntries(adaptiveSamplingVariantPolicies.map((policy) => [
      policy,
      summarizeSamplingVariantGroup(positionResults, 'overall', policy),
    ])),
    byPhase: Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
      phase,
      summarizeGroup(positionResults.filter((position) => position.phase === phase), phase),
    ])),
    adaptiveByPhase: Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
      phase,
      summarizeAdaptiveGroup(positionResults.filter((position) => position.phase === phase), phase),
    ])),
    adaptiveControlByPhase: positionResults.some((position) => position.adaptiveControl?.trials?.length)
      ? Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
        phase,
        summarizeAdaptiveGroup(
          positionResults.filter((position) => position.phase === phase),
          phase,
          (position) => position.adaptiveControl,
        ),
      ]))
      : null,
    adaptiveVariantsByPhase: Object.fromEntries(adaptiveVariantPolicies.map((policy) => [
      policy,
      Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
        phase,
        summarizeVariantGroup(
          positionResults.filter((position) => position.phase === phase),
          phase,
          policy,
        ),
      ])),
    ])),
    adaptiveSamplingVariantsByPhase: Object.fromEntries(adaptiveSamplingVariantPolicies.map((policy) => [
      policy,
      Object.fromEntries(RELIABILITY_PHASES.map((phase) => [
        phase,
        summarizeSamplingVariantGroup(
          positionResults.filter((position) => position.phase === phase),
          phase,
          policy,
        ),
      ])),
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
    adaptiveControlByBranching: positionResults.some((position) => position.adaptiveControl?.trials?.length)
      ? Object.fromEntries(RELIABILITY_BRANCHING_BANDS.map((band) => [
        band,
        summarizeAdaptiveGroup(
          positionResults.filter((position) => branchingBand(position.branching) === band),
          `branching-${band}`,
          (position) => position.adaptiveControl,
        ),
      ]))
      : null,
    adaptiveVariantsByBranching: Object.fromEntries(adaptiveVariantPolicies.map((policy) => [
      policy,
      Object.fromEntries(RELIABILITY_BRANCHING_BANDS.map((band) => [
        band,
        summarizeVariantGroup(
          positionResults.filter((position) => branchingBand(position.branching) === band),
          `branching-${band}`,
          policy,
        ),
      ])),
    ])),
    adaptiveSamplingVariantsByBranching: Object.fromEntries(adaptiveSamplingVariantPolicies.map((policy) => [
      policy,
      Object.fromEntries(RELIABILITY_BRANCHING_BANDS.map((band) => [
        band,
        summarizeSamplingVariantGroup(
          positionResults.filter((position) => branchingBand(position.branching) === band),
          `branching-${band}`,
          policy,
        ),
      ])),
    ])),
  };
}

export function adaptiveSelectionDevelopmentGate(candidate, control) {
  const checks = {
    changesDecisions: candidate.selectionChangeRate.mean > 0,
    repeatAcceptabilityTarget: candidate.repeatAcceptability.mean >= 0.9,
    repeatAcceptabilityNoninferior: candidate.repeatAcceptability.mean >= control.repeatAcceptability.mean,
    withinOnePointNoninferior: candidate.withinOnePoint.mean >= control.withinOnePoint.mean - 0.01,
    meanRegretNoninferior: candidate.meanRegret.mean <= control.meanRegret.mean + 0.02,
    mistakeLabelAgreementPreserved: candidate.mistakeLabelAgreement.mean >= control.mistakeLabelAgreement.mean,
    falseAccusationsPreserved: candidate.falsePositiveMistakes.mean <= control.falsePositiveMistakes.mean,
    sampleUsagePreserved: candidate.samplesUsed.mean.mean <= control.samplesUsed.mean.mean,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function adaptiveSamplingDevelopmentGate(candidate, control, middleCandidate, middleControl) {
  const checks = {
    changesMiddleDecisions: middleCandidate.selectionChangeRate.mean > 0,
    repeatAcceptabilityTarget: candidate.repeatAcceptability.mean >= 0.9,
    repeatAcceptabilityNoninferior: candidate.repeatAcceptability.mean >= control.repeatAcceptability.mean,
    withinOnePointNoninferior: candidate.withinOnePoint.mean >= control.withinOnePoint.mean - 0.01,
    meanRegretNoninferior: candidate.meanRegret.mean <= control.meanRegret.mean + 0.02,
    middleRegretImprovement: middleCandidate.meanRegret.mean <= middleControl.meanRegret.mean - 0.03,
    mistakeLabelAgreementPreserved: candidate.mistakeLabelAgreement.mean >= control.mistakeLabelAgreement.mean,
    falseAccusationsPreserved: candidate.falsePositiveMistakes.mean <= control.falsePositiveMistakes.mean,
    sampleUsagePreserved: candidate.samplesUsed.mean.mean <= control.samplesUsed.mean.mean,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

import {
  analyzeMoves,
  applyMove,
  applyPass,
  chooseCasualMove,
  createBeliefState,
  detectStrategicPhase,
  legalMovesFor,
  mergeMoveAnalyses,
  seededRandom,
} from '../app/domino-engine.ts';
import {
  DEFAULT_ADAPTIVE_STAGES,
  plausibleBestMoveKeys,
  runAdaptiveAnalysis,
} from '../app/adaptive-analysis.ts';
import {
  informationSafeBenchmarkGame,
  particleCountForBudget,
} from './analyzer-reliability-core.mjs';
import { createMatchedDeal, gameFromMatchedDeal } from './benchmark-core.mjs';

export const SAMPLER_ABLATION_VERSION = 'paired-sampler-ablation-v1';
export const SAMPLER_ABLATION_GROUPS = ['opening-high', 'middle-wide'];
export const SAMPLER_ABLATION_VARIANTS = [
  'oneShot',
  'sharedStaged',
  'sharedAdaptiveEarly',
  'sharedAdaptiveForced',
  'independentStaged',
  'independentAdaptiveEarly',
  'independentAdaptiveForced',
];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

function qualifyingGroup(phase, branching, openingMinimum, middleMinimum) {
  if (phase === 'opening' && branching >= openingMinimum) return 'opening-high';
  if (phase === 'middle' && branching >= middleMinimum) return 'middle-wide';
  return null;
}

export function collectSamplerAblationCorpus({
  positionsPerGroup = 24,
  openingMinimumBranching = 6,
  middleMinimumBranching = 4,
  seed = 'mesa-quince-sampler-ablation-v1',
  maxDeals = 12000,
} = {}) {
  const positions = [];
  const counts = Object.fromEntries(SAMPLER_ABLATION_GROUPS.map((group) => [group, 0]));
  for (let dealIndex = 0; dealIndex < maxDeals; dealIndex += 1) {
    if (SAMPLER_ABLATION_GROUPS.every((group) => counts[group] >= positionsPerGroup)) break;
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
        const group = qualifyingGroup(
          phase,
          legal.length,
          openingMinimumBranching,
          middleMinimumBranching,
        );
        if (group && counts[group] < positionsPerGroup) {
          counts[group] += 1;
          positions.push({
            id: `${group}-${String(counts[group]).padStart(2, '0')}`,
            group,
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
  const missing = SAMPLER_ABLATION_GROUPS.filter((group) => counts[group] < positionsPerGroup);
  if (missing.length) {
    throw new Error(`Could not collect enough ${missing.join(', ')} positions after ${maxDeals} deals.`);
  }
  return positions.sort((left, right) => (
    SAMPLER_ABLATION_GROUPS.indexOf(left.group) - SAMPLER_ABLATION_GROUPS.indexOf(right.group)
    || left.id.localeCompare(right.id)
  ));
}

function analyzeWithBelief(safeGame, beliefState, samples, poolSize, offset = 0) {
  return analyzeMoves(safeGame, beliefState.targetCount, beliefState, undefined, {
    representativeLimit: samples,
    representativePoolSize: poolSize,
    representativeOffset: offset,
  });
}

function independentAnalysis(safeGame, samples, seedSalt) {
  const particleCount = particleCountForBudget(samples);
  const beliefState = createBeliefState(safeGame, 0, particleCount, undefined, seedSalt);
  return analyzeMoves(safeGame, particleCount, beliefState, undefined, {
    representativeLimit: samples,
  });
}

function batchesForStages(stages, analyzeBatch) {
  let previousTarget = 0;
  return stages.map((target, stageIndex) => {
    const batchSamples = target - previousTarget;
    const batch = analyzeBatch(batchSamples, stageIndex, previousTarget);
    previousTarget = target;
    return batch;
  });
}

async function replayAdaptive({
  batches,
  stages,
  position,
  minimumSamples,
  recommendationPracticalGap,
}) {
  return runAdaptiveAnalysis({
    stages,
    playedKey: position.playedKey,
    phase: position.phase,
    branching: position.branching,
    minimumSamples,
    recommendationPracticalGap,
    analyzeBatch: (batchSamples, stageIndex) => {
      const expected = stages[stageIndex] - (stages[stageIndex - 1] ?? 0);
      if (batchSamples !== expected || !batches[stageIndex]) {
        throw new Error(`Adaptive replay requested an unexpected stage ${stageIndex}.`);
      }
      return batches[stageIndex];
    },
  });
}

function compareRankedEvidence(left, right) {
  const rightByKey = new Map(right.map((move) => [moveKey(move), move]));
  let outcomeMismatches = 0;
  let weightMismatches = 0;
  let sampleMismatches = 0;
  let maxWinRateDifference = 0;
  for (const move of left) {
    const comparison = rightByKey.get(moveKey(move));
    if (!comparison) {
      outcomeMismatches += 1;
      continue;
    }
    const wins = move.treeSearch.pairedBaseWins;
    const comparisonWins = comparison.treeSearch.pairedBaseWins;
    const weights = move.treeSearch.pairedBaseWeights;
    const comparisonWeights = comparison.treeSearch.pairedBaseWeights;
    const count = Math.max(wins.length, comparisonWins.length);
    for (let index = 0; index < count; index += 1) {
      if (wins[index] !== comparisonWins[index]) outcomeMismatches += 1;
    }
    const weightCount = Math.max(weights.length, comparisonWeights.length);
    for (let index = 0; index < weightCount; index += 1) {
      if (weights[index] !== comparisonWeights[index]) weightMismatches += 1;
    }
    if (move.samples !== comparison.samples) sampleMismatches += 1;
    maxWinRateDifference = Math.max(maxWinRateDifference, Math.abs(move.winRate - comparison.winRate));
  }
  const leftKeys = left.map(moveKey);
  const rightKeys = right.map(moveKey);
  return {
    sameTop: leftKeys[0] === rightKeys[0],
    sameRanking: leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index]),
    outcomeMismatches,
    weightMismatches,
    sampleMismatches,
    maxWinRateDifference,
  };
}

function evaluatedVariant(ranked, samplesUsed, reference) {
  const topKey = moveKey(ranked[0]);
  const selectedRate = reference.rates.get(topKey);
  if (selectedRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
  const regret = Math.max(0, reference.bestRate - selectedRate);
  return {
    topKey,
    samplesUsed,
    exactTopAgreement: topKey === reference.topKey,
    acceptableTopAgreement: reference.acceptableKeys.includes(topKey),
    withinOnePoint: regret <= 1,
    regret,
  };
}

export async function evaluateSamplerAblationPosition(position, {
  repetitions = 3,
  stages = DEFAULT_ADAPTIVE_STAGES,
  referenceBudget = 5000,
  recommendationPracticalGap = 1,
  seed = 'mesa-quince-sampler-ablation-v1',
} = {}) {
  const finalBudget = stages.at(-1);
  if (!finalBudget || stages.some((stage, index) => index && stage <= stages[index - 1])) {
    throw new Error('Sampler-ablation stages must be strictly increasing positive integers.');
  }
  const safeGame = informationSafeBenchmarkGame(position.game);
  const referenceRanked = independentAnalysis(
    safeGame,
    referenceBudget,
    `${seed}|${position.id}|reference`,
  );
  const reference = {
    topKey: moveKey(referenceRanked[0]),
    acceptableKeys: plausibleBestMoveKeys(
      referenceRanked,
      [referenceRanked],
      recommendationPracticalGap,
    ),
    rates: new Map(referenceRanked.map((move) => [moveKey(move), move.winRate])),
    bestRate: referenceRanked[0].winRate,
  };
  const trials = [];

  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const trialSeed = `${seed}|${position.id}|repeat-${repetition}`;
    const sharedBelief = createBeliefState(
      safeGame,
      0,
      particleCountForBudget(finalBudget),
      undefined,
      `${trialSeed}|shared-pool`,
    );
    const oneShotRanked = analyzeWithBelief(safeGame, sharedBelief, finalBudget, finalBudget);
    const sharedBatches = batchesForStages(stages, (samples, _stageIndex, offset) => (
      analyzeWithBelief(safeGame, sharedBelief, samples, finalBudget, offset)
    ));
    const independentBatches = batchesForStages(stages, (samples, stageIndex) => (
      independentAnalysis(
        safeGame,
        samples,
        `${trialSeed}|independent-stage-${stageIndex}|batch-${samples}`,
      )
    ));
    const sharedStagedRanked = mergeMoveAnalyses(sharedBatches);
    const independentStagedRanked = mergeMoveAnalyses(independentBatches);
    const [sharedAdaptiveEarly, sharedAdaptiveForced, independentAdaptiveEarly, independentAdaptiveForced] = await Promise.all([
      replayAdaptive({
        batches: sharedBatches,
        stages,
        position,
        recommendationPracticalGap,
      }),
      replayAdaptive({
        batches: sharedBatches,
        stages,
        position,
        minimumSamples: finalBudget,
        recommendationPracticalGap,
      }),
      replayAdaptive({
        batches: independentBatches,
        stages,
        position,
        recommendationPracticalGap,
      }),
      replayAdaptive({
        batches: independentBatches,
        stages,
        position,
        minimumSamples: finalBudget,
        recommendationPracticalGap,
      }),
    ]);

    trials.push({
      repetition,
      variants: {
        oneShot: evaluatedVariant(oneShotRanked, finalBudget, reference),
        sharedStaged: evaluatedVariant(sharedStagedRanked, finalBudget, reference),
        sharedAdaptiveEarly: evaluatedVariant(
          sharedAdaptiveEarly.ranked,
          sharedAdaptiveEarly.samplesUsed,
          reference,
        ),
        sharedAdaptiveForced: evaluatedVariant(
          sharedAdaptiveForced.ranked,
          sharedAdaptiveForced.samplesUsed,
          reference,
        ),
        independentStaged: evaluatedVariant(independentStagedRanked, finalBudget, reference),
        independentAdaptiveEarly: evaluatedVariant(
          independentAdaptiveEarly.ranked,
          independentAdaptiveEarly.samplesUsed,
          reference,
        ),
        independentAdaptiveForced: evaluatedVariant(
          independentAdaptiveForced.ranked,
          independentAdaptiveForced.samplesUsed,
          reference,
        ),
      },
      comparisons: {
        oneShotVsSharedStaged: compareRankedEvidence(oneShotRanked, sharedStagedRanked),
        sharedStagedVsForcedReplay: compareRankedEvidence(
          sharedStagedRanked,
          sharedAdaptiveForced.ranked,
        ),
        independentStagedVsForcedReplay: compareRankedEvidence(
          independentStagedRanked,
          independentAdaptiveForced.ranked,
        ),
      },
      stopping: {
        sharedEarly: {
          samplesUsed: sharedAdaptiveEarly.samplesUsed,
          stopReason: sharedAdaptiveEarly.stopReason,
          stageCount: sharedAdaptiveEarly.stages.length,
        },
        independentEarly: {
          samplesUsed: independentAdaptiveEarly.samplesUsed,
          stopReason: independentAdaptiveEarly.stopReason,
          stageCount: independentAdaptiveEarly.stages.length,
        },
      },
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
      budget: referenceBudget,
      topKey: reference.topKey,
      acceptableTopKeys: reference.acceptableKeys,
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

function intervalForPositionValues(values, seed, resamples) {
  if (!values.length) return { mean: 0, low: 0, high: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1 || resamples <= 0) return { mean, low: mean, high: mean };
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

function summarizeVariant(positionResults, variant, seed, confidenceResamples) {
  const positionMeans = (read) => positionResults.map((position) => {
    const trials = position.trials.map((trial) => trial.variants[variant]);
    return trials.reduce((sum, trial) => sum + read(trial), 0) / trials.length;
  });
  const metric = (label, read) => intervalForPositionValues(
    positionMeans(read),
    `${seed}|${variant}|${label}`,
    confidenceResamples,
  );
  const samples = positionResults
    .flatMap((position) => position.trials.map((trial) => trial.variants[variant].samplesUsed))
    .sort((left, right) => left - right);
  return {
    positions: positionResults.length,
    trials: samples.length,
    exactTopAgreement: metric('exact-top', (trial) => trial.exactTopAgreement ? 1 : 0),
    acceptableTopAgreement: metric('acceptable-top', (trial) => trial.acceptableTopAgreement ? 1 : 0),
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    repeatAcceptability: intervalForPositionValues(
      positionResults.map((position) => position.trials.every((trial) => (
        trial.variants[variant].withinOnePoint
      )) ? 1 : 0),
      `${seed}|${variant}|repeat-acceptable`,
      confidenceResamples,
    ),
    repeatTopStability: intervalForPositionValues(
      positionResults.map((position) => new Set(position.trials.map((trial) => (
        trial.variants[variant].topKey
      ))).size === 1 ? 1 : 0),
      `${seed}|${variant}|repeat-top`,
      confidenceResamples,
    ),
    samplesUsed: {
      mean: samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 0,
      p50: percentile(samples, 0.5),
      p95: percentile(samples, 0.95),
      maximum: samples.at(-1) ?? 0,
    },
  };
}

function pairedEffect(positionResults, candidate, baseline, seed, confidenceResamples) {
  const metric = (label, read) => intervalForPositionValues(
    positionResults.map((position) => {
      const differences = position.trials.map((trial) => (
        read(trial.variants[candidate]) - read(trial.variants[baseline])
      ));
      return differences.reduce((sum, value) => sum + value, 0) / differences.length;
    }),
    `${seed}|effect|${candidate}|${baseline}|${label}`,
    confidenceResamples,
  );
  return {
    candidate,
    baseline,
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    samplesUsed: metric('samples', (trial) => trial.samplesUsed),
    repeatAcceptability: intervalForPositionValues(
      positionResults.map((position) => {
        const candidateAcceptable = position.trials.every((trial) => (
          trial.variants[candidate].withinOnePoint
        )) ? 1 : 0;
        const baselineAcceptable = position.trials.every((trial) => (
          trial.variants[baseline].withinOnePoint
        )) ? 1 : 0;
        return candidateAcceptable - baselineAcceptable;
      }),
      `${seed}|effect|${candidate}|${baseline}|repeat-acceptable`,
      confidenceResamples,
    ),
  };
}

function comparisonFailures(positionResults, comparison) {
  const trials = positionResults.flatMap((position) => position.trials);
  const rows = trials.map((trial) => trial.comparisons[comparison]);
  return {
    trials: rows.length,
    topMismatches: rows.filter((row) => !row.sameTop).length,
    rankingMismatches: rows.filter((row) => !row.sameRanking).length,
    outcomeMismatches: rows.reduce((sum, row) => sum + row.outcomeMismatches, 0),
    weightMismatches: rows.reduce((sum, row) => sum + row.weightMismatches, 0),
    sampleMismatches: rows.reduce((sum, row) => sum + row.sampleMismatches, 0),
    maximumWinRateDifference: Math.max(0, ...rows.map((row) => row.maxWinRateDifference)),
  };
}

function harmfulEffect(effect) {
  return effect.withinOnePoint.mean < -0.02
    || effect.repeatAcceptability.mean < -0.03
    || effect.meanRegret.mean > 0.03;
}

export function summarizeSamplerAblation(positionResults, {
  seed = 'mesa-quince-sampler-ablation-v1',
  confidenceResamples = 1000,
} = {}) {
  const summarizeGroup = (positions, label) => ({
    positions: positions.length,
    variants: Object.fromEntries(SAMPLER_ABLATION_VARIANTS.map((variant) => [
      variant,
      summarizeVariant(positions, variant, `${seed}|${label}`, confidenceResamples),
    ])),
  });
  const overall = summarizeGroup(positionResults, 'overall');
  const effects = {
    sharedEarlyStopping: pairedEffect(
      positionResults,
      'sharedAdaptiveEarly',
      'sharedAdaptiveForced',
      seed,
      confidenceResamples,
    ),
    independentEarlyStopping: pairedEffect(
      positionResults,
      'independentAdaptiveEarly',
      'independentAdaptiveForced',
      seed,
      confidenceResamples,
    ),
    independentStageSampling: pairedEffect(
      positionResults,
      'independentAdaptiveForced',
      'sharedAdaptiveForced',
      seed,
      confidenceResamples,
    ),
  };
  const aggregation = comparisonFailures(positionResults, 'oneShotVsSharedStaged');
  const sharedReplay = comparisonFailures(positionResults, 'sharedStagedVsForcedReplay');
  const independentReplay = comparisonFailures(positionResults, 'independentStagedVsForcedReplay');
  return {
    version: SAMPLER_ABLATION_VERSION,
    positions: positionResults.length,
    groupCounts: Object.fromEntries(SAMPLER_ABLATION_GROUPS.map((group) => [
      group,
      positionResults.filter((position) => position.group === group).length,
    ])),
    overall,
    byGroup: Object.fromEntries(SAMPLER_ABLATION_GROUPS.map((group) => [
      group,
      summarizeGroup(positionResults.filter((position) => position.group === group), group),
    ])),
    comparisons: { aggregation, sharedReplay, independentReplay },
    effects,
    diagnosis: {
      aggregationDefect: aggregation.topMismatches > 0
        || aggregation.rankingMismatches > 0
        || aggregation.outcomeMismatches > 0
        || aggregation.weightMismatches > 0
        || aggregation.sampleMismatches > 0
        || aggregation.maximumWinRateDifference > 1e-12,
      sharedEarlyStoppingHarm: harmfulEffect(effects.sharedEarlyStopping),
      independentEarlyStoppingHarm: harmfulEffect(effects.independentEarlyStopping),
      independentStageSamplingHarm: harmfulEffect(effects.independentStageSampling),
    },
  };
}

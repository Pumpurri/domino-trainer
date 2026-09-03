import {
  mergeMoveAnalyses,
  type DecisionVerdict,
  type RatedMove,
  type StrategicPhase,
} from './domino-engine.ts';

export const ADAPTIVE_ANALYSIS_VERSION = 'adaptive-confirmed-v2';
export const DEFAULT_ADAPTIVE_STAGES = [120, 250, 500, 1000, 2000] as const;

export type AdaptiveStopReason = 'clear' | 'hard-cap';
export type AdaptiveConfidence = 'clear' | 'uncertain';
export type AdaptiveRecommendationConfidence = AdaptiveConfidence;
export type AdaptiveMistakeAssessment = 'acceptable' | 'mistake' | 'uncertain';

export type PairedMoveDifference = {
  gap: number;
  interval: [number, number];
};

export type ClusteredMoveDifference = PairedMoveDifference & {
  pooledInterval: [number, number];
  betweenBatchSpread: number;
  batchGaps: number[];
};

export type AdaptiveMistakePolicy = {
  practicalGap: number;
  minimumGap: number;
  minimumBatchAgreement: number;
  minimumPracticalBatchAgreement: number;
  minimumBatches: number;
  slightUpperGap: number;
  mistakeUpperGap: number;
};

export const DEFAULT_ADAPTIVE_MISTAKE_POLICY: AdaptiveMistakePolicy = {
  practicalGap: 1.5,
  minimumGap: 4,
  minimumBatchAgreement: 0.75,
  minimumPracticalBatchAgreement: 0.5,
  minimumBatches: 2,
  slightUpperGap: 10,
  mistakeUpperGap: 20,
};

export type AdaptiveChoiceAssessment = {
  verdict: DecisionVerdict;
  confidentMistake: boolean;
  mistakeConfidence: AdaptiveConfidence;
  assessment: AdaptiveMistakeAssessment;
  gap: number;
  interval: [number, number];
  comparisonKey: string;
  plausibleBestKeys: string[];
  batchAgreement: number;
  practicalBatchAgreement: number;
  batchCount: number;
};

export type AdaptiveStageResult = {
  targetSamples: number;
  batchSamples: number;
  topKey: string;
  runnerUpKey: string | null;
  plausibleBestKeys: string[];
  gap: number;
  interval: [number, number];
  pooledInterval: [number, number];
  betweenBatchSpread: number;
  stableChecks: number;
  plausibleSetStableChecks: number;
  clearlyAhead: boolean;
  eligibleForDecision: boolean;
  recommendationCandidate: boolean;
  confirmationPassed: boolean;
  labelStable: boolean;
  verdict: DecisionVerdict | null;
  confidentMistake: boolean | null;
  mistakeConfidence: AdaptiveConfidence | null;
};

export type AdaptiveAnalysisResult = {
  ranked: RatedMove[];
  samplesUsed: number;
  stoppedAt: number;
  minimumSamples: number;
  stopReason: AdaptiveStopReason;
  recommendationConfidence: AdaptiveRecommendationConfidence;
  plausibleBestKeys: string[];
  stages: AdaptiveStageResult[];
  choice: AdaptiveChoiceAssessment | null;
};

export type AdaptiveChoiceOptions = {
  batches?: RatedMove[][];
  recommendationPracticalGap?: number;
  mistakePolicy?: Partial<AdaptiveMistakePolicy>;
};

export type AdaptiveAnalysisOptions = {
  stages?: readonly number[];
  playedKey?: string;
  phase?: StrategicPhase;
  branching?: number;
  minimumSamples?: number;
  recommendationPracticalGap?: number;
  mistakePolicy?: Partial<AdaptiveMistakePolicy>;
  requiredStableChecks?: number;
  shouldCancel?: () => boolean;
  onStage?: (stage: AdaptiveStageResult, ranked: RatedMove[]) => void;
  analyzeBatch: (batchSamples: number, stageIndex: number) => RatedMove[] | Promise<RatedMove[]>;
};

function moveKey(move: RatedMove): string {
  return `${move.tile.id}:${move.side}`;
}

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function validateStages(stages: readonly number[]): number[] {
  if (stages.length < 2) throw new Error('Adaptive analysis requires at least two cumulative stages.');
  const validated = stages.map((stage) => {
    if (!Number.isInteger(stage) || stage <= 0) throw new Error('Adaptive stages must be positive integers.');
    return stage;
  });
  for (let index = 1; index < validated.length; index += 1) {
    if (validated[index] <= validated[index - 1]) throw new Error('Adaptive stages must increase strictly.');
  }
  return validated;
}

function validateFraction(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between zero and one.`);
  return value;
}

function resolvedMistakePolicy(policy?: Partial<AdaptiveMistakePolicy>): AdaptiveMistakePolicy {
  const resolved = { ...DEFAULT_ADAPTIVE_MISTAKE_POLICY, ...policy };
  if (resolved.practicalGap < 0 || resolved.minimumGap < 0) throw new Error('Mistake gaps cannot be negative.');
  validateFraction(resolved.minimumBatchAgreement, 'Minimum batch agreement');
  validateFraction(resolved.minimumPracticalBatchAgreement, 'Minimum practical batch agreement');
  if (!Number.isInteger(resolved.minimumBatches) || resolved.minimumBatches < 2) {
    throw new Error('A confident mistake requires at least two independent batches.');
  }
  if (resolved.slightUpperGap < resolved.minimumGap || resolved.mistakeUpperGap < resolved.slightUpperGap) {
    throw new Error('Mistake severity thresholds must increase.');
  }
  return resolved;
}

export function adaptiveMinimumSamples({
  phase,
  branching,
}: {
  phase?: StrategicPhase;
  branching?: number;
} = {}): number {
  const branchMinimum = branching === undefined
    ? 120
    : branching <= 2
      ? 250
      : branching <= 5
        ? 500
        : 1000;
  const phaseMinimum = phase === 'opening' || phase === 'middle'
    ? 500
    : phase === 'late' || phase === 'block'
      ? 250
      : 120;
  return Math.max(branchMinimum, phaseMinimum);
}

export function pairedRatedMoveDifference(best: RatedMove, chosen: RatedMove): PairedMoveDifference {
  if (moveKey(best) === moveKey(chosen)) return { gap: 0, interval: [0, 0] };
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

function moveForKey(ranked: RatedMove[], key: string): RatedMove {
  const move = ranked.find((candidate) => moveKey(candidate) === key);
  if (!move) throw new Error(`Adaptive batch is missing legal move ${key}.`);
  return move;
}

function batchWeight(best: RatedMove, chosen: RatedMove): number {
  return Math.max(1, Math.min(best.effectiveSamples, chosen.effectiveSamples, best.samples, chosen.samples));
}

export function clusteredRatedMoveDifference(
  batches: RatedMove[][],
  betterKey: string,
  comparisonKey: string,
): ClusteredMoveDifference {
  if (!batches.length) throw new Error('Clustered comparison requires at least one independent batch.');
  if (betterKey === comparisonKey) {
    return {
      gap: 0,
      interval: [0, 0],
      pooledInterval: [0, 0],
      betweenBatchSpread: 0,
      batchGaps: batches.map(() => 0),
    };
  }
  const merged = mergeMoveAnalyses(batches);
  const pooled = pairedRatedMoveDifference(
    moveForKey(merged, betterKey),
    moveForKey(merged, comparisonKey),
  );
  const estimates = batches.map((batch) => {
    const better = moveForKey(batch, betterKey);
    const comparison = moveForKey(batch, comparisonKey);
    return {
      gap: pairedRatedMoveDifference(better, comparison).gap,
      weight: batchWeight(better, comparison),
    };
  });
  const totalWeight = estimates.reduce((sum, estimate) => sum + estimate.weight, 0);
  const squaredWeight = estimates.reduce((sum, estimate) => sum + estimate.weight ** 2, 0);
  const effectiveBatches = squaredWeight ? totalWeight ** 2 / squaredWeight : estimates.length;
  const betweenVariance = estimates.length > 1 && totalWeight
    ? estimates.reduce(
      (sum, estimate) => sum + estimate.weight ** 2 * (estimate.gap - pooled.gap) ** 2,
      0,
    ) / totalWeight ** 2 * effectiveBatches / Math.max(1, effectiveBatches - 1)
    : 0;
  const betweenBatchSpread = 1.96 * Math.sqrt(Math.max(0, betweenVariance));
  const pooledSpread = Math.max(pooled.gap - pooled.interval[0], pooled.interval[1] - pooled.gap);
  const spread = Math.max(pooledSpread, betweenBatchSpread);
  return {
    gap: pooled.gap,
    interval: [pooled.gap - spread, pooled.gap + spread],
    pooledInterval: pooled.interval,
    betweenBatchSpread,
    batchGaps: estimates.map(({ gap }) => gap),
  };
}

export function plausibleBestMoveKeys(
  ranked: RatedMove[],
  batches: RatedMove[][] = [ranked],
  practicalGap = 1,
): string[] {
  if (!ranked.length) return [];
  if (practicalGap < 0) throw new Error('The recommendation practical gap cannot be negative.');
  const topKey = moveKey(ranked[0]);
  return ranked
    .filter((candidate) => {
      const key = moveKey(candidate);
      if (key === topKey) return true;
      const difference = clusteredRatedMoveDifference(batches, topKey, key);
      return difference.gap <= practicalGap || difference.interval[0] <= practicalGap;
    })
    .map(moveKey)
    .sort();
}

function closestPlausibleComparison(
  batches: RatedMove[][],
  ranked: RatedMove[],
  plausibleBestKeys: string[],
  playedKey: string,
): { key: string; difference: ClusteredMoveDifference } {
  const candidates = plausibleBestKeys.map((key) => ({
    key,
    difference: clusteredRatedMoveDifference(batches, key, playedKey),
  }));
  return candidates.sort((left, right) => left.difference.gap - right.difference.gap)[0]
    ?? { key: moveKey(ranked[0]), difference: clusteredRatedMoveDifference(batches, moveKey(ranked[0]), playedKey) };
}

export function classifyAdaptiveChoice(
  ranked: RatedMove[],
  playedKey: string,
  {
    batches = [ranked],
    recommendationPracticalGap = 1,
    mistakePolicy: suppliedMistakePolicy,
  }: AdaptiveChoiceOptions = {},
): AdaptiveChoiceAssessment {
  const top = ranked[0];
  const chosen = ranked.find((move) => moveKey(move) === playedKey);
  if (!top || !chosen) throw new Error(`Played move ${playedKey} is missing from the adaptive analysis.`);
  const mistakePolicy = resolvedMistakePolicy(suppliedMistakePolicy);
  const plausibleBestKeys = plausibleBestMoveKeys(ranked, batches, recommendationPracticalGap);
  if (plausibleBestKeys.includes(playedKey)) {
    const topKey = moveKey(top);
    const difference = clusteredRatedMoveDifference(batches, topKey, playedKey);
    const clearlyAcceptable = topKey === playedKey || difference.interval[1] <= mistakePolicy.practicalGap;
    return {
      verdict: topKey === playedKey ? 'best' : 'close',
      confidentMistake: false,
      mistakeConfidence: clearlyAcceptable ? 'clear' : 'uncertain',
      assessment: clearlyAcceptable ? 'acceptable' : 'uncertain',
      gap: difference.gap,
      interval: difference.interval,
      comparisonKey: topKey,
      plausibleBestKeys,
      batchAgreement: difference.batchGaps.length
        ? difference.batchGaps.filter((gap) => gap > 0).length / difference.batchGaps.length
        : 1,
      practicalBatchAgreement: difference.batchGaps.length
        ? difference.batchGaps.filter((gap) => gap > mistakePolicy.practicalGap).length / difference.batchGaps.length
        : 1,
      batchCount: batches.length,
    };
  }

  const comparison = closestPlausibleComparison(batches, ranked, plausibleBestKeys, playedKey);
  const batchAgreement = comparison.difference.batchGaps.filter((gap) => gap > 0).length / batches.length;
  const practicalBatchAgreement = comparison.difference.batchGaps
    .filter((gap) => gap > mistakePolicy.practicalGap).length / batches.length;
  const definitelyWorse = comparison.difference.gap >= mistakePolicy.minimumGap
    && comparison.difference.interval[0] > mistakePolicy.practicalGap
    && batches.length >= mistakePolicy.minimumBatches
    && batchAgreement >= mistakePolicy.minimumBatchAgreement
    && practicalBatchAgreement >= mistakePolicy.minimumPracticalBatchAgreement;
  const verdict: DecisionVerdict = !definitelyWorse
    ? 'close'
    : comparison.difference.gap < mistakePolicy.slightUpperGap
      ? 'slight'
      : comparison.difference.gap < mistakePolicy.mistakeUpperGap
        ? 'mistake'
        : 'big-mistake';
  return {
    verdict,
    confidentMistake: definitelyWorse,
    mistakeConfidence: definitelyWorse ? 'clear' : 'uncertain',
    assessment: definitelyWorse ? 'mistake' : 'uncertain',
    gap: comparison.difference.gap,
    interval: comparison.difference.interval,
    comparisonKey: comparison.key,
    plausibleBestKeys,
    batchAgreement,
    practicalBatchAgreement,
    batchCount: batches.length,
  };
}

function confirmationBatchSupports(batch: RatedMove[], candidateKey: string): boolean {
  if (moveKey(batch[0]) !== candidateKey) return false;
  const candidate = moveForKey(batch, candidateKey);
  return batch.every((comparison) => (
    moveKey(comparison) === candidateKey
    || pairedRatedMoveDifference(candidate, comparison).gap > 0
  ));
}

function stageAssessment({
  ranked,
  batches,
  history,
  targetSamples,
  batchSamples,
  playedKey,
  minimumSamples,
  recommendationPracticalGap,
  mistakePolicy,
  requiredStableChecks,
}: {
  ranked: RatedMove[];
  batches: RatedMove[][];
  history: AdaptiveStageResult[];
  targetSamples: number;
  batchSamples: number;
  playedKey: string | undefined;
  minimumSamples: number;
  recommendationPracticalGap: number;
  mistakePolicy: AdaptiveMistakePolicy;
  requiredStableChecks: number;
}): AdaptiveStageResult {
  if (!ranked.length) throw new Error('Adaptive analysis returned no legal moves.');
  const best = ranked[0];
  const topKey = moveKey(best);
  const runner = ranked[1];
  const runnerDifference = runner
    ? clusteredRatedMoveDifference(batches, topKey, moveKey(runner))
    : {
      gap: Number.POSITIVE_INFINITY,
      interval: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as [number, number],
      pooledInterval: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as [number, number],
      betweenBatchSpread: 0,
      batchGaps: [],
    };
  const plausibleBestKeys = plausibleBestMoveKeys(ranked, batches, recommendationPracticalGap);
  let stableChecks = 1;
  for (let index = history.length - 1; index >= 0 && history[index].topKey === topKey; index -= 1) stableChecks += 1;
  let plausibleSetStableChecks = 1;
  for (
    let index = history.length - 1;
    index >= 0 && sameKeys(history[index].plausibleBestKeys, plausibleBestKeys);
    index -= 1
  ) plausibleSetStableChecks += 1;
  const eligibleForDecision = targetSamples >= minimumSamples && batches.length >= 2;
  const clearlyAhead = plausibleBestKeys.length === 1;
  const recommendationCandidate = eligibleForDecision
    && clearlyAhead
    && stableChecks >= requiredStableChecks
    && plausibleSetStableChecks >= requiredStableChecks;
  const previous = history.at(-1);
  const confirmationPassed = Boolean(
    recommendationCandidate
    && previous?.recommendationCandidate
    && previous.plausibleBestKeys[0] === plausibleBestKeys[0]
    && confirmationBatchSupports(batches.at(-1)!, plausibleBestKeys[0]),
  );
  const choice = playedKey ? classifyAdaptiveChoice(ranked, playedKey, {
    batches,
    recommendationPracticalGap,
    mistakePolicy,
  }) : null;
  const labelStable = !choice || Boolean(previous
    && previous.verdict === choice.verdict
    && previous.confidentMistake === choice.confidentMistake
    && previous.mistakeConfidence === choice.mistakeConfidence);
  return {
    targetSamples,
    batchSamples,
    topKey,
    runnerUpKey: runner ? moveKey(runner) : null,
    plausibleBestKeys,
    gap: runnerDifference.gap,
    interval: runnerDifference.interval,
    pooledInterval: runnerDifference.pooledInterval,
    betweenBatchSpread: runnerDifference.betweenBatchSpread,
    stableChecks,
    plausibleSetStableChecks,
    clearlyAhead,
    eligibleForDecision,
    recommendationCandidate,
    confirmationPassed,
    labelStable,
    verdict: choice?.verdict ?? null,
    confidentMistake: choice?.confidentMistake ?? null,
    mistakeConfidence: choice?.mistakeConfidence ?? null,
  };
}

export async function runAdaptiveAnalysis({
  stages: suppliedStages = DEFAULT_ADAPTIVE_STAGES,
  playedKey,
  phase,
  branching,
  minimumSamples: suppliedMinimumSamples,
  recommendationPracticalGap = 1,
  mistakePolicy: suppliedMistakePolicy,
  requiredStableChecks = 2,
  shouldCancel,
  onStage,
  analyzeBatch,
}: AdaptiveAnalysisOptions): Promise<AdaptiveAnalysisResult> {
  const stages = validateStages(suppliedStages);
  if (recommendationPracticalGap < 0) throw new Error('The recommendation practical gap cannot be negative.');
  if (!Number.isInteger(requiredStableChecks) || requiredStableChecks < 2) {
    throw new Error('Adaptive analysis requires at least two stable checks.');
  }
  const minimumSamples = suppliedMinimumSamples ?? adaptiveMinimumSamples({ phase, branching });
  if (!Number.isInteger(minimumSamples) || minimumSamples <= 0) {
    throw new Error('The adaptive minimum sample count must be a positive integer.');
  }
  const mistakePolicy = resolvedMistakePolicy(suppliedMistakePolicy);
  const batches: RatedMove[][] = [];
  const history: AdaptiveStageResult[] = [];
  let previousTarget = 0;
  let ranked: RatedMove[] = [];

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    if (shouldCancel?.()) throw new Error('Adaptive analysis was cancelled.');
    const targetSamples = stages[stageIndex];
    const batchSamples = targetSamples - previousTarget;
    const batch = await analyzeBatch(batchSamples, stageIndex);
    if (!batch.length) throw new Error('Adaptive analysis returned an empty batch.');
    batches.push(batch);
    ranked = mergeMoveAnalyses(batches);
    const stage = stageAssessment({
      ranked,
      batches,
      history,
      targetSamples,
      batchSamples,
      playedKey,
      minimumSamples,
      recommendationPracticalGap,
      mistakePolicy,
      requiredStableChecks,
    });
    history.push(stage);
    onStage?.(stage, ranked);
    previousTarget = targetSamples;

    if (stage.confirmationPassed) {
      return {
        ranked,
        samplesUsed: targetSamples,
        stoppedAt: targetSamples,
        minimumSamples,
        stopReason: 'clear',
        recommendationConfidence: 'clear',
        plausibleBestKeys: stage.plausibleBestKeys,
        stages: history,
        choice: playedKey ? classifyAdaptiveChoice(ranked, playedKey, {
          batches,
          recommendationPracticalGap,
          mistakePolicy,
        }) : null,
      };
    }
  }

  const finalStage = history.at(-1)!;
  return {
    ranked,
    samplesUsed: finalStage.targetSamples,
    stoppedAt: finalStage.targetSamples,
    minimumSamples,
    stopReason: 'hard-cap',
    recommendationConfidence: 'uncertain',
    plausibleBestKeys: finalStage.plausibleBestKeys,
    stages: history,
    choice: playedKey ? classifyAdaptiveChoice(ranked, playedKey, {
      batches,
      recommendationPracticalGap,
      mistakePolicy,
    }) : null,
  };
}

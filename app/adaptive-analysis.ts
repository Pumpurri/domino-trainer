import {
  mergeMoveAnalyses,
  type DecisionVerdict,
  type RatedMove,
} from './domino-engine.ts';

export const ADAPTIVE_ANALYSIS_VERSION = 'adaptive-paired-v1';
export const DEFAULT_ADAPTIVE_STAGES = [120, 250, 500, 1000, 2000] as const;

export type AdaptiveStopReason = 'clear' | 'hard-cap';
export type AdaptiveRecommendationConfidence = 'clear' | 'uncertain';

export type PairedMoveDifference = {
  gap: number;
  interval: [number, number];
};

export type AdaptiveChoiceAssessment = {
  verdict: DecisionVerdict;
  confidentMistake: boolean;
  gap: number;
  interval: [number, number];
};

export type AdaptiveStageResult = {
  targetSamples: number;
  batchSamples: number;
  topKey: string;
  runnerUpKey: string | null;
  gap: number;
  interval: [number, number];
  stableChecks: number;
  clearlyAhead: boolean;
  labelStable: boolean;
  verdict: DecisionVerdict | null;
  confidentMistake: boolean | null;
};

export type AdaptiveAnalysisResult = {
  ranked: RatedMove[];
  samplesUsed: number;
  stoppedAt: number;
  stopReason: AdaptiveStopReason;
  recommendationConfidence: AdaptiveRecommendationConfidence;
  stages: AdaptiveStageResult[];
  choice: AdaptiveChoiceAssessment | null;
};

export type AdaptiveAnalysisOptions = {
  stages?: readonly number[];
  playedKey?: string;
  practicalGap?: number;
  requiredStableChecks?: number;
  shouldCancel?: () => boolean;
  onStage?: (stage: AdaptiveStageResult, ranked: RatedMove[]) => void;
  analyzeBatch: (batchSamples: number, stageIndex: number) => RatedMove[] | Promise<RatedMove[]>;
};

function moveKey(move: RatedMove): string {
  return `${move.tile.id}:${move.side}`;
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

export function classifyAdaptiveChoice(
  ranked: RatedMove[],
  playedKey: string,
  practicalGap = 1,
): AdaptiveChoiceAssessment {
  const best = ranked[0];
  const chosen = ranked.find((move) => moveKey(move) === playedKey);
  if (!best || !chosen) throw new Error(`Played move ${playedKey} is missing from the adaptive analysis.`);
  const difference = pairedRatedMoveDifference(best, chosen);
  const definitelyWorse = moveKey(best) !== moveKey(chosen)
    && difference.gap >= 3
    && difference.interval[0] > practicalGap;
  const verdict: DecisionVerdict = moveKey(best) === moveKey(chosen)
    ? 'best'
    : !definitelyWorse
      ? 'close'
      : difference.gap < 10
        ? 'slight'
        : difference.gap < 20
          ? 'mistake'
          : 'big-mistake';
  return {
    verdict,
    confidentMistake: definitelyWorse,
    gap: difference.gap,
    interval: difference.interval,
  };
}

function stageAssessment(
  ranked: RatedMove[],
  history: AdaptiveStageResult[],
  targetSamples: number,
  batchSamples: number,
  playedKey: string | undefined,
  practicalGap: number,
): AdaptiveStageResult {
  if (!ranked.length) throw new Error('Adaptive analysis returned no legal moves.');
  const best = ranked[0];
  const topKey = moveKey(best);
  const runner = ranked[1];
  const runnerDifference = runner
    ? pairedRatedMoveDifference(best, runner)
    : { gap: Number.POSITIVE_INFINITY, interval: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as [number, number] };
  const clearlyAhead = ranked.slice(1).every((candidate) => (
    pairedRatedMoveDifference(best, candidate).interval[0] > practicalGap
  ));
  let stableChecks = 1;
  for (let index = history.length - 1; index >= 0 && history[index].topKey === topKey; index -= 1) {
    stableChecks += 1;
  }
  const choice = playedKey ? classifyAdaptiveChoice(ranked, playedKey, practicalGap) : null;
  const previous = history.at(-1);
  const labelStable = !choice || Boolean(previous
    && previous.verdict === choice.verdict
    && previous.confidentMistake === choice.confidentMistake);
  return {
    targetSamples,
    batchSamples,
    topKey,
    runnerUpKey: runner ? moveKey(runner) : null,
    gap: runnerDifference.gap,
    interval: runnerDifference.interval,
    stableChecks,
    clearlyAhead,
    labelStable,
    verdict: choice?.verdict ?? null,
    confidentMistake: choice?.confidentMistake ?? null,
  };
}

export async function runAdaptiveAnalysis({
  stages: suppliedStages = DEFAULT_ADAPTIVE_STAGES,
  playedKey,
  practicalGap = 1,
  requiredStableChecks = 2,
  shouldCancel,
  onStage,
  analyzeBatch,
}: AdaptiveAnalysisOptions): Promise<AdaptiveAnalysisResult> {
  const stages = validateStages(suppliedStages);
  if (practicalGap < 0) throw new Error('The practical gap cannot be negative.');
  if (!Number.isInteger(requiredStableChecks) || requiredStableChecks < 2) {
    throw new Error('Adaptive analysis requires at least two stable checks.');
  }
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
    const stage = stageAssessment(
      ranked,
      history,
      targetSamples,
      batchSamples,
      playedKey,
      practicalGap,
    );
    history.push(stage);
    onStage?.(stage, ranked);
    previousTarget = targetSamples;

    const stable = stage.stableChecks >= requiredStableChecks;
    if (stable && stage.clearlyAhead && stage.labelStable) {
      return {
        ranked,
        samplesUsed: targetSamples,
        stoppedAt: targetSamples,
        stopReason: 'clear',
        recommendationConfidence: 'clear',
        stages: history,
        choice: playedKey ? classifyAdaptiveChoice(ranked, playedKey, practicalGap) : null,
      };
    }
  }

  const finalStage = history.at(-1)!;
  const stableAtCap = finalStage.stableChecks >= requiredStableChecks
    && finalStage.clearlyAhead
    && finalStage.labelStable;
  return {
    ranked,
    samplesUsed: finalStage.targetSamples,
    stoppedAt: finalStage.targetSamples,
    stopReason: 'hard-cap',
    recommendationConfidence: stableAtCap ? 'clear' : 'uncertain',
    stages: history,
    choice: playedKey ? classifyAdaptiveChoice(ranked, playedKey, practicalGap) : null,
  };
}

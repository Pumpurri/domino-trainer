import {
  legalMovesFor,
  type BeliefState,
  type CalibrationPoint,
  type DeepDecisionComparison,
  type DecisionOption,
  type DecisionPublicState,
  type DecisionReview,
  type Move,
  type OpponentStyleProfile,
  type PlacedTile,
  type PublicEvent,
  type RoundReview,
  type StrategicPhase,
  type Tile,
} from './domino-engine.ts';

export type TrainingCategory =
  | 'pass-exploitation'
  | 'stop-one-tile'
  | 'end-control'
  | 'exit-sequence'
  | 'block-management'
  | 'inference';

export type TrainingOption = Omit<DecisionOption, 'pairedWins' | 'pairedWeights'>;
export type AnalysisQuality = 'live' | 'deep';
export type DeepReviewMetrics = {
  sampleCount: number;
  analyzed: number;
  agreed: number;
  changedRecommendations: number;
  unstableDecisions: number;
};
export type StoredCalibrationPoint = CalibrationPoint & { roundKey?: string };

export type TrainingExample = {
  id: string;
  roundKey: string;
  phase: StrategicPhase;
  hand: Tile[];
  handSizes: number[];
  ends: [number | null, number | null];
  publicState: DecisionPublicState;
  options: TrainingOption[];
  chosenKey: string;
  bestKey: string;
  verdict: DecisionReview['verdict'];
  estimatedWinRateLost: number;
  differenceInterval: [number, number];
  beliefConfidence: DecisionReview['confidence'];
  probabilityForecasts: { player: number; value: number; probability: number }[];
  styleProfiles: OpponentStyleProfile[];
  analysisQuality: AnalysisQuality;
  liveBestKey?: string;
  recommendationChanged?: boolean;
  unstable?: boolean;
};

export type RoundProgress = {
  id: string;
  completedAt: string;
  decisions: number;
  confidentMistakes: number;
  estimatedWinRateLost: number;
  byPhase: Partial<Record<StrategicPhase, { decisions: number; mistakes: number; loss: number }>>;
  weaknesses: Partial<Record<TrainingCategory, number>>;
  analysisQuality: AnalysisQuality;
  deepReview?: DeepReviewMetrics;
};

export type DrillProgress = {
  id: string;
  category: TrainingCategory;
  attempts: number;
  correct: number;
  currentStreak: number;
  bestStreak: number;
  lastAttemptAt: string;
};

export type TrainingProgress = {
  version: 1;
  rounds: RoundProgress[];
  drills: DrillProgress[];
  beliefCalibration: StoredCalibrationPoint[];
  styleCalibration: StoredCalibrationPoint[];
  examples: TrainingExample[];
};

export type CalibrationBucket = {
  label: string;
  count: number;
  averageForecast: number;
  observedRate: number;
};

export type CalibrationSummary = {
  samples: number;
  meanSquaredError: number | null;
  rating: 'not-enough-data' | 'well-calibrated' | 'mixed' | 'needs-work';
  buckets: CalibrationBucket[];
};

export type ProgressWindow = {
  size: 10 | 25 | 50;
  rounds: number;
  averageLoss: number | null;
  changeFromPrevious: number | null;
};

export type ProgressSummary = {
  rounds: number;
  decisions: number;
  averageLoss: number;
  confidentMistakes: number;
  masteredDrills: number;
  windows: ProgressWindow[];
  phases: Array<{ phase: StrategicPhase; decisions: number; mistakes: number; averageLoss: number }>;
  weaknesses: Array<{ category: TrainingCategory; count: number }>;
  beliefCalibration: CalibrationSummary;
  styleCalibration: CalibrationSummary;
  styleCalibrationByPlayer: Array<{ player: number; summary: CalibrationSummary }>;
  deepReview: {
    rounds: number;
    analyzed: number;
    agreed: number;
    changedRecommendations: number;
    unstableDecisions: number;
    agreementRate: number | null;
  };
};

export type RecordRoundProgressOptions = {
  analysisQuality?: AnalysisQuality;
  deepReview?: DeepReviewMetrics;
  comparisons?: DeepDecisionComparison[];
};

export type TargetedDrill = {
  id: string;
  category: TrainingCategory;
  title: string;
  goal: string;
  explanation: string;
  knownRead: string;
  hand: Tile[];
  chain: PlacedTile[];
  handSizes: number[];
  voids: number[][];
  consecutivePasses: number;
  options: Move[];
  bestKey: string;
};

const phases: StrategicPhase[] = ['opening', 'middle', 'late', 'block'];
const categoryNames: Record<TrainingCategory, string> = {
  'pass-exploitation': 'Force the pass',
  'stop-one-tile': 'Stop the one-tile player',
  'end-control': 'Choose the correct side',
  'exit-sequence': 'Build an exit sequence',
  'block-management': 'Manage the tranque',
  inference: 'Use the passes',
};

export const trainingStorageKey = 'mesa-quince-training-v1';

function moveKey(move: Pick<Move, 'tile' | 'side'>): string {
  return `${move.tile.id}:${move.side}`;
}

function cloneEvent(event: PublicEvent): PublicEvent {
  if (event.kind === 'pass') return { ...event, endsBefore: [...event.endsBefore] };
  return {
    ...event,
    tile: { ...event.tile },
    endsBefore: [...event.endsBefore],
    nextVoids: [...event.nextVoids],
  };
}

function clonePublicState(state: DecisionPublicState): DecisionPublicState {
  return {
    chain: state.chain.map((tile) => ({ ...tile })),
    starter: state.starter,
    voids: state.voids.map((values) => [...values]),
    consecutivePasses: state.consecutivePasses,
    events: state.events.map(cloneEvent),
  };
}

export function createEmptyTrainingProgress(): TrainingProgress {
  return {
    version: 1,
    rounds: [],
    drills: [],
    beliefCalibration: [],
    styleCalibration: [],
    examples: [],
  };
}

export function parseTrainingProgress(serialized: string | null): TrainingProgress {
  if (!serialized) return createEmptyTrainingProgress();
  try {
    const parsed = JSON.parse(serialized) as Partial<TrainingProgress>;
    if (parsed.version !== 1) return createEmptyTrainingProgress();
    return {
      version: 1,
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds.slice(-200).map((round) => ({
        ...round,
        analysisQuality: round.analysisQuality === 'deep' ? 'deep' : 'live',
      })) : [],
      drills: Array.isArray(parsed.drills) ? parsed.drills : [],
      beliefCalibration: Array.isArray(parsed.beliefCalibration) ? parsed.beliefCalibration.slice(-5000) : [],
      styleCalibration: Array.isArray(parsed.styleCalibration) ? parsed.styleCalibration.slice(-2500) : [],
      examples: Array.isArray(parsed.examples) ? parsed.examples.slice(-300).map((example) => ({
        ...example,
        analysisQuality: example.analysisQuality === 'deep' ? 'deep' : 'live',
      })) : [],
    };
  } catch {
    return createEmptyTrainingProgress();
  }
}

function isConfidentMistake(decision: DecisionReview): boolean {
  return ['slight', 'mistake', 'big-mistake'].includes(decision.verdict) && decision.interval[0] > 0;
}

export function decisionCategory(decision: DecisionReview): TrainingCategory {
  const { record, best, chosen } = decision;
  if (record.handSizes.slice(1).some((size) => size === 1)) return 'stop-one-tile';
  if (record.phase === 'block' || best.blockedWinRate - chosen.blockedWinRate >= 6) return 'block-management';
  if (best.nextPassRate - chosen.nextPassRate >= 7) return 'pass-exploitation';
  if (best.returnRate - chosen.returnRate >= 0.09) return 'exit-sequence';
  if (record.knownEvidence.length || record.inferredEvidence.length) return 'inference';
  return 'end-control';
}

function trainingExample(
  roundKey: string,
  decision: DecisionReview,
  quality: AnalysisQuality,
  comparison?: DeepDecisionComparison,
): TrainingExample {
  const { record } = decision;
  return {
    id: `${roundKey}:${record.id}`,
    roundKey,
    phase: record.phase,
    hand: record.hand.map((tile) => ({ ...tile })),
    handSizes: [...record.handSizes],
    ends: [...record.ends],
    publicState: clonePublicState(record.publicState),
    options: record.options.map((option) => ({
      key: option.key,
      tile: { ...option.tile },
      side: option.side,
      newLeft: option.newLeft,
      newRight: option.newRight,
      winRate: option.winRate,
      margin: option.margin,
      samples: option.samples,
      nextPassRate: option.nextPassRate,
      blockedWinRate: option.blockedWinRate,
      emptyWinRate: option.emptyWinRate,
      averagePipsWhenLosing: option.averagePipsWhenLosing,
      retainedEndMatches: option.retainedEndMatches,
      returnRate: option.returnRate,
    })),
    chosenKey: record.chosenKey,
    bestKey: record.bestKey,
    verdict: decision.verdict,
    estimatedWinRateLost: Math.max(0, decision.winRateGap),
    differenceInterval: [...decision.interval],
    beliefConfidence: decision.confidence,
    probabilityForecasts: record.probabilityForecasts.map((forecast) => ({ ...forecast })),
    styleProfiles: record.styleProfiles.map((style) => ({ ...style })),
    analysisQuality: quality,
    liveBestKey: comparison?.liveBestKey,
    recommendationChanged: comparison ? !comparison.agreed : undefined,
    unstable: comparison?.unstable,
  };
}

export function recordRoundProgress(
  progress: TrainingProgress,
  review: RoundReview,
  roundKey: string,
  completedAt = new Date().toISOString(),
  options: RecordRoundProgressOptions = {},
): TrainingProgress {
  const quality = options.analysisQuality ?? 'live';
  const existing = progress.rounds.find((round) => round.id === roundKey);
  if (existing && (existing.analysisQuality === 'deep' || quality === 'live')) return progress;
  const comparisonById = new Map((options.comparisons ?? []).map((comparison) => [comparison.recordId, comparison]));
  const byPhase: RoundProgress['byPhase'] = {};
  const weaknesses: RoundProgress['weaknesses'] = {};
  let confidentMistakes = 0;
  let estimatedWinRateLost = 0;
  review.decisions.forEach((decision) => {
    const mistake = isConfidentMistake(decision);
    const loss = mistake ? Math.max(0, decision.winRateGap) : 0;
    const current = byPhase[decision.record.phase] ?? { decisions: 0, mistakes: 0, loss: 0 };
    byPhase[decision.record.phase] = {
      decisions: current.decisions + 1,
      mistakes: current.mistakes + (mistake ? 1 : 0),
      loss: current.loss + loss,
    };
    if (mistake) {
      confidentMistakes += 1;
      estimatedWinRateLost += loss;
      const category = decisionCategory(decision);
      weaknesses[category] = (weaknesses[category] ?? 0) + 1;
    }
  });
  const round: RoundProgress = {
    id: roundKey,
    completedAt,
    decisions: review.decisions.length,
    confidentMistakes,
    estimatedWinRateLost,
    byPhase,
    weaknesses,
    analysisQuality: quality,
    deepReview: quality === 'deep' ? options.deepReview : undefined,
  };
  const rounds = progress.rounds.filter((saved) => saved.id !== roundKey);
  const beliefCalibration = progress.beliefCalibration.filter((point) => point.roundKey !== roundKey);
  const styleCalibration = progress.styleCalibration.filter((point) => point.roundKey !== roundKey);
  const examples = progress.examples.filter((example) => example.roundKey !== roundKey);
  return {
    version: 1,
    rounds: [...rounds, round].slice(-200),
    drills: progress.drills,
    beliefCalibration: [...beliefCalibration, ...review.calibration.belief.map((point) => ({ ...point, roundKey }))].slice(-5000),
    styleCalibration: [...styleCalibration, ...review.calibration.style.map((point) => ({ ...point, roundKey }))].slice(-2500),
    examples: [...examples, ...review.decisions.map((decision) => trainingExample(
      roundKey,
      decision,
      quality,
      comparisonById.get(decision.record.id),
    ))].slice(-300),
  };
}

export function recordDrillAttempt(
  progress: TrainingProgress,
  id: string,
  category: TrainingCategory,
  correct: boolean,
  attemptedAt = new Date().toISOString(),
): TrainingProgress {
  const previous = progress.drills.find((drill) => drill.id === id);
  const currentStreak = correct ? (previous?.currentStreak ?? 0) + 1 : 0;
  const next: DrillProgress = {
    id,
    category,
    attempts: (previous?.attempts ?? 0) + 1,
    correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(previous?.bestStreak ?? 0, currentStreak),
    lastAttemptAt: attemptedAt,
  };
  return {
    ...progress,
    drills: [...progress.drills.filter((drill) => drill.id !== id), next],
  };
}

export function calibrationSummary(points: CalibrationPoint[]): CalibrationSummary {
  const bucketRanges: Array<[number, number, string]> = [
    [0, 0.2, '0–20%'],
    [0.2, 0.4, '20–40%'],
    [0.4, 0.6, '40–60%'],
    [0.6, 0.8, '60–80%'],
    [0.8, 1.000001, '80–100%'],
  ];
  const buckets = bucketRanges.map(([minimum, maximum, label]) => {
    const included = points.filter((point) => point.forecast >= minimum && point.forecast < maximum);
    return {
      label,
      count: included.length,
      averageForecast: included.length ? included.reduce((sum, point) => sum + point.forecast, 0) / included.length : 0,
      observedRate: included.length ? included.reduce((sum, point) => sum + point.observed, 0) / included.length : 0,
    };
  });
  if (!points.length) return { samples: 0, meanSquaredError: null, rating: 'not-enough-data', buckets };
  const meanSquaredError = points.reduce((sum, point) => sum + (point.forecast - point.observed) ** 2, 0) / points.length;
  const rating: CalibrationSummary['rating'] = points.length < 40
    ? 'not-enough-data'
    : meanSquaredError <= 0.16
      ? 'well-calibrated'
      : meanSquaredError <= 0.23
        ? 'mixed'
        : 'needs-work';
  return { samples: points.length, meanSquaredError, rating, buckets };
}

function averageRoundLoss(rounds: RoundProgress[]): number | null {
  if (!rounds.length) return null;
  return rounds.reduce((sum, round) => sum + round.estimatedWinRateLost, 0) / rounds.length;
}

export function progressSummary(progress: TrainingProgress): ProgressSummary {
  const decisions = progress.rounds.reduce((sum, round) => sum + round.decisions, 0);
  const totalLoss = progress.rounds.reduce((sum, round) => sum + round.estimatedWinRateLost, 0);
  const confidentMistakes = progress.rounds.reduce((sum, round) => sum + round.confidentMistakes, 0);
  const windows = ([10, 25, 50] as const).map((size): ProgressWindow => {
    const current = progress.rounds.slice(-size);
    const previous = progress.rounds.slice(-size * 2, -size);
    const averageLoss = averageRoundLoss(current);
    const previousLoss = previous.length === size ? averageRoundLoss(previous) : null;
    return {
      size,
      rounds: current.length,
      averageLoss,
      changeFromPrevious: averageLoss !== null && previousLoss !== null ? averageLoss - previousLoss : null,
    };
  });
  const phaseRows = phases.map((phase) => {
    const totals = progress.rounds.reduce((sum, round) => {
      const value = round.byPhase[phase];
      return value ? {
        decisions: sum.decisions + value.decisions,
        mistakes: sum.mistakes + value.mistakes,
        loss: sum.loss + value.loss,
      } : sum;
    }, { decisions: 0, mistakes: 0, loss: 0 });
    return {
      phase,
      decisions: totals.decisions,
      mistakes: totals.mistakes,
      averageLoss: totals.decisions ? totals.loss / totals.decisions : 0,
    };
  });
  const weaknessCounts = new Map<TrainingCategory, number>();
  progress.rounds.forEach((round) => Object.entries(round.weaknesses).forEach(([category, count]) => {
    weaknessCounts.set(category as TrainingCategory, (weaknessCounts.get(category as TrainingCategory) ?? 0) + (count ?? 0));
  }));
  const deepRounds = progress.rounds.filter((round) => round.analysisQuality === 'deep' && round.deepReview);
  const deepTotals = deepRounds.reduce((total, round) => ({
    analyzed: total.analyzed + (round.deepReview?.analyzed ?? 0),
    agreed: total.agreed + (round.deepReview?.agreed ?? 0),
    changedRecommendations: total.changedRecommendations + (round.deepReview?.changedRecommendations ?? 0),
    unstableDecisions: total.unstableDecisions + (round.deepReview?.unstableDecisions ?? 0),
  }), { analyzed: 0, agreed: 0, changedRecommendations: 0, unstableDecisions: 0 });
  return {
    rounds: progress.rounds.length,
    decisions,
    averageLoss: progress.rounds.length ? totalLoss / progress.rounds.length : 0,
    confidentMistakes,
    masteredDrills: progress.drills.filter((drill) => drill.attempts >= 3 && drill.correct / drill.attempts >= 0.75).length,
    windows,
    phases: phaseRows,
    weaknesses: [...weaknessCounts.entries()].map(([category, count]) => ({ category, count })).sort((left, right) => right.count - left.count),
    beliefCalibration: calibrationSummary(progress.beliefCalibration),
    styleCalibration: calibrationSummary(progress.styleCalibration),
    styleCalibrationByPlayer: [1, 2].map((player) => ({
      player,
      summary: calibrationSummary(progress.styleCalibration.filter((point) => point.player === player)),
    })),
    deepReview: {
      rounds: deepRounds.length,
      ...deepTotals,
      agreementRate: deepTotals.analyzed ? deepTotals.agreed / deepTotals.analyzed : null,
    },
  };
}

function calibrationWeight(summary: CalibrationSummary): number {
  if (summary.rating === 'needs-work') return 0.3;
  if (summary.rating === 'mixed') return 0.65;
  return 1;
}

export function calibrationAdjustedBeliefState(
  state: BeliefState | null,
  summary: CalibrationSummary,
): BeliefState | null {
  if (!state) return null;
  const factor = calibrationWeight(summary);
  if (factor === 1) return state;
  const particles = state.particles.map((particle) => ({
    ...particle,
    weight: 1 + (particle.weight - 1) * factor,
  }));
  const total = particles.reduce((sum, particle) => sum + particle.weight, 0);
  const squared = particles.reduce((sum, particle) => sum + particle.weight * particle.weight, 0);
  return {
    ...state,
    particles,
    diagnostics: {
      ...state.diagnostics,
      effectiveSamples: squared ? total * total / squared : 0,
      confidence: summary.rating === 'needs-work'
        ? 'low'
        : state.diagnostics.confidence === 'high'
          ? 'moderate'
          : state.diagnostics.confidence,
    },
  };
}

export function calibrationAdjustedStyles(
  styles: OpponentStyleProfile[],
  summary: CalibrationSummary,
): OpponentStyleProfile[] {
  const factor = calibrationWeight(summary);
  if (factor === 1) return styles;
  return styles.map((style) => ({
    ...style,
    highPipTendency: 0.5 + (style.highPipTendency - 0.5) * factor,
    doubleTendency: 0.5 + (style.doubleTendency - 0.5) * factor,
    controlTendency: 0.5 + (style.controlTendency - 0.5) * factor,
    blockTendency: 0.5 + (style.blockTendency - 0.5) * factor,
    strategicConsistency: 0.5 + (style.strategicConsistency - 0.5) * factor,
    unpredictability: 0.5 + (style.unpredictability - 0.5) * factor,
    confidence: summary.rating === 'needs-work'
      ? 'low'
      : style.confidence === 'high'
        ? 'moderate'
        : style.confidence,
  }));
}

export function opponentArchetype(style: OpponentStyleProfile): string {
  if (style.observedChoices < 4) return 'Learning the player';
  const candidates = [
    { score: style.highPipTendency - 0.5, label: 'Pip shedder' },
    { score: style.doubleTendency - 0.5, label: 'Double-first player' },
    { score: style.controlTendency - 0.5, label: 'End controller' },
    { score: style.blockTendency - 0.5, label: 'Table blocker' },
    { score: style.unpredictability - 0.5, label: 'Unpredictable player' },
  ].sort((left, right) => right.score - left.score);
  return candidates[0].score >= 0.1 ? candidates[0].label : 'Balanced player';
}

export function serializeTrainingDataset(progress: TrainingProgress, exportedAt = new Date().toISOString()): string {
  return JSON.stringify({
    schema: 'mesa-quince-information-safe-v2',
    exportedAt,
    privacy: 'Contains public table state, the learner hand, model estimates, and post-round outcome labels. It never contains an opponent hidden hand or sleeping tiles.',
    analysis: {
      reviewedRounds: progress.rounds.map((round) => ({
        id: round.id,
        completedAt: round.completedAt,
        analysisQuality: round.analysisQuality,
        deepReview: round.deepReview,
      })),
    },
    examples: progress.examples,
    calibration: {
      belief: progress.beliefCalibration,
      style: progress.styleCalibration,
    },
  }, null, 2);
}

export function trainingCategoryLabel(category: TrainingCategory): string {
  return categoryNames[category];
}

function tile(a: number, b: number): Tile {
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  return { id: `${left}-${right}`, a: left, b: right };
}

function chainTile(a: number, b: number): PlacedTile {
  const base = tile(a, b);
  return { ...base, left: a, right: b, player: 2 };
}

function makeDrill(input: Omit<TargetedDrill, 'options' | 'bestKey'> & { bestTile: string; bestSide: Move['side'] }): TargetedDrill {
  const options = legalMovesFor(input.hand, input.chain);
  const bestKey = `${input.bestTile}:${input.bestSide}`;
  if (!options.some((move) => moveKey(move) === bestKey)) throw new Error(`Invalid targeted drill: ${input.id}`);
  return {
    id: input.id,
    category: input.category,
    title: input.title,
    goal: input.goal,
    explanation: input.explanation,
    knownRead: input.knownRead,
    hand: input.hand,
    chain: input.chain,
    handSizes: input.handSizes,
    voids: input.voids,
    consecutivePasses: input.consecutivePasses,
    options,
    bestKey,
  };
}

export const targetedDrills: TargetedDrill[] = [
  makeDrill({
    id: 'force-pass',
    category: 'pass-exploitation',
    title: 'Force Rosa to pass',
    goal: 'Use proven voids to take a turn away from the next player.',
    explanation: 'Playing 1–6 on the left leaves 6 and 9 open. Rosa is proven out of both, so the pass is guaranteed.',
    knownRead: 'Rosa has already passed on 6 and 9.',
    hand: [tile(1, 6), tile(4, 9), tile(2, 5), tile(3, 8)],
    chain: [chainTile(1, 9)],
    handSizes: [4, 4, 4],
    voids: [[], [6, 9], []],
    consecutivePasses: 0,
    bestTile: '1-6',
    bestSide: 'left',
  }),
  makeDrill({
    id: 'stop-one-tile',
    category: 'stop-one-tile',
    title: 'Stop the one-tile player',
    goal: 'Do not give Rosa an easy chance to go out.',
    explanation: 'Playing 2–5 on the left leaves 5 and 7. Rosa has one tile and is proven out of both numbers, so she cannot finish.',
    knownRead: 'Rosa has one tile and is proven out of 5 and 7.',
    hand: [tile(2, 5), tile(7, 8), tile(0, 4), tile(3, 9)],
    chain: [chainTile(2, 7)],
    handSizes: [4, 1, 4],
    voids: [[], [5, 7], []],
    consecutivePasses: 0,
    bestTile: '2-5',
    bestSide: 'left',
  }),
  makeDrill({
    id: 'correct-side',
    category: 'end-control',
    title: 'Choose the correct side',
    goal: 'The same tile can create two very different boards.',
    explanation: 'Play 2–7 on the left to leave 7 on both ends. Your 7–8 keeps a clean route back. Playing it right leaves 2 on both ends and strands your shape.',
    knownRead: 'No pass is certain, so your own return route matters most.',
    hand: [tile(2, 7), tile(7, 8), tile(8, 8), tile(1, 4)],
    chain: [chainTile(2, 7)],
    handSizes: [4, 4, 4],
    voids: [[], [], []],
    consecutivePasses: 0,
    bestTile: '2-7',
    bestSide: 'left',
  }),
  makeDrill({
    id: 'exit-sequence',
    category: 'exit-sequence',
    title: 'Build the exit sequence',
    goal: 'Plan more than one tile ahead late in the round.',
    explanation: 'The 4–6 connects directly into 6–9, then 9–9. That gives all three remaining tiles one connected route instead of splitting the hand.',
    knownRead: 'You are late in the round and need a connected path to zero tiles.',
    hand: [tile(4, 6), tile(6, 9), tile(9, 9), tile(2, 8)],
    chain: [chainTile(4, 8)],
    handSizes: [4, 3, 3],
    voids: [[], [], []],
    consecutivePasses: 0,
    bestTile: '4-6',
    bestSide: 'left',
  }),
  makeDrill({
    id: 'tranque',
    category: 'block-management',
    title: 'Prepare for the tranque',
    goal: 'Reduce your pip risk while keeping pressure on the table.',
    explanation: 'The 5–9 removes 14 pips and leaves 0 and 9. Rosa is proven out of both, so you unload the danger tile and keep the block pressure.',
    knownRead: 'Rosa is out of 0 and 9, and the table is close to blocking.',
    hand: [tile(0, 0), tile(5, 9), tile(1, 3), tile(2, 4)],
    chain: [chainTile(0, 5)],
    handSizes: [4, 3, 3],
    voids: [[], [0, 9], []],
    consecutivePasses: 2,
    bestTile: '5-9',
    bestSide: 'right',
  }),
  makeDrill({
    id: 'read-the-pass',
    category: 'inference',
    title: 'Turn a pass into a move',
    goal: 'Convert remembered table information into a concrete decision.',
    explanation: 'The 9–6 leaves 1 and 6. Rosa has already shown she cannot answer either number, so the public pass history gives you a certain result.',
    knownRead: 'Earlier passes proved Rosa has no 1 and no 6.',
    hand: [tile(1, 4), tile(6, 9), tile(2, 7), tile(3, 8)],
    chain: [chainTile(1, 9)],
    handSizes: [4, 4, 4],
    voids: [[], [1, 6], []],
    consecutivePasses: 0,
    bestTile: '6-9',
    bestSide: 'right',
  }),
];

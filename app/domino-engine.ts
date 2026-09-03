export type Tile = { id: string; a: number; b: number };
export type Side = 'left' | 'right';
export type PlacedTile = Tile & { left: number; right: number; player: number };
export type Move = {
  tile: Tile;
  side: Side;
  placedLeft: number;
  placedRight: number;
  newLeft: number;
  newRight: number;
};
export type Phase = 'pickStarter' | 'starterDrawn' | 'playing' | 'roundEnd' | 'matchEnd';
export type RoundResult = {
  winner: number | null;
  reason: 'empty' | 'blocked';
  pips: number[];
  matchWinner: number | null;
};
export type DrawResult = { choice: 'high' | 'low'; tiles: Tile[]; starter: number };
export type LastAction = { kind: 'play' | 'pass'; player: number; tileId?: string; text: string };
export type PublicEvent =
  | { kind: 'play'; player: number; tile: Tile; side: Side; endsBefore: [number | null, number | null]; nextVoids: number[] }
  | { kind: 'pass'; player: number; endsBefore: [number | null, number | null] };
export type Game = {
  phase: Phase;
  scores: number[];
  round: number;
  hands: Tile[][];
  chain: PlacedTile[];
  current: number;
  starter: number;
  voids: Set<number>[];
  consecutivePasses: number;
  result: RoundResult | null;
  starterDraw: DrawResult | null;
  history: string[];
  lastAction: LastAction | null;
  events: PublicEvent[];
};
export type Difficulty = 'casual' | 'strong';
export type StrategicPhase = 'opening' | 'middle' | 'late' | 'block';
export type StrategyContext = {
  phase: StrategicPhase;
  chainLength: number;
  consecutivePasses: number;
  unseenTiles: Tile[];
  expectedPips: number[];
};
export type MoveEvidence = {
  nextPassRate: number;
  blockedWinRate: number;
  emptyWinRate: number;
  averagePipsWhenLosing: number;
  retainedEndMatches: number;
};
export type LookaheadForecast = {
  score: number;
  returnRate: number;
  exploredBranches: number;
  plies: 3;
};
export type InformationSetSearchEvidence = {
  visits: number;
  averageUtility: number;
  informationSets: number;
  multiVisitInformationSets: number;
  deepestPly: number;
  averageTreePlies: number;
  revisitedActionRate: number;
  uniqueDeals: number;
  baseIterations: number;
  extraIterations: number;
  closeDecision: boolean;
  pairedBaseWins: number[];
  pairedBaseWeights: number[];
  pairedTreeWins: number[];
};
export type RatedMove = Move & {
  samples: number;
  effectiveSamples: number;
  winRate: number;
  margin: number;
  heuristic: number;
  lookahead: LookaheadForecast;
  treeSearch: InformationSetSearchEvidence;
  evidence: MoveEvidence;
};
export type SoftRead = { value: number; direction: 'more' | 'less'; probability: number; strength: 'weak' | 'moderate' };
export type PlayerBelief = { player: number; certainOut: number[]; softReads: SoftRead[] };
export type BeliefConfidence = 'low' | 'moderate' | 'high';
export type BeliefParticle = { hands: Tile[][]; weight: number };
export type BeliefDiagnostics = {
  particleCount: number;
  effectiveSamples: number;
  uniqueDeals: number;
  confidence: BeliefConfidence;
  eliminatedLastUpdate: number;
  reweightedLastUpdate: number;
  resampledLastUpdate: boolean;
};
export type BeliefState = {
  perspective: number;
  round: number;
  eventCount: number;
  targetCount: number;
  ownHandSignature: string;
  particles: BeliefParticle[];
  hardEvidenceUpdates: number;
  choiceUpdates: number;
  resampleCount: number;
  diagnostics: BeliefDiagnostics;
};
export type StyleConfidence = 'low' | 'moderate' | 'high';
export type OpponentStyleProfile = {
  player: number;
  observedChoices: number;
  doubleOpportunities: number;
  blockOpportunities: number;
  highPipTendency: number;
  doubleTendency: number;
  controlTendency: number;
  blockTendency: number;
  strategicConsistency: number;
  unpredictability: number;
  confidence: StyleConfidence;
  lastRound: number;
  lastEventCount: number;
};
export type DecisionOption = {
  key: string;
  tile: Tile;
  side: Side;
  newLeft: number;
  newRight: number;
  winRate: number;
  margin: number;
  samples: number;
  nextPassRate: number;
  blockedWinRate: number;
  emptyWinRate: number;
  averagePipsWhenLosing: number;
  retainedEndMatches: number;
  returnRate: number;
  pairedWins: number[];
  pairedWeights: number[];
};
export type DecisionPublicState = {
  chain: PlacedTile[];
  starter: number;
  voids: number[][];
  consecutivePasses: number;
  events: PublicEvent[];
};
export type BeliefProbabilityForecast = {
  player: number;
  value: number;
  probability: number;
};
export type DecisionRecord = {
  id: string;
  round: number;
  eventCount: number;
  phase: StrategicPhase;
  hand: Tile[];
  handSizes: number[];
  ends: [number | null, number | null];
  chosenKey: string;
  bestKey: string;
  options: DecisionOption[];
  knownEvidence: string[];
  inferredEvidence: string[];
  beliefs: PlayerBelief[];
  beliefConfidence: BeliefConfidence;
  publicState: DecisionPublicState;
  probabilityForecasts: BeliefProbabilityForecast[];
  styleProfiles: OpponentStyleProfile[];
  recommendationReason: string;
};
export type CalibrationPoint = {
  player: number;
  label: string;
  forecast: number;
  observed: number;
  confidence: BeliefConfidence | StyleConfidence;
};
export type DecisionVerdict = 'best' | 'close' | 'slight' | 'mistake' | 'big-mistake';
export type DecisionReview = {
  record: DecisionRecord;
  chosen: DecisionOption;
  best: DecisionOption;
  verdict: DecisionVerdict;
  winRateGap: number;
  interval: [number, number];
  confidence: BeliefConfidence;
  known: string;
  inferred: string;
  simulated: string;
  uncertainty: string;
  revealed: string;
  beliefChecks: { correct: number; total: number };
};
export type RoundReview = {
  round: number;
  decisions: DecisionReview[];
  biggestMistake: DecisionReview | null;
  bestDecision: DecisionReview | null;
  closeCalls: number;
  beliefChecks: { correct: number; total: number };
  calibration: {
    belief: CalibrationPoint[];
    style: CalibrationPoint[];
  };
  opponentStartingHands: { player: number; tiles: Tile[] }[];
};
export type DeepDecisionComparison = {
  recordId: string;
  analyzed: true;
  agreed: boolean;
  liveBestKey: string;
  deepBestKey: string;
  liveVerdict: DecisionVerdict;
  deepVerdict: DecisionVerdict;
  liveWinRateGap: number;
  deepWinRateGap: number;
  unstable: boolean;
};
export type DeepReviewReport = {
  review: RoundReview;
  comparisons: DeepDecisionComparison[];
  sampleCount: number;
  analyzed: number;
  agreed: number;
  changedRecommendations: number;
  unstableDecisions: number;
  agreementRate: number;
};
export type PracticeReply = {
  player: number;
  kind: 'play' | 'pass';
  tile?: Tile;
  side?: Side;
};
export type PracticeReplay = {
  dealCode: string;
  replies: PracticeReply[];
  returnedToUser: boolean;
  roundEnded: boolean;
  finalEnds: [number | null, number | null];
};
export type AnalysisOptions = {
  representativeLimit?: number;
  shardIndex?: number;
  shardCount?: number;
};

type WeightedSample = BeliefParticle;
type RolloutOutcome = {
  winner: number | null;
  reason: 'empty' | 'blocked' | 'cutoff';
  nextPlayerPassed: boolean;
  pips: number[];
};
type SolvedOutcome = { winner: number | null; reason: 'empty' | 'blocked'; utility: number[] };

const interactiveSearchSamples = 120;

export const names = ['You', 'Rosa', 'Tino'];

const doubleNineSet: Tile[] = [];
for (let a = 0; a <= 9; a += 1) {
  for (let b = a; b <= 9; b += 1) doubleNineSet.push({ id: `${a}-${b}`, a, b });
}

export function fullSet(): Tile[] {
  return [...doubleNineSet];
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pipTotal(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
}

export function initialGame(): Game {
  return {
    phase: 'pickStarter', scores: [0, 0, 0], round: 1, hands: [[], [], []], chain: [],
    current: 0, starter: 0, voids: [new Set(), new Set(), new Set()], consecutivePasses: 0,
    result: null, starterDraw: null, history: [], lastAction: null, events: [],
  };
}

export function drawForStarter(choice: 'high' | 'low', random: () => number = Math.random): DrawResult {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const tiles = shuffle(fullSet(), random).slice(0, 3);
    const totals = tiles.map((tile) => tile.a + tile.b);
    const target = choice === 'high' ? Math.max(...totals) : Math.min(...totals);
    const winners = totals.map((total, index) => total === target ? index : -1).filter((index) => index >= 0);
    if (winners.length === 1) return { choice, tiles, starter: winners[0] };
  }
  return { choice, tiles: fullSet().slice(0, 3), starter: 0 };
}

export function dealRound(game: Game, starter: number, random: () => number = Math.random): Game {
  const deck = shuffle(fullSet(), random);
  const hands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)]
    .map((hand) => [...hand].sort((x, y) => x.a - y.a || x.b - y.b));
  return {
    ...game, phase: 'playing', hands, chain: [], current: starter, starter,
    voids: [new Set(), new Set(), new Set()], consecutivePasses: 0, result: null,
    history: [`${names[starter]} opened round ${game.round}.`], lastAction: null, events: [],
  };
}

export function endsOf(chain: PlacedTile[]): [number | null, number | null] {
  if (!chain.length) return [null, null];
  return [chain[0].left, chain[chain.length - 1].right];
}

function legalMovesForEnds(hand: Tile[], leftEnd: number | null, rightEnd: number | null): Move[] {
  if (leftEnd === null || rightEnd === null) {
    return hand.map((tile) => ({ tile, side: 'right', placedLeft: tile.a, placedRight: tile.b, newLeft: tile.a, newRight: tile.b }));
  }

  const moves: Move[] = [];
  for (const tile of hand) {
    if (tile.a === leftEnd) moves.push({ tile, side: 'left', placedLeft: tile.b, placedRight: tile.a, newLeft: tile.b, newRight: rightEnd });
    else if (tile.b === leftEnd) moves.push({ tile, side: 'left', placedLeft: tile.a, placedRight: tile.b, newLeft: tile.a, newRight: rightEnd });

    if (leftEnd !== rightEnd) {
      if (tile.a === rightEnd) moves.push({ tile, side: 'right', placedLeft: tile.a, placedRight: tile.b, newLeft: leftEnd, newRight: tile.b });
      else if (tile.b === rightEnd) moves.push({ tile, side: 'right', placedLeft: tile.b, placedRight: tile.a, newLeft: leftEnd, newRight: tile.a });
    } else if (!moves.some((move) => move.tile.id === tile.id)) {
      if (tile.a === rightEnd) moves.push({ tile, side: 'right', placedLeft: tile.a, placedRight: tile.b, newLeft: leftEnd, newRight: tile.b });
      else if (tile.b === rightEnd) moves.push({ tile, side: 'right', placedLeft: tile.b, placedRight: tile.a, newLeft: leftEnd, newRight: tile.a });
    }
  }
  return moves;
}

export function legalMovesFor(hand: Tile[], chain: PlacedTile[]): Move[] {
  const [left, right] = endsOf(chain);
  return legalMovesForEnds(hand, left, right);
}

export function describeMove(move: Move, chainLength: number): string {
  if (!chainLength) return `${move.tile.a}–${move.tile.b} to open`;
  return `${move.tile.a}–${move.tile.b} on the ${move.side}`;
}

function finishRound(game: Game, winner: number | null, reason: 'empty' | 'blocked'): Game {
  const pips = game.hands.map(pipTotal);
  const scores = [...game.scores];
  if (winner !== null) scores[winner] += 1;
  const matchWinner = scores.findIndex((score) => score >= 15);
  return {
    ...game,
    scores,
    phase: matchWinner >= 0 ? 'matchEnd' : 'roundEnd',
    result: { winner, reason, pips, matchWinner: matchWinner >= 0 ? matchWinner : null },
    history: [...game.history, winner === null ? 'The blocked round ended in a tie. No point.' : `${names[winner]} won the round.`],
  };
}

export function applyMove(game: Game, move: Move): Game {
  const player = game.current;
  const endsBefore = endsOf(game.chain);
  const hands = game.hands.map((hand, index) => index === player ? hand.filter((tile) => tile.id !== move.tile.id) : hand);
  const placed: PlacedTile = { ...move.tile, left: move.placedLeft, right: move.placedRight, player };
  const chain = game.chain.length === 0 ? [placed] : move.side === 'left' ? [placed, ...game.chain] : [...game.chain, placed];
  const next: Game = {
    ...game, hands, chain, current: (player + 1) % 3, consecutivePasses: 0,
    history: [...game.history, `${names[player]} played ${describeMove(move, game.chain.length)}.`],
    lastAction: { kind: 'play', player, tileId: move.tile.id, text: `${names[player]} played ${move.tile.a}–${move.tile.b}` },
    events: [...game.events, { kind: 'play', player, tile: move.tile, side: move.side, endsBefore, nextVoids: [...game.voids[(player + 1) % 3]] }],
  };
  return hands[player].length === 0 ? finishRound(next, player, 'empty') : next;
}

export function applyPass(game: Game): Game {
  const player = game.current;
  const [left, right] = endsOf(game.chain);
  const voids = game.voids.map((values) => new Set(values));
  if (left !== null) voids[player].add(left);
  if (right !== null) voids[player].add(right);
  const passed: Game = {
    ...game, voids, current: (player + 1) % 3, consecutivePasses: game.consecutivePasses + 1,
    history: [...game.history, `${names[player]} passed on ${left} and ${right}.`],
    lastAction: { kind: 'pass', player, text: `${names[player]} passed on ${left} and ${right}` },
    events: [...game.events, { kind: 'pass', player, endsBefore: [left, right] }],
  };
  if (passed.consecutivePasses < 3) return passed;
  const pips = passed.hands.map(pipTotal);
  const lowest = Math.min(...pips);
  const possible = pips.map((value, index) => value === lowest ? index : -1).filter((index) => index >= 0);
  return finishRound(passed, possible.length === 1 ? possible[0] : null, 'blocked');
}

export function seededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619);
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function blankOpponentStyle(player: number): OpponentStyleProfile {
  return {
    player,
    observedChoices: 0,
    doubleOpportunities: 0,
    blockOpportunities: 0,
    highPipTendency: 0.5,
    doubleTendency: 0.5,
    controlTendency: 0.5,
    blockTendency: 0.5,
    strategicConsistency: 0.5,
    unpredictability: 0.5,
    confidence: 'low',
    lastRound: 0,
    lastEventCount: 0,
  };
}

export function createOpponentStyles(): OpponentStyleProfile[] {
  return [1, 2].map(blankOpponentStyle);
}

function styleForPlayer(styles: OpponentStyleProfile[] | undefined, player: number): OpponentStyleProfile | undefined {
  return styles?.find((style) => style.player === player && style.observedChoices > 0);
}

function uniqueEnds(move: Move): number[] {
  return move.newLeft === move.newRight ? [move.newLeft] : [move.newLeft, move.newRight];
}

function openValues(left: number | null, right: number | null): number[] {
  if (left === null || right === null) return [];
  return left === right ? [left] : [left, right];
}

function matchesValue(tile: Tile, value: number): boolean {
  return tile.a === value || tile.b === value;
}

function connectionProfile(hand: Tile[]): { repeatedValues: number; components: number } {
  if (!hand.length) return { repeatedValues: 0, components: 0 };
  const counts = Array.from({ length: 10 }, (_, value) => hand.filter((tile) => matchesValue(tile, value)).length);
  const repeatedValues = counts.reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const parents = hand.map((_, index) => index);
  const root = (index: number): number => {
    let current = index;
    while (parents[current] !== current) {
      parents[current] = parents[parents[current]];
      current = parents[current];
    }
    return current;
  };
  const join = (left: number, right: number) => {
    const leftRoot = root(left);
    const rightRoot = root(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  for (let left = 0; left < hand.length; left += 1) {
    for (let right = left + 1; right < hand.length; right += 1) {
      if ([hand[left].a, hand[left].b].some((value) => matchesValue(hand[right], value))) join(left, right);
    }
  }
  return { repeatedValues, components: new Set(hand.map((_, index) => root(index))).size };
}

function reachableExitTiles(hand: Tile[], ends: number[]): number {
  const reachableValues = new Set(ends);
  const reachedTiles = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const tile of hand) {
      if (reachedTiles.has(tile.id) || (!reachableValues.has(tile.a) && !reachableValues.has(tile.b))) continue;
      reachedTiles.add(tile.id);
      reachableValues.add(tile.a);
      reachableValues.add(tile.b);
      changed = true;
    }
  }
  return reachedTiles.size;
}

function answerProbability(unseenTiles: Tile[], handSize: number, knownVoids: Set<number>, ends: number[]): number {
  if (!handSize || !ends.length) return 0;
  const allowed = unseenTiles.filter((tile) => !knownVoids.has(tile.a) && !knownVoids.has(tile.b));
  const matching = allowed.filter((tile) => ends.some((value) => matchesValue(tile, value))).length;
  const sampleSize = Math.min(handSize, allowed.length);
  if (!matching || !sampleSize) return 0;
  if (allowed.length - matching < sampleSize) return 1;
  let misses = 1;
  for (let draw = 0; draw < sampleSize; draw += 1) {
    misses *= (allowed.length - matching - draw) / (allowed.length - draw);
  }
  return 1 - misses;
}

function inferStrategicPhase(
  hand: Tile[],
  handSizes: number[],
  chainLength: number,
  consecutivePasses: number,
  left: number | null,
  right: number | null,
  voids: Set<number>[],
  player: number,
): StrategicPhase {
  const totalTiles = handSizes.reduce((sum, size) => sum + size, 0);
  const ends = openValues(left, right);
  const opponents = [0, 1, 2].filter((candidate) => candidate !== player);
  const provenUnable = ends.length
    ? opponents.filter((candidate) => ends.every((value) => voids[candidate].has(value))).length
    : 0;
  const currentEndSupply = ends.reduce((sum, value) => sum + hand.filter((tile) => matchesValue(tile, value)).length, 0);
  const likelyBlock = ends.length > 0 && (
    consecutivePasses >= 2
    || (consecutivePasses >= 1 && totalTiles <= 20)
    || (provenUnable >= 1 && totalTiles <= 16)
    || (totalTiles <= 12 && currentEndSupply <= 1)
  );
  if (likelyBlock) return 'block';
  if (handSizes[player] <= 3 || opponents.some((candidate) => handSizes[candidate] <= 2) || totalTiles <= 15) return 'late';
  if (chainLength <= 6 && handSizes.every((size) => size >= 7)) return 'opening';
  return 'middle';
}

function strategyContextForState({
  hand,
  handSizes,
  chainLength,
  consecutivePasses,
  left,
  right,
  voids,
  player,
  playedTiles,
}: {
  hand: Tile[];
  handSizes: number[];
  chainLength: number;
  consecutivePasses: number;
  left: number | null;
  right: number | null;
  voids: Set<number>[];
  player: number;
  playedTiles: Tile[];
}): StrategyContext {
  const known = new Set([...hand, ...playedTiles].map((tile) => tile.id));
  const unseenTiles = fullSet().filter((tile) => !known.has(tile.id));
  const averageUnseenPips = unseenTiles.length
    ? unseenTiles.reduce((sum, tile) => sum + tile.a + tile.b, 0) / unseenTiles.length
    : 9;
  return {
    phase: inferStrategicPhase(hand, handSizes, chainLength, consecutivePasses, left, right, voids, player),
    chainLength,
    consecutivePasses,
    unseenTiles,
    expectedPips: handSizes.map((size, candidate) => candidate === player ? pipTotal(hand) : size * averageUnseenPips),
  };
}

function strategyContextForGame(game: Game, player: number): StrategyContext {
  const [left, right] = endsOf(game.chain);
  return strategyContextForState({
    hand: game.hands[player],
    handSizes: game.hands.map((hand) => hand.length),
    chainLength: game.chain.length,
    consecutivePasses: game.consecutivePasses,
    left,
    right,
    voids: game.voids,
    player,
    playedTiles: game.chain,
  });
}

export function detectStrategicPhase(game: Game, player = game.current): StrategicPhase {
  return strategyContextForGame(game, player).phase;
}

function fallbackStrategyContext(hand: Tile[], handSizes: number[], voids: Set<number>[], player: number, move: Move): StrategyContext {
  return strategyContextForState({
    hand,
    handSizes,
    chainLength: Math.max(0, 30 - handSizes.reduce((sum, size) => sum + size, 0)),
    consecutivePasses: 0,
    left: move.newLeft,
    right: move.newRight,
    voids,
    player,
    playedTiles: [],
  });
}

export function moveHeuristic(
  move: Move,
  hand: Tile[],
  voids: Set<number>[],
  player: number,
  handSizes: number[] = [10, 10, 10],
  suppliedContext?: StrategyContext,
): number {
  const remaining = hand.filter((tile) => tile.id !== move.tile.id);
  if (!remaining.length) return 1000;
  const context = suppliedContext ?? fallbackStrategyContext(hand, handSizes, voids, player, move);
  const ends = uniqueEnds(move);
  const next = (player + 1) % 3;
  const other = (player + 2) % 3;
  const control = ends.reduce((sum, value) => sum + remaining.filter((tile) => tile.a === value || tile.b === value).length, 0);
  const nextAnswer = answerProbability(context.unseenTiles, handSizes[next], voids[next], ends);
  const otherAnswer = answerProbability(context.unseenTiles, handSizes[other], voids[other], ends);
  const nextPassChance = 1 - nextAnswer;
  const otherPassChance = 1 - otherAnswer;
  const certainNextPass = ends.every((value) => voids[next].has(value));
  const certainOtherPass = ends.every((value) => voids[other].has(value));
  const pipRelief = move.tile.a + move.tile.b;
  const remainingPips = pipTotal(remaining);
  const doubleRelief = move.tile.a === move.tile.b ? 1 : 0;
  const mobility = new Set(remaining.flatMap((tile) => [tile.a, tile.b])).size;
  const connection = connectionProfile(remaining);
  const disconnectedPenalty = Math.max(0, connection.components - 1);
  const reconnectPenalty = control ? 0 : 1;
  const exitRun = context.phase === 'late' || context.phase === 'block'
    ? reachableExitTiles(remaining, ends)
    : 0;
  const expectedOpponentLow = Math.min(context.expectedPips[next], context.expectedPips[other]);
  const pipLead = expectedOpponentLow - remainingPips;
  const closurePressure = nextPassChance + otherPassChance * 0.65 + (control ? -0.1 : 0.25);

  if (context.phase === 'opening') {
    return control * 1.45
      + connection.repeatedValues * 0.42
      - disconnectedPenalty * 0.75
      + mobility * 0.08
      + nextPassChance * 1.1
      + otherPassChance * 0.25
      + (certainNextPass ? 1.2 : 0)
      + pipRelief * 0.1
      + doubleRelief * (pipRelief >= 12 ? 0.9 : 0.35)
      - reconnectPenalty * 2.1;
  }

  if (context.phase === 'late') {
    const immediateThreatWeight = handSizes[next] <= 1 ? 13 : handSizes[next] <= 2 ? 8 : 4.5;
    const laterThreatWeight = handSizes[other] <= 1 ? 5 : handSizes[other] <= 2 ? 3 : 1;
    return control * 1.35
      + nextPassChance * immediateThreatWeight
      + otherPassChance * laterThreatWeight
      + (certainNextPass ? (handSizes[next] <= 2 ? 7 : 5) : 0)
      + (certainOtherPass ? 1.5 : 0)
      + pipRelief * 0.34
      + doubleRelief * 2.1
      + exitRun * 1.15
      + connection.repeatedValues * 0.18
      - disconnectedPenalty * 0.55
      - reconnectPenalty * 2.6;
  }

  if (context.phase === 'block') {
    const blockEdge = Math.max(-18, Math.min(18, pipLead));
    return control * 0.85
      + nextPassChance * 4.5
      + otherPassChance * 2.8
      + (certainNextPass ? 4 : 0)
      + (certainOtherPass ? 2 : 0)
      + pipRelief * 0.4
      + doubleRelief * 1.6
      + exitRun * 0.65
      + closurePressure * blockEdge * 0.22
      - remainingPips * 0.025
      - disconnectedPenalty * 0.3
      - reconnectPenalty * 1.25;
  }

  return control * 1.25
    + nextPassChance * (handSizes[next] <= 2 ? 8 : 5.2)
    + otherPassChance * 1.35
    + (certainNextPass ? 3.5 : 0)
    + pipRelief * 0.21
    + doubleRelief * (remaining.length <= 4 ? 2.1 : 1.15)
    + connection.repeatedValues * 0.18
    + mobility * 0.05
    - disconnectedPenalty * 0.35
    - reconnectPenalty * 1.9;
}

export function chooseCasualMove(game: Game, moves: Move[]): Move {
  const handSizes = game.hands.map((hand) => hand.length);
  const context = strategyContextForGame(game, game.current);
  return [...moves].sort((a, b) => moveHeuristic(b, game.hands[game.current], game.voids, game.current, handSizes, context) - moveHeuristic(a, game.hands[game.current], game.voids, game.current, handSizes, context))[0];
}

function handRespectsVoids(hand: Tile[], voids: Set<number>): boolean {
  return hand.every((tile) => !voids.has(tile.a) && !voids.has(tile.b));
}

export function samplePossibleHands(game: Game, perspective: number, random: () => number): Tile[][] | null {
  const known = new Set([...game.hands[perspective], ...game.chain].map((tile) => tile.id));
  const unknown = fullSet().filter((tile) => !known.has(tile.id));
  const hiddenPlayers = [0, 1, 2].filter((player) => player !== perspective);

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const pool = shuffle(unknown, random);
    const sampled: Tile[][] = [[], [], []];
    sampled[perspective] = [...game.hands[perspective]];
    let offset = 0;
    let valid = true;
    for (const player of hiddenPlayers) {
      sampled[player] = pool.slice(offset, offset + game.hands[player].length);
      offset += game.hands[player].length;
      if (!handRespectsVoids(sampled[player], game.voids[player])) { valid = false; break; }
    }
    if (valid) return sampled;
  }
  return null;
}

function chainFromEnds(ends: [number | null, number | null]): PlacedTile[] {
  const [left, right] = ends;
  if (left === null || right === null) return [];
  return [{ id: `belief-${left}-${right}`, a: left, b: right, left, right, player: -1 }];
}

function voidsBeforeEvent(game: Game, eventIndex: number): Set<number>[] {
  const voids = [new Set<number>(), new Set<number>(), new Set<number>()];
  game.events.slice(0, eventIndex).forEach((event) => {
    if (event.kind !== 'pass') return;
    const [left, right] = event.endsBefore;
    if (left !== null) voids[event.player].add(left);
    if (right !== null) voids[event.player].add(right);
  });
  return voids;
}

function handsBeforeEvent(game: Game, sampledHands: Tile[][], eventIndex: number): Tile[][] {
  const reconstructed = sampledHands.map((hand) => new Map(hand.map((tile) => [tile.id, tile])));
  for (let futureIndex = eventIndex; futureIndex < game.events.length; futureIndex += 1) {
    const future = game.events[futureIndex];
    if (future.kind === 'play') reconstructed[future.player].set(future.tile.id, future.tile);
  }
  return reconstructed.map((hand) => [...hand.values()]);
}

type StyleMoveFeatures = {
  highPips: number;
  double: number;
  control: number;
  block: number;
  strategic: number;
};

function rankFraction(value: number, values: number[]): number {
  if (values.length <= 1) return 0.5;
  const below = values.filter((candidate) => candidate < value).length;
  const equal = values.filter((candidate) => candidate === value).length;
  return (below + Math.max(0, equal - 1) / 2) / (values.length - 1);
}

function styleFeaturesForMoves(
  legal: Move[],
  hand: Tile[],
  voids: Set<number>[],
  player: number,
  handSizes: number[],
  context: StrategyContext,
): Map<string, StyleMoveFeatures> {
  const pipValues = legal.map((move) => move.tile.a + move.tile.b);
  const controlValues = legal.map((move) => {
    const remaining = hand.filter((tile) => tile.id !== move.tile.id);
    return uniqueEnds(move).reduce(
      (sum, value) => sum + remaining.filter((tile) => matchesValue(tile, value)).length,
      0,
    );
  });
  const next = (player + 1) % 3;
  const blockValues = legal.map((move) => {
    const ends = uniqueEnds(move);
    const estimatedPass = 1 - answerProbability(context.unseenTiles, handSizes[next], voids[next], ends);
    const certainPass = ends.every((value) => voids[next].has(value)) ? 1 : 0;
    return estimatedPass + certainPass;
  });
  const strategicValues = legal.map((move) => moveHeuristic(move, hand, voids, player, handSizes, context));
  return new Map(legal.map((move, index) => [moveKey(move), {
    highPips: rankFraction(pipValues[index], pipValues),
    double: move.tile.a === move.tile.b ? 1 : 0,
    control: rankFraction(controlValues[index], controlValues),
    block: rankFraction(blockValues[index], blockValues),
    strategic: rankFraction(strategicValues[index], strategicValues),
  }]));
}

function styleAdjustedScores(
  legal: Move[],
  hand: Tile[],
  voids: Set<number>[],
  player: number,
  handSizes: number[],
  context: StrategyContext,
  style?: OpponentStyleProfile,
): number[] {
  const base = legal.map((move) => moveHeuristic(move, hand, voids, player, handSizes, context));
  if (!style || style.observedChoices < 2) return base;
  const confidence = Math.min(1, style.observedChoices / 10);
  const features = styleFeaturesForMoves(legal, hand, voids, player, handSizes, context);
  return legal.map((move, index) => {
    const feature = features.get(moveKey(move))!;
    const preference = (
      (style.highPipTendency - 0.5) * (feature.highPips - 0.5) * 5
      + (style.doubleTendency - 0.5) * (feature.double - 0.5) * 3
      + (style.controlTendency - 0.5) * (feature.control - 0.5) * 5
      + (style.blockTendency - 0.5) * (feature.block - 0.5) * 5
    ) * confidence;
    return base[index] + preference;
  });
}

function observedChoiceProbability(
  game: Game,
  eventIndex: number,
  hands: Tile[][],
  styles?: OpponentStyleProfile[],
): number {
  const event = game.events[eventIndex];
  if (event.kind !== 'play') return 1;
  const [left, right] = event.endsBefore;
  const hand = hands[event.player];
  const legal = legalMovesFor(hand, chainFromEnds(event.endsBefore));
  const observed = legal.find((move) => move.tile.id === event.tile.id && move.side === event.side)
    ?? legal.find((move) => move.tile.id === event.tile.id);
  if (!observed) return 0;
  if (left === null || right === null || legal.length <= 1) return 1;

  const eventsBefore = game.events.slice(0, eventIndex);
  const eventVoids = voidsBeforeEvent(game, eventIndex);
  let consecutivePasses = 0;
  for (let pastIndex = eventsBefore.length - 1; pastIndex >= 0; pastIndex -= 1) {
    if (eventsBefore[pastIndex].kind !== 'pass') break;
    consecutivePasses += 1;
  }
  const playedTiles = eventsBefore.flatMap((past) => past.kind === 'play' ? [past.tile] : []);
  const handSizes = hands.map((candidate) => candidate.length);
  const context = strategyContextForState({
    hand,
    handSizes,
    chainLength: playedTiles.length,
    consecutivePasses,
    left,
    right,
    voids: eventVoids,
    player: event.player,
    playedTiles,
  });
  const style = styleForPlayer(styles, event.player);
  const scores = styleAdjustedScores(legal, hand, eventVoids, event.player, handSizes, context, style);
  const maximum = Math.max(...scores);
  const temperature = style ? 2.8 - style.strategicConsistency * 1.1 : 2.25;
  const weights = scores.map((score) => Math.exp((score - maximum) / temperature));
  const observedIndex = legal.indexOf(observed);
  const strategicProbability = weights[observedIndex] / weights.reduce((sum, weight) => sum + weight, 0);
  const randomShare = style ? 0.18 + style.unpredictability * 0.35 : 0.4;
  return randomShare / legal.length + (1 - randomShare) * strategicProbability;
}

function choiceLikelihood(
  game: Game,
  sampledHands: Tile[][],
  perspective: number,
  styles?: OpponentStyleProfile[],
): number {
  let logLikelihood = 0;
  game.events.forEach((event, eventIndex) => {
    if (event.kind !== 'play' || event.player === perspective || event.endsBefore[0] === null) return;
    const probability = observedChoiceProbability(game, eventIndex, handsBeforeEvent(game, sampledHands, eventIndex), styles);
    logLikelihood += Math.log(Math.max(probability, 0.008));
  });
  return Math.exp(Math.max(-10, logLikelihood * 0.38));
}

function buildParticles(
  game: Game,
  perspective: number,
  count: number,
  seed: string,
  styles?: OpponentStyleProfile[],
): WeightedSample[] {
  const random = seededRandom(seed);
  const samples: WeightedSample[] = [];
  let attempts = 0;
  const maximumAttempts = Math.max(240, count * 8);
  while (samples.length < count && attempts < maximumAttempts) {
    attempts += 1;
    const hands = samplePossibleHands(game, perspective, random);
    if (hands) samples.push({ hands, weight: choiceLikelihood(game, hands, perspective, styles) });
  }
  return samples;
}

type StyleObservation = {
  highPips: number;
  double: number | null;
  control: number;
  block: number | null;
  strategic: number;
};

function styleObservationForEvent(game: Game, eventIndex: number, hands: Tile[][]): StyleObservation | null {
  const event = game.events[eventIndex];
  if (event.kind !== 'play' || event.endsBefore[0] === null) return null;
  const hand = hands[event.player];
  const legal = legalMovesFor(hand, chainFromEnds(event.endsBefore));
  const observed = legal.find((move) => move.tile.id === event.tile.id && move.side === event.side)
    ?? legal.find((move) => move.tile.id === event.tile.id);
  if (!observed || legal.length <= 1) return null;
  const eventsBefore = game.events.slice(0, eventIndex);
  const eventVoids = voidsBeforeEvent(game, eventIndex);
  let consecutivePasses = 0;
  for (let index = eventsBefore.length - 1; index >= 0 && eventsBefore[index].kind === 'pass'; index -= 1) {
    consecutivePasses += 1;
  }
  const playedTiles = eventsBefore.flatMap((past) => past.kind === 'play' ? [past.tile] : []);
  const handSizes = hands.map((candidate) => candidate.length);
  const context = strategyContextForState({
    hand,
    handSizes,
    chainLength: playedTiles.length,
    consecutivePasses,
    left: event.endsBefore[0],
    right: event.endsBefore[1],
    voids: eventVoids,
    player: event.player,
    playedTiles,
  });
  const features = styleFeaturesForMoves(legal, hand, eventVoids, event.player, handSizes, context);
  const chosen = features.get(moveKey(observed))!;
  const blockValues = legal.map((move) => features.get(moveKey(move))!.block);
  return {
    highPips: chosen.highPips,
    double: legal.some((move) => move.tile.a === move.tile.b) ? chosen.double : null,
    control: chosen.control,
    block: Math.max(...blockValues) > Math.min(...blockValues) ? chosen.block : null,
    strategic: chosen.strategic,
  };
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0.5;
}

function extendAverage(current: number, currentCount: number, additions: number[]): number {
  if (!additions.length) return current;
  return (current * currentCount + additions.reduce((sum, value) => sum + value, 0))
    / (currentCount + additions.length);
}

export function updateOpponentStyles(
  previous: OpponentStyleProfile[] | null,
  game: Game,
  beliefState?: BeliefState,
): OpponentStyleProfile[] {
  const profiles = previous?.length ? previous : createOpponentStyles();
  if (profiles.every((profile) => profile.lastRound === game.round && profile.lastEventCount === game.events.length)) {
    return profiles;
  }
  const currentParticles = currentBeliefParticles(game, 0, beliefState);
  const samples = currentParticles
    ? representativeParticles(currentParticles, 48)
    : buildParticles(game, 0, 48, beliefSeed(game, 0, 'style-learning'));

  return profiles.map((profile) => {
    const start = profile.lastRound === game.round ? profile.lastEventCount : 0;
    const observations: StyleObservation[] = [];
    for (let eventIndex = start; eventIndex < game.events.length; eventIndex += 1) {
      const event = game.events[eventIndex];
      if (event.kind !== 'play' || event.player !== profile.player || event.endsBefore[0] === null) continue;
      const possible = samples
        .map((sample) => styleObservationForEvent(game, eventIndex, handsBeforeEvent(game, sample.hands, eventIndex)))
        .filter((value): value is StyleObservation => value !== null);
      if (!possible.length) continue;
      const doubles = possible.flatMap((value) => value.double === null ? [] : [value.double]);
      const blocks = possible.flatMap((value) => value.block === null ? [] : [value.block]);
      observations.push({
        highPips: average(possible.map((value) => value.highPips)),
        double: doubles.length ? average(doubles) : null,
        control: average(possible.map((value) => value.control)),
        block: blocks.length ? average(blocks) : null,
        strategic: average(possible.map((value) => value.strategic)),
      });
    }

    const doubleValues = observations.flatMap((value) => value.double === null ? [] : [value.double]);
    const blockValues = observations.flatMap((value) => value.block === null ? [] : [value.block]);
    const observedChoices = profile.observedChoices + observations.length;
    const strategicConsistency = extendAverage(
      profile.strategicConsistency,
      profile.observedChoices,
      observations.map((value) => value.strategic),
    );
    return {
      ...profile,
      observedChoices,
      highPipTendency: extendAverage(profile.highPipTendency, profile.observedChoices, observations.map((value) => value.highPips)),
      doubleTendency: extendAverage(profile.doubleTendency, profile.doubleOpportunities, doubleValues),
      doubleOpportunities: profile.doubleOpportunities + doubleValues.length,
      controlTendency: extendAverage(profile.controlTendency, profile.observedChoices, observations.map((value) => value.control)),
      blockTendency: extendAverage(profile.blockTendency, profile.blockOpportunities, blockValues),
      blockOpportunities: profile.blockOpportunities + blockValues.length,
      strategicConsistency,
      unpredictability: 1 - strategicConsistency,
      confidence: observedChoices >= 10 ? 'high' : observedChoices >= 4 ? 'moderate' : 'low',
      lastRound: game.round,
      lastEventCount: game.events.length,
    };
  });
}

export function describeOpponentStyle(style: OpponentStyleProfile): string[] {
  if (style.observedChoices < 2) return ['Not enough choices observed yet'];
  const reads: Array<{ strength: number; text: string }> = [
    { strength: Math.abs(style.highPipTendency - 0.5), text: style.highPipTendency >= 0.5 ? 'Often unloads high pips' : 'Often preserves high-pip tiles' },
    { strength: Math.abs(style.doubleTendency - 0.5), text: style.doubleTendency >= 0.5 ? 'Plays doubles when available' : 'Often protects doubles' },
    { strength: Math.abs(style.controlTendency - 0.5), text: style.controlTendency >= 0.5 ? 'Favors connected numbers' : 'Accepts weaker return paths' },
    { strength: Math.abs(style.blockTendency - 0.5), text: style.blockTendency >= 0.5 ? 'Leans toward pressure and blocks' : 'Rarely forces blocking lines' },
    { strength: Math.abs(style.strategicConsistency - 0.5), text: style.strategicConsistency >= 0.5 ? 'Makes consistent strategic choices' : 'Plays unpredictably' },
  ];
  return reads.sort((left, right) => right.strength - left.strength).slice(0, 2).map(({ text }) => text);
}

function handSignature(hand: Tile[]): string {
  return hand.map((tile) => tile.id).sort().join(',');
}

function normalizeParticleWeights(particles: BeliefParticle[]): BeliefParticle[] {
  if (!particles.length) return [];
  const totalWeight = particles.reduce((sum, particle) => sum + particle.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return particles.map((particle) => ({ ...particle, weight: 1 }));
  }
  const scale = particles.length / totalWeight;
  return particles.map((particle) => ({ ...particle, weight: particle.weight * scale }));
}

function particleEffectiveSamples(particles: BeliefParticle[]): number {
  const totalWeight = particles.reduce((sum, particle) => sum + particle.weight, 0);
  const squaredWeight = particles.reduce((sum, particle) => sum + particle.weight * particle.weight, 0);
  return squaredWeight ? totalWeight * totalWeight / squaredWeight : 0;
}

function particleDealSignature(particle: BeliefParticle, perspective: number): string {
  return particle.hands
    .map((hand, player) => player === perspective ? '' : handSignature(hand))
    .join('/');
}

function beliefDiagnostics(
  particles: BeliefParticle[],
  perspective: number,
  targetCount: number,
  eliminatedLastUpdate: number,
  reweightedLastUpdate: number,
  resampledLastUpdate: boolean,
): BeliefDiagnostics {
  const effectiveSamples = particleEffectiveSamples(particles);
  const uniqueDeals = new Set(particles.map((particle) => particleDealSignature(particle, perspective))).size;
  const coverage = particles.length / Math.max(1, targetCount);
  const efficiency = effectiveSamples / Math.max(1, particles.length);
  const diversity = uniqueDeals / Math.max(1, particles.length);
  const confidence: BeliefConfidence = coverage >= 0.8 && efficiency >= 0.55 && diversity >= 0.35
    ? 'high'
    : coverage >= 0.45 && efficiency >= 0.3 && diversity >= 0.18
      ? 'moderate'
      : 'low';
  return {
    particleCount: particles.length,
    effectiveSamples,
    uniqueDeals,
    confidence,
    eliminatedLastUpdate,
    reweightedLastUpdate,
    resampledLastUpdate,
  };
}

function systematicResample(particles: BeliefParticle[], count: number, random: () => number): BeliefParticle[] {
  if (!particles.length || count <= 0) return [];
  const normalized = normalizeParticleWeights(particles);
  const cumulative: number[] = [];
  let total = 0;
  normalized.forEach((particle) => {
    total += particle.weight;
    cumulative.push(total);
  });
  const step = total / count;
  let target = random() * step;
  let particleIndex = 0;
  const sampled: BeliefParticle[] = [];
  for (let index = 0; index < count; index += 1) {
    while (particleIndex < cumulative.length - 1 && target > cumulative[particleIndex]) particleIndex += 1;
    sampled.push({ hands: normalized[particleIndex].hands.map((hand) => [...hand]), weight: 1 });
    target += step;
  }
  return sampled;
}

function representativeParticles(particles: BeliefParticle[], count: number): BeliefParticle[] {
  if (particles.length <= count) return particles;
  const normalized = normalizeParticleWeights(particles);
  const cumulative: number[] = [];
  let total = 0;
  normalized.forEach((particle) => {
    total += particle.weight;
    cumulative.push(total);
  });
  const step = total / count;
  let target = step / 2;
  let particleIndex = 0;
  const representatives: BeliefParticle[] = [];
  for (let index = 0; index < count; index += 1) {
    while (particleIndex < cumulative.length - 1 && target > cumulative[particleIndex]) particleIndex += 1;
    representatives.push({ hands: normalized[particleIndex].hands, weight: 1 });
    target += step;
  }
  return representatives;
}

function beliefSeed(game: Game, perspective: number, label: string): string {
  return `${label}|${perspective}|${game.round}|${game.events.length}|${handSignature(game.hands[perspective])}|${game.chain.map((tile) => tile.id).join(',')}`;
}

export function createBeliefState(
  game: Game,
  perspective = 0,
  targetCount = 900,
  styles?: OpponentStyleProfile[],
  seedSalt = '',
): BeliefState {
  const particles = normalizeParticleWeights(buildParticles(
    game,
    perspective,
    targetCount,
    beliefSeed(game, perspective, seedSalt ? `persistent-beliefs|${seedSalt}` : 'persistent-beliefs'),
    styles,
  ));
  const hardEvidenceUpdates = game.events.filter((event) => event.player !== perspective).length;
  const choiceUpdates = game.events.filter((event) => event.kind === 'play' && event.player !== perspective && event.endsBefore[0] !== null).length;
  return {
    perspective,
    round: game.round,
    eventCount: game.events.length,
    targetCount,
    ownHandSignature: handSignature(game.hands[perspective]),
    particles,
    hardEvidenceUpdates,
    choiceUpdates,
    resampleCount: 0,
    diagnostics: beliefDiagnostics(particles, perspective, targetCount, 0, 0, false),
  };
}

export function updateBeliefState(
  previous: BeliefState | null,
  game: Game,
  perspective = 0,
  targetCount = 900,
  styles?: OpponentStyleProfile[],
): BeliefState {
  const currentOwnHand = handSignature(game.hands[perspective]);
  if (!previous
    || previous.perspective !== perspective
    || previous.round !== game.round
    || previous.targetCount !== targetCount
    || previous.eventCount > game.events.length
    || (previous.eventCount === game.events.length && previous.ownHandSignature !== currentOwnHand)) {
    return createBeliefState(game, perspective, targetCount, styles);
  }
  if (previous.eventCount === game.events.length) return previous;

  let particles = previous.particles;
  let eliminatedLastUpdate = 0;
  let reweightedLastUpdate = 0;
  let hardEvidenceUpdates = previous.hardEvidenceUpdates;
  let choiceUpdates = previous.choiceUpdates;

  for (let eventIndex = previous.eventCount; eventIndex < game.events.length; eventIndex += 1) {
    const event = game.events[eventIndex];
    const nextParticles: BeliefParticle[] = [];
    if (event.player !== perspective) hardEvidenceUpdates += 1;
    if (event.kind === 'play' && event.player !== perspective && event.endsBefore[0] !== null) {
      choiceUpdates += 1;
      reweightedLastUpdate += 1;
    }

    for (const particle of particles) {
      const hand = particle.hands[event.player];
      if (event.kind === 'pass') {
        const ends = openValues(event.endsBefore[0], event.endsBefore[1]);
        if (hand.some((tile) => ends.some((value) => matchesValue(tile, value)))) {
          eliminatedLastUpdate += 1;
          continue;
        }
        nextParticles.push(particle);
        continue;
      }

      if (!hand.some((tile) => tile.id === event.tile.id)) {
        eliminatedLastUpdate += 1;
        continue;
      }
      const choiceProbability = event.player === perspective
        ? 1
        : observedChoiceProbability(game, eventIndex, particle.hands, styles);
      if (choiceProbability <= 0) {
        eliminatedLastUpdate += 1;
        continue;
      }
      const hands = particle.hands.map((candidate, player) => player === event.player
        ? candidate.filter((tile) => tile.id !== event.tile.id)
        : candidate);
      nextParticles.push({ hands, weight: particle.weight * choiceProbability ** 0.38 });
    }
    particles = normalizeParticleWeights(nextParticles);
    if (!particles.length) break;
  }

  if (!particles.length) {
    const rebuilt = createBeliefState(game, perspective, targetCount, styles);
    return {
      ...rebuilt,
      resampleCount: previous.resampleCount + 1,
      diagnostics: beliefDiagnostics(rebuilt.particles, perspective, targetCount, eliminatedLastUpdate, reweightedLastUpdate, true),
    };
  }

  particles = particles.map((particle) => ({
    ...particle,
    hands: particle.hands.map((hand, player) => player === perspective ? [...game.hands[perspective]] : hand),
  }));
  const effectiveSamples = particleEffectiveSamples(particles);
  const needsResampling = particles.length < targetCount * 0.55 || effectiveSamples < targetCount * 0.4;
  let resampleCount = previous.resampleCount;
  if (needsResampling) {
    const random = seededRandom(beliefSeed(game, perspective, `belief-resample-${previous.resampleCount + 1}`));
    const freshGoal = Math.max(1, Math.round(targetCount * 0.35));
    const fresh = normalizeParticleWeights(buildParticles(
      game,
      perspective,
      freshGoal,
      beliefSeed(game, perspective, `belief-fresh-${previous.resampleCount + 1}`),
      styles,
    ));
    const retained = systematicResample(particles, Math.max(0, targetCount - fresh.length), random);
    particles = normalizeParticleWeights([...retained, ...fresh]);
    resampleCount += 1;
  }

  return {
    perspective,
    round: game.round,
    eventCount: game.events.length,
    targetCount,
    ownHandSignature: currentOwnHand,
    particles,
    hardEvidenceUpdates,
    choiceUpdates,
    resampleCount,
    diagnostics: beliefDiagnostics(
      particles,
      perspective,
      targetCount,
      eliminatedLastUpdate,
      reweightedLastUpdate,
      needsResampling,
    ),
  };
}

function currentBeliefParticles(game: Game, perspective: number, beliefState?: BeliefState): BeliefParticle[] | null {
  if (!beliefState
    || beliefState.perspective !== perspective
    || beliefState.round !== game.round
    || beliefState.eventCount !== game.events.length
    || beliefState.ownHandSignature !== handSignature(game.hands[perspective])) return null;
  return beliefState.particles;
}

export function estimateBeliefs(
  game: Game,
  perspective = 0,
  sampleCount = 480,
  beliefState?: BeliefState,
  styles?: OpponentStyleProfile[],
): PlayerBelief[] {
  const samples = currentBeliefParticles(game, perspective, beliefState)
    ?? buildParticles(
      game,
      perspective,
      sampleCount,
      `beliefs|${perspective}|${game.round}|${game.events.length}|${game.chain.map((tile) => tile.id).join(',')}`,
      styles,
    );
  return [0, 1, 2].filter((player) => player !== perspective).map((player) => {
    const certainOut = [...game.voids[player]].sort((a, b) => a - b);
    const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
    const prior = Array.from({ length: 10 }, (_, value) => samples.length
      ? samples.filter((sample) => sample.hands[player].some((tile) => tile.a === value || tile.b === value)).length / samples.length
      : 0);
    const posterior = Array.from({ length: 10 }, (_, value) => totalWeight
      ? samples.reduce((sum, sample) => sum + (sample.hands[player].some((tile) => tile.a === value || tile.b === value) ? sample.weight : 0), 0) / totalWeight
      : 0);

    const avoided = new Map<number, number>();
    game.events.forEach((event) => {
      if (event.kind !== 'play' || event.player !== player) return;
      const [left, right] = event.endsBefore;
      if (left === null || right === null || left === right) return;
      const unchosenEnd = event.side === 'left' ? right : left;
      if (event.tile.a === unchosenEnd || event.tile.b === unchosenEnd) return;
      avoided.set(unchosenEnd, (avoided.get(unchosenEnd) ?? 0) + 1);
    });

    const softReads: SoftRead[] = [...avoided.entries()]
      .filter(([value]) => !game.voids[player].has(value))
      .map(([value, count]) => ({
        value,
        direction: 'less' as const,
        probability: posterior[value],
        strength: count >= 2 || posterior[value] < prior[value] - 0.1 ? 'moderate' as const : 'weak' as const,
      }))
      .sort((a, b) => (b.strength === 'moderate' ? 1 : 0) - (a.strength === 'moderate' ? 1 : 0))
      .slice(0, 2);

    const strongerSignal = posterior
      .map((probability, value) => ({ value, probability, change: probability - prior[value] }))
      .filter(({ value, change }) => !game.voids[player].has(value) && !avoided.has(value) && change >= 0.12)
      .sort((a, b) => b.change - a.change)[0];
    if (strongerSignal && softReads.length < 2) {
      softReads.push({ value: strongerSignal.value, direction: 'more', probability: strongerSignal.probability, strength: 'moderate' });
    }
    return { player, certainOut, softReads };
  });
}

function blockedWinner(hands: Tile[][]): number | null {
  const pips = hands.map(pipTotal);
  const lowest = Math.min(...pips);
  const winners = pips.map((value, index) => value === lowest ? index : -1).filter((index) => index >= 0);
  return winners.length === 1 ? winners[0] : null;
}

function terminalUtility(winner: number | null): number[] {
  return [0, 1, 2].map((player) => winner === player ? 1 : 0);
}

function solveEndgame(hands: Tile[][], left: number, right: number, current: number, passes: number, memo: Map<string, SolvedOutcome>): SolvedOutcome {
  const key = `${left}|${right}|${current}|${passes}|${hands.map((hand) => hand.map((tile) => tile.id).sort().join('.')).join('/')}`;
  const cached = memo.get(key);
  if (cached) return cached;
  const legal = legalMovesForEnds(hands[current], left, right);
  if (!legal.length) {
    if (passes + 1 === 3) {
      const winner = blockedWinner(hands);
      const result = { winner, reason: 'blocked' as const, utility: terminalUtility(winner) };
      memo.set(key, result);
      return result;
    }
    const result = solveEndgame(hands, left, right, (current + 1) % 3, passes + 1, memo);
    memo.set(key, result);
    return result;
  }

  let best: SolvedOutcome | null = null;
  let bestTieBreak = -Infinity;
  for (const move of legal) {
    const nextHands = hands.map((hand, player) => player === current ? hand.filter((tile) => tile.id !== move.tile.id) : hand);
    const result = nextHands[current].length === 0
      ? { winner: current, reason: 'empty' as const, utility: terminalUtility(current) }
      : solveEndgame(nextHands, move.newLeft, move.newRight, (current + 1) % 3, 0, memo);
    const remainingPips = pipTotal(nextHands[current]);
    const retainedConnections = uniqueEnds(move).reduce(
      (sum, value) => sum + nextHands[current].filter((tile) => matchesValue(tile, value)).length,
      0,
    );
    const tieBreak = (move.tile.a + move.tile.b) * 0.3 + retainedConnections - remainingPips * 0.01;
    if (!best || result.utility[current] > best.utility[current] || (result.utility[current] === best.utility[current] && tieBreak > bestTieBreak)) {
      best = result;
      bestTieBreak = tieBreak;
    }
  }
  memo.set(key, best!);
  return best!;
}

type PublicSearchState = {
  root: number;
  current: number;
  left: number;
  right: number;
  passes: number;
  chainLength: number;
  rootHand: Tile[];
  handSizes: number[];
  voids: Set<number>[];
  unseenTiles: Tile[];
  playedTiles: Tile[];
};

type SearchAggregate = { value: number; returnRate: number; exploredBranches: number };
type PublicReply = { probability: number; move: Move | null };

function expectedHiddenPips(unseenTiles: Tile[], handSize: number, knownVoids: Set<number>): number {
  if (!handSize) return 0;
  const eligible = unseenTiles.filter((tile) => !knownVoids.has(tile.a) && !knownVoids.has(tile.b));
  if (!eligible.length) return handSize * 9;
  return handSize * eligible.reduce((sum, tile) => sum + tile.a + tile.b, 0) / eligible.length;
}

function expectedBlockValue(state: PublicSearchState): number {
  const ownPips = pipTotal(state.rootHand);
  const opponentPips = [0, 1, 2]
    .filter((player) => player !== state.root)
    .map((player) => expectedHiddenPips(state.unseenTiles, state.handSizes[player], state.voids[player]));
  const pipEdge = Math.min(...opponentPips) - ownPips;
  return Math.max(-24, Math.min(24, pipEdge * 0.65)) + (pipEdge > 2 ? 9 : pipEdge < -2 ? -9 : 0);
}

function rootSearchContext(state: PublicSearchState): StrategyContext {
  const expectedPips = state.handSizes.map((size, player) => player === state.root
    ? pipTotal(state.rootHand)
    : expectedHiddenPips(state.unseenTiles, size, state.voids[player]));
  return {
    phase: inferStrategicPhase(
      state.rootHand,
      state.handSizes,
      state.chainLength,
      state.passes,
      state.left,
      state.right,
      state.voids,
      state.root,
    ),
    chainLength: state.chainLength,
    consecutivePasses: state.passes,
    unseenTiles: state.unseenTiles,
    expectedPips,
  };
}

function evaluateRootReturn(state: PublicSearchState): SearchAggregate {
  const returnMoves = legalMovesForEnds(state.rootHand, state.left, state.right);
  if (!returnMoves.length && state.passes >= 2) {
    return { value: expectedBlockValue(state), returnRate: 0, exploredBranches: 1 };
  }
  const ownPips = pipTotal(state.rootHand);
  const expectedOpponentLow = Math.min(...[0, 1, 2]
    .filter((player) => player !== state.root)
    .map((player) => expectedHiddenPips(state.unseenTiles, state.handSizes[player], state.voids[player])));
  const pipPosition = Math.max(-12, Math.min(12, (expectedOpponentLow - ownPips) * 0.12));
  if (!returnMoves.length) return { value: -10 + pipPosition, returnRate: 0, exploredBranches: 1 };

  const context = rootSearchContext(state);
  const bestReturn = Math.max(...returnMoves.map((move) => moveHeuristic(
    move,
    state.rootHand,
    state.voids,
    state.root,
    state.handSizes,
    context,
  )));
  const exitBonus = state.rootHand.length <= 2 ? 5 : state.rootHand.length <= 4 ? 2 : 0;
  return {
    value: 8 + Math.min(30, bestReturn) * 0.28 + pipPosition + exitBonus,
    returnRate: 1,
    exploredBranches: 1,
  };
}

function publicReplyScore(state: PublicSearchState, move: Move): number {
  const actor = state.current;
  const next = (actor + 1) % 3;
  const remainingUnseen = state.unseenTiles.filter((tile) => tile.id !== move.tile.id);
  const actorEligible = remainingUnseen.filter((tile) => !state.voids[actor].has(tile.a) && !state.voids[actor].has(tile.b));
  const ends = uniqueEnds(move);
  const expectedControl = actorEligible.length > 0
    ? ends.reduce((sum, value) => sum + actorEligible.filter((tile) => matchesValue(tile, value)).length, 0)
      * Math.max(0, state.handSizes[actor] - 1) / actorEligible.length
    : 0;
  const nextPassChance = 1 - answerProbability(remainingUnseen, state.handSizes[next], state.voids[next], ends);
  const certainNextPass = ends.every((value) => state.voids[next].has(value));
  return (move.tile.a + move.tile.b) * 0.18
    + (move.tile.a === move.tile.b ? 0.9 : 0)
    + expectedControl * 0.85
    + nextPassChance * (state.handSizes[next] <= 2 ? 5 : 2.2)
    + (certainNextPass ? 3.5 : 0);
}

function likelyPublicReplies(state: PublicSearchState): PublicReply[] {
  const actor = state.current;
  const ends = openValues(state.left, state.right);
  const answerChance = answerProbability(state.unseenTiles, state.handSizes[actor], state.voids[actor], ends);
  const eligible = state.unseenTiles.filter((tile) => !state.voids[actor].has(tile.a) && !state.voids[actor].has(tile.b));
  const legal = legalMovesForEnds(eligible, state.left, state.right);
  if (!legal.length || answerChance <= 0.001) return [{ probability: 1, move: null }];

  const scored = legal
    .map((move) => ({ move, score: publicReplyScore(state, move) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);
  const maximum = scored[0].score;
  const weights = scored.map(({ score }) => Math.exp((score - maximum) / 1.8));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const replies: PublicReply[] = scored.map(({ move }, index) => ({ probability: answerChance * weights[index] / weightTotal, move }));
  const passChance = 1 - answerChance;
  if (passChance > 0) replies.push({ probability: passChance, move: null });
  return replies;
}

function applyPublicReply(state: PublicSearchState, reply: PublicReply): PublicSearchState {
  const actor = state.current;
  if (!reply.move) {
    const voids = state.voids.map((values) => new Set(values));
    voids[actor].add(state.left);
    voids[actor].add(state.right);
    return { ...state, current: (actor + 1) % 3, passes: state.passes + 1, voids };
  }
  const handSizes = [...state.handSizes];
  handSizes[actor] -= 1;
  return {
    ...state,
    current: (actor + 1) % 3,
    left: reply.move.newLeft,
    right: reply.move.newRight,
    passes: 0,
    chainLength: state.chainLength + 1,
    handSizes,
    unseenTiles: state.unseenTiles.filter((tile) => tile.id !== reply.move!.tile.id),
    playedTiles: [...state.playedTiles, reply.move.tile],
  };
}

function searchLikelyReplies(state: PublicSearchState, remainingReplies: number): SearchAggregate {
  if (remainingReplies <= 0 || state.current === state.root) return evaluateRootReturn(state);
  const branches = likelyPublicReplies(state);
  let value = 0;
  let returnRate = 0;
  let exploredBranches = 0;
  for (const branch of branches) {
    const next = applyPublicReply(state, branch);
    let result: SearchAggregate;
    if (branch.move && next.handSizes[state.current] === 0) {
      result = { value: -100, returnRate: 0, exploredBranches: 1 };
    } else if (!branch.move && next.passes >= 3) {
      result = { value: expectedBlockValue(next), returnRate: 0, exploredBranches: 1 };
    } else {
      result = searchLikelyReplies(next, remainingReplies - 1);
    }
    value += branch.probability * result.value;
    returnRate += branch.probability * result.returnRate;
    exploredBranches += result.exploredBranches;
  }
  return { value, returnRate, exploredBranches };
}

function forecastMoveFromPublicInformation({
  move,
  hand,
  handSizes,
  voids,
  player,
  context,
  playedTiles,
}: {
  move: Move;
  hand: Tile[];
  handSizes: number[];
  voids: Set<number>[];
  player: number;
  context: StrategyContext;
  playedTiles: Tile[];
}): LookaheadForecast {
  const remaining = hand.filter((tile) => tile.id !== move.tile.id);
  if (!remaining.length) return { score: 1000, returnRate: 1, exploredBranches: 1, plies: 3 };
  const nextHandSizes = [...handSizes];
  nextHandSizes[player] -= 1;
  const state: PublicSearchState = {
    root: player,
    current: (player + 1) % 3,
    left: move.newLeft,
    right: move.newRight,
    passes: 0,
    chainLength: context.chainLength + 1,
    rootHand: remaining,
    handSizes: nextHandSizes,
    voids: voids.map((values) => new Set(values)),
    unseenTiles: context.unseenTiles,
    playedTiles: [...playedTiles, move.tile],
  };
  const replies = searchLikelyReplies(state, 2);
  const immediate = moveHeuristic(move, hand, voids, player, handSizes, context);
  return {
    score: replies.value + immediate * 0.38,
    returnRate: replies.returnRate,
    exploredBranches: replies.exploredBranches,
    plies: 3,
  };
}

export function informationSafeMoveForecast(game: Game, move: Move, player = game.current): LookaheadForecast {
  return forecastMoveFromPublicInformation({
    move,
    hand: game.hands[player],
    handSizes: game.hands.map((hand) => hand.length),
    voids: game.voids,
    player,
    context: strategyContextForGame(game, player),
    playedTiles: game.chain,
  });
}

export function chooseInformationSafeMove(game: Game, moves: Move[]): Move {
  return moves
    .map((move) => ({ move, forecast: informationSafeMoveForecast(game, move, game.current) }))
    .sort((left, right) => right.forecast.score - left.forecast.score)[0].move;
}

function selectRolloutMove({
  hand,
  handSizes,
  legal,
  voids,
  current,
  context,
  playedTiles,
  style,
}: {
  hand: Tile[];
  handSizes: number[];
  legal: Move[];
  voids: Set<number>[];
  current: number;
  context: StrategyContext;
  playedTiles: Tile[];
  style?: OpponentStyleProfile;
}): Move {
  if (legal.length === 1) return legal[0];
  const adjustedScores = styleAdjustedScores(legal, hand, voids, current, handSizes, context, style);
  const candidates = legal.length <= 3
    ? legal
    : legal
      .map((move, index) => ({ move, score: adjustedScores[index] }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ move }) => move);
  return candidates
    .map((move) => {
      const legalIndex = legal.findIndex((candidate) => moveKey(candidate) === moveKey(move));
      return {
        move,
        forecast: forecastMoveFromPublicInformation({
          move,
          hand,
          handSizes,
          voids,
          player: current,
          context,
          playedTiles,
        }),
        styleScore: adjustedScores[legalIndex],
      };
    })
    .sort((left, right) => (
      right.forecast.score + (style ? right.styleScore * 0.28 : 0)
      - left.forecast.score - (style ? left.styleScore * 0.28 : 0)
    ))[0].move;
}

function rolloutWinner(
  game: Game,
  firstMove: Move,
  sampledHands: Tile[][],
  perspective: number,
  styles?: OpponentStyleProfile[],
): RolloutOutcome {
  const hands = sampledHands.map((hand) => [...hand]);
  hands[perspective] = hands[perspective].filter((tile) => tile.id !== firstMove.tile.id);
  if (!hands[perspective].length) return { winner: perspective, reason: 'empty', nextPlayerPassed: false, pips: hands.map(pipTotal) };
  let left = firstMove.newLeft;
  let right = firstMove.newRight;
  let current = (perspective + 1) % 3;
  let passes = 0;
  let firstTurn = true;
  let nextPlayerPassed = legalMovesForEnds(hands[current], left, right).length === 0;
  const voids = game.voids.map((values) => new Set(values));
  const playedTiles: Tile[] = [...game.chain, firstMove.tile];
  let chainLength = game.chain.length + 1;

  for (let turn = 0; turn < 80; turn += 1) {
    const legal = legalMovesForEnds(hands[current], left, right);
    if (!legal.length) {
      if (firstTurn) nextPlayerPassed = true;
      voids[current].add(left);
      voids[current].add(right);
      passes += 1;
      if (passes === 3) return { winner: blockedWinner(hands), reason: 'blocked', nextPlayerPassed, pips: hands.map(pipTotal) };
    } else {
      const context = strategyContextForState({
        hand: hands[current],
        handSizes: hands.map((hand) => hand.length),
        chainLength,
        consecutivePasses: passes,
        left,
        right,
        voids,
        player: current,
        playedTiles,
      });
      const move = selectRolloutMove({
        hand: hands[current],
        handSizes: hands.map((hand) => hand.length),
        legal,
        voids,
        current,
        context,
        playedTiles,
        style: styleForPlayer(styles, current),
      });
      passes = 0;
      hands[current] = hands[current].filter((tile) => tile.id !== move.tile.id);
      playedTiles.push(move.tile);
      chainLength += 1;
      left = move.newLeft;
      right = move.newRight;
      if (!hands[current].length) return { winner: current, reason: 'empty', nextPlayerPassed, pips: hands.map(pipTotal) };
    }
    firstTurn = false;
    current = (current + 1) % 3;
  }
  return { winner: null, reason: 'cutoff', nextPlayerPassed, pips: hands.map(pipTotal) };
}

type SearchSimulationState = {
  hands: Tile[][];
  left: number | null;
  right: number | null;
  current: number;
  passes: number;
  chainLength: number;
  voids: Set<number>[];
  playedTiles: Tile[];
};

type PublicSimulationView = {
  left: number | null;
  right: number | null;
  current: number;
  passes: number;
  chainLength: number;
  handSizes: number[];
  voids: Set<number>[];
  playedTiles: Tile[];
  observerHand: Tile[];
};

type TreeActionStats = {
  visits: number;
  availability: number;
  utility: number[];
  prior: number;
};

type InformationSetNode = {
  visits: number;
  actions: Map<string, TreeActionStats>;
};

type RootOutcomeStats = {
  visits: number;
  wins: number;
  utility: number;
  nextPasses: number;
  blockedWins: number;
  emptyWins: number;
  losingPips: number;
  losses: number;
  pairedTreeWins: number[];
};

type BaselineOutcomeStats = {
  samples: number;
  totalWeight: number;
  squaredWeight: number;
  weightedWins: number;
  weightedNextPasses: number;
  weightedBlockedWins: number;
  weightedEmptyWins: number;
  weightedLosingPips: number;
  losingWeight: number;
  pairedWins: number[];
  pairedWeights: number[];
};

type InformationSetSearchResult = {
  outcomes: Map<string, RootOutcomeStats>;
  baselineOutcomes: Map<string, BaselineOutcomeStats>;
  informationSets: number;
  multiVisitInformationSets: number;
  deepestPly: number;
  averageTreePlies: number;
  revisitedActionRate: number;
  uniqueDeals: number;
  baseIterations: number;
  extraIterations: number;
  closeDecision: boolean;
};

function moveKey(move: Move): string {
  return `${move.tile.id}:${move.side}`;
}

function newRootOutcomeStats(): RootOutcomeStats {
  return {
    visits: 0,
    wins: 0,
    utility: 0,
    nextPasses: 0,
    blockedWins: 0,
    emptyWins: 0,
    losingPips: 0,
    losses: 0,
    pairedTreeWins: [],
  };
}

function newBaselineOutcomeStats(): BaselineOutcomeStats {
  return {
    samples: 0,
    totalWeight: 0,
    squaredWeight: 0,
    weightedWins: 0,
    weightedNextPasses: 0,
    weightedBlockedWins: 0,
    weightedEmptyWins: 0,
    weightedLosingPips: 0,
    losingWeight: 0,
    pairedWins: [],
    pairedWeights: [],
  };
}

function simulationState(game: Game, hands: Tile[][]): SearchSimulationState {
  const [left, right] = endsOf(game.chain);
  return {
    hands: hands.map((hand) => [...hand]),
    left,
    right,
    current: game.current,
    passes: game.consecutivePasses,
    chainLength: game.chain.length,
    voids: game.voids.map((values) => new Set(values)),
    playedTiles: [...game.chain],
  };
}

function publicSimulationView(state: SearchSimulationState, observer: number): PublicSimulationView {
  return {
    left: state.left,
    right: state.right,
    current: state.current,
    passes: state.passes,
    chainLength: state.chainLength,
    handSizes: state.hands.map((hand) => hand.length),
    voids: state.voids,
    playedTiles: state.playedTiles,
    observerHand: state.hands[observer],
  };
}

function informationSetKey(view: PublicSimulationView): string {
  const voidSignature = view.voids
    .map((values) => [...values].sort((left, right) => left - right).join('.'))
    .join('/');
  const playedSignature = view.playedTiles.map((tile) => tile.id).sort().join('.');
  return [
    view.current,
    view.left ?? 'open',
    view.right ?? 'open',
    view.passes,
    view.handSizes.join('.'),
    voidSignature,
    playedSignature,
    handSignature(view.observerHand),
  ].join('|');
}

function strategyContextForSimulation(view: PublicSimulationView, actorHand: Tile[]): StrategyContext {
  return strategyContextForState({
    hand: actorHand,
    handSizes: view.handSizes,
    chainLength: view.chainLength,
    consecutivePasses: view.passes,
    left: view.left,
    right: view.right,
    voids: view.voids,
    player: view.current,
    playedTiles: view.playedTiles,
  });
}

function informationSafePrior(view: PublicSimulationView, actorHand: Tile[], move: Move): number {
  const context = strategyContextForSimulation(view, actorHand);
  const score = moveHeuristic(move, actorHand, view.voids, view.current, view.handSizes, context);
  return 0.5 + Math.tanh(score / 12) * 0.5;
}

function chooseTreeMove({
  node,
  legal,
  view,
  actorHand,
  allowedActions,
}: {
  node: InformationSetNode;
  legal: Move[];
  view: PublicSimulationView;
  actorHand: Tile[];
  allowedActions?: Set<string>;
}): { move: Move; stats: TreeActionStats; expanded: boolean } {
  const candidates = allowedActions
    ? legal.filter((move) => allowedActions.has(moveKey(move)))
    : legal;
  const available = candidates.length ? candidates : legal;
  const entries = available.map((move) => {
    const key = moveKey(move);
    let stats = node.actions.get(key);
    if (!stats) {
      stats = { visits: 0, availability: 0, utility: [0, 0, 0], prior: informationSafePrior(view, actorHand, move) };
      node.actions.set(key, stats);
    }
    stats.availability += 1;
    return { move, stats };
  });
  const unexplored = entries.filter(({ stats }) => stats.visits === 0);
  if (unexplored.length) {
    const selected = unexplored.sort((left, right) => right.stats.prior - left.stats.prior || moveKey(left.move).localeCompare(moveKey(right.move)))[0];
    return { ...selected, expanded: true };
  }

  const actor = view.current;
  const selected = entries
    .map((entry) => {
      const mean = entry.stats.utility[actor] / entry.stats.visits;
      const exploration = 0.78 * Math.sqrt(Math.log(entry.stats.availability + 1) / entry.stats.visits);
      const progressiveBias = 0.22 * entry.stats.prior / (entry.stats.visits + 1);
      return { ...entry, value: mean + exploration + progressiveBias };
    })
    .sort((left, right) => right.value - left.value || moveKey(left.move).localeCompare(moveKey(right.move)))[0];
  return { move: selected.move, stats: selected.stats, expanded: false };
}

function applySimulationMove(state: SearchSimulationState, move: Move): RolloutOutcome | null {
  const actor = state.current;
  state.hands[actor] = state.hands[actor].filter((tile) => tile.id !== move.tile.id);
  state.left = move.newLeft;
  state.right = move.newRight;
  state.passes = 0;
  state.chainLength += 1;
  state.playedTiles.push(move.tile);
  if (!state.hands[actor].length) {
    return { winner: actor, reason: 'empty', nextPlayerPassed: false, pips: state.hands.map(pipTotal) };
  }
  state.current = (actor + 1) % 3;
  return null;
}

function applySimulationPass(state: SearchSimulationState): RolloutOutcome | null {
  const actor = state.current;
  if (state.left !== null) state.voids[actor].add(state.left);
  if (state.right !== null) state.voids[actor].add(state.right);
  state.passes += 1;
  if (state.passes >= 3) {
    return { winner: blockedWinner(state.hands), reason: 'blocked', nextPlayerPassed: false, pips: state.hands.map(pipTotal) };
  }
  state.current = (actor + 1) % 3;
  return null;
}

function choosePlayoutMove(
  view: PublicSimulationView,
  actorHand: Tile[],
  legal: Move[],
  cache: Map<string, string>,
  styles?: OpponentStyleProfile[],
): Move {
  const style = styleForPlayer(styles, view.current);
  const styleKey = style ? `${style.player}:${style.observedChoices}:${style.highPipTendency.toFixed(2)}:${style.doubleTendency.toFixed(2)}:${style.controlTendency.toFixed(2)}:${style.blockTendency.toFixed(2)}` : 'default';
  const key = `${informationSetKey(view)}|${styleKey}`;
  const cachedMove = cache.get(key);
  if (cachedMove) {
    const match = legal.find((move) => moveKey(move) === cachedMove);
    if (match) return match;
  }
  const context = strategyContextForSimulation(view, actorHand);
  const selected = selectRolloutMove({
    hand: actorHand,
    handSizes: view.handSizes,
    legal,
    voids: view.voids,
    current: view.current,
    context,
    playedTiles: view.playedTiles,
    style,
  });
  cache.set(key, moveKey(selected));
  return selected;
}

function finishPlayout(
  state: SearchSimulationState,
  cache: Map<string, string>,
  styles?: OpponentStyleProfile[],
): RolloutOutcome {
  for (let turn = 0; turn < 80; turn += 1) {
    const actorHand = state.hands[state.current];
    const legal = legalMovesForEnds(actorHand, state.left, state.right);
    const outcome = legal.length
      ? applySimulationMove(state, choosePlayoutMove(publicSimulationView(state, state.current), actorHand, legal, cache, styles))
      : applySimulationPass(state);
    if (outcome) return outcome;
  }
  return { winner: null, reason: 'cutoff', nextPlayerPassed: false, pips: state.hands.map(pipTotal) };
}

function evaluateRootMove(
  game: Game,
  perspective: number,
  particle: BeliefParticle,
  move: Move,
  rolloutCache: Map<string, string>,
  styles?: OpponentStyleProfile[],
): RolloutOutcome {
  const state = simulationState(game, particle.hands);
  let outcome = applySimulationMove(state, move);
  const nextPlayerPassed = !outcome && legalMovesForEnds(
    state.hands[state.current],
    state.left,
    state.right,
  ).length === 0;
  if (!outcome) outcome = finishPlayout(state, rolloutCache, styles);
  return { ...outcome, nextPlayerPassed: Boolean(nextPlayerPassed) };
}

function outcomeUtility(outcome: RolloutOutcome): number[] {
  return [0, 1, 2].map((player) => outcome.winner === player ? 1 : 0);
}

function recordRootOutcome(
  stats: RootOutcomeStats,
  outcome: RolloutOutcome,
  perspective: number,
  treePairIndex?: number,
): void {
  const won = outcome.winner === perspective;
  stats.visits += 1;
  stats.utility += won ? 1 : 0;
  if (won) {
    stats.wins += 1;
    if (outcome.reason === 'blocked') stats.blockedWins += 1;
    if (outcome.reason === 'empty') stats.emptyWins += 1;
  } else {
    stats.losingPips += outcome.pips[perspective];
    stats.losses += 1;
  }
  if (outcome.nextPlayerPassed) stats.nextPasses += 1;
  if (treePairIndex !== undefined) stats.pairedTreeWins[treePairIndex] = won ? 1 : 0;
}

function recordBaselineOutcome(
  stats: BaselineOutcomeStats,
  outcome: RolloutOutcome,
  perspective: number,
  weight: number,
  pairIndex: number,
): void {
  const won = outcome.winner === perspective;
  stats.samples += 1;
  stats.totalWeight += weight;
  stats.squaredWeight += weight * weight;
  stats.pairedWins[pairIndex] = won ? 1 : 0;
  stats.pairedWeights[pairIndex] = weight;
  if (won) {
    stats.weightedWins += weight;
    if (outcome.reason === 'blocked') stats.weightedBlockedWins += weight;
    if (outcome.reason === 'empty') stats.weightedEmptyWins += weight;
  } else {
    stats.weightedLosingPips += outcome.pips[perspective] * weight;
    stats.losingWeight += weight;
  }
  if (outcome.nextPlayerPassed) stats.weightedNextPasses += weight;
}

function systematicParticleSequence(particles: BeliefParticle[], count: number): BeliefParticle[] {
  if (!particles.length || count <= 0) return [];
  const normalized = normalizeParticleWeights(particles);
  const cumulative: number[] = [];
  let total = 0;
  normalized.forEach((particle) => {
    total += particle.weight;
    cumulative.push(total);
  });
  const step = total / count;
  let target = step / 2;
  let particleIndex = 0;
  return Array.from({ length: count }, () => {
    while (particleIndex < cumulative.length - 1 && target > cumulative[particleIndex]) particleIndex += 1;
    const selected = normalized[particleIndex];
    target += step;
    return selected;
  });
}

function runInformationSetIteration({
  game,
  perspective,
  particle,
  tree,
  rootOutcomes,
  rolloutCache,
  forcedRootAction,
  treePairIndex,
  styles,
}: {
  game: Game;
  perspective: number;
  particle: BeliefParticle;
  tree: Map<string, InformationSetNode>;
  rootOutcomes: Map<string, RootOutcomeStats>;
  rolloutCache: Map<string, string>;
  forcedRootAction: string;
  treePairIndex?: number;
  styles?: OpponentStyleProfile[];
}): { deepestPly: number; treePlies: number; revisitedActions: number } {
  const state = simulationState(game, particle.hands);
  const path: Array<{ node: InformationSetNode; action: TreeActionStats }> = [];
  let rootAction: string | null = null;
  let nextPlayerPassed = false;
  let outcome: RolloutOutcome | null = null;
  let deepestPly = 0;
  let revisitedActions = 0;

  for (let ply = 0; ply < 12 && !outcome; ply += 1) {
    deepestPly = ply + 1;
    const actor = state.current;
    const actorHand = state.hands[actor];
    const legal = legalMovesForEnds(actorHand, state.left, state.right);
    if (!legal.length) {
      if (rootAction && actor === (perspective + 1) % 3 && path.length === 1) nextPlayerPassed = true;
      outcome = applySimulationPass(state);
      continue;
    }

    const view = publicSimulationView(state, actor);
    if (actor !== perspective) {
      outcome = applySimulationMove(state, choosePlayoutMove(view, actorHand, legal, rolloutCache, styles));
      continue;
    }
    const key = informationSetKey(view);
    let node = tree.get(key);
    if (!node) {
      node = { visits: 0, actions: new Map() };
      tree.set(key, node);
    }
    const atRoot = rootAction === null && actor === perspective;
    const selected = chooseTreeMove({
      node,
      legal,
      view,
      actorHand,
      allowedActions: atRoot ? new Set([forcedRootAction]) : undefined,
    });
    if (!selected.expanded) revisitedActions += 1;
    path.push({ node, action: selected.stats });
    if (atRoot) rootAction = moveKey(selected.move);
    outcome = applySimulationMove(state, selected.move);
    if (atRoot && !outcome) {
      nextPlayerPassed = legalMovesForEnds(state.hands[state.current], state.left, state.right).length === 0;
    }
    if (selected.expanded && !outcome) outcome = finishPlayout(state, rolloutCache, styles);
  }
  if (!outcome) outcome = finishPlayout(state, rolloutCache, styles);

  const utilities = outcomeUtility(outcome);
  path.forEach(({ node, action }) => {
    node.visits += 1;
    action.visits += 1;
    action.utility = action.utility.map((value, player) => value + utilities[player]);
  });

  if (rootAction) {
    const stats = rootOutcomes.get(rootAction)!;
    recordRootOutcome(stats, { ...outcome, nextPlayerPassed }, perspective, treePairIndex);
  }
  return { deepestPly, treePlies: path.length, revisitedActions };
}

function closeRootDecision(moves: Move[], outcomes: Map<string, RootOutcomeStats>): { close: boolean; leaders: Set<string> } {
  const ranked = moves
    .map((move) => {
      const stats = outcomes.get(moveKey(move))!;
      const rate = stats.visits ? stats.wins / stats.visits : 0;
      const standardError = Math.sqrt(Math.max(0.0025, rate * (1 - rate)) / Math.max(1, stats.visits));
      return { key: moveKey(move), rate, standardError };
    })
    .sort((left, right) => right.rate - left.rate || left.key.localeCompare(right.key));
  if (ranked.length < 2) return { close: false, leaders: new Set(ranked.map(({ key }) => key)) };
  const [best, second] = ranked;
  const uncertainty = 1.35 * Math.sqrt(best.standardError ** 2 + second.standardError ** 2);
  return {
    close: best.rate - second.rate <= Math.max(0.035, uncertainty),
    leaders: new Set([best.key, second.key]),
  };
}

function closeBaselineDecision(moves: Move[], outcomes: Map<string, BaselineOutcomeStats>): { close: boolean; leaders: Set<string> } {
  const ranked = moves
    .map((move) => {
      const stats = outcomes.get(moveKey(move))!;
      const rate = stats.totalWeight ? stats.weightedWins / stats.totalWeight : 0;
      const effectiveSamples = stats.squaredWeight
        ? stats.totalWeight * stats.totalWeight / stats.squaredWeight
        : 0;
      const standardError = Math.sqrt(Math.max(0.0025, rate * (1 - rate)) / Math.max(1, effectiveSamples));
      return { key: moveKey(move), rate, standardError };
    })
    .sort((left, right) => right.rate - left.rate || left.key.localeCompare(right.key));
  if (ranked.length < 2) return { close: false, leaders: new Set(ranked.map(({ key }) => key)) };
  const [best, second] = ranked;
  const uncertainty = 1.35 * Math.sqrt(best.standardError ** 2 + second.standardError ** 2);
  return {
    close: best.rate - second.rate <= Math.max(0.035, uncertainty),
    leaders: new Set([best.key, second.key]),
  };
}

function informationSetMonteCarloSearch(
  game: Game,
  perspective: number,
  moves: Move[],
  particles: BeliefParticle[],
  styles?: OpponentStyleProfile[],
): InformationSetSearchResult {
  const tree = new Map<string, InformationSetNode>();
  const rolloutCache = new Map<string, string>();
  const rootOutcomes = new Map(moves.map((move) => [moveKey(move), newRootOutcomeStats()]));
  const baselineOutcomes = new Map(moves.map((move) => [moveKey(move), newBaselineOutcomeStats()]));
  if (!particles.length) {
    return {
      outcomes: rootOutcomes,
      baselineOutcomes,
      informationSets: 0,
      multiVisitInformationSets: 0,
      deepestPly: 0,
      averageTreePlies: 0,
      revisitedActionRate: 0,
      uniqueDeals: 0,
      baseIterations: 0,
      extraIterations: 0,
      closeDecision: false,
    };
  }
  const orderedMoves = [...moves].sort((left, right) => moveKey(left).localeCompare(moveKey(right)));
  const baseIterations = particles.length * orderedMoves.length;
  const maximumExtraIterations = Math.ceil(baseIterations * 0.5);
  const maximumExtraPairs = Math.floor(maximumExtraIterations / Math.min(2, orderedMoves.length));
  const extraSequence = systematicParticleSequence(particles, maximumExtraPairs);
  let deepestPly = 0;
  let totalTreePlies = 0;
  let revisitedActions = 0;
  let completedIterations = 0;

  const recordIteration = (particle: BeliefParticle, forcedRootAction: string, treePairIndex?: number) => {
    const result = runInformationSetIteration({
      game, perspective, particle, tree, rootOutcomes, rolloutCache, forcedRootAction, treePairIndex, styles,
    });
    deepestPly = Math.max(deepestPly, result.deepestPly);
    totalTreePlies += result.treePlies;
    revisitedActions += result.revisitedActions;
    completedIterations += 1;
  };

  particles.forEach((particle, particleIndex) => {
    for (let offset = 0; offset < orderedMoves.length; offset += 1) {
      const move = orderedMoves[(particleIndex + offset) % orderedMoves.length];
      const outcome = evaluateRootMove(game, perspective, particle, move, rolloutCache, styles);
      recordBaselineOutcome(
        baselineOutcomes.get(moveKey(move))!,
        outcome,
        perspective,
        particle.weight,
        particleIndex,
      );
    }
  });

  for (const move of orderedMoves) {
    if (baselineOutcomes.get(moveKey(move))!.samples !== particles.length) {
      throw new Error(`Paired root evaluation failed for ${moveKey(move)}.`);
    }
  }

  const decision = closeBaselineDecision(moves, baselineOutcomes);
  let extraIterations = 0;
  const batchPairs = Math.max(4, moves.length);
  let extraPairIndex = 0;
  while (decision.close && extraPairIndex < extraSequence.length) {
    const leaders = [...decision.leaders].sort();
    const pairs = Math.min(batchPairs, extraSequence.length - extraPairIndex);
    for (let pairOffset = 0; pairOffset < pairs; pairOffset += 1) {
      const particle = extraSequence[extraPairIndex + pairOffset];
      for (const leader of leaders) recordIteration(particle, leader, extraPairIndex + pairOffset);
    }
    extraPairIndex += pairs;
    extraIterations += pairs * leaders.length;
    const leaderMoves = moves.filter((move) => decision.leaders.has(moveKey(move)));
    if (!closeRootDecision(leaderMoves, rootOutcomes).close) break;
  }

  const totalActionSelections = [...tree.values()].reduce(
    (sum, node) => sum + [...node.actions.values()].reduce((actionSum, action) => actionSum + action.visits, 0),
    0,
  );
  const usedParticles = [...particles, ...extraSequence.slice(0, extraPairIndex)];

  return {
    outcomes: rootOutcomes,
    baselineOutcomes,
    informationSets: tree.size,
    multiVisitInformationSets: [...tree.values()].filter((node) => node.visits > 1).length,
    deepestPly,
    averageTreePlies: completedIterations ? totalTreePlies / completedIterations : 0,
    revisitedActionRate: totalActionSelections ? revisitedActions / totalActionSelections : 0,
    uniqueDeals: new Set(usedParticles.map((particle) => particleDealSignature(particle, perspective))).size,
    baseIterations,
    extraIterations,
    closeDecision: extraIterations > 0,
  };
}

function analyzeMovesForPlayer(
  game: Game,
  perspective: number,
  sampleCount: number,
  beliefState?: BeliefState,
  styles?: OpponentStyleProfile[],
  options?: AnalysisOptions,
): RatedMove[] {
  const moves = legalMovesFor(game.hands[perspective], game.chain);
  if (!moves.length) return [];
  const stateKey = `${perspective}|${game.round}|${game.events.length}|${game.chain.map((tile) => `${tile.id}:${tile.left}-${tile.right}`).join(',')}|${game.hands[perspective].map((tile) => tile.id).join(',')}`;
  const persistentParticles = currentBeliefParticles(game, perspective, beliefState);
  let samples = persistentParticles
    ? representativeParticles(persistentParticles, options?.representativeLimit ?? interactiveSearchSamples)
    : buildParticles(game, perspective, sampleCount, `analysis|${stateKey}`, styles);
  const shardCount = Math.max(1, Math.floor(options?.shardCount ?? 1));
  const shardIndex = Math.max(0, Math.min(shardCount - 1, Math.floor(options?.shardIndex ?? 0)));
  if (shardCount > 1) samples = samples.filter((_, index) => index % shardCount === shardIndex);
  const handSizes = game.hands.map((hand) => hand.length);
  const context = strategyContextForGame(game, perspective);
  const lookaheadByMove = new Map(moves.map((move) => [
    `${move.tile.id}:${move.side}`,
    forecastMoveFromPublicInformation({
      move,
      hand: game.hands[perspective],
      handSizes,
      voids: game.voids,
      player: perspective,
      context,
      playedTiles: game.chain,
    }),
  ]));
  const search = informationSetMonteCarloSearch(game, perspective, moves, samples, styles);

  return moves.map((move) => {
    const treeOutcome = search.outcomes.get(moveKey(move))!;
    const baseline = search.baselineOutcomes.get(moveKey(move))!;
    const winRate = baseline.totalWeight ? baseline.weightedWins / baseline.totalWeight * 100 : 0;
    const effectiveSamples = baseline.squaredWeight
      ? baseline.totalWeight * baseline.totalWeight / baseline.squaredWeight
      : 0;
    const proportion = winRate / 100;
    const margin = effectiveSamples ? 1.96 * Math.sqrt(proportion * (1 - proportion) / effectiveSamples) * 100 : 100;
    const ends = uniqueEnds(move);
    const remaining = game.hands[perspective].filter((tile) => tile.id !== move.tile.id);
    const retainedEndMatches = ends.reduce((sum, value) => sum + remaining.filter((tile) => tile.a === value || tile.b === value).length, 0);
    return {
      ...move,
      samples: baseline.samples,
      effectiveSamples,
      winRate,
      margin,
      heuristic: moveHeuristic(move, game.hands[perspective], game.voids, perspective, handSizes, context),
      lookahead: lookaheadByMove.get(`${move.tile.id}:${move.side}`)!,
      treeSearch: {
        visits: treeOutcome.visits,
        averageUtility: treeOutcome.visits ? treeOutcome.utility / treeOutcome.visits : 0,
        informationSets: search.informationSets,
        multiVisitInformationSets: search.multiVisitInformationSets,
        deepestPly: search.deepestPly,
        averageTreePlies: search.averageTreePlies,
        revisitedActionRate: search.revisitedActionRate,
        uniqueDeals: search.uniqueDeals,
        baseIterations: search.baseIterations,
        extraIterations: search.extraIterations,
        closeDecision: search.closeDecision,
        pairedBaseWins: baseline.pairedWins,
        pairedBaseWeights: baseline.pairedWeights,
        pairedTreeWins: treeOutcome.pairedTreeWins,
      },
      evidence: {
        nextPassRate: baseline.totalWeight ? baseline.weightedNextPasses / baseline.totalWeight * 100 : 0,
        blockedWinRate: baseline.totalWeight ? baseline.weightedBlockedWins / baseline.totalWeight * 100 : 0,
        emptyWinRate: baseline.totalWeight ? baseline.weightedEmptyWins / baseline.totalWeight * 100 : 0,
        averagePipsWhenLosing: baseline.losingWeight ? baseline.weightedLosingPips / baseline.losingWeight : 0,
        retainedEndMatches,
      },
    };
  }).sort((a, b) => b.winRate - a.winRate || b.lookahead.score - a.lookahead.score || b.heuristic - a.heuristic);
}

export function analyzeMoves(
  game: Game,
  sampleCount = 900,
  beliefState?: BeliefState,
  styles?: OpponentStyleProfile[],
  options?: AnalysisOptions,
): RatedMove[] {
  return analyzeMovesForPlayer(game, 0, sampleCount, beliefState, styles, options);
}

export function mergeMoveAnalyses(shards: RatedMove[][]): RatedMove[] {
  const available = shards.filter((shard) => shard.length > 0);
  if (!available.length) return [];
  const keys = available[0].map(moveKey);
  return keys.map((key) => {
    const parts = available.map((shard) => shard.find((move) => moveKey(move) === key)).filter((move): move is RatedMove => Boolean(move));
    const first = parts[0];
    const pairedBaseWins = parts.flatMap((move) => move.treeSearch.pairedBaseWins);
    const pairedBaseWeights = parts.flatMap((move) => move.treeSearch.pairedBaseWeights);
    const totalWeight = pairedBaseWeights.reduce((sum, weight) => sum + weight, 0);
    const squaredWeight = pairedBaseWeights.reduce((sum, weight) => sum + weight * weight, 0);
    const weightedWins = pairedBaseWins.reduce((sum, won, index) => sum + won * pairedBaseWeights[index], 0);
    const winRate = totalWeight ? weightedWins / totalWeight * 100 : 0;
    const effectiveSamples = squaredWeight ? totalWeight * totalWeight / squaredWeight : 0;
    const proportion = winRate / 100;
    const margin = effectiveSamples ? 1.96 * Math.sqrt(proportion * (1 - proportion) / effectiveSamples) * 100 : 100;
    const weightedRate = (read: (move: RatedMove) => number) => totalWeight
      ? parts.reduce((sum, move) => {
        const weight = move.treeSearch.pairedBaseWeights.reduce((partSum, value) => partSum + value, 0);
        return sum + read(move) * weight;
      }, 0) / totalWeight
      : 0;
    const losingWeight = parts.reduce((sum, move) => {
      const weight = move.treeSearch.pairedBaseWeights.reduce((partSum, value) => partSum + value, 0);
      return sum + weight * (1 - move.winRate / 100);
    }, 0);
    const averagePipsWhenLosing = losingWeight
      ? parts.reduce((sum, move) => {
        const weight = move.treeSearch.pairedBaseWeights.reduce((partSum, value) => partSum + value, 0);
        return sum + move.evidence.averagePipsWhenLosing * weight * (1 - move.winRate / 100);
      }, 0) / losingWeight
      : 0;
    const totalTreeVisits = parts.reduce((sum, move) => sum + move.treeSearch.visits, 0);
    const totalExtraIterations = parts.reduce((sum, move) => sum + move.treeSearch.extraIterations, 0);
    return {
      ...first,
      samples: parts.reduce((sum, move) => sum + move.samples, 0),
      effectiveSamples,
      winRate,
      margin,
      treeSearch: {
        visits: totalTreeVisits,
        averageUtility: totalTreeVisits
          ? parts.reduce((sum, move) => sum + move.treeSearch.averageUtility * move.treeSearch.visits, 0) / totalTreeVisits
          : 0,
        informationSets: parts.reduce((sum, move) => sum + move.treeSearch.informationSets, 0),
        multiVisitInformationSets: parts.reduce((sum, move) => sum + move.treeSearch.multiVisitInformationSets, 0),
        deepestPly: Math.max(...parts.map((move) => move.treeSearch.deepestPly)),
        averageTreePlies: totalExtraIterations
          ? parts.reduce((sum, move) => sum + move.treeSearch.averageTreePlies * move.treeSearch.extraIterations, 0) / totalExtraIterations
          : 0,
        revisitedActionRate: totalExtraIterations
          ? parts.reduce((sum, move) => sum + move.treeSearch.revisitedActionRate * move.treeSearch.extraIterations, 0) / totalExtraIterations
          : 0,
        uniqueDeals: parts.reduce((sum, move) => sum + move.treeSearch.uniqueDeals, 0),
        baseIterations: parts.reduce((sum, move) => sum + move.treeSearch.baseIterations, 0),
        extraIterations: totalExtraIterations,
        closeDecision: parts.some((move) => move.treeSearch.closeDecision),
        pairedBaseWins,
        pairedBaseWeights,
        pairedTreeWins: parts.flatMap((move) => move.treeSearch.pairedTreeWins),
      },
      evidence: {
        nextPassRate: weightedRate((move) => move.evidence.nextPassRate),
        blockedWinRate: weightedRate((move) => move.evidence.blockedWinRate),
        emptyWinRate: weightedRate((move) => move.evidence.emptyWinRate),
        averagePipsWhenLosing,
        retainedEndMatches: first.evidence.retainedEndMatches,
      },
    };
  }).sort((left, right) => right.winRate - left.winRate || right.lookahead.score - left.lookahead.score || right.heuristic - left.heuristic);
}

export function chooseStrongMove(game: Game, moves: Move[], sampleCount = interactiveSearchSamples): Move {
  if (moves.length === 1) return moves[0];
  const casual = chooseCasualMove(game, moves);
  const ranked = analyzeMovesForPlayer(game, game.current, sampleCount);
  const best = ranked[0];
  const casualResult = ranked.find((candidate) => candidate.tile.id === casual.tile.id && candidate.side === casual.side)
    ?? ranked.find((candidate) => candidate.tile.id === casual.tile.id);
  if (!best || !casualResult) return best ?? casual;
  const combinedMargin = Math.sqrt(best.margin ** 2 + casualResult.margin ** 2);
  const requiredAdvantage = Math.max(4, combinedMargin * 0.45);
  return best.winRate - casualResult.winRate > requiredAdvantage ? best : casualResult;
}

export function chooseBotMove(game: Game, moves: Move[], difficulty: Difficulty): Move {
  if (difficulty === 'casual' || moves.length === 1) return chooseCasualMove(game, moves);
  return chooseStrongMove(game, moves);
}

export function reasonForMove(game: Game, move: RatedMove, comparison?: RatedMove): string {
  const phase = detectStrategicPhase(game, game.current);
  const passAdvantage = move.evidence.nextPassRate - (comparison?.evidence.nextPassRate ?? 0);
  const returnAdvantage = move.lookahead.returnRate - (comparison?.lookahead.returnRate ?? 0);
  if (move.lookahead.returnRate >= 0.55 && (!comparison || returnAdvantage >= 0.1)) {
    return `Looking through likely replies from ${names[(game.current + 1) % 3]} and ${names[(game.current + 2) % 3]}, it preserved a legal way back onto the board about ${Math.round(move.lookahead.returnRate * 100)}% of the time${comparison ? `, ${Math.round(returnAdvantage * 100)} points more often than the comparison move` : ''}.`;
  }
  if (move.evidence.nextPassRate >= 28 && (!comparison || passAdvantage >= 7)) {
    return `Across the plausible hidden deals, it made ${names[(game.current + 1) % 3]} pass immediately about ${Math.round(move.evidence.nextPassRate)}% of the time${comparison ? `, ${Math.round(passAdvantage)} points more often than the comparison move` : ''}.`;
  }
  if (comparison && move.treeSearch.closeDecision && move.treeSearch.visits > 0 && Math.abs(move.winRate - comparison.winRate) < 10) {
    return `The paired rollouts kept the leading moves close at ${Math.round(move.winRate)}% versus ${Math.round(comparison.winRate)}%. The deeper check gave this move ${move.treeSearch.visits} additional visits across ${move.treeSearch.informationSets} public decision states, averaging ${move.treeSearch.averageTreePlies.toFixed(1)} learned choices before the rollout finished the line.`;
  }
  if (phase === 'block' && move.evidence.blockedWinRate >= 12) {
    return `The round looks close to blocking. This move won a blocked table in about ${Math.round(move.evidence.blockedWinRate)}% of the simulations and left an average of ${move.evidence.averagePipsWhenLosing.toFixed(1)} pips when it lost.`;
  }
  if (phase === 'late' && move.evidence.retainedEndMatches >= 1) {
    return `Late in the round, it removes ${move.tile.a + move.tile.b} pips while keeping ${move.evidence.retainedEndMatches} connection${move.evidence.retainedEndMatches === 1 ? '' : 's'} to the new ends for an exit route.`;
  }
  if (move.evidence.blockedWinRate >= 16) {
    return `It produced a blocked-table win in about ${Math.round(move.evidence.blockedWinRate)}% of the simulations while leaving ${move.evidence.retainedEndMatches} ways back into the open numbers.`;
  }
  if (move.evidence.retainedEndMatches >= 2) {
    return `It leaves ${move.newLeft} and ${move.newRight} open while you retain ${move.evidence.retainedEndMatches} matching connections, so you are less likely to be stranded on your next turn.`;
  }
  if (move.tile.a + move.tile.b >= 13) {
    return `It removes ${move.tile.a + move.tile.b} pips now; in simulations you lost with an average of ${move.evidence.averagePipsWhenLosing.toFixed(1)} pips still in hand.`;
  }
  return `It won about ${Math.round(move.winRate)}% of the choice-weighted simulations, with ${Math.round(move.evidence.emptyWinRate)}% ending by playing the final tile and ${Math.round(move.evidence.blockedWinRate)}% by winning a block.`;
}

function optionFromRatedMove(move: RatedMove): DecisionOption {
  return {
    key: moveKey(move),
    tile: { ...move.tile },
    side: move.side,
    newLeft: move.newLeft,
    newRight: move.newRight,
    winRate: move.winRate,
    margin: move.margin,
    samples: move.samples,
    nextPassRate: move.evidence.nextPassRate,
    blockedWinRate: move.evidence.blockedWinRate,
    emptyWinRate: move.evidence.emptyWinRate,
    averagePipsWhenLosing: move.evidence.averagePipsWhenLosing,
    retainedEndMatches: move.evidence.retainedEndMatches,
    returnRate: move.lookahead.returnRate,
    pairedWins: [...move.treeSearch.pairedBaseWins],
    pairedWeights: [...move.treeSearch.pairedBaseWeights],
  };
}

function clonePublicEvent(event: PublicEvent): PublicEvent {
  if (event.kind === 'pass') return { ...event, endsBefore: [...event.endsBefore] };
  return {
    ...event,
    tile: { ...event.tile },
    endsBefore: [...event.endsBefore],
    nextVoids: [...event.nextVoids],
  };
}

function beliefProbabilityForecasts(
  beliefState: BeliefState | undefined,
  perspective: number,
): BeliefProbabilityForecast[] {
  if (!beliefState?.particles.length || beliefState.perspective !== perspective) return [];
  const totalWeight = beliefState.particles.reduce((sum, particle) => sum + particle.weight, 0);
  if (!totalWeight) return [];
  return [0, 1, 2].filter((player) => player !== perspective).flatMap((player) => (
    Array.from({ length: 10 }, (_, value) => ({
      player,
      value,
      probability: beliefState.particles.reduce((sum, particle) => (
        sum + (particle.hands[player].some((tile) => matchesValue(tile, value)) ? particle.weight : 0)
      ), 0) / totalWeight,
    }))
  ));
}

export function createDecisionRecord(
  game: Game,
  ranked: RatedMove[],
  chosenMove: Move,
  beliefs: PlayerBelief[],
  beliefState?: BeliefState,
  styles: OpponentStyleProfile[] = [],
): DecisionRecord | null {
  if (!ranked.length || game.current !== 0) return null;
  const chosen = ranked.find((move) => moveKey(move) === moveKey(chosenMove))
    ?? ranked.find((move) => move.tile.id === chosenMove.tile.id);
  if (!chosen) return null;
  const best = ranked[0];
  const knownEvidence = beliefs.flatMap((belief) => belief.certainOut.length
    ? [`${names[belief.player]} had certainly passed out of ${belief.certainOut.join(' and ')}.`]
    : []);
  const beliefReads = beliefs.flatMap((belief) => belief.softReads.map((read) => (
    `${names[belief.player]} had about a ${Math.round(read.probability * 100)}% chance of holding ${read.value}, so ${read.value} looked ${read.direction === 'less' ? 'less' : 'more'} likely.`
  )));
  const styleReads = styles.flatMap((style) => style.observedChoices >= 4
    ? [`After ${style.observedChoices} choices, ${names[style.player]} ${describeOpponentStyle(style)[0].toLowerCase()}.`]
    : []);
  return {
    id: `${game.round}-${game.events.length}-${moveKey(chosen)}`,
    round: game.round,
    eventCount: game.events.length,
    phase: detectStrategicPhase(game, 0),
    hand: game.hands[0].map((tile) => ({ ...tile })),
    handSizes: game.hands.map((hand) => hand.length),
    ends: endsOf(game.chain),
    chosenKey: moveKey(chosen),
    bestKey: moveKey(best),
    options: ranked.map(optionFromRatedMove),
    knownEvidence,
    inferredEvidence: [...beliefReads, ...styleReads],
    beliefs: beliefs.map((belief) => ({
      ...belief,
      certainOut: [...belief.certainOut],
      softReads: belief.softReads.map((read) => ({ ...read })),
    })),
    beliefConfidence: beliefState?.diagnostics.confidence ?? 'low',
    publicState: {
      chain: game.chain.map((tile) => ({ ...tile })),
      starter: game.starter,
      voids: game.voids.map((values) => [...values].sort((left, right) => left - right)),
      consecutivePasses: game.consecutivePasses,
      events: game.events.map(clonePublicEvent),
    },
    probabilityForecasts: beliefProbabilityForecasts(beliefState, 0),
    styleProfiles: styles.map((style) => ({ ...style })),
    recommendationReason: reasonForMove(game, best, chosen),
  };
}

export function decisionGameFromRecord(record: DecisionRecord): Game {
  return {
    phase: 'playing',
    scores: [0, 0, 0],
    round: record.round,
    hands: record.handSizes.map((size, player) => player === 0
      ? record.hand.map((tile) => ({ ...tile }))
      : Array.from({ length: size }, (_, index) => ({ id: `practice-hidden-${player}-${index}`, a: -1, b: -1 }))),
    chain: record.publicState.chain.map((tile) => ({ ...tile })),
    current: 0,
    starter: record.publicState.starter,
    voids: record.publicState.voids.map((values) => new Set(values)),
    consecutivePasses: record.publicState.consecutivePasses,
    result: null,
    starterDraw: null,
    history: [],
    lastAction: null,
    events: record.publicState.events.map(clonePublicEvent),
  };
}

export function createPracticeGame(record: DecisionRecord, attempt = 0): Game | null {
  const safeGame = decisionGameFromRecord(record);
  const seed = `mistake-lab|${record.id}|${attempt}`;
  const particles = buildParticles(safeGame, 0, 48, seed, record.styleProfiles);
  if (!particles.length) return null;
  const random = seededRandom(`${seed}|weighted-pick`);
  const totalWeight = particles.reduce((sum, particle) => sum + particle.weight, 0);
  let target = random() * totalWeight;
  const selected = particles.find((particle) => {
    target -= particle.weight;
    return target <= 0;
  }) ?? particles[particles.length - 1];
  return {
    ...safeGame,
    hands: selected.hands.map((hand) => hand.map((tile) => ({ ...tile }))),
  };
}

export function simulatePracticeReplies(
  record: DecisionRecord,
  selectedKey: string,
  attempt = 0,
): PracticeReplay | null {
  let game = createPracticeGame(record, attempt);
  if (!game) return null;
  const selected = legalMovesFor(game.hands[0], game.chain).find((move) => moveKey(move) === selectedKey);
  if (!selected) return null;
  game = applyMove(game, selected);
  const replies: PracticeReply[] = [];
  while (game.phase === 'playing' && game.current !== 0 && replies.length < 2) {
    const player = game.current;
    const legal = legalMovesFor(game.hands[player], game.chain);
    if (!legal.length) {
      replies.push({ player, kind: 'pass' });
      game = applyPass(game);
      continue;
    }
    const move = chooseCasualMove(game, legal);
    replies.push({ player, kind: 'play', tile: { ...move.tile }, side: move.side });
    game = applyMove(game, move);
  }
  return {
    dealCode: `P${attempt + 1}`,
    replies,
    returnedToUser: game.phase === 'playing' && game.current === 0,
    roundEnded: game.phase !== 'playing',
    finalEnds: endsOf(game.chain),
  };
}

function pairedDifference(best: DecisionOption, chosen: DecisionOption): { gap: number; interval: [number, number] } {
  if (best.key === chosen.key) return { gap: 0, interval: [0, 0] };
  const count = Math.min(
    best.pairedWins.length,
    chosen.pairedWins.length,
    best.pairedWeights.length,
    chosen.pairedWeights.length,
  );
  if (!count) {
    const gap = best.winRate - chosen.winRate;
    const spread = Math.sqrt(best.margin ** 2 + chosen.margin ** 2);
    return { gap, interval: [gap - spread, gap + spread] };
  }
  const differences = Array.from({ length: count }, (_, index) => best.pairedWins[index] - chosen.pairedWins[index]);
  const weights = Array.from({ length: count }, (_, index) => (best.pairedWeights[index] + chosen.pairedWeights[index]) / 2);
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

function actualHandsAtDecision(finalGame: Game, eventCount: number): Tile[][] {
  return handsBeforeEvent(finalGame, finalGame.hands, Math.min(eventCount, finalGame.events.length));
}

function beliefAudit(record: DecisionRecord, actualHands: Tile[][]): {
  correct: number;
  total: number;
  revealed: string;
} {
  let correct = 0;
  let total = 0;
  let revealed = 'There was no strong hidden-hand read to audit at this decision.';
  for (const belief of record.beliefs) {
    const hand = actualHands[belief.player];
    for (const value of belief.certainOut) {
      total += 1;
      if (!hand.some((tile) => matchesValue(tile, value))) correct += 1;
    }
    for (const read of belief.softReads) {
      const held = hand.some((tile) => matchesValue(tile, read.value));
      const matched = read.direction === 'more' ? held : !held;
      total += 1;
      if (matched) correct += 1;
      if (revealed.startsWith('There was no strong')) {
        revealed = `After the reveal, ${names[belief.player]} ${held ? 'did' : 'did not'} hold ${read.value}. The earlier ${read.direction === 'more' ? 'more-likely' : 'less-likely'} read was ${matched ? 'consistent with the hand' : 'wrong on this deal'}.`;
      }
    }
  }
  return { correct, total, revealed };
}

function simulatedComparison(best: DecisionOption, chosen: DecisionOption): string {
  if (best.key === chosen.key) {
    return `${best.tile.a}-${best.tile.b} led the information-safe simulations at ${Math.round(best.winRate)}% estimated wins.`;
  }
  const passEdge = best.nextPassRate - chosen.nextPassRate;
  const returnEdge = (best.returnRate - chosen.returnRate) * 100;
  const reason = Math.abs(passEdge) >= 6
    ? `It forced the next player to pass about ${Math.round(Math.abs(passEdge))} points ${passEdge > 0 ? 'more' : 'less'} often.`
    : Math.abs(returnEdge) >= 8
      ? `It preserved a return to the board about ${Math.round(Math.abs(returnEdge))} points ${returnEdge > 0 ? 'more' : 'less'} often.`
      : `It left ${best.retainedEndMatches} connection${best.retainedEndMatches === 1 ? '' : 's'} to the new ends, compared with ${chosen.retainedEndMatches}.`;
  return `${best.tile.a}-${best.tile.b} won ${Math.round(best.winRate)}% of simulations versus ${Math.round(chosen.winRate)}% for ${chosen.tile.a}-${chosen.tile.b}. ${reason}`;
}

function reviewDecision(record: DecisionRecord, finalGame: Game): DecisionReview {
  const chosen = record.options.find((option) => option.key === record.chosenKey)!;
  const best = record.options.find((option) => option.key === record.bestKey)!;
  const difference = pairedDifference(best, chosen);
  const definitelyWorse = best.key !== chosen.key && difference.interval[0] > 0;
  const verdict: DecisionVerdict = best.key === chosen.key
    ? 'best'
    : !definitelyWorse || difference.gap < 3
      ? 'close'
      : difference.gap < 10
        ? 'slight'
        : difference.gap < 20
          ? 'mistake'
          : 'big-mistake';
  const confidence: BeliefConfidence = verdict === 'close' || record.beliefConfidence === 'low'
    ? 'low'
    : difference.interval[0] >= 5 && chosen.samples >= 60
      ? 'high'
      : 'moderate';
  const audit = beliefAudit(record, actualHandsAtDecision(finalGame, record.eventCount));
  const uncertainty = verdict === 'close'
    ? `The paired 95% difference interval was ${Math.round(difference.interval[0])} to ${Math.round(difference.interval[1])} points, so this is not a reliable mistake.`
    : `The paired 95% difference interval was ${Math.round(difference.interval[0])} to ${Math.round(difference.interval[1])} points. This supports the comparison, but it does not guarantee the alternate move would win this exact round.`;
  return {
    record,
    chosen,
    best,
    verdict,
    winRateGap: difference.gap,
    interval: difference.interval,
    confidence,
    known: record.knownEvidence[0] ?? 'No opponent void had been proven yet.',
    inferred: record.inferredEvidence[0] ?? 'The hidden-hand model had no strong directional read yet.',
    simulated: simulatedComparison(best, chosen),
    uncertainty,
    revealed: audit.revealed,
    beliefChecks: { correct: audit.correct, total: audit.total },
  };
}

function beliefCalibrationPoints(finalGame: Game, records: DecisionRecord[]): CalibrationPoint[] {
  return records.flatMap((record) => {
    const actualHands = actualHandsAtDecision(finalGame, record.eventCount);
    return record.probabilityForecasts.map((forecast) => ({
      player: forecast.player,
      label: `holds-${forecast.value}`,
      forecast: forecast.probability,
      observed: actualHands[forecast.player].some((tile) => matchesValue(tile, forecast.value)) ? 1 : 0,
      confidence: record.beliefConfidence,
    }));
  });
}

function styleCalibrationPoints(finalGame: Game, records: DecisionRecord[]): CalibrationPoint[] {
  const points: CalibrationPoint[] = [];
  const usedEvents = new Set<string>();
  [...records].sort((left, right) => left.eventCount - right.eventCount).forEach((record) => {
    record.styleProfiles.forEach((style) => {
      if (style.observedChoices < 2) return;
      const eventIndex = finalGame.events.findIndex((event, index) => (
        index > record.eventCount
        && event.kind === 'play'
        && event.player === style.player
        && event.endsBefore[0] !== null
      ));
      if (eventIndex < 0 || usedEvents.has(`${style.player}-${eventIndex}`)) return;
      const actualHands = actualHandsAtDecision(finalGame, eventIndex);
      const observation = styleObservationForEvent(finalGame, eventIndex, actualHands);
      if (!observation) return;
      usedEvents.add(`${style.player}-${eventIndex}`);
      const candidates: Array<[string, number, number | null]> = [
        ['high-pip choice', style.highPipTendency, observation.highPips],
        ['double choice', style.doubleTendency, observation.double],
        ['end control', style.controlTendency, observation.control],
        ['blocking choice', style.blockTendency, observation.block],
        ['strategic consistency', style.strategicConsistency, observation.strategic],
      ];
      candidates.forEach(([label, forecast, observed]) => {
        if (observed === null) return;
        points.push({ player: style.player, label, forecast, observed, confidence: style.confidence });
      });
    });
  });
  return points;
}

export function buildRoundReview(finalGame: Game, records: DecisionRecord[]): RoundReview {
  const decisions = records
    .filter((record) => record.round === finalGame.round)
    .map((record) => reviewDecision(record, finalGame));
  const mistakes = decisions
    .filter((decision) => ['slight', 'mistake', 'big-mistake'].includes(decision.verdict) && decision.interval[0] > 0)
    .sort((left, right) => right.winRateGap - left.winRateGap);
  const bestChoices = decisions
    .filter((decision) => decision.verdict === 'best')
    .sort((left, right) => right.chosen.winRate - left.chosen.winRate);
  const startingHands = actualHandsAtDecision(finalGame, 0);
  return {
    round: finalGame.round,
    decisions,
    biggestMistake: mistakes[0] ?? null,
    bestDecision: bestChoices[0] ?? decisions.find((decision) => decision.verdict === 'close') ?? null,
    closeCalls: decisions.filter((decision) => decision.verdict === 'close').length,
    beliefChecks: decisions.reduce((total, decision) => ({
      correct: total.correct + decision.beliefChecks.correct,
      total: total.total + decision.beliefChecks.total,
    }), { correct: 0, total: 0 }),
    calibration: {
      belief: beliefCalibrationPoints(finalGame, records),
      style: styleCalibrationPoints(finalGame, records),
    },
    opponentStartingHands: [1, 2].map((player) => ({
      player,
      tiles: [...startingHands[player]].sort((left, right) => left.a - right.a || left.b - right.b),
    })),
  };
}

export function buildDeepReviewReport(
  finalGame: Game,
  liveRecords: DecisionRecord[],
  deepRecords: DecisionRecord[],
  analyzedRecordIds: string[],
  sampleCount: number,
): DeepReviewReport {
  const analyzedIds = new Set(analyzedRecordIds);
  const deepById = new Map(deepRecords.map((record) => [record.id, record]));
  const authoritativeRecords = liveRecords.map((record) => (
    analyzedIds.has(record.id) ? deepById.get(record.id) ?? record : record
  ));
  const liveReview = buildRoundReview(finalGame, liveRecords);
  const review = buildRoundReview(finalGame, authoritativeRecords);
  const liveDecisions = new Map(liveReview.decisions.map((decision) => [decision.record.id, decision]));
  const deepDecisions = new Map(review.decisions.map((decision) => [decision.record.id, decision]));
  const comparisons = analyzedRecordIds.flatMap((recordId): DeepDecisionComparison[] => {
    const live = liveDecisions.get(recordId);
    const deep = deepDecisions.get(recordId);
    if (!live || !deep || !deepById.has(recordId)) return [];
    const agreed = live.best.key === deep.best.key;
    const runnerUp = deep.record.options.find((option) => option.key !== deep.best.key);
    const recommendationInterval = runnerUp ? pairedDifference(deep.best, runnerUp).interval : null;
    const recommendationIsUncertain = recommendationInterval ? recommendationInterval[0] <= 0 : false;
    return [{
      recordId,
      analyzed: true,
      agreed,
      liveBestKey: live.best.key,
      deepBestKey: deep.best.key,
      liveVerdict: live.verdict,
      deepVerdict: deep.verdict,
      liveWinRateGap: live.winRateGap,
      deepWinRateGap: deep.winRateGap,
      unstable: !agreed || deep.verdict === 'close' || deep.record.beliefConfidence === 'low' || recommendationIsUncertain,
    }];
  });
  const agreed = comparisons.filter((comparison) => comparison.agreed).length;
  const changedRecommendations = comparisons.length - agreed;
  const unstableDecisions = comparisons.filter((comparison) => comparison.unstable).length;
  return {
    review,
    comparisons,
    sampleCount,
    analyzed: comparisons.length,
    agreed,
    changedRecommendations,
    unstableDecisions,
    agreementRate: comparisons.length ? agreed / comparisons.length : 1,
  };
}

export const engineTesting = { legalMovesForEnds, analyzeMovesForPlayer, solveEndgame, rolloutWinner, outcomeUtility };

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
export type RatedMove = Move & {
  samples: number;
  effectiveSamples: number;
  winRate: number;
  margin: number;
  heuristic: number;
  lookahead: LookaheadForecast;
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

function observedChoiceProbability(game: Game, eventIndex: number, hands: Tile[][]): number {
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
  const scores = legal.map((move) => moveHeuristic(move, hand, eventVoids, event.player, handSizes, context));
  const maximum = Math.max(...scores);
  const weights = scores.map((score) => Math.exp((score - maximum) / 2.25));
  const observedIndex = legal.indexOf(observed);
  const strategicProbability = weights[observedIndex] / weights.reduce((sum, weight) => sum + weight, 0);
  return 0.4 / legal.length + 0.6 * strategicProbability;
}

function choiceLikelihood(game: Game, sampledHands: Tile[][], perspective: number): number {
  let logLikelihood = 0;
  game.events.forEach((event, eventIndex) => {
    if (event.kind !== 'play' || event.player === perspective || event.endsBefore[0] === null) return;
    const probability = observedChoiceProbability(game, eventIndex, handsBeforeEvent(game, sampledHands, eventIndex));
    logLikelihood += Math.log(Math.max(probability, 0.008));
  });
  return Math.exp(Math.max(-10, logLikelihood * 0.38));
}

function buildParticles(game: Game, perspective: number, count: number, seed: string): WeightedSample[] {
  const random = seededRandom(seed);
  const samples: WeightedSample[] = [];
  let attempts = 0;
  while (samples.length < count && attempts < count * 5) {
    attempts += 1;
    const hands = samplePossibleHands(game, perspective, random);
    if (hands) samples.push({ hands, weight: choiceLikelihood(game, hands, perspective) });
  }
  return samples;
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

export function createBeliefState(game: Game, perspective = 0, targetCount = 900): BeliefState {
  const particles = normalizeParticleWeights(buildParticles(game, perspective, targetCount, beliefSeed(game, perspective, 'persistent-beliefs')));
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
): BeliefState {
  const currentOwnHand = handSignature(game.hands[perspective]);
  if (!previous
    || previous.perspective !== perspective
    || previous.round !== game.round
    || previous.targetCount !== targetCount
    || previous.eventCount > game.events.length
    || (previous.eventCount === game.events.length && previous.ownHandSignature !== currentOwnHand)) {
    return createBeliefState(game, perspective, targetCount);
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
        : observedChoiceProbability(game, eventIndex, particle.hands);
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
    const rebuilt = createBeliefState(game, perspective, targetCount);
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
    const fresh = normalizeParticleWeights(buildParticles(game, perspective, freshGoal, beliefSeed(game, perspective, `belief-fresh-${previous.resampleCount + 1}`)));
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

export function estimateBeliefs(game: Game, perspective = 0, sampleCount = 480, beliefState?: BeliefState): PlayerBelief[] {
  const samples = currentBeliefParticles(game, perspective, beliefState)
    ?? buildParticles(game, perspective, sampleCount, `beliefs|${perspective}|${game.round}|${game.events.length}|${game.chain.map((tile) => tile.id).join(',')}`);
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
}: {
  hand: Tile[];
  handSizes: number[];
  legal: Move[];
  voids: Set<number>[];
  current: number;
  context: StrategyContext;
  playedTiles: Tile[];
}): Move {
  if (legal.length === 1) return legal[0];
  const candidates = legal.length <= 3
    ? legal
    : legal
      .map((move) => ({ move, score: moveHeuristic(move, hand, voids, current, handSizes, context) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ move }) => move);
  return candidates
    .map((move) => ({ move, forecast: forecastMoveFromPublicInformation({
      move,
      hand,
      handSizes,
      voids,
      player: current,
      context,
      playedTiles,
    }) }))
    .sort((left, right) => right.forecast.score - left.forecast.score)[0].move;
}

function rolloutWinner(game: Game, firstMove: Move, sampledHands: Tile[][], perspective: number): RolloutOutcome {
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

function analyzeMovesForPlayer(game: Game, perspective: number, sampleCount: number, beliefState?: BeliefState): RatedMove[] {
  const moves = legalMovesFor(game.hands[perspective], game.chain);
  if (!moves.length) return [];
  const stateKey = `${perspective}|${game.round}|${game.events.length}|${game.chain.map((tile) => `${tile.id}:${tile.left}-${tile.right}`).join(',')}|${game.hands[perspective].map((tile) => tile.id).join(',')}`;
  const persistentParticles = currentBeliefParticles(game, perspective, beliefState);
  const samples = persistentParticles
    ? representativeParticles(persistentParticles, interactiveSearchSamples)
    : buildParticles(game, perspective, sampleCount, `analysis|${stateKey}`);
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

  return moves.map((move) => {
    let weightedWins = 0;
    let totalWeight = 0;
    let squaredWeight = 0;
    let weightedNextPasses = 0;
    let weightedBlockedWins = 0;
    let weightedEmptyWins = 0;
    let weightedLossPips = 0;
    let lossWeight = 0;
    samples.forEach((sample) => {
      const outcome = rolloutWinner(game, move, sample.hands, perspective);
      totalWeight += sample.weight;
      squaredWeight += sample.weight * sample.weight;
      if (outcome.winner === perspective) {
        weightedWins += sample.weight;
        if (outcome.reason === 'blocked') weightedBlockedWins += sample.weight;
        if (outcome.reason === 'empty') weightedEmptyWins += sample.weight;
      } else {
        weightedLossPips += outcome.pips[perspective] * sample.weight;
        lossWeight += sample.weight;
      }
      if (outcome.nextPlayerPassed) weightedNextPasses += sample.weight;
    });
    const winRate = totalWeight ? weightedWins / totalWeight * 100 : 0;
    const effectiveSamples = squaredWeight ? totalWeight * totalWeight / squaredWeight : 0;
    const proportion = winRate / 100;
    const margin = effectiveSamples ? 1.96 * Math.sqrt(proportion * (1 - proportion) / effectiveSamples) * 100 : 100;
    const ends = uniqueEnds(move);
    const remaining = game.hands[perspective].filter((tile) => tile.id !== move.tile.id);
    const retainedEndMatches = ends.reduce((sum, value) => sum + remaining.filter((tile) => tile.a === value || tile.b === value).length, 0);
    return {
      ...move,
      samples: samples.length,
      effectiveSamples,
      winRate,
      margin,
      heuristic: moveHeuristic(move, game.hands[perspective], game.voids, perspective, handSizes, context),
      lookahead: lookaheadByMove.get(`${move.tile.id}:${move.side}`)!,
      evidence: {
        nextPassRate: totalWeight ? weightedNextPasses / totalWeight * 100 : 0,
        blockedWinRate: totalWeight ? weightedBlockedWins / totalWeight * 100 : 0,
        emptyWinRate: totalWeight ? weightedEmptyWins / totalWeight * 100 : 0,
        averagePipsWhenLosing: lossWeight ? weightedLossPips / lossWeight : 0,
        retainedEndMatches,
      },
    };
  }).sort((a, b) => b.winRate - a.winRate || b.lookahead.score - a.lookahead.score || b.heuristic - a.heuristic);
}

export function analyzeMoves(game: Game, sampleCount = 900, beliefState?: BeliefState): RatedMove[] {
  return analyzeMovesForPlayer(game, 0, sampleCount, beliefState);
}

export function chooseStrongMove(game: Game, moves: Move[], sampleCount = interactiveSearchSamples): Move {
  if (moves.length === 1) return moves[0];
  const casual = chooseCasualMove(game, moves);
  const ranked = analyzeMovesForPlayer(game, game.current, sampleCount);
  const best = ranked[0];
  const casualResult = ranked.find((candidate) => candidate.tile.id === casual.tile.id && candidate.side === casual.side)
    ?? ranked.find((candidate) => candidate.tile.id === casual.tile.id);
  if (!best || !casualResult) return casual;
  const uncertaintyGuard = Math.max(4, Math.sqrt(best.margin ** 2 + casualResult.margin ** 2) * 0.45);
  return best.winRate - casualResult.winRate > uncertaintyGuard ? best : casual;
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

export const engineTesting = { legalMovesForEnds, analyzeMovesForPlayer, solveEndgame, rolloutWinner };

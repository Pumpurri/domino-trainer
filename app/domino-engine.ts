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
export type MoveEvidence = {
  nextPassRate: number;
  blockedWinRate: number;
  emptyWinRate: number;
  averagePipsWhenLosing: number;
  retainedEndMatches: number;
};
export type RatedMove = Move & {
  samples: number;
  effectiveSamples: number;
  winRate: number;
  margin: number;
  heuristic: number;
  evidence: MoveEvidence;
};
export type SoftRead = { value: number; direction: 'more' | 'less'; probability: number; strength: 'weak' | 'moderate' };
export type PlayerBelief = { player: number; certainOut: number[]; softReads: SoftRead[] };

type WeightedSample = { hands: Tile[][]; weight: number };
type RolloutOutcome = {
  winner: number | null;
  reason: 'empty' | 'blocked' | 'cutoff';
  nextPlayerPassed: boolean;
  pips: number[];
};
type SolvedOutcome = { winner: number | null; reason: 'empty' | 'blocked'; utility: number[] };

export const names = ['You', 'Rosa', 'Tino'];

export function fullSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 9; a += 1) {
    for (let b = a; b <= 9; b += 1) tiles.push({ id: `${a}-${b}`, a, b });
  }
  return tiles;
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

export function moveHeuristic(move: Move, hand: Tile[], voids: Set<number>[], player: number, handSizes: number[] = [10, 10, 10]): number {
  const remaining = hand.filter((tile) => tile.id !== move.tile.id);
  if (!remaining.length) return 1000;
  const ends = uniqueEnds(move);
  const next = (player + 1) % 3;
  const other = (player + 2) % 3;
  const control = ends.reduce((sum, value) => sum + remaining.filter((tile) => tile.a === value || tile.b === value).length, 0);
  const pressure = ends.reduce((sum, value) => sum + (voids[next].has(value) ? (handSizes[next] <= 2 ? 8 : 5.5) : 0), 0);
  const futurePressure = ends.reduce((sum, value) => sum + (voids[other].has(value) ? 1.25 : 0), 0);
  const pipRelief = (move.tile.a + move.tile.b) * 0.2;
  const doubleRelief = move.tile.a === move.tile.b ? (remaining.length <= 4 ? 2 : 1.15) : 0;
  const mobility = new Set(remaining.flatMap((tile) => [tile.a, tile.b])).size * 0.07;
  const stranded = remaining.filter((tile) => !ends.some((value) => tile.a === value || tile.b === value)).length;
  const reconnect = control ? 0 : -1.8;
  const finishPressure = handSizes[player] <= 3 ? pipRelief * 0.35 : 0;
  return control * 1.2 + pressure + futurePressure + pipRelief + doubleRelief + mobility + reconnect + finishPressure - stranded * 0.025;
}

export function chooseCasualMove(game: Game, moves: Move[]): Move {
  const handSizes = game.hands.map((hand) => hand.length);
  return [...moves].sort((a, b) => moveHeuristic(b, game.hands[game.current], game.voids, game.current, handSizes) - moveHeuristic(a, game.hands[game.current], game.voids, game.current, handSizes))[0];
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

function choiceLikelihood(game: Game, sampledHands: Tile[][], perspective: number): number {
  let logLikelihood = 0;

  game.events.forEach((event, eventIndex) => {
    if (event.kind !== 'play' || event.player === perspective || event.endsBefore[0] === null) return;
    const reconstructed = new Map(sampledHands[event.player].map((tile) => [tile.id, tile]));
    for (let futureIndex = eventIndex; futureIndex < game.events.length; futureIndex += 1) {
      const future = game.events[futureIndex];
      if (future.kind === 'play' && future.player === event.player) reconstructed.set(future.tile.id, future.tile);
    }

    const hand = [...reconstructed.values()];
    const legal = legalMovesFor(hand, chainFromEnds(event.endsBefore));
    if (legal.length <= 1) return;
    const observed = legal.find((move) => move.tile.id === event.tile.id && move.side === event.side)
      ?? legal.find((move) => move.tile.id === event.tile.id);
    if (!observed) return;

    const eventVoids = [new Set<number>(), new Set<number>(), new Set<number>()];
    eventVoids[(event.player + 1) % 3] = new Set(event.nextVoids);
    const handSizes = game.hands.map((currentHand, player) => player === event.player ? hand.length : currentHand.length);
    const scores = legal.map((move) => moveHeuristic(move, hand, eventVoids, event.player, handSizes));
    const maximum = Math.max(...scores);
    const weights = scores.map((score) => Math.exp((score - maximum) / 2.25));
    const observedIndex = legal.indexOf(observed);
    const strategicProbability = weights[observedIndex] / weights.reduce((sum, weight) => sum + weight, 0);
    const humanProbability = 0.4 / legal.length + 0.6 * strategicProbability;
    logLikelihood += Math.log(Math.max(humanProbability, 0.008));
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

export function estimateBeliefs(game: Game, perspective = 0, sampleCount = 480): PlayerBelief[] {
  const samples = buildParticles(game, perspective, sampleCount, `beliefs|${perspective}|${game.round}|${game.events.length}|${game.chain.map((tile) => tile.id).join(',')}`);
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

  const handSizes = hands.map((hand) => hand.length);
  let best: SolvedOutcome | null = null;
  let bestTieBreak = -Infinity;
  for (const move of legal) {
    const nextHands = hands.map((hand, player) => player === current ? hand.filter((tile) => tile.id !== move.tile.id) : hand);
    const result = nextHands[current].length === 0
      ? { winner: current, reason: 'empty' as const, utility: terminalUtility(current) }
      : solveEndgame(nextHands, move.newLeft, move.newRight, (current + 1) % 3, 0, memo);
    const tieBreak = moveHeuristic(move, hands[current], [new Set(), new Set(), new Set()], current, handSizes);
    if (!best || result.utility[current] > best.utility[current] || (result.utility[current] === best.utility[current] && tieBreak > bestTieBreak)) {
      best = result;
      bestTieBreak = tieBreak;
    }
  }
  memo.set(key, best!);
  return best!;
}

function selectRolloutMove(hands: Tile[][], legal: Move[], voids: Set<number>[], current: number): Move {
  const handSizes = hands.map((hand) => hand.length);
  return legal
    .map((move) => ({ move, score: moveHeuristic(move, hands[current], voids, current, handSizes) }))
    .sort((a, b) => b.score - a.score)[0].move;
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

  for (let turn = 0; turn < 80; turn += 1) {
    const totalTiles = hands.reduce((sum, hand) => sum + hand.length, 0);
    if (totalTiles <= 7) {
      const solved = solveEndgame(hands, left, right, current, passes, new Map());
      return { winner: solved.winner, reason: solved.reason, nextPlayerPassed, pips: hands.map(pipTotal) };
    }

    const legal = legalMovesForEnds(hands[current], left, right);
    if (!legal.length) {
      if (firstTurn) nextPlayerPassed = true;
      voids[current].add(left);
      voids[current].add(right);
      passes += 1;
      if (passes === 3) return { winner: blockedWinner(hands), reason: 'blocked', nextPlayerPassed, pips: hands.map(pipTotal) };
    } else {
      passes = 0;
      const move = selectRolloutMove(hands, legal, voids, current);
      hands[current] = hands[current].filter((tile) => tile.id !== move.tile.id);
      left = move.newLeft;
      right = move.newRight;
      if (!hands[current].length) return { winner: current, reason: 'empty', nextPlayerPassed, pips: hands.map(pipTotal) };
    }
    firstTurn = false;
    current = (current + 1) % 3;
  }
  return { winner: null, reason: 'cutoff', nextPlayerPassed, pips: hands.map(pipTotal) };
}

function analyzeMovesForPlayer(game: Game, perspective: number, sampleCount: number): RatedMove[] {
  const moves = legalMovesFor(game.hands[perspective], game.chain);
  if (!moves.length) return [];
  const stateKey = `${perspective}|${game.round}|${game.events.length}|${game.chain.map((tile) => `${tile.id}:${tile.left}-${tile.right}`).join(',')}|${game.hands[perspective].map((tile) => tile.id).join(',')}`;
  const samples = buildParticles(game, perspective, sampleCount, `analysis|${stateKey}`);
  const handSizes = game.hands.map((hand) => hand.length);

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
      heuristic: moveHeuristic(move, game.hands[perspective], game.voids, perspective, handSizes),
      evidence: {
        nextPassRate: totalWeight ? weightedNextPasses / totalWeight * 100 : 0,
        blockedWinRate: totalWeight ? weightedBlockedWins / totalWeight * 100 : 0,
        emptyWinRate: totalWeight ? weightedEmptyWins / totalWeight * 100 : 0,
        averagePipsWhenLosing: lossWeight ? weightedLossPips / lossWeight : 0,
        retainedEndMatches,
      },
    };
  }).sort((a, b) => b.winRate - a.winRate || b.heuristic - a.heuristic);
}

export function analyzeMoves(game: Game, sampleCount = 900): RatedMove[] {
  return analyzeMovesForPlayer(game, 0, sampleCount);
}

export function chooseStrongMove(game: Game, moves: Move[], sampleCount = 500): Move {
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
  const passAdvantage = move.evidence.nextPassRate - (comparison?.evidence.nextPassRate ?? 0);
  if (move.evidence.nextPassRate >= 28 && (!comparison || passAdvantage >= 7)) {
    return `Across the plausible hidden deals, it made ${names[(game.current + 1) % 3]} pass immediately about ${Math.round(move.evidence.nextPassRate)}% of the time${comparison ? `—${Math.round(passAdvantage)} points more often than the comparison move` : ''}.`;
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

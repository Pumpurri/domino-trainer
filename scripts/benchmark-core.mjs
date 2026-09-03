import {
  applyMove,
  applyPass,
  chooseCasualMove,
  chooseStrongMove,
  fullSet,
  initialGame,
  legalMovesFor,
  seededRandom,
  shuffle,
} from '../app/domino-engine.ts';

export const STRATEGIES = ['random', 'casual', 'strong'];

export const STRATEGY_LINEUPS = [
  ['random', 'casual', 'strong'],
  ['random', 'strong', 'casual'],
  ['casual', 'random', 'strong'],
  ['casual', 'strong', 'random'],
  ['strong', 'random', 'casual'],
  ['strong', 'casual', 'random'],
];

function emptyCell() {
  return { trials: 0, wins: 0 };
}

function emptyStrategyStats() {
  return {
    appearances: 0,
    wins: 0,
    endPips: [],
    losingPips: [],
    blockedAppearances: 0,
    blockedWins: 0,
    emptyWins: 0,
    bySeat: Array.from({ length: 3 }, emptyCell),
    byStarter: Array.from({ length: 3 }, emptyCell),
    bySeatAndStarter: Array.from({ length: 3 }, () => Array.from({ length: 3 }, emptyCell)),
    whenStarting: emptyCell(),
    whenNotStarting: emptyCell(),
  };
}

export function wilsonInterval(successes, trials, z = 1.96) {
  if (!trials) return { rate: 0, low: 0, high: 0 };
  const rate = successes / trials;
  const denominator = 1 + z * z / trials;
  const center = (rate + z * z / (2 * trials)) / denominator;
  const spread = z * Math.sqrt(rate * (1 - rate) / trials + z * z / (4 * trials * trials)) / denominator;
  return { rate, low: Math.max(0, center - spread), high: Math.min(1, center + spread) };
}

export function meanInterval(values, z = 1.96) {
  if (!values.length) return { mean: 0, low: 0, high: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1) return { mean, low: mean, high: mean };
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const spread = z * Math.sqrt(variance / values.length);
  return { mean, low: mean - spread, high: mean + spread };
}

function quantile(sorted, probability) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function clusterRatioInterval(clusters, numerator, denominator, seed, resamples) {
  const numeratorTotal = clusters.reduce((sum, cluster) => sum + numerator(cluster), 0);
  const denominatorTotal = clusters.reduce((sum, cluster) => sum + denominator(cluster), 0);
  const rate = denominatorTotal ? numeratorTotal / denominatorTotal : 0;
  if (clusters.length < 2 || !denominatorTotal) return { rate, low: rate, high: rate };

  const random = seededRandom(`cluster-bootstrap|${seed}`);
  const estimates = [];
  for (let sample = 0; sample < resamples; sample += 1) {
    let sampledNumerator = 0;
    let sampledDenominator = 0;
    for (let draw = 0; draw < clusters.length; draw += 1) {
      const cluster = clusters[Math.floor(random() * clusters.length)];
      sampledNumerator += numerator(cluster);
      sampledDenominator += denominator(cluster);
    }
    if (sampledDenominator) estimates.push(sampledNumerator / sampledDenominator);
  }
  estimates.sort((a, b) => a - b);
  return { rate, low: quantile(estimates, 0.025), high: quantile(estimates, 0.975) };
}

function clusterMeanInterval(clusters, values, seed, resamples) {
  const ratio = clusterRatioInterval(
    clusters,
    (cluster) => values(cluster).reduce((sum, value) => sum + value, 0),
    (cluster) => values(cluster).length,
    seed,
    resamples,
  );
  return { mean: ratio.rate, low: ratio.low, high: ratio.high };
}

export function createMatchedDeal(index, seed = 'mesa-quince-matched-v1') {
  const random = seededRandom(`${seed}|deal|${index}`);
  const deck = shuffle(fullSet(), random);
  return {
    id: `${seed}-${index}`,
    hands: [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)]
      .map((hand) => [...hand].sort((a, b) => a.a - b.a || a.b - b.b)),
    sleepers: deck.slice(30),
  };
}

export function gameFromMatchedDeal(deal, starter, round = 1) {
  return {
    ...initialGame(),
    phase: 'playing',
    round,
    hands: deal.hands.map((hand) => [...hand]),
    current: starter,
    starter,
    history: [`Matched benchmark deal ${deal.id}; seat ${starter} opens.`],
  };
}

function chooseMove(strategy, game, moves, random, strongSamples) {
  if (strategy === 'random') return moves[Math.floor(random() * moves.length)];
  if (strategy === 'casual') return chooseCasualMove(game, moves);
  if (strategy === 'strong') return chooseStrongMove(game, moves, strongSamples);
  throw new Error(`Unknown benchmark strategy: ${strategy}`);
}

export function playMatchedRound({ deal, starter, lineup, strongSamples = 80, seed = 'mesa-quince-matched-v1' }) {
  let game = gameFromMatchedDeal(deal, starter);
  const random = seededRandom(`${seed}|round|${deal.id}|${starter}|${lineup.join('-')}`);

  for (let turn = 0; turn < 180 && game.phase === 'playing'; turn += 1) {
    const moves = legalMovesFor(game.hands[game.current], game.chain);
    if (!moves.length) {
      game = applyPass(game);
      continue;
    }
    game = applyMove(game, chooseMove(lineup[game.current], game, moves, random, strongSamples));
  }

  if (game.phase === 'playing' || !game.result) {
    throw new Error(`Benchmark round did not finish: ${deal.id}, starter ${starter}, ${lineup.join('/')}`);
  }
  return game;
}

function recordCell(cell, won) {
  cell.trials += 1;
  if (won) cell.wins += 1;
}

function recordRound(stats, result, lineup, starter) {
  for (let seat = 0; seat < 3; seat += 1) {
    const strategy = lineup[seat];
    const current = stats[strategy];
    const won = result.winner === seat;
    current.appearances += 1;
    current.endPips.push(result.pips[seat]);
    if (!won) current.losingPips.push(result.pips[seat]);
    if (won) {
      current.wins += 1;
      if (result.reason === 'empty') current.emptyWins += 1;
    }
    if (result.reason === 'blocked') {
      current.blockedAppearances += 1;
      if (won) current.blockedWins += 1;
    }
    recordCell(current.bySeat[seat], won);
    recordCell(current.byStarter[starter], won);
    recordCell(current.bySeatAndStarter[seat][starter], won);
    recordCell(seat === starter ? current.whenStarting : current.whenNotStarting, won);
  }
}

export function summarizeStrategy(raw, clusters, strategy, confidenceResamples) {
  const ratio = (suffix, numerator, denominator) => clusterRatioInterval(
    clusters,
    numerator,
    denominator,
    `${strategy}|${suffix}`,
    confidenceResamples,
  );
  return {
    appearances: raw.appearances,
    wins: raw.wins,
    winRate: ratio('overall', (cluster) => cluster.wins, (cluster) => cluster.appearances),
    averageEndPips: clusterMeanInterval(clusters, (cluster) => cluster.endPips, `${strategy}|end-pips`, confidenceResamples),
    averageLosingPips: clusterMeanInterval(clusters, (cluster) => cluster.losingPips, `${strategy}|losing-pips`, confidenceResamples),
    blocked: {
      appearances: raw.blockedAppearances,
      wins: raw.blockedWins,
      winRate: ratio('blocked', (cluster) => cluster.blockedWins, (cluster) => cluster.blockedAppearances),
    },
    emptyWins: raw.emptyWins,
    bySeat: raw.bySeat.map((cell, seat) => ({
      ...cell,
      winRate: ratio(`seat-${seat}`, (cluster) => cluster.bySeat[seat].wins, (cluster) => cluster.bySeat[seat].trials),
    })),
    byStarter: raw.byStarter.map((cell, starter) => ({
      ...cell,
      winRate: ratio(`starter-${starter}`, (cluster) => cluster.byStarter[starter].wins, (cluster) => cluster.byStarter[starter].trials),
    })),
    bySeatAndStarter: raw.bySeatAndStarter.map((row, seat) => row.map((cell, starter) => ({
      ...cell,
      winRate: ratio(
        `seat-${seat}-starter-${starter}`,
        (cluster) => cluster.bySeatAndStarter[seat][starter].wins,
        (cluster) => cluster.bySeatAndStarter[seat][starter].trials,
      ),
    }))),
    whenStarting: {
      ...raw.whenStarting,
      winRate: ratio('when-starting', (cluster) => cluster.whenStarting.wins, (cluster) => cluster.whenStarting.trials),
    },
    whenNotStarting: {
      ...raw.whenNotStarting,
      winRate: ratio('when-not-starting', (cluster) => cluster.whenNotStarting.wins, (cluster) => cluster.whenNotStarting.trials),
    },
  };
}

export function runMatchedDeal({ dealIndex, strongSamples = 80, seed = 'mesa-quince-matched-v1' }) {
  const deal = createMatchedDeal(dealIndex, seed);
  const rounds = [];
  for (let starter = 0; starter < 3; starter += 1) {
    for (const lineup of STRATEGY_LINEUPS) {
      const game = playMatchedRound({ deal, starter, lineup, strongSamples, seed });
      rounds.push({
        starter,
        lineup,
        winner: game.result.winner,
        reason: game.result.reason,
        pips: game.result.pips,
      });
    }
  }
  return { dealIndex, rounds };
}

export function aggregateMatchedDeals({
  dealResults,
  strongSamples = 80,
  seed = 'mesa-quince-matched-v1',
  confidenceResamples = 2000,
}) {
  const stats = Object.fromEntries(STRATEGIES.map((strategy) => [strategy, emptyStrategyStats()]));
  const dealClusters = [];
  const outcomes = { rounds: 0, empty: 0, blocked: 0, tied: 0 };

  for (const dealResult of [...dealResults].sort((a, b) => a.dealIndex - b.dealIndex)) {
    const dealStats = Object.fromEntries(STRATEGIES.map((strategy) => [strategy, emptyStrategyStats()]));
    for (const round of dealResult.rounds) {
      outcomes.rounds += 1;
      outcomes[round.reason] += 1;
      if (round.winner === null) outcomes.tied += 1;
      recordRound(stats, round, round.lineup, round.starter);
      recordRound(dealStats, round, round.lineup, round.starter);
    }
    dealClusters.push(dealStats);
  }

  return {
    config: {
      seed,
      matchedDeals: dealResults.length,
      replaysPerDeal: STRATEGY_LINEUPS.length * 3,
      rounds: outcomes.rounds,
      strongSamplesPerDecision: strongSamples,
      confidenceResamples,
    },
    outcomes,
    strategies: Object.fromEntries(STRATEGIES.map((strategy) => [
      strategy,
      summarizeStrategy(
        stats[strategy],
        dealClusters.map((cluster) => cluster[strategy]),
        strategy,
        confidenceResamples,
      ),
    ])),
  };
}

export function runMatchedBenchmark({
  dealCount = 120,
  strongSamples = 80,
  seed = 'mesa-quince-matched-v1',
  confidenceResamples = 2000,
  onProgress,
} = {}) {
  const dealResults = [];
  for (let dealIndex = 0; dealIndex < dealCount; dealIndex += 1) {
    dealResults.push(runMatchedDeal({ dealIndex, strongSamples, seed }));
    onProgress?.(dealIndex + 1, dealCount);
  }
  return aggregateMatchedDeals({ dealResults, strongSamples, seed, confidenceResamples });
}

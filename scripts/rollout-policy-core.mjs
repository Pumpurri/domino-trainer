import {
  applyMove,
  applyPass,
  chooseRolloutPolicyMove,
  detectStrategicPhase,
  legalMovesFor,
  seededRandom,
} from '../app/domino-engine.ts';
import { createMatchedDeal, gameFromMatchedDeal } from './benchmark-core.mjs';

export const ROLLOUT_POLICY_VERSION = 'rollout-policy-diagnostic-v1';
export const ROLLOUT_POLICIES = [
  'current',
  'exhaustive-forecast',
  'mixed',
  'stochastic-top-two',
];
export const ROLLOUT_PHASES = ['opening', 'middle', 'late', 'block'];

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => permutations([
    ...values.slice(0, index),
    ...values.slice(index + 1),
  ]).map((suffix) => [value, ...suffix]));
}

function combinations(values, size, start = 0, chosen = []) {
  if (chosen.length === size) return [chosen];
  const output = [];
  for (let index = start; index <= values.length - (size - chosen.length); index += 1) {
    output.push(...combinations(values, size, index + 1, [...chosen, values[index]]));
  }
  return output;
}

export const ROLLOUT_POLICY_LINEUPS = combinations(ROLLOUT_POLICIES, 3)
  .flatMap((policies) => permutations(policies));

function emptyCell() {
  return { trials: 0, wins: 0 };
}

function emptyPolicyStats() {
  return {
    appearances: 0,
    wins: 0,
    endPips: [],
    losingPips: [],
    blockedAppearances: 0,
    blockedWins: 0,
    emptyWins: 0,
    decisions: 0,
    bySeat: Array.from({ length: 3 }, emptyCell),
    byStarter: Array.from({ length: 3 }, emptyCell),
    whenStarting: emptyCell(),
    whenNotStarting: emptyCell(),
    byPhase: Object.fromEntries(ROLLOUT_PHASES.map((phase) => [phase, {
      rounds: 0,
      wins: 0,
      decisions: 0,
    }])),
  };
}

function emptyDealStats() {
  return Object.fromEntries(ROLLOUT_POLICIES.map((policy) => [policy, emptyPolicyStats()]));
}

function recordCell(cell, won) {
  cell.trials += 1;
  if (won) cell.wins += 1;
}

export function playRolloutPolicyRound({
  deal,
  starter,
  lineup,
  seed = 'mesa-quince-rollout-policy-v1',
}) {
  let game = gameFromMatchedDeal(deal, starter);
  const phaseDecisions = Array.from({ length: 3 }, () => Object.fromEntries(
    ROLLOUT_PHASES.map((phase) => [phase, 0]),
  ));
  const randoms = lineup.map((policy, seat) => seededRandom(
    `${seed}|${deal.id}|starter-${starter}|${lineup.join('-')}|seat-${seat}|${policy}`,
  ));

  for (let turn = 0; turn < 180 && game.phase === 'playing'; turn += 1) {
    const actor = game.current;
    const legal = legalMovesFor(game.hands[actor], game.chain);
    if (!legal.length) {
      game = applyPass(game);
      continue;
    }
    if (legal.length > 1) phaseDecisions[actor][detectStrategicPhase(game, actor)] += 1;
    game = applyMove(
      game,
      chooseRolloutPolicyMove(game, legal, lineup[actor], randoms[actor]),
    );
  }
  if (game.phase === 'playing' || !game.result) {
    throw new Error(`Rollout-policy round did not finish: ${deal.id}, starter ${starter}, ${lineup.join('/')}`);
  }
  return {
    starter,
    lineup,
    winner: game.result.winner,
    reason: game.result.reason,
    pips: game.result.pips,
    phaseDecisions,
  };
}

function recordRound(stats, result) {
  result.lineup.forEach((policy, seat) => {
    const current = stats[policy];
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
    recordCell(current.byStarter[result.starter], won);
    recordCell(seat === result.starter ? current.whenStarting : current.whenNotStarting, won);
    ROLLOUT_PHASES.forEach((phase) => {
      const decisions = result.phaseDecisions[seat][phase];
      current.byPhase[phase].decisions += decisions;
      current.decisions += decisions;
      if (decisions > 0) {
        current.byPhase[phase].rounds += 1;
        if (won) current.byPhase[phase].wins += 1;
      }
    });
  });
}

export function runRolloutPolicyDeal({
  dealIndex,
  seed = 'mesa-quince-rollout-policy-v1',
}) {
  const deal = createMatchedDeal(dealIndex, seed);
  const strategies = emptyDealStats();
  let rounds = 0;
  for (let starter = 0; starter < 3; starter += 1) {
    for (const lineup of ROLLOUT_POLICY_LINEUPS) {
      const result = playRolloutPolicyRound({ deal, starter, lineup, seed });
      recordRound(strategies, result);
      rounds += 1;
    }
  }
  return {
    id: `deal-${String(dealIndex + 1).padStart(4, '0')}`,
    dealIndex,
    rounds,
    strategies,
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

function bootstrapEstimate(clusters, estimate, seed, resamples) {
  const mean = estimate(clusters);
  if (clusters.length < 2 || resamples <= 0) return { mean, low: mean, high: mean };
  const random = seededRandom(seed);
  const estimates = [];
  for (let sample = 0; sample < resamples; sample += 1) {
    const drawn = Array.from({ length: clusters.length }, () => clusters[Math.floor(random() * clusters.length)]);
    const value = estimate(drawn);
    if (Number.isFinite(value)) estimates.push(value);
  }
  estimates.sort((left, right) => left - right);
  return {
    mean,
    low: percentile(estimates, 0.025),
    high: percentile(estimates, 0.975),
  };
}

function ratioEstimate(clusters, numerator, denominator) {
  const top = clusters.reduce((sum, cluster) => sum + numerator(cluster), 0);
  const bottom = clusters.reduce((sum, cluster) => sum + denominator(cluster), 0);
  return bottom ? top / bottom : 0;
}

function ratioInterval(clusters, numerator, denominator, seed, resamples) {
  return bootstrapEstimate(
    clusters,
    (sample) => ratioEstimate(sample, numerator, denominator),
    seed,
    resamples,
  );
}

function meanInterval(clusters, values, seed, resamples) {
  return ratioInterval(
    clusters,
    (cluster) => values(cluster).reduce((sum, value) => sum + value, 0),
    (cluster) => values(cluster).length,
    seed,
    resamples,
  );
}

function policySummary(clusters, policy, seed, resamples) {
  const read = (cluster) => cluster.strategies[policy];
  const winRate = (label, cell) => ratioInterval(
    clusters,
    (cluster) => cell(read(cluster)).wins,
    (cluster) => cell(read(cluster)).trials,
    `${seed}|${policy}|${label}`,
    resamples,
  );
  return {
    appearances: clusters.reduce((sum, cluster) => sum + read(cluster).appearances, 0),
    decisions: clusters.reduce((sum, cluster) => sum + read(cluster).decisions, 0),
    winRate: ratioInterval(
      clusters,
      (cluster) => read(cluster).wins,
      (cluster) => read(cluster).appearances,
      `${seed}|${policy}|wins`,
      resamples,
    ),
    averageEndPips: meanInterval(clusters, (cluster) => read(cluster).endPips, `${seed}|${policy}|end-pips`, resamples),
    averageLosingPips: meanInterval(clusters, (cluster) => read(cluster).losingPips, `${seed}|${policy}|losing-pips`, resamples),
    blocked: {
      appearances: clusters.reduce((sum, cluster) => sum + read(cluster).blockedAppearances, 0),
      winRate: ratioInterval(
        clusters,
        (cluster) => read(cluster).blockedWins,
        (cluster) => read(cluster).blockedAppearances,
        `${seed}|${policy}|blocked`,
        resamples,
      ),
    },
    bySeat: [0, 1, 2].map((seat) => winRate(`seat-${seat}`, (stats) => stats.bySeat[seat])),
    byStarter: [0, 1, 2].map((starter) => winRate(`starter-${starter}`, (stats) => stats.byStarter[starter])),
    whenStarting: winRate('when-starting', (stats) => stats.whenStarting),
    whenNotStarting: winRate('when-not-starting', (stats) => stats.whenNotStarting),
    byPhase: Object.fromEntries(ROLLOUT_PHASES.map((phase) => [phase, {
      rounds: clusters.reduce((sum, cluster) => sum + read(cluster).byPhase[phase].rounds, 0),
      decisions: clusters.reduce((sum, cluster) => sum + read(cluster).byPhase[phase].decisions, 0),
      winRate: ratioInterval(
        clusters,
        (cluster) => read(cluster).byPhase[phase].wins,
        (cluster) => read(cluster).byPhase[phase].rounds,
        `${seed}|${policy}|phase-${phase}`,
        resamples,
      ),
    }])),
  };
}

function pairedRatioDifference(clusters, candidate, control, readCell, seed, resamples) {
  return bootstrapEstimate(clusters, (sample) => {
    const candidateRate = ratioEstimate(
      sample,
      (cluster) => readCell(cluster.strategies[candidate]).wins,
      (cluster) => readCell(cluster.strategies[candidate]).trials,
    );
    const controlRate = ratioEstimate(
      sample,
      (cluster) => readCell(cluster.strategies[control]).wins,
      (cluster) => readCell(cluster.strategies[control]).trials,
    );
    return candidateRate - controlRate;
  }, seed, resamples);
}

function pairedMeanDifference(clusters, candidate, control, values, seed, resamples) {
  return bootstrapEstimate(clusters, (sample) => {
    const mean = (policy) => ratioEstimate(
      sample,
      (cluster) => values(cluster.strategies[policy]).reduce((sum, value) => sum + value, 0),
      (cluster) => values(cluster.strategies[policy]).length,
    );
    return mean(candidate) - mean(control);
  }, seed, resamples);
}

export function rolloutPolicyDevelopmentGate(comparison) {
  const checks = {
    overallDirection: comparison.winRateDifference.mean > 0,
    overallNoninferior: comparison.winRateDifference.low >= -0.01,
    blockedNoninferior: comparison.blockedWinRateDifference.mean >= -0.02,
    losingPipsNoninferior: comparison.losingPipsDifference.mean <= 1,
    phaseNoninferior: ROLLOUT_PHASES.every((phase) => comparison.phaseWinRateDifferences[phase].mean >= -0.02),
    strategicSignal: comparison.winRateDifference.mean >= 0.005
      || comparison.phaseWinRateDifferences.middle.mean >= 0.015
      || comparison.phaseWinRateDifferences.late.mean >= 0.015,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function summarizeRolloutPolicyBenchmark(clusters, {
  seed = 'mesa-quince-rollout-policy-v1',
  confidenceResamples = 2000,
  control = 'current',
} = {}) {
  const strategies = Object.fromEntries(ROLLOUT_POLICIES.map((policy) => [
    policy,
    policySummary(clusters, policy, seed, confidenceResamples),
  ]));
  const comparisons = Object.fromEntries(ROLLOUT_POLICIES
    .filter((policy) => policy !== control)
    .map((policy) => {
      const comparison = {
        winRateDifference: pairedRatioDifference(
          clusters,
          policy,
          control,
          (stats) => ({ wins: stats.wins, trials: stats.appearances }),
          `${seed}|${policy}|paired-wins`,
          confidenceResamples,
        ),
        blockedWinRateDifference: pairedRatioDifference(
          clusters,
          policy,
          control,
          (stats) => ({ wins: stats.blockedWins, trials: stats.blockedAppearances }),
          `${seed}|${policy}|paired-blocked`,
          confidenceResamples,
        ),
        losingPipsDifference: pairedMeanDifference(
          clusters,
          policy,
          control,
          (stats) => stats.losingPips,
          `${seed}|${policy}|paired-losing-pips`,
          confidenceResamples,
        ),
        phaseWinRateDifferences: Object.fromEntries(ROLLOUT_PHASES.map((phase) => [
          phase,
          pairedRatioDifference(
            clusters,
            policy,
            control,
            (stats) => ({ wins: stats.byPhase[phase].wins, trials: stats.byPhase[phase].rounds }),
            `${seed}|${policy}|paired-phase-${phase}`,
            confidenceResamples,
          ),
        ])),
      };
      return [policy, { ...comparison, gate: rolloutPolicyDevelopmentGate(comparison) }];
    }));
  const passingPolicies = Object.entries(comparisons)
    .filter(([, comparison]) => comparison.gate.passed)
    .map(([policy]) => policy)
    .sort((left, right) => (
      comparisons[right].winRateDifference.mean - comparisons[left].winRateDifference.mean
      || comparisons[left].losingPipsDifference.mean - comparisons[right].losingPipsDifference.mean
      || left.localeCompare(right)
    ));
  return {
    version: ROLLOUT_POLICY_VERSION,
    deals: clusters.length,
    rounds: clusters.reduce((sum, cluster) => sum + cluster.rounds, 0),
    control,
    strategies,
    comparisons,
    decision: {
      selectedPolicy: passingPolicies[0] ?? null,
      passingPolicies,
    },
  };
}

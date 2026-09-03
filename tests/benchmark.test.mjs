import assert from 'node:assert/strict';
import test from 'node:test';
import { legalMovesFor } from '../app/domino-engine.ts';
import {
  STRATEGIES,
  STRATEGY_LINEUPS,
  createMatchedDeal,
  runMatchedBenchmark,
  wilsonInterval,
} from '../scripts/benchmark-core.mjs';
import { runMatchedBenchmarkParallel } from '../scripts/benchmark-parallel.mjs';
import { strategicScenarios } from '../scripts/strategic-scenarios.mjs';

test('matched schedule puts every strategy in every seat equally', () => {
  for (const strategy of STRATEGIES) {
    const seatCounts = [0, 1, 2].map((seat) => STRATEGY_LINEUPS.filter((lineup) => lineup[seat] === strategy).length);
    assert.deepEqual(seatCounts, [2, 2, 2]);
  }
});

test('matched deals are deterministic and contain 30 dealt plus 25 sleeping tiles', () => {
  const first = createMatchedDeal(4, 'fixed-seed');
  const second = createMatchedDeal(4, 'fixed-seed');
  assert.deepEqual(first, second);
  assert.deepEqual(first.hands.map((hand) => hand.length), [10, 10, 10]);
  assert.equal(first.sleepers.length, 25);
  assert.equal(new Set([...first.hands.flat(), ...first.sleepers].map(({ id }) => id)).size, 55);
});

test('Wilson interval contains its observed win rate', () => {
  const interval = wilsonInterval(37, 100);
  assert.equal(interval.rate, 0.37);
  assert.ok(interval.low < interval.rate);
  assert.ok(interval.high > interval.rate);
});

test('strategic scenario labels always name legal moves', () => {
  for (const scenario of strategicScenarios) {
    const legal = new Set(legalMovesFor(scenario.game.hands[0], scenario.game.chain).map((move) => `${move.tile.id}:${move.side}`));
    assert.ok(scenario.expected.some((move) => legal.has(move)), `${scenario.id} has no legal expected move`);
  }
});

test('one matched deal produces a balanced 18-round evaluation', () => {
  const result = runMatchedBenchmark({ dealCount: 1, strongSamples: 8, seed: 'tiny-benchmark' });
  assert.equal(result.outcomes.rounds, 18);
  for (const strategy of STRATEGIES) {
    const stats = result.strategies[strategy];
    assert.equal(stats.appearances, 18);
    assert.deepEqual(stats.bySeat.map(({ trials }) => trials), [6, 6, 6]);
    assert.equal(stats.whenStarting.trials, 6);
    assert.equal(stats.whenNotStarting.trials, 12);
    assert.ok(stats.bySeatAndStarter.flat().every(({ trials }) => trials === 2));
  }
});

test('parallel and single-threaded benchmarks produce identical game results', async () => {
  const options = { dealCount: 2, strongSamples: 6, seed: 'parallel-check', confidenceResamples: 40 };
  const sequential = runMatchedBenchmark(options);
  const parallel = await runMatchedBenchmarkParallel({ ...options, workerCount: 2 });
  assert.deepEqual(parallel, sequential);
});

import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import {
  analyzeMoves,
  createBeliefState,
  dealRound,
  initialGame,
  mergeMoveAnalyses,
  seededRandom,
} from '../app/domino-engine.ts';

const workerCount = Math.max(1, Math.min(4, Number.parseInt(process.env.MESA_ANALYSIS_WORKERS ?? '4', 10)));
const representativeLimit = Math.max(1, Number.parseInt(process.env.MESA_ANALYSIS_SAMPLES ?? '120', 10));
const particleCount = Math.max(representativeLimit, Number.parseInt(process.env.MESA_ANALYSIS_PARTICLES ?? '900', 10));
const game = dealRound(initialGame(), 0, seededRandom('latency-opening'));
const beliefState = createBeliefState(game, 0, particleCount);

const singleStarted = performance.now();
const single = analyzeMoves(game, particleCount, beliefState, undefined, { representativeLimit });
const singleMs = performance.now() - singleStarted;

const parallelStarted = performance.now();
const results = await Promise.all(Array.from({ length: workerCount }, (_, shardIndex) => new Promise((resolve, reject) => {
  const worker = new Worker(new URL('./analysis-worker.mjs', import.meta.url), {
    workerData: {
      game,
      sampleCount: particleCount,
      beliefState,
      options: { representativeLimit, shardIndex, shardCount: workerCount },
    },
  });
  worker.once('message', resolve);
  worker.once('error', reject);
})));
const parallelMs = performance.now() - parallelStarted;
const merged = mergeMoveAnalyses(results.map(({ ranked }) => ranked));

assert.deepEqual(merged.map(({ tile, side }) => `${tile.id}:${side}`), single.map(({ tile, side }) => `${tile.id}:${side}`));
merged.forEach((move, index) => assert.ok(Math.abs(move.winRate - single[index].winRate) < 1e-9));

console.log(`Opening position: ${single.length} legal moves, ${representativeLimit} paired samples per move`);
console.log(`Single worker: ${Math.round(singleMs)} ms`);
console.log(`${workerCount} workers: ${Math.round(parallelMs)} ms wall time`);
console.log(`Speedup: ${(singleMs / parallelMs).toFixed(2)}x`);
console.log(`Slowest shard: ${Math.round(Math.max(...results.map(({ elapsedMs }) => elapsedMs)))} ms`);
console.log(`Choice preserved: ${merged[0].tile.id}:${merged[0].side}`);

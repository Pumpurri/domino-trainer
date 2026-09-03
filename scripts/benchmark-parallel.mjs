import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { aggregateMatchedDeals } from './benchmark-core.mjs';

export function defaultWorkerCount(dealCount) {
  return Math.max(1, Math.min(dealCount, Math.max(1, availableParallelism() - 1), 8));
}

function runWorker({ dealIndexes, strongSamples, seed, onProgress }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./benchmark-worker.mjs', import.meta.url), {
      workerData: { dealIndexes, strongSamples, seed },
    });
    let complete = false;
    worker.on('message', (message) => {
      if (message.type === 'progress') onProgress?.();
      if (message.type === 'complete') {
        complete = true;
        resolve(message.dealResults);
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Benchmark worker exited with code ${code}.`));
      else if (!complete) reject(new Error('Benchmark worker exited before returning its deal results.'));
    });
  });
}

export async function runMatchedBenchmarkParallel({
  dealCount,
  strongSamples,
  seed,
  confidenceResamples,
  workerCount = defaultWorkerCount(dealCount),
  onProgress,
}) {
  const batches = Array.from({ length: workerCount }, () => []);
  for (let dealIndex = 0; dealIndex < dealCount; dealIndex += 1) {
    batches[dealIndex % workerCount].push(dealIndex);
  }

  let completed = 0;
  const nested = await Promise.all(batches.filter((batch) => batch.length).map((dealIndexes) => runWorker({
    dealIndexes,
    strongSamples,
    seed,
    onProgress: () => {
      completed += 1;
      onProgress?.(completed, dealCount);
    },
  })));

  return aggregateMatchedDeals({
    dealResults: nested.flat(),
    strongSamples,
    seed,
    confidenceResamples,
  });
}

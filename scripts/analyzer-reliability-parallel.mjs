import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

export function reliabilityWorkerCount(positionCount) {
  return Math.max(1, Math.min(positionCount, Math.max(1, availableParallelism() - 1), 8));
}

function runBatch(positions, options, onProgress, onResult, workerUrl) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: { positions, options },
    });
    let complete = false;
    let saveQueue = Promise.resolve();
    worker.on('message', (message) => {
      if (message.type === 'result') {
        onProgress?.(message.result.id);
        if (onResult) saveQueue = saveQueue.then(() => onResult(message.result));
      }
      if (message.type === 'complete') {
        complete = true;
        saveQueue.then(() => resolve(message.results), reject);
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Reliability worker exited with code ${code}.`));
      else if (!complete) reject(new Error('Reliability worker exited before returning results.'));
    });
  });
}

export async function evaluatePositionsParallel({
  positions,
  options,
  workerCount,
  onProgress,
  onResult,
  workerUrl,
}) {
  const count = workerCount ?? reliabilityWorkerCount(positions.length);
  const results = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(count, positions.length) }, async () => {
    while (nextIndex < positions.length) {
      const index = nextIndex;
      nextIndex += 1;
      const [result] = await runBatch(
        [positions[index]],
        options,
        onProgress,
        onResult,
        workerUrl,
      );
      results.push(result);
    }
  });
  await Promise.all(workers);
  return results.sort((left, right) => left.id.localeCompare(right.id));
}

export function evaluateReliabilityParallel(options) {
  return evaluatePositionsParallel({
    ...options,
    workerUrl: new URL('./analyzer-reliability-worker.mjs', import.meta.url),
  });
}

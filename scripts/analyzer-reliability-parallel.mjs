import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

export function reliabilityWorkerCount(positionCount) {
  return Math.max(1, Math.min(positionCount, Math.max(1, availableParallelism() - 1), 8));
}

function runBatch(positions, options, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analyzer-reliability-worker.mjs', import.meta.url), {
      workerData: { positions, options },
    });
    let complete = false;
    worker.on('message', (message) => {
      if (message.type === 'progress') onProgress?.(message.positionId);
      if (message.type === 'complete') {
        complete = true;
        resolve(message.results);
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Reliability worker exited with code ${code}.`));
      else if (!complete) reject(new Error('Reliability worker exited before returning results.'));
    });
  });
}

export async function evaluateReliabilityParallel({ positions, options, workerCount, onProgress }) {
  const count = workerCount ?? reliabilityWorkerCount(positions.length);
  const batches = Array.from({ length: count }, () => []);
  positions.forEach((position, index) => batches[index % count].push(position));
  const nested = await Promise.all(batches.filter((batch) => batch.length).map((batch) => (
    runBatch(batch, options, onProgress)
  )));
  return nested.flat().sort((left, right) => left.id.localeCompare(right.id));
}

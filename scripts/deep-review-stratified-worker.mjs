import { parentPort, workerData } from 'node:worker_threads';
import { evaluateDeepReviewStratifiedPosition } from './deep-review-stratified-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateDeepReviewStratifiedPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

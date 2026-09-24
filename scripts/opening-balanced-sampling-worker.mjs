import { parentPort, workerData } from 'node:worker_threads';
import { evaluateOpeningBalancedPosition } from './opening-balanced-sampling-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateOpeningBalancedPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

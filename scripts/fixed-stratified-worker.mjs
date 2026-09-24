import { parentPort, workerData } from 'node:worker_threads';
import { evaluateFixedStratifiedPosition } from './fixed-stratified-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateFixedStratifiedPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

import { parentPort, workerData } from 'node:worker_threads';
import { evaluateStratifiedSamplingPosition } from './stratified-sampling-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateStratifiedSamplingPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

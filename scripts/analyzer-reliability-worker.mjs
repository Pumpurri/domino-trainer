import { parentPort, workerData } from 'node:worker_threads';
import { evaluateReliabilityPosition } from './analyzer-reliability-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateReliabilityPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

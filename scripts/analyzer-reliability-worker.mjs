import { parentPort, workerData } from 'node:worker_threads';
import { evaluateReliabilityPosition } from './analyzer-reliability-core.mjs';

const results = [];
for (const position of workerData.positions) {
  results.push(evaluateReliabilityPosition(position, workerData.options));
  parentPort.postMessage({ type: 'progress', positionId: position.id });
}
parentPort.postMessage({ type: 'complete', results });

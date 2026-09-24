import { parentPort, workerData } from 'node:worker_threads';
import { evaluateRootRacingPosition } from './root-racing-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateRootRacingPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

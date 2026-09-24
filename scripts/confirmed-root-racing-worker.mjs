import { parentPort, workerData } from 'node:worker_threads';
import { evaluateConfirmedRootRacingPosition } from './confirmed-root-racing-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateConfirmedRootRacingPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

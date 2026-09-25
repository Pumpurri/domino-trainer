import { parentPort, workerData } from 'node:worker_threads';
import { evaluateTargetedConfirmationPosition } from './targeted-systematic-confirmation-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateTargetedConfirmationPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

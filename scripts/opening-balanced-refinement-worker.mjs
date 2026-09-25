import { parentPort, workerData } from 'node:worker_threads';
import { evaluateOpeningRefinementPosition } from './opening-balanced-refinement-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateOpeningRefinementPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

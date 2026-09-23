import { parentPort, workerData } from 'node:worker_threads';
import { evaluateSamplerAblationPosition } from './sampler-ablation-core.mjs';

const results = [];
for (const position of workerData.positions) {
  const result = await evaluateSamplerAblationPosition(position, workerData.options);
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

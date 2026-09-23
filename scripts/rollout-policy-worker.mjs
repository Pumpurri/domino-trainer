import { parentPort, workerData } from 'node:worker_threads';
import { runRolloutPolicyDeal } from './rollout-policy-core.mjs';

const results = [];
for (const dealIndex of workerData.positions) {
  const result = runRolloutPolicyDeal({ dealIndex, ...workerData.options });
  results.push(result);
  parentPort.postMessage({ type: 'result', result });
}
parentPort.postMessage({ type: 'complete', results });

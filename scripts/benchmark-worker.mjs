import { parentPort, workerData } from 'node:worker_threads';
import { runMatchedDeal } from './benchmark-core.mjs';

const dealResults = [];
for (const dealIndex of workerData.dealIndexes) {
  dealResults.push(runMatchedDeal({
    dealIndex,
    strongSamples: workerData.strongSamples,
    seed: workerData.seed,
  }));
  parentPort.postMessage({ type: 'progress' });
}

parentPort.postMessage({ type: 'complete', dealResults });

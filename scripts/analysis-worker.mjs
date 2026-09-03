import { parentPort, workerData } from 'node:worker_threads';
import { analyzeMoves } from '../app/domino-engine.ts';

const started = performance.now();
const ranked = analyzeMoves(
  workerData.game,
  workerData.sampleCount,
  workerData.beliefState,
  workerData.styles,
  workerData.options,
);

parentPort.postMessage({ ranked, elapsedMs: performance.now() - started });

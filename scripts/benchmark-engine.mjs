import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runMatchedBenchmark } from './benchmark-core.mjs';
import { defaultWorkerCount, runMatchedBenchmarkParallel } from './benchmark-parallel.mjs';
import { evaluateStrategicScenarios } from './strategic-scenarios.mjs';

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function positiveInteger(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

const quick = process.argv.includes('--quick');
const dealCount = positiveInteger(
  argument('deals') ?? process.env.MESA_BENCH_MATCHED_DEALS,
  quick ? 8 : 120,
  'Matched deal count',
);
const strongSamples = positiveInteger(
  argument('samples') ?? process.env.MESA_BENCH_SEARCH_SAMPLES,
  quick ? 30 : 80,
  'Strong search sample count',
);
const scenarioSamples = positiveInteger(
  argument('scenario-samples') ?? process.env.MESA_SCENARIO_SAMPLES,
  quick ? 80 : 400,
  'Scenario search sample count',
);
const confidenceResamples = positiveInteger(
  argument('confidence-resamples') ?? process.env.MESA_BENCH_CONFIDENCE_RESAMPLES,
  quick ? 400 : 2000,
  'Confidence resample count',
);
const seed = argument('seed') ?? process.env.MESA_BENCH_SEED ?? 'mesa-quince-matched-v1';
const jsonPath = argument('json');
const workerCount = positiveInteger(
  argument('workers') ?? process.env.MESA_BENCH_WORKERS,
  quick ? Math.min(2, defaultWorkerCount(dealCount)) : defaultWorkerCount(dealCount),
  'Worker count',
);

function percent(interval) {
  return `${(interval.rate * 100).toFixed(1)}% [${(interval.low * 100).toFixed(1)}, ${(interval.high * 100).toFixed(1)}]`;
}

function average(interval) {
  return `${interval.mean.toFixed(2)} [${interval.low.toFixed(2)}, ${interval.high.toFixed(2)}]`;
}

function printStrategySummary(result) {
  console.log('\nOVERALL PERFORMANCE');
  console.log('Strategy | Wins / appearances | Win rate (95% CI) | Avg end pips (95% CI) | Blocked win rate (95% CI)');
  console.log('--- | --- | --- | --- | ---');
  for (const strategy of ['random', 'casual', 'strong']) {
    const stats = result.strategies[strategy];
    console.log(`${strategy} | ${stats.wins}/${stats.appearances} | ${percent(stats.winRate)} | ${average(stats.averageEndPips)} | ${stats.blocked.wins}/${stats.blocked.appearances} ${percent(stats.blocked.winRate)}`);
  }
}

function printStartingPerformance(result) {
  console.log('\nSTARTING POSITION');
  console.log('Strategy | When starting | When not starting');
  console.log('--- | --- | ---');
  for (const strategy of ['random', 'casual', 'strong']) {
    const stats = result.strategies[strategy];
    console.log(`${strategy} | ${percent(stats.whenStarting.winRate)} (${stats.whenStarting.wins}/${stats.whenStarting.trials}) | ${percent(stats.whenNotStarting.winRate)} (${stats.whenNotStarting.wins}/${stats.whenNotStarting.trials})`);
  }
}

function printSeatMatrices(result) {
  console.log('\nSEAT AND STARTER MATRIX');
  console.log('Each cell is win rate [95% CI] (wins/trials). Rows are the strategy seat; columns are the starting seat.');
  for (const strategy of ['random', 'casual', 'strong']) {
    console.log(`\n${strategy.toUpperCase()}`);
    console.log('Strategy seat | Starter seat 0 | Starter seat 1 | Starter seat 2');
    console.log('--- | --- | --- | ---');
    result.strategies[strategy].bySeatAndStarter.forEach((row, seat) => {
      const cells = row.map((cell) => `${percent(cell.winRate)} (${cell.wins}/${cell.trials})`);
      console.log(`Seat ${seat} | ${cells.join(' | ')}`);
    });
  }
}

function printScenarios(scenarios) {
  console.log('\nDESIGNED STRATEGIC POSITIONS');
  console.log('Strategy | Correct choices');
  console.log('--- | ---');
  for (const strategy of ['random', 'casual', 'strong']) {
    const result = scenarios.strategies[strategy];
    console.log(`${strategy} | ${result.correct}/${result.total}`);
  }
  console.log('\nCase | Expected | Random | Casual | Strong');
  console.log('--- | --- | --- | --- | ---');
  for (let index = 0; index < scenarios.strategies.strong.cases.length; index += 1) {
    const random = scenarios.strategies.random.cases[index];
    const casual = scenarios.strategies.casual.cases[index];
    const strong = scenarios.strategies.strong.cases[index];
    const mark = (entry) => `${entry.correct ? 'PASS' : 'MISS'} ${entry.selected}`;
    console.log(`${strong.title} | ${strong.expected.join(' or ')} | ${mark(random)} | ${mark(casual)} | ${mark(strong)}`);
  }
}

console.log('MESA QUINCE MATCHED BENCHMARK');
console.log(`Seed: ${seed}`);
console.log(`Running ${dealCount} matched deals x 18 balanced replays = ${dealCount * 18} rounds.`);
console.log(`Strong search uses ${strongSamples} hidden-hand samples per decision.`);
console.log(`Using ${workerCount} worker ${workerCount === 1 ? 'thread' : 'threads'}.`);

const progressStep = Math.max(1, Math.floor(dealCount / 10));
const progress = (complete, total) => {
  if (complete === total || complete % progressStep === 0) console.log(`Progress: ${complete}/${total} matched deals`);
};
const result = workerCount === 1
  ? runMatchedBenchmark({ dealCount, strongSamples, seed, confidenceResamples, onProgress: progress })
  : await runMatchedBenchmarkParallel({ dealCount, strongSamples, seed, confidenceResamples, workerCount, onProgress: progress });
const scenarios = evaluateStrategicScenarios({ strongSamples: scenarioSamples });

console.log(`\nROUND OUTCOMES\n${result.outcomes.rounds} total | ${result.outcomes.empty} emptied-hand finishes | ${result.outcomes.blocked} blocked | ${result.outcomes.tied} tied`);
printStrategySummary(result);
printStartingPerformance(result);
printSeatMatrices(result);
printScenarios(scenarios);

if (jsonPath) {
  const destination = resolve(process.cwd(), jsonPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify({ generatedAt: new Date().toISOString(), result, scenarios }, null, 2)}\n`);
  console.log(`\nSaved machine-readable results to ${destination}`);
}

console.log('\nNOTES');
console.log('- Every deal is replayed with all six strategy-to-seat assignments and all three starting seats.');
console.log(`- Brackets show matched-deal 95% bootstrap intervals using ${confidenceResamples} resamples.`);
console.log('- Deals, rather than individual replays, are resampled so paired rounds are not incorrectly treated as independent.');
console.log(`- ${workerCount} worker ${workerCount === 1 ? 'thread was' : 'threads were'} used; deal-level seeding makes the result reproducible across worker counts.`);
console.log('- Strategic positions are explicit regression cases, not statistically sampled expert labels.');
console.log(`- Production Strong currently uses 500 samples. This run used ${strongSamples}; pass --samples=500 for production-equivalent search.`);

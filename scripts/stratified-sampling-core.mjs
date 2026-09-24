import {
  analyzeMoves,
  createBeliefState,
  engineTesting,
  legalMovesFor,
  seededRandom,
} from '../app/domino-engine.ts';
import {
  plausibleBestMoveKeys,
  runAdaptiveAnalysis,
} from '../app/adaptive-analysis.ts';
import {
  classifyAnalyzedChoice,
  informationSafeBenchmarkGame,
  particleCountForBudget,
} from './analyzer-reliability-core.mjs';
import {
  SAMPLER_ABLATION_GROUPS,
  collectSamplerAblationCorpus,
} from './sampler-ablation-core.mjs';

export const STRATIFIED_SAMPLING_VERSION = 'public-stratified-sampling-v1';
export const STRATIFIED_VARIANTS = ['systematic', 'public-stratified'];
export const STRATIFIED_GROUPS = [...SAMPLER_ABLATION_GROUPS];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

export function collectStratifiedSamplingCorpus(options = {}) {
  return collectSamplerAblationCorpus(options);
}

function beliefForBudget(game, budget, seedSalt) {
  let target = particleCountForBudget(budget);
  let belief;
  let retries = 0;
  for (; retries < 4; retries += 1) {
    belief = createBeliefState(game, 0, target, undefined, seedSalt);
    if (belief.particles.length >= budget) break;
    if (!belief.particles.length) break;
    target = Math.ceil(target * budget / belief.particles.length * 1.2);
  }
  if (!belief || belief.particles.length < budget) {
    throw new Error(`Could not sample ${budget} valid hidden deals for ${seedSalt}.`);
  }
  return { belief, target, retries };
}

function analyzeBelief(game, belief, target, budget, representativePolicy, rootCandidateKeys) {
  return analyzeMoves(game, target, belief, undefined, {
    representativeLimit: budget,
    representativePolicy,
    rootCandidateKeys,
  });
}

function independentAnalysis(game, budget, seedSalt, representativePolicy = 'systematic') {
  const sampled = beliefForBudget(game, budget, seedSalt);
  return {
    ...sampled,
    ranked: analyzeBelief(
      game,
      sampled.belief,
      sampled.target,
      budget,
      representativePolicy,
    ),
  };
}

function stageBatches(game, stages, seedSalt) {
  let previous = 0;
  const control = [];
  const candidate = [];
  let retries = 0;
  stages.forEach((target, stageIndex) => {
    const budget = target - previous;
    const sampled = beliefForBudget(game, budget, `${seedSalt}|stage-${stageIndex}|batch-${budget}`);
    retries += sampled.retries;
    control.push(analyzeBelief(game, sampled.belief, sampled.target, budget, 'systematic'));
    candidate.push(analyzeBelief(game, sampled.belief, sampled.target, budget, 'public-stratified'));
    previous = target;
  });
  return { control, candidate, retries };
}

async function replayAdaptive(position, stages, batches, recommendationPracticalGap) {
  return runAdaptiveAnalysis({
    stages,
    playedKey: position.playedKey,
    phase: position.phase,
    branching: position.branching,
    recommendationPracticalGap,
    analyzeBatch: (samples, stageIndex) => {
      const expected = stages[stageIndex] - (stages[stageIndex - 1] ?? 0);
      if (samples !== expected || !batches[stageIndex]) {
        throw new Error(`Adaptive replay requested an unexpected stage ${stageIndex}.`);
      }
      return batches[stageIndex];
    },
  });
}

function evaluatedVariant(adaptive, position, reference) {
  const topKey = moveKey(adaptive.ranked[0]);
  const referenceRate = reference.rates.get(topKey);
  if (referenceRate === undefined) throw new Error(`Reference analysis is missing ${topKey}.`);
  const choice = classifyAnalyzedChoice(adaptive.ranked, position.playedKey);
  return {
    topKey,
    samplesUsed: adaptive.samplesUsed,
    stopReason: adaptive.stopReason,
    exactTopAgreement: topKey === reference.topKey,
    acceptableTopAgreement: reference.acceptableKeys.includes(topKey),
    withinOnePoint: reference.bestRate - referenceRate <= 1,
    regret: Math.max(0, reference.bestRate - referenceRate),
    verdict: choice.verdict,
    mistakeLabelAgreement: choice.confidentMistake === reference.choice.confidentMistake,
    falsePositiveMistake: choice.confidentMistake && !reference.choice.confidentMistake,
  };
}

function stratumMasses(belief, game) {
  const total = belief.particles.reduce((sum, particle) => sum + particle.weight, 0);
  const masses = new Map();
  belief.particles.forEach((particle) => {
    const signature = engineTesting.publicParticleStratum(game, particle, 0);
    masses.set(signature, (masses.get(signature) ?? 0) + particle.weight / total);
  });
  return masses;
}

function representedMass(representatives, masses, game) {
  const signatures = new Set(representatives.map((particle) => (
    engineTesting.publicParticleStratum(game, particle, 0)
  )));
  return [...signatures].reduce((sum, signature) => sum + (masses.get(signature) ?? 0), 0);
}

function forensicAudit(game, reference, budget, seedSalt) {
  const sampled = beliefForBudget(game, budget, seedSalt);
  const keys = [reference.topKey, reference.runnerUpKey].filter(Boolean);
  const ranked = analyzeBelief(
    game,
    sampled.belief,
    sampled.target,
    budget,
    'public-stratified',
    keys,
  );
  const representatives = engineTesting.analysisRepresentatives(
    sampled.belief.particles,
    budget,
    game,
    0,
    'public-stratified',
  );
  const systematic = engineTesting.analysisRepresentatives(
    sampled.belief.particles,
    budget,
    game,
    0,
    'systematic',
  );
  const masses = stratumMasses(sampled.belief, game);
  const byKey = new Map(ranked.map((move) => [moveKey(move), move]));
  const top = byKey.get(reference.topKey);
  const alternative = byKey.get(reference.runnerUpKey);
  if (!top || !alternative) throw new Error('Forensic analysis is missing a reference move.');
  const rows = new Map();
  representatives.forEach((particle, index) => {
    const signature = engineTesting.publicParticleStratum(game, particle, 0);
    const row = rows.get(signature) ?? {
      signature,
      samples: 0,
      weight: 0,
      topWins: 0,
      alternativeWins: 0,
    };
    const weight = top.treeSearch.pairedBaseWeights[index];
    row.samples += 1;
    row.weight += weight;
    row.topWins += top.treeSearch.pairedBaseWins[index] * weight;
    row.alternativeWins += alternative.treeSearch.pairedBaseWins[index] * weight;
    rows.set(signature, row);
  });
  const totalWeight = [...rows.values()].reduce((sum, row) => sum + row.weight, 0);
  const strata = [...rows.values()].map((row) => {
    const posteriorMass = row.weight / totalWeight;
    const topWinRate = row.topWins / row.weight * 100;
    const alternativeWinRate = row.alternativeWins / row.weight * 100;
    const gap = topWinRate - alternativeWinRate;
    return {
      signature: row.signature,
      samples: row.samples,
      posteriorMass,
      topWinRate,
      alternativeWinRate,
      gap,
      contribution: posteriorMass * gap,
    };
  }).sort((left, right) => (
    Math.abs(right.contribution) - Math.abs(left.contribution)
    || left.signature.localeCompare(right.signature)
  ));
  const weightSum = representatives.reduce((sum, particle) => sum + particle.weight, 0);
  const squaredWeight = representatives.reduce((sum, particle) => sum + particle.weight ** 2, 0);
  return {
    budget,
    topKey: reference.topKey,
    alternativeKey: reference.runnerUpKey,
    poolStrata: masses.size,
    systematicRepresentedStrata: new Set(systematic.map((particle) => (
      engineTesting.publicParticleStratum(game, particle, 0)
    ))).size,
    stratifiedRepresentedStrata: new Set(representatives.map((particle) => (
      engineTesting.publicParticleStratum(game, particle, 0)
    ))).size,
    systematicMassCoverage: representedMass(systematic, masses, game),
    stratifiedMassCoverage: representedMass(representatives, masses, game),
    effectiveSamples: squaredWeight ? weightSum ** 2 / squaredWeight : 0,
    strata,
  };
}

export async function evaluateStratifiedSamplingPosition(position, {
  repetitions = 3,
  stages = [120, 250, 500, 1000, 2000],
  referenceBudget = 5000,
  forensicBudget = 500,
  recommendationPracticalGap = 1,
  seed = 'mesa-quince-stratified-sampling-v1',
} = {}) {
  const safeGame = informationSafeBenchmarkGame(position.game);
  const referenceAnalysis = independentAnalysis(
    safeGame,
    referenceBudget,
    `${seed}|${position.id}|reference`,
  );
  const referenceRanked = referenceAnalysis.ranked;
  const reference = {
    topKey: moveKey(referenceRanked[0]),
    runnerUpKey: moveKey(referenceRanked[1]),
    acceptableKeys: plausibleBestMoveKeys(
      referenceRanked,
      [referenceRanked],
      recommendationPracticalGap,
    ),
    rates: new Map(referenceRanked.map((move) => [moveKey(move), move.winRate])),
    bestRate: referenceRanked[0].winRate,
    choice: classifyAnalyzedChoice(referenceRanked, position.playedKey),
  };
  const trials = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const batches = stageBatches(
      safeGame,
      stages,
      `${seed}|${position.id}|repeat-${repetition}`,
    );
    const [control, candidate] = await Promise.all([
      replayAdaptive(position, stages, batches.control, recommendationPracticalGap),
      replayAdaptive(position, stages, batches.candidate, recommendationPracticalGap),
    ]);
    trials.push({
      repetition,
      variants: {
        systematic: evaluatedVariant(control, position, reference),
        'public-stratified': evaluatedVariant(candidate, position, reference),
      },
      selectionChanged: moveKey(control.ranked[0]) !== moveKey(candidate.ranked[0]),
      beliefRetries: batches.retries,
    });
  }
  return {
    id: position.id,
    group: position.group,
    phase: position.phase,
    branching: legalMovesFor(position.game.hands[0], position.game.chain).length,
    handSizes: position.game.hands.map((hand) => hand.length),
    eventCount: position.game.events.length,
    playedKey: position.playedKey,
    reference: {
      budget: referenceBudget,
      topKey: reference.topKey,
      runnerUpKey: reference.runnerUpKey,
      acceptableTopKeys: reference.acceptableKeys,
      verdict: reference.choice.verdict,
      confidentMistake: reference.choice.confidentMistake,
    },
    forensic: forensicAudit(
      safeGame,
      reference,
      forensicBudget,
      `${seed}|${position.id}|forensic`,
    ),
    trials,
  };
}

function percentile(sorted, probability) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function interval(values, seed, resamples) {
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  if (values.length < 2 || resamples <= 0) return { mean, low: mean, high: mean };
  const random = seededRandom(seed);
  const estimates = [];
  for (let sample = 0; sample < resamples; sample += 1) {
    let total = 0;
    for (let draw = 0; draw < values.length; draw += 1) {
      total += values[Math.floor(random() * values.length)];
    }
    estimates.push(total / values.length);
  }
  estimates.sort((left, right) => left - right);
  return { mean, low: percentile(estimates, 0.025), high: percentile(estimates, 0.975) };
}

function summarizeVariant(positions, variant, seed, resamples) {
  const metric = (label, read) => interval(positions.map((position) => {
    const values = position.trials.map((trial) => read(trial.variants[variant]));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }), `${seed}|${variant}|${label}`, resamples);
  const allSamples = positions.flatMap((position) => (
    position.trials.map((trial) => trial.variants[variant].samplesUsed)
  ));
  return {
    exactTopAgreement: metric('exact-top', (trial) => trial.exactTopAgreement ? 1 : 0),
    acceptableTopAgreement: metric('acceptable-top', (trial) => trial.acceptableTopAgreement ? 1 : 0),
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    mistakeLabelAgreement: metric('label', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistake: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    repeatAcceptability: interval(positions.map((position) => (
      position.trials.every((trial) => trial.variants[variant].withinOnePoint) ? 1 : 0
    )), `${seed}|${variant}|repeat`, resamples),
    samplesUsed: {
      mean: allSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, allSamples.length),
      p95: percentile([...allSamples].sort((left, right) => left - right), 0.95),
    },
  };
}

function pairedEffect(positions, candidate, control, seed, resamples) {
  const metric = (label, read) => interval(positions.map((position) => {
    const differences = position.trials.map((trial) => (
      read(trial.variants[candidate]) - read(trial.variants[control])
    ));
    return differences.reduce((sum, value) => sum + value, 0) / differences.length;
  }), `${seed}|effect|${label}`, resamples);
  return {
    withinOnePoint: metric('within-one', (trial) => trial.withinOnePoint ? 1 : 0),
    meanRegret: metric('regret', (trial) => trial.regret),
    mistakeLabelAgreement: metric('label', (trial) => trial.mistakeLabelAgreement ? 1 : 0),
    falsePositiveMistake: metric('false-positive', (trial) => trial.falsePositiveMistake ? 1 : 0),
    samplesUsed: metric('samples', (trial) => trial.samplesUsed),
    repeatAcceptability: interval(positions.map((position) => {
      const candidateValue = position.trials.every((trial) => trial.variants[candidate].withinOnePoint) ? 1 : 0;
      const controlValue = position.trials.every((trial) => trial.variants[control].withinOnePoint) ? 1 : 0;
      return candidateValue - controlValue;
    }), `${seed}|effect|repeat`, resamples),
  };
}

function developmentGate(summary) {
  const effect = summary.effect;
  const checks = {
    exercised: summary.selectionChangeRate.mean >= 0.05,
    repeatAcceptabilityImproves: effect.repeatAcceptability.mean > 0,
    regretImproves: effect.meanRegret.mean < 0,
    falsePositivesDoNotIncrease: effect.falsePositiveMistake.mean <= 0,
    labelAgreementPreserved: effect.mistakeLabelAgreement.mean >= -0.01,
    samplesDoNotIncrease: effect.samplesUsed.mean <= 0,
    openingPreserved: summary.byGroup['opening-high'].effect.withinOnePoint.mean >= -0.02
      && summary.byGroup['opening-high'].effect.meanRegret.mean <= 0.03
      && summary.byGroup['opening-high'].effect.repeatAcceptability.mean >= -0.03,
    middlePreserved: summary.byGroup['middle-wide'].effect.withinOnePoint.mean >= -0.02
      && summary.byGroup['middle-wide'].effect.meanRegret.mean <= 0.03
      && summary.byGroup['middle-wide'].effect.repeatAcceptability.mean >= -0.03,
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function summarizeStratifiedSampling(positions, {
  seed = 'mesa-quince-stratified-sampling-v1',
  confidenceResamples = 1000,
} = {}) {
  const summarize = (subset, label) => ({
    positions: subset.length,
    variants: Object.fromEntries(STRATIFIED_VARIANTS.map((variant) => [
      variant,
      summarizeVariant(subset, variant, `${seed}|${label}`, confidenceResamples),
    ])),
    effect: pairedEffect(
      subset,
      'public-stratified',
      'systematic',
      `${seed}|${label}`,
      confidenceResamples,
    ),
  });
  const overall = summarize(positions, 'overall');
  const summary = {
    version: STRATIFIED_SAMPLING_VERSION,
    positions: positions.length,
    overall,
    effect: overall.effect,
    byGroup: Object.fromEntries(STRATIFIED_GROUPS.map((group) => [
      group,
      summarize(positions.filter((position) => position.group === group), group),
    ])),
    selectionChangeRate: interval(positions.map((position) => (
      position.trials.filter((trial) => trial.selectionChanged).length / position.trials.length
    )), `${seed}|selection-change`, confidenceResamples),
    forensic: {
      meanPoolStrata: positions.reduce((sum, position) => sum + position.forensic.poolStrata, 0) / Math.max(1, positions.length),
      meanSystematicMassCoverage: positions.reduce((sum, position) => sum + position.forensic.systematicMassCoverage, 0) / Math.max(1, positions.length),
      meanStratifiedMassCoverage: positions.reduce((sum, position) => sum + position.forensic.stratifiedMassCoverage, 0) / Math.max(1, positions.length),
      meanEffectiveSamples: positions.reduce((sum, position) => sum + position.forensic.effectiveSamples, 0) / Math.max(1, positions.length),
    },
  };
  summary.gate = developmentGate(summary);
  return summary;
}

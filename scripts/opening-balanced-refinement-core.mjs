import {
  collectOpeningBalancedCorpus,
  evaluateOpeningBalancedPosition,
  summarizeOpeningBalanced,
} from './opening-balanced-sampling-core.mjs';

export const OPENING_REFINEMENT_VERSION = 'opening-balanced-refinement-development-v2';
export const OPENING_REFINEMENT_CONTROL = 'systematic';
export const OPENING_REFINEMENT_CANDIDATES = [
  'opening-response-balanced-10',
  'opening-response-balanced-20',
  'opening-response-balanced-25',
];
export const OPENING_REFINEMENT_VARIANTS = [
  OPENING_REFINEMENT_CONTROL,
  ...OPENING_REFINEMENT_CANDIDATES,
];
export const OPENING_REFINEMENT_EFFECTIVE_SAMPLE_RATIO = 0.95;

export function collectOpeningRefinementCorpus(options = {}) {
  return collectOpeningBalancedCorpus({
    positions: options.positions ?? 36,
    minimumBranching: options.minimumBranching ?? 6,
    seed: options.seed ?? 'mesa-quince-opening-balanced-refinement-v2',
    maxDeals: options.maxDeals,
  });
}

export function evaluateOpeningRefinementPosition(position, options = {}) {
  return evaluateOpeningBalancedPosition(position, {
    ...options,
    seed: options.seed ?? 'mesa-quince-opening-balanced-refinement-v2',
    variants: OPENING_REFINEMENT_VARIANTS,
  });
}

export function summarizeOpeningRefinement(positions, options = {}) {
  return summarizeOpeningBalanced(positions, {
    ...options,
    seed: options.seed ?? 'mesa-quince-opening-balanced-refinement-v2',
    version: OPENING_REFINEMENT_VERSION,
    candidates: OPENING_REFINEMENT_CANDIDATES,
    minimumEffectiveSampleRatio: OPENING_REFINEMENT_EFFECTIVE_SAMPLE_RATIO,
  });
}

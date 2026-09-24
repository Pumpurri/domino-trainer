# Mesa Quince Deep Review-only middle stratification holdout

Generated: 2026-09-24T07:39:39.244Z

## Locked protocol

- Version: deep-review-middle-stratified-v1
- Seed: mesa-quince-deep-review-stratified-v1
- Fresh difficult middle positions: 100
- Minimum middle branching: 4
- Non-middle safety positions: 20 per phase
- Middle repetitions: 5
- Fixed Deep Review budget: 500
- Independent references: 5000 systematic plus 5000 stratified samples
- Workers: 9

Every paired middle trial gives both samplers the same independently generated belief pool, and evaluation order alternates. Recommendations are scored under two separately seeded high-budget references so neither representative policy supplies the sole target. Opening, late, and likely-block safety positions route the candidate to the current systematic sampler and must reuse the exact control analysis. Real opponent hands and sleeping tiles are removed before belief generation.

The candidate must pass every locked check: at least 5% selection changes, improved repeat acceptability, lower average two-reference regret, a robust-regret upper interval no worse than 0.10 point, worst-reference regret no more than 0.05 point worse, within-one-point-under-both no more than one percentage point worse, no increase in false accusations, label agreement no more than one point worse, at least 95% weighted effective samples, no more than 20% mean paired runtime overhead, exact 500-sample budgets, and zero non-middle routing differences.

Overall result: **FAIL**

Reference top-move agreement: **87.0% [80.0, 93.0]**

Selection change rate: **20.8% [16.6, 25.4]**

## Middle-game results

| Variant | Within 1 point under both | Robust regret | Worst regret | Repeat acceptable | Repeat top | Label agreement | False positives | Effective samples | Mean ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current systematic Deep Review | 79.0% [74.0, 83.8] | 0.463 [0.368, 0.562] | 0.609 [0.478, 0.744] | 47.0% [38.0, 57.0] | 44.0% [34.0, 54.0] | 88.5% [84.1, 92.7] | 5.0% [2.8, 7.6] | 500.0 | 4021 |
| Middle-only stratified Deep Review | 80.8% [76.4, 85.2] | 0.427 [0.337, 0.528] | 0.547 [0.434, 0.669] | 47.0% [37.0, 57.0] | 43.0% [34.0, 53.0] | 89.5% [84.9, 93.7] | 3.6% [1.6, 6.0] | 495.9 | 4019 |

## Candidate minus control effects

Positive deltas favor the candidate for within-both quality, repeat acceptability, and label agreement. Negative deltas favor the candidate for regret, false positives, and runtime.

| Within both | Robust regret | Worst regret | Repeat acceptable | Label agreement | False positives | Effective samples | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1.8% [-1.8, 5.6] | -0.036 [-0.144, 0.069] | -0.061 [-0.177, 0.053] | 0.0% [-9.0, 9.0] | 1.0% [-1.4, 3.2] | -1.4% [-2.8, 0.0] | -4.142 [-4.830, -3.460] | -0.3% [-1.0, 0.5] |

## Locked gate

| Check | Result |
| --- | --- |
| exercised | PASS |
| repeatAcceptabilityImproves | FAIL |
| robustRegretImproves | PASS |
| robustRegretBounded | PASS |
| worstRegretNoninferior | PASS |
| withinBothNoninferior | PASS |
| falsePositivesDoNotIncrease | PASS |
| labelAgreementPreserved | PASS |
| effectiveSamplesPreserved | PASS |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |
| nonMiddleUnchanged | PASS |

## Non-middle safety

- Opening positions: 20
- Late positions: 20
- Likely-block positions: 20
- Exact routing mismatches: 0

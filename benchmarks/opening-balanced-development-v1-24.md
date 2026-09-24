# Mesa Quince opening-balanced sampling development study

Generated: 2026-09-24T23:55:42.930Z

## Locked protocol

- Version: opening-balanced-sampling-development-v1
- Seed: mesa-quince-opening-balanced-development-v1
- Fresh difficult opening positions: 24
- Minimum legal moves: 6
- Independent repetitions: 5
- Fixed samples per legal move: 120
- Independent references: 2 × 5000 samples
- Workers: 9

All variants use the same belief pool within each repetition. Candidate proposals use only plausible belief particles and public or player-known information. Importance weights correct proposal sampling back to the posterior. Real opponent hands and sleeping tiles are removed before belief generation.

Overall result: **FAIL**

Selected candidate: **none**

| Variant | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Effective samples | Mean ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Systematic control | 44.2% [32.5, 56.7] | 1.908 [1.495, 2.340] | 4.2% [0.0, 12.5] | 4.2% [0.0, 12.5] | 69.2% [55.8, 80.8] | 5.8% [1.7, 10.8] | 120.0 | 5707 |
| Response balanced 35% | 52.5% [41.7, 63.3] | 1.706 [1.417, 1.980] | 4.2% [0.0, 12.5] | 0.0% [0.0, 0.0] | 63.3% [49.2, 76.7] | 5.8% [1.7, 11.7] | 113.3 | 5671 |
| Response balanced 60% | 47.5% [39.2, 55.8] | 2.530 [2.079, 3.014] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 61.7% [46.7, 76.7] | 4.2% [1.6, 7.5] | 102.9 | 5627 |
| Response plus return balanced 35% | 47.5% [36.7, 57.5] | 1.856 [1.494, 2.263] | 4.2% [0.0, 12.5] | 4.2% [0.0, 12.5] | 59.2% [43.3, 74.2] | 8.3% [2.5, 15.0] | 113.8 | 5690 |
| Response plus return balanced 60% | 44.2% [35.8, 52.5] | 2.405 [1.879, 3.000] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 63.3% [49.1, 77.5] | 4.2% [0.8, 7.5] | 104.1 | 5659 |

## Response balanced 35%: FAIL

Selection change rate: **70.0% [60.8, 79.2]**

| Within 1 point delta | Mean regret delta | Repeat acceptable delta | Label delta | False-positive delta | Effective-sample delta | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8.3% [-1.7, 17.5] | -0.202 [-0.641, 0.208] | 0.0% [-12.5, 12.5] | -5.8% [-16.7, 3.3] | -0.0% [-5.0, 4.2] | -6.662 [-6.960, -6.339] | -0.6% [-1.1, -0.1] |

| Gate check | Result |
| --- | --- |
| exercised | PASS |
| withinOnePointImproves | PASS |
| regretImproves | PASS |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | FAIL |
| falsePositivesDoNotIncrease | PASS |
| effectiveSamplesPreserved | PASS |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |

## Response balanced 60%: FAIL

Selection change rate: **75.0% [66.7, 83.3]**

| Within 1 point delta | Mean regret delta | Repeat acceptable delta | Label delta | False-positive delta | Effective-sample delta | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3.3% [-7.5, 15.0] | 0.621 [0.033, 1.257] | -4.2% [-12.5, 0.0] | -7.5% [-16.7, 1.7] | -1.7% [-6.7, 2.5] | -17.117 [-17.849, -16.414] | -1.4% [-2.0, -0.8] |

| Gate check | Result |
| --- | --- |
| exercised | PASS |
| withinOnePointImproves | PASS |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | FAIL |
| falsePositivesDoNotIncrease | PASS |
| effectiveSamplesPreserved | FAIL |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |

## Response plus return balanced 35%: FAIL

Selection change rate: **70.0% [60.8, 78.3]**

| Within 1 point delta | Mean regret delta | Repeat acceptable delta | Label delta | False-positive delta | Effective-sample delta | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3.3% [-10.0, 15.8] | -0.052 [-0.664, 0.589] | 0.0% [-12.5, 12.5] | -10.0% [-20.8, -0.8] | 2.5% [-3.3, 8.3] | -6.186 [-6.494, -5.883] | -0.3% [-0.8, 0.3] |

| Gate check | Result |
| --- | --- |
| exercised | PASS |
| withinOnePointImproves | PASS |
| regretImproves | PASS |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | FAIL |
| falsePositivesDoNotIncrease | FAIL |
| effectiveSamplesPreserved | PASS |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |

## Response plus return balanced 60%: FAIL

Selection change rate: **70.0% [60.0, 77.5]**

| Within 1 point delta | Mean regret delta | Repeat acceptable delta | Label delta | False-positive delta | Effective-sample delta | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.0% [-12.5, 12.5] | 0.496 [-0.242, 1.273] | -4.2% [-12.5, 0.0] | -5.8% [-15.0, 2.5] | -1.7% [-7.5, 2.5] | -15.932 [-16.646, -15.161] | -0.9% [-1.3, -0.4] |

| Gate check | Result |
| --- | --- |
| exercised | PASS |
| withinOnePointImproves | FAIL |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | FAIL |
| falsePositivesDoNotIncrease | PASS |
| effectiveSamplesPreserved | FAIL |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |

## Decision

No candidate advances to holdout validation, and the live coach remains unchanged.

Response balancing at 35% was the strongest candidate. It improved within-one-point quality by 8.3 percentage points and reduced mean regret by 0.202 points while retaining 113.3 effective samples and slightly reducing runtime. It failed because mistake-label agreement declined by 5.8 percentage points, outside the locked 1-point tolerance. Its quality confidence intervals also crossed zero, so this development result is promising rather than conclusive.

The 60% variants sacrificed too much effective sample size and did not improve regret. Adding the return-path category did not help and increased false-positive mistake labels at 35% strength. Future work should keep the response-only 35% proposal as an experimental recommendation selector while investigating a separately confirmed, systematic-evidence label path. That design requires a new predeclared protocol and fresh data rather than changing this gate after observing the result.

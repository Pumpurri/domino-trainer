# Mesa Quince opening-balanced refinement development study

Generated: 2026-09-25T03:31:29.940Z

## Locked protocol

- Version: opening-balanced-refinement-development-v2
- Seed: mesa-quince-opening-balanced-refinement-v2
- Fresh difficult opening positions: 36
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
| Systematic control | 67.8% [57.2, 76.7] | 1.369 [1.010, 1.713] | 30.6% [16.7, 47.2] | 22.2% [8.3, 36.1] | 63.9% [52.8, 75.6] | 0.6% [0.0, 1.7] | 120.0 | 13133 |
| Response balanced 10% | 67.8% [58.3, 76.7] | 1.428 [0.991, 1.831] | 25.0% [11.1, 39.0] | 25.0% [11.1, 38.9] | 60.0% [48.3, 71.7] | 2.2% [0.0, 5.0] | 119.3 | 13224 |
| Response balanced 20% | 67.8% [58.9, 76.1] | 1.439 [1.080, 1.867] | 25.0% [11.1, 38.9] | 22.2% [8.3, 36.1] | 62.8% [50.0, 74.4] | 1.1% [0.0, 2.8] | 117.6 | 13101 |
| Response balanced 25% | 65.0% [56.7, 72.8] | 1.685 [1.283, 2.109] | 16.7% [5.6, 30.6] | 13.9% [2.8, 27.8] | 62.2% [50.0, 73.9] | 2.2% [0.6, 4.4] | 116.4 | 13035 |

## Response balanced 10%: FAIL

Selection change rate: **40.0% [31.1, 49.4]**

| Within 1 point delta | Mean regret delta | Repeat acceptable delta | Label delta | False-positive delta | Effective-sample delta | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| -0.0% [-7.2, 7.2] | 0.059 [-0.385, 0.530] | -5.6% [-19.4, 8.3] | -3.9% [-11.1, 1.7] | 1.7% [0.0, 4.4] | -0.694 [-0.733, -0.661] | 0.7% [-0.3, 1.7] |

| Gate check | Result |
| --- | --- |
| exercised | PASS |
| withinOnePointImproves | FAIL |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | FAIL |
| falsePositivesDoNotIncrease | FAIL |
| effectiveSamplesPreserved | PASS |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |

## Response balanced 20%: FAIL

Selection change rate: **49.4% [38.3, 60.6]**

| Within 1 point delta | Mean regret delta | Repeat acceptable delta | Label delta | False-positive delta | Effective-sample delta | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.0% [-8.3, 7.8] | 0.071 [-0.440, 0.547] | -5.6% [-19.4, 8.3] | -1.1% [-6.7, 5.0] | 0.6% [0.0, 1.7] | -2.446 [-2.549, -2.352] | -0.4% [-1.8, 1.0] |

| Gate check | Result |
| --- | --- |
| exercised | PASS |
| withinOnePointImproves | FAIL |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | FAIL |
| falsePositivesDoNotIncrease | FAIL |
| effectiveSamplesPreserved | PASS |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |

## Response balanced 25%: FAIL

Selection change rate: **50.0% [40.6, 58.9]**

| Within 1 point delta | Mean regret delta | Repeat acceptable delta | Label delta | False-positive delta | Effective-sample delta | Runtime ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| -2.8% [-10.0, 5.0] | 0.317 [-0.166, 0.813] | -13.9% [-30.6, 2.8] | -1.7% [-7.8, 5.0] | 1.7% [0.0, 3.9] | -3.639 [-3.787, -3.510] | -0.8% [-2.0, 0.3] |

| Gate check | Result |
| --- | --- |
| exercised | PASS |
| withinOnePointImproves | FAIL |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | FAIL |
| falsePositivesDoNotIncrease | FAIL |
| effectiveSamplesPreserved | PASS |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |

## Decision

No candidate advances to holdout validation, and the live coach remains unchanged.

The 10% candidate preserved within-one-point quality but increased mean regret by 0.059, reduced repeat acceptability by 5.6 percentage points, reduced mistake-label agreement by 3.9 points, and increased false-positive mistake calls by 1.7 points. The 20% candidate produced the same within-one-point rate but also increased regret and false positives. The 25% candidate was worse on recommendation quality and repeatability.

All three candidates preserved the stricter 95% effective-sample floor and controlled runtime, so the failure is strategic rather than computational. Combined with the first study, the fresh evidence does not support response-balanced opening sampling at a fixed 120-sample budget. Further tuning of this balance-strength family should stop. Future opening work should retain systematic sampling and investigate targeted confirmation or a different search policy under a separately locked protocol.

# Mesa Quince targeted systematic confirmation study

Generated: 2026-09-28T16:38:17.098Z

## Locked protocol

- Version: targeted-systematic-confirmation-development-v1
- Seed: mesa-quince-targeted-confirmation-v1
- Fresh difficult opening positions: 24
- Minimum legal moves: 6
- Independent repetitions: 5
- Base systematic samples per move: 120
- Close-decision trigger: initial top-two gap at most 3 points
- Fresh confirmation budgets: 40, 80, 120
- Independent references: two runs of 5000 samples
- Workers: 9

Every legal move first receives the same 120 systematic samples. On a close decision, only the initial top two moves and the player's actual move receive fresh confirmation evidence. The player's move cannot influence which moves are eligible for the recommendation. It is included only so the coaching label compares the recommendation and played move using equal evidence. Confirmation variants share one belief pool but use nested prefixes, so larger budgets strictly add evidence instead of changing earlier samples.

Real opponent hands and sleeping tiles are removed before belief generation. Independent reference top moves agreed on 20/24 positions.

Overall result: **FAIL**

Selected candidate: **none**

Close-decision trigger rate: **44.2% [35.0, 54.2]**

| Policy | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Selected samples | Mean overhead | Mean ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current 120 | 65.0% [53.3, 75.0] | 1.653 [1.183, 2.166] | 20.8% [8.3, 37.5] | 16.7% [4.2, 33.3] | 65.0% [48.3, 79.2] | 5.0% [1.7, 9.2] | 120.0 | 0.0% [0.0, 0.0] | 10639 |
| 120 + targeted 40 | 65.0% [54.2, 75.0] | 1.672 [1.162, 2.164] | 20.8% [8.2, 37.5] | 16.7% [4.2, 33.3] | 65.0% [49.2, 80.0] | 5.8% [1.7, 10.8] | 137.7 | 4.1% [3.1, 5.1] | 11058 |
| 120 + targeted 80 | 69.2% [57.5, 80.8] | 1.294 [0.838, 1.772] | 37.5% [16.7, 58.3] | 25.0% [8.3, 45.8] | 65.0% [50.0, 80.0] | 5.8% [1.7, 10.8] | 155.3 | 8.2% [6.1, 10.4] | 11440 |
| 120 + targeted 120 | 72.5% [60.8, 83.3] | 1.126 [0.706, 1.544] | 37.5% [20.8, 58.3] | 25.0% [8.3, 41.7] | 65.8% [50.0, 80.0] | 5.8% [2.5, 10.8] | 173.0 | 12.3% [9.4, 15.5] | 11844 |

## 120 + targeted 40: FAIL

Recommendation change rate: **14.2% [6.7, 22.5]**

- Triggered trials: 53/120
- Reference-best misses within triggered trials: 11/53
- Reference-best coverage within triggered trials: 79.2% [66.0, 90.9]
- False-positive transitions: 1 added, 0 removed

| Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0.0% [-5.8, 5.0] | 0.019 [-0.226, 0.295] | 0.0% [0.0, 0.0] | 0.0% [-2.5, 2.5] | 0.8% [0.0, 2.5] | 17.667 [13.658, 21.333] |

| Gate check | Result |
| --- | --- |
| closeDecisionsExercised | PASS |
| recommendationChanges | PASS |
| withinOnePointImproves | PASS |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | FAIL |
| referenceBestCoverage | FAIL |
| selectedEvidenceIncreases | PASS |
| overheadControlled | PASS |
| exactAndEqualDecisionEvidence | PASS |

## 120 + targeted 80: FAIL

Recommendation change rate: **13.3% [6.7, 21.7]**

- Triggered trials: 53/120
- Reference-best misses within triggered trials: 11/53
- Reference-best coverage within triggered trials: 79.2% [65.9, 90.0]
- False-positive transitions: 1 added, 0 removed

| Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 4.2% [-2.5, 10.8] | -0.359 [-0.810, 0.012] | 16.7% [4.2, 33.3] | 0.0% [-2.5, 2.5] | 0.8% [0.0, 2.5] | 35.333 [28.000, 43.350] |

| Gate check | Result |
| --- | --- |
| closeDecisionsExercised | PASS |
| recommendationChanges | PASS |
| withinOnePointImproves | PASS |
| regretImproves | PASS |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | FAIL |
| referenceBestCoverage | FAIL |
| selectedEvidenceIncreases | PASS |
| overheadControlled | PASS |
| exactAndEqualDecisionEvidence | PASS |

## 120 + targeted 120: FAIL

Recommendation change rate: **15.0% [8.3, 22.5]**

- Triggered trials: 53/120
- Reference-best misses within triggered trials: 11/53
- Reference-best coverage within triggered trials: 79.2% [66.7, 90.0]
- False-positive transitions: 1 added, 0 removed

| Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 7.5% [0.8, 15.0] | -0.527 [-0.991, -0.122] | 16.7% [4.2, 33.3] | 0.8% [-2.5, 5.0] | 0.8% [0.0, 2.5] | 53.000 [41.000, 65.000] |

| Gate check | Result |
| --- | --- |
| closeDecisionsExercised | PASS |
| recommendationChanges | PASS |
| withinOnePointImproves | PASS |
| regretImproves | PASS |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | FAIL |
| referenceBestCoverage | FAIL |
| selectedEvidenceIncreases | PASS |
| overheadControlled | PASS |
| exactAndEqualDecisionEvidence | PASS |

A passing candidate still requires a fresh holdout and direct live-latency validation before changing the coach.

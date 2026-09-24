# Mesa Quince confirmed root-racing development study

Generated: 2026-09-24T21:50:40.018Z

## Locked protocol

- Version: confirmed-root-racing-development-v2
- Seed: mesa-quince-confirmed-root-racing-development-v2
- Fresh difficult opening positions: 24
- Minimum legal moves: 6
- Independent repetitions: 5
- Current recommendation budget: 120 samples per legal move
- Comparison ceiling: 500 samples per legal move
- Independent references: two runs of 5000 samples per position
- Workers: 9
- Initial evidence: 40 samples per move
- Fresh confirmation: 20 samples for provisional eliminations and their leader

The policy is eligible only during openings with at least six legal moves. Middle, late, and block phases retain the current analyzer exactly. Every move receives the initial paired evidence. A move can be eliminated only if the initial stage marks it dominated and a fresh confirmation batch independently keeps the same leader ahead. The recommendation always spends exactly the current total root budget, and every finalist retains at least 120 samples.

If the player chooses an eliminated move, post-decision analysis extends that move to 120 paired samples before issuing a mistake label. That confirmation does not influence the earlier recommendation and its mean overhead must remain at most 2% of the recommendation budget.

Each saved repetition contains the common particle weights and every move's 500 paired outcomes. Future threshold studies can replay this evidence without rerunning simulations or changing the reference.

Real opponent hands and sleeping tiles are removed before belief generation. Independent reference top moves agreed on 20/24 positions.

## Result: **FAIL**

| Policy | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Selected samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current 120 | 63.3% [52.5, 74.2] | 1.504 [1.061, 1.949] | 20.8% [8.2, 37.5] | 16.7% [4.2, 33.3] | 53.3% [39.2, 67.5] | 4.2% [0.8, 8.3] | 120.0 |
| Confirmed race-40 | 65.0% [54.2, 75.0] | 1.402 [1.022, 1.788] | 20.8% [4.2, 37.5] | 16.7% [4.2, 33.3] | 54.2% [38.3, 68.3] | 3.3% [0.0, 7.5] | 124.7 |
| 500 ceiling | 80.0% [71.7, 87.5] | 0.541 [0.356, 0.750] | 41.7% [25.0, 62.5] | 33.3% [16.7, 50.0] | 75.8% [62.5, 88.3] | 4.2% [0.0, 10.8] | 500.0 |

## Candidate minus current 120

| Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1.7% [0.0, 4.2] | -0.101 [-0.280, 0.002] | 0.0% [0.0, 0.0] | 0.8% [0.0, 2.5] | -0.8% [-2.5, 0.0] | 4.725 [2.791, 7.075] |

- Recommendation changes: 2.5% [0.0, 5.0]
- Reference-best survival: 99.2% [97.5, 100.0]
- Minimum finalist samples: 124.7
- Mean post-decision overhead: 0.1% [0.0, 0.3]

## Locked checks

| Check | Result |
| --- | --- |
| exercised | FAIL |
| referenceBestSurvival | PASS |
| withinOnePointImproves | PASS |
| regretImproves | PASS |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | PASS |
| effectiveSamplesIncrease | PASS |
| finalistsKeepCurrentEvidenceFloor | PASS |
| exactRecommendationBudget | PASS |
| postDecisionOverheadControlled | PASS |

Passing selects the frozen candidate for direct runtime measurement and a fresh holdout. It does not change the live coach by itself.

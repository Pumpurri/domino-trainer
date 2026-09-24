# Mesa Quince paired root-racing development study

Generated: 2026-09-24T21:09:11.670Z

## Locked protocol

- Version: paired-root-racing-development-v1
- Seed: mesa-quince-root-racing-development-v1
- Difficult opening positions: 24
- Middle-game safety positions: 12
- Independent repetitions: 5
- Current budget: 120 samples per legal move
- Comparison ceiling: 500 samples per legal move
- Independent references: two runs of 5000 samples per position
- Workers: 9
- Candidates: race-40 (40 initial samples), race-60 (60 initial samples), race-80 (80 initial samples)

Each candidate spends exactly the current analyzer's total root-evaluation budget. Every legal move receives the initial paired sample. A move is eliminated only when it is outside the protected top three, its paired 95% interval clears a one-point practical gap, its estimated deficit is at least three points, and its mini-batches agree. Saved evaluations are redistributed among survivors. All policies replay the same independently generated belief pool, and real hidden hands are removed before sampling.

This development study can select a candidate for a new locked holdout. It cannot release a live policy. Offline replay establishes quality and exact compute counts, but a selected candidate still needs direct runtime measurement, a fresh stress holdout, balanced safety validation, and matched self-play.

Independent reference top moves agreed on 33/36 positions.

Advancing candidates: **none**

Overall development gate: **FAIL**

## middle-safety

| Candidate | Within 1 point | Regret | Repeat acceptable | Ref best survives | Selected samples | Changes vs 120 | Gate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| race-40 | 61.7% [45.0, 75.0] | 1.292 [0.766, 1.815] | 16.7% [0.0, 41.7] | 98.3% [95.0, 100.0] | 127.4 | 3.3% [0.0, 8.3] | FAIL |
| race-60 | 63.3% [48.3, 78.3] | 1.226 [0.726, 1.791] | 16.7% [0.0, 41.7] | 100.0% [100.0, 100.0] | 126.8 | 1.7% [0.0, 5.0] | FAIL |
| race-80 | 61.7% [46.7, 76.7] | 1.299 [0.803, 1.815] | 16.7% [0.0, 41.7] | 100.0% [100.0, 100.0] | 126.7 | 3.3% [0.0, 8.3] | FAIL |

### Candidate minus current 120-sample effects

Positive quality deltas and negative regret or false-positive deltas favor root racing.

| Candidate | Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| race-40 | -3.3% [-8.3, 0.0] | 0.275 [0.000, 0.695] | -8.3% [-25.0, 0.0] | 3.3% [-3.3, 11.7] | 0.0% [0.0, 0.0] | 7.367 [3.700, 11.602] |
| race-60 | -1.7% [-5.0, 0.0] | 0.210 [0.000, 0.629] | -8.3% [-25.0, 0.0] | 1.7% [0.0, 5.0] | 0.0% [0.0, 0.0] | 6.833 [2.667, 11.500] |
| race-80 | -3.3% [-8.3, 0.0] | 0.283 [0.000, 0.702] | -8.3% [-25.0, 0.0] | 1.7% [0.0, 5.0] | 0.0% [0.0, 0.0] | 6.717 [4.433, 8.918] |

### race-40 locked checks

| Check | Result |
| --- | --- |
| exercised | FAIL |
| referenceBestSurvival | PASS |
| withinOnePointImproves | FAIL |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | PASS |
| effectiveSamplesIncrease | PASS |
| exactRootBudget | PASS |

### race-60 locked checks

| Check | Result |
| --- | --- |
| exercised | FAIL |
| referenceBestSurvival | PASS |
| withinOnePointImproves | FAIL |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | PASS |
| effectiveSamplesIncrease | PASS |
| exactRootBudget | PASS |

### race-80 locked checks

| Check | Result |
| --- | --- |
| exercised | FAIL |
| referenceBestSurvival | PASS |
| withinOnePointImproves | FAIL |
| regretImproves | FAIL |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | PASS |
| effectiveSamplesIncrease | PASS |
| exactRootBudget | PASS |

## opening-high

| Candidate | Within 1 point | Regret | Repeat acceptable | Ref best survives | Selected samples | Changes vs 120 | Gate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| race-40 | 63.3% [51.7, 74.2] | 1.564 [1.110, 2.012] | 20.8% [8.3, 37.5] | 97.5% [95.0, 100.0] | 149.4 | 16.7% [10.0, 23.3] | FAIL |
| race-60 | 55.0% [43.3, 66.7] | 1.956 [1.479, 2.412] | 12.5% [0.0, 29.2] | 96.7% [93.3, 99.2] | 145.7 | 15.8% [10.0, 23.3] | FAIL |
| race-80 | 54.2% [42.5, 65.8] | 2.114 [1.581, 2.656] | 12.5% [0.0, 29.2] | 96.7% [93.3, 99.2] | 142.0 | 14.2% [7.5, 21.7] | FAIL |

### Candidate minus current 120-sample effects

Positive quality deltas and negative regret or false-positive deltas favor root racing.

| Candidate | Within-1 delta | Regret delta | Repeat delta | Label delta | False-positive delta | Effective-sample delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| race-40 | 10.0% [5.8, 15.0] | -0.588 [-0.921, -0.285] | 12.5% [0.0, 25.0] | 0.8% [-3.3, 5.8] | 1.7% [0.0, 4.2] | 29.392 [22.547, 37.094] |
| race-60 | 1.7% [-2.5, 5.8] | -0.196 [-0.533, 0.101] | 4.2% [-8.3, 16.7] | 0.8% [-4.2, 5.8] | 0.8% [0.0, 2.5] | 25.675 [19.224, 32.442] |
| race-80 | 0.8% [-2.5, 5.0] | -0.038 [-0.348, 0.247] | 4.2% [-8.3, 20.8] | -0.8% [-6.7, 5.0] | 1.7% [0.0, 4.2] | 21.983 [17.015, 27.027] |

### race-40 locked checks

| Check | Result |
| --- | --- |
| exercised | PASS |
| referenceBestSurvival | FAIL |
| withinOnePointImproves | PASS |
| regretImproves | PASS |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | FAIL |
| effectiveSamplesIncrease | PASS |
| exactRootBudget | PASS |

### race-60 locked checks

| Check | Result |
| --- | --- |
| exercised | PASS |
| referenceBestSurvival | FAIL |
| withinOnePointImproves | PASS |
| regretImproves | PASS |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | FAIL |
| effectiveSamplesIncrease | PASS |
| exactRootBudget | PASS |

### race-80 locked checks

| Check | Result |
| --- | --- |
| exercised | PASS |
| referenceBestSurvival | FAIL |
| withinOnePointImproves | PASS |
| regretImproves | PASS |
| repeatAcceptabilityNoninferior | PASS |
| labelsPreserved | PASS |
| falsePositivesDoNotIncrease | FAIL |
| effectiveSamplesIncrease | PASS |
| exactRootBudget | PASS |

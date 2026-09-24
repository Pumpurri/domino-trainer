# Mesa Quince fixed-budget middle-game stratification study

Generated: 2026-09-24T06:02:25.799Z

## Locked protocol

- Version: fixed-middle-stratified-v1
- Seed: mesa-quince-fixed-stratified-middle-v1
- Fresh difficult middle-game positions: 60
- Minimum legal moves: 4
- Independent repetitions per budget: 5
- Fixed budgets: 120, 500
- Independent reference: 5000 samples
- Workers: 9

At each repetition and budget, both samplers receive the same independently generated belief pool. Evaluation order alternates by position, repetition, and budget. Every result must contain exactly the requested number of root samples. Real opponent hands and sleeping tiles are removed before belief generation.

Each budget must independently pass every locked check: at least 5% of recommendations change, repeat acceptability improves, mean regret declines, within-one-point quality falls by no more than one percentage point, false-positive mistake calls do not increase, label agreement falls by no more than one point, weighted effective samples remain at least 95% of nominal, mean paired runtime rises by no more than 20%, and every trial uses the exact fixed budget.

Passing both budgets selects middle-only stratification for a fresh balanced 200-position validation. It does not change the live coach directly.

Overall result: **FAIL**

## 120-sample budget

Selection change rate: **44.3% [36.7, 52.0]**

| Variant | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Effective samples | Mean ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current systematic sampler | 75.7% [69.3, 81.7] | 0.847 [0.639, 1.091] | 38.3% [26.7, 51.7] | 28.3% [16.7, 40.0] | 85.3% [77.7, 92.7] | 2.0% [0.7, 3.7] | 120.0 | 3109 |
| Public-information stratified sampler | 72.3% [66.0, 79.0] | 1.070 [0.811, 1.328] | 33.3% [21.7, 45.0] | 21.7% [11.7, 31.7] | 84.7% [76.7, 91.7] | 2.3% [0.3, 4.3] | 112.2 | 3387 |

### Candidate minus control effects

Positive deltas favor the candidate for within-one-point quality, repeat acceptability, label agreement, and effective samples. Negative deltas favor the candidate for regret, false positives, and runtime.

| Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Effective samples | Runtime ratio | Mean ms delta |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| -3.3% [-9.3, 2.7] | 0.224 [-0.056, 0.504] | -5.0% [-16.7, 8.3] | -0.7% [-5.0, 2.7] | 0.3% [-2.3, 3.0] | -7.842 [-9.439, -6.220] | 44.5% [1.0, 109.2] | 278 [-2633, 2802] |

### Locked gate: FAIL

| Check | Result |
| --- | --- |
| exercised | PASS |
| repeatAcceptabilityImproves | FAIL |
| regretImproves | FAIL |
| withinOnePointNoninferior | FAIL |
| falsePositivesDoNotIncrease | FAIL |
| labelAgreementPreserved | PASS |
| effectiveSamplesPreserved | FAIL |
| runtimeControlled | FAIL |
| exactSampleBudget | PASS |

## 500-sample budget

Selection change rate: **20.7% [15.0, 26.0]**

| Variant | Within 1 point | Mean regret | Repeat acceptable | Repeat top | Label agreement | False positives | Effective samples | Mean ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current systematic sampler | 87.3% [82.3, 92.0] | 0.384 [0.260, 0.519] | 61.7% [50.0, 73.3] | 41.7% [30.0, 53.3] | 91.3% [86.3, 95.7] | 2.7% [1.0, 4.7] | 500.0 | 13842 |
| Public-information stratified sampler | 88.7% [84.3, 92.7] | 0.363 [0.241, 0.500] | 65.0% [53.3, 76.7] | 48.3% [36.7, 60.0] | 90.3% [84.7, 95.0] | 2.3% [0.7, 4.3] | 496.5 | 10571 |

### Candidate minus control effects

Positive deltas favor the candidate for within-one-point quality, repeat acceptability, label agreement, and effective samples. Negative deltas favor the candidate for regret, false positives, and runtime.

| Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Effective samples | Runtime ratio | Mean ms delta |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1.3% [-2.3, 6.0] | -0.021 [-0.132, 0.085] | 3.3% [-6.7, 13.3] | -1.0% [-4.0, 1.7] | -0.3% [-2.0, 1.3] | -3.539 [-4.432, -2.736] | 6.1% [-10.4, 29.2] | -3271 [-7991, 1501] |

### Locked gate: PASS

| Check | Result |
| --- | --- |
| exercised | PASS |
| repeatAcceptabilityImproves | PASS |
| regretImproves | PASS |
| withinOnePointNoninferior | PASS |
| falsePositivesDoNotIncrease | PASS |
| labelAgreementPreserved | PASS |
| effectiveSamplesPreserved | PASS |
| runtimeControlled | PASS |
| exactSampleBudget | PASS |

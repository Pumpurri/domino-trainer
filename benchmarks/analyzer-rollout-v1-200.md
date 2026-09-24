# Mesa Quince exhaustive-rollout analyzer study

Generated: 2026-09-24T01:40:20.004Z

## Configuration

- Version: `analyzer-rollout-v1`
- Positions: 200, balanced as 50 opening, 50 middle, 50 late, 50 block
- Repetitions per analyzer: 3
- Adaptive stages: 120, 250, 500, 1000, 2000
- Independent reference samples per policy: 5000
- Confidence resamples: 1000
- Worker threads: 9
- Seed: `mesa-quince-analyzer-rollout-v1`

The current and exhaustive analyzers receive identical information-safe hidden-deal samples at every adaptive stage. Each is scored against its own independently sampled high-budget reference. To avoid favoring either model, the promotion gate also scores both selected moves under both high-budget references and requires the candidate to improve or tie their average regret. The earlier 8,640-round self-play diagnostic provides the independent strategic-performance signal.

Opponent hands and sleeping tiles are replaced with placeholders before either analyzer runs. The realized hidden deal is used only by the small exact-endgame diagnostic.

## Result

Promotion gate: **FAIL**

Exhaustive forecasting failed at least one locked check and must remain outside the live analyzer.

High-budget reference agreement: 98.0% [96.0, 99.5]

## Overall quality

| Analyzer | Within 1 point | Mean own-reference regret | Mistake-label agreement | False positives | Repeat acceptable | Mean samples | Mean time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current rollout | 94.2% [92.0, 96.3] | 0.151 [0.110, 0.198] | 94.2% [91.2, 96.8] | 0.7% [0.0, 1.7] | 86.0% [81.0, 90.5] | 1758.333 [1695.833, 1820.000] | 15512 ms |
| Exhaustive forecast | 93.5% [91.3, 95.7] | 0.152 [0.109, 0.202] | 94.0% [91.3, 96.7] | 0.2% [0.0, 0.5] | 85.0% [80.0, 90.0] | 1758.333 [1694.979, 1819.167] | 17441 ms |

## Paired comparison

| Changed choices | Own within-1 difference | Own regret difference | Robust two-reference regret difference | Worst-reference regret difference | Within 1 under both references | Sample difference | Runtime difference |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3.8% [2.2, 5.7] | -0.7 pp [-2.2, 0.7] | +0.002 [-0.025, 0.031] | +0.004 [-0.020, 0.033] | +0.005 [-0.022, 0.031] | -0.2 pp [-1.5, 1.2] | +0.000 [-7.500, 8.333] | +1928.484 [1389.543, 2530.805] ms |

Positive percentage differences favor exhaustive forecasting. Negative regret differences favor exhaustive forecasting.

## Promotion gate

| Check | Result |
| --- | --- |
| changesDecisions | FAIL |
| withinOnePointTarget | PASS |
| meanRegretTarget | PASS |
| mistakeLabelAgreementTarget | FAIL |
| falsePositiveTarget | PASS |
| repeatAcceptabilityTarget | FAIL |
| ownWithinOneNoninferior | PASS |
| ownRegretNoninferior | PASS |
| repeatAcceptabilityNoninferior | FAIL |
| labelsPreserved | FAIL |
| falseAccusationsPreserved | PASS |
| robustRegretImproves | FAIL |
| robustRegretUpperBound | PASS |
| crossReferenceAcceptability | PASS |
| phaseRobustness | PASS |
| exactOraclePreserved | PASS |
| sampleUseControlled | PASS |
| runtimeControlled | PASS |

## Results by phase

### opening

Reference agreement: 96.0% [90.0, 100.0]

| Analyzer | Within 1 point | Mean own-reference regret | Mistake-label agreement | False positives | Repeat acceptable | Mean samples | Mean time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current rollout | 92.0% [86.7, 96.0] | 0.182 [0.113, 0.269] | 90.7% [82.7, 97.3] | 1.3% [0.0, 4.0] | 80.0% [70.0, 90.0] | 1980.000 [1960.000, 2000.000] | 45856 ms |
| Exhaustive forecast | 90.7% [85.3, 95.3] | 0.200 [0.111, 0.307] | 88.7% [80.7, 96.0] | 0.7% [0.0, 2.0] | 78.0% [66.0, 88.0] | 1986.667 [1966.667, 2000.000] | 52498 ms |

| Changed choices | Own within-1 difference | Own regret difference | Robust two-reference regret difference | Worst-reference regret difference | Within 1 under both references | Sample difference | Runtime difference |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 6.0% [2.0, 10.7] | -1.3 pp [-5.3, 2.7] | +0.018 [-0.039, 0.085] | +0.008 [-0.042, 0.077] | +0.009 [-0.049, 0.080] | +0.7 pp [-2.7, 4.0] | +6.667 [0.000, 20.000] | +6641.299 [5016.157, 8434.253] ms |

### middle

Reference agreement: 98.0% [94.0, 100.0]

| Analyzer | Within 1 point | Mean own-reference regret | Mistake-label agreement | False positives | Repeat acceptable | Mean samples | Mean time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current rollout | 93.3% [87.3, 97.3] | 0.177 [0.083, 0.293] | 92.0% [84.7, 98.0] | 1.3% [0.0, 4.0] | 84.0% [74.0, 94.0] | 1866.667 [1786.667, 1933.333] | 9741 ms |
| Exhaustive forecast | 92.0% [85.3, 97.3] | 0.187 [0.081, 0.306] | 93.3% [86.7, 98.7] | 0.0% [0.0, 0.0] | 82.0% [72.0, 92.0] | 1880.000 [1800.000, 1946.833] | 10452 ms |

| Changed choices | Own within-1 difference | Own regret difference | Robust two-reference regret difference | Worst-reference regret difference | Within 1 under both references | Sample difference | Runtime difference |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 7.3% [3.3, 12.7] | -1.3 pp [-5.3, 2.7] | +0.010 [-0.081, 0.104] | +0.016 [-0.065, 0.103] | +0.017 [-0.064, 0.109] | -1.3 pp [-5.3, 2.7] | +13.333 [0.000, 33.333] | +710.457 [521.145, 940.043] ms |

### late

Reference agreement: 100.0% [100.0, 100.0]

| Analyzer | Within 1 point | Mean own-reference regret | Mistake-label agreement | False positives | Repeat acceptable | Mean samples | Mean time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current rollout | 96.0% [92.0, 99.3] | 0.108 [0.039, 0.204] | 97.3% [93.3, 100.0] | 0.0% [0.0, 0.0] | 92.0% [84.0, 98.0] | 1620.000 [1486.583, 1760.000] | 1850 ms |
| Exhaustive forecast | 96.0% [91.3, 99.3] | 0.101 [0.030, 0.208] | 97.3% [93.3, 100.0] | 0.0% [0.0, 0.0] | 92.0% [84.0, 98.0] | 1606.667 [1449.917, 1743.333] | 1858 ms |

| Changed choices | Own within-1 difference | Own regret difference | Robust two-reference regret difference | Worst-reference regret difference | Within 1 under both references | Sample difference | Runtime difference |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1.3% [0.0, 4.0] | +0.0 pp [0.0, 0.0] | -0.007 [-0.019, 0.000] | -0.004 [-0.013, 0.000] | -0.005 [-0.014, 0.000] | +0.0 pp [0.0, 0.0] | -13.333 [-30.083, 0.000] | +8.102 [-15.349, 30.070] ms |

### block

Reference agreement: 98.0% [94.0, 100.0]

| Analyzer | Within 1 point | Mean own-reference regret | Mistake-label agreement | False positives | Repeat acceptable | Mean samples | Mean time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Current rollout | 95.3% [91.3, 98.7] | 0.136 [0.074, 0.210] | 96.7% [91.3, 100.0] | 0.0% [0.0, 0.0] | 88.0% [78.0, 96.0] | 1566.667 [1389.917, 1723.333] | 4602 ms |
| Exhaustive forecast | 95.3% [91.3, 98.7] | 0.121 [0.059, 0.193] | 96.7% [91.3, 100.0] | 0.0% [0.0, 0.0] | 88.0% [78.0, 96.0] | 1560.000 [1393.333, 1710.083] | 4956 ms |

| Changed choices | Own within-1 difference | Own regret difference | Robust two-reference regret difference | Worst-reference regret difference | Within 1 under both references | Sample difference | Runtime difference |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.7% [0.0, 2.0] | +0.0 pp [0.0, 0.0] | -0.015 [-0.031, -0.002] | -0.002 [-0.007, 0.000] | -0.003 [-0.008, 0.000] | +0.0 pp [0.0, 0.0] | -6.667 [-20.000, 0.000] | +354.078 [96.905, 821.724] ms |

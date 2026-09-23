# Mesa Quince rollout-policy diagnostic

Generated: 2026-09-23T23:51:06.453Z

## Configuration

- Version: `rollout-policy-diagnostic-v1`
- Deals: 120
- Rounds per deal: 72
- Total rounds: 8640
- Policies: current, exhaustive-forecast, mixed, stochastic-top-two
- Worker threads: 9
- Confidence resamples: 2000
- Seed: `mesa-quince-rollout-policy-v1`

Every deal is replayed for every three-policy combination, every seat permutation, and every starter. Each policy therefore receives the same number of appearances in every seat and starting position. Policies may inspect only their own hand, public events, hand sizes, proven voids, and the open ends.

This is a development diagnostic, not a live-coach release study. The selected direction is **Exhaustive Forecast**. It may advance only to a separately seeded analyzer experiment.

## Overall results

| Policy | Win rate | Average end pips | Average losing pips | Blocked win rate | Decisions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current | 32.73% [31.82, 33.67] | 17.03 [16.25, 17.85] | 21.54 [20.60, 22.52] | 32.06% [30.86, 33.36] | 35022 |
| Exhaustive Forecast | 34.40% [33.30, 35.46] | 16.89 [16.09, 17.68] | 21.81 [20.88, 22.78] | 34.00% [32.74, 35.30] | 35108 |
| Mixed | 33.10% [32.19, 34.01] | 17.01 [16.24, 17.83] | 21.73 [20.82, 22.75] | 32.68% [31.60, 33.82] | 35127 |
| Stochastic Top Two | 29.24% [28.12, 30.39] | 18.32 [17.55, 19.13] | 22.73 [21.86, 23.61] | 28.98% [27.63, 30.31] | 34132 |

## Paired differences from the current rollout

| Candidate | Overall win difference | Blocked win difference | Losing-pip difference | Opening | Middle | Late | Block | Gate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Exhaustive Forecast | +1.67 pp [0.08, 3.29] | +1.94 pp [-0.03, 3.94] | +0.26 [-0.14, 0.69] | +1.75 pp [0.18, 3.36] | +1.52 pp [-0.27, 3.24] | +1.42 pp [-0.44, 3.37] | +1.52 pp [-0.74, 3.75] | PASS |
| Mixed | +0.37 pp [-0.97, 1.77] | +0.61 pp [-1.17, 2.42] | +0.18 [-0.16, 0.57] | +0.36 pp [-1.13, 1.75] | +0.18 pp [-1.33, 1.60] | +0.55 pp [-1.30, 2.40] | +1.16 pp [-1.02, 3.38] | FAIL |
| Stochastic Top Two | -3.49 pp [-5.20, -1.70] | -3.08 pp [-5.16, -1.11] | +1.18 [0.73, 1.64] | -3.57 pp [-5.32, -1.89] | -3.65 pp [-5.37, -1.89] | -3.03 pp [-5.09, -1.01] | -3.58 pp [-6.89, -0.34] | FAIL |

Positive win-rate differences favor the candidate. Negative losing-pip differences favor the candidate.

## Diagnostic gates

| Candidate | Check | Result |
| --- | --- | --- |
| Exhaustive Forecast | overallDirection | PASS |
| Exhaustive Forecast | overallNoninferior | PASS |
| Exhaustive Forecast | blockedNoninferior | PASS |
| Exhaustive Forecast | losingPipsNoninferior | PASS |
| Exhaustive Forecast | phaseNoninferior | PASS |
| Exhaustive Forecast | strategicSignal | PASS |
| Mixed | overallDirection | PASS |
| Mixed | overallNoninferior | PASS |
| Mixed | blockedNoninferior | PASS |
| Mixed | losingPipsNoninferior | PASS |
| Mixed | phaseNoninferior | PASS |
| Mixed | strategicSignal | FAIL |
| Stochastic Top Two | overallDirection | FAIL |
| Stochastic Top Two | overallNoninferior | FAIL |
| Stochastic Top Two | blockedNoninferior | FAIL |
| Stochastic Top Two | losingPipsNoninferior | FAIL |
| Stochastic Top Two | phaseNoninferior | FAIL |
| Stochastic Top Two | strategicSignal | FAIL |

## Results by strategic phase

### opening

| Policy | Eligible rounds | Decisions | Conditional win rate |
| --- | ---: | ---: | ---: |
| Current | 6357 | 13448 | 33.02% [32.03, 34.03] |
| Exhaustive Forecast | 6359 | 13451 | 34.77% [33.62, 35.91] |
| Mixed | 6361 | 13517 | 33.38% [32.43, 34.32] |
| Stochastic Top Two | 6361 | 13375 | 29.45% [28.30, 30.56] |

### middle

| Policy | Eligible rounds | Decisions | Conditional win rate |
| --- | ---: | ---: | ---: |
| Current | 6117 | 12070 | 33.59% [32.52, 34.73] |
| Exhaustive Forecast | 6105 | 12134 | 35.12% [33.90, 36.38] |
| Mixed | 6100 | 12134 | 33.77% [32.70, 34.79] |
| Stochastic Top Two | 6061 | 11745 | 29.95% [28.84, 31.05] |

### late

| Policy | Eligible rounds | Decisions | Conditional win rate |
| --- | ---: | ---: | ---: |
| Current | 4245 | 6161 | 34.02% [32.68, 35.41] |
| Exhaustive Forecast | 4253 | 6226 | 35.43% [33.80, 36.98] |
| Mixed | 4255 | 6232 | 34.57% [33.10, 36.06] |
| Stochastic Top Two | 4154 | 5987 | 30.98% [29.41, 32.52] |

### block

| Policy | Eligible rounds | Decisions | Conditional win rate |
| --- | ---: | ---: | ---: |
| Current | 2558 | 3343 | 41.87% [39.62, 44.24] |
| Exhaustive Forecast | 2526 | 3297 | 43.39% [40.98, 45.89] |
| Mixed | 2524 | 3244 | 43.03% [40.79, 45.20] |
| Stochastic Top Two | 2400 | 3025 | 38.29% [35.98, 40.60] |

Phase win rates are conditional on rounds in which that policy faced at least one multi-move decision in the named phase. Complete deals, not individual decisions or rounds, are resampled for confidence intervals.

# Mesa Quince adaptive analyzer reliability study

Generated: 2026-09-23T00:32:56.505Z

## Configuration

- 400 positions: 100 opening, 100 middle, 100 late, 100 block
- 3 independent repetitions per analyzer
- Fixed budgets: 120, 500, 2000
- Adaptive stages: 120, 250, 500, 1000, 2000
- Recommendation equivalence gap: 1 point(s)
- Mistake practical gap: 0.5 point(s)
- Mistake minimum estimated loss: 3 point(s)
- Mistake batch agreement: 60%
- Mistake practical batch agreement: 50%
- Independent reference: 5000 samples
- Worker threads: 9
- Seed: `mesa-quince-adaptive-v3-holdout-v1`
- Adaptive implementation: `adaptive-confirmed-v3-labels`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Conclusion

The adaptive analyzer **failed the release gate** and must remain outside the live coach. It matched or improved fixed 2000 on the combined near-optimality, regret, and repeatability comparison. It used 11.8% fewer paired samples and 1.9% less mean wall time, while its false-positive mistake rate changed by -1.17 percentage points.

The sampler allocated more computation to harder decisions: reference-unclear positions used 1.19 times as many samples as reference-clear positions. Its median stopping budget was 2000, 72.3% of recommendations ended uncertain, and 23.7% of coaching labels abstained. Failed release checks: mistakeLabelAgreement, repeatAcceptability.

This adaptive sampler widens uncertainty when independent batches disagree, requires a fresh confirmation batch before early stopping, delays decisions according to phase and legal-move count, and treats statistically equivalent moves as one plausible-best set. Recommendation confidence and mistake confidence are separate, so the coach can abstain from a mistake label even when it still offers a tentative move.

## Overall results

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 73.1% [70.1, 75.8] | 89.0% [87.0, 91.0] | 80.2% [77.5, 82.7] | 0.72 [0.63, 0.83] | 85.8% [82.6, 88.7] | 2.3% [1.5, 3.3] | 11.9% [8.9, 14.8] | 0.0% [0.0, 0.0] | 85.8% [82.8, 88.7] | 57.8% [53.0, 63.0] | 51.2% [46.5, 56.0] | 1105 / 4998 ms |
| Fixed 500 | 82.5% [79.8, 85.2] | 96.6% [95.3, 97.7] | 90.4% [88.4, 92.3] | 0.27 [0.22, 0.32] | 93.2% [91.3, 94.8] | 1.8% [1.1, 2.6] | 5.0% [3.4, 6.7] | 0.0% [0.0, 0.0] | 93.2% [91.3, 94.9] | 78.3% [74.2, 82.3] | 67.5% [62.5, 72.3] | 4430 / 17954 ms |
| Fixed 2000 | 87.6% [85.1, 90.0] | 99.3% [98.8, 99.8] | 95.2% [93.6, 96.6] | 0.12 [0.10, 0.15] | 95.8% [94.3, 97.1] | 2.4% [1.4, 3.6] | 1.8% [0.8, 2.8] | 0.0% [0.0, 0.0] | 95.8% [94.4, 97.2] | 89.0% [85.8, 92.3] | 80.5% [76.8, 84.3] | 28417 / 69597 ms |
| Adaptive | 87.8% [85.4, 90.2] | 99.3% [98.7, 99.8] | 94.9% [93.3, 96.4] | 0.13 [0.10, 0.16] | 93.7% [91.8, 95.6] | 1.3% [0.5, 2.1] | 5.1% [3.5, 6.9] | 23.7% [20.3, 27.1] | 97.3% [95.8, 98.9] | 88.8% [85.8, 91.8] | 100.0% [100.0, 100.0] | 27882 / 72814 ms |

## Adaptive computation

- Mean samples: 1764.58 [1719.58, 1805.83]
- Median samples: 2000
- P95 samples: 2000
- Maximum samples: 2000
- Hard-cap rate: 72.3% [68.4, 76.2]
- Uncertain-at-stop rate: 72.3% [68.4, 76.1]
- Mean plausible-best set size: 1.73 [1.65, 1.81]
- Coaching-label abstention rate: 23.7% [20.3, 27.1]
- Accuracy among non-abstained coaching labels: 97.3% [95.8, 98.9]
- Mean samples on reference-clear positions: 1680.84 [1624.70, 1734.69]
- Mean samples on reference-unclear positions: 1996.86 [1990.57, 2000.00]

| Stopping stage | Trials | Share |
| ---: | ---: | ---: |
| 500 | 109 | 9.1% |
| 1000 | 119 | 9.9% |
| 2000 | 972 | 81.0% |

## Release gate

Adaptive result: **FAIL**

| Check | Result |
| --- | --- |
| corpusSize | PASS |
| withinOnePoint | PASS |
| meanRegret | PASS |
| mistakeLabelAgreement | FAIL |
| falsePositiveMistakes | PASS |
| repeatAcceptability | FAIL |
| withinOnePointNoninferior | PASS |
| meanRegretNoninferior | PASS |
| repeatAcceptabilityNoninferior | PASS |
| recommendationSetStability | PASS |
| sampleSavings | PASS |

## Results by phase

### opening

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 59.0% [52.7, 65.3] | 87.0% [82.7, 91.0] | 72.7% [66.7, 78.0] | 0.99 [0.78, 1.21] | 79.0% [71.7, 85.7] | 2.3% [1.0, 4.3] | 18.7% [12.0, 26.0] | 0.0% [0.0, 0.0] | 79.0% [71.7, 85.3] | 44.0% [35.0, 54.0] | 29.0% [20.0, 38.0] | 3436 / 12169 ms |
| Fixed 500 | 71.3% [65.0, 77.7] | 96.3% [93.7, 98.7] | 86.3% [82.0, 90.3] | 0.37 [0.28, 0.48] | 89.0% [84.3, 93.3] | 2.0% [0.7, 3.7] | 9.0% [5.0, 13.7] | 0.0% [0.0, 0.0] | 89.0% [84.3, 93.3] | 69.0% [60.0, 78.0] | 51.0% [42.0, 61.0] | 14036 / 45794 ms |
| Fixed 2000 | 74.7% [67.7, 81.3] | 99.0% [97.7, 100.0] | 90.3% [86.0, 94.3] | 0.25 [0.18, 0.33] | 94.3% [90.7, 97.3] | 3.0% [1.0, 5.7] | 2.7% [0.7, 5.3] | 0.0% [0.0, 0.0] | 94.3% [90.7, 97.3] | 79.0% [71.0, 87.0] | 65.0% [55.0, 74.0] | 100539 / 190224 ms |
| Adaptive | 78.0% [72.0, 83.7] | 99.3% [98.3, 100.0] | 91.3% [87.3, 95.0] | 0.20 [0.14, 0.27] | 89.0% [83.7, 94.0] | 1.0% [0.0, 2.7] | 10.0% [5.3, 15.3] | 39.3% [31.3, 46.7] | 98.1% [95.0, 100.0] | 81.0% [73.0, 88.0] | 100.0% [100.0, 100.0] | 96074 / 135642 ms |

### middle

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 73.3% [68.0, 78.7] | 87.0% [82.7, 91.3] | 78.0% [72.7, 83.0] | 0.84 [0.62, 1.06] | 89.7% [83.7, 95.0] | 2.0% [0.3, 4.0] | 8.3% [3.3, 14.3] | 0.0% [0.0, 0.0] | 89.7% [84.0, 94.7] | 53.0% [43.0, 62.0] | 46.0% [36.0, 56.0] | 695 / 1546 ms |
| Fixed 500 | 85.3% [79.7, 90.3] | 96.3% [93.3, 98.7] | 90.7% [86.0, 94.7] | 0.27 [0.16, 0.39] | 93.0% [89.3, 96.3] | 3.0% [1.0, 5.7] | 4.0% [1.3, 7.0] | 0.0% [0.0, 0.0] | 93.0% [89.3, 96.0] | 79.0% [70.0, 87.0] | 73.0% [64.0, 81.0] | 2622 / 5641 ms |
| Fixed 2000 | 90.7% [86.3, 94.7] | 99.0% [98.0, 100.0] | 95.7% [92.7, 98.0] | 0.11 [0.06, 0.17] | 95.3% [92.0, 98.0] | 2.0% [0.3, 4.0] | 2.7% [0.7, 5.7] | 0.0% [0.0, 0.0] | 95.3% [92.0, 98.3] | 90.0% [84.0, 96.0] | 82.0% [74.0, 89.0] | 9382 / 19112 ms |
| Adaptive | 90.7% [86.7, 94.3] | 98.7% [96.7, 100.0] | 94.7% [91.3, 97.3] | 0.14 [0.08, 0.22] | 94.0% [90.3, 97.0] | 2.3% [0.3, 4.7] | 3.7% [1.3, 6.3] | 20.3% [14.3, 26.7] | 95.7% [91.4, 98.9] | 87.0% [80.0, 93.0] | 100.0% [100.0, 100.0] | 10183 / 21938 ms |

### late

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 82.0% [76.0, 87.0] | 90.0% [85.7, 94.0] | 86.0% [81.3, 90.3] | 0.56 [0.38, 0.75] | 82.3% [75.7, 88.3] | 3.7% [1.7, 5.7] | 14.0% [7.7, 20.7] | 0.0% [0.0, 0.0] | 82.3% [76.0, 88.7] | 69.0% [60.0, 78.0] | 67.0% [58.0, 76.0] | 113 / 258 ms |
| Fixed 500 | 88.0% [83.7, 92.0] | 96.3% [94.3, 98.3] | 91.7% [88.0, 95.0] | 0.22 [0.14, 0.31] | 95.3% [92.0, 98.0] | 0.7% [0.0, 1.7] | 4.0% [1.3, 7.0] | 0.0% [0.0, 0.0] | 95.3% [92.0, 98.0] | 81.0% [73.0, 88.0] | 73.0% [64.0, 82.0] | 404 / 906 ms |
| Fixed 2000 | 95.7% [92.7, 98.3] | 100.0% [100.0, 100.0] | 98.7% [96.7, 100.0] | 0.03 [0.01, 0.06] | 96.7% [94.0, 99.0] | 2.7% [0.7, 5.3] | 0.7% [0.0, 1.7] | 0.0% [0.0, 0.0] | 96.7% [94.0, 99.0] | 97.0% [93.0, 100.0] | 92.0% [86.0, 97.0] | 1394 / 3203 ms |
| Adaptive | 94.7% [91.0, 97.7] | 99.7% [99.0, 100.0] | 98.3% [96.7, 99.7] | 0.05 [0.02, 0.09] | 95.3% [92.0, 98.3] | 0.7% [0.0, 1.7] | 4.0% [1.3, 7.7] | 14.3% [9.0, 20.3] | 97.9% [94.7, 100.0] | 96.0% [92.0, 99.0] | 100.0% [100.0, 100.0] | 2116 / 4149 ms |

### block

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 78.0% [72.0, 83.7] | 92.0% [88.3, 95.0] | 84.0% [78.7, 88.7] | 0.51 [0.37, 0.66] | 92.0% [87.0, 96.3] | 1.3% [0.3, 2.7] | 6.7% [2.7, 11.3] | 0.0% [0.0, 0.0] | 92.0% [87.3, 96.3] | 65.0% [55.0, 74.0] | 63.0% [54.0, 73.0] | 175 / 540 ms |
| Fixed 500 | 85.3% [80.0, 90.0] | 97.3% [95.0, 99.0] | 93.0% [89.3, 96.0] | 0.21 [0.12, 0.31] | 95.3% [92.3, 97.7] | 1.7% [0.3, 3.3] | 3.0% [1.0, 5.7] | 0.0% [0.0, 0.0] | 95.3% [92.3, 98.0] | 84.0% [76.0, 90.0] | 73.0% [64.0, 81.0] | 658 / 2114 ms |
| Fixed 2000 | 89.3% [84.3, 93.7] | 99.3% [98.3, 100.0] | 96.0% [93.3, 98.3] | 0.10 [0.05, 0.15] | 97.0% [94.7, 98.7] | 2.0% [0.7, 3.7] | 1.0% [0.0, 2.7] | 0.0% [0.0, 0.0] | 97.0% [94.7, 99.0] | 90.0% [84.0, 95.0] | 83.0% [75.0, 90.0] | 2354 / 7744 ms |
| Adaptive | 88.0% [83.0, 92.3] | 99.3% [98.3, 100.0] | 95.3% [91.7, 98.3] | 0.12 [0.06, 0.18] | 96.3% [93.3, 99.0] | 1.0% [0.0, 2.7] | 2.7% [0.3, 5.3] | 20.7% [14.7, 27.3] | 97.8% [94.5, 100.0] | 91.0% [85.0, 96.0] | 100.0% [100.0, 100.0] | 3155 / 8521 ms |

## Results by legal-move count

### 2 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 79.4% [75.2, 83.2] | 92.4% [89.8, 94.9] | 85.6% [82.0, 88.8] | 0.47 [0.35, 0.58] | 91.6% [88.3, 94.6] | 2.5% [1.3, 3.8] | 5.9% [3.0, 9.4] | 0.0% [0.0, 0.0] | 91.6% [87.9, 94.7] | 69.8% [63.4, 76.2] | 65.3% [58.9, 71.8] | 266 / 984 ms |
| Fixed 500 | 87.3% [83.7, 90.6] | 97.2% [95.5, 98.5] | 93.1% [90.4, 95.2] | 0.18 [0.13, 0.24] | 96.9% [95.0, 98.3] | 1.5% [0.7, 2.5] | 1.7% [0.5, 3.1] | 0.0% [0.0, 0.0] | 96.9% [95.0, 98.3] | 84.2% [78.7, 89.1] | 76.2% [70.3, 81.7] | 1023 / 3825 ms |
| Fixed 2000 | 92.6% [89.8, 94.9] | 99.8% [99.5, 100.0] | 97.7% [96.2, 98.8] | 0.06 [0.04, 0.09] | 97.0% [95.2, 98.7] | 1.8% [0.7, 3.1] | 1.2% [0.2, 2.5] | 0.0% [0.0, 0.0] | 97.0% [95.2, 98.7] | 94.1% [90.6, 97.0] | 85.6% [80.7, 90.1] | 3753 / 15264 ms |
| Adaptive | 91.9% [88.9, 94.6] | 99.5% [98.8, 100.0] | 96.7% [94.7, 98.5] | 0.08 [0.05, 0.12] | 97.4% [95.7, 98.8] | 1.3% [0.3, 2.5] | 1.3% [0.3, 2.5] | 15.7% [11.7, 20.0] | 97.1% [94.7, 99.2] | 93.1% [89.6, 96.5] | 100.0% [100.0, 100.0] | 4302 / 15025 ms |

### 3 to 5 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 67.8% [63.3, 72.1] | 86.6% [83.6, 89.5] | 76.1% [71.9, 80.0] | 0.90 [0.75, 1.06] | 81.5% [76.5, 86.4] | 2.3% [1.1, 3.8] | 16.2% [11.3, 21.7] | 0.0% [0.0, 0.0] | 81.5% [76.5, 86.6] | 48.0% [41.2, 55.4] | 38.4% [31.1, 45.8] | 1229 / 3862 ms |
| Fixed 500 | 78.3% [74.2, 82.7] | 96.0% [94.0, 97.9] | 88.7% [85.5, 91.7] | 0.33 [0.25, 0.42] | 89.6% [86.4, 92.7] | 2.4% [1.1, 3.8] | 7.9% [5.1, 11.3] | 0.0% [0.0, 0.0] | 89.6% [86.4, 92.8] | 75.1% [68.9, 81.4] | 60.5% [53.1, 67.8] | 4774 / 15651 ms |
| Fixed 2000 | 83.4% [78.9, 87.8] | 98.7% [97.7, 99.6] | 93.6% [91.0, 95.9] | 0.17 [0.12, 0.22] | 94.2% [91.5, 96.4] | 3.4% [1.7, 5.5] | 2.4% [0.9, 4.3] | 0.0% [0.0, 0.0] | 94.2% [91.7, 96.4] | 85.3% [80.2, 89.8] | 76.8% [70.6, 83.1] | 32523 / 62262 ms |
| Adaptive | 84.6% [80.2, 88.3] | 99.1% [97.9, 99.8] | 93.8% [91.1, 96.2] | 0.16 [0.11, 0.21] | 90.2% [86.4, 93.4] | 1.3% [0.2, 2.6] | 8.5% [5.1, 11.9] | 31.3% [25.8, 36.9] | 97.4% [94.7, 99.3] | 86.4% [81.4, 91.5] | 100.0% [100.0, 100.0] | 33354 / 62888 ms |

### 6 or more moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 57.1% [44.4, 68.3] | 76.2% [65.1, 85.7] | 61.9% [49.2, 73.0] | 1.63 [1.00, 2.30] | 65.1% [47.6, 81.0] | 1.6% [0.0, 4.8] | 33.3% [17.5, 52.4] | 0.0% [0.0, 0.0] | 65.1% [47.6, 82.5] | 23.8% [9.5, 42.9] | 23.8% [4.8, 42.9] | 8127 / 19100 ms |
| Fixed 500 | 71.4% [57.1, 82.5] | 95.2% [90.5, 100.0] | 79.4% [69.8, 88.9] | 0.53 [0.30, 0.79] | 87.3% [74.6, 96.8] | 0.0% [0.0, 0.0] | 12.7% [3.2, 25.4] | 0.0% [0.0, 0.0] | 87.3% [74.6, 96.8] | 47.6% [28.6, 66.8] | 42.9% [23.8, 61.9] | 34304 / 70026 ms |
| Fixed 2000 | 74.6% [60.3, 87.3] | 100.0% [100.0, 100.0] | 84.1% [73.0, 95.2] | 0.30 [0.14, 0.48] | 98.4% [95.2, 100.0] | 0.0% [0.0, 0.0] | 1.6% [0.0, 4.8] | 0.0% [0.0, 0.0] | 98.4% [95.2, 100.0] | 71.4% [52.4, 90.5] | 61.9% [42.9, 81.0] | 231057 / 251451 ms |
| Adaptive | 76.2% [63.5, 88.9] | 98.4% [95.2, 100.0] | 87.3% [77.8, 95.2] | 0.28 [0.15, 0.42] | 87.3% [74.6, 96.8] | 0.0% [0.0, 0.0] | 12.7% [3.2, 23.8] | 36.5% [22.2, 52.4] | 100.0% [100.0, 100.0] | 66.7% [47.6, 85.7] | 100.0% [100.0, 100.0] | 208584 / 262911 ms |

## Exact endgame diagnostic

169 positions were small enough for the deal-specific exact solver. The information-safe reference selected an exact winning action in 89.9% of them. This is diagnostic only because the exact solver sees the realized hidden deal and the analyzer correctly does not.

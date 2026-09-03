# Mesa Quince adaptive analyzer reliability study

Generated: 2026-09-03T12:23:11.286Z

## Configuration

- 400 positions: 100 opening, 100 middle, 100 late, 100 block
- 3 independent repetitions per analyzer
- Fixed budgets: 120, 500, 2000
- Adaptive stages: 120, 250, 500, 1000, 2000
- Independent reference: 5000 samples
- Worker threads: 6
- Seed: `mesa-quince-reliability-v1`
- Adaptive implementation: `adaptive-paired-v1`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Conclusion

The adaptive analyzer **failed the release gate** and must remain outside the live coach. It did not match fixed 2000 on the combined near-optimality, regret, and repeatability comparison. It used 31.4% fewer paired samples and 7.0% less mean wall time, while its false-positive mistake rate changed by -0.17 percentage points.

The sampler did allocate more computation to harder decisions: reference-unclear positions used 1.68 times as many samples as reference-clear positions. However, 2000 was the median stopping budget and 50.3% of trials still ended uncertain. Failed release checks: mistakeLabelAgreement, falsePositiveMistakes, repeatAcceptability.

The likely causes are cross-deal variability that is not captured fully by a pooled within-run interval, early stops that remain less repeatable across independent belief samples, and coaching labels near fixed severity boundaries. Opening positions and decisions with three or more legal moves remain the weakest groups. The next experiment should use between-batch uncertainty plus an independent confirmation batch before stopping, calibrate coaching labels separately from move ranking, and evaluate on a new held-out seed instead of tuning against this corpus.

## Overall results

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 73.6% [70.8, 76.4] | 80.8% [78.3, 83.4] | 0.68 [0.59, 0.78] | 87.7% [84.8, 90.5] | 0.8% [0.3, 1.2] | 11.6% [8.9, 14.6] | 91.8% [89.9, 93.6] | 58.0% [53.3, 63.0] | 674 / 2461 ms |
| Fixed 500 | 83.3% [80.7, 86.1] | 89.9% [87.9, 92.0] | 0.27 [0.22, 0.33] | 90.2% [87.6, 92.4] | 2.2% [1.2, 3.2] | 7.7% [5.4, 10.0] | 92.8% [90.9, 94.3] | 77.8% [73.5, 81.8] | 2621 / 9490 ms |
| Fixed 2000 | 91.2% [89.0, 93.2] | 96.4% [95.0, 97.7] | 0.09 [0.06, 0.12] | 94.8% [92.9, 96.5] | 2.3% [1.2, 3.5] | 2.9% [1.6, 4.3] | 95.2% [93.7, 96.4] | 92.0% [89.0, 94.5] | 9963 / 36452 ms |
| Adaptive | 89.4% [87.3, 91.4] | 95.3% [93.8, 96.7] | 0.11 [0.08, 0.14] | 94.3% [92.4, 96.1] | 2.1% [1.1, 3.3] | 3.6% [2.2, 5.2] | 94.7% [93.1, 96.2] | 88.8% [85.5, 91.5] | 9263 / 34448 ms |

## Adaptive computation

- Mean samples: 1372.92 [1308.74, 1441.05]
- Median samples: 2000
- P95 samples: 2000
- Maximum samples: 2000
- Hard-cap rate: 50.3% [46.0, 54.7]
- Uncertain-at-stop rate: 50.3% [45.8, 54.7]
- Mean samples on reference-clear positions: 1161.24 [1083.04, 1239.16]
- Mean samples on reference-unclear positions: 1945.22 [1914.35, 1973.77]

| Stopping stage | Trials | Share |
| ---: | ---: | ---: |
| 250 | 258 | 21.5% |
| 500 | 126 | 10.5% |
| 1000 | 112 | 9.3% |
| 2000 | 704 | 58.7% |

## Release gate

Adaptive result: **FAIL**

| Check | Result |
| --- | --- |
| corpusSize | PASS |
| withinOnePoint | PASS |
| meanRegret | PASS |
| mistakeLabelAgreement | FAIL |
| falsePositiveMistakes | FAIL |
| repeatAcceptability | FAIL |

## Results by phase

### opening

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 62.3% [56.7, 67.7] | 73.0% [68.0, 78.3] | 1.01 [0.79, 1.24] | 78.7% [71.7, 85.7] | 1.0% [0.0, 2.3] | 20.3% [13.7, 27.3] | 89.3% [85.3, 93.0] | 41.0% [31.0, 51.0] | 2029 / 6073 ms |
| Fixed 500 | 71.7% [65.3, 77.7] | 81.7% [76.3, 86.7] | 0.52 [0.37, 0.67] | 81.3% [74.7, 87.7] | 1.7% [0.3, 3.3] | 17.0% [11.0, 23.7] | 90.3% [87.0, 93.7] | 62.0% [52.0, 72.0] | 7906 / 22435 ms |
| Fixed 2000 | 84.7% [79.0, 89.7] | 93.0% [89.0, 96.3] | 0.18 [0.10, 0.27] | 93.0% [89.0, 96.7] | 1.7% [0.3, 3.7] | 5.3% [2.0, 9.3] | 95.0% [92.0, 97.7] | 85.0% [78.0, 92.0] | 30471 / 87103 ms |
| Adaptive | 83.3% [78.0, 88.0] | 91.7% [88.0, 94.7] | 0.20 [0.13, 0.27] | 90.7% [85.7, 95.3] | 1.7% [0.0, 4.0] | 7.7% [3.3, 12.3] | 94.3% [91.0, 97.0] | 79.0% [71.0, 86.0] | 28436 / 90948 ms |

### middle

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 71.7% [66.3, 76.7] | 77.3% [72.3, 82.0] | 0.78 [0.59, 0.98] | 86.0% [79.7, 91.7] | 1.3% [0.3, 2.7] | 12.7% [7.0, 19.3] | 91.3% [87.3, 94.7] | 48.0% [38.0, 58.0] | 481 / 1067 ms |
| Fixed 500 | 82.3% [76.3, 88.0] | 90.0% [85.7, 93.7] | 0.27 [0.16, 0.39] | 88.3% [83.0, 93.3] | 4.0% [1.7, 7.3] | 7.7% [3.7, 12.3] | 91.7% [87.3, 95.3] | 78.0% [69.0, 86.0] | 1856 / 3677 ms |
| Fixed 2000 | 92.3% [88.0, 96.0] | 97.0% [94.7, 99.0] | 0.06 [0.03, 0.09] | 92.0% [87.7, 95.7] | 5.0% [2.3, 8.0] | 3.0% [0.7, 6.3] | 94.3% [91.3, 97.0] | 93.0% [88.0, 98.0] | 6775 / 13546 ms |
| Adaptive | 87.3% [82.7, 92.0] | 94.7% [91.7, 97.3] | 0.12 [0.07, 0.17] | 95.0% [91.7, 98.0] | 2.7% [0.7, 5.7] | 2.3% [0.7, 4.3] | 94.0% [90.3, 97.0] | 87.0% [80.0, 93.0] | 5889 / 13261 ms |

### late

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 85.3% [80.0, 90.0] | 87.3% [82.3, 91.7] | 0.46 [0.29, 0.65] | 91.3% [86.7, 96.0] | 0.7% [0.0, 1.7] | 8.0% [3.7, 13.0] | 96.3% [93.3, 98.7] | 73.0% [64.0, 82.0] | 75 / 206 ms |
| Fixed 500 | 92.0% [88.3, 95.3] | 94.3% [91.3, 96.7] | 0.16 [0.09, 0.25] | 95.0% [91.3, 98.0] | 1.3% [0.0, 3.3] | 3.7% [1.0, 7.3] | 96.7% [94.3, 98.7] | 85.0% [78.0, 92.0] | 282 / 778 ms |
| Fixed 2000 | 94.3% [90.7, 97.7] | 97.0% [94.3, 99.3] | 0.07 [0.02, 0.12] | 97.3% [94.0, 99.7] | 1.0% [0.0, 3.0] | 1.7% [0.0, 4.0] | 96.7% [94.0, 98.7] | 94.0% [89.0, 98.0] | 990 / 2665 ms |
| Adaptive | 96.0% [93.3, 98.3] | 97.7% [95.3, 99.3] | 0.06 [0.02, 0.10] | 96.0% [93.0, 98.7] | 1.0% [0.0, 2.3] | 3.0% [0.7, 6.3] | 97.0% [94.7, 99.0] | 95.0% [90.0, 99.0] | 1019 / 2606 ms |

### block

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 75.0% [69.0, 80.7] | 85.7% [81.0, 90.0] | 0.49 [0.35, 0.65] | 94.7% [90.7, 98.3] | 0.0% [0.0, 0.0] | 5.3% [2.0, 9.3] | 90.0% [85.7, 94.0] | 70.0% [61.0, 79.0] | 113 / 356 ms |
| Fixed 500 | 87.3% [82.3, 91.3] | 93.7% [90.0, 96.7] | 0.14 [0.08, 0.21] | 96.0% [92.7, 98.7] | 1.7% [0.3, 3.3] | 2.3% [0.0, 5.7] | 92.3% [88.3, 95.7] | 86.0% [79.0, 92.0] | 440 / 1343 ms |
| Fixed 2000 | 93.3% [89.7, 96.7] | 98.7% [97.3, 99.7] | 0.05 [0.02, 0.09] | 97.0% [93.7, 99.3] | 1.3% [0.0, 3.3] | 1.7% [0.0, 4.3] | 94.7% [91.0, 97.7] | 96.0% [92.0, 99.0] | 1616 / 4996 ms |
| Adaptive | 91.0% [87.0, 94.7] | 97.3% [95.0, 99.3] | 0.07 [0.03, 0.11] | 95.7% [92.0, 98.7] | 3.0% [0.7, 6.0] | 1.3% [0.0, 4.0] | 93.3% [90.0, 96.3] | 94.0% [89.0, 98.0] | 1707 / 5668 ms |

## Results by legal-move count

### 2 moves

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 80.6% [76.8, 84.2] | 88.1% [85.1, 91.1] | 0.36 [0.28, 0.47] | 95.9% [93.3, 97.9] | 0.5% [0.0, 1.2] | 3.6% [1.5, 6.0] | 93.3% [90.5, 95.9] | 73.2% [67.0, 78.9] | 202 / 827 ms |
| Fixed 500 | 85.7% [82.0, 89.2] | 92.1% [89.5, 94.7] | 0.20 [0.14, 0.26] | 96.2% [94.2, 97.9] | 1.7% [0.7, 2.9] | 2.1% [0.7, 4.0] | 95.5% [93.5, 97.3] | 82.0% [76.8, 87.1] | 792 / 3412 ms |
| Fixed 2000 | 92.8% [90.0, 95.4] | 97.9% [96.6, 99.1] | 0.05 [0.03, 0.08] | 98.3% [96.9, 99.3] | 1.5% [0.5, 2.9] | 0.2% [0.0, 0.5] | 96.4% [94.3, 98.1] | 94.8% [91.2, 97.9] | 2970 / 13217 ms |
| Adaptive | 90.7% [87.6, 93.5] | 96.4% [94.5, 98.1] | 0.08 [0.05, 0.12] | 96.9% [94.8, 98.8] | 2.2% [0.7, 4.3] | 0.9% [0.0, 2.1] | 95.0% [92.8, 96.9] | 91.8% [87.6, 95.4] | 2851 / 12239 ms |

### 3 to 5 moves

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 68.1% [63.6, 72.2] | 74.9% [70.8, 78.5] | 0.91 [0.76, 1.06] | 82.1% [76.9, 87.1] | 0.9% [0.2, 1.8] | 17.0% [12.5, 22.0] | 90.3% [87.5, 93.0] | 45.7% [38.2, 52.7] | 686 / 1920 ms |
| Fixed 500 | 83.0% [78.9, 86.9] | 89.8% [86.7, 92.7] | 0.28 [0.20, 0.36] | 85.3% [80.8, 89.4] | 2.5% [1.1, 4.3] | 12.2% [8.2, 16.7] | 90.5% [87.5, 93.5] | 78.0% [72.0, 83.9] | 2697 / 7902 ms |
| Fixed 2000 | 91.0% [87.8, 94.1] | 95.9% [93.7, 97.7] | 0.10 [0.06, 0.14] | 91.6% [88.2, 94.8] | 3.0% [1.3, 5.0] | 5.4% [2.7, 8.2] | 93.7% [91.2, 95.9] | 90.9% [86.6, 94.6] | 10071 / 30134 ms |
| Adaptive | 89.1% [86.0, 92.1] | 94.6% [92.3, 96.6] | 0.12 [0.08, 0.16] | 91.8% [88.4, 94.8] | 2.2% [0.7, 3.9] | 6.1% [3.4, 9.0] | 94.4% [92.1, 96.4] | 86.6% [81.7, 91.4] | 9411 / 31320 ms |

### 6 or more moves

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Interval coverage | Repeat acceptable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 56.7% [43.3, 70.0] | 65.0% [55.0, 75.0] | 1.71 [1.07, 2.41] | 60.0% [41.7, 78.3] | 1.7% [0.0, 5.0] | 38.3% [20.0, 56.7] | 90.0% [81.7, 96.7] | 25.0% [5.0, 45.0] | 5146 / 6631 ms |
| Fixed 500 | 63.3% [48.3, 76.7] | 70.0% [56.7, 81.7] | 0.90 [0.54, 1.30] | 76.7% [63.3, 88.3] | 3.3% [0.0, 8.3] | 20.0% [8.3, 35.0] | 86.7% [78.3, 95.0] | 35.0% [15.0, 55.0] | 19655 / 23868 ms |
| Fixed 2000 | 76.7% [60.0, 91.7] | 86.7% [73.3, 96.7] | 0.36 [0.10, 0.68] | 91.7% [81.7, 100.0] | 1.7% [0.0, 5.0] | 6.7% [0.0, 16.7] | 96.7% [91.7, 100.0] | 75.0% [55.0, 95.0] | 76797 / 94068 ms |
| Adaptive | 80.0% [63.3, 93.3] | 91.7% [83.3, 98.3] | 0.23 [0.08, 0.42] | 93.3% [83.3, 100.0] | 0.0% [0.0, 0.0] | 6.7% [0.0, 16.7] | 93.3% [85.0, 100.0] | 80.0% [60.0, 95.0] | 70081 / 96736 ms |

## Exact endgame diagnostic

163 positions were small enough for the deal-specific exact solver. The information-safe reference selected an exact winning action in 95.1% of them. This is diagnostic only because the exact solver sees the realized hidden deal and the analyzer correctly does not.

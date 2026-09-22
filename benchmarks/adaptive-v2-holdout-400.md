# Mesa Quince adaptive analyzer reliability study

Generated: 2026-09-22T06:30:26.782Z

## Configuration

- 400 positions: 100 opening, 100 middle, 100 late, 100 block
- 3 independent repetitions per analyzer
- Fixed budgets: 120, 500, 2000
- Adaptive stages: 120, 250, 500, 1000, 2000
- Recommendation equivalence gap: 1 point(s)
- Mistake practical gap: 1.5 point(s)
- Mistake minimum estimated loss: 4 point(s)
- Mistake batch agreement: 75%
- Mistake practical batch agreement: 50%
- Independent reference: 5000 samples
- Worker threads: 6
- Seed: `mesa-quince-adaptive-v2-holdout-v1`
- Adaptive implementation: `adaptive-confirmed-v2`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Conclusion

The adaptive analyzer **failed the release gate** and must remain outside the live coach. It matched or improved fixed 2000 on the combined near-optimality, regret, and repeatability comparison. It used 11.6% fewer paired samples and 23.5% less mean wall time, while its false-positive mistake rate changed by -2.83 percentage points.

The sampler allocated more computation to harder decisions: reference-unclear positions used 1.20 times as many samples as reference-clear positions. Its median stopping budget was 2000, 71.6% of recommendations ended uncertain, and 22.4% of coaching labels abstained. Failed release checks: mistakeLabelAgreement.

This V2 sampler widens uncertainty when independent batches disagree, requires a fresh confirmation batch before early stopping, delays decisions according to phase and legal-move count, and treats statistically equivalent moves as one plausible-best set. Recommendation confidence and mistake confidence are separate, so the coach can abstain from a mistake label even when it still offers a tentative move.

## Overall results

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 74.3% [71.2, 77.3] | 90.8% [88.8, 92.6] | 84.5% [82.2, 86.8] | 0.63 [0.53, 0.73] | 87.7% [84.8, 90.4] | 0.7% [0.3, 1.3] | 11.6% [8.8, 14.5] | 0.0% [0.0, 0.0] | 87.7% [84.7, 90.3] | 66.3% [61.5, 71.0] | 56.0% [50.7, 60.8] | 3628 / 5830 ms |
| Fixed 500 | 83.3% [80.7, 85.9] | 97.7% [96.7, 98.5] | 92.9% [91.3, 94.5] | 0.22 [0.18, 0.27] | 91.7% [89.3, 93.7] | 2.3% [1.3, 3.4] | 6.0% [4.1, 8.1] | 0.0% [0.0, 0.0] | 91.7% [89.3, 93.7] | 82.0% [78.0, 85.8] | 69.3% [64.5, 74.0] | 16656 / 23320 ms |
| Fixed 2000 | 89.2% [86.8, 91.3] | 99.5% [98.9, 99.9] | 96.8% [95.4, 97.9] | 0.10 [0.08, 0.13] | 94.2% [92.3, 95.8] | 3.4% [2.1, 4.9] | 2.4% [1.3, 3.9] | 0.0% [0.0, 0.0] | 94.2% [92.3, 95.9] | 92.8% [90.0, 95.3] | 80.5% [76.8, 84.5] | 67821 / 90478 ms |
| Adaptive | 88.8% [86.3, 91.2] | 99.4% [98.8, 99.9] | 97.8% [96.7, 98.8] | 0.09 [0.07, 0.12] | 93.2% [91.1, 95.2] | 0.6% [0.2, 1.1] | 6.3% [4.2, 8.5] | 22.4% [19.0, 26.0] | 98.0% [96.6, 99.4] | 95.3% [93.0, 97.3] | 100.0% [100.0, 100.0] | 51851 / 84504 ms |

## Adaptive computation

- Mean samples: 1767.08 [1724.17, 1810.83]
- Median samples: 2000
- P95 samples: 2000
- Maximum samples: 2000
- Hard-cap rate: 71.6% [67.7, 75.4]
- Uncertain-at-stop rate: 71.6% [67.6, 75.5]
- Mean plausible-best set size: 1.73 [1.66, 1.80]
- Coaching-label abstention rate: 22.4% [19.0, 26.0]
- Accuracy among non-abstained coaching labels: 98.0% [96.6, 99.4]
- Mean samples on reference-clear positions: 1668.45 [1607.35, 1724.20]
- Mean samples on reference-unclear positions: 2000.00 [2000.00, 2000.00]

| Stopping stage | Trials | Share |
| ---: | ---: | ---: |
| 500 | 115 | 9.6% |
| 1000 | 107 | 8.9% |
| 2000 | 978 | 81.5% |

## Release gate

Adaptive result: **FAIL**

| Check | Result |
| --- | --- |
| corpusSize | PASS |
| withinOnePoint | PASS |
| meanRegret | PASS |
| mistakeLabelAgreement | FAIL |
| falsePositiveMistakes | PASS |
| repeatAcceptability | PASS |
| withinOnePointNoninferior | PASS |
| meanRegretNoninferior | PASS |
| repeatAcceptabilityNoninferior | PASS |
| recommendationSetStability | PASS |
| sampleSavings | PASS |

## Results by phase

### opening

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 55.3% [49.3, 61.7] | 82.7% [77.7, 87.3] | 68.3% [62.7, 74.3] | 1.29 [1.03, 1.56] | 82.3% [75.0, 88.7] | 0.7% [0.0, 2.0] | 17.0% [10.7, 24.3] | 0.0% [0.0, 0.0] | 82.3% [75.3, 89.0] | 36.0% [27.0, 46.0] | 23.0% [15.0, 32.0] | 13037 / 12535 ms |
| Fixed 500 | 72.0% [65.7, 78.0] | 96.7% [94.3, 98.7] | 88.7% [85.0, 92.0] | 0.37 [0.27, 0.49] | 87.0% [82.0, 91.7] | 4.0% [2.0, 6.7] | 9.0% [5.0, 13.7] | 0.0% [0.0, 0.0] | 87.0% [82.0, 91.3] | 70.0% [61.0, 79.0] | 51.0% [41.0, 61.0] | 61062 / 49445 ms |
| Fixed 2000 | 81.3% [75.7, 86.3] | 99.3% [98.3, 100.0] | 94.3% [91.0, 97.3] | 0.17 [0.11, 0.24] | 90.3% [85.3, 94.7] | 5.3% [2.3, 9.3] | 4.3% [1.3, 8.0] | 0.0% [0.0, 0.0] | 90.3% [85.0, 94.7] | 88.0% [81.0, 94.0] | 65.0% [55.0, 74.0] | 251020 / 210422 ms |
| Adaptive | 81.3% [75.0, 87.0] | 99.3% [98.3, 100.0] | 97.0% [94.7, 99.0] | 0.15 [0.10, 0.22] | 89.7% [84.0, 94.7] | 0.7% [0.0, 1.7] | 9.7% [5.0, 15.7] | 32.3% [24.7, 40.0] | 96.3% [91.4, 100.0] | 93.0% [88.0, 97.0] | 100.0% [100.0, 100.0] | 183981 / 212215 ms |

### middle

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 73.3% [67.0, 79.3] | 88.7% [84.3, 92.7] | 82.7% [77.7, 87.7] | 0.64 [0.47, 0.84] | 90.3% [84.7, 95.3] | 1.0% [0.0, 2.3] | 8.7% [4.0, 14.0] | 0.0% [0.0, 0.0] | 90.3% [84.7, 95.3] | 63.0% [54.0, 73.0] | 52.0% [42.0, 62.0] | 1013 / 2227 ms |
| Fixed 500 | 84.7% [79.7, 89.3] | 97.3% [95.3, 99.0] | 92.3% [88.7, 95.3] | 0.21 [0.13, 0.29] | 94.0% [89.7, 97.7] | 1.3% [0.0, 3.0] | 4.7% [1.7, 8.7] | 0.0% [0.0, 0.0] | 94.0% [90.0, 97.7] | 81.0% [73.0, 89.0] | 69.0% [60.0, 78.0] | 3853 / 8463 ms |
| Fixed 2000 | 87.7% [82.7, 92.7] | 98.7% [97.0, 100.0] | 94.7% [91.0, 97.3] | 0.15 [0.08, 0.23] | 95.0% [91.7, 98.0] | 2.3% [0.7, 4.7] | 2.7% [0.3, 6.0] | 0.0% [0.0, 0.0] | 95.0% [91.3, 98.0] | 88.0% [82.0, 94.0] | 80.0% [72.0, 87.0] | 14058 / 30193 ms |
| Adaptive | 88.3% [83.3, 92.7] | 98.7% [96.3, 100.0] | 95.7% [92.0, 98.3] | 0.13 [0.06, 0.22] | 94.0% [89.3, 97.7] | 0.3% [0.0, 1.0] | 5.7% [2.0, 10.3] | 19.0% [13.3, 25.7] | 98.9% [96.7, 100.0] | 92.0% [86.0, 97.0] | 100.0% [100.0, 100.0] | 15258 / 32447 ms |

### late

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 85.3% [80.3, 90.3] | 95.3% [93.0, 97.7] | 93.0% [89.3, 96.0] | 0.31 [0.19, 0.46] | 86.0% [80.0, 91.3] | 0.3% [0.0, 1.0] | 13.7% [8.0, 20.0] | 0.0% [0.0, 0.0] | 86.0% [79.3, 91.7] | 83.0% [76.0, 90.0] | 78.0% [70.0, 86.0] | 230 / 614 ms |
| Fixed 500 | 90.3% [85.3, 94.7] | 98.7% [97.0, 99.7] | 96.3% [93.7, 98.3] | 0.11 [0.06, 0.18] | 90.7% [86.0, 95.0] | 3.0% [0.7, 6.3] | 6.3% [2.7, 10.7] | 0.0% [0.0, 0.0] | 90.7% [85.7, 95.0] | 91.0% [85.0, 96.0] | 85.0% [78.0, 91.0] | 801 / 2040 ms |
| Fixed 2000 | 93.0% [89.0, 96.7] | 100.0% [100.0, 100.0] | 98.7% [96.7, 100.0] | 0.04 [0.02, 0.07] | 94.0% [90.0, 97.3] | 3.7% [1.0, 7.3] | 2.3% [0.3, 5.0] | 0.0% [0.0, 0.0] | 94.0% [90.0, 97.3] | 97.0% [93.0, 100.0] | 88.0% [81.0, 94.0] | 2835 / 7923 ms |
| Adaptive | 92.3% [87.7, 96.3] | 100.0% [100.0, 100.0] | 99.3% [98.3, 100.0] | 0.04 [0.02, 0.06] | 93.0% [88.3, 97.0] | 0.7% [0.0, 2.0] | 6.3% [2.7, 10.7] | 17.7% [12.0, 24.3] | 98.9% [96.7, 100.0] | 98.0% [95.0, 100.0] | 100.0% [100.0, 100.0] | 4523 / 10900 ms |

### block

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 83.3% [77.7, 88.7] | 96.3% [94.0, 98.3] | 94.0% [91.3, 96.3] | 0.25 [0.16, 0.36] | 92.0% [87.3, 96.3] | 1.0% [0.0, 2.3] | 7.0% [3.0, 12.0] | 0.0% [0.0, 0.0] | 92.0% [87.0, 96.3] | 83.0% [76.0, 90.0] | 71.0% [62.0, 80.0] | 230 / 935 ms |
| Fixed 500 | 86.0% [81.0, 90.3] | 98.0% [96.3, 99.3] | 94.3% [91.0, 97.0] | 0.19 [0.11, 0.28] | 95.0% [91.3, 98.0] | 1.0% [0.0, 2.3] | 4.0% [1.0, 7.7] | 0.0% [0.0, 0.0] | 95.0% [91.0, 98.3] | 86.0% [79.0, 92.0] | 72.0% [63.0, 81.0] | 907 / 3672 ms |
| Fixed 2000 | 94.7% [91.3, 97.7] | 100.0% [100.0, 100.0] | 99.3% [98.3, 100.0] | 0.04 [0.02, 0.07] | 97.3% [95.0, 99.0] | 2.3% [0.7, 4.3] | 0.3% [0.0, 1.0] | 0.0% [0.0, 0.0] | 97.3% [95.3, 99.0] | 98.0% [95.0, 100.0] | 89.0% [83.0, 95.0] | 3372 / 14525 ms |
| Adaptive | 93.0% [88.7, 96.3] | 99.7% [99.0, 100.0] | 99.3% [98.3, 100.0] | 0.04 [0.02, 0.08] | 96.0% [92.7, 98.7] | 0.7% [0.0, 1.7] | 3.3% [0.7, 6.7] | 20.7% [14.0, 28.0] | 97.7% [94.3, 100.0] | 98.0% [95.0, 100.0] | 100.0% [100.0, 100.0] | 3642 / 10960 ms |

## Results by legal-move count

### 2 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 83.2% [79.3, 87.0] | 95.4% [93.2, 97.1] | 91.6% [88.8, 94.1] | 0.31 [0.22, 0.40] | 92.7% [88.9, 95.9] | 0.5% [0.0, 1.1] | 6.8% [3.6, 10.3] | 0.0% [0.0, 0.0] | 92.7% [89.1, 95.7] | 79.7% [73.8, 85.6] | 70.6% [63.6, 77.0] | 342 / 1103 ms |
| Fixed 500 | 89.8% [86.8, 92.7] | 98.8% [97.9, 99.6] | 96.4% [94.7, 97.9] | 0.12 [0.08, 0.16] | 94.5% [92.0, 96.8] | 2.0% [0.9, 3.2] | 3.6% [1.6, 5.9] | 0.0% [0.0, 0.0] | 94.5% [91.8, 96.8] | 90.4% [86.1, 94.1] | 79.1% [73.3, 85.0] | 1301 / 4556 ms |
| Fixed 2000 | 93.4% [90.7, 95.9] | 99.8% [99.5, 100.0] | 98.8% [97.7, 99.6] | 0.05 [0.03, 0.07] | 96.4% [94.1, 98.4] | 2.0% [0.5, 3.9] | 1.6% [0.4, 3.0] | 0.0% [0.0, 0.0] | 96.4% [94.1, 98.2] | 96.8% [94.1, 98.9] | 88.2% [83.4, 92.5] | 4810 / 16728 ms |
| Adaptive | 92.7% [89.7, 95.4] | 99.8% [99.5, 100.0] | 98.9% [97.9, 99.8] | 0.05 [0.03, 0.07] | 96.4% [93.9, 98.6] | 0.5% [0.0, 1.4] | 3.0% [1.2, 5.5] | 16.8% [12.1, 21.2] | 98.8% [97.1, 100.0] | 97.3% [94.7, 99.5] | 100.0% [100.0, 100.0] | 5925 / 17646 ms |

### 3 to 5 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 68.4% [63.9, 73.0] | 88.4% [85.1, 91.4] | 80.4% [76.5, 84.0] | 0.76 [0.62, 0.92] | 86.8% [82.3, 91.1] | 1.1% [0.2, 2.1] | 12.1% [7.9, 16.5] | 0.0% [0.0, 0.0] | 86.8% [82.5, 91.1] | 58.4% [51.1, 65.3] | 45.3% [38.4, 52.1] | 4315 / 4200 ms |
| Fixed 500 | 77.4% [72.8, 81.4] | 96.8% [95.3, 98.2] | 90.0% [87.2, 92.6] | 0.31 [0.24, 0.38] | 91.2% [87.9, 94.4] | 2.5% [1.1, 4.2] | 6.3% [3.5, 9.5] | 0.0% [0.0, 0.0] | 91.2% [87.9, 94.4] | 75.3% [68.9, 81.6] | 60.0% [53.1, 67.4] | 24373 / 17156 ms |
| Fixed 2000 | 84.9% [81.2, 88.4] | 99.1% [98.1, 99.8] | 94.6% [91.9, 96.8] | 0.16 [0.11, 0.21] | 92.6% [89.8, 95.3] | 4.6% [2.5, 6.8] | 2.8% [1.1, 4.7] | 0.0% [0.0, 0.0] | 92.6% [89.8, 95.4] | 88.4% [83.7, 92.6] | 72.6% [66.3, 78.9] | 81346 / 61490 ms |
| Adaptive | 84.9% [80.9, 88.8] | 98.9% [97.7, 99.8] | 96.5% [94.4, 98.2] | 0.14 [0.09, 0.19] | 91.8% [88.1, 95.1] | 0.5% [0.0, 1.2] | 7.7% [4.4, 11.2] | 26.1% [21.1, 31.6] | 97.5% [95.1, 99.4] | 92.6% [88.9, 96.3] | 100.0% [100.0, 100.0] | 52629 / 65793 ms |

### 6 or more moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 50.7% [36.2, 65.2] | 72.5% [59.4, 84.1] | 60.9% [49.3, 72.5] | 2.09 [1.41, 2.80] | 53.6% [36.2, 71.0] | 0.0% [0.0, 0.0] | 46.4% [29.0, 62.3] | 0.0% [0.0, 0.0] | 53.6% [36.2, 71.0] | 21.7% [4.3, 39.1] | 26.1% [8.7, 47.8] | 24662 / 15461 ms |
| Fixed 500 | 78.3% [63.8, 91.3] | 95.7% [91.3, 100.0] | 88.4% [81.2, 95.7] | 0.39 [0.15, 0.69] | 72.5% [59.4, 84.1] | 4.3% [0.0, 11.6] | 23.2% [11.6, 36.2] | 0.0% [0.0, 0.0] | 72.5% [60.9, 84.1] | 69.6% [47.8, 87.0] | 65.2% [47.8, 87.0] | 77744 / 60941 ms |
| Fixed 2000 | 89.9% [79.7, 98.6] | 100.0% [100.0, 100.0] | 98.6% [95.7, 100.0] | 0.08 [0.01, 0.17] | 88.4% [75.4, 97.1] | 5.8% [0.0, 14.5] | 5.8% [0.0, 15.9] | 0.0% [0.0, 0.0] | 88.4% [75.4, 97.1] | 95.7% [87.0, 100.0] | 82.6% [65.2, 95.7] | 468404 / 674327 ms |
| Adaptive | 88.4% [76.8, 98.6] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 0.09 [0.01, 0.19] | 78.3% [63.8, 91.3] | 1.4% [0.0, 4.3] | 20.3% [7.2, 34.8] | 37.7% [21.7, 55.1] | 94.4% [83.3, 100.0] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 418815 / 621853 ms |

## Exact endgame diagnostic

155 positions were small enough for the deal-specific exact solver. The information-safe reference selected an exact winning action in 89.0% of them. This is diagnostic only because the exact solver sees the realized hidden deal and the analyzer correctly does not.

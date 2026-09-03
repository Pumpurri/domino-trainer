# Mesa Quince adaptive analyzer reliability study

Generated: 2026-09-03T18:00:18.474Z

## Configuration

- 80 positions: 20 opening, 20 middle, 20 late, 20 block
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
- Seed: `mesa-quince-adaptive-v2-development`
- Adaptive implementation: `adaptive-confirmed-v2`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Conclusion

The adaptive analyzer **passed the release gate** and can proceed to controlled release integration. It matched or improved fixed 2000 on the combined near-optimality, regret, and repeatability comparison. It used 8.7% fewer paired samples and 1.4% less mean wall time, while its false-positive mistake rate changed by -3.75 percentage points.

The sampler allocated more computation to harder decisions: reference-unclear positions used 1.16 times as many samples as reference-clear positions. Its median stopping budget was 2000, 78.3% of recommendations ended uncertain, and 25.4% of coaching labels abstained. Failed release checks: none.

This V2 sampler widens uncertainty when independent batches disagree, requires a fresh confirmation batch before early stopping, delays decisions according to phase and legal-move count, and treats statistically equivalent moves as one plausible-best set. Recommendation confidence and mistake confidence are separate, so the coach can abstain from a mistake label even when it still offers a tentative move.

## Overall results

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 68.7% [60.8, 76.2] | 91.7% [87.5, 95.0] | 78.7% [71.7, 85.0] | 0.67 [0.47, 0.92] | 82.5% [75.4, 89.2] | 4.2% [2.1, 6.7] | 13.3% [6.7, 20.4] | 0.0% [0.0, 0.0] | 82.5% [75.4, 89.2] | 58.8% [47.5, 70.0] | 55.0% [43.8, 66.3] | 1316 / 4239 ms |
| Fixed 500 | 80.0% [72.9, 86.2] | 97.9% [95.8, 99.6] | 91.3% [86.7, 95.4] | 0.22 [0.13, 0.32] | 89.6% [84.6, 94.6] | 3.8% [1.3, 6.7] | 6.7% [2.5, 12.1] | 0.0% [0.0, 0.0] | 89.6% [84.2, 94.6] | 81.3% [72.5, 88.8] | 68.8% [58.7, 78.8] | 5867 / 30645 ms |
| Fixed 2000 | 85.4% [78.3, 91.3] | 99.6% [98.8, 100.0] | 96.7% [93.7, 99.2] | 0.09 [0.04, 0.14] | 93.3% [87.9, 97.9] | 3.7% [0.8, 7.1] | 2.9% [0.0, 6.7] | 0.0% [0.0, 0.0] | 93.3% [87.5, 97.5] | 92.5% [86.3, 97.5] | 83.8% [76.3, 91.3] | 31821 / 119698 ms |
| Adaptive | 86.7% [80.8, 92.1] | 100.0% [100.0, 100.0] | 95.0% [91.3, 98.3] | 0.09 [0.05, 0.14] | 95.8% [92.1, 98.8] | 0.0% [0.0, 0.0] | 4.2% [1.3, 7.9] | 25.4% [17.5, 33.3] | 100.0% [100.0, 100.0] | 90.0% [82.5, 96.3] | 100.0% [100.0, 100.0] | 31375 / 131227 ms |

## Adaptive computation

- Mean samples: 1825.00 [1733.28, 1918.80]
- Median samples: 2000
- P95 samples: 2000
- Maximum samples: 2000
- Hard-cap rate: 78.3% [69.6, 85.8]
- Uncertain-at-stop rate: 78.3% [70.0, 86.3]
- Mean plausible-best set size: 1.75 [1.61, 1.92]
- Coaching-label abstention rate: 25.4% [17.5, 33.3]
- Accuracy among non-abstained coaching labels: 100.0% [100.0, 100.0]
- Mean samples on reference-clear positions: 1730.77 [1589.74, 1852.56]
- Mean samples on reference-unclear positions: 2000.00 [2000.00, 2000.00]

| Stopping stage | Trials | Share |
| ---: | ---: | ---: |
| 500 | 20 | 8.3% |
| 1000 | 12 | 5.0% |
| 2000 | 208 | 86.7% |

## Release gate

Adaptive result: **PASS**

| Check | Result |
| --- | --- |
| corpusSize | PASS |
| withinOnePoint | PASS |
| meanRegret | PASS |
| mistakeLabelAgreement | PASS |
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
| Fixed 120 | 61.7% [45.0, 76.7] | 86.7% [80.0, 93.3] | 75.0% [61.7, 86.7] | 0.91 [0.52, 1.33] | 78.3% [61.7, 93.3] | 3.3% [0.0, 8.3] | 18.3% [3.3, 36.7] | 0.0% [0.0, 0.0] | 78.3% [61.7, 93.3] | 45.0% [20.0, 65.1] | 40.0% [20.0, 60.0] | 3927 / 11072 ms |
| Fixed 500 | 73.3% [58.3, 86.7] | 98.3% [95.0, 100.0] | 91.7% [83.3, 98.3] | 0.23 [0.09, 0.40] | 85.0% [71.7, 96.7] | 1.7% [0.0, 5.0] | 13.3% [3.3, 26.7] | 0.0% [0.0, 0.0] | 85.0% [71.7, 96.7] | 80.0% [64.9, 95.0] | 60.0% [35.0, 80.0] | 16355 / 44677 ms |
| Fixed 2000 | 70.0% [51.7, 88.3] | 100.0% [100.0, 100.0] | 98.3% [95.0, 100.0] | 0.13 [0.05, 0.24] | 90.0% [76.7, 100.0] | 8.3% [0.0, 20.0] | 1.7% [0.0, 5.0] | 0.0% [0.0, 0.0] | 90.0% [76.7, 100.0] | 95.0% [85.0, 100.0] | 85.0% [70.0, 100.0] | 104967 / 335740 ms |
| Adaptive | 75.0% [58.3, 90.0] | 100.0% [100.0, 100.0] | 93.3% [83.3, 100.0] | 0.12 [0.03, 0.24] | 90.0% [80.0, 98.3] | 0.0% [0.0, 0.0] | 10.0% [1.7, 21.7] | 33.3% [15.0, 53.3] | 100.0% [100.0, 100.0] | 90.0% [75.0, 100.0] | 100.0% [100.0, 100.0] | 77980 / 183724 ms |

### middle

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 51.7% [36.7, 66.7] | 91.7% [83.3, 98.3] | 71.7% [56.7, 85.0] | 0.80 [0.46, 1.21] | 90.0% [78.3, 98.3] | 5.0% [0.0, 10.0] | 5.0% [0.0, 15.0] | 0.0% [0.0, 0.0] | 90.0% [78.3, 98.3] | 45.0% [25.0, 70.0] | 40.0% [19.9, 60.0] | 876 / 1631 ms |
| Fixed 500 | 68.3% [51.7, 83.3] | 96.7% [90.0, 100.0] | 88.3% [78.3, 96.7] | 0.34 [0.11, 0.66] | 86.7% [73.3, 96.7] | 8.3% [1.7, 15.0] | 5.0% [0.0, 15.0] | 0.0% [0.0, 0.0] | 86.7% [73.3, 96.7] | 75.0% [55.0, 90.0] | 55.0% [30.0, 75.0] | 3372 / 6836 ms |
| Fixed 2000 | 81.7% [68.3, 93.3] | 100.0% [100.0, 100.0] | 93.3% [85.0, 100.0] | 0.11 [0.02, 0.23] | 93.3% [81.7, 100.0] | 1.7% [0.0, 5.0] | 5.0% [0.0, 15.0] | 0.0% [0.0, 0.0] | 93.3% [81.6, 100.0] | 85.0% [70.0, 100.0] | 70.0% [49.9, 90.0] | 15007 / 25998 ms |
| Adaptive | 81.7% [66.7, 93.4] | 100.0% [100.0, 100.0] | 91.7% [81.7, 100.0] | 0.14 [0.02, 0.28] | 96.7% [90.0, 100.0] | 0.0% [0.0, 0.0] | 3.3% [0.0, 10.0] | 41.7% [23.3, 60.0] | 100.0% [100.0, 100.0] | 85.0% [70.0, 100.0] | 100.0% [100.0, 100.0] | 28973 / 64709 ms |

### late

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 85.0% [71.7, 96.7] | 91.7% [81.7, 100.0] | 86.7% [73.3, 96.7] | 0.63 [0.11, 1.37] | 80.0% [66.7, 93.3] | 1.7% [0.0, 5.0] | 18.3% [6.7, 33.3] | 0.0% [0.0, 0.0] | 80.0% [66.7, 93.3] | 80.0% [60.0, 95.0] | 80.0% [60.0, 95.0] | 234 / 551 ms |
| Fixed 500 | 96.7% [91.7, 100.0] | 96.7% [91.7, 100.0] | 96.7% [91.7, 100.0] | 0.11 [0.00, 0.28] | 93.3% [85.0, 100.0] | 1.7% [0.0, 5.0] | 5.0% [0.0, 13.3] | 0.0% [0.0, 0.0] | 93.3% [85.0, 100.0] | 90.0% [75.0, 100.0] | 90.0% [75.0, 100.0] | 2830 / 1937 ms |
| Fixed 2000 | 98.3% [95.0, 100.0] | 98.3% [95.0, 100.0] | 98.3% [95.0, 100.0] | 0.04 [0.00, 0.12] | 95.0% [85.0, 100.0] | 0.0% [0.0, 0.0] | 5.0% [0.0, 15.0] | 0.0% [0.0, 0.0] | 95.0% [85.0, 100.0] | 95.0% [85.0, 100.0] | 95.0% [85.0, 100.0] | 3925 / 7102 ms |
| Adaptive | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 0.00 [0.00, 0.00] | 96.7% [90.0, 100.0] | 0.0% [0.0, 0.0] | 3.3% [0.0, 10.0] | 8.3% [0.0, 20.0] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 14224 / 9543 ms |

### block

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 76.7% [63.3, 90.0] | 96.7% [91.7, 100.0] | 81.7% [68.3, 93.3] | 0.35 [0.16, 0.59] | 81.7% [68.3, 93.3] | 6.7% [1.7, 13.3] | 11.7% [0.0, 26.7] | 0.0% [0.0, 0.0] | 81.7% [66.7, 93.3] | 65.0% [45.0, 85.0] | 60.0% [35.0, 80.0] | 226 / 774 ms |
| Fixed 500 | 81.7% [68.3, 93.3] | 100.0% [100.0, 100.0] | 88.3% [76.7, 98.3] | 0.20 [0.06, 0.39] | 93.3% [85.0, 100.0] | 3.3% [0.0, 8.3] | 3.3% [0.0, 10.0] | 0.0% [0.0, 0.0] | 93.3% [85.0, 100.0] | 80.0% [60.0, 95.0] | 70.0% [50.0, 90.0] | 913 / 2960 ms |
| Fixed 2000 | 91.7% [81.7, 100.0] | 100.0% [100.0, 100.0] | 96.7% [90.0, 100.0] | 0.07 [0.00, 0.18] | 95.0% [86.7, 100.0] | 5.0% [0.0, 13.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 95.0% [86.7, 100.0] | 95.0% [85.0, 100.0] | 85.0% [65.0, 100.0] | 3384 / 11151 ms |
| Adaptive | 90.0% [81.7, 96.7] | 100.0% [100.0, 100.0] | 95.0% [88.3, 100.0] | 0.10 [0.03, 0.19] | 100.0% [100.0, 100.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 18.3% [6.7, 33.3] | 100.0% [100.0, 100.0] | 85.0% [70.0, 100.0] | 100.0% [100.0, 100.0] | 4325 / 11646 ms |

## Results by legal-move count

### 2 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 76.6% [65.7, 86.5] | 95.5% [91.0, 99.1] | 83.8% [73.0, 91.9] | 0.36 [0.19, 0.56] | 91.0% [82.9, 96.4] | 3.6% [0.9, 7.2] | 5.4% [0.0, 12.6] | 0.0% [0.0, 0.0] | 91.0% [83.8, 97.3] | 70.3% [56.8, 86.5] | 67.6% [51.4, 83.8] | 493 / 1928 ms |
| Fixed 500 | 88.3% [80.2, 95.5] | 98.2% [95.5, 100.0] | 92.8% [86.5, 98.2] | 0.16 [0.05, 0.28] | 92.8% [86.5, 98.2] | 5.4% [0.9, 9.9] | 1.8% [0.0, 5.4] | 0.0% [0.0, 0.0] | 92.8% [87.4, 98.2] | 83.8% [70.3, 94.6] | 75.7% [62.1, 89.2] | 2243 / 7902 ms |
| Fixed 2000 | 94.6% [89.2, 99.1] | 100.0% [100.0, 100.0] | 96.4% [91.9, 100.0] | 0.05 [0.00, 0.12] | 93.7% [86.5, 99.1] | 3.6% [0.0, 8.1] | 2.7% [0.0, 8.1] | 0.0% [0.0, 0.0] | 93.7% [86.5, 99.1] | 91.9% [81.1, 100.0] | 89.2% [78.4, 97.3] | 14410 / 31989 ms |
| Adaptive | 91.9% [85.6, 97.3] | 100.0% [100.0, 100.0] | 93.7% [88.3, 98.2] | 0.10 [0.03, 0.18] | 98.2% [94.6, 100.0] | 0.0% [0.0, 0.0] | 1.8% [0.0, 5.4] | 18.9% [8.1, 30.6] | 100.0% [100.0, 100.0] | 86.5% [75.7, 97.3] | 100.0% [100.0, 100.0] | 7906 / 30156 ms |

### 3 to 5 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 62.4% [50.4, 73.5] | 88.0% [82.1, 94.0] | 76.1% [66.7, 84.6] | 0.94 [0.59, 1.33] | 80.3% [70.1, 89.7] | 4.3% [0.9, 7.7] | 15.4% [5.1, 25.6] | 0.0% [0.0, 0.0] | 80.3% [70.1, 90.6] | 51.3% [35.9, 66.7] | 46.2% [28.2, 61.5] | 1166 / 3520 ms |
| Fixed 500 | 72.6% [61.5, 82.9] | 97.4% [93.2, 100.0] | 91.5% [84.6, 97.4] | 0.27 [0.12, 0.48] | 90.6% [82.9, 96.6] | 2.6% [0.0, 5.1] | 6.8% [0.9, 13.7] | 0.0% [0.0, 0.0] | 90.6% [82.9, 96.6] | 82.1% [69.2, 92.3] | 64.1% [48.7, 79.5] | 5681 / 14768 ms |
| Fixed 2000 | 76.9% [65.0, 88.0] | 99.1% [97.4, 100.0] | 97.4% [92.3, 100.0] | 0.11 [0.04, 0.19] | 94.0% [86.3, 100.0] | 2.6% [0.0, 7.7] | 3.4% [0.0, 9.4] | 0.0% [0.0, 0.0] | 94.0% [86.3, 100.0] | 94.9% [87.2, 100.0] | 82.1% [69.2, 94.9] | 18591 / 55977 ms |
| Adaptive | 83.8% [73.5, 93.2] | 100.0% [100.0, 100.0] | 99.1% [97.4, 100.0] | 0.05 [0.01, 0.09] | 95.7% [88.9, 100.0] | 0.0% [0.0, 0.0] | 4.3% [0.0, 11.1] | 29.1% [17.1, 43.6] | 100.0% [100.0, 100.0] | 97.4% [92.3, 100.0] | 100.0% [100.0, 100.0] | 32168 / 66509 ms |

### 6 or more moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 58.3% [16.7, 91.7] | 91.7% [75.0, 100.0] | 58.3% [16.7, 91.7] | 0.97 [0.19, 1.74] | 25.0% [0.0, 50.0] | 8.3% [0.0, 25.0] | 66.7% [25.0, 100.0] | 0.0% [0.0, 0.0] | 25.0% [0.0, 50.0] | 25.0% [0.0, 75.0] | 25.0% [0.0, 75.0] | 10386 / 12688 ms |
| Fixed 500 | 75.0% [50.0, 100.0] | 100.0% [100.0, 100.0] | 75.0% [50.0, 100.0] | 0.30 [0.00, 0.59] | 50.0% [16.7, 83.3] | 0.0% [0.0, 0.0] | 50.0% [16.7, 91.7] | 0.0% [0.0, 0.0] | 50.0% [16.7, 83.3] | 50.0% [0.0, 100.0] | 50.0% [0.0, 100.0] | 41203 / 47695 ms |
| Fixed 2000 | 83.3% [66.7, 100.0] | 100.0% [100.0, 100.0] | 91.7% [75.0, 100.0] | 0.17 [0.00, 0.33] | 83.3% [50.0, 100.0] | 16.7% [0.0, 50.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 83.3% [50.0, 100.0] | 75.0% [25.0, 100.0] | 50.0% [0.0, 100.0] | 321851 / 1035573 ms |
| Adaptive | 66.7% [33.3, 100.0] | 100.0% [100.0, 100.0] | 66.7% [33.3, 100.0] | 0.40 [0.00, 0.79] | 75.0% [66.7, 91.7] | 0.0% [0.0, 0.0] | 25.0% [8.3, 33.3] | 50.0% [33.3, 83.3] | 100.0% [100.0, 100.0] | 50.0% [0.0, 100.0] | 100.0% [100.0, 100.0] | 240733 / 639425 ms |

## Exact endgame diagnostic

31 positions were small enough for the deal-specific exact solver. The information-safe reference selected an exact winning action in 90.3% of them. This is diagnostic only because the exact solver sees the realized hidden deal and the analyzer correctly does not.

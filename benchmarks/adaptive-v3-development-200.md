# Mesa Quince adaptive analyzer reliability study

Generated: 2026-09-22T19:18:15.745Z

## Configuration

- 200 positions: 50 opening, 50 middle, 50 late, 50 block
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
- Seed: `mesa-quince-adaptive-v3-development-v1`
- Adaptive implementation: `adaptive-confirmed-v2`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Conclusion

The adaptive analyzer **failed the release gate** and must remain outside the live coach. It matched or improved fixed 2000 on the combined near-optimality, regret, and repeatability comparison. It used 13.2% fewer paired samples and 1.7% less mean wall time, while its false-positive mistake rate changed by -3.00 percentage points.

The sampler allocated more computation to harder decisions: reference-unclear positions used 1.23 times as many samples as reference-clear positions. Its median stopping budget was 2000, 67.0% of recommendations ended uncertain, and 24.8% of coaching labels abstained. Failed release checks: mistakeLabelAgreement.

This V2 sampler widens uncertainty when independent batches disagree, requires a fresh confirmation batch before early stopping, delays decisions according to phase and legal-move count, and treats statistically equivalent moves as one plausible-best set. Recommendation confidence and mistake confidence are separate, so the coach can abstain from a mistake label even when it still offers a tentative move.

## Overall results

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 72.2% [67.8, 76.5] | 90.0% [87.5, 92.5] | 82.0% [78.3, 85.3] | 0.69 [0.56, 0.83] | 87.8% [83.5, 91.7] | 2.0% [1.0, 3.3] | 10.2% [6.5, 14.5] | 0.0% [0.0, 0.0] | 87.8% [83.5, 91.7] | 62.0% [55.0, 68.5] | 50.5% [43.5, 57.5] | 6586 / 9512 ms |
| Fixed 500 | 82.2% [78.3, 85.8] | 96.3% [94.3, 98.2] | 91.0% [87.8, 93.7] | 0.28 [0.20, 0.36] | 92.0% [88.8, 94.7] | 1.8% [0.8, 3.0] | 6.2% [3.5, 9.2] | 0.0% [0.0, 0.0] | 92.0% [88.8, 94.7] | 81.0% [75.0, 86.5] | 66.0% [59.0, 72.5] | 30388 / 42566 ms |
| Fixed 2000 | 89.0% [85.8, 92.0] | 99.5% [98.8, 100.0] | 95.7% [93.5, 97.5] | 0.11 [0.07, 0.15] | 94.7% [92.0, 97.2] | 3.3% [1.5, 5.5] | 2.0% [0.7, 3.8] | 0.0% [0.0, 0.0] | 94.7% [92.0, 97.2] | 91.5% [87.5, 95.0] | 80.5% [75.0, 86.0] | 116556 / 157544 ms |
| Adaptive | 86.7% [82.8, 90.2] | 99.7% [99.0, 100.0] | 95.7% [93.7, 97.5] | 0.12 [0.08, 0.16] | 93.8% [90.8, 96.5] | 0.3% [0.0, 0.8] | 5.8% [3.2, 9.0] | 24.8% [19.8, 29.8] | 98.9% [97.1, 100.0] | 90.5% [86.0, 94.5] | 100.0% [100.0, 100.0] | 114629 / 166610 ms |

## Adaptive computation

- Mean samples: 1735.00 [1675.83, 1795.00]
- Median samples: 2000
- P95 samples: 2000
- Maximum samples: 2000
- Hard-cap rate: 67.0% [61.2, 72.8]
- Uncertain-at-stop rate: 67.0% [60.7, 72.7]
- Mean plausible-best set size: 1.74 [1.62, 1.86]
- Coaching-label abstention rate: 24.8% [19.8, 29.8]
- Accuracy among non-abstained coaching labels: 98.9% [97.1, 100.0]
- Mean samples on reference-clear positions: 1629.37 [1547.73, 1704.02]
- Mean samples on reference-unclear positions: 2000.00 [2000.00, 2000.00]

| Stopping stage | Trials | Share |
| ---: | ---: | ---: |
| 500 | 56 | 9.3% |
| 1000 | 75 | 12.5% |
| 2000 | 469 | 78.2% |

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
| Fixed 120 | 58.7% [50.6, 66.7] | 80.7% [74.7, 86.0] | 68.0% [60.0, 76.0] | 1.16 [0.88, 1.45] | 78.0% [68.0, 88.0] | 3.3% [0.7, 7.3] | 18.7% [9.3, 30.0] | 0.0% [0.0, 0.0] | 78.0% [67.3, 88.0] | 34.0% [22.0, 48.0] | 24.0% [14.0, 38.0] | 25025 / 14150 ms |
| Fixed 500 | 70.7% [61.3, 79.3] | 92.0% [85.3, 97.3] | 80.7% [72.0, 88.7] | 0.51 [0.29, 0.77] | 84.7% [76.6, 92.0] | 2.7% [0.7, 5.3] | 12.7% [5.3, 21.3] | 0.0% [0.0, 0.0] | 84.7% [76.7, 92.0] | 64.0% [52.0, 78.0] | 50.0% [34.0, 64.0] | 116554 / 625377 ms |
| Fixed 2000 | 80.0% [70.7, 88.0] | 99.3% [98.0, 100.0] | 91.3% [85.3, 96.7] | 0.20 [0.10, 0.33] | 88.0% [80.7, 94.7] | 8.0% [2.0, 16.0] | 4.0% [0.7, 8.7] | 0.0% [0.0, 0.0] | 88.0% [79.3, 95.3] | 82.0% [70.0, 92.0] | 70.0% [56.0, 82.0] | 448220 / 2716900 ms |
| Adaptive | 82.0% [74.0, 88.7] | 98.7% [96.0, 100.0] | 90.0% [83.3, 95.3] | 0.23 [0.12, 0.36] | 84.7% [75.3, 93.3] | 1.3% [0.0, 3.3] | 14.0% [5.3, 23.3] | 47.3% [36.7, 58.7] | 94.6% [86.5, 100.0] | 80.0% [68.0, 90.0] | 100.0% [100.0, 100.0] | 436859 / 2523300 ms |

### middle

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 68.7% [59.3, 77.3] | 90.0% [84.7, 94.7] | 80.7% [73.3, 88.0] | 0.73 [0.46, 1.04] | 86.7% [78.0, 94.7] | 2.0% [0.0, 4.7] | 11.3% [4.0, 20.7] | 0.0% [0.0, 0.0] | 86.7% [77.3, 94.7] | 60.0% [46.0, 74.0] | 44.0% [30.0, 58.0] | 907 / 1851 ms |
| Fixed 500 | 80.7% [72.7, 88.7] | 98.0% [95.3, 100.0] | 92.7% [86.7, 97.3] | 0.24 [0.11, 0.40] | 90.0% [84.0, 96.0] | 3.3% [0.7, 7.3] | 6.7% [2.0, 12.7] | 0.0% [0.0, 0.0] | 90.0% [82.7, 96.0] | 84.0% [74.0, 94.0] | 64.0% [50.0, 78.0] | 3504 / 7384 ms |
| Fixed 2000 | 89.3% [84.0, 94.0] | 100.0% [100.0, 100.0] | 98.0% [95.3, 100.0] | 0.07 [0.03, 0.14] | 93.3% [86.7, 98.0] | 2.7% [0.0, 6.7] | 4.0% [0.0, 10.0] | 0.0% [0.0, 0.0] | 93.3% [86.7, 98.7] | 96.0% [90.0, 100.0] | 74.0% [62.0, 84.0] | 12673 / 27228 ms |
| Adaptive | 80.0% [72.0, 87.3] | 100.0% [100.0, 100.0] | 95.3% [91.3, 98.7] | 0.15 [0.08, 0.23] | 94.0% [87.3, 98.7] | 0.0% [0.0, 0.0] | 6.0% [1.3, 12.7] | 27.3% [18.6, 37.3] | 100.0% [100.0, 100.0] | 88.0% [78.0, 96.0] | 100.0% [100.0, 100.0] | 14083 / 30579 ms |

### late

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 88.7% [82.0, 94.0] | 95.3% [91.3, 98.7] | 92.7% [88.0, 97.3] | 0.36 [0.13, 0.67] | 87.3% [79.3, 94.7] | 2.0% [0.0, 4.7] | 10.7% [4.0, 18.7] | 0.0% [0.0, 0.0] | 87.3% [79.3, 94.0] | 82.0% [70.0, 92.0] | 74.0% [62.0, 84.0] | 159 / 360 ms |
| Fixed 500 | 90.7% [84.0, 96.0] | 97.3% [94.0, 100.0] | 96.0% [92.0, 99.3] | 0.15 [0.04, 0.28] | 94.0% [88.0, 98.7] | 0.7% [0.0, 2.0] | 5.3% [0.7, 10.7] | 0.0% [0.0, 0.0] | 94.0% [88.0, 98.7] | 90.0% [82.0, 98.0] | 82.0% [70.0, 92.0] | 567 / 1391 ms |
| Fixed 2000 | 98.0% [94.7, 100.0] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 0.00 [0.00, 0.01] | 98.7% [96.0, 100.0] | 1.3% [0.0, 4.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 98.7% [96.0, 100.0] | 100.0% [100.0, 100.0] | 96.0% [90.0, 100.0] | 1928 / 4921 ms |
| Adaptive | 94.0% [88.0, 98.7] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 0.03 [0.00, 0.06] | 96.7% [91.3, 100.0] | 0.0% [0.0, 0.0] | 3.3% [0.0, 8.7] | 12.7% [5.3, 22.0] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 100.0% [100.0, 100.0] | 3121 / 6709 ms |

### block

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 72.7% [64.0, 82.0] | 94.0% [90.0, 97.3] | 86.7% [80.0, 92.7] | 0.51 [0.31, 0.75] | 99.3% [98.0, 100.0] | 0.7% [0.0, 2.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 99.3% [98.0, 100.0] | 72.0% [58.0, 84.0] | 60.0% [46.0, 72.0] | 254 / 867 ms |
| Fixed 500 | 86.7% [80.7, 92.0] | 98.0% [95.3, 100.0] | 94.7% [90.7, 98.0] | 0.21 [0.10, 0.34] | 99.3% [98.0, 100.0] | 0.7% [0.0, 2.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 99.3% [98.0, 100.0] | 86.0% [76.0, 96.0] | 68.0% [54.0, 80.0] | 927 / 3771 ms |
| Fixed 2000 | 88.7% [80.7, 95.3] | 98.7% [96.7, 100.0] | 93.3% [87.3, 98.0] | 0.15 [0.07, 0.25] | 98.7% [96.7, 100.0] | 1.3% [0.0, 3.3] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 98.7% [96.7, 100.0] | 88.0% [78.0, 96.0] | 82.0% [70.0, 92.0] | 3403 / 12605 ms |
| Adaptive | 90.7% [82.7, 96.7] | 100.0% [100.0, 100.0] | 97.3% [94.0, 100.0] | 0.07 [0.02, 0.12] | 100.0% [100.0, 100.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 12.0% [4.7, 20.0] | 100.0% [100.0, 100.0] | 94.0% [86.0, 100.0] | 100.0% [100.0, 100.0] | 4455 / 15989 ms |

## Results by legal-move count

### 2 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 81.8% [76.3, 87.0] | 94.8% [92.1, 97.3] | 89.7% [84.9, 93.8] | 0.42 [0.27, 0.59] | 95.2% [91.4, 98.6] | 1.4% [0.0, 3.1] | 3.4% [0.7, 6.9] | 0.0% [0.0, 0.0] | 95.2% [91.1, 98.3] | 78.4% [70.1, 85.6] | 69.1% [59.8, 78.4] | 2903 / 1900 ms |
| Fixed 500 | 90.0% [85.6, 93.8] | 97.9% [95.9, 99.7] | 95.9% [93.1, 98.3] | 0.14 [0.07, 0.21] | 97.3% [94.2, 99.3] | 0.3% [0.0, 1.0] | 2.4% [0.0, 5.5] | 0.0% [0.0, 0.0] | 97.3% [94.2, 100.0] | 89.7% [83.5, 95.9] | 78.4% [70.1, 85.6] | 15866 / 7396 ms |
| Fixed 2000 | 96.6% [94.5, 98.6] | 99.7% [99.0, 100.0] | 99.0% [97.3, 100.0] | 0.03 [0.01, 0.06] | 97.6% [94.8, 99.7] | 1.7% [0.0, 4.5] | 0.7% [0.0, 1.7] | 0.0% [0.0, 0.0] | 97.6% [94.8, 99.7] | 97.9% [94.8, 100.0] | 90.7% [84.5, 95.9] | 43332 / 28614 ms |
| Adaptive | 91.8% [87.3, 95.9] | 100.0% [100.0, 100.0] | 98.6% [97.3, 99.7] | 0.05 [0.02, 0.08] | 98.3% [95.9, 100.0] | 0.3% [0.0, 1.0] | 1.4% [0.0, 3.4] | 9.3% [5.2, 14.1] | 98.9% [96.8, 100.0] | 95.9% [91.8, 99.0] | 100.0% [100.0, 100.0] | 19110 / 29900 ms |

### 3 to 5 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 64.9% [58.3, 71.7] | 87.7% [83.3, 91.3] | 77.2% [71.7, 82.6] | 0.82 [0.63, 1.03] | 84.4% [77.5, 90.6] | 2.9% [1.1, 5.1] | 12.7% [6.5, 19.6] | 0.0% [0.0, 0.0] | 84.4% [77.9, 90.6] | 50.0% [39.1, 59.8] | 35.9% [26.1, 45.7] | 5017 / 3642 ms |
| Fixed 500 | 76.4% [69.9, 82.6] | 96.7% [94.2, 98.9] | 88.4% [83.7, 93.1] | 0.34 [0.23, 0.47] | 88.0% [83.0, 93.1] | 3.6% [1.4, 6.2] | 8.3% [4.0, 13.1] | 0.0% [0.0, 0.0] | 88.0% [82.6, 92.8] | 75.0% [66.3, 82.6] | 56.5% [45.7, 67.4] | 15667 / 15086 ms |
| Fixed 2000 | 81.9% [75.7, 87.7] | 99.3% [98.2, 100.0] | 93.1% [88.4, 96.7] | 0.18 [0.11, 0.25] | 91.3% [85.5, 95.7] | 5.4% [2.2, 9.8] | 3.3% [0.4, 7.2] | 0.0% [0.0, 0.0] | 91.3% [85.9, 96.0] | 87.0% [79.3, 93.5] | 72.8% [64.1, 81.5] | 84645 / 64395 ms |
| Adaptive | 81.9% [75.7, 87.7] | 99.3% [97.8, 100.0] | 92.8% [88.4, 96.4] | 0.19 [0.12, 0.27] | 91.7% [85.9, 96.4] | 0.4% [0.0, 1.1] | 8.0% [3.3, 13.4] | 37.7% [29.7, 46.4] | 98.6% [95.9, 100.0] | 84.8% [77.2, 91.3] | 100.0% [100.0, 100.0] | 92110 / 62190 ms |

### 6 or more moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 48.5% [30.3, 66.7] | 66.7% [54.5, 78.8] | 54.5% [33.3, 72.7] | 1.96 [1.17, 2.71] | 51.5% [24.2, 78.8] | 0.0% [0.0, 0.0] | 48.5% [21.2, 81.8] | 0.0% [0.0, 0.0] | 51.5% [24.2, 78.8] | 18.2% [0.0, 45.5] | 9.1% [0.0, 27.3] | 52190 / 143015 ms |
| Fixed 500 | 60.6% [39.4, 81.8] | 78.8% [54.5, 100.0] | 69.7% [45.5, 90.9] | 1.00 [0.22, 2.00] | 78.8% [57.6, 97.0] | 0.0% [0.0, 0.0] | 21.2% [3.0, 42.4] | 0.0% [0.0, 0.0] | 78.8% [57.6, 97.0] | 54.5% [27.3, 81.8] | 36.4% [9.1, 63.6] | 281565 / 1335807 ms |
| Fixed 2000 | 81.8% [69.7, 93.9] | 100.0% [100.0, 100.0] | 87.9% [75.8, 100.0] | 0.22 [0.04, 0.44] | 97.0% [90.9, 100.0] | 0.0% [0.0, 0.0] | 3.0% [0.0, 9.1] | 0.0% [0.0, 0.0] | 97.0% [90.9, 100.0] | 72.7% [45.5, 100.0] | 54.5% [18.2, 81.8] | 1029153 / 5331558 ms |
| Adaptive | 81.8% [63.6, 100.0] | 100.0% [100.0, 100.0] | 93.9% [81.8, 100.0] | 0.15 [0.00, 0.40] | 72.7% [48.5, 93.9] | 0.0% [0.0, 0.0] | 27.3% [6.1, 54.5] | 54.5% [30.3, 75.8] | 100.0% [100.0, 100.0] | 90.9% [72.7, 100.0] | 100.0% [100.0, 100.0] | 1145281 / 5557483 ms |

## Exact endgame diagnostic

79 positions were small enough for the deal-specific exact solver. The information-safe reference selected an exact winning action in 94.9% of them. This is diagnostic only because the exact solver sees the realized hidden deal and the analyzer correctly does not.

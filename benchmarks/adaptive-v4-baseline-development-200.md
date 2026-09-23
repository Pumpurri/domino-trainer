# Mesa Quince adaptive analyzer reliability study

Generated: 2026-09-23T02:20:56.192Z

## Configuration

- 200 positions: 50 opening, 50 middle, 50 late, 50 block
- 3 independent repetitions per analyzer
- Fixed budgets: 120, 500, 2000
- Adaptive stages: 120, 250, 500, 1000, 2000
- Candidate-only refinement: disabled
- Recommendation equivalence gap: 1 point(s)
- Mistake practical gap: 0.5 point(s)
- Mistake minimum estimated loss: 3 point(s)
- Mistake batch agreement: 60%
- Mistake practical batch agreement: 50%
- Independent reference: 5000 samples
- Worker threads: 9
- Seed: `mesa-quince-adaptive-v4-development-v1`
- Adaptive implementation: `adaptive-confirmed-v3-labels`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Conclusion

The adaptive analyzer **failed the release gate** and must remain outside the live coach. It matched or improved fixed 2000 on the combined near-optimality, regret, and repeatability comparison. It used 11.1% fewer paired samples and -2.5% less mean wall time, while its false-positive mistake rate changed by -1.17 percentage points.

The sampler allocated more computation to harder decisions: reference-unclear positions used 1.19 times as many samples as reference-clear positions. Its median stopping budget was 2000, 75.8% of recommendations ended uncertain, and 26.7% of coaching labels abstained. Failed release checks: mistakeLabelAgreement, repeatAcceptability.

This adaptive sampler widens uncertainty when independent batches disagree, requires a fresh confirmation batch before early stopping, delays decisions according to phase and legal-move count, and treats statistically equivalent moves as one plausible-best set. Recommendation confidence and mistake confidence are separate, so the coach can abstain from a mistake label even when it still offers a tentative move.

## Overall results

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 71.5% [67.3, 75.7] | 90.3% [87.5, 92.8] | 80.0% [76.2, 83.5] | 0.66 [0.54, 0.80] | 88.2% [84.3, 91.8] | 1.0% [0.2, 1.8] | 10.8% [7.3, 14.8] | 0.0% [0.0, 0.0] | 88.2% [84.2, 91.8] | 57.5% [51.0, 64.5] | 46.0% [39.0, 53.0] | 1377 / 5300 ms |
| Fixed 500 | 76.8% [72.8, 80.7] | 96.7% [94.8, 98.3] | 86.3% [82.8, 89.7] | 0.33 [0.26, 0.40] | 92.0% [88.8, 94.8] | 1.7% [0.7, 3.0] | 6.3% [3.7, 9.2] | 0.0% [0.0, 0.0] | 92.0% [89.0, 95.0] | 72.0% [65.5, 78.0] | 59.0% [52.0, 65.5] | 5255 / 20581 ms |
| Fixed 2000 | 85.8% [82.0, 89.3] | 99.2% [98.2, 99.8] | 93.2% [90.7, 95.5] | 0.14 [0.09, 0.19] | 95.2% [92.8, 97.2] | 2.5% [1.2, 4.0] | 2.3% [0.8, 4.2] | 0.0% [0.0, 0.0] | 95.2% [92.8, 97.2] | 86.0% [81.5, 90.5] | 75.0% [69.0, 81.0] | 19332 / 80648 ms |
| Adaptive | 88.8% [85.7, 92.0] | 99.3% [98.7, 99.8] | 95.0% [92.8, 97.0] | 0.11 [0.08, 0.15] | 92.0% [89.2, 94.7] | 1.3% [0.5, 2.5] | 6.7% [4.0, 9.5] | 26.7% [21.8, 31.7] | 96.0% [93.2, 98.3] | 89.0% [84.5, 93.0] | 100.0% [100.0, 100.0] | 19810 / 82045 ms |

## Adaptive computation

- Mean samples: 1777.50 [1713.29, 1835.83]
- Median samples: 2000
- P95 samples: 2000
- Maximum samples: 2000
- Hard-cap rate: 75.8% [70.8, 80.7]
- Uncertain-at-stop rate: 75.8% [70.5, 81.0]
- Candidate-refinement rate: 0.0% [0.0, 0.0]
- Mean plausible-best set size: 1.76 [1.63, 1.88]
- Coaching-label abstention rate: 26.7% [21.8, 31.7]
- Accuracy among non-abstained coaching labels: 96.0% [93.2, 98.3]
- Mean samples on reference-clear positions: 1678.83 [1588.75, 1757.91]
- Mean samples on reference-unclear positions: 1992.06 [1976.19, 2000.00]

| Stopping stage | Trials | Share |
| ---: | ---: | ---: |
| 500 | 53 | 8.8% |
| 1000 | 54 | 9.0% |
| 2000 | 493 | 82.2% |

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
| Fixed 120 | 56.0% [47.3, 64.7] | 84.7% [77.3, 91.3] | 68.0% [59.3, 76.7] | 1.09 [0.80, 1.39] | 75.3% [64.7, 84.7] | 2.7% [0.0, 6.0] | 22.0% [12.7, 31.3] | 0.0% [0.0, 0.0] | 75.3% [66.0, 84.7] | 40.0% [26.0, 52.0] | 20.0% [10.0, 32.0] | 4555 / 13112 ms |
| Fixed 500 | 69.3% [60.0, 77.3] | 96.7% [93.3, 99.3] | 81.3% [74.0, 87.3] | 0.44 [0.28, 0.61] | 86.7% [78.0, 93.3] | 1.3% [0.0, 3.3] | 12.0% [5.3, 20.0] | 0.0% [0.0, 0.0] | 86.7% [77.3, 94.0] | 62.0% [50.0, 76.0] | 44.0% [30.0, 60.0] | 17423 / 51538 ms |
| Fixed 2000 | 80.0% [72.0, 87.3] | 98.7% [96.0, 100.0] | 89.3% [82.7, 95.3] | 0.22 [0.11, 0.35] | 93.3% [88.0, 98.0] | 4.0% [0.7, 8.0] | 2.7% [0.0, 7.3] | 0.0% [0.0, 0.0] | 93.3% [87.3, 98.0] | 80.0% [70.0, 90.0] | 64.0% [50.0, 78.0] | 64140 / 192979 ms |
| Adaptive | 86.0% [78.0, 93.3] | 99.3% [98.0, 100.0] | 92.0% [86.0, 97.3] | 0.17 [0.08, 0.27] | 86.0% [78.0, 92.7] | 1.3% [0.0, 4.0] | 12.7% [6.0, 19.3] | 35.3% [24.7, 45.3] | 97.6% [92.7, 100.0] | 84.0% [72.0, 94.0] | 100.0% [100.0, 100.0] | 63907 / 207400 ms |

### middle

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 70.7% [63.3, 78.7] | 90.0% [84.0, 94.7] | 79.3% [71.3, 86.7] | 0.73 [0.47, 1.04] | 94.7% [88.0, 99.3] | 0.7% [0.0, 2.0] | 4.7% [0.0, 10.7] | 0.0% [0.0, 0.0] | 94.7% [88.7, 99.3] | 56.0% [42.0, 68.0] | 44.0% [30.0, 58.0] | 664 / 1334 ms |
| Fixed 500 | 74.7% [66.7, 82.0] | 95.3% [91.3, 98.7] | 85.3% [79.3, 91.3] | 0.35 [0.22, 0.48] | 94.0% [88.7, 98.0] | 2.0% [0.0, 4.0] | 4.0% [0.0, 9.3] | 0.0% [0.0, 0.0] | 94.0% [88.7, 98.7] | 68.0% [56.0, 80.0] | 52.0% [38.0, 66.0] | 2557 / 5051 ms |
| Fixed 2000 | 88.7% [82.7, 94.0] | 98.0% [95.3, 100.0] | 95.3% [91.3, 98.7] | 0.13 [0.05, 0.22] | 96.7% [93.3, 99.3] | 2.0% [0.0, 4.7] | 1.3% [0.0, 4.0] | 0.0% [0.0, 0.0] | 96.7% [92.7, 99.3] | 88.0% [78.0, 96.0] | 76.0% [64.0, 88.0] | 9484 / 18650 ms |
| Adaptive | 87.3% [79.3, 93.3] | 99.3% [98.0, 100.0] | 94.0% [89.3, 98.0] | 0.14 [0.06, 0.23] | 96.0% [92.0, 99.3] | 1.3% [0.0, 3.3] | 2.7% [0.0, 6.0] | 28.0% [17.3, 38.0] | 95.6% [88.9, 100.0] | 88.0% [78.0, 96.0] | 100.0% [100.0, 100.0] | 10330 / 19993 ms |

### late

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 80.0% [72.0, 87.3] | 94.7% [90.0, 98.7] | 88.7% [82.6, 94.7] | 0.37 [0.16, 0.60] | 96.0% [91.3, 99.3] | 0.0% [0.0, 0.0] | 4.0% [0.7, 8.0] | 0.0% [0.0, 0.0] | 96.0% [92.0, 99.3] | 76.0% [64.0, 86.0] | 66.0% [52.0, 78.0] | 81 / 227 ms |
| Fixed 500 | 84.0% [76.7, 90.7] | 98.7% [96.7, 100.0] | 91.3% [85.3, 96.7] | 0.20 [0.09, 0.33] | 96.0% [90.7, 100.0] | 1.3% [0.0, 4.0] | 2.7% [0.0, 7.3] | 0.0% [0.0, 0.0] | 96.0% [90.7, 100.0] | 82.0% [70.0, 92.0] | 72.0% [58.0, 84.0] | 291 / 859 ms |
| Fixed 2000 | 86.7% [79.3, 93.3] | 100.0% [100.0, 100.0] | 94.0% [88.0, 98.7] | 0.10 [0.04, 0.17] | 97.3% [94.7, 99.3] | 1.3% [0.0, 3.3] | 1.3% [0.0, 3.3] | 0.0% [0.0, 0.0] | 97.3% [94.7, 99.3] | 88.0% [78.0, 96.0] | 80.0% [68.0, 90.0] | 1005 / 3131 ms |
| Adaptive | 89.3% [82.6, 95.3] | 99.3% [98.0, 100.0] | 96.7% [92.7, 99.3] | 0.08 [0.02, 0.15] | 96.0% [92.0, 99.3] | 1.3% [0.0, 3.3] | 2.7% [0.0, 6.7] | 18.0% [10.7, 26.7] | 95.7% [89.4, 100.0] | 92.0% [84.0, 98.0] | 100.0% [100.0, 100.0] | 1754 / 4074 ms |

### block

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 79.3% [71.3, 86.7] | 92.0% [87.3, 96.0] | 84.0% [78.0, 89.3] | 0.46 [0.30, 0.65] | 86.7% [77.3, 94.0] | 0.7% [0.0, 2.0] | 12.7% [4.7, 21.3] | 0.0% [0.0, 0.0] | 86.7% [77.3, 94.7] | 58.0% [44.0, 72.0] | 54.0% [40.0, 68.0] | 207 / 806 ms |
| Fixed 500 | 79.3% [70.0, 88.0] | 96.0% [90.7, 99.3] | 87.3% [80.0, 93.3] | 0.31 [0.17, 0.47] | 91.3% [84.7, 96.7] | 2.0% [0.0, 5.3] | 6.7% [2.0, 12.0] | 0.0% [0.0, 0.0] | 91.3% [85.3, 96.7] | 76.0% [64.0, 88.0] | 68.0% [56.0, 80.0] | 749 / 2562 ms |
| Fixed 2000 | 88.0% [80.7, 94.7] | 100.0% [100.0, 100.0] | 94.0% [88.0, 98.0] | 0.11 [0.04, 0.19] | 93.3% [87.3, 98.0] | 2.7% [0.0, 6.0] | 4.0% [0.7, 9.3] | 0.0% [0.0, 0.0] | 93.3% [87.3, 98.0] | 88.0% [78.0, 96.0] | 80.0% [68.0, 92.0] | 2700 / 9370 ms |
| Adaptive | 92.7% [86.7, 97.3] | 99.3% [98.0, 100.0] | 97.3% [94.7, 99.3] | 0.07 [0.02, 0.14] | 90.0% [82.7, 96.0] | 1.3% [0.0, 3.3] | 8.7% [2.7, 16.7] | 25.3% [16.0, 36.0] | 95.3% [88.4, 100.0] | 92.0% [84.0, 98.0] | 100.0% [100.0, 100.0] | 3248 / 11482 ms |

## Results by legal-move count

### 2 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 75.9% [70.4, 81.4] | 93.8% [90.4, 96.9] | 82.8% [77.7, 87.6] | 0.45 [0.32, 0.60] | 94.2% [89.7, 97.9] | 0.3% [0.0, 1.0] | 5.5% [1.7, 10.0] | 0.0% [0.0, 0.0] | 94.2% [89.7, 97.9] | 63.9% [53.6, 73.2] | 53.6% [42.3, 63.9] | 401 / 1894 ms |
| Fixed 500 | 81.8% [76.3, 86.6] | 97.3% [94.2, 99.7] | 88.7% [83.8, 92.4] | 0.25 [0.17, 0.35] | 95.2% [91.4, 97.9] | 2.1% [0.3, 4.1] | 2.7% [0.3, 5.8] | 0.0% [0.0, 0.0] | 95.2% [91.4, 98.3] | 76.3% [67.0, 84.5] | 64.9% [55.7, 73.2] | 1562 / 7541 ms |
| Fixed 2000 | 86.3% [81.1, 91.1] | 99.3% [98.3, 100.0] | 92.1% [88.3, 95.9] | 0.15 [0.09, 0.21] | 96.6% [93.5, 99.0] | 1.4% [0.3, 2.7] | 2.1% [0.0, 4.8] | 0.0% [0.0, 0.0] | 96.6% [93.1, 99.0] | 83.5% [76.3, 90.7] | 76.3% [67.0, 84.5] | 5890 / 29370 ms |
| Adaptive | 89.7% [84.5, 94.2] | 99.3% [98.3, 100.0] | 95.9% [93.1, 98.3] | 0.10 [0.06, 0.16] | 96.6% [93.1, 99.0] | 1.0% [0.0, 2.4] | 2.4% [0.3, 4.8] | 24.7% [17.5, 32.0] | 96.5% [92.9, 100.0] | 89.7% [83.5, 94.8] | 100.0% [100.0, 100.0] | 6387 / 31070 ms |

### 3 to 5 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 69.6% [63.0, 75.8] | 87.2% [82.8, 91.2] | 79.1% [73.6, 84.2] | 0.78 [0.57, 0.99] | 83.9% [77.3, 90.1] | 0.7% [0.0, 1.8] | 15.4% [9.2, 22.0] | 0.0% [0.0, 0.0] | 83.9% [77.3, 90.1] | 53.8% [45.1, 63.7] | 41.8% [31.9, 52.7] | 1309 / 4342 ms |
| Fixed 500 | 73.6% [67.0, 79.9] | 96.0% [93.4, 98.2] | 84.6% [79.9, 89.4] | 0.37 [0.26, 0.50] | 89.7% [84.6, 94.5] | 0.7% [0.0, 1.8] | 9.5% [4.8, 15.0] | 0.0% [0.0, 0.0] | 89.7% [84.2, 94.5] | 68.1% [58.2, 78.0] | 54.9% [44.0, 65.9] | 5067 / 17539 ms |
| Fixed 2000 | 86.8% [81.7, 91.9] | 98.9% [97.1, 100.0] | 94.9% [91.2, 98.2] | 0.12 [0.06, 0.18] | 94.5% [90.8, 97.4] | 2.6% [0.7, 4.8] | 2.9% [0.7, 5.9] | 0.0% [0.0, 0.0] | 94.5% [91.2, 97.4] | 89.0% [82.4, 95.6] | 74.7% [65.9, 83.5] | 18716 / 62516 ms |
| Adaptive | 88.6% [83.5, 93.0] | 99.6% [98.9, 100.0] | 95.2% [91.6, 98.2] | 0.10 [0.05, 0.16] | 87.2% [81.3, 92.3] | 1.8% [0.4, 4.0] | 11.0% [6.2, 16.1] | 24.9% [18.3, 31.9] | 95.2% [90.5, 100.0] | 90.1% [83.5, 95.6] | 100.0% [100.0, 100.0] | 18994 / 62456 ms |

### 6 or more moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 50.0% [30.6, 69.4] | 86.1% [74.9, 97.2] | 63.9% [41.7, 80.6] | 1.53 [0.67, 2.52] | 72.2% [55.6, 88.9] | 8.3% [0.0, 19.4] | 19.4% [5.6, 36.1] | 0.0% [0.0, 0.0] | 72.2% [55.6, 88.9] | 33.3% [8.3, 58.3] | 16.7% [0.0, 41.7] | 9774 / 15982 ms |
| Fixed 500 | 61.1% [36.1, 83.3] | 97.2% [91.7, 100.0] | 80.6% [61.1, 97.2] | 0.55 [0.19, 0.95] | 83.3% [69.4, 97.2] | 5.6% [0.0, 13.9] | 11.1% [0.0, 27.8] | 0.0% [0.0, 0.0] | 83.3% [66.7, 97.2] | 66.7% [41.7, 91.7] | 41.7% [16.7, 66.7] | 36534 / 57131 ms |
| Fixed 2000 | 75.0% [52.8, 94.4] | 100.0% [100.0, 100.0] | 88.9% [72.2, 100.0] | 0.25 [0.05, 0.54] | 88.9% [77.8, 100.0] | 11.1% [2.8, 25.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 88.9% [75.0, 97.3] | 83.3% [58.3, 100.0] | 66.7% [41.7, 91.7] | 132663 / 214464 ms |
| Adaptive | 83.3% [66.7, 97.2] | 97.2% [91.7, 100.0] | 86.1% [72.2, 100.0] | 0.28 [0.03, 0.54] | 91.7% [80.5, 100.0] | 0.0% [0.0, 0.0] | 8.3% [0.0, 22.2] | 55.6% [30.6, 77.8] | 100.0% [100.0, 100.0] | 75.0% [50.0, 100.0] | 100.0% [100.0, 100.0] | 134503 / 218619 ms |

## Exact endgame diagnostic

78 positions were small enough for the deal-specific exact solver. The information-safe reference selected an exact winning action in 91.0% of them. This is diagnostic only because the exact solver sees the realized hidden deal and the analyzer correctly does not.

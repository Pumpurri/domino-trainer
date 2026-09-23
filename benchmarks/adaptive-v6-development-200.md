# Mesa Quince adaptive analyzer reliability study

Generated: 2026-09-23T23:30:27.827Z

## Configuration

- 200 positions: 50 opening, 50 middle, 50 late, 50 block
- 3 independent repetitions per analyzer
- Fixed budgets: 120, 500, 2000
- Adaptive stages: 120, 250, 500, 1000, 2000
- Candidate-only refinement: disabled
- Paired pre-refinement control: not requested
- Robust selection policies: disabled
- Phase-aware sampling policies: phase-aware
- Recommendation equivalence gap: 1 point(s)
- Mistake practical gap: 0.5 point(s)
- Mistake minimum estimated loss: 3 point(s)
- Mistake batch agreement: 60%
- Mistake practical batch agreement: 50%
- Independent reference: 5000 samples
- Worker threads: 9
- Seed: `mesa-quince-adaptive-v6-development-v1`
- Adaptive implementation: `adaptive-confirmed-v3-labels`

The reference is an independent high-budget estimate, not perfect ground truth. Every analyzer sees only the learner's hand and public evidence. Opponent hands and sleeping tiles are replaced with placeholders before analysis.

## Conclusion

The adaptive analyzer **failed the release gate** and must remain outside the live coach. It matched or improved fixed 2000 on the combined near-optimality, regret, and repeatability comparison. It used 10.1% fewer paired samples and 28.0% more mean wall time, while its false-positive mistake rate changed by -1.00 percentage points.

The sampler allocated more computation to harder decisions: reference-unclear positions used 1.16 times as many samples as reference-clear positions. Its median stopping budget was 2000, 75.8% of recommendations ended uncertain, and 19.3% of coaching labels abstained. Failed release checks: mistakeLabelAgreement.

This adaptive sampler widens uncertainty when independent batches disagree, requires a fresh confirmation batch before early stopping, delays decisions according to phase and legal-move count, and treats statistically equivalent moves as one plausible-best set. Recommendation confidence and mistake confidence are separate, so the coach can abstain from a mistake label even when it still offers a tentative move.

The V6 sampling experiment evaluated the phase-aware candidate on a fresh development corpus. Opening, late, and block results reuse the matched control exactly. Middle-game stages draw disjoint samples from one persistent hidden-deal pool. The candidate failed at least one predeclared development check, so it may not advance to a holdout or the live coach.

## Overall results

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 75.0% [71.2, 78.7] | 87.3% [84.3, 90.0] | 81.7% [78.0, 85.2] | 0.69 [0.56, 0.84] | 88.3% [84.3, 91.8] | 2.0% [1.0, 3.2] | 9.7% [6.0, 13.5] | 0.0% [0.0, 0.0] | 88.3% [84.3, 92.0] | 60.0% [53.5, 66.5] | 51.5% [44.5, 58.5] | 1661 / 7522 ms |
| Fixed 500 | 84.7% [81.2, 87.8] | 95.2% [93.0, 97.0] | 91.7% [89.2, 94.0] | 0.29 [0.21, 0.38] | 92.3% [89.7, 95.2] | 2.2% [1.0, 3.7] | 5.5% [3.0, 8.3] | 0.0% [0.0, 0.0] | 92.3% [89.3, 95.0] | 79.5% [73.5, 85.0] | 67.0% [60.5, 73.0] | 5657 / 29356 ms |
| Fixed 2000 | 90.2% [86.8, 93.2] | 99.2% [98.5, 99.8] | 96.5% [94.2, 98.3] | 0.10 [0.06, 0.14] | 96.3% [94.3, 98.0] | 2.2% [1.0, 3.7] | 1.5% [0.3, 2.8] | 0.0% [0.0, 0.0] | 96.3% [94.5, 98.0] | 93.0% [89.5, 96.0] | 83.5% [78.0, 88.5] | 23604 / 108303 ms |
| Adaptive control | 87.8% [84.0, 91.3] | 99.5% [98.8, 100.0] | 94.5% [92.0, 96.7] | 0.12 [0.08, 0.16] | 94.0% [90.8, 96.7] | 1.2% [0.3, 2.2] | 4.8% [2.3, 7.7] | 19.3% [15.3, 23.8] | 97.0% [94.6, 98.9] | 90.0% [85.5, 94.0] | 100.0% [100.0, 100.0] | 30210 / 111394 ms |
| Sampling Phase Aware | 87.7% [84.0, 91.2] | 99.3% [98.7, 99.8] | 94.3% [91.8, 96.5] | 0.13 [0.08, 0.17] | 94.2% [91.0, 96.8] | 1.2% [0.3, 2.2] | 4.7% [2.2, 7.5] | 18.5% [14.5, 22.8] | 97.0% [94.6, 98.9] | 89.5% [85.5, 93.5] | 100.0% [100.0, 100.0] | 30082 / 111394 ms |

## Adaptive computation

- Mean samples: 1797.50 [1737.48, 1851.67]
- Median samples: 2000
- P95 samples: 2000
- Maximum samples: 2000
- Hard-cap rate: 75.8% [70.5, 81.2]
- Uncertain-at-stop rate: 75.8% [70.0, 80.8]
- Candidate-refinement rate: 0.0% [0.0, 0.0]
- Mean plausible-best set size: 1.76 [1.64, 1.87]
- Coaching-label abstention rate: 19.3% [15.3, 23.8]
- Accuracy among non-abstained coaching labels: 97.0% [94.6, 98.9]
- Mean samples on reference-clear positions: 1726.35 [1654.25, 1799.55]
- Mean samples on reference-unclear positions: 2000.00 [2000.00, 2000.00]

| Stopping stage | Trials | Share |
| ---: | ---: | ---: |
| 500 | 41 | 6.8% |
| 1000 | 60 | 10.0% |
| 2000 | 499 | 83.2% |

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



## V6 sampling-development gates

Selected policy: **none**

| Policy | Check | Result |
| --- | --- | --- |
| Phase Aware | changesMiddleDecisions | PASS |
| Phase Aware | repeatAcceptabilityTarget | FAIL |
| Phase Aware | repeatAcceptabilityNoninferior | FAIL |
| Phase Aware | withinOnePointNoninferior | PASS |
| Phase Aware | meanRegretNoninferior | PASS |
| Phase Aware | middleRegretImprovement | FAIL |
| Phase Aware | mistakeLabelAgreementPreserved | PASS |
| Phase Aware | falseAccusationsPreserved | PASS |
| Phase Aware | sampleUsagePreserved | FAIL |


## Results by phase

### opening

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 62.0% [54.6, 70.7] | 80.7% [73.3, 87.3] | 73.3% [64.7, 81.3] | 1.01 [0.76, 1.30] | 80.7% [71.3, 88.7] | 5.3% [2.0, 9.3] | 14.0% [6.0, 23.3] | 0.0% [0.0, 0.0] | 80.7% [71.3, 89.3] | 42.0% [30.0, 56.0] | 26.0% [14.0, 38.0] | 5678 / 16238 ms |
| Fixed 500 | 77.3% [69.3, 84.7] | 94.0% [90.0, 97.3] | 90.0% [84.7, 94.7] | 0.41 [0.25, 0.62] | 89.3% [82.0, 95.3] | 3.3% [0.7, 7.3] | 7.3% [2.7, 13.3] | 0.0% [0.0, 0.0] | 89.3% [82.7, 95.3] | 74.0% [62.0, 86.0] | 54.0% [40.0, 66.0] | 18987 / 55532 ms |
| Fixed 2000 | 88.7% [82.7, 94.0] | 100.0% [100.0, 100.0] | 99.3% [98.0, 100.0] | 0.07 [0.03, 0.11] | 94.7% [90.7, 98.0] | 3.3% [0.7, 6.7] | 2.0% [0.0, 5.3] | 0.0% [0.0, 0.0] | 94.7% [90.0, 98.0] | 98.0% [94.0, 100.0] | 76.0% [64.0, 88.0] | 81337 / 230209 ms |
| Adaptive control | 80.7% [71.3, 89.3] | 99.3% [98.0, 100.0] | 95.3% [90.7, 98.7] | 0.14 [0.07, 0.22] | 90.0% [83.3, 95.3] | 2.0% [0.0, 4.0] | 8.0% [2.7, 14.7] | 29.3% [21.3, 38.7] | 94.6% [88.0, 100.0] | 90.0% [80.0, 98.0] | 100.0% [100.0, 100.0] | 105426 / 340995 ms |
| Sampling Phase Aware | 80.7% [71.3, 89.3] | 99.3% [98.0, 100.0] | 95.3% [90.7, 98.7] | 0.14 [0.07, 0.22] | 90.0% [83.3, 95.3] | 2.0% [0.0, 4.0] | 8.0% [2.7, 14.7] | 29.3% [21.3, 38.7] | 94.6% [88.0, 100.0] | 90.0% [80.0, 98.0] | 100.0% [100.0, 100.0] | 105426 / 340995 ms |

### middle

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 72.0% [63.3, 80.0] | 85.3% [79.3, 90.7] | 77.3% [70.0, 84.7] | 0.84 [0.54, 1.16] | 92.7% [85.3, 98.0] | 0.7% [0.0, 2.0] | 6.7% [1.3, 14.0] | 0.0% [0.0, 0.0] | 92.7% [85.3, 98.0] | 50.0% [36.0, 64.0] | 46.0% [32.0, 60.0] | 674 / 1405 ms |
| Fixed 500 | 84.7% [78.0, 91.3] | 95.3% [90.7, 98.7] | 92.0% [86.7, 96.0] | 0.28 [0.12, 0.46] | 94.7% [88.7, 98.7] | 1.3% [0.0, 3.3] | 4.0% [0.0, 9.3] | 0.0% [0.0, 0.0] | 94.7% [89.3, 98.7] | 80.0% [68.0, 90.0] | 68.0% [54.0, 80.0] | 2599 / 5479 ms |
| Fixed 2000 | 88.0% [80.0, 94.7] | 97.3% [94.7, 99.3] | 94.0% [88.7, 98.0] | 0.18 [0.06, 0.30] | 99.3% [97.3, 100.0] | 0.7% [0.0, 2.0] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 99.3% [98.0, 100.0] | 88.0% [78.0, 96.0] | 80.0% [68.0, 90.0] | 9456 / 20645 ms |
| Adaptive control | 90.7% [84.0, 96.0] | 99.3% [98.0, 100.0] | 96.0% [92.0, 98.7] | 0.09 [0.04, 0.16] | 98.0% [94.7, 100.0] | 0.0% [0.0, 0.0] | 2.0% [0.0, 5.3] | 12.7% [6.0, 20.7] | 100.0% [100.0, 100.0] | 90.0% [82.0, 98.0] | 100.0% [100.0, 100.0] | 10304 / 23414 ms |
| Sampling Phase Aware | 90.0% [82.7, 95.3] | 98.7% [96.7, 100.0] | 95.3% [90.7, 98.7] | 0.12 [0.04, 0.22] | 98.7% [96.0, 100.0] | 0.0% [0.0, 0.0] | 1.3% [0.0, 4.0] | 9.3% [4.0, 15.3] | 100.0% [100.0, 100.0] | 88.0% [78.0, 96.0] | 100.0% [100.0, 100.0] | 9793 / 22652 ms |

### late

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 86.0% [80.0, 92.0] | 94.0% [89.3, 98.0] | 89.3% [84.0, 94.7] | 0.35 [0.16, 0.60] | 89.3% [81.3, 96.0] | 0.7% [0.0, 2.0] | 10.0% [4.0, 18.0] | 0.0% [0.0, 0.0] | 89.3% [81.3, 96.0] | 74.0% [62.0, 86.0] | 68.0% [54.0, 80.0] | 105 / 242 ms |
| Fixed 500 | 88.7% [83.3, 93.3] | 94.0% [89.3, 98.0] | 90.7% [84.7, 95.3] | 0.29 [0.12, 0.49] | 91.3% [84.0, 97.3] | 3.3% [0.7, 7.3] | 5.3% [0.0, 12.0] | 0.0% [0.0, 0.0] | 91.3% [84.0, 97.3] | 78.0% [66.0, 88.0] | 72.0% [60.0, 84.0] | 368 / 927 ms |
| Fixed 2000 | 96.7% [94.0, 99.3] | 100.0% [100.0, 100.0] | 98.0% [96.0, 100.0] | 0.03 [0.01, 0.08] | 94.0% [89.3, 98.0] | 4.7% [0.7, 9.3] | 1.3% [0.0, 3.3] | 0.0% [0.0, 0.0] | 94.0% [90.0, 98.0] | 94.0% [86.0, 100.0] | 90.0% [80.0, 98.0] | 1256 / 3270 ms |
| Adaptive control | 90.7% [83.3, 96.0] | 99.3% [98.0, 100.0] | 93.3% [87.3, 98.7] | 0.11 [0.04, 0.21] | 93.3% [86.7, 98.0] | 1.3% [0.0, 3.3] | 5.3% [0.7, 12.0] | 24.0% [14.7, 34.0] | 95.3% [88.4, 100.0] | 90.0% [82.0, 96.0] | 100.0% [100.0, 100.0] | 2081 / 4347 ms |
| Sampling Phase Aware | 90.7% [83.3, 96.0] | 99.3% [98.0, 100.0] | 93.3% [87.3, 98.7] | 0.11 [0.04, 0.21] | 93.3% [86.7, 98.0] | 1.3% [0.0, 3.3] | 5.3% [0.7, 12.0] | 24.0% [14.7, 34.0] | 95.3% [88.4, 100.0] | 90.0% [82.0, 96.0] | 100.0% [100.0, 100.0] | 2081 / 4347 ms |

### block

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 80.0% [71.3, 87.3] | 89.3% [83.3, 95.3] | 86.7% [78.7, 93.3] | 0.57 [0.29, 0.90] | 90.7% [83.3, 96.7] | 1.3% [0.0, 3.3] | 8.0% [2.0, 15.3] | 0.0% [0.0, 0.0] | 90.7% [82.7, 97.3] | 74.0% [62.0, 86.0] | 66.0% [52.0, 80.0] | 187 / 626 ms |
| Fixed 500 | 88.0% [81.3, 93.3] | 97.3% [94.0, 100.0] | 94.0% [89.3, 98.0] | 0.17 [0.06, 0.31] | 94.0% [88.0, 99.3] | 0.7% [0.0, 2.0] | 5.3% [0.0, 12.7] | 0.0% [0.0, 0.0] | 94.0% [87.3, 99.3] | 86.0% [76.0, 94.0] | 74.0% [62.0, 86.0] | 674 / 2273 ms |
| Fixed 2000 | 87.3% [78.0, 94.7] | 99.3% [98.0, 100.0] | 94.7% [88.0, 99.3] | 0.11 [0.03, 0.20] | 97.3% [92.0, 100.0] | 0.0% [0.0, 0.0] | 2.7% [0.0, 7.3] | 0.0% [0.0, 0.0] | 97.3% [92.6, 100.0] | 92.0% [84.0, 98.0] | 88.0% [78.0, 96.0] | 2366 / 7394 ms |
| Adaptive control | 89.3% [82.0, 95.3] | 100.0% [100.0, 100.0] | 93.3% [86.7, 98.7] | 0.13 [0.04, 0.24] | 94.7% [88.0, 100.0] | 1.3% [0.0, 4.0] | 4.0% [0.0, 10.0] | 11.3% [5.3, 19.3] | 97.9% [93.8, 100.0] | 90.0% [82.0, 98.0] | 100.0% [100.0, 100.0] | 3028 / 8661 ms |
| Sampling Phase Aware | 89.3% [82.0, 95.3] | 100.0% [100.0, 100.0] | 93.3% [86.7, 98.7] | 0.13 [0.04, 0.24] | 94.7% [88.0, 100.0] | 1.3% [0.0, 4.0] | 4.0% [0.0, 10.0] | 11.3% [5.3, 19.3] | 97.9% [93.8, 100.0] | 90.0% [82.0, 98.0] | 100.0% [100.0, 100.0] | 3028 / 8661 ms |

## Results by legal-move count

### 2 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 82.6% [77.3, 87.2] | 93.1% [89.7, 96.6] | 88.8% [84.7, 92.8] | 0.41 [0.27, 0.59] | 93.5% [89.4, 96.9] | 1.6% [0.3, 2.8] | 5.0% [1.6, 9.3] | 0.0% [0.0, 0.0] | 93.5% [89.1, 96.9] | 76.6% [68.2, 85.0] | 67.3% [58.9, 76.6] | 376 / 2395 ms |
| Fixed 500 | 89.7% [86.0, 92.8] | 97.2% [95.3, 99.1] | 94.7% [92.2, 96.9] | 0.17 [0.10, 0.25] | 93.8% [89.7, 97.5] | 2.8% [0.9, 5.0] | 3.4% [0.6, 7.2] | 0.0% [0.0, 0.0] | 93.8% [89.7, 97.2] | 85.0% [78.5, 91.6] | 72.9% [64.5, 81.3] | 1429 / 9210 ms |
| Fixed 2000 | 92.5% [88.8, 96.0] | 99.4% [98.4, 100.0] | 98.1% [96.6, 99.4] | 0.07 [0.03, 0.11] | 96.3% [93.1, 98.8] | 2.5% [0.9, 4.7] | 1.2% [0.0, 3.7] | 0.0% [0.0, 0.0] | 96.3% [93.1, 98.8] | 94.4% [89.7, 98.1] | 85.0% [78.5, 91.6] | 5750 / 36906 ms |
| Adaptive control | 90.3% [86.0, 94.4] | 99.7% [99.1, 100.0] | 95.3% [91.9, 98.1] | 0.11 [0.05, 0.17] | 95.3% [91.6, 98.4] | 1.6% [0.3, 3.4] | 3.1% [0.3, 6.9] | 18.1% [12.5, 24.6] | 95.9% [90.8, 99.0] | 91.6% [86.0, 96.3] | 100.0% [100.0, 100.0] | 6178 / 38349 ms |
| Sampling Phase Aware | 90.3% [86.3, 94.1] | 99.4% [98.4, 100.0] | 95.0% [91.6, 97.8] | 0.12 [0.06, 0.18] | 95.3% [91.6, 98.4] | 1.6% [0.3, 3.4] | 3.1% [0.3, 6.9] | 18.1% [12.5, 24.6] | 95.9% [90.8, 99.0] | 90.7% [85.0, 95.3] | 100.0% [100.0, 100.0] | 6078 / 38349 ms |

### 3 to 5 moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 67.5% [61.4, 73.1] | 81.1% [76.3, 85.9] | 74.3% [68.7, 79.9] | 1.00 [0.78, 1.22] | 84.3% [78.3, 90.8] | 2.4% [0.4, 4.8] | 13.3% [7.2, 20.1] | 0.0% [0.0, 0.0] | 84.3% [77.9, 90.4] | 41.0% [30.1, 51.8] | 33.7% [24.1, 43.4] | 2365 / 6698 ms |
| Fixed 500 | 80.3% [74.7, 85.5] | 92.4% [88.4, 95.6] | 88.0% [83.1, 92.4] | 0.43 [0.27, 0.60] | 92.0% [86.7, 96.0] | 1.2% [0.0, 2.8] | 6.8% [2.4, 11.6] | 0.0% [0.0, 0.0] | 92.0% [87.1, 96.4] | 72.3% [62.7, 81.9] | 60.2% [49.4, 69.9] | 7521 / 26090 ms |
| Fixed 2000 | 89.2% [83.5, 94.0] | 98.8% [97.6, 100.0] | 95.2% [91.2, 98.8] | 0.12 [0.05, 0.21] | 96.8% [94.4, 98.8] | 1.2% [0.0, 2.8] | 2.0% [0.4, 4.4] | 0.0% [0.0, 0.0] | 96.8% [94.4, 98.8] | 91.6% [85.5, 96.4] | 83.1% [74.7, 90.4] | 32812 / 94545 ms |
| Adaptive control | 85.9% [80.3, 90.8] | 99.2% [98.0, 100.0] | 94.0% [90.4, 97.2] | 0.12 [0.07, 0.18] | 93.6% [89.2, 97.2] | 0.8% [0.0, 2.0] | 5.6% [2.0, 10.0] | 18.9% [12.4, 25.7] | 98.1% [94.9, 100.0] | 88.0% [80.7, 94.0] | 100.0% [100.0, 100.0] | 41698 / 100718 ms |
| Sampling Phase Aware | 85.5% [79.5, 90.4] | 99.2% [98.0, 100.0] | 94.0% [90.4, 97.6] | 0.13 [0.07, 0.21] | 94.0% [89.6, 97.6] | 0.8% [0.0, 2.0] | 5.2% [1.6, 9.6] | 16.9% [10.8, 22.9] | 98.1% [95.0, 100.0] | 88.0% [80.7, 94.0] | 100.0% [100.0, 100.0] | 41519 / 100718 ms |

### 6 or more moves

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | False negatives | Abstained labels | Decided-label accuracy | Repeat acceptable | Best-set stable | Mean / p95 time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixed 120 | 56.7% [33.3, 80.0] | 76.7% [53.3, 96.7] | 66.7% [43.3, 86.7] | 1.22 [0.41, 2.13] | 66.7% [43.3, 86.7] | 3.3% [0.0, 10.0] | 30.0% [6.7, 53.3] | 0.0% [0.0, 0.0] | 66.7% [43.3, 90.0] | 40.0% [10.0, 70.0] | 30.0% [10.0, 60.0] | 9565 / 17931 ms |
| Fixed 500 | 66.7% [36.7, 90.0] | 96.7% [90.0, 100.0] | 90.0% [76.7, 100.0] | 0.43 [0.08, 0.86] | 80.0% [60.0, 96.7] | 3.3% [0.0, 10.0] | 16.7% [0.0, 36.7] | 0.0% [0.0, 0.0] | 80.0% [60.0, 96.7] | 80.0% [50.0, 100.0] | 60.0% [30.0, 90.0] | 35433 / 64362 ms |
| Fixed 2000 | 73.3% [50.0, 93.3] | 100.0% [100.0, 100.0] | 90.0% [70.0, 100.0] | 0.22 [0.03, 0.46] | 93.3% [83.3, 100.0] | 6.7% [0.0, 13.4] | 0.0% [0.0, 0.0] | 0.0% [0.0, 0.0] | 93.3% [83.3, 100.0] | 90.0% [70.0, 100.0] | 70.0% [40.0, 100.0] | 138205 / 252638 ms |
| Adaptive control | 76.7% [53.3, 100.0] | 100.0% [100.0, 100.0] | 90.0% [70.0, 100.0] | 0.17 [0.00, 0.45] | 83.3% [60.0, 100.0] | 0.0% [0.0, 0.0] | 16.7% [0.0, 43.3] | 36.7% [13.3, 63.3] | 100.0% [100.0, 100.0] | 90.0% [70.0, 100.0] | 100.0% [100.0, 100.0] | 191992 / 388752 ms |
| Sampling Phase Aware | 76.7% [53.3, 100.0] | 100.0% [100.0, 100.0] | 90.0% [70.0, 100.0] | 0.17 [0.00, 0.45] | 83.3% [60.0, 100.0] | 0.0% [0.0, 0.0] | 16.7% [0.0, 43.3] | 36.7% [13.3, 63.3] | 100.0% [100.0, 100.0] | 90.0% [70.0, 100.0] | 100.0% [100.0, 100.0] | 191992 / 388752 ms |

## Exact endgame diagnostic

84 positions were small enough for the deal-specific exact solver. The information-safe reference selected an exact winning action in 90.5% of them. This is diagnostic only because the exact solver sees the realized hidden deal and the analyzer correctly does not.

# Mesa Quince uncertainty-aware coaching validation

Generated: 2026-09-24T17:28:21.485Z

## Locked protocol

- Seed: mesa-quince-uncertainty-coach-v1
- Positions: 200, balanced across opening, middle, late, and likely-block play
- Independent repetitions per position: 5
- Fixed budgets: 120, 500 samples
- Independent reference: 5000 samples
- Bootstrap resamples: 2000

The candidate does not change move simulation or ranking. It changes coaching semantics only. Moves whose paired interval does not clear a one-point practical advantage form the strong-option set. A mistake requires at least four estimated win-rate points lost, a paired lower bound above 1.5 points, and consistent direction across four interleaved evidence groups. Real opponent hands and sleeping tiles are unavailable to every analysis.

Each budget must pass every locked check. The checks require strong reference coverage, repeatable sets, no increase in false accusations, bounded set breadth, and enough multi-option decisions to prove the candidate was exercised.

Overall result: **FAIL**

## Results

| Budget | Reference top covered | Reference set covered | Current single-top coverage | Shared option across repeats | Pairwise set similarity | False accusations | Mean set size | All legal moves accepted | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 120 | 99.0% [98.3, 99.6] | 100.0% [100.0, 100.0] | 91.6% [89.4, 93.7] | 99.5% [98.5, 100.0] | 85.7% [83.7, 87.6] | 0.6% [0.2, 1.1] | 2.46 [2.28, 2.63] | 62.6% [57.2, 67.7] | FAIL |
| 500 | 99.9% [99.7, 100.0] | 100.0% [100.0, 100.0] | 98.5% [97.7, 99.2] | 100.0% [100.0, 100.0] | 87.3% [85.3, 89.1] | 1.0% [0.4, 1.8] | 2.03 [1.91, 2.17] | 45.3% [39.5, 51.2] | FAIL |

## Locked checks

| Budget | Check | Result |
| ---: | --- | --- |
| 120 | referenceTopCoverage | PASS |
| 120 | referenceSetCoverage | PASS |
| 120 | improvesCoverage | PASS |
| 120 | repeatSharedOption | PASS |
| 120 | repeatSetJaccard | PASS |
| 120 | falseAccusations | PASS |
| 120 | noFalseAccusationIncrease | PASS |
| 120 | averageSetSize | FAIL |
| 120 | allLegalRate | FAIL |
| 120 | exercised | PASS |
| 500 | referenceTopCoverage | PASS |
| 500 | referenceSetCoverage | PASS |
| 500 | improvesCoverage | PASS |
| 500 | repeatSharedOption | PASS |
| 500 | repeatSetJaccard | PASS |
| 500 | falseAccusations | PASS |
| 500 | noFalseAccusationIncrease | PASS |
| 500 | averageSetSize | PASS |
| 500 | allLegalRate | FAIL |
| 500 | exercised | PASS |

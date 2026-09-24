# Mesa Quince confirmed root-racing calibration

Generated: 2026-09-24T21:54:21.822Z

## Protocol

Five predeclared confirmation policies were replayed against the exact saved V2 belief weights and paired outcomes. No games, beliefs, or references were resimulated. Every policy retains the locked 40-sample first stage, combined 60-sample statistical test, top-three protection, 120-per-move total recommendation budget, 120-sample finalist floor, and targeted post-play label confirmation.

The grid changes only the fresh confirmation requirement:

- strict-20: both fresh 10-sample mini-batches must favor the leader.
- nonnegative-20: at least one fresh mini-batch must favor the leader and neither may oppose it.
- directional-20: the combined fresh 20-sample result must favor the leader, with at least one favorable mini-batch.
- three-of-four-40: at least three of four fresh 10-sample mini-batches must favor the leader.
- majority-40: at least two of four fresh 10-sample mini-batches must favor the leader.

Candidates are ranked first by the complete locked V2 gate, then by within-one improvement, regret reduction, reference survival, and stable id. Development calibration cannot release a policy. A selected policy must be frozen before a fresh holdout.

## Results

| Candidate | Changes | Within 1 point | Within-1 delta | Regret delta | Ref-best survival | False-positive delta | Post-play overhead | Eliminations | Gate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| strict-20 | 2.5% [0.0, 5.0] | 65.0% [54.2, 74.2] | 1.7% [0.0, 4.2] | -0.101 [-0.274, 0.002] | 99.2% [97.5, 100.0] | -0.8% [-2.5, 0.0] | 0.1% [0.0, 0.3] | 66 | FAIL |
| nonnegative-20 | 3.3% [0.8, 6.7] | 64.2% [53.3, 74.2] | 0.8% [-1.7, 3.3] | -0.049 [-0.243, 0.126] | 99.2% [97.5, 100.0] | -0.8% [-2.5, 0.0] | 0.3% [0.1, 0.5] | 100 | FAIL |
| directional-20 | 5.8% [2.5, 10.0] | 65.0% [55.0, 75.0] | 1.7% [-2.5, 5.8] | -0.088 [-0.307, 0.120] | 99.2% [97.5, 100.0] | -0.8% [-2.5, 0.0] | 0.3% [0.1, 0.5] | 124 | FAIL |
| three-of-four-40 | 2.5% [0.0, 5.0] | 65.0% [54.2, 75.0] | 1.7% [0.0, 4.2] | -0.078 [-0.228, 0.002] | 99.2% [97.5, 100.0] | 0.0% [0.0, 0.0] | 0.1% [0.0, 0.2] | 79 | FAIL |
| majority-40 | 4.2% [0.8, 7.5] | 65.8% [55.0, 75.8] | 2.5% [0.0, 5.8] | -0.089 [-0.240, 0.004] | 99.2% [97.5, 100.0] | 0.0% [0.0, 0.0] | 0.1% [0.0, 0.2] | 123 | FAIL |

Selected candidate: **none**

Overall calibration gate: **FAIL**

## Failed checks

- strict-20: exercised
- nonnegative-20: exercised, repeatAcceptabilityNoninferior
- directional-20: repeatAcceptabilityNoninferior
- three-of-four-40: exercised
- majority-40: exercised

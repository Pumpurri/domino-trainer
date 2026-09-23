# Paired sampler-ablation decision

The fresh `mesa-quince-sampler-ablation-v1` diagnostic completed 48 targeted positions and 144 repeated trials. It compared one-shot analysis, disjoint staged windows from the same particle sequence, and the existing behavior of rebuilding information-safe particles for every stage. All variants used an independent 5,000-sample reference and never received the opponents' realized hidden hands.

## Exact checks

| Comparison | Top mismatches | Ranking mismatches | Outcome mismatches | Weight mismatches | Sample mismatches | Maximum win-rate difference |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Shared one-shot vs staged merge | 0 | 0 | 0 | 0 | 0 | 0 |
| Shared staged vs forced replay | 0 | 0 | 0 | 0 | 0 | 0 |
| Independent staged vs forced replay | 0 | 0 | 0 | 0 | 0 | 0 |

The engine merges disjoint sample windows correctly. Every early variant also reached the 2,000-sample cap, making early and forced results identical on this deliberately difficult corpus.

## Overall result

| Sampling method | Within 1 point | Mean regret | Repeat acceptable | Repeat top |
| --- | ---: | ---: | ---: | ---: |
| Shared particle sequence | 90.3% | 0.211 | 77.1% | 62.5% |
| Independent stage samples | 88.9% | 0.267 | 77.1% | 62.5% |

Independent stage sampling added 0.056 mean regret and crossed the locked 0.03 harm threshold. Its paired confidence interval was broad and crossed zero. The two methods selected different moves in 39 of 144 trials. Shared sampling had lower reference regret in 20, independent sampling in 19, and 105 tied.

## Phase interaction

| Group and method | Within 1 point | Mean regret | Repeat acceptable |
| --- | ---: | ---: | ---: |
| High-branching opening, shared | 88.9% | 0.215 | 75.0% |
| High-branching opening, independent | 94.4% | 0.149 | 87.5% |
| Wide middle, shared | 91.7% | 0.207 | 79.2% |
| Wide middle, independent | 83.3% | 0.386 | 66.7% |

The effect reverses by phase, so the diagnostic does not justify replacing independent stage samples globally. It supports testing a phase-aware candidate on a fresh full corpus: independent samples during openings, one persistent disjoint sequence during the middle game, and unchanged behavior in late and blocked positions. This diagnostic cannot promote that candidate or modify the live coach.

# Adaptive V5 robust-selection development decision

V5 tested four post-processing selectors on the exact same adaptive simulations. The protocol was committed before the fresh seed `mesa-quince-adaptive-v5-development-v1` was opened. The study used 200 positions, 50 from each strategic phase, and three independent trials per position.

## Decision

No selector passed every locked development gate. V5 is retired without a holdout and without a live-coach change.

| Selector | Decisions changed | Repeat acceptable | Within 1 point | Mean regret | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Mean control | 0.0% | 87.5% | 94.0% | 0.131 | Control failed the 90% absolute target |
| Confidence adjusted | 0.0% | 87.5% | 94.0% | 0.131 | Failed to change a decision and missed the target |
| Pairwise minimax | 0.8% | 88.5% | 94.2% | 0.130 | Directionally positive but missed the target |
| Batch consensus | 3.2% | 86.5% | 94.0% | 0.136 | Inferior repeat acceptability |
| Downside protected | 12.0% | 76.5% | 89.5% | 0.266 | Inferior repeatability, quality, and regret |

Every selector preserved the shared coaching-label evidence and sample usage by construction. Confidence adjustment was equivalent to the mean selector throughout this corpus. Pairwise minimax changed five of 600 trials, too few to solve the broader stability problem.

## Diagnostic signal

| Slice | Mean-selector repeat acceptable | Pairwise-minimax repeat acceptable |
| --- | ---: | ---: |
| Opening | 62.0% | 66.0% |
| Middle | 92.0% | 92.0% |
| Late | 98.0% | 98.0% |
| Blocked | 98.0% | 98.0% |
| Six or more legal moves, 12 positions | 41.7% | 50.0% |

The six-or-more slice is too small for a release conclusion, but it locates the next investigation. Final selection is not the main bottleneck. The next benchmark must use matched hidden-deal particles and rollout outcomes to separate one-shot sampling, staged aggregation, and early stopping on a larger corpus of difficult early positions.

# Coaching-label disagreement audit

Source: `benchmarks/adaptive-v2-holdout-400.json`
Reference: one independent 5000-sample analysis. Its mistake rule is less conservative than the adaptive rule; it is not ground truth.

400 positions, 1200 independent adaptive trials.

| Outcome | Trials | Share |
| --- | ---: | ---: |
| detected-mistake | 138 | 11.5% |
| false-accusation | 7 | 0.6% |
| confident-miss | 1 | 0.1% |
| correct-acceptable | 785 | 65.4% |
| uncertain-mistake | 74 | 6.2% |
| uncertain-acceptable | 195 | 16.3% |

- False accusations: 0.6% of all trials.
- Confident misses: 0.1% of all trials.
- Explicit uncertainty: 22.4% of all trials.
- Correct among decided trials: 99.1% (pooled, not position-weighted).
- Detected reference mistakes: 64.8%; abstained on 34.7%.

## Reasons an uncertain call disagreed with the reference

These conditions overlap and should not be summed. A gap below the threshold may also have a wide interval.

| Condition | Trials |
| --- | ---: |
| atCap | 73 |
| belowMinimumGap | 58 |
| lowerBoundNotPractical | 69 |
| lowBatchAgreement | 29 |
| lowPracticalAgreement | 13 |
| playedInPlausibleBest | 45 |
| referenceBelowMinimumGap | 36 |
| referenceLowerBoundNotPractical | 15 |

The frozen holdout is diagnostic only. Do not select a policy or revise a release threshold from these cases; use development data and a fresh holdout.

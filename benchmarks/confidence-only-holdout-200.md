# Mesa Quince confidence-only coach validation

Generated: 2026-09-24T19:48:24.643Z

The candidate preserves the existing primary recommendation and all current mistake verdicts. It labels the recommendation clear only when the paired 95% lower advantage over the runner-up exceeds 1.5 points; every other recommendation is a close call.

Overall result: **PASS**

| Budget | Clear rate | Clear within one point | Close within one point | Quality separation | Reference-confidence agreement | Repeat agreement | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 120 | 18.0% [14.3, 22.0] | 98.9% [97.1, 100.0] | 78.4% [74.6, 82.0] | 20.5% [16.4, 24.5] | 66.2% [60.5, 71.8] | 84.6% [81.3, 87.7] | PASS |
| 500 | 31.1% [25.5, 36.7] | 100.0% [100.0, 100.0] | 83.7% [79.9, 87.4] | 16.3% [12.7, 20.1] | 78.7% [73.8, 83.2] | 86.1% [83.1, 89.1] | PASS |

## Phase safety

Each phase must produce at least one clear recommendation, and at least 80% of its clear recommendations must be within one point of the independent reference by point estimate.

| Budget | Phase | Clear trials | Clear within one point |
| ---: | --- | ---: | ---: |
| 120 | block | 80 | 98.8% [95.5, 100.0] |
| 120 | late | 72 | 100.0% [100.0, 100.0] |
| 120 | middle | 20 | 95.0% [78.6, 100.0] |
| 120 | opening | 8 | 100.0% [100.0, 100.0] |
| 500 | block | 113 | 100.0% [100.0, 100.0] |
| 500 | late | 128 | 100.0% [100.0, 100.0] |
| 500 | middle | 38 | 100.0% [100.0, 100.0] |
| 500 | opening | 32 | 100.0% [100.0, 100.0] |

## Locked checks

| Budget | Check | Result |
| ---: | --- | --- |
| 120 | primaryUnchanged | PASS |
| 120 | exactlyOneRecommendation | PASS |
| 120 | clearConfidenceExercised | PASS |
| 120 | clearRecommendationQuality | PASS |
| 120 | phaseClearRecommendationQuality | PASS |
| 120 | confidenceDiscriminates | PASS |
| 120 | confidenceAgreement | PASS |
| 120 | repeatAgreement | PASS |
| 500 | primaryUnchanged | PASS |
| 500 | exactlyOneRecommendation | PASS |
| 500 | clearConfidenceExercised | PASS |
| 500 | clearRecommendationQuality | PASS |
| 500 | phaseClearRecommendationQuality | PASS |
| 500 | confidenceDiscriminates | PASS |
| 500 | confidenceAgreement | PASS |
| 500 | repeatAgreement | PASS |

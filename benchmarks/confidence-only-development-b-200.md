# Mesa Quince confidence-only coach development audit

Generated: 2026-09-24T19:00:49.198Z

The candidate preserves the existing primary recommendation and all current mistake verdicts. It labels the recommendation clear only when the paired 95% lower advantage over the runner-up exceeds 1.5 points; every other recommendation is a close call.

Overall result: **PASS**

| Budget | Clear rate | Clear within one point | Close within one point | Quality separation | Reference-confidence agreement | Repeat agreement | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 120 | 14.5% [11.2, 18.0] | 99.3% [97.7, 100.0] | 80.9% [77.5, 84.3] | 18.4% [14.7, 21.9] | 59.3% [53.8, 65.3] | 84.7% [81.5, 87.8] | PASS |
| 500 | 30.8% [25.5, 36.0] | 100.0% [100.0, 100.0] | 87.9% [84.2, 91.1] | 12.1% [8.9, 15.8] | 73.6% [68.9, 78.4] | 81.9% [78.5, 85.3] | PASS |

## Phase safety

Each phase must produce at least one clear recommendation, and at least 80% of its clear recommendations must be within one point of the independent reference by point estimate.

| Budget | Phase | Clear trials | Clear within one point |
| ---: | --- | ---: | ---: |
| 120 | block | 52 | 100.0% [100.0, 100.0] |
| 120 | late | 55 | 100.0% [100.0, 100.0] |
| 120 | middle | 29 | 100.0% [100.0, 100.0] |
| 120 | opening | 9 | 88.9% [70.0, 100.0] |
| 500 | block | 113 | 100.0% [100.0, 100.0] |
| 500 | late | 113 | 100.0% [100.0, 100.0] |
| 500 | middle | 51 | 100.0% [100.0, 100.0] |
| 500 | opening | 31 | 100.0% [100.0, 100.0] |

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

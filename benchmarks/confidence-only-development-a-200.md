# Mesa Quince confidence-only coach development audit

Generated: 2026-09-24T19:00:48.468Z

The candidate preserves the existing primary recommendation and all current mistake verdicts. It labels the recommendation clear only when the paired 95% lower advantage over the runner-up exceeds 1.5 points; every other recommendation is a close call.

Overall result: **PASS**

| Budget | Clear rate | Clear within one point | Close within one point | Quality separation | Reference-confidence agreement | Repeat agreement | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 120 | 15.5% [11.7, 19.6] | 98.7% [96.6, 100.0] | 78.0% [74.5, 81.5] | 20.7% [17.2, 24.5] | 64.4% [58.3, 70.4] | 88.5% [85.6, 91.2] | PASS |
| 500 | 29.1% [23.9, 34.4] | 99.7% [98.8, 100.0] | 88.4% [85.3, 91.3] | 11.2% [8.4, 14.3] | 77.8% [73.2, 82.5] | 86.6% [83.6, 89.5] | PASS |

## Phase safety

Each phase must produce at least one clear recommendation, and at least 80% of its clear recommendations must be within one point of the independent reference by point estimate.

| Budget | Phase | Clear trials | Clear within one point |
| ---: | --- | ---: | ---: |
| 120 | block | 69 | 98.6% [94.4, 100.0] |
| 120 | late | 56 | 100.0% [100.0, 100.0] |
| 120 | middle | 22 | 95.5% [82.6, 100.0] |
| 120 | opening | 8 | 100.0% [100.0, 100.0] |
| 500 | block | 118 | 99.2% [96.9, 100.0] |
| 500 | late | 109 | 100.0% [100.0, 100.0] |
| 500 | middle | 40 | 100.0% [100.0, 100.0] |
| 500 | opening | 24 | 100.0% [100.0, 100.0] |

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

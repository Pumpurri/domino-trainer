# Mesa Quince Coach V2 development calibration

Generated: 2026-09-24T18:15:53.647Z

Coach V2 always retains exactly one existing primary recommendation. It labels that recommendation clear only when its paired 95% lower advantage over the runner-up exceeds 1.5 points. The played move is good when it is the primary move or falls within 1.5 estimated points, a likely mistake only under the existing conservative four-batch mistake rule, and uncertain otherwise.

Overall result: **PASS**

| Budget | Three-way agreement | Decided coverage | False accusation | False reassurance | Good precision | Mistake precision | Clear rate | Clear within one point | Confidence agreement | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 120 | 69.7% [65.4, 74.0] | 68.8% [64.7, 73.0] | 0.6% [0.2, 1.1] | 1.7% [0.8, 2.8] | 93.5% [90.7, 96.1] | 85.7% [70.5, 96.3] | 15.5% [11.4, 19.6] | 98.7% [96.4, 100.0] | 64.4% [58.4, 70.1] | PASS |
| 500 | 84.0% [80.4, 87.4] | 81.8% [77.9, 85.5] | 1.0% [0.4, 1.7] | 0.5% [0.1, 1.1] | 96.5% [94.4, 98.4] | 89.5% [80.2, 96.2] | 29.1% [23.9, 34.7] | 99.7% [98.8, 100.0] | 77.8% [73.0, 82.6] | PASS |

## Locked checks

| Budget | Check | Result |
| ---: | --- | --- |
| 120 | primaryUnchanged | PASS |
| 120 | exactlyOneRecommendation | PASS |
| 120 | falseAccusations | PASS |
| 120 | noFalseAccusationIncrease | PASS |
| 120 | falseReassurance | PASS |
| 120 | goodPrecision | PASS |
| 120 | mistakePrecision | PASS |
| 120 | labelAgreement | PASS |
| 120 | decidedCoverage | PASS |
| 120 | uncertaintyExercised | PASS |
| 120 | clearConfidenceExercised | PASS |
| 120 | clearRecommendationQuality | PASS |
| 120 | confidenceDiscriminates | PASS |
| 120 | confidenceAgreement | PASS |
| 500 | primaryUnchanged | PASS |
| 500 | exactlyOneRecommendation | PASS |
| 500 | falseAccusations | PASS |
| 500 | noFalseAccusationIncrease | PASS |
| 500 | falseReassurance | PASS |
| 500 | goodPrecision | PASS |
| 500 | mistakePrecision | PASS |
| 500 | labelAgreement | PASS |
| 500 | decidedCoverage | PASS |
| 500 | uncertaintyExercised | PASS |
| 500 | clearConfidenceExercised | PASS |
| 500 | clearRecommendationQuality | PASS |
| 500 | confidenceDiscriminates | PASS |
| 500 | confidenceAgreement | PASS |

# Mesa Quince Coach V2 validation

Generated: 2026-09-24T18:51:38.667Z

Coach V2 always retains exactly one existing primary recommendation. It labels that recommendation clear only when its paired 95% lower advantage over the runner-up exceeds 1.5 points. The played move is good when it is the primary move or falls within 1.5 estimated points, a likely mistake only under the existing conservative four-batch mistake rule, and uncertain otherwise.

Overall result: **FAIL**

| Budget | Three-way agreement | Decided coverage | False accusation | False reassurance | Good precision | Mistake precision | Clear rate | Clear within one point | Confidence agreement | Gate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 120 | 70.9% [66.5, 75.0] | 69.2% [64.7, 73.4] | 1.4% [0.6, 2.2] | 1.0% [0.3, 1.8] | 93.6% [90.5, 96.3] | 72.0% [51.2, 86.0] | 14.5% [11.2, 18.2] | 99.3% [97.7, 100.0] | 59.3% [53.3, 65.2] | FAIL |
| 500 | 84.4% [80.9, 87.6] | 83.9% [80.4, 87.3] | 2.0% [0.9, 3.3] | 0.5% [0.1, 1.0] | 95.0% [92.2, 97.3] | 79.4% [65.1, 90.1] | 30.8% [25.7, 36.1] | 100.0% [100.0, 100.0] | 73.6% [69.0, 78.4] | FAIL |

## Locked checks

| Budget | Check | Result |
| ---: | --- | --- |
| 120 | primaryUnchanged | PASS |
| 120 | exactlyOneRecommendation | PASS |
| 120 | falseAccusations | FAIL |
| 120 | noFalseAccusationIncrease | PASS |
| 120 | falseReassurance | PASS |
| 120 | goodPrecision | PASS |
| 120 | mistakePrecision | FAIL |
| 120 | labelAgreement | PASS |
| 120 | decidedCoverage | PASS |
| 120 | uncertaintyExercised | PASS |
| 120 | clearConfidenceExercised | PASS |
| 120 | clearRecommendationQuality | PASS |
| 120 | confidenceDiscriminates | PASS |
| 120 | confidenceAgreement | PASS |
| 500 | primaryUnchanged | PASS |
| 500 | exactlyOneRecommendation | PASS |
| 500 | falseAccusations | FAIL |
| 500 | noFalseAccusationIncrease | PASS |
| 500 | falseReassurance | PASS |
| 500 | goodPrecision | PASS |
| 500 | mistakePrecision | FAIL |
| 500 | labelAgreement | PASS |
| 500 | decidedCoverage | PASS |
| 500 | uncertaintyExercised | PASS |
| 500 | clearConfidenceExercised | PASS |
| 500 | clearRecommendationQuality | PASS |
| 500 | confidenceDiscriminates | PASS |
| 500 | confidenceAgreement | PASS |

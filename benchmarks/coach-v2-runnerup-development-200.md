# Mesa Quince Coach V2 development selection

Generated: 2026-09-24T18:15:32.024Z

This development pass separates the single primary recommendation from an optional runner-up. The optional move must be close by paired outcome, retain a bounded lower interval, stay near the primary across four interleaved evidence groups, and remain among the top two moves across those groups. The played-move mistake assessment remains the separately conservative uncertainty-aware decision.

The grid evaluated 405 policies on the completed 200-position development corpus. A candidate had to show a runner-up on 5% to 35% of trials at both budgets, place at least 85% of shown runner-ups within one estimated win-rate point of the independent 5,000-sample leader, reach at least 70% repeat agreement and set similarity, never recommend every move when at least three were legal, and never reduce reference-top coverage.

Development selection: **NO ELIGIBLE CANDIDATE**

Selected policy:

```json
{
  "maximumGap": 1.5,
  "maximumLowerBound": 0,
  "minimumTopTwoBatchAgreement": 1,
  "maximumBatchGap": 2,
  "minimumNearBatchAgreement": 1
}
```

| Budget | Runner-up shown | Runner-up precision | Reference-top coverage gain | Pairwise set similarity | Runner-up repeat agreement | Mean recommendations |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 120 | 2.0% | 100.0% | 0.5% | 64.1% | 100.0% | 1.02 |
| 500 | 3.2% | 93.8% | 0.9% | 75.8% | 80.4% | 1.03 |

# Mesa Quince V4 development comparison

The matched development corpus used 200 positions, three independent repetitions, the frozen V3 coaching-label policy, and seed `mesa-quince-adaptive-v4-development-v1`. The control stopped at the ordinary 2,000-sample cap. The candidate added one 250-sample paired batch restricted to unresolved plausible-best moves when the leading gap was no more than three points.

## Result

The candidate **did not pass the predeclared development criteria** and must not proceed to a holdout or the live coach.

| Measure | Control | Refined | Criterion | Result |
| --- | ---: | ---: | --- | --- |
| Repeat acceptability | 89.0% | 89.5% | Refined at least 90% | FAIL |
| Within one reference point | 95.0% | 94.8% | No more than 1 point below control | PASS |
| Mean regret | 0.114 | 0.117 | No more than 0.02 above control | PASS |
| Mean samples | 1,777.5 | 1,901.7 | Refined at most 1,900 | FAIL |
| Label coverage | 75.6% | 75.2% | Refined at least 70% | PASS |
| Material-mistake recall | 63.1% | 64.3% | Refined at least 70% | FAIL |
| Decided-label accuracy | 98.4% | 98.1% | Refined at least 97% | PASS |
| False accusations | 1.22% | 1.40% | Refined at most 1% | FAIL |
| Confident misses | 0.0% | 0.0% | Refined at most 1% | PASS |

The extra batch ran in 298 of 600 adaptive trials. It improved repeat acceptability by 0.5 percentage points, but the improvement was too small and came with slightly higher regret, slightly lower within-one-point quality, and 124.2 additional mean samples. Thresholds remain unchanged after observing the result.

## Exact reuse evidence

The completed control and candidate files also establish that a future paired runner can safely share deterministic work. Across all 200 positions and 600 adaptive trials, there were zero mismatches in reference results, fixed-budget results, pre-refinement stage histories, pre-refinement top moves, or complete unrefined adaptive trials after excluding elapsed-time fields.

The raw evidence is stored in `adaptive-v4-baseline-development-200.json`, `adaptive-v4-baseline-development-200.md`, `adaptive-v4-refinement-development-200.json`, and `adaptive-v4-refinement-development-200.md`.

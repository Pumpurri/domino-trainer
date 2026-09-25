# Opening-balanced refinement development protocol

This follow-up tests whether gentler response-only rebalancing can retain the opening-quality signal from the first study without destabilizing coaching labels.

## Locked scope

- 36 fresh opening positions with at least 6 legal moves
- 5 independent repetitions per position
- exactly 120 root samples for every legal move and variant
- the same 900-particle belief pool for all variants within a repetition
- two independent 5,000-sample references per position
- 9 workers
- no access to real opponent hands or sleeping tiles
- no adaptive stopping, root elimination, or extra tree-search iterations

## Predeclared variants

- systematic control
- response-balanced proposal at 10% strength
- response-balanced proposal at 20% strength
- response-balanced proposal at 25% strength

All candidates use posterior-to-proposal importance weights. Return-path categories are excluded because they did not help in the first development study.

## Locked candidate gate

Each candidate is judged independently and must pass every check:

- recommendation changes on at least 5% of trials
- within-one-point quality improves
- mean regret declines
- repeat acceptability does not decline
- mistake-label agreement falls by no more than 1 percentage point
- false-positive mistake calls do not increase
- mean effective sample size is at least 114 of 120
- mean paired runtime rises by no more than 30%
- every legal move receives exactly 120 samples

If multiple candidates pass, select the candidate with the largest regret reduction, breaking ties by within-one-point improvement. A pass advances only to a fresh, larger holdout validation. It does not change the live coach.

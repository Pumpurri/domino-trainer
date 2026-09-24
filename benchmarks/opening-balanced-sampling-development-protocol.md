# Opening-balanced sampling development protocol

This study tests whether rebalancing plausible hidden deals improves 120-sample opening recommendations without changing the analyzer's root budget.

## Locked scope

- 24 fresh opening positions with at least 6 legal moves
- 5 independent repetitions per position
- exactly 120 root samples for every legal move and every variant
- the same 900-particle belief pool for all variants within a repetition
- two independent 5,000-sample references per position
- 9 workers
- no access to real opponent hands or sleeping tiles
- no adaptive stopping, root elimination, or extra tree-search iterations

## Predeclared variants

- systematic control
- response-balanced proposal at 35% strength
- response-balanced proposal at 60% strength
- response-and-return-balanced proposal at 35% strength
- response-and-return-balanced proposal at 60% strength

Each candidate builds a proposal distribution from opponent response categories for every legal root move. The return variants also model whether the player's remaining hand can answer the values exposed by plausible opponent replies. Systematic selection samples that proposal, and posterior-to-proposal importance weights correct the estimates back to the original belief distribution.

## Locked candidate gate

Each candidate is judged independently and must pass every check:

- recommendation changes on at least 5% of trials
- within-one-point quality improves
- mean regret declines
- repeat acceptability does not decline
- mistake-label agreement falls by no more than 1 percentage point
- false-positive mistake calls do not increase
- mean effective sample size is at least 108 of 120
- mean paired runtime rises by no more than 30%
- every legal move receives exactly 120 samples

If multiple candidates pass, select the candidate with the largest regret reduction, breaking ties by within-one-point improvement. A pass advances only to a fresh holdout validation. It does not enable the sampler in the live coach.

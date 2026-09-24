# Confirmed root-racing calibration protocol

V2 passed every locked safety and quality check but changed only 2.5% of recommendations, below the 5% exercise floor. This calibration replays a small predeclared confirmation grid against V2's saved evidence. It performs no new simulation.

Every candidate keeps the 40-sample first stage, top-three protection, combined 60-sample statistical test, exact `120 × legal moves` recommendation budget, 120-sample finalist floor, and targeted post-play label confirmation.

The candidates are:

- `strict-20`: both fresh 10-sample mini-batches favor the leader.
- `nonnegative-20`: at least one mini-batch favors the leader and neither opposes it.
- `directional-20`: the fresh 20-sample result favors the leader and at least one mini-batch is favorable.
- `three-of-four-40`: at least three of four fresh 10-sample mini-batches favor the leader.
- `majority-40`: at least two of four fresh 10-sample mini-batches favor the leader.

Each candidate must pass the complete V2 development gate. Passing candidates are ranked by within-one improvement, regret reduction, reference survival, and stable id. Any selected configuration must be frozen before a fresh holdout. Calibration results cannot release a live policy.

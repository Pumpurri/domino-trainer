# Paired root-racing development protocol

This protocol is locked before collecting development results. Its purpose is to test whether the live analyzer's fixed total work can be allocated more intelligently in high-branching openings.

## Scope

- 24 fresh opening positions with at least six legal moves
- 12 fresh middle-game safety positions with at least four legal moves
- Five independent paired repetitions per position
- The same hidden-deal belief pool for every policy in a repetition
- Two independent 5,000-sample reference runs per position
- Current control at exactly 120 samples per legal move
- A 500-sample-per-move comparison ceiling
- Nine worker processes

Real opponent hands and sleeping tiles are stripped before every belief pool is generated. The candidate cannot use information that the player would not know.

## Candidate policies

The candidates begin with 40, 60, or 80 paired samples for every legal move. Each protects at least the three best first-stage moves. Another move can be eliminated only when all of the following are true:

- Its paired estimated deficit is at least three percentage points.
- The lower edge of its paired 95% interval clears a one-point practical gap.
- At least three of four first-stage mini-batches favor the leader.
- At least two of four mini-batches put the leader more than one point ahead.

All saved evaluations are divided among the surviving moves. Remainders are assigned deterministically, so survivors differ by at most one sample. Every candidate must spend exactly `120 × legal moves` root evaluations. If no move qualifies for elimination, every move receives exactly 120 samples and the result must reproduce the control.

## Locked development gate

An opening candidate advances only if it satisfies every check:

- It changes at least 5% of recommendations, proving the experiment was exercised.
- The reference-best move survives at least 98% of first stages.
- Within-one-point quality improves over the 120-sample control.
- Mean regret declines.
- Repeat acceptability is no worse.
- Mistake-label agreement falls by no more than one percentage point.
- False-positive mistake calls do not increase.
- Effective samples for the selected move increase.
- Every trial spends the exact fixed root budget.

The middle-game safety group must also lose no more than one percentage point of within-one quality, add no more than 0.25 points of regret, and create no additional false-positive mistake calls.

Passing this development gate selects a candidate for a new locked holdout. It does not release the policy. A selected candidate still requires direct runtime measurement, a fresh high-branching opening stress holdout, balanced phase safety validation, and matched self-play before product integration.

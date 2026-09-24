# Confirmed root-racing development protocol

This protocol is locked before collecting V2 development results. V1 improved difficult-opening recommendations at fixed compute but failed its reference-survival and false-accusation checks.

## Scope

- 24 fresh opening positions with at least six legal moves
- Five independent paired repetitions per position
- The same hidden-deal belief pool for every policy in a repetition
- Two independent 5,000-sample reference runs per position
- Current control at exactly 120 samples per legal move
- A 500-sample-per-move comparison ceiling
- Nine worker processes
- No racing in middle, late, or block phases

Real opponent hands and sleeping tiles are stripped before belief generation. The live coach remains unchanged during development.

## Candidate policy

Every legal move receives 40 paired samples. The V1 conservative rule marks provisional eliminations while protecting at least the top three moves. Only the provisional eliminations and their first-stage leader receive a fresh 20-sample confirmation.

A provisional elimination becomes final only when all of the following hold:

- The combined 60-sample paired deficit remains at least three percentage points.
- The combined paired 95% interval clears a one-point practical gap.
- The fresh 20-sample batch alone favors the same leader by more than one point.
- Both fresh 10-sample mini-batches favor the same leader.

Saved evaluations are water-filled among survivors. Every finalist must retain at least 120 samples, and total recommendation work must equal `120 × legal moves` exactly.

If the player chooses an eliminated move, post-decision analysis extends that move to 120 paired samples before making a mistake claim. This evidence cannot affect the recommendation that was already made. Mean post-decision overhead must remain at most 2% of the recommendation budget.

Each repetition saves its common particle weights and all 500 paired outcomes for every legal move. Later threshold studies must replay these traces instead of rerunning the simulator.

## Locked development gate

The candidate advances only if every check passes:

- At least 5% of recommendations change.
- The reference-best move survives at least 98% of first stages.
- Within-one-point quality improves over the 120-sample control.
- Mean regret declines.
- Repeat acceptability is no worse.
- Mistake-label agreement falls by no more than one percentage point.
- False-positive mistake calls do not increase.
- Effective samples for the selected move increase.
- Every finalist has at least 120 samples.
- Every trial spends the exact fixed recommendation budget.
- Mean post-decision confirmation overhead is at most 2%.

Passing selects a frozen candidate for direct runtime measurement and a fresh holdout with balanced safety validation. It does not release the policy or alter the live coach.

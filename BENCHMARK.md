# Mesa Quince benchmark

The benchmark compares three policies:

- `random` chooses an arbitrary legal move and provides a low-skill baseline.
- `casual` uses the engine's phase-aware move policy.
- `strong` evaluates every legal move on the same weighted hidden-hand particles with the proven information-safe rollout. Close leaders also receive deeper information-set tree analysis, but tree evidence cannot override the release policy until it demonstrates a positive paired benchmark result.

## Phase-aware policy

The policy identifies four strategic situations and changes its priorities accordingly:

- Opening play develops connected numbers, preserves ways back into the chain, and safely unloads difficult doubles.
- Middle play controls the ends, uses pass information, and pressures opponents with short hands.
- Late play protects an exit route, blocks immediate threats, and reduces the pips left at risk.
- Likely blocks compare the player's remaining pip position with estimated opponent totals and favor moves that improve the expected blocked result.

Only a pass creates a certain void. Other tile choices influence hidden-hand probabilities but do not prove that a player lacks a number.

## Information Set Monte Carlo Tree Search

Every legal root move is first evaluated against every one of the same weighted belief particles. This paired base prevents one move from receiving easier hidden deals than another and retains the strongest previously measured policy as a safety rail.

When the base leaders remain statistically close, the search adds up to 50% more iterations for those leaders. The tree learns the recommending player's future choices while Rosa and Tino use the stronger information-safe opponent model. An information-set key contains that player's own hand plus public information: chain ends, played tiles, hand sizes, turn, passes, and proven voids. It never contains either opponent's hidden tile identities.

The tree can extend to twelve turns. UCT selection uses the real scoring objective, one for winning the round and zero otherwise. Remaining pips are reported as evidence but do not create reward for losing. The engine records effective tree depth, revisited-action rate, paired base outcomes, and paired tree outcomes so deeper search can be promoted only after it proves an improvement.

## Matched schedule

Each seeded deal contains three fixed ten-tile hands and the same 25 sleeping tiles. It is replayed 18 times:

1. All six assignments of Random, Casual, and Strong to the three seats.
2. Each of the three seats as the round starter.

Every strategy therefore receives every hand, seat, and starting condition equally. Confidence intervals resample complete deal clusters, not individual replays, because the 18 replays from one deal are correlated.

## Commands

Run the fast development check:

```sh
npm run benchmark:quick
```

Run the standard 2,160-round benchmark:

```sh
npm run benchmark
```

Save a machine-readable baseline:

```sh
npm run benchmark -- --json=outputs/benchmark-baseline.json
```

Run the same 120-sample search used by the interactive Strong opponent:

```sh
npm run benchmark -- --samples=120 --json=outputs/benchmark-production.json
```

The coach keeps 900 persistent belief particles, then deterministically selects 120 weighted representatives for paired evaluation and close-decision tree analysis. This preserves a broad belief pool while keeping an interactive decision responsive.

The browser splits those same 120 representatives across four background workers and merges their weighted outcomes. Every move still receives the exact same paired hidden deals. The work is parallelized, not statistically reduced. A completed position is cached, so asking for a hint and then playing does not repeat the analysis.

The main controls are:

- `--deals=N`: number of independent matched deals. Each deal creates 18 rounds.
- `--samples=N`: hidden-hand samples used by Strong on every decision.
- `--scenario-samples=N`: samples used for the designed strategic positions.
- `--confidence-resamples=N`: matched-deal bootstrap resamples.
- `--workers=N`: CPU worker threads. The default uses up to eight logical cores while leaving one free.
- `--seed=TEXT`: deterministic deal seed.
- `--json=PATH`: optional JSON report destination.

Equivalent environment variables begin with `MESA_BENCH_`; see `scripts/benchmark-engine.mjs` for their exact names.

Measure the interactive opening fixture:

```sh
npm run benchmark:latency
```

Use the Deep Review budget on the same fixture:

```sh
MESA_ANALYSIS_SAMPLES=500 MESA_ANALYSIS_PARTICLES=1200 npm run benchmark:latency
```

On the current development machine, a ten-choice opening with 120 samples per move fell from 7,537 ms on one worker to 2,616 ms across four workers, a 2.88x wall-time speedup. The selected move and every merged base win rate were identical. Hardware and browser overhead will change the absolute time.

At the 500-sample Deep Review budget, the same fixture fell from 20,365 ms on one worker to 6,411 ms across four workers, a 3.18x wall-time speedup. The selected move and merged win rates again remained identical.

## Reported metrics

- Round win rate with a matched-deal 95% bootstrap interval.
- Average pips remaining at the end of a round with a 95% interval.
- Blocked-round win rate.
- Performance when starting and not starting.
- A complete strategy-seat by starting-seat matrix.
- Results on explicit strategic regression positions.

The designed positions are transparent regression cases for agreed principles. They are not a substitute for a future expert-labeled dataset.

## Current release reference

The release selector was evaluated on 120 matched deals, producing 2,160 balanced rounds with 80 paired samples per Strong decision.

| Strategy | Round win rate | Average end pips | Blocked win rate |
| --- | ---: | ---: | ---: |
| Random | 19.3% [17.7, 21.0] | 22.55 [21.70, 23.36] | 18.1% [16.3, 19.8] |
| Casual | 35.8% [34.1, 37.6] | 17.19 [16.37, 18.07] | 35.7% [33.5, 37.9] |
| Strong | 42.4% [40.5, 44.5] | 16.52 [15.69, 17.33] | 42.7% [40.3, 45.1] |

Strong selected the expected move in all six designed strategic positions. These figures are a regression reference for this implementation, not a claim of optimal domino play.

## Search repair experiments

The original all-player ISMCTS regressed from 41.3% at 80 samples to 41.2% at 500. A corrected root-agent tree with win-only utility, paired root deals, and strong rollouts reached 41.7% at 80 samples. That repaired part of the regression but remained below the proven 42.4% release selector, so direct tree overrides were rejected.

| Policy and budget | Round win rate | Average end pips | Blocked win rate | Strategic positions |
| --- | ---: | ---: | ---: | ---: |
| Original ISMCTS, 80 | 41.3% [39.5, 43.1] | 16.79 [16.09, 17.49] | 42.6% [40.5, 44.8] | 6/6 |
| Original ISMCTS, 500 | 41.2% [39.1, 43.2] | 16.85 [16.02, 17.71] | 41.9% [39.7, 44.2] | 6/6 |
| Corrected root-agent tree, 80 | 41.7% [39.6, 43.7] | 17.00 [16.18, 17.86] | 41.9% [39.6, 44.2] | 6/6 |
| Release selector, 80 | 42.4% [40.5, 44.5] | 16.52 [15.69, 17.33] | 42.7% [40.3, 45.1] | 6/6 |
| Release selector, 500 | 45.1% [43.3, 47.0] | 15.71 [14.98, 16.44] | 45.9% [43.6, 48.3] | 6/6 |

The deeper tree remains available as diagnostic evidence for close decisions. It is not allowed to replace the release move because two independently tested override rules reduced the quick benchmark. Promotion now requires a positive paired result instead of an architectural assumption.

## Counterfactual coaching and style learning

Every voluntary user decision now stores an information-safe snapshot containing the public board, the user's hand, legal alternatives, paired outcomes, belief confidence, pass evidence, return-route evidence, and the recommendation available at that moment. It never stores the opponents' hidden tiles.

After the round, the review reconstructs the opponents' actual hands separately and audits earlier reads. A paired difference interval classifies decisions as best, statistically close, a small miss, a mistake, or a large mistake. An alternate line is never described as guaranteed to have changed the exact result.

Rosa and Tino each receive a persistent style profile based on public choices evaluated across plausible sampled hands. It tracks high-pip, double, connection, blocking, consistency, and unpredictability tendencies. The profile affects hidden-deal weights and simulated replies only after repeat observations. Changing the real hidden hand without changing public actions leaves the learned profile unchanged.

The September 3 quick regression repeated the established deterministic reference exactly: Random 23.6%, Casual 37.5%, Strong 38.2%, and Strong 6/6 on strategic positions. Style adaptation is intentionally absent from the neutral matched benchmark because it represents learned history against a specific player. The tree-control gate remains closed because no tested override has beaten the 42.4% release selector in the full matched benchmark.

## Training, replay, and calibration

The Mistake Lab restores the exact public chain, user hand, hand sizes, pass-derived voids, and public event history from a reviewed decision. Each attempt samples a new opponent deal consistent with that evidence and reweights it using only the opponent choices and style information that were public at the time. The original opponents' real hidden hands are never copied into the replay. A short response line makes the regenerated deal useful without presenting one sampled continuation as certain.

Progress is device-local and measures estimated decision loss rather than round results. It records mistakes by opening, middle, late, and likely-block phases; groups repeated leaks into pass pressure, one-tile defense, end control, exit sequencing, block management, and inference; and compares rolling 10, 25, and 50-round windows. Six fixed tactical drills test those same concepts independently of deal luck.

Every reviewed belief probability is paired with the post-round observed outcome and accumulated into reliability buckets. Style tendencies are checked against later revealed legal choices for Rosa and Tino separately. Once at least 40 checks show poor calibration, particle weights and style tendencies are automatically shrunk toward neutral and their displayed confidence is lowered. This safeguard uses only completed-round outcomes and cannot expose a current hidden hand.

The JSON export is deliberately narrower than the live review. It includes public table state, the learner's hand, legal options, simulation estimates, recommendation labels, analysis quality, Deep Review agreement totals, and calibration outcomes. It excludes revealed opponent hands, sleeping tiles, and the large paired rollout arrays. Automated tests enforce replay consistency, regenerated deals, calibration down-weighting, legal drill answers, progress idempotency, and export privacy.

## Deep Review

The live coach uses 120 representative hidden deals so a move can be played without a long wait. Deep Review is an optional post-round pass that rebuilds every decision with more than one legal option from the stored public chain, public events, proven voids, hand sizes, opponent-style state, and the learner's own hand. Opponent tile slots are placeholders while new plausible deals are generated, so the completed round's real hidden hands never enter the simulation.

Each meaningful decision is evaluated on 500 weighted representatives from a new 1,200-particle belief pool. Four browser workers analyze disjoint shards and merge the paired outcomes. The interface reports progress and supports cancellation. A cancelled or failed run keeps the original live report.

The finished report records exact recommendation agreement, changed recommendations, and unstable positions. A position is unstable when the recommendation changes, the deep verdict remains statistically close, confidence is low, or the paired 95% difference interval crosses zero. Deep labels replace live labels for that round in Mistake Lab, device-local progress, and information-safe exports. A later live rerender cannot overwrite a completed deep label.

Deep Review does not change Rosa, Tino, or the release move selector. The matched benchmark remains the policy gate, while Deep Review measures the reliability of coaching labels with a larger per-decision budget.

## Analyzer convergence and label reliability

The round benchmark measures whether a playing policy wins. It does not establish whether two independent analyzer runs recommend the same move or assign the same coaching label. The separate reliability benchmark collects an equal number of real simulated decisions from opening, middle, late, and likely-block phases, then compares independently seeded 120, 500, 1,000, and 2,000-sample analyses with a separate high-budget reference.

Run the quick four-position smoke test:

```sh
npm run benchmark:reliability:quick
```

Run the standard 16-position study:

```sh
npm run benchmark:reliability
```

The benchmark reports exact top-move agreement, the rate of selecting a move within one reference win-rate point, reference-estimated regret, exact and binary mistake-label agreement, false-positive and false-negative mistake calls, paired-interval coverage, independent-run repeatability, phase splits, branching, and runtime. Confidence intervals resample complete positions so repeated analyses of one position are not incorrectly treated as independent data. Small late games are also checked with the exact revealed-deal solver as a diagnostic, never as information available to the analyzer.

The first balanced reliability run used four positions per phase, two independent runs per budget, an independent 2,000-sample reference, 2,000 position-level bootstrap resamples, and eight worker threads. Only 6 of 16 reference recommendations were statistically clear, which is why exact top agreement must be read alongside regret and paired uncertainty.

| Samples | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False-positive mistakes | Repeatably acceptable |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 120 | 62.5% [46.9, 78.1] | 62.5% [46.9, 78.1] | 1.15 [0.59, 1.77] | 78.1% [59.4, 93.8] | 3.1% [0.0, 9.4] | 37.5% [12.5, 62.5] |
| 500 | 75.0% [59.4, 90.6] | 78.1% [62.5, 90.6] | 0.63 [0.18, 1.25] | 78.1% [59.4, 93.8] | 3.1% [0.0, 9.4] | 62.5% [37.5, 87.5] |
| 1,000 | 62.5% [43.8, 81.3] | 65.6% [46.9, 84.4] | 0.93 [0.37, 1.61] | 84.4% [65.6, 100.0] | 0.0% | 50.0% [25.0, 75.0] |
| 2,000 | 93.8% [84.4, 100.0] | 96.9% [90.6, 100.0] | 0.05 [0.00, 0.14] | 84.4% [65.6, 100.0] | 0.0% | 93.8% [81.3, 100.0] |

Five endgame positions were small enough for the deal-specific exact solver. The information-safe 2,000-sample reference chose one of the exact winning actions in all five, but this small diagnostic is not a general accuracy claim.

No tested budget passed every provisional gate. In particular, 500 samples improved mean regret but did not make coaching labels reliable enough to treat as ground truth. The non-monotonic 1,000-sample result also shows why a single seeded run is misleading. Fixed live and deep budgets remain in place, and Deep Review remains a stronger second opinion with uncertainty labels. Adaptive stopping should not be enabled until it is tested against a larger corpus and uses repeated agreement or sequential confidence rules.

On the balanced run, mean analysis time ranged from 1.4 seconds at 120 samples to 19.0 seconds at 2,000 under eight-core contention. The 2,000-sample opening p95 was 117.3 seconds. Future scheduling work should allocate across decisions according to legal-action count rather than treating every position as equal.

## Frozen Adaptive Analyzer V1 study

The experimental analyzer accumulates independent paired batches at cumulative targets of 120, 250, 500, 1,000, and 2,000 representatives. Every move receives the same hidden deals within a batch, and earlier outcomes remain in the estimate. Early stopping requires the same leading move across at least two consecutive checks, a paired 95% interval whose lower bound exceeds a one-point practical threshold against every competitor, and a stable coaching verdict. At the hard cap, unresolved recommendations are explicitly marked uncertain.

This capability is benchmark-only until it passes every release gate. Rosa, Tino, the live 120-sample coach, and the 500-sample Deep Review remain unchanged.

The completed 400-position V1 study is stored in `benchmarks/adaptive-reliability-400.json` and `benchmarks/adaptive-reliability-400.md`. That seed and corpus are frozen as historical evidence. V2 development and label calibration must not read them.

## 400-position adaptive result

The preregistered study completed all 400 balanced positions and 1,200 independent trials per analyzer in just under two hours with six workers. The 5,000-sample reference marked 292 of 400 recommendations statistically clear.

| Analyzer | Exact top | Within 1 point | Mean regret | Mistake-label agreement | False positives | Repeat acceptable | Mean runtime |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Fixed 120 | 73.6% | 80.8% | 0.68 | 87.7% | 0.8% | 58.0% | 0.67 s |
| Fixed 500 | 83.3% | 89.9% | 0.27 | 90.2% | 2.2% | 77.8% | 2.62 s |
| Fixed 2,000 | 91.2% | 96.4% | 0.09 | 94.8% | 2.3% | 92.0% | 9.96 s |
| Adaptive | 89.4% | 95.3% | 0.11 | 94.3% | 2.1% | 88.8% | 9.26 s |

Adaptive analysis used a mean of 1,373 samples, 31.4% fewer than fixed 2,000, but reduced mean wall time by only 7.0%. It allocated computation in the intended direction: reference-clear positions averaged 1,161 samples while reference-unclear positions averaged 1,945. Of the 1,200 adaptive trials, 258 stopped at 250, 126 at 500, 112 at 1,000, and 704 at 2,000.

The adaptive release gate failed. It passed corpus size, within-one-point quality, and regret, but missed mistake-label agreement at 94.3% versus the 95% requirement, false positives at 2.08% versus the 2% maximum, and repeat acceptability at 88.8% versus the 90% requirement. Fixed 2,000 also failed the complete gate, narrowly missing mistake-label agreement and false positives.

Adaptive analysis therefore remains outside the live coach. It did not match fixed 2,000 overall, although it slightly reduced false-positive mistakes and performed well in late games. The evidence points to cross-deal variability that pooled within-run intervals do not fully capture, early stops that are not stable enough across independent belief samples, and coaching labels near fixed severity thresholds. The next experiment should add between-batch uncertainty and an independent confirmation batch, separate coaching-label calibration from move ranking, and use a new held-out seed rather than tune against this corpus.

## Adaptive Analyzer V2 protocol

V2 directly addresses the V1 failure modes:

- Its interval is never narrower than the pooled paired interval and widens when independently seeded batches disagree.
- A recommendation must first become a stable candidate, then survive a fresh batch before early stopping.
- Opening and middle decisions require at least 500 samples. Late and likely-block decisions require at least 250. Six or more legal moves require at least 1,000 regardless of phase.
- Moves that cannot be distinguished beyond a one-point practical margin form a plausible-best set. Selecting any member is accepted for recommendation evaluation.
- Recommendation confidence and mistake confidence are separate. A move is labeled a mistake only when its estimated loss is practical, its widened lower bound clears the label threshold, and independent batches agree. Otherwise the label abstains.
- Mistake thresholds are configurable independently from move ranking and stopping, so they can be calibrated without changing which move the analyzer recommends.

Before opening the new held-out corpus, the release gate is locked to these requirements:

- At least 90% of recommendations within one reference win-rate point, mean regret no higher than one point, at least 95% binary mistake-label agreement, no more than 2% false-positive mistake calls, and at least 90% repeat acceptability.
- Compared with fixed 2,000 on the same corpus, within-one-point quality may be no more than 3 percentage points lower, mean regret may be no more than 0.05 point higher, and repeat acceptability may be no more than 5 percentage points lower.
- At least 95% independent-run stability for the plausible-best set and at least 5% mean sample savings versus fixed 2,000.

First run the distinct development corpus using no more than six worker threads:

```sh
caffeinate -i npm run benchmark:reliability:develop
npm run benchmark:reliability:calibrate
```

The calibration command rejects any report whose seed is not explicitly a development seed. Once its policy is selected and locked in source, run the new held-out corpus exactly once:

```sh
caffeinate -i npm run benchmark:reliability:holdout
```

Both long runs use atomic per-position checkpoints and support `-- --resume`. The held-out command evaluates 100 positions in each phase, three independent repetitions, fixed 120, 500, and 2,000-sample analyzers, V2 up to 2,000 samples, and an independent 5,000-sample reference. The live coach remains unchanged unless V2 passes every preregistered gate.

### V2 development result

The separate 80-position development study completed 20 positions in each phase with three independent trials per analyzer. V2 passed the expanded gate used above. This is tuning evidence, not the held-out release result.

| Analyzer | Exact top | Acceptable top | Within 1 point | Mean regret | Mistake-label agreement | False positives | Repeat acceptable | Mean samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Fixed 2,000 | 85.4% | 99.6% | 96.7% | 0.09 | 93.3% | 3.8% | 92.5% | 2,000 |
| Adaptive V2 | 86.7% | 100.0% | 95.0% | 0.09 | 95.8% | 0.0% | 90.0% | 1,825 |

V2 used 8.8% fewer samples, kept 100% plausible-best-set stability, abstained on 25.4% of coaching labels, and was correct on every non-abstained development label. It marked 78.3% of recommendations uncertain, showing that the confirmation rule is conservative. Label calibration selected and locked the existing policy unchanged: a 1.5-point practical lower bound, a 4-point minimum estimated loss, 75% positive batch agreement, and 50% practical-gap batch agreement.

The run also exposed static worker tail imbalance when one unusually expensive opening remained behind a long queue. Reliability workers now take the next available position dynamically, preserving the six-worker cap while preventing idle workers when uneven positions remain.

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

### V2 held-out result and label audit

The independent 400-position held-out study is recorded in `benchmarks/adaptive-v2-holdout-400.md`. V2 passed every move-quality, repeatability, false-positive, and sample-savings check, but its binary mistake-label agreement was 93.2%, below the locked 95% requirement. This is a failed release; V2 is not used by the live coach.

The frozen diagnostic in `benchmarks/adaptive-v2-label-audit.md` separates 1,200 coaching outcomes. Of 75 missed reference mistakes, 74 were explicit abstentions and one was a confident acceptable call. Seven calls falsely accused a move. The reference calls a mistake with a gap of at least three points and a paired lower bound above zero, whereas the adaptive policy requires at least four points, a lower bound above 1.5, and independent-batch agreement. The 5,000-sample reference is an estimate, not ground truth. Neither the V2 policy nor its gate is retuned against this held-out corpus.

## V3 coaching-label development protocol

Move ranking, recommendation stopping, and the V2 held-out result remain frozen. The next experiment changes only the coaching-label decision. A fresh development seed supplies 200 positions, balanced across four phases, with three independent adaptive trials per position. Its recorded independent-batch gaps allow candidate thresholds to be replayed correctly without rerunning or changing move selection.

The product target is fixed before the next holdout: the independent 5,000-sample reference calls a **material mistake** only if the chosen move loses at least four estimated win-rate points and the paired interval's lower bound exceeds 1.5 points. It calls a move **acceptable** when it is the reference's top move or the paired interval's upper bound is below four points. Other reference positions are unresolved and excluded from label accuracy, but their count is reported. This three-way target is deliberately more meaningful than V2's legacy binary label and is not a claim of perfect truth.

Among resolved reference positions, release requires at least 70% decided coverage, at least 70% material-mistake recall, at least 97% accuracy among decided labels, no more than 1% false accusations, and no more than 1% confident misses. There must be at least 160 resolved positions and 20 reference mistakes. Explicit abstentions are counted separately rather than silently becoming confident misses. The move-quality, repeatability, and sample-savings checks from V2 remain required in a fresh 400-position holdout. These thresholds are fixed now, before that holdout is generated.

The development selector may vary the label-only practical gap, minimum estimated loss, and independent-batch agreement thresholds. It prioritizes recall among candidates meeting every safety and coverage check, with false accusations and decided accuracy as tie-breakers. If no candidate safely improves on the current policy, there is no automatic promotion. The V2 holdout is not an input to selection.

```sh
caffeinate -i npm run benchmark:reliability:develop:v3
npm run benchmark:reliability:calibrate:v3
```

Completed positions are checkpointed under `outputs/`; add `-- --resume` to the development command after an interruption. Only after development selection is reviewed and the label policy locked should a new, never-before-run held-out seed be evaluated. A passing new protocol is required before any live integration.

### V3 development result and locked label policy

The fresh development run completed all 200 balanced positions and 600 adaptive trials. Move selection was unchanged: adaptive and fixed 2,000 both placed 95.7% of recommendations within one reference point. Adaptive mean regret was 0.120 versus 0.108 for fixed 2,000, repeat acceptability was 90.5% versus 91.5%, plausible-best-set stability was 100%, and adaptive analysis used a mean of 1,735 samples.

The V2 label policy already passed the new selective development gate with 80.2% coverage, 75.4% material-mistake recall, 99.8% accuracy among decided labels, a 0.18% false-accusation rate, and no confident misses. The selected label-only policy improved recall to 81.2% and coverage to 80.7%, with 99.3% decided-label accuracy, 0.53% false accusations, and no confident misses. It uses a 0.5-point practical lower bound, a 3-point minimum estimated loss, 60% positive batch agreement, and 50% practical-gap batch agreement.

This policy is now locked before opening the fresh V3 holdout. The development data and full selection are stored in `benchmarks/adaptive-v3-development-200.json`, `benchmarks/adaptive-v3-development-200.md`, and `benchmarks/adaptive-v3-label-selection.json`. The new holdout uses seed `mesa-quince-adaptive-v3-holdout-v1`; its thresholds must not change after results are observed.

### V3 held-out result

The fresh 400-position holdout completed with the locked V3 label policy. Every selective coaching-label check passed: 79.0% decided coverage, 75.0% material-mistake recall, 99.0% accuracy among decided labels, 0.8% false accusations, and no confident misses across 377 resolved reference positions and 52 reference material mistakes.

Move quality remained strong and noninferior to fixed 2,000. Adaptive recommendations were within one reference point 94.9% of the time, mean regret was 0.128, plausible-best-set stability was 100%, and the analyzer saved 11.8% of samples. However, repeat acceptability was 88.8%, below the predeclared 90% absolute requirement. Fixed 2,000 reached 89.0% on the same corpus. The noninferiority check passed, but the absolute check did not.

V3 therefore **failed the complete release gate** and remains outside the live coach. The label-policy experiment succeeded on its stated measures, but the analyzer as a whole was not stable enough for release. The thresholds are not revised after seeing this result. Full evidence is stored in `benchmarks/adaptive-v3-holdout-400.json`, `benchmarks/adaptive-v3-holdout-400.md`, `benchmarks/adaptive-v3-release.json`, and `benchmarks/adaptive-v3-release.md`.

### V4 candidate-only refinement protocol

V3 diagnostics showed that every unacceptable adaptive trial reached the 2,000-sample cap with an unresolved top-set gap of at most three points. The reference-leading move was still present in the analyzer's plausible-best set in every one of those trials. V4 therefore adds one 250-sample paired refinement batch only when the analyzer reaches the ordinary cap with multiple plausible-best moves and a leading gap no larger than three points. The refinement evaluates only those plausible candidates, while comparisons against excluded moves continue to use the complete shared batches.

This is a development candidate, not a live-coach promotion. Its matched V3 control and V4 refinement runs use the fresh `mesa-quince-adaptive-v4-development-v1` seed. Advancement requires the selective coaching-label gate to remain green, mean samples to remain at or below 1,900, repeat acceptability to reach at least 90%, within-one-point quality to remain within one percentage point of the matched control, and mean regret to remain within 0.02 points of the matched control. Any policy selected from development must be frozen before a new V4 holdout is generated. The completed V3 holdout will not be reused as release evidence.

The 200-position matched development comparison is complete. Refinement raised repeat acceptability from 89.0% to 89.5%, changed within-one-point quality from 95.0% to 94.8%, changed mean regret from 0.114 to 0.117, and raised mean samples from 1,777.5 to 1,901.7. It also failed the selective label gate with 64.3% material-mistake recall and a 1.40% false-accusation rate. The candidate therefore failed development and will not advance. See `benchmarks/adaptive-v4-development-comparison.md` for the complete decision.

### Paired benchmark execution

Refinement experiments now compute each position's independent reference, fixed 120/500/2,000 runs, and ordinary adaptive stages only once. Immediately before candidate-only refinement, the runner captures the complete V3 result. The same output therefore contains a matched V3 control and refined candidate without rerunning their shared work.

This changes execution cost, not the comparison. A validation across the existing 200-position V4 development corpus found zero mismatches in all 200 reference results, zero mismatches in all 600 fixed-budget trials, and zero mismatches in all 600 pre-refinement stage histories and top choices. Automated tests also compare a standalone control against the captured control after excluding elapsed time. Wall-clock timing is not expected to be identical because the paired runner shares work and measures the refinement boundary directly.

### V5 robust-selection protocol

V4 refinement is retired because it spent an extra batch in 298 of 600 trials but changed only 13 recommendations. Seven changes reduced reference regret, five increased it, and one was neutral. The harmful changes outweighed the helpful ones in total regret. V5 therefore returns to the ordinary V3 sample schedule and changes only how an unresolved plausible-best set is interpreted.

One adaptive run supplies all candidate policies. `confidence-adjusted` maximizes the estimated win rate minus its 95% margin. `pairwise-minimax` maximizes the worst paired lower bound against another plausible candidate. `batch-consensus` favors moves that remain within one point of the leader across the greatest share of independent batches. `downside-protected` maximizes the worst batch-relative result. All policies use the same hidden-deal particles, stages, stopping point, and coaching label. They add no simulations and store only compact per-candidate scores, not hidden hands.

The fresh development seed is `mesa-quince-adaptive-v5-development-v1`, with 200 positions balanced across four phases and three independent trials per position. A policy advances only if it changes at least one decision, reaches at least 90% repeat acceptability, does not fall below the mean selector on repeat acceptability, stays within one percentage point of its within-one-point quality, stays within 0.02 mean regret, preserves mistake-label agreement and false-accusation rate, and uses no additional samples. If multiple policies pass, the winner is chosen by repeat acceptability, then lower regret, then higher within-one-point quality, then policy name. The selected policy must be frozen before a separately seeded holdout. No V5 development result changes the live coach.

### V5 robust-selection result

The full 200-position development run completed, and no V5 selector passed. The mean selector reached 87.5% repeat acceptability, 94.0% within-one-point quality, and 0.131 mean regret. Pairwise minimax was the only directionally positive alternative at 88.5%, 94.2%, and 0.130, but it changed only 0.8% of decisions and remained below the locked 90% repeatability target. Batch consensus reduced repeat acceptability to 86.5%. Downside protection changed 12.0% of decisions but degraded repeat acceptability to 76.5%, within-one-point quality to 89.5%, and mean regret to 0.266. Confidence adjustment changed no decisions.

The failure is concentrated in difficult early decisions rather than late play. Mean-selector repeat acceptability was 62.0% in opening positions and 41.7% among the twelve positions with at least six legal moves, compared with 98.0% in both late and blocked positions. The high-branching slice is small and diagnostic, not a new release gate. V5 will not advance to a holdout or the live coach. The next experiment isolates one-shot sampling, staged aggregation, and adaptive stopping with matched particles and rollout outcomes. See `benchmarks/adaptive-v5-development-comparison.md` for the recorded decision.

### Paired sampler-ablation protocol

This is a causal diagnostic, not a V6 candidate or a release study. The fresh seed `mesa-quince-sampler-ablation-v1` supplies 48 positions from distinct deals: 24 opening positions with at least six legal moves and 24 middle positions with at least four. Each position receives three repetitions, the cumulative stages 120, 250, 500, 1,000, and 2,000, and a separate 5,000-sample reference. The corpus and interpretation below are fixed before opening the full dataset.

Within each repetition, one shared 2,000-particle representative sequence is evaluated two ways: as one batch and as disjoint stage windows of 120, 130, 250, 500, and 1,000 particles. Every particle weight and paired root-move outcome must match exactly after merging, and every evaluation uses the same deterministic rollout policy. The same staged results are replayed through the ordinary adaptive stopping rules and through a forced-2,000 control without rerunning simulations. A second staged sequence preserves current production-like behavior by rebuilding an information-safe belief sample for each stage; it too is replayed with ordinary and forced stopping. The diagnostic never receives the opponents' realized hidden tiles and does not persist sampled hands.

Any top, ranking, paired-outcome, weight, sample-count, or win-rate mismatch between the shared one-shot analysis and the shared forced-stage merge identifies an aggregation or sample-window defect. Early stopping is considered materially harmful when the early variant loses more than two percentage points of within-one-point quality, loses more than three percentage points of repeat acceptability, or adds more than 0.03 mean regret against its forced control. Independent stage sampling uses the same thresholds against the shared forced control. Results are paired within positions and bootstrapped across complete positions. The diagnostic chooses a component to investigate; it cannot promote an analyzer or change the live coach.

```sh
caffeinate -i npm run benchmark:sampler-ablation
```

The run uses nine worker threads and an atomic per-position checkpoint at `outputs/sampler-ablation-v1-48.checkpoint`. Add `-- --resume` after an interruption.

### Paired sampler-ablation result

The 48-position run completed all 144 repetitions. One-shot and shared staged analysis had zero top, ranking, paired-outcome, weight, sample-count, or win-rate mismatches. Forced adaptive replay also matched its staged evidence exactly. Every targeted trial reached 2,000 samples, so early stopping made no decisions and caused no measured change.

Independent stage sampling crossed the predeclared overall harm threshold through mean regret: 0.267 versus 0.211 for a shared particle sequence, a +0.056 difference. Within-one-point quality was 88.9% versus 90.3%, while repeat acceptability was 77.1% for both. The methods chose different moves in 39 of 144 trials. Shared sampling had lower reference regret in 20 trials, independent sampling in 19, and 105 were tied, showing that harm came from the magnitude of a few misses rather than a uniform advantage.

The effect reversed by phase. In high-branching openings, independent sampling reached 94.4% within one point, 0.149 mean regret, and 87.5% repeat acceptability, compared with 88.9%, 0.215, and 75.0% for shared sampling. In wide middle positions, shared sampling reached 91.7%, 0.207, and 79.2%, compared with 83.3%, 0.386, and 66.7% for independent sampling. Confidence intervals remain broad with 24 positions per group, so this result rejects a global shared-pool replacement. It supports a benchmark-only phase-aware candidate: retain independent stage samples for openings, use a persistent disjoint particle sequence in the middle game, and leave late and blocked play unchanged. That candidate must be frozen before a new full-corpus development run and cannot be integrated from this diagnostic alone. See `benchmarks/sampler-ablation-v1-48.md`.

### V6 phase-aware sampling protocol

V6 tests the phase interaction found by the sampler ablation without changing the live coach. The candidate is frozen before opening its development corpus. In middle-game positions, its adaptive batches draw disjoint windows from one persistent 2,000-sample plausible hidden-deal pool. In opening, late, and likely-block positions, it reuses the matched V3 control result exactly. This avoids redundant simulation and guarantees that only the middle-game sampling policy can change a decision. Opponents' realized hidden tiles remain unavailable to every analysis.

The fresh seed `mesa-quince-adaptive-v6-development-v1` supplies 200 positions balanced across four phases, with three repetitions per position, fixed 120, 500, and 2,000-sample baselines, adaptive stages at 120, 250, 500, 1,000, and 2,000, and an independent 5,000-sample reference. The candidate receives no extra nominal samples. The paired control uses the current independent stage sampler.

Every check below is locked before the run. V6 advances only if all pass:

- At least 90% repeat acceptability overall.
- Repeat acceptability no lower than the matched control.
- Within-one-point quality no more than one percentage point below control.
- Mean regret no more than 0.02 point above control.
- Middle-game mean regret improves by at least 0.03 point.
- Mistake-label agreement does not decline and false-positive mistake calls do not increase.
- Mean sample use does not increase.
- At least one middle-game recommendation changes, proving that the candidate was exercised.

Passing development would authorize only a new, separately seeded 400-position holdout. It would not promote V6 into the product. Failing any check retires the candidate and moves the investigation to rollout quality.

```sh
caffeinate -i npm run benchmark:reliability:develop:v6
```

The run uses nine worker threads and atomic per-position checkpoints at `outputs/adaptive-v6-phase-aware-development-200.checkpoint`. Add `-- --resume` after an interruption.

### V6 phase-aware sampling result

The full 200-position development run completed all 600 trials. V6 failed four locked checks and is retired without a holdout or live-coach change.

| Measure | Independent-stage control | Phase-aware candidate |
| --- | ---: | ---: |
| Repeat acceptability | 90.0% | 89.5% |
| Within one reference point | 94.5% | 94.3% |
| Mean regret | 0.118 | 0.125 |
| Mistake-label agreement | 94.0% | 94.2% |
| False-positive mistakes | 1.17% | 1.17% |
| Mean samples | 1,797.5 | 1,802.5 |

The candidate changed 12.7% of middle-game recommendations, proving the new path was exercised. Those changes moved in the wrong direction: middle-game mean regret rose from 0.094 to 0.124 instead of improving by the required 0.03, and middle repeat acceptability fell from 90% to 88%. Overall repeat acceptability missed the 90% target by half a percentage point, and mean sample use increased by five.

Within-one-point quality, overall regret noninferiority, mistake-label agreement, and false-accusation safety all passed. That is not enough to rescue the candidate because the preregistered middle-game benefit did not appear. The result rejects phase-aware persistent sampling and moves the next investigation to the deterministic rollout policy. The full evidence is stored in `benchmarks/adaptive-v6-development-200.json` and `benchmarks/adaptive-v6-development-200.md`.

### Rollout-policy diagnostic protocol

The next diagnostic tests the policy that completes simulated games after a root move. It does not change hidden-deal sampling, adaptive stopping, recommendation selection, Rosa, Tino, or the live coach. Four information-safe policies are compared:

- `current` is the existing rollout: use the phase-aware heuristic to shortlist at most three moves, then choose with public three-turn forecasting.
- `exhaustive-forecast` applies the public three-turn forecast to every legal move without heuristic shortlisting.
- `mixed` chooses the current policy 60% of the time, exhaustive forecast 25%, and the immediate phase-aware heuristic 15%.
- `stochastic-top-two` chooses between the two highest current-policy moves, favoring the leader more strongly as its score advantage grows.

The fresh seed `mesa-quince-rollout-policy-v1` supplies 120 double-nine deals. Every deal is replayed for every three-policy combination, all six seat permutations, and all three starters, producing 72 rounds per deal and 8,640 total rounds. Each policy receives exactly 54 appearances per deal, balanced across seats and starting positions. Randomized choices use deterministic seeds. Policies can inspect only their own hand and public state.

Confidence intervals resample complete deals. Results include round win rate, remaining pips, losing pips, blocked-game success, seat, starter, and strategic-phase slices. A candidate passes this diagnostic only if all of these locked checks pass:

- Its paired overall win-rate difference from the current rollout is positive.
- The lower 95% bound of that difference is no worse than minus one percentage point.
- Its blocked-game win-rate estimate is no more than two percentage points worse.
- Its average losing-pip total is no more than one pip worse.
- No opening, middle, late, or likely-block conditional win-rate estimate is more than two percentage points worse.
- It shows a strategic signal: at least a half-point overall win-rate gain or at least a 1.5-point gain in middle or late play.

Passing selects a direction for a separately seeded analyzer experiment only. It cannot promote a rollout or coach. The opened V6 corpus is used only to produce a forensic report of its 19 changed trials and is not future release evidence.

```sh
npm run benchmark:v6:forensics
caffeinate -i npm run benchmark:rollout-policies
```

The rollout run uses nine workers and checkpoints each completed deal under `outputs/rollout-policy-v1-120.checkpoint`. Add `-- --resume` after interruption.

### Rollout-policy diagnostic result

The complete 120-deal run evaluated 8,640 rounds and 25,920 policy appearances. `exhaustive-forecast` was the only candidate to pass every locked check. Its round win rate was 34.40% versus 32.73% for the current rollout, a paired gain of 1.67 percentage points with a 95% interval of [0.08, 3.29]. It also improved the blocked-game win-rate estimate by 1.94 points and produced positive conditional win-rate estimates in opening, middle, late, and likely-block situations.

The candidate's average losing-hand total was 0.26 pips higher, but the interval included zero and the estimate remained comfortably inside the preregistered one-pip noninferiority limit. Its average end total across all outcomes was slightly lower, 16.89 versus 17.03. The controlled mixture was effectively neutral and failed the strategic-signal check. `stochastic-top-two` was rejected after losing 3.49 percentage points overall and failing every gate.

This result selects exhaustive public forecasting as the next analyzer candidate. It does not change the live coach. Promotion still requires a separately seeded, paired analyzer-quality experiment against the current rollout. The complete evidence is stored in `benchmarks/rollout-policy-v1-120.json` and `benchmarks/rollout-policy-v1-120.md`.

### Exhaustive-rollout analyzer promotion protocol

The promotion study uses the fresh seed `mesa-quince-analyzer-rollout-v1` to collect 200 unseen positions, balanced across opening, middle, late, and likely-block play. Each analyzer receives three adaptive repetitions at 120, 250, 500, 1,000, and 2,000 samples. Current and exhaustive rollouts see the same plausible hidden deals at every paired stage. Neither analyzer can inspect realized opponent hands or sleeping tiles.

Each rollout is scored against its own independent 5,000-sample reference. That measures whether the adaptive analyzer reliably converges under the model it uses, but it could favor each model's own choices. The study therefore adds a neutral cross-reference check: every selected move is scored under both high-budget references, and the average and worst regret are compared. The earlier matched self-play diagnostic supplies the independent evidence that the exhaustive rollout plays stronger dominoes.

Every promotion check below is locked before opening the full corpus. Exhaustive forecasting passes only if all checks succeed:

- At least 5% of recommendations change, proving the candidate was exercised.
- At least 90% of trials finish within one point of their policy-specific reference, mean regret is at most one point, and at least 90% of positions are acceptable on every repeat.
- Mistake-label agreement is at least 95% and false-positive mistake calls are at most 2%.
- Within-one-point quality is no more than one percentage point below control, own-reference mean regret is no more than 0.02 point worse, and repeat acceptability does not decline.
- Mistake-label agreement does not decline and false-positive mistake calls do not increase.
- Average regret across both references improves or ties control, with the upper 95% bound no worse than 0.10 point.
- The share of choices within one point under both references is no more than one percentage point lower.
- No phase has more than 0.10 point worse cross-reference mean regret.
- Deal-specific exact-endgame agreement declines by no more than two percentage points.
- Mean sample use rises by no more than 5%, and mean wall time rises by no more than 75%.

Passing authorizes changing the analyzer rollout to exhaustive public forecasting, followed by the full product test suite and build before the change is pushed. Failing any check keeps the current rollout.

```sh
caffeinate -i npm run benchmark:analyzer-rollout
```

The study uses nine workers and atomic per-position checkpoints at `outputs/analyzer-rollout-v1-200.checkpoint`. Add `-- --resume` after an interruption.

The first execution halted after checkpointing 161 positions, before any aggregate result was calculated or inspected. A highly constrained block position produced fewer valid hidden deals than its requested batch within the generic rejection sampler's eight-attempts-per-target ceiling. The protocol was amended without reducing any budget: benchmark sampling now deterministically expands its attempt target until it obtains the full requested number of valid deals, for at most four expansions. Each retry restarts the same seeded sequence, so it only extends the accepted sample prefix, and both policies still receive identical deals. Reference and adaptive outputs record how many expansions were required. The saved 161 positions need no recalculation because none encountered this condition.

### Exhaustive-rollout analyzer promotion result

The complete 200-position study evaluated 600 adaptive trials per policy. Exhaustive forecasting failed six locked checks and remains outside the live analyzer.

| Measure | Current rollout | Exhaustive forecast |
| --- | ---: | ---: |
| Within one own-reference point | 94.2% | 93.5% |
| Mean own-reference regret | 0.151 | 0.152 |
| Mistake-label agreement | 94.2% | 94.0% |
| False-positive mistakes | 0.7% | 0.2% |
| Repeat acceptability | 86.0% | 85.0% |
| Mean samples | 1,758.3 | 1,758.3 |
| Mean wall time | 15.5 seconds | 17.4 seconds |

Only 3.8% of recommendations changed, below the locked 5% exercise threshold. Cross-reference mean regret moved by +0.004 point with a 95% interval of [-0.020, 0.033], so exhaustive forecasting did not produce the required improvement after both reference models scored each choice. It also missed the 95% mistake-label target, the 90% repeat-acceptability target, repeat-acceptability noninferiority, and label preservation. Within-one-point quality, own-reference regret, false-accusation safety, phase robustness, exact-endgame agreement, sample use, and runtime cost all passed their limits.

The high-budget current and exhaustive references agreed on 98% of positions. Differences concentrated in opening and middle play, where the candidate changed 6.0% and 7.3% of choices but slightly increased cross-reference regret. Late and likely-block changes were rare and slightly favorable. Exhaustive forecasting cost 12.4% more mean wall time, comfortably inside the 75% ceiling, so speed was not the reason for rejection.

This result explains the earlier self-play gain without contradicting it: exhaustive forecasting is a stronger standalone move policy, but replacing simulated rollout choices barely changes the analyzer's root recommendations and does not improve their reference-robust quality. The live analyzer remains on the current shortlist-plus-forecast rollout. The complete evidence is stored in `benchmarks/analyzer-rollout-v1-200.json` and `benchmarks/analyzer-rollout-v1-200.md`.

### Public-information stratified sampling protocol

The next development study targets root sampling variance. It does not change beliefs, rollout policy, adaptive stopping, recommendation selection, Rosa, Tino, or the live coach. The candidate partitions each independently generated belief pool using only public state and the plausible hidden deal represented by each particle:

- whether Rosa can play the left end, right end, both, or neither;
- whether Tino can play the left end, right end, both, or neither;
- whether either opponent has an immediate one-tile exit;
- whether each open-end double is sampled with Rosa, Tino, the user, already played, or sleeping.

Every retained stratum keeps its posterior probability through explicit analysis weights. Small strata receive representation without being treated as more probable than the belief model says. If there are more strata than samples, the lowest-mass tail is sampled as one combined overflow stratum. The real opponent hands and real sleepers are replaced before belief generation and are never available to either analyzer.

The fresh seed `mesa-quince-stratified-sampling-v1` supplies 48 difficult positions: 24 openings with at least six legal moves and 24 middle-game positions with at least four. Current systematic sampling and public-information stratification receive the same independently generated belief pool at every adaptive stage. Each position receives three repetitions at 120, 250, 500, 1,000, and 2,000 cumulative samples, plus an independent 5,000-sample systematic reference.

A separate 500-sample root-value audit records, for the reference-leading move and runner-up, the posterior mass, conditional win rates, and contribution of every represented public-information stratum. It also compares how much posterior mass the current and candidate representatives cover. This audit explains where root values come from but does not change the promotion metrics.

All checks below are locked before opening the full corpus. The candidate passes only if every check succeeds:

- At least 5% of recommendations change, proving the candidate was exercised.
- Repeat acceptability improves.
- Mean reference regret declines.
- False-positive mistake calls do not increase.
- Mistake-label agreement declines by no more than one percentage point.
- Mean sample use does not increase.
- In both opening and middle play, within-one-point quality declines by no more than two percentage points, regret rises by no more than 0.03 point, and repeat acceptability declines by no more than three percentage points.

Passing this 48-position diagnostic authorizes a fresh, balanced 200-position validation. It does not directly change the live analyzer. Failing any check retires this stratification design or sends it back to a new preregistered development version.

```sh
caffeinate -i npm run benchmark:stratified-sampling
```

The run uses nine workers and atomic per-position checkpoints at `outputs/stratified-sampling-v1-48.checkpoint`. Add `-- --resume` after an interruption.

### Public-information stratified sampling result

The complete 48-position study evaluated 144 adaptive trials per sampler. The candidate failed one of eight locked checks, so it is not promoted and the live analyzer remains unchanged.

| Measure | Current systematic | Public stratified |
| --- | ---: | ---: |
| Within one reference point | 91.0% | 93.1% |
| Mean reference regret | 0.173 | 0.135 |
| Repeat acceptability | 83.3% | 87.5% |
| Mistake-label agreement | 88.9% | 91.0% |
| False-positive mistakes | 5.6% | 3.5% |
| Mean samples | 1,972.2 | 1,979.2 |

The candidate changed 5.6% of recommendations, improved repeat acceptability by 4.2 percentage points, and reduced mean regret by 0.039 point. The strongest signal was in wide middle-game decisions: within-one-point quality improved by 4.2 points, repeat acceptability improved by 8.3 points, and mean regret declined by 0.089 point. Opening quality was effectively unchanged, with equal within-one-point and repeat rates and a 0.012-point increase in regret. All quality, label, safety, exercise, and phase-preservation checks passed.

The sole failure was the locked requirement that mean sample use not increase. Current sampling stopped at 1,000 samples in four of 144 trials; stratified sampling stopped there in three. That one net extra 1,000-sample continuation increased the mean by 6.94 samples, or 0.35%. The paired interval was [-13.89, 27.78], so the result does not establish a systematic computation increase, but the preregistered zero-tolerance check still fails and cannot be relaxed after seeing the result.

The forensic audit found an average of 23.4 plausible public-information strata per belief pool. Current representatives covered 99.8% of posterior mass and stratified representatives covered 100.0%, while the weighted 500-sample candidate retained 497.4 effective samples. The evidence supports a separately preregistered fixed-budget middle-game experiment, where both policies are forced to use identical 120- and 500-sample budgets and sample-use differences cannot be created by adaptive stopping. It does not authorize a 200-position promotion study yet. Complete evidence is stored in `benchmarks/stratified-sampling-v1-48.json` and `benchmarks/stratified-sampling-v1-48.md`.

### Fixed-budget middle-game stratification protocol

The follow-up study isolates the promising middle-game signal at the product's actual fixed budgets. The fresh seed `mesa-quince-fixed-stratified-middle-v1` supplies 60 unseen middle-game positions with at least four legal moves. Each position receives five independent repetitions at exactly 120 samples for the live-coach budget and exactly 500 samples for the Deep Review budget. Both samplers receive the same independently generated belief pool within every paired repetition. Evaluation order alternates by position, repetition, and budget.

Each position also receives an independent 5,000-sample systematic reference. Results measure exact and acceptable top agreement, selection within one reference point, reference regret, repeat acceptability across all five repetitions, exact-top stability, mistake-label agreement, false-positive accusations, weighted effective sample count, and paired runtime. Confidence intervals resample complete positions. The benchmark replaces real opponent hands before generating any belief particles.

The 120- and 500-sample budgets must each independently pass every locked check:

- At least 5% of recommendations change, proving stratification affects the fixed-budget decision.
- Repeat acceptability improves.
- Mean reference regret declines.
- Within-one-point quality declines by no more than one percentage point.
- False-positive mistake calls do not increase.
- Mistake-label agreement declines by no more than one percentage point.
- Mean weighted effective samples remain at least 95% of the nominal budget.
- Mean paired runtime increases by no more than 20%.
- Every control and candidate trial uses exactly the requested nominal sample count.

Both budgets must pass. Passing selects middle-only stratification for a fresh, balanced 200-position validation; it does not directly modify the live coach. Failing either budget keeps the current sampler and requires a separately preregistered revision.

```sh
caffeinate -i npm run benchmark:fixed-stratified
```

The run uses nine workers and atomic checkpoints at `outputs/fixed-stratified-middle-v1-60.checkpoint`. Add `-- --resume` after interruption.

### Fixed-budget middle-game stratification result

The complete study evaluated 60 fresh positions, 300 trials per fixed budget, and 600 paired sampler comparisons. The 120-sample candidate failed six substantive checks. The 500-sample candidate passed every check, but the locked protocol required both budgets to pass. The overall candidate therefore fails and the live coach remains unchanged.

| Measure | 120 current | 120 stratified | 500 current | 500 stratified |
| --- | ---: | ---: | ---: | ---: |
| Within one reference point | 75.7% | 72.3% | 87.3% | 88.7% |
| Mean reference regret | 0.847 | 1.070 | 0.384 | 0.363 |
| Repeat acceptability | 38.3% | 33.3% | 61.7% | 65.0% |
| Exact-top repeatability | 28.3% | 21.7% | 41.7% | 48.3% |
| Mistake-label agreement | 85.3% | 84.7% | 91.3% | 90.3% |
| False-positive mistakes | 2.0% | 2.3% | 2.7% | 2.3% |
| Effective samples | 120.0 | 112.2 | 500.0 | 496.5 |

At 120 samples, stratification changed 44.3% of recommendations but moved them in the wrong direction. Mean regret rose by 0.224 point, within-one-point quality fell by 3.3 percentage points, repeat acceptability fell by 5 points, false positives rose slightly, and weighted effective samples fell below the locked 95% requirement. Its mean paired runtime ratio was also 44.5% higher, although the interval was wide under multicore contention. This rejects stratification for the latency-sensitive live coach.

At 500 samples, stratification changed 20.7% of recommendations and passed all nine checks. Mean regret declined by 0.021 point, within-one-point quality improved by 1.3 percentage points, repeat acceptability improved by 3.3 points, exact-top repeatability improved by 6.6 points, and false positives fell by 0.3 point. Label agreement declined by exactly the permitted one percentage point, effective samples remained at 99.3% of nominal, and the paired runtime ratio rose by 6.1%. The confidence intervals on the quality changes include zero, so this is a promising development signal rather than conclusive superiority.

The original gate implementation represented the inclusive negative one-point label boundary as a binary floating-point value microscopically below -0.01. The comparison was corrected with a numerical tolerance and a boundary regression test, without changing the locked threshold or any simulation result. This correction changes the 500-sample gate from fail to pass but cannot rescue the overall result because the 120-sample gate fails decisively.

The next justified experiment is a separately preregistered Deep Review-only validation at 500 samples. The 120-sample live coach should retain systematic sampling. A Deep Review candidate must pass a larger fresh holdout before product integration. Complete evidence is stored in `benchmarks/fixed-stratified-middle-v1-60.json` and `benchmarks/fixed-stratified-middle-v1-60.md`.

### Deep Review-only middle stratification holdout protocol

The promotion holdout applies public-information stratification only to middle-game Deep Review. The live 120-sample coach and every opening, late, and likely-block decision retain current systematic sampling. The fresh seed `mesa-quince-deep-review-stratified-v1` supplies 100 difficult middle positions with at least four legal moves, plus 20 safety positions in each other phase, for 160 total positions.

Every middle position receives five paired repetitions at exactly 500 samples. Current and candidate analyzers receive the same independently generated belief pool within a repetition, and evaluation order alternates. Recommendations are scored under two separately seeded 5,000-sample references, one using systematic representatives and one using public-information stratification. This prevents either representative policy from defining the sole target. Confidence intervals resample complete positions.

The principal quality measures are average regret across both references, worst-reference regret, selection within one point under both references, repeat acceptability across all five repetitions, mistake-label agreement averaged across both references, and a conservative false-positive measure that counts an accusation as false when either reference rejects it. The study also measures effective samples and paired runtime. Non-middle safety positions must route to the current sampler and reuse the exact control analysis.

The candidate passes only if every locked check succeeds:

- At least 5% of middle recommendations change.
- Repeat acceptability improves.
- Mean two-reference regret declines and its paired upper 95% bound is no worse than +0.10 point.
- Worst-reference mean regret rises by no more than 0.05 point.
- Within-one-point-under-both quality declines by no more than one percentage point.
- Conservative false-positive accusations do not increase.
- Mean two-reference mistake-label agreement declines by no more than one percentage point.
- Weighted effective samples remain at least 95% of 500.
- Mean paired runtime increases by no more than 20%.
- Every middle trial uses exactly 500 samples.
- Opening, late, and likely-block routing has zero differences from control.

Passing authorizes product integration of stratification only for 500-sample middle-game Deep Review, followed by the complete test suite and build. Failing keeps all current sampler behavior.

```sh
caffeinate -i npm run benchmark:deep-review-stratified
```

The run uses nine workers and atomic checkpoints at `outputs/deep-review-stratified-v1-160.checkpoint`. Add `-- --resume` after interruption.

### Deep Review-only middle stratification holdout result

The complete holdout evaluated 100 fresh middle positions with five repetitions each, plus 60 non-middle safety positions. The candidate passed 11 of 12 locked checks but failed the requirement that repeat acceptability improve. It is not promoted and all product sampler behavior remains unchanged.

| Measure | Current systematic | Middle stratified |
| --- | ---: | ---: |
| Within one point under both references | 79.0% | 80.8% |
| Mean two-reference regret | 0.463 | 0.427 |
| Mean worst-reference regret | 0.609 | 0.547 |
| Repeat acceptability | 47.0% | 47.0% |
| Exact-top repeatability | 44.0% | 43.0% |
| Mean two-reference label agreement | 88.5% | 89.5% |
| Conservative false-positive mistakes | 5.0% | 3.6% |
| Effective samples | 500.0 | 495.9 |
| Mean runtime | 4,021 ms | 4,019 ms |

Stratification changed 20.8% of middle recommendations. Its point estimates improved within-both-reference quality by 1.8 percentage points, reduced average regret by 0.036 point, reduced worst-reference regret by 0.061 point, improved label agreement by one point, and reduced conservative false accusations by 1.4 points. Mean paired runtime was 0.3% lower and all 60 non-middle positions reused control exactly. Both independent 5,000-sample references chose the same top move on 87% of positions.

Those improvements did not make recommendations more consistently acceptable across five independent runs. Both policies achieved 47% repeat acceptability, while exact-top repeatability moved from 44% to 43%. The paired repeat interval was [-9, 9] percentage points. Because strict improvement was locked before opening the corpus, an exact tie fails even though every other quality, safety, computation, and routing check passed. Relaxing the gate after seeing the result would invalidate the holdout.

This concludes the current stratified-sampling line without a product change. The evidence suggests a modest average middle-game benefit but not the stability improvement required for coaching. Further work should target the underlying belief model or recommendation stability rather than rerun the same sampler against a weaker post hoc gate. Complete evidence is stored in `benchmarks/deep-review-stratified-v1-160.json` and `benchmarks/deep-review-stratified-v1-160.md`.

## Uncertainty-aware coaching protocol

The next candidate leaves hidden-deal generation, simulation, move ranking, Rosa, and Tino unchanged. It changes how the coach communicates a statistically unresolved ranking. Every move whose paired comparison against the estimated leader either loses by no more than one point or has a 95% lower bound no greater than one point enters a strong-option set. Choosing any member is acceptable.

A played move outside that set is called a mistake only when all of these conditions hold: at least four estimated win-rate points lost, a paired 95% lower bound above 1.5 points, the stronger option leads in at least three of four interleaved evidence groups, and at least two groups clear the 1.5-point practical margin. Otherwise the coach abstains with `Too close to call`. These thresholds are fixed from the earlier coaching-label development work rather than tuned on this validation corpus.

The fresh seed `mesa-quince-uncertainty-coach-v1` supplies 200 positions, balanced across opening, middle, late, and likely-block play. Each position receives five independent runs at exactly 120 samples and five at exactly 500 samples. All runs are evaluated against an independently seeded 5,000-sample reference using the same uncertainty-aware policy. Opponent hands and sleeping tiles are replaced by placeholders before belief generation. Nine workers may evaluate different positions concurrently, but each position and repetition remains deterministic.

The validation measures reference-top coverage, overlap with the reference strong-option set, improvement over the current forced single recommendation, repeat-set Jaccard similarity, whether all five repetitions retain a shared strong option, false accusations, three-way label agreement, mean set size, the rate at which every legal move is accepted, and runtime. Confidence intervals use 2,000 position-level bootstrap resamples.

Both the 120- and 500-sample budgets must pass every locked check:

- Reference-top coverage lower bound at least 90%.
- Reference-set-overlap lower bound at least 95% and point estimate no worse than forced single-top coverage.
- Shared-option repeatability lower bound at least 85% and pairwise set-similarity lower bound at least 70%.
- False-accusation upper bound no more than 2% and point estimate no worse than the current label.
- Mean strong-set-size upper bound no more than 2.5 and all-legal-set upper bound no more than 15%.
- Multi-option-set lower bound at least 5%, proving the candidate was exercised.

Passing both budgets authorizes the uncertainty-aware report, Mistake Lab acceptance, progress labels, and information-safe export fields. Failure at one budget limits any promotion to the budget that passes, followed by the complete automated test suite and production build.

### Uncertainty-aware coaching result

The full validation completed all 200 positions and 2,000 fixed-budget trials. The candidate passed every coverage, repeatability, false-accusation, and exercise check at both budgets. At 120 samples, its set covered the independent reference leader in 99.0% of trials, retained a shared option across five repetitions on 99.5% of positions, and reduced false accusations from 1.5% to 0.6%. At 500 samples, those figures were 99.9%, 100%, and 1.0% versus the current 2.4% false-accusation rate.

The candidate nevertheless failed the locked breadth checks. At 120 samples, the mean set-size upper interval was 2.63 rather than at most 2.5, and 62.6% of trials accepted every legal move. At 500 samples, mean set size passed at 2.03, but 45.3% of trials still accepted every legal move. The broad-set rate was not limited to ordinary two-choice positions: among positions with at least three legal moves, it was 48.1% at 120 samples and 29.4% at 500 samples.

Because the breadth gate was locked before opening the corpus, neither budget is promoted. The live report, Deep Review, Mistake Lab, progress labels, and exports retain their existing single-recommendation behavior. The candidate remains available only to the benchmark harness. Any follow-up must define a narrower set rule on a development corpus and pass a separately seeded holdout. Complete evidence is stored in `benchmarks/uncertainty-coach-v1-200.json` and `benchmarks/uncertainty-coach-v1-200.md`.

## Coach V2 development protocol

Coach V2 separates three claims that the first uncertainty-aware candidate mixed together:

- one primary recommendation, which remains the analyzer's existing top-ranked move;
- at most one optional runner-up, shown only when paired evidence says it is both close and stable;
- an independent played-move assessment of acceptable, uncertain, or mistake.

The development replay uses the same 200 positions, five repetitions, fixed 120- and 500-sample budgets, independent 5,000-sample references, and seed as the completed uncertainty-aware study. This corpus is development data from this point forward and cannot authorize a product change. The replay records only the evidence required to evaluate a runner-up: its paired estimated gap, paired 95% interval, four interleaved batch gaps, and the share of those batches in which it remains among the two strongest moves. It does not change move simulation, ranking, opponent behavior, or hidden-information access.

The development grid is fixed before collecting the replay. It crosses maximum paired gaps of 0.5, 1, 1.5, 2, and 3 points; maximum paired lower bounds of 0, 0.5, and 1 point; minimum top-two batch agreement of 50%, 75%, and 100%; maximum near-batch gaps of 2, 4, and 6 points; and minimum near-batch agreement of 50%, 75%, and 100%.

A selectable policy must satisfy every condition at both budgets:

- show a runner-up on at least 5% and no more than 35% of trials;
- place at least 85% of shown runner-ups within one estimated win-rate point of the independent 5,000-sample leader;
- achieve at least 70% pairwise recommendation-set similarity and at least 70% agreement when two repetitions both show a runner-up;
- never recommend every legal move when at least three moves are available;
- never reduce coverage of the independent reference leader relative to the primary recommendation alone.

Eligible policies are ranked by the prespecified utility of correct runner-up rate minus three times incorrect runner-up rate, plus reference-leader coverage gain and a small repeat-agreement term. If no policy is eligible, this Coach V2 design is rejected. If one is selected, its exact thresholds and a separately seeded 200-position holdout protocol must be committed before the holdout begins. Only that fresh holdout can authorize a live coaching change.

```sh
caffeinate -i npm run benchmark:coach-v2:develop:collect
npm run benchmark:coach-v2:develop:evaluate
```

### Coach V2 development result

The complete development replay evaluated 200 positions and 2,000 fixed-budget trials. No optional-runner-up policy passed the locked selection criteria. The strongest precision-first policy showed a runner-up on only 2.0% of 120-sample trials and 3.2% of 500-sample trials, below the required 5% exercise rate. Its shown runner-ups were accurate, with 100% and 93.8% point-estimate precision respectively, but the reference-leader coverage gains were only 0.5 and 0.9 percentage points. Looser rules could show alternatives more often only by sacrificing the required precision or repeatability. Optional runner-ups are therefore rejected rather than carried into a fresh holdout.

The same development evidence supports a narrower Coach V2 that always keeps the existing single primary recommendation and separates two independent judgments:

- Recommendation confidence is clear only when the paired 95% lower advantage over the runner-up exceeds 1.5 points. Otherwise the recommendation is explicitly a close call.
- The played move is good when it is the primary move or its estimated gap is at most 1.5 points. It is a likely mistake only under the conservative four-batch rule validated in the earlier uncertainty study. Every other move is uncertain rather than praised or accused.

At 120 samples, this policy reached 69.7% three-way label agreement, 93.5% good-label precision, a 0.6% false-accusation rate, and 98.7% within-one-point quality among clear recommendations. At 500 samples the corresponding figures were 84.0%, 96.5%, 1.0%, and 99.7%. The policy retains one recommendation by construction and uses no additional simulations. These are development results only.

Complete compact development evidence is stored in `benchmarks/coach-v2-runnerup-development-200.json`, `benchmarks/coach-v2-runnerup-development-200.md`, `benchmarks/coach-v2-development-200.json`, and `benchmarks/coach-v2-development-200.md`.

### Coach V2 single-recommendation holdout protocol

The fresh seed `mesa-quince-coach-v2-holdout-v1` supplies 200 unseen positions, balanced across opening, middle, late, and likely-block play. Each position receives five independent runs at exactly 120 samples and five at exactly 500 samples, plus an independently seeded 5,000-sample reference. Nine workers may evaluate positions concurrently. Opponent hands and sleeping tiles are replaced before belief generation, and the candidate cannot inspect the realized hidden deal.

The candidate changes no move ranking, sampling, rollout, opponent, or search logic. It must return exactly the existing top move as its only recommendation. The holdout evaluates the fixed 1.5-point confidence and good-move thresholds, the already fixed conservative mistake rule, and no other policies. Confidence intervals use 2,000 position-level bootstrap resamples.

Both budgets must pass every locked check:

- The primary move is unchanged on 100% of trials, and exactly one recommendation is returned on 100% of trials.
- The false-accusation upper 95% bound is at most 2%, and its point estimate is no worse than the current coach.
- The false-reassurance upper 95% bound is at most 3%.
- The good-label precision lower 95% bound is at least 85%, and mistake-label precision is at least 80% by point estimate.
- The three-way label-agreement lower 95% bound is at least 60%.
- The decided-label coverage lower 95% bound is at least 55%, while the uncertainty-rate lower bound is at least 10%.
- The clear-confidence rate lower bound is at least 10%.
- Among clear recommendations, the within-one-reference-point lower bound is at least 90% and the point estimate is no worse than for close-call recommendations.
- Confidence agreement with the 5,000-sample reference has a lower bound of at least 50%.

Passing both budgets authorizes integrating only these Coach V2 communication semantics into live feedback, the round report, Deep Review, Mistake Lab, progress labels, and safe exports. It does not authorize optional runner-ups or any analyzer-policy change. A failure keeps the current product behavior.

```sh
caffeinate -i npm run benchmark:coach-v2:holdout:collect
npm run benchmark:coach-v2:holdout:evaluate
```

### Coach V2 single-recommendation holdout result

The complete fresh holdout evaluated 200 positions and 2,000 fixed-budget trials. Coach V2 failed two locked safety checks at both budgets and is not promoted. The live coach, round report, Deep Review, Mistake Lab, progress labels, and exports remain unchanged.

| Measure | 120 samples | 500 samples |
| --- | ---: | ---: |
| Primary recommendation unchanged | 100.0% | 100.0% |
| Exactly one recommendation | 100.0% | 100.0% |
| Three-way label agreement | 70.9% | 84.4% |
| Decided-label coverage | 69.2% | 83.9% |
| Good-label precision | 93.6% | 95.0% |
| False reassurance | 1.0% | 0.5% |
| False accusations | 1.4% | 2.0% |
| Current-coach false accusations | 2.2% | 2.5% |
| Mistake-label precision | 72.0% | 79.4% |
| Clear-confidence rate | 14.5% | 30.8% |
| Clear recommendations within one reference point | 99.3% | 100.0% |
| Close-call recommendations within one reference point | 80.9% | 87.9% |
| Confidence agreement | 59.3% | 73.6% |

The candidate reduced the point estimate of false accusations relative to the current coach at both budgets, but the upper 95% bounds were 2.2% at 120 samples and 3.3% at 500, above the locked 2% ceiling. Mistake-label precision was also below the locked 80% minimum at both budgets. Those failures cannot be excused by the otherwise strong replication of good-label precision, false-reassurance safety, decided coverage, and confidence calibration.

The confidence signal is independently promising: clear recommendations were within one reference point on 99.3% and 100% of trials, substantially above the corresponding close-call groups. However, the locked protocol authorized only the combined communication policy and explicitly required every check to pass. Promoting confidence alone after inspecting this holdout would be post hoc. It requires a separately committed confidence-only protocol and another fresh seed.

Complete evidence is stored in `benchmarks/coach-v2-holdout-200.json` and `benchmarks/coach-v2-holdout-200.md`.

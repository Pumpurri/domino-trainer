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

On the current development machine, a ten-choice opening with 120 samples per move fell from 7,537 ms on one worker to 2,616 ms across four workers, a 2.88x wall-time speedup. The selected move and every merged base win rate were identical. Hardware and browser overhead will change the absolute time.

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

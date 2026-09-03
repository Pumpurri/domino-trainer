# Mesa Quince benchmark

The benchmark compares three policies:

- `random` chooses an arbitrary legal move and provides a low-skill baseline.
- `casual` uses the engine's phase-aware move policy.
- `strong` samples hidden hands and uses information-set Monte Carlo tree search to compare legal moves.

## Phase-aware policy

The policy identifies four strategic situations and changes its priorities accordingly:

- Opening play develops connected numbers, preserves ways back into the chain, and safely unloads difficult doubles.
- Middle play controls the ends, uses pass information, and pressures opponents with short hands.
- Late play protects an exit route, blocks immediate threats, and reduces the pips left at risk.
- Likely blocks compare the player's remaining pip position with estimated opponent totals and favor moves that improve the expected blocked result.

Only a pass creates a certain void. Other tile choices influence hidden-hand probabilities but do not prove that a player lacks a number.

## Information Set Monte Carlo Tree Search

Each search iteration draws one plausible hidden deal from the current weighted belief particles. All iterations contribute to one shared tree of information sets, so evidence from different possible deals accumulates on the same public decisions.

An information-set key contains the acting player's own hand plus public information: the chain ends, played tiles, hand sizes, turn, passes, and proven voids. It never contains either opponent's hidden tile identities. This restriction applies to tree selection and to the phase-aware policy used after a new branch is expanded.

The tree can extend to twelve turns. UCT selection concentrates visits on moves that have performed well while continuing to test less-visited alternatives. Every root move receives a minimum sample, then promising moves receive more visits. When the two leaders remain inside their combined uncertainty range, the search adds up to 50% more iterations and restricts that extra budget to the leading pair.

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

The coach keeps 900 persistent belief particles, then deterministically selects 120 weighted representatives for tree iterations. This preserves a broad belief pool while keeping an interactive decision responsive.

The main controls are:

- `--deals=N`: number of independent matched deals. Each deal creates 18 rounds.
- `--samples=N`: hidden-hand samples used by Strong on every decision.
- `--scenario-samples=N`: samples used for the designed strategic positions.
- `--confidence-resamples=N`: matched-deal bootstrap resamples.
- `--workers=N`: CPU worker threads. The default uses up to eight logical cores while leaving one free.
- `--seed=TEXT`: deterministic deal seed.
- `--json=PATH`: optional JSON report destination.

Equivalent environment variables begin with `MESA_BENCH_`; see `scripts/benchmark-engine.mjs` for their exact names.

## Reported metrics

- Round win rate with a matched-deal 95% bootstrap interval.
- Average pips remaining at the end of a round with a 95% interval.
- Blocked-round win rate.
- Performance when starting and not starting.
- A complete strategy-seat by starting-seat matrix.
- Results on explicit strategic regression positions.

The designed positions are transparent regression cases for agreed principles. They are not a substitute for a future expert-labeled dataset.

## Current standard reference

The current information-set search was evaluated on 120 matched deals, producing 2,160 balanced rounds with 80 search samples per Strong decision.

| Strategy | Round win rate | Average end pips | Blocked win rate |
| --- | ---: | ---: | ---: |
| Random | 19.0% [17.5, 20.6] | 22.89 [22.06, 23.71] | 17.5% [15.4, 19.5] |
| Casual | 36.9% [35.0, 38.7] | 17.28 [16.52, 18.06] | 35.8% [33.6, 37.9] |
| Strong | 41.3% [39.5, 43.1] | 16.79 [16.09, 17.49] | 42.6% [40.5, 44.8] |

Strong selected the expected move in all six designed strategic positions. These figures are a regression reference for this implementation, not a claim of optimal domino play.

## High-budget 500-sample check

The same 120 matched deals and 2,160 balanced rounds were rerun with 500 search samples per Strong decision. Increasing the ISMCTS budget did not improve the policy.

| ISMCTS budget | Round win rate | Average end pips | Blocked win rate | Strategic positions |
| --- | ---: | ---: | ---: | ---: |
| 80 samples | 41.3% [39.5, 43.1] | 16.79 [16.09, 17.49] | 42.6% [40.5, 44.8] | 6/6 |
| 500 samples | 41.2% [39.1, 43.2] | 16.85 [16.02, 17.71] | 41.9% [39.7, 44.2] | 6/6 |

The previous three-turn search scored 45.1% [43.3, 47.0] with 15.71 average end pips and a 45.9% blocked win rate at the same 500-sample budget. The current ISMCTS is therefore 3.9 percentage points worse in round win rate at equal budget. More iterations alone are not the next optimization target. The tree policy, utility signal, and information-set aggregation need investigation.

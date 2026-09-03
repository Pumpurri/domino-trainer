# Mesa Quince benchmark

The benchmark compares three policies:

- `random` chooses an arbitrary legal move and provides a low-skill baseline.
- `casual` uses the engine's phase-aware move policy.
- `strong` samples hidden hands and simulates the remaining round with a public-information three-turn policy at every future decision.

## Phase-aware policy

The policy identifies four strategic situations and changes its priorities accordingly:

- Opening play develops connected numbers, preserves ways back into the chain, and safely unloads difficult doubles.
- Middle play controls the ends, uses pass information, and pressures opponents with short hands.
- Late play protects an exit route, blocks immediate threats, and reduces the pips left at risk.
- Likely blocks compare the player's remaining pip position with estimated opponent totals and favor moves that improve the expected blocked result.

Only a pass creates a certain void. Other tile choices influence hidden-hand probabilities but do not prove that a player lacks a number.

## Information-safe three-turn search

For every choice with multiple legal moves, the acting player looks through the candidate move and likely replies from the next two seats. The leaf evaluation checks whether that player is likely to have a legal route back onto the board when the turn returns.

Each simulated player receives only its own sampled hand plus public information: the chain, played tiles, hand sizes, and proven voids from passes. Likely replies are estimated from the public unseen pool. The rollout policy never receives either opponent's sampled tile identities, including in the late game.

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

The coach keeps 900 persistent belief particles, then deterministically selects 120 weighted representatives for full-round rollouts. This preserves a broad belief pool while keeping an interactive decision responsive. The three-turn forecast itself evaluates every legal user move.

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

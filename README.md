# Mesa Quince

Mesa Quince is a laptop-first Cuban domino trainer for three-player double-nine games. It follows the house rules used by this project: ten tiles per player, twenty-five sleeping tiles, mandatory play, low-pip blocked wins, tied blocked rounds score no point, and first to fifteen round wins takes the day.

## What the coach does

- Maintains plausible hidden deals without reading the opponents' real hands.
- Eliminates impossible deals after passes and reweights them after observed choices.
- Evaluates every legal move on paired hidden deals with phase-aware simulated play.
- Uses deeper information-set search as diagnostic evidence on close decisions.
- Learns public playing tendencies for Rosa and Tino over the course of the day.
- Records each user decision and creates an information-safe post-round review.
- Reveals actual hands only after the round and keeps hindsight separate from live advice.

The release selector is benchmark-gated. Deeper tree search cannot control a move until it beats the current policy in balanced matched-deal testing.

## Run locally

```sh
npm install
npm run dev
```

Then open the local URL printed by the development server.

## Verify

```sh
npm test
npm run build
npm run benchmark:quick
npm run benchmark:latency
```

Run the full 2,160-round benchmark with `npm run benchmark`. See [BENCHMARK.md](./BENCHMARK.md) for methodology, confidence intervals, current results, and search experiments.

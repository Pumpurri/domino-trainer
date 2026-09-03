# Mesa Quince

Mesa Quince is a laptop-first Cuban domino trainer for three-player double-nine games. It follows the house rules used by this project: ten tiles per player, twenty-five sleeping tiles, mandatory play, low-pip blocked wins, tied blocked rounds score no point, and first to fifteen round wins takes the day.

## What the coach does

- Maintains plausible hidden deals without reading the opponents' real hands.
- Eliminates impossible deals after passes and reweights them after observed choices.
- Evaluates every legal move on paired hidden deals with phase-aware simulated play.
- Uses deeper information-set search as diagnostic evidence on close decisions.
- Learns public playing tendencies for Rosa and Tino over the course of the day.
- Records each user decision and creates an information-safe post-round review.
- Offers a four-core Deep Review that rechecks meaningful choices on 500 plausible deals, compares live and deep advice, and flags unstable positions.
- Reveals actual hands only after the round and keeps hindsight separate from live advice.
- Replays mistakes against newly generated hidden hands that fit the same public evidence.
- Saves laptop-local progress by phase, recurring leak, and rolling 10, 25, and 50-round windows.
- Includes six targeted drills for passes, one-tile threats, end control, exit routes, blocking, and inference.
- Audits belief probabilities and opponent-style predictions, then lowers their influence when calibration is poor.
- Exports an information-safe JSON training dataset without opponent hands or sleeping tiles.

The live coach is optimized for responsiveness. After a round, Deep Review can spend more computation on each meaningful decision. Its labels replace the live labels in Mistake Lab, local progress, and exported examples only after the deeper run completes. A cancelled or failed run leaves the live report intact.

The release selector is benchmark-gated. Deeper tree search cannot control a move until it beats the current policy in balanced matched-deal testing.

An experimental adaptive analyzer is available to the reliability benchmark. It accumulates paired simulation batches at 120, 250, 500, 1,000, and 2,000 samples, requires recommendation and coaching-label stability across consecutive checks, and reports unresolved decisions cautiously at its hard cap. It is not used by the live coach unless the large reliability gate passes.

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
npm run benchmark:reliability:quick
```

Run the full 2,160-round policy benchmark with `npm run benchmark`. Run the standard 16-position analyzer study with `npm run benchmark:reliability`. See [BENCHMARK.md](./BENCHMARK.md) for methodology, confidence intervals, current results, and search experiments.

The checkpointed 400-position adaptive study uses six worker threads:

```sh
caffeinate -i npm run benchmark:reliability:overnight
```

Resume an interrupted run without recalculating completed positions:

```sh
caffeinate -i npm run benchmark:reliability:overnight -- --resume
```

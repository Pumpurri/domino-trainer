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

An experimental Adaptive Analyzer V2 is available to the reliability benchmark. It measures disagreement between independent simulation batches, delays early stopping according to phase and legal-move count, requires a fresh confirmation batch, and reports statistically indistinguishable moves as one plausible-best set. Recommendation confidence is separate from mistake-label confidence, so unclear coaching labels abstain. It is not used by the live coach unless a new held-out reliability gate passes.

The 400-position V2 holdout failed its coaching-label agreement gate. A separate V3 label-only development protocol now audits false accusations, confident misses, and explicit uncertainty independently. Move selection and the live coach are unchanged. See [BENCHMARK.md](./BENCHMARK.md) for the locked protocol and [the V2 audit](./benchmarks/adaptive-v2-label-audit.md) for the diagnostic breakdown.

The fresh V3 holdout passed every selective coaching-label check and all move-quality checks except the locked repeat-acceptability requirement, which reached 88.8% instead of 90%. V3 therefore remains outside the live coach.

The V4 candidate-only refinement, V5 robust-selection, and V6 phase-aware sampling experiments all failed development and remain outside the live coach. V6 changed 12.7% of middle-game recommendations but increased middle-game regret from 0.094 to 0.124 and reduced repeat acceptability. The next diagnostic targets rollout quality rather than sampling or selection.

The completed paired sampler-ablation found no aggregation defect and no early-stopping effect on difficult positions. It found opposite sampling effects by phase: independent stage samples performed better in high-branching openings, while a persistent shared particle sequence performed better in wide middle-game decisions. No global sampling change or live-coach change was made.

The completed 8,640-round rollout diagnostic found that exhaustive public forecasting was a stronger standalone policy, improving round win rate from 32.73% to 34.40%. Its separately seeded 200-position analyzer promotion study then failed six locked checks. It changed only 3.8% of recommendations, moved cross-reference regret by +0.004 point, reduced repeat acceptability from 86% to 85%, and increased mean runtime by 12.4%. The live analyzer therefore remains on the current shortlist-plus-forecast rollout.

The 48-position public-information stratification study produced a promising middle-game signal but failed its locked sample-use check. A fresh 60-position fixed-budget follow-up then separated the result by product budget. Stratification regressed at the 120-sample live-coach budget, raising regret from 0.847 to 1.070 and lowering repeat acceptability from 38.3% to 33.3%. It passed every locked check at the 500-sample Deep Review budget, where regret fell from 0.384 to 0.363 and repeat acceptability rose from 61.7% to 65.0%. Because the preregistered study required both budgets to pass, no product behavior changed. The next justified experiment is a fresh Deep Review-only validation.

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

Calibrate the coaching-label policy on the separate 80-position development seed with six worker threads:

```sh
caffeinate -i npm run benchmark:reliability:develop
npm run benchmark:reliability:calibrate
```

After the policy is locked, run the new checkpointed 400-position held-out study once:

```sh
caffeinate -i npm run benchmark:reliability:holdout
```

Add `-- --resume` to either long benchmark command after an interruption. The completed V1 400-position study under `benchmarks/` is frozen and is never used for V2 tuning.

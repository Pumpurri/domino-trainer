# Mesa Quince public-information stratified sampling study

Generated: 2026-09-24T05:00:50.949Z

## Locked protocol

- Version: public-stratified-sampling-v1
- Seed: mesa-quince-stratified-sampling-v1
- Corpus: 24 difficult positions per group
- Groups: opening with at least 6 legal moves; middle with at least 4
- Repetitions: 3
- Adaptive stages: 120, 250, 500, 1000, 2000
- Independent reference: 5000 samples
- Root-value forensic audit: 500 samples
- Workers: 9

Both analyzers receive the same independently generated belief pool at every stage. The candidate partitions plausible hidden deals using only sampled hands and public state: each opponent's ability to play left, right, both, or neither; immediate one-tile exit threats; and ownership of open-end doubles among the sampled players or sleepers. Every retained stratum keeps its posterior mass through analysis weights. No real opponent hand or sleeping tile is supplied to either analyzer.

Promotion requires all locked checks to pass: the candidate must change at least 5% of decisions, improve repeat acceptability, lower mean regret, avoid increasing false accusations, preserve label agreement within one point, use no more samples, and avoid a material opening or middle regression. This is a targeted development study, not a release study. A passing candidate still requires a fresh 200-position validation.

## Overall results

| Variant | Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Mean samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current systematic sampler | 91.0% [85.4, 96.5] | 0.173 [0.080, 0.275] | 83.3% [70.8, 91.7] | 88.9% [81.3, 95.2] | 5.6% [1.4, 10.4] | 1972.2 |
| Public-information stratified sampler | 93.1% [86.8, 97.9] | 0.135 [0.057, 0.225] | 87.5% [77.1, 95.8] | 91.0% [84.0, 97.2] | 3.5% [0.7, 7.6] | 1979.2 |

Selection change rate: **5.6% [2.1, 9.7]**

## Paired candidate minus control effects

Positive deltas favor the candidate for within-one-point quality, repeat acceptability, and label agreement. Negative deltas favor the candidate for regret, false positives, and samples.

| Scope | Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Overall | 2.1% [0.0, 4.9] | -0.039 [-0.101, 0.010] | 4.2% [0.0, 10.4] | 2.1% [-0.7, 5.6] | -2.1% [-6.3, 1.4] | 6.944 [-13.889, 27.778] |
| opening-high | 0.0% [0.0, 0.0] | 0.012 [0.000, 0.037] | 0.0% [0.0, 0.0] | 1.4% [0.0, 4.2] | -1.4% [-4.2, 0.0] | 0.000 [0.000, 0.000] |
| middle-wide | 4.2% [0.0, 8.3] | -0.089 [-0.203, 0.000] | 8.3% [0.0, 20.8] | 2.8% [-2.8, 11.1] | -2.8% [-9.7, 2.8] | 13.889 [-27.778, 55.556] |

## Locked gate

Overall result: **FAIL**

| Check | Result |
| --- | --- |
| exercised | PASS |
| repeatAcceptabilityImproves | PASS |
| regretImproves | PASS |
| falsePositivesDoNotIncrease | PASS |
| labelAgreementPreserved | PASS |
| samplesDoNotIncrease | FAIL |
| openingPreserved | PASS |
| middlePreserved | PASS |

## Forensic coverage

- Mean plausible strata in the belief pool: 23.4
- Mean posterior mass represented by current sampling: 99.8%
- Mean posterior mass represented by stratified sampling: 100.0%
- Mean weighted effective samples in the 500-sample audit: 497.4

The final columns below identify the sampled public-information stratum contributing the largest absolute share of the reference leader's estimated advantage over its runner-up. A signature records each opponent's left/right playability mask and exit threat, followed by sampled ownership of the open-end doubles.

| Position | Reference comparison | Pool strata | Current mass coverage | Stratified mass coverage | Largest contributor | Contribution points |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| middle-wide-01 | 5-7:right vs 4-5:right | 32 | 99.9% | 100.0% | p1:2:0|p2:3:0|1-1:self|5-5:sleep | 1.27 |
| middle-wide-02 | 7-7:right vs 0-9:left | 16 | 100.0% | 100.0% | p1:1:0|p2:1:0|0-0:played|7-7:self | -1.96 |
| middle-wide-03 | 1-6:left vs 1-6:right | 31 | 99.9% | 100.0% | p1:3:0|p2:1:0|6-6:p2|1-1:played | 1.87 |
| middle-wide-04 | 8-8:left vs 7-8:left | 8 | 100.0% | 100.0% | p1:0:0|p2:3:0|8-8:self|4-4:played | 1.19 |
| middle-wide-05 | 4-7:right vs 4-7:left | 62 | 99.5% | 100.0% | p1:2:0|p2:3:0|7-7:sleep|4-4:sleep | 1.78 |
| middle-wide-06 | 4-4:right vs 5-7:left | 32 | 100.0% | 100.0% | p1:2:0|p2:2:0|5-5:sleep|4-4:self | 1.65 |
| middle-wide-07 | 3-4:left vs 0-4:left | 24 | 99.4% | 100.0% | p1:1:0|p2:3:0|4-4:sleep|3-3:sleep | 1.24 |
| middle-wide-08 | 3-9:left vs 7-8:right | 64 | 98.3% | 100.0% | p1:0:0|p2:1:0|3-3:sleep|8-8:sleep | 0.90 |
| middle-wide-09 | 8-9:right vs 8-9:left | 16 | 100.0% | 100.0% | p1:3:0|p2:3:0|8-8:played|9-9:played | 2.25 |
| middle-wide-10 | 3-8:right vs 0-8:right | 30 | 99.6% | 100.0% | p1:3:0|p2:3:0|0-0:self|8-8:p2 | 0.83 |
| middle-wide-11 | 3-7:right vs 0-1:left | 64 | 99.8% | 100.0% | p1:1:0|p2:1:0|1-1:sleep|3-3:sleep | -1.09 |
| middle-wide-12 | 0-8:right vs 1-8:left | 64 | 99.4% | 100.0% | p1:1:0|p2:2:0|8-8:sleep|0-0:sleep | 1.09 |
| middle-wide-13 | 3-7:right vs 4-7:right | 63 | 99.7% | 100.0% | p1:2:0|p2:3:0|3-3:sleep|7-7:p1 | 1.50 |
| middle-wide-14 | 2-4:right vs 3-4:right | 63 | 100.0% | 100.0% | p1:1:0|p2:3:0|1-1:sleep|4-4:sleep | 1.08 |
| middle-wide-15 | 0-7:right vs 1-7:left | 32 | 100.0% | 100.0% | p1:2:0|p2:1:0|1-1:played|0-0:sleep | 0.84 |
| middle-wide-16 | 2-2:right vs 1-2:left | 32 | 100.0% | 100.0% | p1:3:0|p2:3:0|1-1:sleep|2-2:self | -1.88 |
| middle-wide-17 | 5-6:right vs 7-8:left | 16 | 100.0% | 100.0% | p1:1:0|p2:2:0|7-7:played|6-6:played | -1.23 |
| middle-wide-18 | 5-5:left vs 1-8:right | 32 | 99.4% | 100.0% | p1:3:0|p2:3:0|5-5:self|8-8:p2 | 1.23 |
| middle-wide-19 | 5-5:left vs 5-7:right | 12 | 100.0% | 100.0% | p1:2:0|p2:1:0|5-5:self|7-7:sleep | 1.22 |
| middle-wide-20 | 3-4:left vs 4-9:left | 32 | 100.0% | 100.0% | p1:2:0|p2:3:0|4-4:p2|3-3:played | -1.39 |
| middle-wide-21 | 4-8:right vs 4-8:left | 32 | 100.0% | 100.0% | p1:1:0|p2:0:0|8-8:played|4-4:sleep | -1.60 |
| middle-wide-22 | 4-7:left vs 0-7:left | 32 | 99.9% | 100.0% | p1:3:0|p2:2:0|7-7:played|0-0:sleep | 1.68 |
| middle-wide-23 | 4-5:left vs 1-4:left | 64 | 99.1% | 100.0% | p1:3:0|p2:1:0|4-4:sleep|2-2:sleep | 1.32 |
| middle-wide-24 | 2-9:left vs 0-2:left | 64 | 99.5% | 100.0% | p1:2:0|p2:1:0|2-2:sleep|1-1:sleep | 1.52 |
| opening-high-01 | 1-8:right vs 2-8:right | 1 | 100.0% | 100.0% | empty-board | -4.80 |
| opening-high-02 | 5-5:right vs 8-8:right | 1 | 100.0% | 100.0% | empty-board | 2.20 |
| opening-high-03 | 5-8:left vs 5-6:left | 32 | 99.6% | 100.0% | p1:3:0|p2:3:0|5-5:p1|1-1:self | 1.68 |
| opening-high-04 | 7-7:right vs 7-9:right | 1 | 100.0% | 100.0% | empty-board | 10.60 |
| opening-high-05 | 1-9:right vs 2-9:right | 62 | 99.4% | 100.0% | p1:3:0|p2:3:0|8-8:p2|9-9:sleep | -1.56 |
| opening-high-06 | 5-5:right vs 4-8:right | 1 | 100.0% | 100.0% | empty-board | -2.00 |
| opening-high-07 | 6-7:right vs 7-8:right | 1 | 100.0% | 100.0% | empty-board | 1.80 |
| opening-high-08 | 2-6:right vs 5-9:right | 1 | 100.0% | 100.0% | empty-board | 4.20 |
| opening-high-09 | 9-9:right vs 6-6:right | 1 | 100.0% | 100.0% | empty-board | -1.00 |
| opening-high-10 | 8-8:right vs 6-6:right | 1 | 100.0% | 100.0% | empty-board | -0.20 |
| opening-high-11 | 5-5:right vs 4-7:right | 1 | 100.0% | 100.0% | empty-board | 11.60 |
| opening-high-12 | 2-9:right vs 6-9:right | 1 | 100.0% | 100.0% | empty-board | 0.20 |
| opening-high-13 | 2-3:right vs 3-8:left | 32 | 100.0% | 100.0% | p1:2:0|p2:1:0|3-3:played|2-2:p1 | 1.22 |
| opening-high-14 | 7-7:right vs 7-9:right | 1 | 100.0% | 100.0% | empty-board | 3.00 |
| opening-high-15 | 4-9:right vs 3-4:right | 1 | 100.0% | 100.0% | empty-board | 3.80 |
| opening-high-16 | 9-9:right vs 4-9:right | 1 | 100.0% | 100.0% | empty-board | 9.40 |
| opening-high-17 | 5-7:right vs 1-7:right | 1 | 100.0% | 100.0% | empty-board | -1.60 |
| opening-high-18 | 3-3:right vs 5-6:right | 1 | 100.0% | 100.0% | empty-board | 2.60 |
| opening-high-19 | 0-6:right vs 6-7:right | 1 | 100.0% | 100.0% | empty-board | -2.00 |
| opening-high-20 | 7-7:right vs 2-2:right | 1 | 100.0% | 100.0% | empty-board | 8.20 |
| opening-high-21 | 8-8:right vs 0-8:right | 1 | 100.0% | 100.0% | empty-board | 9.60 |
| opening-high-22 | 1-8:left vs 3-6:right | 62 | 99.7% | 100.0% | p1:3:0|p2:3:0|1-1:sleep|6-6:p1 | 1.07 |
| opening-high-23 | 3-3:right vs 3-5:right | 1 | 100.0% | 100.0% | empty-board | -1.40 |
| opening-high-24 | 6-6:right vs 4-9:right | 1 | 100.0% | 100.0% | empty-board | 3.60 |

## opening-high

| Variant | Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Mean samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current systematic sampler | 90.3% [80.6, 98.6] | 0.164 [0.048, 0.321] | 83.3% [66.7, 95.8] | 87.5% [76.4, 97.2] | 5.6% [0.0, 12.5] | 2000.0 |
| Public-information stratified sampler | 90.3% [80.5, 98.6] | 0.176 [0.052, 0.318] | 83.3% [66.7, 95.8] | 88.9% [76.4, 97.3] | 4.2% [0.0, 11.1] | 2000.0 |

## middle-wide

| Variant | Within 1 point | Mean regret | Repeat acceptable | Label agreement | False positives | Mean samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current systematic sampler | 91.7% [83.3, 98.6] | 0.183 [0.056, 0.336] | 83.3% [66.7, 95.8] | 90.3% [80.6, 98.6] | 5.6% [0.0, 12.5] | 1944.4 |
| Public-information stratified sampler | 95.8% [90.2, 100.0] | 0.093 [0.015, 0.190] | 91.7% [79.2, 100.0] | 93.1% [83.3, 100.0] | 2.8% [0.0, 6.9] | 1958.3 |

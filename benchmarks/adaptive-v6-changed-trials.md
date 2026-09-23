# Adaptive V6 changed-trial forensic report

Generated: 2026-09-23T23:44:24.978Z

## Summary

- Middle-game trials: 150
- Changed trials: 19 across 12 positions
- Improved: 9
- Harmed: 10
- Tied: 0
- Mean reference-regret change on changed trials: +0.237
- Total reference-regret change: +4.500

This report is diagnostic. It uses the opened V6 development corpus to explain the rejected candidate and cannot serve as future release evidence.

## Changed decisions

| Position | Repeat | Legal moves | Control | Candidate | Reference | Control regret | Candidate regret | Change | Outcome |
| --- | ---: | ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| middle-23 | 3 | 4 | 4-9:left | 1-8:right | 4-9:left | 0.00 | 4.92 | +4.92 | harmed |
| middle-24 | 2 | 2 | 3-5:left | 2-5:left | 3-5:left | 0.00 | 3.16 | +3.16 | harmed |
| middle-07 | 1 | 2 | 1-6:left | 2-4:right | 1-6:left | 0.00 | 2.02 | +2.02 | harmed |
| middle-37 | 3 | 5 | 4-7:left | 3-6:right | 4-7:left | 0.00 | 1.90 | +1.90 | harmed |
| middle-44 | 2 | 2 | 3-8:left | 3-4:left | 3-8:left | 0.00 | 1.44 | +1.44 | harmed |
| middle-09 | 2 | 3 | 1-8:left | 3-5:right | 1-8:left | 0.00 | 1.22 | +1.22 | harmed |
| middle-23 | 1 | 4 | 4-9:left | 4-8:left | 4-9:left | 0.00 | 0.72 | +0.72 | harmed |
| middle-29 | 1 | 2 | 2-3:left | 0-6:right | 2-3:left | 0.00 | 0.52 | +0.52 | harmed |
| middle-12 | 1 | 4 | 2-9:left | 2-8:left | 2-9:left | 0.00 | 0.14 | +0.14 | harmed |
| middle-12 | 2 | 4 | 2-9:left | 2-8:left | 2-9:left | 0.00 | 0.14 | +0.14 | harmed |
| middle-30 | 1 | 3 | 7-9:left | 7-8:left | 7-8:left | 0.58 | 0.00 | -0.58 | improved |
| middle-30 | 2 | 3 | 7-9:left | 7-8:left | 7-8:left | 0.58 | 0.00 | -0.58 | improved |
| middle-28 | 1 | 2 | 0-6:right | 1-2:left | 1-2:left | 0.74 | 0.00 | -0.74 | improved |
| middle-28 | 3 | 2 | 0-6:right | 1-2:left | 1-2:left | 0.74 | 0.00 | -0.74 | improved |
| middle-09 | 1 | 3 | 3-5:right | 1-8:left | 1-8:left | 1.22 | 0.00 | -1.22 | improved |
| middle-44 | 1 | 2 | 3-4:left | 3-8:left | 3-8:left | 1.44 | 0.00 | -1.44 | improved |
| middle-46 | 3 | 3 | 2-8:right | 3-5:left | 3-5:left | 1.78 | 0.00 | -1.78 | improved |
| middle-07 | 3 | 2 | 2-4:right | 1-6:left | 1-6:left | 2.02 | 0.00 | -2.02 | improved |
| middle-42 | 3 | 3 | 8-9:right | 7-9:right | 7-9:right | 2.58 | 0.00 | -2.58 | improved |

## Stage leader paths

| Position | Repeat | Independent-stage control | Persistent-pool candidate |
| --- | ---: | --- | --- |
| middle-07 | 1 | 1-6:left → 1-6:left → 1-6:left → 1-6:left → 1-6:left | 1-6:left → 1-6:left → 1-6:left → 1-6:left → 2-4:right |
| middle-07 | 3 | 2-4:right → 1-6:left → 1-6:left → 1-6:left → 2-4:right | 1-6:left → 1-6:left → 1-6:left → 1-6:left → 1-6:left |
| middle-09 | 1 | 1-8:left → 3-5:right → 3-5:right → 1-8:left → 3-5:right | 1-3:left → 1-3:left → 1-8:left → 1-8:left → 1-8:left |
| middle-09 | 2 | 1-8:left → 1-8:left → 1-8:left → 1-8:left → 1-8:left | 3-5:right → 3-5:right → 3-5:right → 3-5:right → 3-5:right |
| middle-12 | 1 | 2-9:left → 2-9:left → 2-8:left → 2-8:left → 2-9:left | 2-9:left → 2-8:left → 2-8:left → 2-8:left → 2-8:left |
| middle-12 | 2 | 2-6:left → 2-8:left → 2-8:left → 2-9:left → 2-9:left | 2-8:left → 2-8:left → 2-8:left → 2-8:left → 2-8:left |
| middle-23 | 1 | 4-8:left → 4-8:left → 4-8:left → 4-8:left → 4-9:left | 4-9:left → 4-9:left → 4-9:left → 4-8:left → 4-8:left |
| middle-23 | 3 | 4-8:left → 4-9:left → 4-8:left → 4-8:left → 4-9:left | 4-8:left → 4-8:left → 4-9:left → 4-9:left → 1-8:right |
| middle-24 | 2 | 3-5:left → 3-5:left → 3-5:left → 3-5:left → 3-5:left | 3-5:left → 2-5:left → 2-5:left → 2-5:left → 2-5:left |
| middle-28 | 1 | 0-6:right → 1-2:left → 0-6:right → 0-6:right → 0-6:right | 1-2:left → 1-2:left → 1-2:left → 1-2:left → 1-2:left |
| middle-28 | 3 | 1-2:left → 1-2:left → 1-2:left → 0-6:right → 0-6:right | 0-6:right → 0-6:right → 0-6:right → 0-6:right → 1-2:left |
| middle-29 | 1 | 0-6:right → 2-3:left → 0-6:right → 2-3:left → 2-3:left | 2-3:left → 2-3:left → 0-6:right → 0-6:right → 0-6:right |
| middle-30 | 1 | 7-8:left → 7-9:left → 7-9:left → 7-9:left → 7-9:left | 7-8:left → 7-8:left → 7-8:left → 7-8:left → 7-8:left |
| middle-30 | 2 | 7-8:left → 7-9:left → 7-8:left → 7-8:left → 7-9:left | 7-8:left → 7-9:left → 7-8:left → 7-8:left → 7-8:left |
| middle-37 | 3 | 0-7:left → 3-6:right → 4-7:left → 4-7:left → 4-7:left | 4-7:left → 4-7:left → 4-7:left → 4-7:left → 3-6:right |
| middle-42 | 3 | 8-9:right → 8-9:right → 8-9:right → 7-9:right → 8-9:right | 7-9:right → 7-9:right → 7-9:right → 7-9:right → 7-9:right |
| middle-44 | 1 | 3-8:left → 3-8:left → 3-4:left → 3-4:left → 3-4:left | 3-8:left → 3-4:left → 3-4:left → 3-8:left → 3-8:left |
| middle-44 | 2 | 3-4:left → 3-8:left → 3-8:left → 3-8:left → 3-8:left | 3-8:left → 3-8:left → 3-4:left → 3-4:left → 3-4:left |
| middle-46 | 3 | 3-5:left → 2-8:right → 2-8:right → 3-5:left → 2-8:right | 3-5:left → 3-5:left → 3-5:left → 3-5:left → 3-5:left |

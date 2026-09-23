# Mesa Quince V3 held-out release evaluation

Source: `outputs/adaptive-v3-holdout-400.json`

Result: **FAIL**. V3 must remain outside the live coach.

## Selective coaching labels

- Resolved reference positions: 377/400
- Reference material mistakes: 52
- Decided coverage: 79.0%
- Material-mistake recall: 75.0%
- Accuracy among decided labels: 99.0%
- False accusations: 0.8%
- Confident misses: 0.0%
- Explicit abstention: 21.0%

## Release checks

| Check | Result |
| --- | --- |
| corpusSize | PASS |
| withinOnePoint | PASS |
| meanRegret | PASS |
| repeatAcceptability | FAIL |
| withinOnePointNoninferior | PASS |
| meanRegretNoninferior | PASS |
| repeatAcceptabilityNoninferior | PASS |
| recommendationSetStability | PASS |
| sampleSavings | PASS |
| labels.resolvedPositions | PASS |
| labels.referenceMistakes | PASS |
| labels.coverage | PASS |
| labels.mistakeRecall | PASS |
| labels.decidedAccuracy | PASS |
| labels.falseAccusation | PASS |
| labels.confidentMiss | PASS |

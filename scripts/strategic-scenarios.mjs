import {
  chooseCasualMove,
  chooseStrongMove,
  fullSet,
  initialGame,
  legalMovesFor,
  seededRandom,
} from '../app/domino-engine.ts';

function tile(a, b) {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return { id: `${low}-${high}`, a: low, b: high };
}

function scenarioGame({ hand, ends, nextVoids = [], otherVoids = [], opponentSizes = [5, 5] }) {
  const userHand = hand.map(([a, b]) => tile(a, b));
  const chainTile = tile(ends[0], ends[1]);
  const excluded = new Set([...userHand, chainTile].map(({ id }) => id));
  const available = fullSet().filter(({ id }) => !excluded.has(id));
  return {
    ...initialGame(),
    phase: 'playing',
    hands: [
      userHand,
      available.slice(0, opponentSizes[0]),
      available.slice(opponentSizes[0], opponentSizes[0] + opponentSizes[1]),
    ],
    chain: [{ ...chainTile, left: ends[0], right: ends[1], player: 2 }],
    current: 0,
    starter: 2,
    voids: [new Set(), new Set(nextVoids), new Set(otherVoids)],
  };
}

export const strategicScenarios = [
  {
    id: 'finish-immediately',
    title: 'Play the final tile immediately',
    principle: 'A legal final tile wins the round and dominates every delayed plan.',
    game: scenarioGame({ hand: [[1, 5]], ends: [1, 9], opponentSizes: [3, 3] }),
    expected: ['1-5:left'],
  },
  {
    id: 'press-proven-void',
    title: 'Exploit a proven pass',
    principle: 'Open numbers the next player has already proven they cannot hold.',
    game: scenarioGame({ hand: [[1, 5], [1, 2], [4, 4], [6, 7]], ends: [1, 9], nextVoids: [5, 9] }),
    expected: ['1-5:left'],
  },
  {
    id: 'choose-correct-side',
    title: 'Play the same tile on the correct side',
    principle: 'The side matters when a tile matches both ends and can close the board onto different numbers.',
    game: scenarioGame({ hand: [[1, 9], [1, 4], [2, 9], [3, 3]], ends: [1, 9], nextVoids: [9] }),
    expected: ['1-9:left'],
  },
  {
    id: 'double-void-pressure',
    title: 'Create two unavailable ends',
    principle: 'Prefer the move that leaves both open values inside the next player’s proven voids.',
    game: scenarioGame({ hand: [[3, 6], [3, 2], [8, 9], [1, 1]], ends: [3, 8], nextVoids: [6, 8] }),
    expected: ['3-6:left'],
  },
  {
    id: 'protect-against-one-tile',
    title: 'Stop an opponent with one tile',
    principle: 'Forcing the next player to pass is urgent when they are one tile from winning.',
    game: scenarioGame({ hand: [[2, 5], [2, 9], [7, 8], [4, 4]], ends: [2, 7], nextVoids: [5, 7], opponentSizes: [1, 4] }),
    expected: ['2-5:left'],
  },
  {
    id: 'retain-return-route',
    title: 'Shed pips without losing the return route',
    principle: 'When two moves retain equal access to the open ends, prefer the move that safely removes more pips.',
    game: scenarioGame({ hand: [[1, 5], [1, 6], [5, 7], [3, 9], [2, 2]], ends: [1, 9] }),
    expected: ['3-9:right'],
  },
];

function moveKey(move) {
  return `${move.tile.id}:${move.side}`;
}

export function evaluateStrategicScenarios({ strongSamples = 400, seed = 'mesa-quince-scenarios-v1' } = {}) {
  const strategies = {
    random: { correct: 0, total: 0, cases: [] },
    casual: { correct: 0, total: 0, cases: [] },
    strong: { correct: 0, total: 0, cases: [] },
  };

  for (const scenario of strategicScenarios) {
    const moves = legalMovesFor(scenario.game.hands[0], scenario.game.chain);
    const random = seededRandom(`${seed}|${scenario.id}`);
    const selections = {
      random: moves[Math.floor(random() * moves.length)],
      casual: chooseCasualMove(scenario.game, moves),
      strong: chooseStrongMove(scenario.game, moves, strongSamples),
    };
    for (const [strategy, move] of Object.entries(selections)) {
      const selected = moveKey(move);
      const correct = scenario.expected.includes(selected);
      strategies[strategy].total += 1;
      if (correct) strategies[strategy].correct += 1;
      strategies[strategy].cases.push({
        id: scenario.id,
        title: scenario.title,
        principle: scenario.principle,
        selected,
        expected: scenario.expected,
        correct,
      });
    }
  }

  return { seed, strongSamples, strategies };
}

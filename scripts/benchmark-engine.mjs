import {
  applyMove,
  applyPass,
  chooseCasualMove,
  chooseStrongMove,
  dealRound,
  initialGame,
  legalMovesFor,
  seededRandom,
} from '../app/domino-engine.ts';

const roundsPerSeat = Number(process.env.MESA_BENCH_ROUNDS ?? 24);
const searchDeals = Number(process.env.MESA_BENCH_DEALS ?? 60);
let strongWins = 0;
let opponentWins = 0;
let ties = 0;

for (let strongSeat = 0; strongSeat < 3; strongSeat += 1) {
  for (let round = 0; round < roundsPerSeat; round += 1) {
    const random = seededRandom(`benchmark-${strongSeat}-${round}`);
    let game = dealRound(initialGame(), (strongSeat + round) % 3, random);
    for (let turn = 0; turn < 120 && game.phase === 'playing'; turn += 1) {
      const moves = legalMovesFor(game.hands[game.current], game.chain);
      if (!moves.length) {
        game = applyPass(game);
        continue;
      }
      const move = game.current === strongSeat
        ? chooseStrongMove(game, moves, searchDeals)
        : chooseCasualMove(game, moves);
      game = applyMove(game, move);
    }
    if (game.result?.winner === strongSeat) strongWins += 1;
    else if (game.result?.winner === null) ties += 1;
    else opponentWins += 1;
  }
}

const rounds = strongWins + opponentWins + ties;
const rate = rounds ? strongWins / rounds * 100 : 0;
console.log(`Strong search: ${strongWins}/${rounds} wins (${rate.toFixed(1)}%)`);
console.log(`Two casual opponents: ${opponentWins}/${rounds} wins combined`);
console.log(`Tied blocked rounds: ${ties}/${rounds}`);
console.log(`Benchmark settings: ${roundsPerSeat} rounds per seat, ${searchDeals} hidden-deal searches per strong decision`);

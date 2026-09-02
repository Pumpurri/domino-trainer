'use client';

import { useEffect, useMemo, useState } from 'react';

type Tile = { id: string; a: number; b: number };
type Side = 'left' | 'right';
type PlacedTile = Tile & { left: number; right: number; player: number };
type Move = {
  tile: Tile;
  side: Side;
  placedLeft: number;
  placedRight: number;
  newLeft: number;
  newRight: number;
};
type Phase = 'pickStarter' | 'starterDrawn' | 'playing' | 'roundEnd' | 'matchEnd';
type RoundResult = {
  winner: number | null;
  reason: 'empty' | 'blocked';
  pips: number[];
  matchWinner: number | null;
};
type DrawResult = { choice: 'high' | 'low'; tiles: Tile[]; starter: number };
type Game = {
  phase: Phase;
  scores: number[];
  round: number;
  hands: Tile[][];
  chain: PlacedTile[];
  current: number;
  starter: number;
  voids: Set<number>[];
  consecutivePasses: number;
  result: RoundResult | null;
  starterDraw: DrawResult | null;
  history: string[];
};
type Coach =
  | { kind: 'intro' }
  | { kind: 'turn'; message?: string }
  | { kind: 'watching'; message: string }
  | { kind: 'hint'; title: string; body: string; confidence: string }
  | { kind: 'feedback'; rating: string; title: string; body: string; stat: string; tone: 'great' | 'okay' | 'mistake' };
type RatedMove = Move & { wins: number; samples: number; winRate: number; heuristic: number };

const names = ['You', 'Rosa', 'Tino'];
const dotMap: Record<number, number[]> = {
  0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  7: [0, 2, 3, 4, 5, 6, 8], 8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

function fullSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 9; a += 1) {
    for (let b = a; b <= 9; b += 1) tiles.push({ id: `${a}-${b}`, a, b });
  }
  return tiles;
}

function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pipTotal(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
}

function initialGame(): Game {
  return {
    phase: 'pickStarter', scores: [0, 0, 0], round: 1, hands: [[], [], []], chain: [],
    current: 0, starter: 0, voids: [new Set(), new Set(), new Set()], consecutivePasses: 0,
    result: null, starterDraw: null, history: [],
  };
}

function drawForStarter(choice: 'high' | 'low'): DrawResult {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const tiles = shuffle(fullSet()).slice(0, 3);
    const totals = tiles.map((tile) => tile.a + tile.b);
    const target = choice === 'high' ? Math.max(...totals) : Math.min(...totals);
    const winners = totals.map((total, index) => total === target ? index : -1).filter((index) => index >= 0);
    if (winners.length === 1) return { choice, tiles, starter: winners[0] };
  }
  return { choice, tiles: fullSet().slice(0, 3), starter: 0 };
}

function dealRound(game: Game, starter: number): Game {
  const deck = shuffle(fullSet());
  const hands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)]
    .map((hand) => [...hand].sort((x, y) => x.a - y.a || x.b - y.b));
  return {
    ...game, phase: 'playing', hands, chain: [], current: starter, starter,
    voids: [new Set(), new Set(), new Set()], consecutivePasses: 0, result: null,
    history: [`${names[starter]} opened round ${game.round}.`],
  };
}

function endsOf(chain: PlacedTile[]): [number | null, number | null] {
  if (!chain.length) return [null, null];
  return [chain[0].left, chain[chain.length - 1].right];
}

function legalMovesFor(hand: Tile[], chain: PlacedTile[]): Move[] {
  const [leftEnd, rightEnd] = endsOf(chain);
  if (leftEnd === null || rightEnd === null) {
    return hand.map((tile) => ({ tile, side: 'right', placedLeft: tile.a, placedRight: tile.b, newLeft: tile.a, newRight: tile.b }));
  }

  const moves: Move[] = [];
  for (const tile of hand) {
    if (tile.a === leftEnd) moves.push({ tile, side: 'left', placedLeft: tile.b, placedRight: tile.a, newLeft: tile.b, newRight: rightEnd });
    else if (tile.b === leftEnd) moves.push({ tile, side: 'left', placedLeft: tile.a, placedRight: tile.b, newLeft: tile.a, newRight: rightEnd });

    if (leftEnd !== rightEnd) {
      if (tile.a === rightEnd) moves.push({ tile, side: 'right', placedLeft: tile.a, placedRight: tile.b, newLeft: leftEnd, newRight: tile.b });
      else if (tile.b === rightEnd) moves.push({ tile, side: 'right', placedLeft: tile.b, placedRight: tile.a, newLeft: leftEnd, newRight: tile.a });
    } else if (!moves.some((move) => move.tile.id === tile.id)) {
      if (tile.a === rightEnd) moves.push({ tile, side: 'right', placedLeft: tile.a, placedRight: tile.b, newLeft: leftEnd, newRight: tile.b });
      else if (tile.b === rightEnd) moves.push({ tile, side: 'right', placedLeft: tile.b, placedRight: tile.a, newLeft: leftEnd, newRight: tile.a });
    }
  }
  return moves;
}

function describeMove(move: Move, chainLength: number): string {
  if (!chainLength) return `${move.tile.a}–${move.tile.b} to open`;
  return `${move.tile.a}–${move.tile.b} on the ${move.side}`;
}

function finishRound(game: Game, winner: number | null, reason: 'empty' | 'blocked'): Game {
  const pips = game.hands.map(pipTotal);
  const scores = [...game.scores];
  if (winner !== null) scores[winner] += 1;
  const matchWinner = scores.findIndex((score) => score >= 15);
  return {
    ...game,
    scores,
    phase: matchWinner >= 0 ? 'matchEnd' : 'roundEnd',
    result: { winner, reason, pips, matchWinner: matchWinner >= 0 ? matchWinner : null },
    history: [...game.history, winner === null ? 'The blocked round ended in a tie. No point.' : `${names[winner]} won the round.`],
  };
}

function applyMove(game: Game, move: Move): Game {
  const player = game.current;
  const hands = game.hands.map((hand, index) => index === player ? hand.filter((tile) => tile.id !== move.tile.id) : hand);
  const placed: PlacedTile = { ...move.tile, left: move.placedLeft, right: move.placedRight, player };
  const chain = game.chain.length === 0 ? [placed] : move.side === 'left' ? [placed, ...game.chain] : [...game.chain, placed];
  const next: Game = {
    ...game, hands, chain, current: (player + 1) % 3, consecutivePasses: 0,
    history: [...game.history, `${names[player]} played ${describeMove(move, game.chain.length)}.`],
  };
  return hands[player].length === 0 ? finishRound(next, player, 'empty') : next;
}

function applyPass(game: Game): Game {
  const player = game.current;
  const [left, right] = endsOf(game.chain);
  const voids = game.voids.map((values) => new Set(values));
  if (left !== null) voids[player].add(left);
  if (right !== null) voids[player].add(right);
  const passed: Game = {
    ...game, voids, current: (player + 1) % 3, consecutivePasses: game.consecutivePasses + 1,
    history: [...game.history, `${names[player]} passed on ${left} and ${right}.`],
  };
  if (passed.consecutivePasses < 3) return passed;
  const pips = passed.hands.map(pipTotal);
  const lowest = Math.min(...pips);
  const possible = pips.map((value, index) => value === lowest ? index : -1).filter((index) => index >= 0);
  return finishRound(passed, possible.length === 1 ? possible[0] : null, 'blocked');
}

function moveHeuristic(move: Move, hand: Tile[], nextVoids: Set<number>): number {
  const remaining = hand.filter((tile) => tile.id !== move.tile.id);
  if (!remaining.length) return 1000;
  const controlsLeft = remaining.filter((tile) => tile.a === move.newLeft || tile.b === move.newLeft).length;
  const controlsRight = remaining.filter((tile) => tile.a === move.newRight || tile.b === move.newRight).length;
  const pressure = (nextVoids.has(move.newLeft) ? 5 : 0) + (nextVoids.has(move.newRight) ? 5 : 0);
  const highPips = (move.tile.a + move.tile.b) * 0.18;
  const doubleRelief = move.tile.a === move.tile.b ? 1.2 : 0;
  const balance = new Set(remaining.flatMap((tile) => [tile.a, tile.b])).size * 0.08;
  return controlsLeft * 1.15 + controlsRight * 1.15 + pressure + highPips + doubleRelief + balance;
}

function seededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619);
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function sampleOpponentHands(game: Game, random: () => number): Tile[][] | null {
  const known = new Set([...game.hands[0], ...game.chain].map((tile) => tile.id));
  const unknown = fullSet().filter((tile) => !known.has(tile.id));
  const opponents = [1, 2].sort((a, b) => game.voids[b].size - game.voids[a].size);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    let pool = shuffle(unknown, random);
    const sampled: Tile[][] = [game.hands[0], [], []];
    let failed = false;
    for (const player of opponents) {
      const allowed = pool.filter((tile) => !game.voids[player].has(tile.a) && !game.voids[player].has(tile.b));
      if (allowed.length < game.hands[player].length) { failed = true; break; }
      sampled[player] = allowed.slice(0, game.hands[player].length);
      const used = new Set(sampled[player].map((tile) => tile.id));
      pool = pool.filter((tile) => !used.has(tile.id));
    }
    if (!failed) return sampled;
  }
  return null;
}

function rolloutWinner(game: Game, firstMove: Move, sampledHands: Tile[][], random: () => number): number | null {
  const hands = sampledHands.map((hand) => [...hand]);
  hands[0] = hands[0].filter((tile) => tile.id !== firstMove.tile.id);
  if (!hands[0].length) return 0;
  let left = firstMove.newLeft;
  let right = firstMove.newRight;
  let current = 1;
  let passes = 0;

  for (let turn = 0; turn < 80; turn += 1) {
    const fakeChain: PlacedTile[] = [{ id: 'ends', a: left, b: right, left, right, player: 0 }];
    const legal = legalMovesFor(hands[current], fakeChain);
    if (!legal.length) {
      passes += 1;
      if (passes === 3) {
        const totals = hands.map(pipTotal);
        const low = Math.min(...totals);
        const winners = totals.map((value, index) => value === low ? index : -1).filter((index) => index >= 0);
        return winners.length === 1 ? winners[0] : null;
      }
    } else {
      passes = 0;
      const ranked = legal
        .map((move) => ({ move, value: moveHeuristic(move, hands[current], game.voids[(current + 1) % 3]) + random() * 0.7 }))
        .sort((a, b) => b.value - a.value);
      const move = ranked[0].move;
      hands[current] = hands[current].filter((tile) => tile.id !== move.tile.id);
      left = move.newLeft;
      right = move.newRight;
      if (!hands[current].length) return current;
    }
    current = (current + 1) % 3;
  }
  return null;
}

function analyzeMoves(game: Game): RatedMove[] {
  const moves = legalMovesFor(game.hands[0], game.chain);
  if (!moves.length) return [];
  const stateKey = `${game.round}|${game.chain.map((tile) => tile.id).join(',')}|${game.hands[0].map((tile) => tile.id).join(',')}`;
  const random = seededRandom(stateKey);
  const samples: Tile[][][] = [];
  for (let i = 0; i < 120; i += 1) {
    const sample = sampleOpponentHands(game, random);
    if (sample) samples.push(sample);
  }

  return moves.map((move) => {
    let wins = 0;
    for (const sample of samples) if (rolloutWinner(game, move, sample, random) === 0) wins += 1;
    const winRate = samples.length ? wins / samples.length * 100 : 0;
    return { ...move, wins, samples: samples.length, winRate, heuristic: moveHeuristic(move, game.hands[0], game.voids[1]) };
  }).sort((a, b) => (b.winRate + b.heuristic * 0.08) - (a.winRate + a.heuristic * 0.08));
}

function reasonForMove(game: Game, move: Move): string {
  const nextPlayer = (game.current + 1) % 3;
  const pressured = [move.newLeft, move.newRight].filter((value, index, values) => values.indexOf(value) === index && game.voids[nextPlayer].has(value));
  if (pressured.length) return `It reopens ${pressured.join(' and ')}, a number ${names[nextPlayer]} has already passed on, so it may force another pass.`;
  const remaining = game.hands[game.current].filter((tile) => tile.id !== move.tile.id);
  const counts = [move.newLeft, move.newRight].map((value) => ({ value, count: remaining.filter((tile) => tile.a === value || tile.b === value).length }));
  const controlled = counts.sort((a, b) => b.count - a.count)[0];
  if (controlled.count >= 2) return `It leaves ${controlled.value} open while you still hold ${controlled.count} ways back into that number, which preserves control.`;
  if (move.tile.a === move.tile.b) return `It safely unloads a double before it becomes stranded late in the round.`;
  if (move.tile.a + move.tile.b >= 13) return `It removes ${move.tile.a + move.tile.b} pips from your hand, reducing the damage if the table blocks.`;
  return `It keeps the strongest balance between shedding pips, preserving playable numbers, and shaping the next turn.`;
}

function chooseBotMove(game: Game, moves: Move[]): Move {
  return [...moves].sort((a, b) => moveHeuristic(b, game.hands[game.current], game.voids[(game.current + 1) % 3]) - moveHeuristic(a, game.hands[game.current], game.voids[(game.current + 1) % 3]))[0];
}

function Half({ value }: { value: number }) {
  return <span className="tile-half" aria-label={`${value}`}>{Array.from({ length: 9 }, (_, index) => <i key={index} className={dotMap[value].includes(index) ? 'pip on' : 'pip'} />)}</span>;
}

function Domino({ tile, small = false, selected = false, disabled = false, onClick }: { tile: Tile; small?: boolean; selected?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button className={`domino ${small ? 'small' : ''} ${selected ? 'selected' : ''} ${disabled ? 'unplayable' : ''}`} aria-label={`Domino ${tile.a}-${tile.b}`} disabled={disabled} onClick={onClick} type="button">
      <Half value={tile.a} /><span className="tile-divider" /><Half value={tile.b} />
    </button>
  );
}

function BoardDomino({ tile }: { tile: PlacedTile }) {
  return <Domino tile={{ id: tile.id, a: tile.left, b: tile.right }} small disabled />;
}

export default function Home() {
  const [game, setGame] = useState<Game>(initialGame);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coach, setCoach] = useState<Coach>({ kind: 'intro' });
  const legalMoves = useMemo(() => game.phase === 'playing' && game.current === 0 ? legalMovesFor(game.hands[0], game.chain) : [], [game]);
  const selectedMoves = legalMoves.filter((move) => move.tile.id === selectedId);
  const playableIds = new Set(legalMoves.map((move) => move.tile.id));
  const [leftEnd, rightEnd] = endsOf(game.chain);

  useEffect(() => {
    if (game.phase !== 'playing' || game.current === 0 || coach.kind === 'feedback') return;
    const timer = window.setTimeout(() => {
      const moves = legalMovesFor(game.hands[game.current], game.chain);
      if (!moves.length) {
        const player = game.current;
        const next = applyPass(game);
        setGame(next);
        setCoach(next.phase === 'playing' && next.current === 0
          ? { kind: 'turn', message: `${names[player]} had no legal tile and passed.` }
          : { kind: 'watching', message: `${names[player]} passed.` });
      } else {
        const player = game.current;
        const move = chooseBotMove(game, moves);
        const next = applyMove(game, move);
        setGame(next);
        setCoach(next.phase === 'playing' && next.current === 0
          ? { kind: 'turn', message: `${names[player]} played ${move.tile.a}–${move.tile.b}. Your turn.` }
          : { kind: 'watching', message: `${names[player]} played ${move.tile.a}–${move.tile.b}.` });
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [game, coach.kind]);

  function chooseStarterRule(choice: 'high' | 'low') {
    const starterDraw = drawForStarter(choice);
    setGame((current) => ({ ...current, phase: 'starterDrawn', starterDraw, starter: starterDraw.starter, current: starterDraw.starter }));
    setCoach({ kind: 'watching', message: `${names[starterDraw.starter]} drew the ${choice === 'high' ? 'highest' : 'lowest'} total and will open.` });
  }

  function beginFirstRound() {
    const starter = game.starterDraw?.starter ?? 0;
    setGame(dealRound(game, starter));
    setSelectedId(null);
    setCoach(starter === 0 ? { kind: 'turn', message: 'You won the draw. Open with any tile.' } : { kind: 'watching', message: `${names[starter]} is choosing an opening tile.` });
  }

  function playUserMove(move: Move) {
    const ranked = analyzeMoves(game);
    const chosen = ranked.find((candidate) => candidate.tile.id === move.tile.id && candidate.side === move.side) ?? ranked[0];
    const best = ranked[0];
    const gap = best.winRate - chosen.winRate;
    const tone = gap <= 4 ? 'great' : gap <= 13 ? 'okay' : 'mistake';
    const rating = gap <= 4 ? 'Best move' : gap <= 13 ? 'Playable' : gap <= 24 ? 'Mistake' : 'Big mistake';
    const title = gap <= 4 ? `Good read — ${move.tile.a}–${move.tile.b}` : `${best.tile.a}–${best.tile.b} was stronger`;
    const body = gap <= 4 ? reasonForMove(game, move) : `${reasonForMove(game, best)} Your move was about ${Math.round(gap)} percentage points worse in the simulations.`;
    const stat = `${Math.round(chosen.winRate)}% win rate · ${chosen.samples} plausible unseen deals`;
    setGame(applyMove(game, move));
    setSelectedId(null);
    setCoach({ kind: 'feedback', rating, title, body, stat, tone });
  }

  function passUser() {
    const next = applyPass(game);
    setGame(next);
    setCoach({ kind: 'feedback', rating: 'Forced pass', title: 'Nothing to fix here', body: `You had no tile matching ${leftEnd} or ${rightEnd}. The pass also tells both opponents that you are out of those numbers.`, stat: 'No decision lost', tone: 'great' });
  }

  function showHint() {
    const ranked = analyzeMoves(game);
    if (!ranked.length) return;
    const best = ranked[0];
    setSelectedId(best.tile.id);
    setCoach({ kind: 'hint', title: `Look at the ${best.tile.a}–${best.tile.b}`, body: reasonForMove(game, best), confidence: `${Math.round(best.winRate)}% win rate across ${best.samples} plausible unseen deals` });
  }

  function continueAfterFeedback() {
    if (game.phase !== 'playing') return;
    setCoach(game.current === 0 ? { kind: 'turn' } : { kind: 'watching', message: `${names[game.current]} is thinking…` });
  }

  function nextRound() {
    const winner = game.result?.winner;
    const starter = winner === null || winner === undefined ? game.starter : winner;
    const nextBase = { ...game, round: game.round + 1, starterDraw: game.starterDraw };
    setGame(dealRound(nextBase, starter));
    setSelectedId(null);
    setCoach(starter === 0 ? { kind: 'turn', message: 'You won the last round, so you open.' } : { kind: 'watching', message: `${names[starter]} won the last round and opens.` });
  }

  const mostRecentPass = [...game.history].reverse().find((line) => line.includes('passed on'));

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><div><p>MESA</p><strong>QUINCE</strong></div></div>
        <div className="match-title"><span className="eyebrow">Practice table · Round {game.round}</span><h1>First to 15</h1></div>
        <div className="header-actions"><button className="quiet-button" type="button" onClick={() => window.alert('Double-nine · 3 players · 10 tiles each · 25 sleep · mandatory play · blocked low-pip hand wins · ties score no point · first to 15 wins.')}>Rules</button><button className="new-game-button" type="button" onClick={() => { setGame(initialGame()); setCoach({ kind: 'intro' }); setSelectedId(null); }}>New game</button></div>
      </header>

      <section className="workspace">
        <section className="game-column" aria-label="Cuban domino table">
          <div className="score-strip">
            {[0, 1, 2].map((player, index) => (
              <div className={`player-score ${game.phase === 'playing' && game.current === player ? 'active' : ''}`} key={names[player]}>
                <span className={`avatar p${player}`}>{names[player][0]}</span><span><small>{names[player]}</small><b>{game.scores[player]}</b></span>
                {game.phase === 'playing' && game.current === player && <em>{player === 0 ? 'Your turn' : 'Thinking'}</em>}
                {index === 0 && <span className="race-label">Race to 15 wins</span>}
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <div className="felt-grain" />
            {game.phase !== 'pickStarter' && game.phase !== 'starterDrawn' && <>
              <div className="opponent opponent-left"><span className="avatar p1">R</span><span><b>Rosa</b><small>{game.hands[1].length} tiles</small></span><div className="tile-backs">{game.hands[1].map((tile) => <i key={tile.id} />)}</div></div>
              <div className="opponent opponent-right"><span className="avatar p2">T</span><span><b>Tino</b><small>{game.hands[2].length} tiles</small></span><div className="tile-backs">{game.hands[2].map((tile) => <i key={tile.id} />)}</div></div>
            </>}

            {game.phase === 'pickStarter' && <div className="setup-card">
              <span className="setup-kicker">First round setup</span><h2>Who gets the opening hand?</h2><p>Choose the draw rule. Each player draws one tile and compares its total dots. Tied winning totals redraw automatically.</p>
              <div className="setup-actions"><button type="button" onClick={() => chooseStarterRule('high')}><b>Highest total</b><small>Biggest sum opens</small></button><span>or</span><button type="button" onClick={() => chooseStarterRule('low')}><b>Lowest total</b><small>Smallest sum opens</small></button></div>
            </div>}

            {game.phase === 'starterDrawn' && game.starterDraw && <div className="setup-card draw-card">
              <span className="setup-kicker">{game.starterDraw.choice === 'high' ? 'Highest' : 'Lowest'} total opens</span><h2>{names[game.starterDraw.starter]} will go first</h2>
              <div className="starter-tiles">{game.starterDraw.tiles.map((tile, index) => <div className={index === game.starterDraw?.starter ? 'draw-winner' : ''} key={tile.id}><small>{names[index]}</small><Domino tile={tile} small disabled /><b>{tile.a + tile.b}</b></div>)}</div>
              <p>These tiles go back into the full set before the hands are dealt.</p><button className="deal-button" type="button" onClick={beginFirstRound}>Shuffle back &amp; deal</button>
            </div>}

            {(game.phase === 'playing' || game.phase === 'roundEnd' || game.phase === 'matchEnd') && <>
              <span className="turn-note">{game.phase === 'playing' ? game.chain.length ? `${names[game.current]} · play on ${leftEnd} or ${rightEnd}` : `${names[game.current]} opens with any tile` : 'Round complete'}</span>
              <div className="chain-scroller"><div className="chain" aria-label="Domino chain">{leftEnd !== null && <span className="edge-number">{leftEnd}</span>}{game.chain.map((tile, index) => <BoardDomino key={`${tile.id}-${index}`} tile={tile} />)}{rightEnd !== null && <span className="edge-number">{rightEnd}</span>}</div></div>
            </>}

            {(game.phase === 'roundEnd' || game.phase === 'matchEnd') && game.result && <div className="round-overlay">
              <span className="setup-kicker">{game.result.reason === 'blocked' ? 'Tranque · blocked table' : 'Last tile played'}</span>
              <h2>{game.result.winner === null ? 'Tied round — no point' : `${names[game.result.winner]} wins the round`}</h2>
              <div className="pip-totals">{game.result.pips.map((total, player) => <span key={names[player]}><small>{names[player]}</small><b>{total}</b><em>pips</em></span>)}</div>
              {game.phase === 'matchEnd' ? <><p className="day-winner">{names[game.result.matchWinner ?? 0]} reached 15 and wins the day.</p><button className="deal-button" type="button" onClick={() => { setGame(initialGame()); setCoach({ kind: 'intro' }); }}>Play another day</button></> : <button className="deal-button" type="button" onClick={nextRound}>{game.result.winner === null ? 'Replay with same opener' : `${names[game.result.winner]} opens next round`}</button>}
            </div>}
          </div>

          <div className="hand-zone">
            <div className="hand-heading"><div><span className="eyebrow">Your hand</span><strong>{game.phase === 'playing' ? game.current === 0 ? legalMoves.length ? 'Choose a tile to play' : 'You have to pass' : 'Watch the table' : 'Tiles will appear after the deal'}</strong></div><span>{game.hands[0].length} tiles</span></div>
            <div className={`hand-rack ${game.hands[0].length === 0 ? 'empty' : ''}`}>{game.hands[0].map((tile) => <Domino key={tile.id} tile={tile} selected={selectedId === tile.id} disabled={game.phase !== 'playing' || game.current !== 0 || !playableIds.has(tile.id) || coach.kind === 'feedback'} onClick={() => { setSelectedId(tile.id); if (coach.kind !== 'hint') setCoach({ kind: 'turn' }); }} />)}</div>
          </div>
        </section>

        <aside className={`coach-panel coach-${coach.kind}`}>
          <div className="coach-heading"><span className="coach-icon">◎</span><div><span className="eyebrow">Mesa coach</span><h2>{coach.kind === 'feedback' ? 'Move review' : 'Read the table'}</h2></div></div>

          {game.phase === 'playing' && mostRecentPass && <div className="read-card"><span className="read-label">Remember this pass</span><p>{mostRecentPass}</p><small>With no drawing, that information stays true for the rest of the round.</small></div>}

          {coach.kind === 'intro' && <div className="coach-copy"><span className="eyebrow">Your exact house rules</span><h3>Three players. Ten tiles each. <b>Twenty-five sleep.</b></h3><p>The coach will judge decisions without peeking at the two hidden hands or the sleeping tiles.</p></div>}
          {coach.kind === 'watching' && <div className="coach-copy"><span className="eyebrow">Table update</span><h3>{coach.message}</h3><p>Watch the ends and notice which numbers cause a pass.</p></div>}
          {coach.kind === 'turn' && <div className="coach-copy"><span className="eyebrow">Your decision</span><h3>{selectedId ? `You selected the ${selectedId.replace('-', '–')}` : coach.message ?? 'What are the opponents telling you?'}</h3><p>{selectedId ? 'Choose which end to play it on, then I’ll evaluate the decision.' : 'Count the open numbers, remember the passes, and choose a tile.'}</p></div>}
          {coach.kind === 'hint' && <div className="coach-copy hint-copy"><span className="eyebrow">A useful hint</span><h3>{coach.title}</h3><p>{coach.body}</p><small>{coach.confidence}</small></div>}
          {coach.kind === 'feedback' && <div className={`feedback-card ${coach.tone}`}><span className="feedback-rating">{coach.rating}</span><h3>{coach.title}</h3><p>{coach.body}</p><small>{coach.stat}</small></div>}

          {game.phase === 'playing' && game.current === 0 && coach.kind !== 'feedback' && <div className="decision-actions">
            {selectedMoves.map((move) => <button className="play-button" key={`${move.tile.id}-${move.side}`} type="button" onClick={() => playUserMove(move)}>{game.chain.length ? `Play on ${move.side} · ${move.side === 'left' ? leftEnd : rightEnd}` : `Open with ${move.tile.a}–${move.tile.b}`}<span>→</span></button>)}
            {!legalMoves.length && <button className="pass-button" type="button" onClick={passUser}>Pass — no legal tile <span>→</span></button>}
            {legalMoves.length > 0 && <button className="hint-button" type="button" onClick={showHint}>Give me a hint</button>}
          </div>}
          {coach.kind === 'feedback' && game.phase === 'playing' && <button className="play-button continue-button" type="button" onClick={continueAfterFeedback}>Continue <span>→</span></button>}

          <div className="coach-footer"><span>Coach method</span><b><i /> Hidden-tile simulation</b></div>
        </aside>
      </section>
    </main>
  );
}

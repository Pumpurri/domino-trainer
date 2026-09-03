'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AnalyzerWorker from './analyzer.worker?worker';
import {
  analyzeMoves as analyzeSmartMoves,
  buildRoundReview,
  chooseBotMove as chooseSmartBotMove,
  createDecisionRecord,
  createOpponentStyles,
  describeOpponentStyle,
  estimateBeliefs as estimateSmartBeliefs,
  mergeMoveAnalyses,
  reasonForMove as explainSmartMove,
  simulatePracticeReplies,
  updateBeliefState as updateSmartBeliefState,
  updateOpponentStyles,
  type BeliefState,
  type DecisionRecord,
  type DecisionReview,
  type Difficulty,
  type OpponentStyleProfile,
  type PracticeReplay,
  type RatedMove as SmartRatedMove,
  type RoundReview,
} from './domino-engine';
import {
  calibrationAdjustedBeliefState,
  calibrationAdjustedStyles,
  createEmptyTrainingProgress,
  decisionCategory,
  opponentArchetype,
  parseTrainingProgress,
  progressSummary,
  recordDrillAttempt,
  recordRoundProgress,
  serializeTrainingDataset,
  targetedDrills,
  trainingCategoryLabel,
  trainingStorageKey,
  type TargetedDrill,
  type TrainingProgress,
} from './training';

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
type LastAction = { kind: 'play' | 'pass'; player: number; tileId?: string; text: string };
type PublicEvent =
  | { kind: 'play'; player: number; tile: Tile; side: Side; endsBefore: [number | null, number | null]; nextVoids: number[] }
  | { kind: 'pass'; player: number; endsBefore: [number | null, number | null] };
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
  lastAction: LastAction | null;
  events: PublicEvent[];
};
type Coach =
  | { kind: 'intro' }
  | { kind: 'turn'; message?: string }
  | { kind: 'watching'; message: string }
  | { kind: 'hint'; title: string; body: string; confidence: string }
  | {
    kind: 'feedback';
    rating: string;
    title: string;
    body: string;
    stat: string;
    tone: 'great' | 'okay' | 'mistake';
    evidence?: { known: string; inferred: string; simulated: string; uncertain: string };
  };
type SnakeRow = { tiles: PlacedTile[]; turn: PlacedTile | null };
type PracticeResult = { selectedKey: string; correct: boolean; replay: PracticeReplay | null };
type PracticeState =
  | { source: 'mistake'; decision: DecisionReview; attempt: number; result: PracticeResult | null }
  | { source: 'drill'; drill: TargetedDrill; attempt: number; result: PracticeResult | null };

const names = ['You', 'Rosa', 'Tino'];
const beliefParticleCount = 900;
const analysisWorkerCount = 4;
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
    result: null, starterDraw: null, history: [], lastAction: null, events: [],
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
    history: [`${names[starter]} opened round ${game.round}.`], lastAction: null, events: [],
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
  const endsBefore = endsOf(game.chain);
  const hands = game.hands.map((hand, index) => index === player ? hand.filter((tile) => tile.id !== move.tile.id) : hand);
  const placed: PlacedTile = { ...move.tile, left: move.placedLeft, right: move.placedRight, player };
  const chain = game.chain.length === 0 ? [placed] : move.side === 'left' ? [placed, ...game.chain] : [...game.chain, placed];
  const next: Game = {
    ...game, hands, chain, current: (player + 1) % 3, consecutivePasses: 0,
    history: [...game.history, `${names[player]} played ${describeMove(move, game.chain.length)}.`],
    lastAction: { kind: 'play', player, tileId: move.tile.id, text: `${names[player]} played ${move.tile.a}–${move.tile.b}` },
    events: [...game.events, { kind: 'play', player, tile: move.tile, side: move.side, endsBefore, nextVoids: [...game.voids[(player + 1) % 3]] }],
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
    lastAction: { kind: 'pass', player, text: `${names[player]} passed on ${left} and ${right}` },
    events: [...game.events, { kind: 'pass', player, endsBefore: [left, right] }],
  };
  if (passed.consecutivePasses < 3) return passed;
  const pips = passed.hands.map(pipTotal);
  const lowest = Math.min(...pips);
  const possible = pips.map((value, index) => value === lowest ? index : -1).filter((index) => index >= 0);
  return finishRound(passed, possible.length === 1 ? possible[0] : null, 'blocked');
}

function Half({ value }: { value: number }) {
  return <span className={`tile-half value-${value}`} aria-label={`${value}`}>{Array.from({ length: 9 }, (_, index) => <i key={index} className={dotMap[value].includes(index) ? 'pip on' : 'pip'} />)}</span>;
}

function Domino({ tile, small = false, vertical = false, selected = false, disabled = false, justPlayed = false, onClick }: { tile: Tile; small?: boolean; vertical?: boolean; selected?: boolean; disabled?: boolean; justPlayed?: boolean; onClick?: () => void }) {
  return (
    <button className={`domino ${small ? 'small' : ''} ${vertical ? 'vertical' : ''} ${selected ? 'selected' : ''} ${disabled ? 'unplayable' : ''} ${justPlayed ? 'just-played' : ''}`} aria-label={`Domino ${tile.a}-${tile.b}`} disabled={disabled} onClick={onClick} type="button">
      <Half value={tile.a} /><span className="tile-divider" /><Half value={tile.b} />
    </button>
  );
}

function BoardDomino({ tile, justPlayed, reversed = false, vertical = false }: { tile: PlacedTile; justPlayed: boolean; reversed?: boolean; vertical?: boolean }) {
  const shown = reversed
    ? { id: tile.id, a: tile.right, b: tile.left }
    : { id: tile.id, a: tile.left, b: tile.right };
  return <Domino tile={shown} small vertical={vertical} disabled justPlayed={justPlayed} />;
}

function makeSnakeRows(chain: PlacedTile[], rowSize = 8): SnakeRow[] {
  const rows: SnakeRow[] = [];
  let index = 0;
  while (index < chain.length) {
    const tiles = chain.slice(index, index + rowSize);
    index += tiles.length;
    const turn = index < chain.length ? chain[index] : null;
    if (turn) index += 1;
    rows.push({ tiles, turn });
  }
  return rows;
}

function reviewMoveLabel(option: RoundReview['decisions'][number]['chosen']): string {
  return `${option.tile.a}–${option.tile.b}${option.side ? ` on the ${option.side}` : ''}`;
}

function verdictLabel(verdict: RoundReview['decisions'][number]['verdict']): string {
  if (verdict === 'best') return 'Best choice';
  if (verdict === 'close') return 'Too close to call';
  if (verdict === 'slight') return 'Small miss';
  if (verdict === 'mistake') return 'Mistake';
  return 'Big mistake';
}

function RoundReviewPanel({
  review,
  onPractice,
  onContinue,
  continueLabel,
}: {
  review: RoundReview;
  onPractice: (decision: DecisionReview) => void;
  onContinue: () => void;
  continueLabel: string;
}) {
  const beliefAccuracy = review.beliefChecks.total
    ? `${review.beliefChecks.correct}/${review.beliefChecks.total}`
    : 'No reads yet';
  return <div className="round-review-overlay">
    <div className="review-header">
      <div><span className="setup-kicker">Round {review.round} coaching report</span><h2>What the table was telling you</h2><p>Advice below uses only what was knowable when each move was played. Revealed hands are shown separately.</p></div>
      <div className="review-stats">
        <span><b>{review.decisions.length}</b><small>decisions</small></span>
        <span><b>{review.closeCalls}</b><small>close calls</small></span>
        <span><b>{beliefAccuracy}</b><small>reads matched</small></span>
      </div>
    </div>

    <div className="review-highlights">
      <article className={`review-highlight ${review.biggestMistake ? 'mistake' : 'clean'}`}>
        <span>Largest lesson</span>
        {review.biggestMistake
          ? <><h3>{reviewMoveLabel(review.biggestMistake.best)} was stronger</h3><p>You played {reviewMoveLabel(review.biggestMistake.chosen)}. The paired estimate favored the alternative by {Math.round(review.biggestMistake.winRateGap)} percentage points.</p><button className="practice-link" type="button" onClick={() => onPractice(review.biggestMistake!)}>Practice this decision</button></>
          : <><h3>No confident mistake found</h3><p>Your decisions were either the leading choice or too close for the simulations to judge honestly.</p></>}
      </article>
      <article className="review-highlight clean">
        <span>Best decision</span>
        {review.bestDecision
          ? <><h3>{reviewMoveLabel(review.bestDecision.chosen)}</h3><p>{review.bestDecision.simulated}</p></>
          : <><h3>No voluntary play to grade</h3><p>The round ended before you had a meaningful choice.</p></>}
      </article>
    </div>

    <div className="review-decisions">
      {review.decisions.map((decision, index) => <details className={`review-decision verdict-${decision.verdict}`} open={index === 0 || decision === review.biggestMistake} key={decision.record.id}>
        <summary>
          <span>Decision {index + 1} · {decision.record.phase}</span>
          <b>{reviewMoveLabel(decision.chosen)}</b>
          <em>{verdictLabel(decision.verdict)}</em>
        </summary>
        <div className="evidence-grid">
          <p><strong>Known</strong>{decision.known}</p>
          <p><strong>Inferred</strong>{decision.inferred}</p>
          <p><strong>Simulated</strong>{decision.simulated}</p>
          <p><strong>Uncertain</strong>{decision.uncertainty}</p>
          <p className="revealed-evidence"><strong>Revealed afterward</strong>{decision.revealed}</p>
          {decision.record.options.length > 1 && <button className="practice-link evidence-practice" type="button" onClick={() => onPractice(decision)}>Practice this decision</button>}
        </div>
      </details>)}
      {!review.decisions.length && <div className="review-empty"><h3>No decisions to review</h3><p>You never had a voluntary legal choice during this round.</p></div>}
    </div>

    <div className="revealed-hands">
      <span className="setup-kicker">Revealed only after the round</span>
      {review.opponentStartingHands.map(({ player, tiles }) => <div key={player}><b>{names[player]}</b><p>{tiles.map((tile) => tile.id.replace('-', '–')).join(' · ')}</p></div>)}
      <small>These tiles were never available to the live recommendation engine.</small>
    </div>
    <button className="deal-button" type="button" onClick={onContinue}>{continueLabel}</button>
  </div>;
}

function practiceMoveLabel(move: { tile: Tile; side: Side }): string {
  return `${move.tile.a}–${move.tile.b} on the ${move.side}`;
}

function PracticeBoard({ chain }: { chain: PlacedTile[] }) {
  const [left, right] = endsOf(chain);
  const rows = makeSnakeRows(chain);
  return <div className="practice-board">
    <div className="snake-board" aria-label="Practice position">
      {rows.map((row, rowIndex) => {
        const direction = rowIndex % 2 === 0 ? 'right' : 'left';
        const isLast = rowIndex === rows.length - 1;
        const endsOnTurn = isLast && row.turn !== null;
        return <div className={`snake-row toward-${direction} ${endsOnTurn ? 'ends-on-turn' : ''}`} key={`practice-row-${rowIndex}`}>
          {rowIndex === 0 && left !== null && <span className="edge-number start-edge">{left}</span>}
          {row.tiles.map((placed) => <BoardDomino key={placed.id} tile={placed} reversed={direction === 'left'} justPlayed={false} />)}
          {isLast && !endsOnTurn && right !== null && <span className="edge-number end-edge">{right}</span>}
          {row.turn && <span className="snake-turn"><BoardDomino tile={row.turn} vertical justPlayed={false} />{endsOnTurn && right !== null && <span className="edge-number turn-end">{right}</span>}</span>}
        </div>;
      })}
    </div>
  </div>;
}

function PracticeOverlay({
  practice,
  onChoose,
  onRetry,
  onClose,
}: {
  practice: PracticeState;
  onChoose: (key: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const isMistake = practice.source === 'mistake';
  const options = isMistake ? practice.decision.record.options : practice.drill.options;
  const hand = isMistake ? practice.decision.record.hand : practice.drill.hand;
  const chain = isMistake ? practice.decision.record.publicState.chain : practice.drill.chain;
  const title = isMistake ? 'Replay your decision' : practice.drill.title;
  const goal = isMistake
    ? `Round ${practice.decision.record.round}, ${practice.decision.record.phase} game. Choose again using only what you knew then.`
    : practice.drill.goal;
  const knownRead = isMistake
    ? practice.decision.known
    : practice.drill.knownRead;
  const explanation = isMistake
    ? `${practice.decision.simulated} ${practice.decision.record.recommendationReason}`
    : practice.drill.explanation;
  return <div className="training-scrim">
    <section className="practice-overlay" aria-modal="true" role="dialog">
      <div className="training-overlay-header">
        <div><span className="setup-kicker">{isMistake ? `Mistake Lab · plausible table P${practice.attempt + 1}` : `Targeted drill · ${trainingCategoryLabel(practice.drill.category)}`}</span><h2>{title}</h2><p>{goal}</p></div>
        <button className="overlay-close" type="button" onClick={onClose} aria-label="Close practice">×</button>
      </div>
      <div className="practice-layout">
        <div className="practice-table-card">
          <PracticeBoard chain={chain} />
          <div className="practice-read"><span>Known at the table</span><p>{knownRead}</p></div>
          <div className="practice-hand"><span>Your hand then</span><div>{hand.map((held) => <Domino key={held.id} tile={held} disabled />)}</div></div>
        </div>
        <aside className="practice-choice-card">
          <span className="eyebrow">Make the decision</span>
          <h3>What would you play now?</h3>
          <div className="practice-options">
            {options.map((option) => <button
              className={practice.result?.selectedKey === `${option.tile.id}:${option.side}` ? 'selected' : ''}
              disabled={practice.result !== null}
              key={`${option.tile.id}:${option.side}`}
              type="button"
              onClick={() => onChoose(`${option.tile.id}:${option.side}`)}
            >{practiceMoveLabel(option)}<span>→</span></button>)}
          </div>
          {!practice.result && <p className="practice-privacy">{isMistake ? 'The opponents’ hands were regenerated from the same public evidence. Their real hands from the round are not reused.' : 'This drill isolates one repeatable table skill.'}</p>}
          {practice.result && <div className={`practice-result ${practice.result.correct ? 'correct' : 'incorrect'}`}>
            <span>{practice.result.correct ? 'Correct decision' : 'Try to see the stronger route'}</span>
            <h3>{practiceMoveLabel(options.find((option) => `${option.tile.id}:${option.side}` === (isMistake ? practice.decision.record.bestKey : practice.drill.bestKey))!)}</h3>
            <p>{explanation}</p>
            {practice.result.replay && <div className="reply-line">
              <b>One likely response on table P{practice.attempt + 1}</b>
              {practice.result.replay.replies.length
                ? practice.result.replay.replies.map((reply, index) => <span key={`${reply.player}-${index}`}>{names[reply.player]} {reply.kind === 'pass' ? 'passes' : `plays ${reply.tile!.a}–${reply.tile!.b} on the ${reply.side}`}</span>)
                : <span>The round ends before an opponent replies.</span>}
              <em>{practice.result.replay.returnedToUser ? `You return to ${practice.result.replay.finalEnds[0]} or ${practice.result.replay.finalEnds[1]}.` : practice.result.replay.roundEnded ? 'The regenerated line ends the round.' : 'The line did not return within two replies.'}</em>
            </div>}
            <button className="practice-retry" type="button" onClick={onRetry}>{isMistake ? 'Try another hidden deal' : 'Practice it again'}</button>
          </div>}
        </aside>
      </div>
    </section>
  </div>;
}

function calibrationRatingLabel(rating: ReturnType<typeof progressSummary>['beliefCalibration']['rating']): string {
  if (rating === 'well-calibrated') return 'Tracking reality well';
  if (rating === 'mixed') return 'Mixed calibration';
  if (rating === 'needs-work') return 'Confidence needs correction';
  return 'Collecting evidence';
}

function TrainingCenter({
  progress,
  onStartDrill,
  onExport,
  onClose,
}: {
  progress: TrainingProgress;
  onStartDrill: (drill: TargetedDrill) => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const summary = progressSummary(progress);
  return <div className="training-scrim">
    <section className="training-overlay" aria-modal="true" role="dialog">
      <div className="training-overlay-header">
        <div><span className="setup-kicker">Mesa training center</span><h2>Your game, measured over time</h2><p>Progress stays on this laptop. The tracker scores decisions, not lucky wins or unlucky deals.</p></div>
        <button className="overlay-close" type="button" onClick={onClose} aria-label="Close training center">×</button>
      </div>

      <div className="progress-hero">
        <article><b>{summary.rounds}</b><span>rounds reviewed</span></article>
        <article><b>{summary.decisions}</b><span>decisions measured</span></article>
        <article><b>{summary.averageLoss.toFixed(1)}</b><span>avg estimated points lost per round</span></article>
        <article><b>{summary.masteredDrills}/6</b><span>drills mastered</span></article>
      </div>

      <div className="training-grid">
        <section className="training-card trend-card">
          <span className="training-card-label">Decision trend</span><h3>Last 10, 25, and 50 rounds</h3>
          <div className="window-list">{summary.windows.map((window) => <div key={window.size}><b>{window.size}</b><span>{window.averageLoss === null ? 'No rounds yet' : `${window.averageLoss.toFixed(1)} points lost per round`}</span><em>{window.changeFromPrevious === null ? 'Need another full window for a comparison' : window.changeFromPrevious < 0 ? `${Math.abs(window.changeFromPrevious).toFixed(1)} better than the prior ${window.size}` : window.changeFromPrevious > 0 ? `${window.changeFromPrevious.toFixed(1)} worse than the prior ${window.size}` : 'Even with the prior window'}</em></div>)}</div>
        </section>
        <section className="training-card phase-card">
          <span className="training-card-label">Phase report</span><h3>Where mistakes happen</h3>
          <div className="phase-table">{summary.phases.map((phase) => <div key={phase.phase}><b>{phase.phase}</b><span>{phase.mistakes}/{phase.decisions} misses</span><em>{phase.averageLoss.toFixed(1)} avg loss</em></div>)}</div>
          <p>{summary.weaknesses[0] ? `Most common leak: ${trainingCategoryLabel(summary.weaknesses[0].category)} (${summary.weaknesses[0].count}).` : 'No repeated leak has been identified yet.'}</p>
        </section>
      </div>

      <section className="training-card drill-section">
        <div><span className="training-card-label">Targeted practice</span><h3>Six situations strong players recognize quickly</h3></div>
        <div className="drill-grid">{targetedDrills.map((drill) => {
          const attempts = progress.drills.find((item) => item.id === `drill:${drill.id}`);
          return <article key={drill.id}><span>{trainingCategoryLabel(drill.category)}</span><h4>{drill.title}</h4><p>{drill.goal}</p><small>{attempts ? `${attempts.correct}/${attempts.attempts} correct · best streak ${attempts.bestStreak}` : 'Not practiced yet'}</small><button type="button" onClick={() => onStartDrill(drill)}>Practice</button></article>;
        })}</div>
      </section>

      <div className="training-grid calibration-grid">
        <section className="training-card calibration-card">
          <span className="training-card-label">Belief calibration</span><h3>{calibrationRatingLabel(summary.beliefCalibration.rating)}</h3><p>{summary.beliefCalibration.samples} probability checks · {summary.beliefCalibration.meanSquaredError === null ? 'no error score yet' : `${summary.beliefCalibration.meanSquaredError.toFixed(3)} squared error, lower is better`}</p>
          <div className="calibration-buckets">{summary.beliefCalibration.buckets.map((bucket) => <div key={bucket.label}><b>{bucket.label}</b><span>{bucket.count ? `${Math.round(bucket.observedRate * 100)}% actual` : 'No samples'}</span><em>{bucket.count} checks</em></div>)}</div>
        </section>
        <section className="training-card calibration-card">
          <span className="training-card-label">Opponent-style calibration</span><h3>{calibrationRatingLabel(summary.styleCalibration.rating)}</h3><p>{summary.styleCalibration.samples} tendency checks · {summary.styleCalibration.meanSquaredError === null ? 'no error score yet' : `${summary.styleCalibration.meanSquaredError.toFixed(3)} squared error, lower is better`}</p>
          <div className="player-calibration">{summary.styleCalibrationByPlayer.map(({ player, summary: playerSummary }) => <span key={player}><b>{names[player]}</b>{playerSummary.samples ? `${playerSummary.samples} checks · ${playerSummary.meanSquaredError!.toFixed(3)} error` : 'Collecting choices'}</span>)}</div>
          <small>The tracker reduces its practical influence when observations are thin. These checks compare earlier style expectations with later revealed legal choices.</small>
        </section>
      </div>

      <section className="dataset-card">
        <div><span className="training-card-label">Information-safe dataset</span><h3>{progress.examples.length} decision examples ready</h3><p>Exports public actions, your hand, model estimates, and labels. Opponent hidden hands and sleeping tiles are excluded.</p></div>
        <button type="button" disabled={!progress.examples.length} onClick={onExport}>Export JSON</button>
      </section>
    </section>
  </div>;
}

function informationSafeAnalysisGame(game: Game): Game {
  return {
    ...game,
    hands: game.hands.map((hand, player) => player === 0
      ? hand.map((tile) => ({ ...tile }))
      : hand.map((_, index) => ({ id: `hidden-${player}-${index}`, a: -1, b: -1 }))),
  };
}

export default function Home() {
  const [game, setGame] = useState<Game>(initialGame);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coach, setCoach] = useState<Coach>({ kind: 'intro' });
  const [difficulty, setDifficulty] = useState<Difficulty>('strong');
  const [beliefState, setBeliefState] = useState<BeliefState | null>(null);
  const [styleProfiles, setStyleProfiles] = useState<OpponentStyleProfile[]>(createOpponentStyles);
  const [decisionRecords, setDecisionRecords] = useState<DecisionRecord[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [practiceState, setPracticeState] = useState<PracticeState | null>(null);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>(createEmptyTrainingProgress);
  const [trainingReady, setTrainingReady] = useState(false);
  const dayId = useRef('');
  const analyzerWorkers = useRef<Worker[]>([]);
  const analysisSequence = useRef(0);
  const analysisRequests = useRef(new Map<number, {
    resolve: (ranked: SmartRatedMove[]) => void;
    reject: (error: Error) => void;
  }>());
  const analysisCache = useRef(new Map<string, SmartRatedMove[]>());
  const legalMoves = game.phase === 'playing' && game.current === 0 ? legalMovesFor(game.hands[0], game.chain) : [];
  const selectedMoves = legalMoves.filter((move) => move.tile.id === selectedId);
  const playableIds = new Set(legalMoves.map((move) => move.tile.id));
  const [leftEnd, rightEnd] = endsOf(game.chain);
  const snakeRows = useMemo(() => makeSnakeRows(game.chain), [game.chain]);
  const lifetimeTrainingSummary = useMemo(() => progressSummary(trainingProgress), [trainingProgress]);
  const currentBeliefState = useMemo(() => {
    if (game.phase === 'pickStarter' || game.phase === 'starterDrawn' || !game.hands[0].length) return null;
    return updateSmartBeliefState(beliefState, game, 0, beliefParticleCount, styleProfiles);
  }, [beliefState, game, styleProfiles]);
  const currentStyleProfiles = useMemo(() => updateOpponentStyles(
    styleProfiles,
    game,
    currentBeliefState ?? undefined,
  ), [currentBeliefState, game, styleProfiles]);
  const analysisBeliefState = useMemo(() => calibrationAdjustedBeliefState(
    currentBeliefState,
    lifetimeTrainingSummary.beliefCalibration,
  ), [currentBeliefState, lifetimeTrainingSummary.beliefCalibration]);
  const analysisStyleProfiles = useMemo(() => calibrationAdjustedStyles(
    currentStyleProfiles,
    lifetimeTrainingSummary.styleCalibration,
  ), [currentStyleProfiles, lifetimeTrainingSummary.styleCalibration]);
  const beliefs = useMemo(() => game.phase === 'playing'
    ? estimateSmartBeliefs(game, 0, beliefParticleCount, analysisBeliefState ?? undefined, analysisStyleProfiles)
    : [], [analysisBeliefState, analysisStyleProfiles, game]);
  const roundReview = useMemo(() => (
    (game.phase === 'roundEnd' || game.phase === 'matchEnd') && game.result
      ? buildRoundReview(game, decisionRecords)
      : null
  ), [decisionRecords, game]);

  useEffect(() => {
    dayId.current = `day-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
    // Progress is intentionally device-local and never sent to the Site server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrainingProgress(parseTrainingProgress(window.localStorage.getItem(trainingStorageKey)));
    setTrainingReady(true);
  }, []);

  useEffect(() => {
    if (!trainingReady) return;
    window.localStorage.setItem(trainingStorageKey, JSON.stringify(trainingProgress));
  }, [trainingProgress, trainingReady]);

  useEffect(() => {
    if (!trainingReady || !roundReview || !dayId.current) return;
    const roundKey = `${dayId.current}:round-${roundReview.round}`;
    // A stable round key makes this idempotent even when the report rerenders.
    setTrainingProgress((current) => recordRoundProgress(current, roundReview, roundKey));
  }, [roundReview, trainingReady]);

  useEffect(() => {
    // The persistent particle pool advances only after public game events change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (beliefState !== currentBeliefState) setBeliefState(currentBeliefState);
  }, [beliefState, currentBeliefState]);

  useEffect(() => {
    // Style profiles are cumulative state, while currentStyleProfiles is the event-derived next snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (styleProfiles !== currentStyleProfiles) setStyleProfiles(currentStyleProfiles);
  }, [currentStyleProfiles, styleProfiles]);

  useEffect(() => {
    const receiveAnalysis = (event: MessageEvent<{ id: number; ranked?: SmartRatedMove[]; error?: string }>) => {
      const pending = analysisRequests.current.get(event.data.id);
      if (!pending) return;
      analysisRequests.current.delete(event.data.id);
      if (event.data.error || !event.data.ranked) pending.reject(new Error(event.data.error ?? 'No analysis returned.'));
      else pending.resolve(event.data.ranked);
    };
    const analysisFailed = () => {
      analysisRequests.current.forEach(({ reject }) => reject(new Error('The background analyzer stopped.')));
      analysisRequests.current.clear();
    };
    const workers = Array.from({ length: analysisWorkerCount }, () => {
      const worker = new AnalyzerWorker({ type: 'module' });
      worker.onmessage = receiveAnalysis;
      worker.onerror = analysisFailed;
      return worker;
    });
    analyzerWorkers.current = workers;
    return () => {
      workers.forEach((worker) => worker.terminate());
      analyzerWorkers.current = [];
    };
  }, []);

  function analysisKey(): string {
    const styleKey = analysisStyleProfiles.map((style) => [
      style.player,
      style.observedChoices,
      style.highPipTendency.toFixed(3),
      style.doubleTendency.toFixed(3),
      style.controlTendency.toFixed(3),
      style.blockTendency.toFixed(3),
    ].join(':')).join('/');
    return `${game.round}|${game.events.length}|${game.chain.map((tile) => `${tile.id}:${tile.left}-${tile.right}`).join(',')}|${game.hands[0].map((tile) => tile.id).join(',')}|${styleKey}`;
  }

  async function analyzeCurrentDecision(): Promise<SmartRatedMove[]> {
    const key = analysisKey();
    const cached = analysisCache.current.get(key);
    if (cached) return cached;
    setIsAnalyzing(true);
    try {
      const workers = analyzerWorkers.current;
      const safeGame = informationSafeAnalysisGame(game);
      const ranked = workers.length
        ? mergeMoveAnalyses(await Promise.all(workers.map((worker, shardIndex) => new Promise<SmartRatedMove[]>((resolve, reject) => {
          const id = analysisSequence.current + 1;
          analysisSequence.current = id;
          analysisRequests.current.set(id, { resolve, reject });
          worker.postMessage({
            id,
            game: safeGame,
            sampleCount: beliefParticleCount,
            beliefState: analysisBeliefState ?? undefined,
            styles: analysisStyleProfiles,
            options: { representativeLimit: 120, shardIndex, shardCount: workers.length },
          });
        }))))
        : analyzeSmartMoves(safeGame, beliefParticleCount, analysisBeliefState ?? undefined, analysisStyleProfiles);
      analysisCache.current.set(key, ranked);
      if (analysisCache.current.size > 12) analysisCache.current.delete(analysisCache.current.keys().next().value!);
      return ranked;
    } finally {
      setIsAnalyzing(false);
    }
  }

  useEffect(() => {
    if (game.phase !== 'playing' || game.current === 0 || coach.kind === 'feedback' || trainingOpen || practiceState) return;
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
        const move = chooseSmartBotMove(game, moves, difficulty);
        const next = applyMove(game, move);
        setGame(next);
        setCoach(next.phase === 'playing' && next.current === 0
          ? { kind: 'turn', message: `${names[player]} played ${move.tile.a}–${move.tile.b}. Your turn.` }
          : { kind: 'watching', message: `${names[player]} played ${move.tile.a}–${move.tile.b}.` });
      }
    }, 1750);
    return () => window.clearTimeout(timer);
  }, [game, coach.kind, difficulty, practiceState, trainingOpen]);

  function chooseStarterRule(choice: 'high' | 'low') {
    const starterDraw = drawForStarter(choice);
    setGame((current) => ({ ...current, phase: 'starterDrawn', starterDraw, starter: starterDraw.starter, current: starterDraw.starter }));
    setCoach({ kind: 'watching', message: `${names[starterDraw.starter]} drew the ${choice === 'high' ? 'highest' : 'lowest'} total and will open.` });
  }

  function beginFirstRound() {
    const starter = game.starterDraw?.starter ?? 0;
    setGame(dealRound(game, starter));
    setSelectedId(null);
    setDecisionRecords([]);
    setReviewOpen(false);
    setCoach(starter === 0 ? { kind: 'turn', message: 'You won the draw. Open with any tile.' } : { kind: 'watching', message: `${names[starter]} is choosing an opening tile.` });
  }

  function resetDay() {
    dayId.current = `day-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
    setGame(initialGame());
    setCoach({ kind: 'intro' });
    setSelectedId(null);
    setBeliefState(null);
    setStyleProfiles(createOpponentStyles());
    setDecisionRecords([]);
    setReviewOpen(false);
    setTrainingOpen(false);
    setPracticeState(null);
    analysisCache.current.clear();
  }

  function practiceDecision(decision: DecisionReview) {
    setPracticeState({ source: 'mistake', decision, attempt: 0, result: null });
  }

  function startTargetedDrill(drill: TargetedDrill) {
    setPracticeState({ source: 'drill', drill, attempt: 0, result: null });
  }

  function choosePracticeMove(selectedKey: string) {
    if (!practiceState || practiceState.result) return;
    const bestKey = practiceState.source === 'mistake'
      ? practiceState.decision.record.bestKey
      : practiceState.drill.bestKey;
    const correct = selectedKey === bestKey;
    const replay = practiceState.source === 'mistake'
      ? simulatePracticeReplies(practiceState.decision.record, selectedKey, practiceState.attempt)
      : null;
    const category = practiceState.source === 'mistake'
      ? decisionCategory(practiceState.decision)
      : practiceState.drill.category;
    const practiceId = practiceState.source === 'mistake'
      ? `mistake:${practiceState.decision.record.phase}:${practiceState.decision.record.ends.join('-')}:${practiceState.decision.record.hand.map((tile) => tile.id).join(',')}`
      : `drill:${practiceState.drill.id}`;
    setTrainingProgress((current) => recordDrillAttempt(current, practiceId, category, correct));
    setPracticeState({ ...practiceState, result: { selectedKey, correct, replay } });
  }

  function retryPractice() {
    setPracticeState((current) => current ? { ...current, attempt: current.attempt + 1, result: null } : null);
  }

  function exportTrainingData() {
    const serialized = serializeTrainingDataset(trainingProgress);
    const url = window.URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mesa-quince-training-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  async function playUserMove(move: Move) {
    if (isAnalyzing) return;
    try {
      const ranked = await analyzeCurrentDecision();
      const chosen = ranked.find((candidate) => candidate.tile.id === move.tile.id && candidate.side === move.side) ?? ranked[0];
      const best = ranked[0];
      const gap = best.winRate - chosen.winRate;
      const sameAsBest = best.tile.id === chosen.tile.id && best.side === chosen.side;
      const comparison = sameAsBest ? ranked[1] : best;
      const combinedMargin = comparison ? Math.sqrt(chosen.margin ** 2 + comparison.margin ** 2) : 0;
      const tooClose = comparison ? Math.abs(chosen.winRate - comparison.winRate) <= Math.max(3, combinedMargin) : false;
      const tone = sameAsBest || tooClose ? 'great' : gap <= 13 ? 'okay' : 'mistake';
      const rating = tooClose ? 'Too close to call' : sameAsBest ? 'Best in simulations' : gap <= 13 ? 'Slight miss' : gap <= 24 ? 'Mistake' : 'Big mistake';
      const title = tooClose ? `${move.tile.a}–${move.tile.b} is in the top group` : sameAsBest ? `Strong simulation result: ${move.tile.a}–${move.tile.b}` : `${best.tile.a}–${best.tile.b} simulated better`;
      const body = tooClose
        ? `The model cannot reliably separate this move from ${comparison!.tile.a}–${comparison!.tile.b}; the estimated difference is inside the uncertainty range. ${explainSmartMove(game, chosen, comparison)}`
        : sameAsBest
          ? explainSmartMove(game, chosen, comparison)
          : `${explainSmartMove(game, best, chosen)} Your move's estimated win rate was ${Math.round(gap)} percentage points lower.`;
      const stat = `${Math.round(chosen.winRate)}% estimated win chance ±${Math.ceil(chosen.margin)} · ${chosen.samples} paired rollouts · ${chosen.treeSearch.visits} deep visits`;
      const record = createDecisionRecord(
        game,
        ranked,
        move,
        beliefs,
        analysisBeliefState ?? undefined,
        analysisStyleProfiles,
      );
      if (record) setDecisionRecords((current) => [...current.filter(({ id }) => id !== record.id), record]);
      setGame(applyMove(game, move));
      setSelectedId(null);
      setCoach({
        kind: 'feedback',
        rating,
        title,
        body,
        stat,
        tone,
        evidence: {
          known: record?.knownEvidence[0] ?? 'No opponent void had been proven yet.',
          inferred: record?.inferredEvidence[0] ?? 'The hidden-hand model had no strong directional read yet.',
          simulated: sameAsBest
            ? `${move.tile.a}–${move.tile.b} led at ${Math.round(chosen.winRate)}% estimated wins.`
            : `${best.tile.a}–${best.tile.b} led ${Math.round(best.winRate)}% to ${Math.round(chosen.winRate)}%.`,
          uncertain: tooClose
            ? 'The estimates overlap, so the coach is not calling this a mistake.'
            : 'Simulation estimates describe repeated plausible deals, not a guaranteed result for this round.',
        },
      });
    } catch {
      setCoach({ kind: 'turn', message: 'The analysis did not finish. Your tile is still selected, so you can try again.' });
    }
  }

  function passUser() {
    const next = applyPass(game);
    setGame(next);
    setCoach({ kind: 'feedback', rating: 'Forced pass', title: 'Nothing to fix here', body: `You had no tile matching ${leftEnd} or ${rightEnd}. The pass also tells both opponents that you are out of those numbers.`, stat: 'No decision lost', tone: 'great' });
  }

  async function showHint() {
    if (isAnalyzing) return;
    try {
      const ranked = await analyzeCurrentDecision();
      if (!ranked.length) return;
      const best = ranked[0];
      const second = ranked[1];
      const combinedMargin = second ? Math.sqrt(best.margin ** 2 + second.margin ** 2) : 0;
      const tooClose = second ? best.winRate - second.winRate <= Math.max(3, combinedMargin) : false;
      setSelectedId(best.tile.id);
      setCoach({
        kind: 'hint',
        title: tooClose
          ? `${describeMove(best, game.chain.length)} and ${describeMove(second!, game.chain.length)} are close`
          : `The simulations lean toward ${describeMove(best, game.chain.length)}`,
        body: `${explainSmartMove(game, best, second)}${tooClose ? ' The top choices overlap statistically, so this is a preference, not a certainty.' : ''}`,
        confidence: `${Math.round(best.winRate)}% estimated win chance ±${Math.ceil(best.margin)} · ${best.samples} paired rollouts · ${best.treeSearch.visits} deep visits`,
      });
    } catch {
      setCoach({ kind: 'turn', message: 'The hint could not finish. You can still choose a legal tile.' });
    }
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
    setBeliefState(null);
    setDecisionRecords([]);
    setReviewOpen(false);
    setCoach(starter === 0 ? { kind: 'turn', message: 'You won the last round, so you open.' } : { kind: 'watching', message: `${names[starter]} won the last round and opens.` });
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark"><i /><i /><i /></span><div><p>MESA</p><strong>QUINCE</strong></div></div>
        <div className="match-title"><span className="eyebrow">Practice table · Round {game.round}</span><h1>First to 15</h1></div>
        <div className="header-actions"><button className="quiet-button" type="button" onClick={() => window.alert('Double-nine · 3 players · 10 tiles each · 25 sleep · mandatory play · blocked low-pip hand wins · ties score no point · first to 15 wins.')}>Rules</button><button className="quiet-button training-button" type="button" onClick={() => setTrainingOpen(true)}>Training</button><button className="new-game-button" type="button" onClick={resetDay}>New game</button></div>
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
              {game.lastAction && <span className={`last-action-note action-${game.lastAction.kind}`} key={`${game.lastAction.text}-${game.history.length}`}>{game.lastAction.text}</span>}
              <div className="snake-stage">
                <div className="snake-board" aria-label="Domino chain">
                  {snakeRows.map((row, rowIndex) => {
                    const direction = rowIndex % 2 === 0 ? 'right' : 'left';
                    const isLast = rowIndex === snakeRows.length - 1;
                    const endsOnTurn = isLast && row.turn !== null;
                    return <div className={`snake-row toward-${direction} ${endsOnTurn ? 'ends-on-turn' : ''}`} key={`row-${rowIndex}`}>
                      {rowIndex === 0 && leftEnd !== null && <span className="edge-number start-edge">{leftEnd}</span>}
                      {row.tiles.map((tile) => <BoardDomino key={tile.id} tile={tile} reversed={direction === 'left'} justPlayed={game.lastAction?.kind === 'play' && game.lastAction.tileId === tile.id} />)}
                      {isLast && !endsOnTurn && rightEnd !== null && <span className="edge-number end-edge">{rightEnd}</span>}
                      {row.turn && <span className="snake-turn">
                        <BoardDomino tile={row.turn} vertical justPlayed={game.lastAction?.kind === 'play' && game.lastAction.tileId === row.turn.id} />
                        {endsOnTurn && rightEnd !== null && <span className="edge-number turn-end">{rightEnd}</span>}
                      </span>}
                    </div>;
                  })}
                </div>
              </div>
            </>}

            {(game.phase === 'roundEnd' || game.phase === 'matchEnd') && game.result && !reviewOpen && <div className="round-overlay">
              <span className="setup-kicker">{game.result.reason === 'blocked' ? 'Tranque · blocked table' : 'Last tile played'}</span>
              <h2>{game.result.winner === null ? 'Tied round — no point' : `${names[game.result.winner]} wins the round`}</h2>
              <div className="pip-totals">{game.result.pips.map((total, player) => <span key={names[player]}><small>{names[player]}</small><b>{total}</b><em>pips</em></span>)}</div>
              {game.phase === 'matchEnd' && <p className="day-winner">{names[game.result.matchWinner ?? 0]} reached 15 and wins the day.</p>}
              <div className="round-actions">
                {roundReview && <button className="deal-button review-button" type="button" onClick={() => setReviewOpen(true)}>Review my round</button>}
                <button className="secondary-round-button" type="button" onClick={game.phase === 'matchEnd' ? resetDay : nextRound}>{game.phase === 'matchEnd' ? 'Play another day' : game.result.winner === null ? 'Skip review and replay' : `Skip review · ${names[game.result.winner]} opens`}</button>
              </div>
            </div>}
            {(game.phase === 'roundEnd' || game.phase === 'matchEnd') && game.result && reviewOpen && roundReview && <RoundReviewPanel
              review={roundReview}
              onPractice={practiceDecision}
              onContinue={game.phase === 'matchEnd' ? resetDay : nextRound}
              continueLabel={game.phase === 'matchEnd' ? 'Play another day' : game.result.winner === null ? 'Replay with same opener' : `${names[game.result.winner]} opens next round`}
            />}
          </div>

          <div className="hand-zone">
            <div className="hand-heading"><div><span className="eyebrow">Your hand</span><strong>{game.phase === 'playing' ? game.current === 0 ? legalMoves.length ? 'Choose a tile to play' : 'You have to pass' : 'Watch the table' : 'Tiles will appear after the deal'}</strong></div><span>{game.hands[0].length} tiles</span></div>
            <div className={`hand-rack ${game.hands[0].length === 0 ? 'empty' : ''}`}>{game.hands[0].map((tile) => <Domino key={tile.id} tile={tile} selected={selectedId === tile.id} disabled={game.phase !== 'playing' || game.current !== 0 || !playableIds.has(tile.id) || coach.kind === 'feedback' || isAnalyzing} onClick={() => { setSelectedId(tile.id); if (coach.kind !== 'hint') setCoach({ kind: 'turn' }); }} />)}</div>
          </div>
        </section>

        <aside className={`coach-panel coach-${coach.kind}`}>
          <div className="coach-heading"><span className="coach-icon">◎</span><div><span className="eyebrow">Mesa coach</span><h2>{coach.kind === 'feedback' ? 'Move review' : 'Read the table'}</h2></div></div>

          {game.phase === 'playing' && <div className="read-card belief-card">
            <span className="read-label">Belief tracker</span>
            {beliefs.map((belief) => <div className="belief-player" key={belief.player}>
              <div className="belief-name"><span className={`avatar p${belief.player}`}>{names[belief.player][0]}</span><b>{names[belief.player]}</b></div>
              <div className="belief-lines">
                {belief.certainOut.length > 0
                  ? <p><strong>Certain no:</strong> {belief.certainOut.join(', ')}</p>
                  : <p><strong>Certain:</strong> nothing yet</p>}
                {belief.softReads.map((read) => <p className={`soft-read ${read.strength}`} key={`${read.direction}-${read.value}`}>
                  <strong>{read.strength === 'moderate' ? 'Likely' : 'Weak read'}:</strong> {read.direction === 'less' ? `${read.value} is less likely` : `${read.value} is more likely`} <em>({Math.round(read.probability * 100)}% chance of holding one)</em>
                </p>)}
                {belief.softReads.length === 0 && <p><strong>Other values:</strong> unknown</p>}
              </div>
            </div>)}
            {analysisBeliefState && <div className={`belief-quality ${analysisBeliefState.diagnostics.confidence}`}>
              <span><i /> {analysisBeliefState.diagnostics.confidence === 'high' ? 'Stable' : analysisBeliefState.diagnostics.confidence === 'moderate' ? 'Moderate' : 'Thin'} particle pool</span>
              <b>{Math.round(analysisBeliefState.diagnostics.effectiveSamples)} effective / {analysisBeliefState.diagnostics.particleCount}</b>
            </div>}
            <small>The same plausible deals persist across turns. Passes eliminate impossible deals; tile choices change their weights. Historical calibration lowers confidence when claimed probabilities have missed too often.</small>
          </div>}

          {game.phase === 'playing' && analysisStyleProfiles.some((style) => style.observedChoices > 0) && <div className="read-card style-card">
            <span className="read-label">Playing-style tracker</span>
            {analysisStyleProfiles.map((style) => <div className="style-player" key={style.player}>
              <div><b>{names[style.player]} · {opponentArchetype(style)}</b><small>{style.observedChoices} useful choice{style.observedChoices === 1 ? '' : 's'} · {style.confidence} confidence</small></div>
              <p>{describeOpponentStyle(style).join(' · ')}</p>
            </div>)}
            <small>These are tendencies, not certainties. Historical calibration automatically shrinks their influence toward neutral when predictions have been inaccurate.</small>
          </div>}

          {coach.kind === 'intro' && <div className="coach-copy"><span className="eyebrow">Your exact house rules</span><h3>Three players. Ten tiles each. <b>Twenty-five sleep.</b></h3><p>The coach will judge decisions without peeking at the two hidden hands or the sleeping tiles.</p></div>}
          {coach.kind === 'watching' && <div className="coach-copy"><span className="eyebrow">Table update</span><h3>{coach.message}</h3><p>Watch the ends and notice which numbers cause a pass.</p></div>}
          {coach.kind === 'turn' && <div className="coach-copy"><span className="eyebrow">Your decision</span><h3>{selectedId ? `You selected the ${selectedId.replace('-', '–')}` : coach.message ?? 'What are the opponents telling you?'}</h3><p>{selectedId ? 'Choose which end to play it on, then I’ll evaluate the decision.' : 'Count the open numbers, remember the passes, and choose a tile.'}</p></div>}
          {coach.kind === 'hint' && <div className="coach-copy hint-copy"><span className="eyebrow">A useful hint</span><h3>{coach.title}</h3><p>{coach.body}</p><small>{coach.confidence}</small></div>}
          {coach.kind === 'feedback' && <div className={`feedback-card ${coach.tone}`}><span className="feedback-rating">{coach.rating}</span><h3>{coach.title}</h3><p>{coach.body}</p>{coach.evidence && <div className="live-evidence"><p><b>Known</b>{coach.evidence.known}</p><p><b>Inferred</b>{coach.evidence.inferred}</p><p><b>Simulated</b>{coach.evidence.simulated}</p><p><b>Uncertain</b>{coach.evidence.uncertain}</p></div>}<small>{coach.stat}</small></div>}
          {(game.phase === 'roundEnd' || game.phase === 'matchEnd') && roundReview && <div className="coach-copy round-ready"><span className="eyebrow">Round report ready</span><h3>{roundReview.biggestMistake ? 'There is one decision worth studying.' : 'No confident mistake was found.'}</h3><p>The review separates what was known, inferred, simulated, and revealed afterward.</p><button className="hint-button" type="button" onClick={() => setReviewOpen(true)}>Open round review</button></div>}

          {game.phase === 'playing' && game.current === 0 && coach.kind !== 'feedback' && <div className="decision-actions">
            {selectedMoves.map((move) => <button className="play-button" disabled={isAnalyzing} key={`${move.tile.id}-${move.side}`} type="button" onClick={() => playUserMove(move)}>{isAnalyzing ? 'Analyzing this decision…' : game.chain.length ? `Play on ${move.side} · ${move.side === 'left' ? leftEnd : rightEnd}` : `Open with ${move.tile.a}–${move.tile.b}`}<span>→</span></button>)}
            {!legalMoves.length && <button className="pass-button" type="button" onClick={passUser}>Pass — no legal tile <span>→</span></button>}
            {legalMoves.length > 0 && <button className="hint-button" disabled={isAnalyzing} type="button" onClick={showHint}>{isAnalyzing ? 'Running paired simulations…' : 'Give me a hint'}</button>}
          </div>}
          {coach.kind === 'feedback' && game.phase === 'playing' && <button className="play-button continue-button" type="button" onClick={continueAfterFeedback}>Continue <span>→</span></button>}

          <div className="opponent-level" aria-label="Opponent difficulty">
            <span>Opponent level</span>
            <div><button className={difficulty === 'casual' ? 'active' : ''} type="button" onClick={() => setDifficulty('casual')}>Casual</button><button className={difficulty === 'strong' ? 'active' : ''} type="button" onClick={() => setDifficulty('strong')}>Strong</button></div>
          </div>
          <div className="coach-footer"><span>Coach method</span><b><i /> 900 beliefs + ISMCTS</b></div>
        </aside>
      </section>
      {trainingOpen && <TrainingCenter progress={trainingProgress} onStartDrill={startTargetedDrill} onExport={exportTrainingData} onClose={() => setTrainingOpen(false)} />}
      {practiceState && <PracticeOverlay practice={practiceState} onChoose={choosePracticeMove} onRetry={retryPractice} onClose={() => setPracticeState(null)} />}
    </main>
  );
}

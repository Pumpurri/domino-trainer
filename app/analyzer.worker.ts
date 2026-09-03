import {
  analyzeMoves,
  type BeliefState,
  type AnalysisOptions,
  type Game,
  type OpponentStyleProfile,
  type RatedMove,
} from './domino-engine';

type AnalyzeRequest = {
  id: number;
  game: Game;
  sampleCount: number;
  beliefState?: BeliefState;
  styles?: OpponentStyleProfile[];
  options?: AnalysisOptions;
};

type AnalyzeResponse = {
  id: number;
  ranked?: RatedMove[];
  error?: string;
};

type AnalyzerWorkerScope = {
  onmessage: ((event: MessageEvent<AnalyzeRequest>) => void) | null;
  postMessage: (message: AnalyzeResponse) => void;
};

const workerScope = self as unknown as AnalyzerWorkerScope;

workerScope.onmessage = (event: MessageEvent<AnalyzeRequest>) => {
  const { id, game, sampleCount, beliefState, styles, options } = event.data;
  try {
    workerScope.postMessage({
      id,
      ranked: analyzeMoves(game, sampleCount, beliefState, styles, options),
    } satisfies AnalyzeResponse);
  } catch (error) {
    workerScope.postMessage({
      id,
      error: error instanceof Error ? error.message : 'The analyzer could not complete this decision.',
    } satisfies AnalyzeResponse);
  }
};

export {};

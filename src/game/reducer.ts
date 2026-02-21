import { GameState } from './types';
import { GameAction } from './actions';
import {
  createInitialGameState,
  startGame,
  selectRole,
  executeBuild,
  executeProduction,
  executeTrade,
  executeCouncillor,
  executeChapel,
  advanceToNextPlayer,
  markPlayerCompleted,
} from './engine';

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const s = createInitialGameState();
      return startGame(s);
    }

    case 'RESTART_GAME': {
      const s = createInitialGameState();
      return startGame(s);
    }

    case 'SELECT_ROLE': {
      return selectRole(state, action.role);
    }

    case 'BUILD': {
      let s = executeBuild(
        state,
        state.executingPlayerIndex,
        action.cardInstanceId,
        action.paymentCardIds,
        action.craneTargetIndex,
        action.blackMarketGoods
      );
      s = markPlayerCompleted(s, state.executingPlayerIndex);
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'SKIP_BUILD': {
      let s = markPlayerCompleted(state, state.executingPlayerIndex);
      s = {
        ...s,
        log: [
          ...s.log,
          `${s.players[state.executingPlayerIndex].name}は建築をパス`,
        ],
      };
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'PRODUCE': {
      let s = executeProduction(
        state,
        state.executingPlayerIndex,
        action.buildingIndices
      );
      s = markPlayerCompleted(s, state.executingPlayerIndex);
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'SKIP_PRODUCE': {
      let s = markPlayerCompleted(state, state.executingPlayerIndex);
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'TRADE': {
      let s = executeTrade(
        state,
        state.executingPlayerIndex,
        action.buildingIndices
      );
      s = markPlayerCompleted(s, state.executingPlayerIndex);
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'SKIP_TRADE': {
      let s = markPlayerCompleted(state, state.executingPlayerIndex);
      s = {
        ...s,
        log: [
          ...s.log,
          `${s.players[state.executingPlayerIndex].name}は売却をパス`,
        ],
      };
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'COUNCILLOR_KEEP': {
      let s = executeCouncillor(
        state,
        state.executingPlayerIndex,
        action.cardInstanceIds
      );
      s = markPlayerCompleted(s, state.executingPlayerIndex);
      s = advanceToNextPlayer(s);
      return s;
    }

    case 'USE_CHAPEL': {
      return executeChapel(
        state,
        state.executingPlayerIndex,
        action.cardInstanceId
      );
    }

    case 'SKIP_CHAPEL': {
      return state;
    }

    case 'ADVANCE': {
      // AI自動進行用 - 現在のフェーズに応じて処理
      return state;
    }

    default:
      return state;
  }
}

export function createInitialState(): GameState {
  return {
    ...createInitialGameState(),
    phase: 'title',
  };
}

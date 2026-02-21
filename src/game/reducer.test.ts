import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, createInitialState } from './reducer';
import { Building, Card } from './types';
import { resetInstanceIdCounter } from './utils';

beforeEach(() => {
  resetInstanceIdCounter();
});

function makeCard(defId: string, instanceId?: number): Card {
  return { instanceId: instanceId ?? Math.floor(Math.random() * 100000), defId };
}

function makeBuilding(defId: string, good: Building['good'] = null, chapelCards = 0): Building {
  return { card: makeCard(defId), good, chapelCards };
}

describe('createInitialState', () => {
  it('starts in title phase', () => {
    const state = createInitialState();
    expect(state.phase).toBe('title');
  });

  it('has 4 players', () => {
    const state = createInitialState();
    expect(state.players.length).toBe(4);
  });
});

describe('gameReducer', () => {
  describe('START_GAME', () => {
    it('transitions from title to role_selection', () => {
      const state = createInitialState();
      const result = gameReducer(state, { type: 'START_GAME' });
      expect(result.phase).toBe('role_selection');
    });
  });

  describe('RESTART_GAME', () => {
    it('creates a fresh game state', () => {
      const state = createInitialState();
      const started = gameReducer(state, { type: 'START_GAME' });
      const restarted = gameReducer(started, { type: 'RESTART_GAME' });
      expect(restarted.phase).toBe('role_selection');
      expect(restarted.log).toContain('ゲーム開始！');
    });
  });

  describe('SELECT_ROLE', () => {
    it('transitions to the appropriate phase', () => {
      const state = gameReducer(createInitialState(), { type: 'START_GAME' });
      const result = gameReducer(state, { type: 'SELECT_ROLE', role: 'builder' });
      expect(result.phase).toBe('builder_phase');
      expect(result.currentRole).toBe('builder');
    });
  });

  describe('SKIP_BUILD', () => {
    it('marks player completed and advances', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      state = gameReducer(state, { type: 'SELECT_ROLE', role: 'builder' });
      const beforeIdx = state.executingPlayerIndex;
      const result = gameReducer(state, { type: 'SKIP_BUILD' });
      // Should advance to next player
      expect(result.executingPlayerIndex).not.toBe(beforeIdx);
    });
  });

  describe('SKIP_TRADE', () => {
    it('adds skip log message', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      state = gameReducer(state, { type: 'SELECT_ROLE', role: 'trader' });
      const result = gameReducer(state, { type: 'SKIP_TRADE' });
      expect(result.log.some((l) => l.includes('パス'))).toBe(true);
    });
  });

  describe('USE_CHAPEL', () => {
    it('stores card and advances chapel phase', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      // Manually set up chapel phase state
      const cardToTuck = makeCard('sugar_mill', 9999);
      state = {
        ...state,
        phase: 'chapel_phase',
        subPhase: 'chapel_tuck',
        executingPlayerIndex: 0,
        players: state.players.map((p, i) =>
          i === 0
            ? {
                ...p,
                hand: [cardToTuck, makeCard('indigo_plant', 9998)],
                buildings: [...p.buildings, makeBuilding('chapel')],
              }
            : p
        ),
      };

      const result = gameReducer(state, {
        type: 'USE_CHAPEL',
        cardInstanceId: 9999,
      });
      // Card should be removed from hand
      expect(result.players[0].hand.length).toBe(1);
      // Chapel should have 1 stored card
      const chapel = result.players[0].buildings.find(
        (b) => b.card.defId === 'chapel'
      );
      expect(chapel?.chapelCards).toBe(1);
    });
  });

  describe('SKIP_CHAPEL', () => {
    it('advances chapel phase without storing', () => {
      let state = gameReducer(createInitialState(), { type: 'START_GAME' });
      state = {
        ...state,
        phase: 'chapel_phase',
        subPhase: 'chapel_tuck',
        executingPlayerIndex: 0,
        players: state.players.map((p, i) =>
          i === 0
            ? {
                ...p,
                hand: [makeCard('sugar_mill', 9999)],
                buildings: [...p.buildings, makeBuilding('chapel')],
              }
            : p
        ),
      };

      const result = gameReducer(state, { type: 'SKIP_CHAPEL' });
      // Hand should remain unchanged
      expect(result.players[0].hand.length).toBe(1);
    });
  });

  describe('ADVANCE', () => {
    it('returns state unchanged', () => {
      const state = createInitialState();
      const result = gameReducer(state, { type: 'ADVANCE' });
      expect(result).toBe(state);
    });
  });

  describe('default', () => {
    it('returns state for unknown action', () => {
      const state = createInitialState();
      // @ts-expect-error testing unknown action
      const result = gameReducer(state, { type: 'UNKNOWN' });
      expect(result).toBe(state);
    });
  });
});

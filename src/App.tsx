import React, { useReducer, useEffect, useRef } from 'react';
import './App.css';
import { GameState, RoleType, ROLE_NAMES } from './game/types';
import { GameAction } from './game/actions';
import { gameReducer, createInitialState } from './game/reducer';
import {
  getProducibleBuildings,
  getSellableGoods,
  getCouncillorKeepCount,
  canBuild,
  getBuildCost,
  getMaxSellCount,
  getMaxProductionCount,
} from './game/engine';
import {
  aiSelectRole,
  aiDecideBuild,
  aiDecideProduction,
  aiDecideTrade,
  aiDecideCouncillor,
} from './game/ai';
import { getCardDef } from './game/utils';
import { CardView } from './components/CardView';
import { ScoreBoard } from './components/ScoreBoard';

function App() {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);

  const timerRef = useRef<number | null>(null);

  // AI自動進行
  useEffect(() => {
    if (state.phase === 'title' || state.phase === 'game_over') return;

    const isRoleSelection = state.phase === 'role_selection';

    // 役職選択フェーズでAIの番
    if (isRoleSelection) {
      const selector = state.players[state.currentRoleSelector];
      if (!selector.isHuman) {
        timerRef.current = window.setTimeout(() => {
          const role = aiSelectRole(state, selector.id);
          dispatch({ type: 'SELECT_ROLE', role });
        }, 400);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
      }
      return;
    }

    // 役職実行フェーズでAIの番
    const currentPlayer = state.players[state.executingPlayerIndex];
    if (!currentPlayer.isHuman && state.currentRole) {
      timerRef.current = window.setTimeout(() => {
        executeAIAction(state, currentPlayer.id, dispatch);
      }, 300);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, [state.phase, state.executingPlayerIndex, state.currentRoleSelector, state.currentRole, state.subPhase]);

  if (state.phase === 'title') {
    return (
      <div className="title-screen">
        <h1>San Juan</h1>
        <p>サンファン - カードゲーム</p>
        <button onClick={() => dispatch({ type: 'START_GAME' })}>
          ゲーム開始
        </button>
      </div>
    );
  }

  if (state.phase === 'game_over') {
    return (
      <ScoreBoard
        state={state}
        onRestart={() => dispatch({ type: 'RESTART_GAME' })}
      />
    );
  }

  const humanPlayer = state.players[0];
  const opponents = state.players.slice(1);
  const currentPlayer = state.players[state.executingPlayerIndex];

  return (
    <div className="game-board">
      {/* Phase Indicator */}
      <div className="phase-indicator">
        {state.currentRole && (
          <span className="phase-tag">{ROLE_NAMES[state.currentRole]}</span>
        )}
        {state.phase === 'role_selection' && (
          <span className="phase-tag">役職選択</span>
        )}
        <span className="governor-tag">
          総督: {state.players[state.governorIndex].name}
        </span>
        <span>
          手番: {state.phase === 'role_selection'
            ? state.players[state.currentRoleSelector].name
            : currentPlayer.name}
        </span>
        <span className="deck-info">
          山札: {state.deck.length}
        </span>
      </div>

      <div className="game-main">
        <div className="game-content">
          {/* Opponents */}
          <div className="opponents-row">
            {opponents.map((p) => (
              <div
                key={p.id}
                className={`opponent-area ${(state.phase === 'role_selection' ? state.currentRoleSelector : state.executingPlayerIndex) === p.id ? 'is-active' : ''}`}
              >
                <div className="opponent-header">
                  <span className="name">{p.name}</span>
                  {state.governorIndex === p.id && (
                    <span className="governor-badge">★</span>
                  )}
                  <span className="hand-count">
                    手札{p.hand.length} 建物{p.buildings.length}
                  </span>
                </div>
                <div className="opponent-buildings">
                  {p.buildings.map((b) => (
                    <CardView
                      key={b.card.instanceId}
                      card={b.card}
                      size="xs"
                      good={b.good}
                      chapelCards={b.chapelCards}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Player Area */}
          <div className="player-section">
            <div className="player-header">
              <span className="name">{humanPlayer.name}</span>
              {state.governorIndex === 0 && (
                <span className="governor-badge">★ 総督</span>
              )}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                建物: {humanPlayer.buildings.length}/12
              </span>
            </div>

            <div className="player-buildings-label">建物</div>
            <div className="player-buildings">
              {humanPlayer.buildings.map((b) => (
                <CardView
                  key={b.card.instanceId}
                  card={b.card}
                  size="small"
                  good={b.good}
                  chapelCards={b.chapelCards}
                />
              ))}
            </div>

            <div className="player-hand-label">手札 ({humanPlayer.hand.length})</div>
            <div className="player-hand">
              {humanPlayer.hand.map((c) => (
                <CardView key={c.instanceId} card={c} size="normal" />
              ))}
            </div>
          </div>

          {/* Action Panel */}
          <ActionPanel state={state} dispatch={dispatch} />
        </div>

        {/* Game Log */}
        <div className="game-log">
          <h4>ログ</h4>
          {[...state.log].reverse().map((entry, i) => (
            <div
              key={i}
              className={`log-entry ${entry.startsWith('---') || entry.startsWith('===') ? 'separator' : ''}`}
            >
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// AI Action Execution
function executeAIAction(
  state: GameState,
  playerId: number,
  dispatch: React.Dispatch<GameAction>
) {
  const role = state.currentRole;
  if (!role) return;

  switch (role) {
    case 'builder': {
      const decision = aiDecideBuild(state, playerId);
      if (decision) {
        dispatch({
          type: 'BUILD',
          cardInstanceId: decision.cardInstanceId,
          paymentCardIds: decision.paymentCardIds,
          craneTargetIndex: decision.craneTargetIndex,
          blackMarketGoods: decision.blackMarketGoods,
        });
      } else {
        dispatch({ type: 'SKIP_BUILD' });
      }
      break;
    }
    case 'producer': {
      const indices = aiDecideProduction(state, playerId);
      if (indices.length > 0) {
        dispatch({ type: 'PRODUCE', buildingIndices: indices });
      } else {
        dispatch({ type: 'SKIP_PRODUCE' });
      }
      break;
    }
    case 'trader': {
      const indices = aiDecideTrade(state, playerId);
      if (indices.length > 0) {
        dispatch({ type: 'TRADE', buildingIndices: indices });
      } else {
        dispatch({ type: 'SKIP_TRADE' });
      }
      break;
    }
    case 'councillor': {
      const keptIds = aiDecideCouncillor(state, playerId);
      dispatch({ type: 'COUNCILLOR_KEEP', cardInstanceIds: keptIds });
      break;
    }
    case 'prospector': {
      // Prospector is auto-resolved in the reducer via advanceToNextPlayer
      dispatch({ type: 'SKIP_BUILD' }); // Just advance
      break;
    }
  }
}

// Action Panel Component
function ActionPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  // 役職選択フェーズ
  if (state.phase === 'role_selection') {
    const selector = state.players[state.currentRoleSelector];
    if (selector.isHuman) {
      return <RoleSelectionPanel state={state} dispatch={dispatch} />;
    }
    return (
      <div className="action-panel">
        <div className="ai-thinking">
          {selector.name} が役職を選択中<span className="dots"></span>
        </div>
      </div>
    );
  }

  const currentPlayer = state.players[state.executingPlayerIndex];
  const isHumanTurn = currentPlayer.isHuman;

  // AI思考中
  if (!isHumanTurn) {
    return (
      <div className="action-panel">
        <div className="ai-thinking">
          {currentPlayer.name} が考え中<span className="dots"></span>
        </div>
      </div>
    );
  }

  // 各フェーズ (人間の番)
  switch (state.currentRole) {
    case 'builder':
      return <BuilderPanel state={state} dispatch={dispatch} />;
    case 'producer':
      return <ProducerPanel state={state} dispatch={dispatch} />;
    case 'trader':
      return <TraderPanel state={state} dispatch={dispatch} />;
    case 'councillor':
      return <CouncillorPanel state={state} dispatch={dispatch} />;
    default:
      return null;
  }
}

// Role Selection
function RoleSelectionPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const roles: { role: RoleType; desc: string; privilege: string }[] = [
    { role: 'builder', desc: '全員が建物を1つ建設可能', privilege: 'コスト-1' },
    { role: 'producer', desc: '全員が商品を生産', privilege: '追加1個生産' },
    { role: 'trader', desc: '全員が商品を1つ売却可能', privilege: '売却額+1' },
    { role: 'councillor', desc: '全員がカードを引いて選択', privilege: '5枚引いて1枚選択' },
    { role: 'prospector', desc: '選択者のみ1枚ドロー', privilege: '1枚ドロー' },
  ];

  return (
    <div className="action-panel">
      <h3>役職を選択してください</h3>
      <div className="role-selection">
        {roles.map(({ role, desc, privilege }) => (
          <button
            key={role}
            className="role-btn"
            disabled={state.usedRoles.includes(role)}
            onClick={() => dispatch({ type: 'SELECT_ROLE', role })}
          >
            <span className="role-name">{ROLE_NAMES[role]}</span>
            <span className="role-desc">{desc}</span>
            <span className="role-privilege">{privilege}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Builder Phase
function BuilderPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[0];
  const [selectedBuild, setSelectedBuild] = React.useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = React.useState<Set<number>>(new Set());

  // 建設カード選択
  if (selectedBuild === null) {
    const buildable = player.hand.filter((c) =>
      canBuild(state, 0, c.instanceId)
    );

    return (
      <div className="action-panel">
        <h3>建築士 - 建設するカードを選択</h3>
        <p>
          {state.roleChooser === 0 ? '特権: コスト-1' : ''}
        </p>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
          {player.hand.map((c) => {
            const def = getCardDef(c);
            const canBuildThis = buildable.some((b) => b.instanceId === c.instanceId);
            const cost = getBuildCost(state, 0, def.id);
            return (
              <div key={c.instanceId} style={{ position: 'relative' }}>
                <CardView
                  card={c}
                  size="normal"
                  clickable={canBuildThis}
                  disabled={!canBuildThis}
                  onClick={() => canBuildThis && setSelectedBuild(c.instanceId)}
                />
                {canBuildThis && (
                  <div style={{
                    position: 'absolute', bottom: '-2px', left: '50%', transform: 'translateX(-50%)',
                    fontSize: '0.65rem', color: 'var(--color-gold)', background: 'rgba(0,0,0,0.8)',
                    padding: '0 4px', borderRadius: '3px', whiteSpace: 'nowrap'
                  }}>
                    コスト:{cost}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="action-buttons">
          <button className="skip" onClick={() => dispatch({ type: 'SKIP_BUILD' })}>
            パス
          </button>
        </div>
      </div>
    );
  }

  // 支払いカード選択
  const buildCard = player.hand.find((c) => c.instanceId === selectedBuild)!;
  const buildDef = getCardDef(buildCard);
  const cost = getBuildCost(state, 0, buildDef.id);
  const payableCards = player.hand.filter((c) => c.instanceId !== selectedBuild);

  const togglePayment = (id: number) => {
    const next = new Set(selectedPayment);
    if (next.has(id)) next.delete(id);
    else if (next.size < cost) next.add(id);
    setSelectedPayment(next);
  };

  return (
    <div className="action-panel">
      <h3>建築士 - {buildDef.name} の支払い (コスト: {cost})</h3>
      <p>支払うカードを{cost}枚選択してください</p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {payableCards.map((c) => (
          <CardView
            key={c.instanceId}
            card={c}
            size="normal"
            clickable
            selected={selectedPayment.has(c.instanceId)}
            onClick={() => togglePayment(c.instanceId)}
          />
        ))}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selectedPayment.size !== cost}
          onClick={() => {
            dispatch({
              type: 'BUILD',
              cardInstanceId: selectedBuild,
              paymentCardIds: Array.from(selectedPayment),
            });
            setSelectedBuild(null);
            setSelectedPayment(new Set());
          }}
        >
          建設 ({selectedPayment.size}/{cost})
        </button>
        <button onClick={() => { setSelectedBuild(null); setSelectedPayment(new Set()); }}>
          戻る
        </button>
        <button className="skip" onClick={() => {
          setSelectedBuild(null);
          setSelectedPayment(new Set());
          dispatch({ type: 'SKIP_BUILD' });
        }}>
          パス
        </button>
      </div>
    </div>
  );
}

// Producer Phase
function ProducerPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[0];
  const producible = getProducibleBuildings(state, 0);
  const maxSlots = getMaxProductionCount(state, 0);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  if (producible.length === 0) {
    return (
      <div className="action-panel">
        <h3>監督 - 生産</h3>
        <p>生産可能な空き建物がありません。</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'PRODUCE', buildingIndices: [] })}>
            OK
          </button>
        </div>
      </div>
    );
  }

  // 選択可能数が1で空きスロットも1なら自動選択
  if (maxSlots >= producible.length) {
    return (
      <div className="action-panel">
        <h3>監督 - 全ての空き生産建物に商品が載ります</h3>
        {state.roleChooser === 0 && <p>特権: 追加1個生産</p>}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
          {producible.map((idx) => {
            const b = player.buildings[idx];
            return (
              <CardView key={b.card.instanceId} card={b.card} size="small" />
            );
          })}
        </div>
        <div className="action-buttons">
          <button
            className="primary"
            onClick={() => dispatch({ type: 'PRODUCE', buildingIndices: producible })}
          >
            生産する
          </button>
        </div>
      </div>
    );
  }

  const toggleBuilding = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else if (next.size < maxSlots) next.add(idx);
    setSelected(next);
  };

  return (
    <div className="action-panel">
      <h3>監督 - 生産する建物を{maxSlots}個選択</h3>
      {state.roleChooser === 0 && <p>特権: 追加1個生産</p>}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {producible.map((idx) => {
          const b = player.buildings[idx];
          return (
            <CardView
              key={b.card.instanceId}
              card={b.card}
              size="small"
              clickable
              selected={selected.has(idx)}
              onClick={() => toggleBuilding(idx)}
            />
          );
        })}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selected.size === 0}
          onClick={() => {
            dispatch({ type: 'PRODUCE', buildingIndices: Array.from(selected) });
            setSelected(new Set());
          }}
        >
          生産する ({selected.size}/{maxSlots})
        </button>
      </div>
    </div>
  );
}

// Trader Phase
function TraderPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const player = state.players[0];
  const goods = getSellableGoods(state, 0);
  const maxSell = getMaxSellCount(state, 0);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  if (goods.length === 0) {
    return (
      <div className="action-panel">
        <h3>商人 - 売却</h3>
        <p>売却可能な商品がありません。</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'SKIP_TRADE' })}>OK</button>
        </div>
      </div>
    );
  }

  const toggleGood = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else if (next.size < maxSell) next.add(idx);
    setSelected(next);
  };

  return (
    <div className="action-panel">
      <h3>商人 - 売却する商品を選択 (最大{maxSell}個)</h3>
      {state.roleChooser === 0 && <p>特権: 売却額+1カード</p>}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
        {goods.map((g) => {
          const b = player.buildings[g.buildingIndex];
          return (
            <CardView
              key={b.card.instanceId}
              card={b.card}
              size="small"
              good={g.goodType}
              clickable
              selected={selected.has(g.buildingIndex)}
              onClick={() => toggleGood(g.buildingIndex)}
            />
          );
        })}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selected.size === 0}
          onClick={() => {
            dispatch({ type: 'TRADE', buildingIndices: Array.from(selected) });
            setSelected(new Set());
          }}
        >
          売却 ({selected.size}個)
        </button>
        <button className="skip" onClick={() => {
          setSelected(new Set());
          dispatch({ type: 'SKIP_TRADE' });
        }}>
          パス
        </button>
      </div>
    </div>
  );
}

// Councillor Phase
function CouncillorPanel({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const rawKeepCount = getCouncillorKeepCount(state, 0);
  const keepCount = Math.min(rawKeepCount, state.drawnCards.length);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const toggleCard = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < keepCount) next.add(id);
    setSelected(next);
  };

  if (state.drawnCards.length === 0) {
    return (
      <div className="action-panel">
        <h3>参事会員</h3>
        <p>山札がありません。</p>
        <div className="action-buttons">
          <button onClick={() => dispatch({ type: 'COUNCILLOR_KEEP', cardInstanceIds: [] })}>
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="action-panel">
      <h3>
        参事会員 - {state.drawnCards.length}枚から{keepCount}枚選択
      </h3>
      {state.roleChooser === 0 && <p>特権: 5枚引いて選択</p>}
      <div className="councillor-cards">
        {state.drawnCards.map((c) => (
          <CardView
            key={c.instanceId}
            card={c}
            size="normal"
            clickable
            selected={selected.has(c.instanceId)}
            onClick={() => toggleCard(c.instanceId)}
          />
        ))}
      </div>
      <div className="action-buttons">
        <button
          className="primary"
          disabled={selected.size !== keepCount}
          onClick={() => {
            dispatch({
              type: 'COUNCILLOR_KEEP',
              cardInstanceIds: Array.from(selected),
            });
            setSelected(new Set());
          }}
        >
          選択 ({selected.size}/{keepCount})
        </button>
      </div>
    </div>
  );
}

export default App;

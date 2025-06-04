import React, { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { RoleType } from '../types/game';
import PlayerArea from './PlayerArea';
import RoleSelection from './RoleSelection';

const Game: React.FC = () => {
  const { gameState, selectRole, buildBuilding, nextRoleExecution } = useGame();
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [buildingToBuild, setBuildingToBuild] = useState<string | null>(null);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const humanPlayer = gameState.players.find(p => p.isHuman);

  const handleRoleSelect = (role: RoleType) => {
    selectRole(role);
  };

  const handleCardClick = (cardId: string) => {
    if (gameState.phase === 'role-execution' && gameState.currentRole === 'builder') {
      if (buildingToBuild === cardId) {
        setBuildingToBuild(null);
      } else {
        setBuildingToBuild(cardId);
        setSelectedCards([]);
      }
    } else {
      if (selectedCards.includes(cardId)) {
        setSelectedCards(selectedCards.filter(id => id !== cardId));
      } else {
        setSelectedCards([...selectedCards, cardId]);
      }
    }
  };

  const handleBuild = () => {
    if (!buildingToBuild || !humanPlayer) return;
    
    const buildingCard = humanPlayer.hand.find(card => card.id === buildingToBuild);
    const costCards = selectedCards.map(id => humanPlayer.hand.find(card => card.id === id)!).filter(Boolean);
    
    if (buildingCard) {
      buildBuilding(humanPlayer.id, buildingCard, costCards);
      setBuildingToBuild(null);
      setSelectedCards([]);
      nextRoleExecution();
    }
  };

  const handleSkip = () => {
    nextRoleExecution();
  };

  const renderCurrentAction = () => {
    if (gameState.phase === 'role-selection') {
      return (
        <RoleSelection
          availableRoles={gameState.availableRoles}
          onRoleSelect={handleRoleSelect}
          currentPlayer={currentPlayer.name}
        />
      );
    }

    if (gameState.phase === 'role-execution') {
      const executingPlayer = gameState.players[gameState.currentExecutingPlayer];
      const rolePlayer = gameState.players[gameState.currentRolePlayer];
      
      return (
        <div className="role-execution">
          <h3 className="role-execution-title">
            {gameState.currentRole === 'builder' && '建築士'}
            {gameState.currentRole === 'producer' && '監督'}
            {gameState.currentRole === 'trader' && '商人'}
            {gameState.currentRole === 'councilor' && '参事会議員'}
            {gameState.currentRole === 'prospector' && '金鉱掘り'}
            の処理
          </h3>
          <p className="role-execution-info">
            {rolePlayer.name}が選択 → {executingPlayer.name}の番
          </p>

          {executingPlayer.isHuman && gameState.currentRole === 'builder' && (
            <div className="action-section">
              <h4 className="action-title">建設する建物を選択:</h4>
              {buildingToBuild && (
                <div>
                  <p className="action-description">コストカードを選択:</p>
                  <div className="action-buttons">
                    <button
                      onClick={handleBuild}
                      className="btn btn-success"
                      disabled={!buildingToBuild}
                    >
                      建設
                    </button>
                    <button
                      onClick={handleSkip}
                      className="btn btn-secondary"
                    >
                      スキップ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {executingPlayer.isHuman && gameState.currentRole !== 'builder' && (
            <div className="action-center">
              <button
                onClick={handleSkip}
                className="btn btn-primary"
              >
                次へ
              </button>
            </div>
          )}

          {!executingPlayer.isHuman && (
            <div className="action-center">
              <p className="action-description">CPUが処理中...</p>
              <button
                onClick={handleSkip}
                className="btn btn-primary"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="game-container">
      <div className="game-content">
        <h1 className="game-title">サンファン</h1>
        
        {/* ゲーム情報 */}
        <div className="game-info">
          <div className="game-info-stats">
            <span>ラウンド: {gameState.currentRound}</span>
            <span>ターン: {gameState.currentTurn}</span>
            <span>山札: {gameState.deck.length}枚</span>
          </div>
        </div>

        {/* CPU プレイヤーエリア */}
        <div className="cpu-players">
          {gameState.players.filter((p: any) => !p.isHuman).map((player: any) => (
            <PlayerArea
              key={player.id}
              player={player}
              isCurrentPlayer={gameState.currentPlayerIndex === gameState.players.indexOf(player)}
            />
          ))}
        </div>

        {/* 中央エリア */}
        <div className="central-area">
          {renderCurrentAction()}
        </div>

        {/* ゲームログ */}
        <div className="game-log">
          <h4>ゲームログ</h4>
          {gameState.gameLog.slice(-10).map((log: string, index: number) => (
            <div key={index} className="game-log-entry">
              {log}
            </div>
          ))}
        </div>

        {/* 人間プレイヤーエリア */}
        {humanPlayer && (
          <PlayerArea
            player={humanPlayer}
            isCurrentPlayer={gameState.currentPlayerIndex === gameState.players.indexOf(humanPlayer)}
            isHuman={true}
            onCardClick={handleCardClick}
            selectedCards={buildingToBuild ? [buildingToBuild, ...selectedCards] : selectedCards}
          />
        )}
      </div>
    </div>
  );
};

export default Game;
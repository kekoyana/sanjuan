import React, { useState, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { RoleType } from '../types/game';
import PlayerArea from './PlayerArea';
import RoleSelection from './RoleSelection';

const Game: React.FC = () => {
  const {
    gameState,
    selectRole,
    buildBuilding,
    produceGoods,
    sellGoods,
    drawCouncilorCards,
    selectCouncilorCards,
    prospectorDrawCard,
    revealTradingPost,
    cpuSelectRole,
    cpuExecuteAction,
    nextRoleExecution
  } = useGame();
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [buildingToBuild, setBuildingToBuild] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedCouncilorCards, setSelectedCouncilorCards] = useState<string[]>([]);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const humanPlayer = gameState.players.find(p => p.isHuman);

  // CPUの自動処理
  useEffect(() => {
    if (!currentPlayer.isHuman) {
      const timer = setTimeout(() => {
        if (gameState.phase === 'role-selection') {
          cpuSelectRole(currentPlayer.id);
        } else if (gameState.phase === 'role-execution') {
          const executingPlayer = gameState.players[gameState.currentExecutingPlayer];
          if (!executingPlayer.isHuman) {
            cpuExecuteAction(executingPlayer.id);
            // CPU行動後、次のプレイヤーに移行
            setTimeout(() => {
              nextRoleExecution();
            }, 1000);
          }
        }
      }, 1500); // 1.5秒後に自動実行

      return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.currentExecutingPlayer, currentPlayer.isHuman, cpuSelectRole, cpuExecuteAction, nextRoleExecution]);

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

  const handleProduce = () => {
    if (!humanPlayer) return;
    
    const productionBuildings = selectedBuildings.map(id =>
      humanPlayer.buildings.find(building => building.id === id)!
    ).filter(Boolean);
    
    produceGoods(humanPlayer.id, productionBuildings);
    setSelectedBuildings([]);
    nextRoleExecution();
  };

  const handleSell = () => {
    if (!humanPlayer) return;
    
    if (gameState.currentTradingPost === null) {
      revealTradingPost();
    }
    
    sellGoods(humanPlayer.id, selectedProducts);
    setSelectedProducts([]);
    nextRoleExecution();
  };

  const handleCouncilor = () => {
    if (!humanPlayer) return;
    
    drawCouncilorCards(humanPlayer.id);
  };

  const handleCouncilorSelect = () => {
    if (!humanPlayer || !gameState.councilorCards || gameState.councilorCards.length === 0) return;
    
    const selected = selectedCouncilorCards.map(id =>
      gameState.councilorCards!.find(card => card.id === id)!
    ).filter(Boolean);
    
    const discarded = gameState.councilorCards.filter(card =>
      !selectedCouncilorCards.includes(card.id)
    );
    
    selectCouncilorCards(humanPlayer.id, selected, discarded);
    setSelectedCouncilorCards([]);
    nextRoleExecution();
  };

  const handleProspector = () => {
    if (!humanPlayer) return;
    
    // 金鉱掘りは選択者のみが効果を得る
    if (gameState.currentRolePlayer === gameState.players.indexOf(humanPlayer)) {
      prospectorDrawCard(humanPlayer.id);
    }
    nextRoleExecution();
  };

  const handleBuildingSelect = (buildingId: string) => {
    if (selectedBuildings.includes(buildingId)) {
      setSelectedBuildings(selectedBuildings.filter(id => id !== buildingId));
    } else {
      setSelectedBuildings([...selectedBuildings, buildingId]);
    }
  };

  const handleProductSelect = (productType: string) => {
    if (selectedProducts.includes(productType)) {
      setSelectedProducts(selectedProducts.filter(type => type !== productType));
    } else {
      setSelectedProducts([...selectedProducts, productType]);
    }
  };

  const handleCouncilorCardSelect = (cardId: string) => {
    if (selectedCouncilorCards.includes(cardId)) {
      setSelectedCouncilorCards(selectedCouncilorCards.filter(id => id !== cardId));
    } else {
      const maxSelection = gameState.currentRolePlayer === gameState.players.indexOf(humanPlayer!) ? 1 : 1;
      if (selectedCouncilorCards.length < maxSelection) {
        setSelectedCouncilorCards([...selectedCouncilorCards, cardId]);
      }
    }
  };

  const handleSkip = () => {
    // 状態をリセット
    setSelectedCards([]);
    setBuildingToBuild(null);
    setSelectedProducts([]);
    setSelectedBuildings([]);
    setSelectedCouncilorCards([]);
    nextRoleExecution();
  };

  const renderCurrentAction = () => {
    if (gameState.phase === 'role-selection') {
      if (currentPlayer.isHuman) {
        return (
          <RoleSelection
            availableRoles={gameState.availableRoles}
            onRoleSelect={handleRoleSelect}
            currentPlayer={currentPlayer.name}
          />
        );
      } else {
        return (
          <div className="cpu-role-selection">
            <h3 className="role-selection-title">{currentPlayer.name}が役割を選択中...</h3>
            <div className="cpu-processing">
              <div className="spinner"></div>
            </div>
          </div>
        );
      }
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

          {executingPlayer.isHuman && gameState.currentRole === 'producer' && (
            <div className="action-section">
              <h4 className="action-title">生産する施設を選択:</h4>
              <div className="production-buildings">
                {executingPlayer.buildings
                  .filter(building => building.type === 'production' && building.productType)
                  .filter(building => !executingPlayer.products.some(p => p.type === building.productType))
                  .map(building => (
                    <div
                      key={building.id}
                      className={`building-option ${selectedBuildings.includes(building.id) ? 'selected' : ''}`}
                      onClick={() => handleBuildingSelect(building.id)}
                    >
                      {building.name} ({building.productType})
                    </div>
                  ))}
              </div>
              <div className="action-buttons">
                <button
                  onClick={handleProduce}
                  className="btn btn-success"
                  disabled={selectedBuildings.length === 0}
                >
                  生産
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

          {executingPlayer.isHuman && gameState.currentRole === 'trader' && (
            <div className="action-section">
              <h4 className="action-title">売却する商品を選択:</h4>
              {gameState.currentTradingPost && (
                <div className="trading-post-info">
                  <h5>商館タイル価格:</h5>
                  <div className="prices">
                    <span>インディゴ: {gameState.currentTradingPost.prices.indigo}</span>
                    <span>砂糖: {gameState.currentTradingPost.prices.sugar}</span>
                    <span>タバコ: {gameState.currentTradingPost.prices.tobacco}</span>
                    <span>コーヒー: {gameState.currentTradingPost.prices.coffee}</span>
                    <span>シルバー: {gameState.currentTradingPost.prices.silver}</span>
                  </div>
                </div>
              )}
              <div className="products">
                {executingPlayer.products.map(product => (
                  <div
                    key={product.type}
                    className={`product-option ${selectedProducts.includes(product.type) ? 'selected' : ''}`}
                    onClick={() => handleProductSelect(product.type)}
                  >
                    {product.type}
                  </div>
                ))}
              </div>
              <div className="action-buttons">
                <button
                  onClick={handleSell}
                  className="btn btn-success"
                  disabled={selectedProducts.length === 0}
                >
                  売却
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

          {executingPlayer.isHuman && gameState.currentRole === 'councilor' && (
            <div className="action-section">
              {!gameState.councilorCards || gameState.councilorCards.length === 0 ? (
                <div>
                  <h4 className="action-title">参事会議員</h4>
                  <p>カードを引きます</p>
                  <button
                    onClick={handleCouncilor}
                    className="btn btn-primary"
                  >
                    カードを引く
                  </button>
                </div>
              ) : (
                <div>
                  <h4 className="action-title">獲得するカードを1枚選択:</h4>
                  <div className="councilor-cards">
                    {gameState.councilorCards.map(card => (
                      <div
                        key={card.id}
                        className={`card-option ${selectedCouncilorCards.includes(card.id) ? 'selected' : ''}`}
                        onClick={() => handleCouncilorCardSelect(card.id)}
                      >
                        {card.name} (コスト:{card.cost})
                      </div>
                    ))}
                  </div>
                  <div className="action-buttons">
                    <button
                      onClick={handleCouncilorSelect}
                      className="btn btn-success"
                      disabled={selectedCouncilorCards.length !== 1}
                    >
                      選択
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {executingPlayer.isHuman && gameState.currentRole === 'prospector' && (
            <div className="action-section">
              <h4 className="action-title">金鉱掘り</h4>
              {gameState.currentRolePlayer === gameState.currentExecutingPlayer ? (
                <p>カードを1枚獲得します</p>
              ) : (
                <p>効果はありません</p>
              )}
              <button
                onClick={handleProspector}
                className="btn btn-primary"
              >
                次へ
              </button>
            </div>
          )}

          {executingPlayer.isHuman && !['builder', 'producer', 'trader', 'councilor', 'prospector'].includes(gameState.currentRole!) && (
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
              <p className="action-description">{executingPlayer.name}が処理中...</p>
              <div className="cpu-processing">
                <div className="spinner"></div>
              </div>
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
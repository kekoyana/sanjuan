import { useState, useCallback } from 'react';
import { GameState, Player, RoleType, BuildingCard, Product } from '../types/game';
import { BUILDING_CARDS } from '../data/buildings';
import { TRADING_POSTS } from '../data/tradingPosts';

// ゲームの初期化
const initializeGame = (): GameState => {
  // デッキをシャッフル
  const shuffledDeck = [...BUILDING_CARDS].sort(() => Math.random() - 0.5);
  
  // プレイヤーを初期化
  const players: Player[] = [
    {
      id: 'human',
      name: 'プレイヤー',
      isHuman: true,
      hand: [],
      buildings: [shuffledDeck.find(card => card.name === 'インディゴ染料工場')!],
      products: [],
      points: 0
    },
    {
      id: 'cpu1',
      name: 'CPU1',
      isHuman: false,
      hand: [],
      buildings: [shuffledDeck.find(card => card.name === 'インディゴ染料工場' && card.id !== 'indigo-plant-1')!],
      products: [],
      points: 0
    },
    {
      id: 'cpu2',
      name: 'CPU2',
      isHuman: false,
      hand: [],
      buildings: [shuffledDeck.find(card => card.name === 'インディゴ染料工場' && !['indigo-plant-1', 'indigo-plant-2'].includes(card.id))!],
      products: [],
      points: 0
    },
    {
      id: 'cpu3',
      name: 'CPU3',
      isHuman: false,
      hand: [],
      buildings: [shuffledDeck.find(card => card.name === 'インディゴ染料工場' && !['indigo-plant-1', 'indigo-plant-2', 'indigo-plant-3'].includes(card.id))!],
      products: [],
      points: 0
    }
  ];

  // 既に配置された建物をデッキから除去
  const remainingDeck = shuffledDeck.filter(card => 
    !players.some(player => player.buildings.some(building => building.id === card.id))
  );

  // 各プレイヤーに手札を4枚配る
  let deckIndex = 0;
  players.forEach(player => {
    for (let i = 0; i < 4; i++) {
      if (deckIndex < remainingDeck.length) {
        player.hand.push(remainingDeck[deckIndex]);
        deckIndex++;
      }
    }
  });

  // 商館タイルをシャッフル
  const shuffledTradingPosts = [...TRADING_POSTS].sort(() => Math.random() - 0.5);

  return {
    players,
    currentPlayerIndex: 0,
    governorIndex: 0,
    currentRound: 1,
    currentTurn: 1,
    selectedRoles: [],
    availableRoles: ['builder', 'producer', 'trader', 'councilor', 'prospector'],
    deck: remainingDeck.slice(deckIndex),
    discardPile: [],
    tradingPosts: shuffledTradingPosts,
    currentTradingPost: null,
    phase: 'role-selection',
    currentRole: null,
    currentRolePlayer: 0,
    currentExecutingPlayer: 0,
    gameLog: ['ゲームを開始しました。']
  };
};

export const useGame = () => {
  const [gameState, setGameState] = useState<GameState>(initializeGame);

  // デッキからカードを引く
  const drawCards = useCallback((count: number): BuildingCard[] => {
    setGameState((prev: GameState) => {
      const newDeck = [...prev.deck];
      const drawnCards: BuildingCard[] = [];
      
      for (let i = 0; i < count; i++) {
        if (newDeck.length === 0) {
          // デッキが空の場合、捨て札をシャッフルして新しいデッキにする
          if (prev.discardPile.length > 0) {
            const shuffledDiscard = [...prev.discardPile].sort(() => Math.random() - 0.5);
            newDeck.push(...shuffledDiscard);
            prev.discardPile.length = 0;
          } else {
            break; // カードがない場合は終了
          }
        }
        
        if (newDeck.length > 0) {
          drawnCards.push(newDeck.shift()!);
        }
      }
      
      return {
        ...prev,
        deck: newDeck
      };
    });
    
    return [];
  }, []);

  // 役割を選択
  const selectRole = useCallback((role: RoleType) => {
    setGameState((prev: GameState) => {
      if (prev.phase !== 'role-selection' || prev.selectedRoles.includes(role)) {
        return prev;
      }

      const newSelectedRoles = [...prev.selectedRoles, role];
      const newAvailableRoles = prev.availableRoles.filter((r: RoleType) => r !== role);
      
      return {
        ...prev,
        selectedRoles: newSelectedRoles,
        availableRoles: newAvailableRoles,
        currentRole: role,
        currentRolePlayer: prev.currentPlayerIndex,
        currentExecutingPlayer: prev.currentPlayerIndex,
        phase: 'role-execution',
        gameLog: [...prev.gameLog, `${prev.players[prev.currentPlayerIndex].name}が${getRoleName(role)}を選択しました。`]
      };
    });
  }, []);

  // 建物を建設
  const buildBuilding = useCallback((playerId: string, buildingCard: BuildingCard, costCards: BuildingCard[]) => {
    setGameState((prev: GameState) => {
      const playerIndex = prev.players.findIndex((p: Player) => p.id === playerId);
      if (playerIndex === -1) return prev;

      const player = prev.players[playerIndex];
      const newPlayers = [...prev.players];
      
      // コスト計算（特権や建物効果を考慮）
      let actualCost = buildingCard.cost;
      if (prev.currentRolePlayer === playerIndex) {
        actualCost -= 1; // 建築士の特権
      }
      
      // 建物効果による割引
      if (buildingCard.type === 'production') {
        const smithyCount = player.buildings.filter((b: BuildingCard) => b.name === '鍛冶屋').length;
        actualCost -= smithyCount;
      } else if (buildingCard.type === 'civic') {
        const quarryCount = player.buildings.filter((b: BuildingCard) => b.name === '石切場').length;
        actualCost -= quarryCount;
      }
      
      actualCost = Math.max(0, actualCost);
      
      if (costCards.length !== actualCost) {
        return prev;
      }

      // 手札から建物とコストカードを除去
      const newHand = player.hand.filter((card: BuildingCard) =>
        card.id !== buildingCard.id && !costCards.some((c: BuildingCard) => c.id === card.id)
      );
      
      // 建物を追加
      const newBuildings = [...player.buildings, buildingCard];
      
      newPlayers[playerIndex] = {
        ...player,
        hand: newHand,
        buildings: newBuildings
      };

      return {
        ...prev,
        players: newPlayers,
        discardPile: [...prev.discardPile, ...costCards],
        gameLog: [...prev.gameLog, `${player.name}が${buildingCard.name}を建設しました。`]
      };
    });
  }, []);

  // 商品を生産
  const produceGoods = useCallback((playerId: string, productionBuildings: BuildingCard[]) => {
    setGameState((prev: GameState) => {
      const playerIndex = prev.players.findIndex((p: Player) => p.id === playerId);
      if (playerIndex === -1) return prev;

      const player = prev.players[playerIndex];
      const newPlayers = [...prev.players];
      
      let producedCount = 0;
      let maxProduction = productionBuildings.length;
      
      // 特権による追加生産
      if (prev.currentRolePlayer === playerIndex) {
        maxProduction += 1;
      }
      
      // 水道橋の効果
      const aqueductCount = player.buildings.filter((b: BuildingCard) => b.name === '水道橋').length;
      maxProduction += aqueductCount;

      const newProducts = [...player.products];
      const cardsToDiscard: BuildingCard[] = [];
      
      for (const building of productionBuildings) {
        if (producedCount >= maxProduction) break;
        
        // 既に商品が置かれていないかチェック
        if (newProducts.some(p => p.type === building.productType)) continue;
        
        // デッキから1枚引いて商品として配置
        if (prev.deck.length > 0) {
          const drawnCard = prev.deck[0];
          newProducts.push({
            type: building.productType!,
            cardId: drawnCard.id
          });
          cardsToDiscard.push(drawnCard);
          producedCount++;
        }
      }
      
      newPlayers[playerIndex] = {
        ...player,
        products: newProducts
      };

      return {
        ...prev,
        players: newPlayers,
        deck: prev.deck.slice(cardsToDiscard.length),
        gameLog: [...prev.gameLog, `${player.name}が${producedCount}個の商品を生産しました。`]
      };
    });
  }, []);

  // 次のプレイヤーに移行
  const nextPlayer = useCallback(() => {
    setGameState((prev: GameState) => {
      const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      
      // 全プレイヤーが役割を選択したかチェック
      if (prev.selectedRoles.length === prev.players.length) {
        // ラウンド終了
        return {
          ...prev,
          currentPlayerIndex: (prev.governorIndex + 1) % prev.players.length,
          governorIndex: (prev.governorIndex + 1) % prev.players.length,
          currentRound: prev.currentRound + 1,
          currentTurn: 1,
          selectedRoles: [],
          availableRoles: ['builder', 'producer', 'trader', 'councilor', 'prospector'],
          phase: 'role-selection',
          currentRole: null,
          gameLog: [...prev.gameLog, `ラウンド${prev.currentRound}が終了しました。`]
        };
      }
      
      return {
        ...prev,
        currentPlayerIndex: nextPlayerIndex,
        currentTurn: prev.currentTurn + 1,
        phase: 'role-selection'
      };
    });
  }, []);

  // 役割の実行を次のプレイヤーに移行
  const nextRoleExecution = useCallback(() => {
    setGameState((prev: GameState) => {
      const nextExecutingPlayer = (prev.currentExecutingPlayer + 1) % prev.players.length;
      
      // 全プレイヤーが役割を実行したかチェック
      if (nextExecutingPlayer === prev.currentRolePlayer) {
        // 役割実行完了、次のプレイヤーの役割選択へ
        return nextPlayer();
      }
      
      return {
        ...prev,
        currentExecutingPlayer: nextExecutingPlayer
      };
    });
  }, [nextPlayer]);

  // ゲーム終了チェック
  const checkGameEnd = useCallback(() => {
    return gameState.players.some((player: Player) => player.buildings.length >= 12);
  }, [gameState.players]);

  // ゲームリセット
  const resetGame = useCallback(() => {
    setGameState(initializeGame());
  }, []);

  return {
    gameState,
    selectRole,
    buildBuilding,
    produceGoods,
    nextPlayer,
    nextRoleExecution,
    checkGameEnd,
    resetGame,
    drawCards
  };
};

// 役割名を取得
const getRoleName = (role: RoleType): string => {
  const roleNames = {
    builder: '建築士',
    producer: '監督',
    trader: '商人',
    councilor: '参事会議員',
    prospector: '金鉱掘り'
  };
  return roleNames[role];
};
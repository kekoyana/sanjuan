import { useState, useCallback } from 'react';
import { GameState, Player, RoleType, BuildingCard } from '../types/game';
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
    tradingPosts: shuffledTradingPosts.slice(1),
    currentTradingPost: shuffledTradingPosts[0],
    phase: 'role-selection',
    currentRole: null,
    currentRolePlayer: 0,
    currentExecutingPlayer: 0,
    gameLog: ['ゲームを開始しました。'],
    councilorCards: []
  };
};

export const useGame = () => {
  const [gameState, setGameState] = useState<GameState>(initializeGame);

  // デッキからカードを引く
  const drawCards = useCallback((count: number): BuildingCard[] => {
    let drawnCards: BuildingCard[] = [];
    
    setGameState((prev: GameState) => {
      const newDeck = [...prev.deck];
      const newDiscardPile = [...prev.discardPile];
      drawnCards = [];
      
      for (let i = 0; i < count; i++) {
        if (newDeck.length === 0) {
          // デッキが空の場合、捨て札をシャッフルして新しいデッキにする
          if (newDiscardPile.length > 0) {
            const shuffledDiscard = [...newDiscardPile].sort(() => Math.random() - 0.5);
            newDeck.push(...shuffledDiscard);
            newDiscardPile.length = 0;
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
        deck: newDeck,
        discardPile: newDiscardPile
      };
    });
    
    return drawnCards;
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

  // 商品を売却
  const sellGoods = useCallback((playerId: string, productTypes: string[]) => {
    setGameState((prev: GameState) => {
      const playerIndex = prev.players.findIndex((p: Player) => p.id === playerId);
      if (playerIndex === -1) return prev;

      const player = prev.players[playerIndex];
      const newPlayers = [...prev.players];
      
      let maxSales = productTypes.length;
      
      // 特権による追加売却
      if (prev.currentRolePlayer === playerIndex) {
        maxSales += 1;
      }
      
      // 貿易所の効果
      const tradingHouseCount = player.buildings.filter((b: BuildingCard) => b.name === '貿易所').length;
      maxSales += tradingHouseCount;

      const soldProducts: string[] = [];
      const newProducts = [...player.products];
      let totalCardDrawn = 0;
      
      for (let i = 0; i < Math.min(maxSales, productTypes.length); i++) {
        const productType = productTypes[i];
        const productIndex = newProducts.findIndex(p => p.type === productType);
        
        if (productIndex !== -1 && prev.currentTradingPost) {
          const price = prev.currentTradingPost.prices[productType as keyof typeof prev.currentTradingPost.prices];
          totalCardDrawn += price;
          soldProducts.push(productType);
          newProducts.splice(productIndex, 1);
        }
      }
      
      // カードを手札に追加
      const cardsToAdd: BuildingCard[] = [];
      for (let i = 0; i < totalCardDrawn && i < prev.deck.length; i++) {
        cardsToAdd.push(prev.deck[i]);
      }
      
      newPlayers[playerIndex] = {
        ...player,
        products: newProducts,
        hand: [...player.hand, ...cardsToAdd]
      };

      return {
        ...prev,
        players: newPlayers,
        deck: prev.deck.slice(totalCardDrawn),
        gameLog: [...prev.gameLog, `${player.name}が${soldProducts.length}個の商品を売却し、${totalCardDrawn}枚のカードを獲得しました。`]
      };
    });
  }, []);

  // 参事会議員でカードを引く
  const drawCouncilorCards = useCallback((playerId: string) => {
    setGameState((prev: GameState) => {
      const playerIndex = prev.players.findIndex((p: Player) => p.id === playerId);
      if (playerIndex === -1) return prev;

      // 特権による枚数計算
      const isRolePlayer = prev.currentRolePlayer === playerIndex;
      const drawCount = isRolePlayer ? 5 : 2;
      
      const newDeck = [...prev.deck];
      const newDiscardPile = [...prev.discardPile];
      const drawnCards: BuildingCard[] = [];
      
      for (let i = 0; i < drawCount; i++) {
        if (newDeck.length === 0) {
          if (newDiscardPile.length > 0) {
            const shuffledDiscard = [...newDiscardPile].sort(() => Math.random() - 0.5);
            newDeck.push(...shuffledDiscard);
            newDiscardPile.length = 0;
          } else {
            break;
          }
        }
        
        if (newDeck.length > 0) {
          drawnCards.push(newDeck.shift()!);
        }
      }

      return {
        ...prev,
        deck: newDeck,
        discardPile: newDiscardPile,
        gameLog: [...prev.gameLog, `${prev.players[playerIndex].name}が参事会議員で${drawnCards.length}枚のカードを引きました。`],
        // 引いたカードを一時的に保存
        councilorCards: drawnCards
      };
    });
  }, []);

  // 参事会議員でカードを選択
  const selectCouncilorCards = useCallback((playerId: string, selectedCards: BuildingCard[], discardCards: BuildingCard[]) => {
    setGameState((prev: GameState) => {
      const playerIndex = prev.players.findIndex((p: Player) => p.id === playerId);
      if (playerIndex === -1) return prev;

      const player = prev.players[playerIndex];
      const newPlayers = [...prev.players];
      
      newPlayers[playerIndex] = {
        ...player,
        hand: [...player.hand, ...selectedCards]
      };

      return {
        ...prev,
        players: newPlayers,
        discardPile: [...prev.discardPile, ...discardCards],
        councilorCards: [], // リセット
        gameLog: [...prev.gameLog, `${player.name}が参事会議員で${selectedCards.length}枚のカードを獲得しました。`]
      };
    });
  }, []);

  // 金鉱掘りでカードを獲得
  const prospectorDrawCard = useCallback((playerId: string) => {
    setGameState((prev: GameState) => {
      const playerIndex = prev.players.findIndex((p: Player) => p.id === playerId);
      if (playerIndex === -1 || prev.deck.length === 0) return prev;

      const player = prev.players[playerIndex];
      const newPlayers = [...prev.players];
      const drawnCard = prev.deck[0];
      
      newPlayers[playerIndex] = {
        ...player,
        hand: [...player.hand, drawnCard]
      };

      return {
        ...prev,
        players: newPlayers,
        deck: prev.deck.slice(1),
        gameLog: [...prev.gameLog, `${player.name}が金鉱掘りで1枚のカードを獲得しました。`]
      };
    });
  }, []);

  // 商館タイルを公開
  const revealTradingPost = useCallback(() => {
    setGameState((prev: GameState) => {
      if (prev.tradingPosts.length === 0) return prev;
      
      const newTradingPost = prev.tradingPosts[0];
      
      return {
        ...prev,
        currentTradingPost: newTradingPost,
        tradingPosts: prev.tradingPosts.slice(1),
        gameLog: [...prev.gameLog, '新しい商館タイルが公開されました。']
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
    sellGoods,
    drawCouncilorCards,
    selectCouncilorCards,
    prospectorDrawCard,
    revealTradingPost,
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
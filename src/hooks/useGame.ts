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
      
      // 建物が手札にあるかチェック
      if (!player.hand.some(card => card.id === buildingCard.id)) {
        return prev;
      }
      
      // 都市施設の重複チェック
      if (buildingCard.type === 'civic') {
        const alreadyBuilt = player.buildings.some(b => b.name === buildingCard.name);
        if (alreadyBuilt) {
          return prev;
        }
      }
      
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
      
      // コストカードの有効性チェック
      const validCostCards = costCards.filter(card =>
        player.hand.some(handCard => handCard.id === card.id) && card.id !== buildingCard.id
      );
      
      if (validCostCards.length !== actualCost) {
        return prev;
      }

      const newPlayers = [...prev.players];
      
      // 手札から建物とコストカードを除去
      const newHand = player.hand.filter((card: BuildingCard) =>
        card.id !== buildingCard.id && !validCostCards.some((c: BuildingCard) => c.id === card.id)
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
        discardPile: [...prev.discardPile, ...validCostCards],
        gameLog: [...prev.gameLog, `${player.name}が${buildingCard.name}を建設しました。（コスト: ${actualCost}枚）`]
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

  // CPU自動役割選択
  const cpuSelectRole = useCallback((playerId: string) => {
    setGameState((prev: GameState) => {
      const playerIndex = prev.players.findIndex((p: Player) => p.id === playerId);
      if (playerIndex === -1 || prev.availableRoles.length === 0) return prev;

      // 簡単なAI: ランダムに役割を選択
      const randomIndex = Math.floor(Math.random() * prev.availableRoles.length);
      const selectedRole = prev.availableRoles[randomIndex];
      
      const newSelectedRoles = [...prev.selectedRoles, selectedRole];
      const newAvailableRoles = prev.availableRoles.filter((r: RoleType) => r !== selectedRole);
      
      return {
        ...prev,
        selectedRoles: newSelectedRoles,
        availableRoles: newAvailableRoles,
        currentRole: selectedRole,
        currentRolePlayer: prev.currentPlayerIndex,
        currentExecutingPlayer: prev.currentPlayerIndex,
        phase: 'role-execution',
        gameLog: [...prev.gameLog, `${prev.players[prev.currentPlayerIndex].name}が${getRoleName(selectedRole)}を選択しました。`]
      };
    });
  }, []);

  // CPU自動行動
  const cpuExecuteAction = useCallback((playerId: string) => {
    setGameState((prev: GameState) => {
      const playerIndex = prev.players.findIndex((p: Player) => p.id === playerId);
      if (playerIndex === -1 || !prev.currentRole) {
        return prev;
      }

      const player = prev.players[playerIndex];
      const newPlayers = [...prev.players];

      switch (prev.currentRole) {
        case 'builder': {
          // 建設可能な建物を探す
          const affordableBuildings = player.hand.filter(building => {
            // 都市施設の重複チェック
            if (building.type === 'civic') {
              const alreadyBuilt = player.buildings.some(b => b.name === building.name);
              if (alreadyBuilt) return false;
            }
            
            let cost = building.cost;
            if (prev.currentRolePlayer === playerIndex) cost -= 1; // 特権
            
            // 建物効果による割引
            if (building.type === 'production') {
              const smithyCount = player.buildings.filter((b: BuildingCard) => b.name === '鍛冶屋').length;
              cost -= smithyCount;
            } else if (building.type === 'civic') {
              const quarryCount = player.buildings.filter((b: BuildingCard) => b.name === '石切場').length;
              cost -= quarryCount;
            }
            
            cost = Math.max(0, cost);
            return player.hand.length - 1 >= cost; // 建物自体を除いたコスト
          });

          if (affordableBuildings.length > 0) {
            // コストが安い建物を優先
            const buildingToBuild = affordableBuildings.sort((a, b) => {
              let costA = a.cost;
              let costB = b.cost;
              
              if (prev.currentRolePlayer === playerIndex) {
                costA -= 1;
                costB -= 1;
              }
              
              if (a.type === 'production') {
                const smithyCount = player.buildings.filter((b: BuildingCard) => b.name === '鍛冶屋').length;
                costA -= smithyCount;
              } else if (a.type === 'civic') {
                const quarryCount = player.buildings.filter((b: BuildingCard) => b.name === '石切場').length;
                costA -= quarryCount;
              }
              
              if (b.type === 'production') {
                const smithyCount = player.buildings.filter((b: BuildingCard) => b.name === '鍛冶屋').length;
                costB -= smithyCount;
              } else if (b.type === 'civic') {
                const quarryCount = player.buildings.filter((b: BuildingCard) => b.name === '石切場').length;
                costB -= quarryCount;
              }
              
              return Math.max(0, costA) - Math.max(0, costB);
            })[0];
            
            let cost = buildingToBuild.cost;
            if (prev.currentRolePlayer === playerIndex) cost -= 1;
            
            if (buildingToBuild.type === 'production') {
              const smithyCount = player.buildings.filter((b: BuildingCard) => b.name === '鍛冶屋').length;
              cost -= smithyCount;
            } else if (buildingToBuild.type === 'civic') {
              const quarryCount = player.buildings.filter((b: BuildingCard) => b.name === '石切場').length;
              cost -= quarryCount;
            }
            
            cost = Math.max(0, cost);
            
            // コストカードを選択（建物を除く）
            const costCards = player.hand.filter(card => card.id !== buildingToBuild.id).slice(0, cost);
            
            // 建設実行
            const newHand = player.hand.filter((card: BuildingCard) =>
              card.id !== buildingToBuild.id && !costCards.some((c: BuildingCard) => c.id === card.id)
            );
            
            newPlayers[playerIndex] = {
              ...player,
              hand: newHand,
              buildings: [...player.buildings, buildingToBuild]
            };

            return {
              ...prev,
              players: newPlayers,
              discardPile: [...prev.discardPile, ...costCards],
              gameLog: [...prev.gameLog, `${player.name}が${buildingToBuild.name}を建設しました。（コスト: ${cost}枚）`]
            };
          }
          break;
        }

        case 'producer': {
          // 生産可能な施設を探す
          const productionBuildings = player.buildings.filter(building =>
            building.type === 'production' &&
            building.productType &&
            !player.products.some(p => p.type === building.productType)
          );

          if (productionBuildings.length > 0 && prev.deck.length > 0) {
            let maxProduction = 1;
            if (prev.currentRolePlayer === playerIndex) maxProduction += 1; // 特権
            
            const aqueductCount = player.buildings.filter((b: BuildingCard) => b.name === '水道橋').length;
            maxProduction += aqueductCount;

            const newProducts = [...player.products];
            const cardsToDiscard: BuildingCard[] = [];
            let producedCount = 0;

            for (const building of productionBuildings.slice(0, maxProduction)) {
              if (prev.deck.length > cardsToDiscard.length) {
                const drawnCard = prev.deck[cardsToDiscard.length];
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
          }
          break;
        }

        case 'trader': {
          if (player.products.length > 0 && prev.currentTradingPost) {
            let maxSales = 1;
            if (prev.currentRolePlayer === playerIndex) maxSales += 1; // 特権
            
            const tradingHouseCount = player.buildings.filter((b: BuildingCard) => b.name === '貿易所').length;
            maxSales += tradingHouseCount;

            const productsToSell = player.products.slice(0, maxSales);
            const newProducts = player.products.slice(maxSales);
            
            let totalCardDrawn = 0;
            for (const product of productsToSell) {
              const price = prev.currentTradingPost.prices[product.type as keyof typeof prev.currentTradingPost.prices];
              totalCardDrawn += price;
            }

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
              gameLog: [...prev.gameLog, `${player.name}が${productsToSell.length}個の商品を売却し、${totalCardDrawn}枚のカードを獲得しました。`]
            };
          }
          break;
        }

        case 'councilor': {
          const isRolePlayer = prev.currentRolePlayer === playerIndex;
          const drawCount = isRolePlayer ? 5 : 2;
          
          if (prev.deck.length > 0) {
            const cardsToAdd = prev.deck.slice(0, Math.min(1, drawCount)); // 1枚だけ獲得
            const cardsToDiscard = prev.deck.slice(1, drawCount);

            newPlayers[playerIndex] = {
              ...player,
              hand: [...player.hand, ...cardsToAdd]
            };

            return {
              ...prev,
              players: newPlayers,
              deck: prev.deck.slice(drawCount),
              discardPile: [...prev.discardPile, ...cardsToDiscard],
              gameLog: [...prev.gameLog, `${player.name}が参事会議員で${cardsToAdd.length}枚のカードを獲得しました。`]
            };
          }
          break;
        }

        case 'prospector': {
          if (prev.currentRolePlayer === playerIndex && prev.deck.length > 0) {
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
          }
          break;
        }
      }

      // 何も行動できない場合でも、ログを残して次に進む
      return {
        ...prev,
        gameLog: [...prev.gameLog, `${player.name}は${getRoleName(prev.currentRole!)}をスキップしました。`]
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
    cpuSelectRole,
    cpuExecuteAction,
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
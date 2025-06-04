// ゲームの型定義

export type ProductType = 'indigo' | 'sugar' | 'tobacco' | 'coffee' | 'silver';

export type RoleType = 'builder' | 'producer' | 'trader' | 'councilor' | 'prospector';

export interface BuildingCard {
  id: string;
  name: string;
  cost: number;
  points: number;
  type: 'production' | 'civic';
  productType?: ProductType;
  effect?: string;
  isMonument?: boolean;
}

export interface Product {
  type: ProductType;
  cardId: string; // 商品として使用されているカードのID
}

export interface TradingPost {
  id: number;
  prices: {
    indigo: number;
    sugar: number;
    tobacco: number;
    coffee: number;
    silver: number;
  };
}

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  hand: BuildingCard[];
  buildings: BuildingCard[];
  products: Product[];
  points: number;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  governorIndex: number;
  currentRound: number;
  currentTurn: number;
  selectedRoles: RoleType[];
  availableRoles: RoleType[];
  deck: BuildingCard[];
  discardPile: BuildingCard[];
  tradingPosts: TradingPost[];
  currentTradingPost: TradingPost | null;
  phase: 'role-selection' | 'role-execution' | 'cleanup' | 'game-over';
  currentRole: RoleType | null;
  currentRolePlayer: number;
  currentExecutingPlayer: number;
  gameLog: string[];
  councilorCards?: BuildingCard[];
}

export interface GameAction {
  type: string;
  playerId: string;
  data?: any;
}
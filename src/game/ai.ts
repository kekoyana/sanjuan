import {
  GameState,
  RoleType,
  GoodType,
  Card,
  TRADE_PRICES,
} from './types';
import {
  getCardDef,
  hasBuilding,
} from './utils';
import {
  getBuildCost,
  canBuild,
  getProducibleBuildings,
  getSellableGoods,
  getMaxSellCount,
  getCouncillorKeepCount,
  getMaxProductionSlots,
} from './engine';

// ==================== 役職選択 ====================

export function aiSelectRole(
  state: GameState,
  playerId: number
): RoleType {
  const available: RoleType[] = (
    ['builder', 'producer', 'trader', 'councillor', 'prospector'] as RoleType[]
  ).filter((r) => !state.usedRoles.includes(r));

  let bestRole = available[0];
  let bestScore = -Infinity;

  for (const role of available) {
    const score = scoreRole(state, playerId, role);
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }

  return bestRole;
}

function scoreRole(
  state: GameState,
  playerId: number,
  role: RoleType
): number {
  const player = state.players[playerId];
  let score = Math.random() * 2; // ランダム要素

  switch (role) {
    case 'builder': {
      // 建てられるカードがあるか
      const buildable = player.hand.filter((c) => canBuild(state, playerId, c.instanceId));
      if (buildable.length === 0) return score - 5;
      const bestBuild = buildable.reduce((best, c) => {
        const def = getCardDef(c);
        return def.vp > getCardDef(best).vp ? c : best;
      });
      score += getCardDef(bestBuild).vp * 3;
      score += 2; // 特権: コスト-1
      break;
    }
    case 'producer': {
      const producible = getProducibleBuildings(state, playerId);
      score += producible.length * 3;
      if (producible.length === 0) score -= 5;
      break;
    }
    case 'trader': {
      const goods = getSellableGoods(state, playerId);
      if (goods.length === 0) return score - 5;
      for (const g of goods) {
        score += TRADE_PRICES[g.goodType] * 2;
      }
      score += 2; // 特権: +1カード
      break;
    }
    case 'councillor': {
      score += 4; // 基本的に便利
      if (player.hand.length <= 2) score += 4; // 手札少ない時は特に有用
      score += 3; // 特権: 5枚引ける
      break;
    }
    case 'prospector': {
      score += 2; // 1枚引ける、他者に利益なし
      if (player.hand.length <= 1) score += 3;
      break;
    }
  }

  return score;
}

// ==================== 建築 ====================

export interface AIBuildDecision {
  cardInstanceId: number;
  paymentCardIds: number[];
  craneTargetIndex?: number;
  blackMarketGoods?: GoodType[];
}

export function aiDecideBuild(
  state: GameState,
  playerId: number
): AIBuildDecision | null {
  const player = state.players[playerId];

  // 建築可能なカードを探す
  const buildable: { card: Card; score: number }[] = [];
  for (const card of player.hand) {
    if (canBuild(state, playerId, card.instanceId)) {
      const def = getCardDef(card);
      // 既に同じ建物を持っている場合はスキップ
      if (hasBuilding(player.buildings, def.id)) continue;

      let score = def.vp * 10 + def.cost * 2;
      // 6コスト建物を高く評価
      if (def.cost === 6) score += 20;
      // 生産建物のシナジー
      if (def.type === 'production') {
        const hasGoods = player.buildings.some(
          (b) => b.good !== null
        );
        if (!hasGoods) score += 5; // 商品がない時は生産建物を優先
      }
      buildable.push({ card, score });
    }
  }

  if (buildable.length === 0) return null;

  // 最高スコアのカードを建てる
  buildable.sort((a, b) => b.score - a.score);
  const chosen = buildable[0].card;
  const def = getCardDef(chosen);
  const cost = getBuildCost(state, playerId, def.id);

  // 支払いカードを選択（最もVP/コストの低いカードから）
  const payableCards = player.hand
    .filter((c) => c.instanceId !== chosen.instanceId)
    .sort((a, b) => getCardDef(a).vp - getCardDef(b).vp);

  const paymentCardIds = payableCards
    .slice(0, cost)
    .map((c) => c.instanceId);

  return {
    cardInstanceId: chosen.instanceId,
    paymentCardIds,
  };
}

// ==================== 生産 ====================

export function aiDecideProduction(
  state: GameState,
  playerId: number
): number[] {
  const producible = getProducibleBuildings(state, playerId);
  if (producible.length === 0) return [];

  const maxSlots = getMaxProductionSlots(state, playerId);

  // 高価値の商品を優先
  const player = state.players[playerId];
  const sorted = [...producible].sort((a, b) => {
    const defA = getCardDef(player.buildings[a].card);
    const defB = getCardDef(player.buildings[b].card);
    const priceA = defA.goodType ? TRADE_PRICES[defA.goodType] : 0;
    const priceB = defB.goodType ? TRADE_PRICES[defB.goodType] : 0;
    return priceB - priceA;
  });

  return sorted.slice(0, maxSlots);
}

// ==================== 売却 ====================

export function aiDecideTrade(
  state: GameState,
  playerId: number
): number[] {
  const goods = getSellableGoods(state, playerId);
  if (goods.length === 0) return [];

  const maxSell = getMaxSellCount(state, playerId);

  // 高価値順にソート
  const sorted = [...goods].sort(
    (a, b) => TRADE_PRICES[b.goodType] - TRADE_PRICES[a.goodType]
  );

  return sorted.slice(0, maxSell).map((g) => g.buildingIndex);
}

// ==================== 参事会員 ====================

export function aiDecideCouncillor(
  state: GameState,
  playerId: number
): number[] {
  const keepCount = getCouncillorKeepCount(state, playerId);
  const drawn = state.drawnCards;

  if (drawn.length === 0) return [];

  // スコアリング: VP重視 + 建てられるかどうか
  const player = state.players[playerId];
  const scored = drawn.map((card) => {
    const def = getCardDef(card);
    let score = def.vp * 5 + def.cost;
    // 既に持っている建物は低評価
    if (hasBuilding(player.buildings, def.id)) score -= 10;
    // コスト6は高評価
    if (def.cost === 6) score += 8;
    // 生産建物で空きスロットがなければ低評価
    if (def.type === 'production' && hasBuilding(player.buildings, def.id)) {
      score -= 5;
    }
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const actualKeep = Math.min(keepCount, drawn.length);
  return scored.slice(0, actualKeep).map((s) => s.card.instanceId);
}

// ==================== 礼拝堂 ====================

export function aiDecideChapel(
  state: GameState,
  playerId: number
): number | null {
  const player = state.players[playerId];
  if (!hasBuilding(player.buildings, 'chapel')) return null;
  if (player.hand.length <= 2) return null; // 手札が少なすぎる

  // 最もVPの低いカードを格納
  const sorted = [...player.hand].sort(
    (a, b) => getCardDef(a).vp - getCardDef(b).vp
  );
  return sorted[0].instanceId;
}

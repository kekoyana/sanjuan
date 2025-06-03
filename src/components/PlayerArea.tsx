import React from 'react';
import { Player, Product } from '../types/game';
import BuildingCard from './BuildingCard';

interface PlayerAreaProps {
  player: Player;
  isCurrentPlayer?: boolean;
  isHuman?: boolean;
  onCardClick?: (cardId: string) => void;
  selectedCards?: string[];
}

const PlayerArea: React.FC<PlayerAreaProps> = ({
  player,
  isCurrentPlayer = false,
  isHuman = false,
  onCardClick,
  selectedCards = []
}) => {
  const getProductIcon = (productType: string) => {
    switch (productType) {
      case 'indigo': return '🟦';
      case 'sugar': return '🍬';
      case 'tobacco': return '🚬';
      case 'coffee': return '☕';
      case 'silver': return '💿';
      default: return '';
    }
  };

  return (
    <div className={`player-area ${isCurrentPlayer ? 'current-player' : ''}`}>
      <div className="player-header">
        <h3 className="player-name">
          {player.name}
          {isCurrentPlayer && <span className="crown">👑</span>}
        </h3>
        <div className="player-stats">
          得点: {player.points} | 手札: {player.hand.length}枚
        </div>
      </div>

      {/* 建物エリア */}
      <div className="buildings-section">
        <h4 className="section-title">建物</h4>
        <div className="buildings-grid">
          {player.buildings.map((building) => {
            const hasProduct = player.products.some((p: Product) => {
              const productBuilding = player.buildings.find((b: any) => b.productType === p.type);
              return productBuilding?.id === building.id;
            });

            return (
              <div key={building.id} className={hasProduct ? 'building-with-product' : ''}>
                <BuildingCard
                  card={building}
                  size="small"
                  showCost={false}
                />
                {hasProduct && (
                  <div className="product-indicator">
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 商品エリア */}
      {player.products.length > 0 && (
        <div className="products-section">
          <h4 className="section-title">商品</h4>
          <div className="products-grid">
            {player.products.map((product: Product, index: number) => (
              <div key={index} className="product-item">
                {getProductIcon(product.type)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 手札エリア（人間プレイヤーのみ表示） */}
      {isHuman && (
        <div className="hand-section">
          <h4 className="section-title">手札</h4>
          <div className="hand-grid">
            {player.hand.map((card: any) => (
              <BuildingCard
                key={card.id}
                card={card}
                size="small"
                onClick={onCardClick ? () => onCardClick(card.id) : undefined}
                isSelected={selectedCards.includes(card.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerArea;
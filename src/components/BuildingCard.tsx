import React from 'react';
import { BuildingCard as BuildingCardType } from '../types/game';

interface BuildingCardProps {
  card: BuildingCardType;
  onClick?: () => void;
  isSelected?: boolean;
  showCost?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const BuildingCard: React.FC<BuildingCardProps> = ({ 
  card, 
  onClick, 
  isSelected = false, 
  showCost = true,
  size = 'medium'
}) => {
  const getProductIcon = (productType?: string) => {
    switch (productType) {
      case 'indigo': return '🟦';
      case 'sugar': return '🍬';
      case 'tobacco': return '🚬';
      case 'coffee': return '☕';
      case 'silver': return '💿';
      default: return '';
    }
  };

  const getCardBackground = () => {
    if (card.type === 'production') {
      return 'production';
    } else if (card.isMonument) {
      return 'monument';
    } else {
      return 'civic';
    }
  };

  return (
    <div
      className={`building-card ${size} ${getCardBackground()} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      title={card.name}
    >
      <div>
        <div className="card-name">
          {card.name}
        </div>
        {card.productType && (
          <div className="card-product">
            {getProductIcon(card.productType)}
          </div>
        )}
        {card.effect && size !== 'small' && (
          <div className="card-effect" title={card.effect}>
            {card.effect}
          </div>
        )}
      </div>
      
      <div className="card-footer">
        {showCost && (
          <div className="card-cost">
            コスト{card.cost}
          </div>
        )}
        <div className="card-points">
          {card.points}点
        </div>
      </div>
    </div>
  );
};

export default BuildingCard;
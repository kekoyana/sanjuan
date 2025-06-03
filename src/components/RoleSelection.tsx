import React from 'react';
import { RoleType } from '../types/game';

interface RoleSelectionProps {
  availableRoles: RoleType[];
  onRoleSelect: (role: RoleType) => void;
  currentPlayer: string;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({
  availableRoles,
  onRoleSelect,
  currentPlayer
}) => {
  const getRoleInfo = (role: RoleType) => {
    const roleInfo = {
      builder: {
        name: '建築士',
        icon: '🏗️',
        description: '建物を建設する',
        privilege: '建設コスト-1'
      },
      producer: {
        name: '監督',
        icon: '👷',
        description: '商品を生産する',
        privilege: '商品をもう1つ生産'
      },
      trader: {
        name: '商人',
        icon: '💰',
        description: '商品を売却する',
        privilege: 'もう1つ売却'
      },
      councilor: {
        name: '参事会議員',
        icon: '📜',
        description: 'カードを引く',
        privilege: '+3枚多く引く'
      },
      prospector: {
        name: '金鉱掘り',
        icon: '⛏️',
        description: '他プレイヤーには効果なし',
        privilege: 'カード1枚入手'
      }
    };
    return roleInfo[role];
  };

  return (
    <div className="role-selection">
      <h3 className="role-selection-title">
        {currentPlayer}の役割選択
      </h3>
      
      <div className="roles-grid">
        {availableRoles.map((role: RoleType) => {
          const roleInfo = getRoleInfo(role);
          return (
            <button
              key={role}
              onClick={() => onRoleSelect(role)}
              className="role-button"
            >
              <div className="role-icon">{roleInfo.icon}</div>
              <div className="role-name">{roleInfo.name}</div>
              <div className="role-description">
                {roleInfo.description}
              </div>
              <div className="role-privilege">
                特権: {roleInfo.privilege}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RoleSelection;
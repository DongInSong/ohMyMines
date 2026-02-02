import { useCallback, useState, useEffect } from 'react';
import type { ItemType } from 'shared';
import { ITEMS } from 'shared';
import { useGame } from '../../hooks/useGame';
import { usePlayerStore } from '../../stores/playerStore';

export function Inventory() {
  const { handleUseItem } = useGame();
  const inventory = usePlayerStore((s) => s.inventory);
  const activeEffects = usePlayerStore((s) => s.activeEffects);
  const [, setTick] = useState(0);

  // Update timer display every second
  useEffect(() => {
    if (activeEffects.length === 0) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeEffects.length]);

  const onItemClick = useCallback(
    (itemId: ItemType) => {
      handleUseItem(itemId);
    },
    [handleUseItem]
  );

  const getEffectTimeRemaining = (itemId: ItemType): number | null => {
    const effect = activeEffects.find((e) => e.itemId === itemId);
    if (!effect) return null;
    return Math.max(0, effect.endTime - Date.now());
  };

  // Filter active effects that have time remaining
  const activeEffectsWithTime = activeEffects.filter((effect) => {
    const remaining = effect.endTime - Date.now();
    return remaining > 1000;
  });

  // Don't render if no items and no active effects
  if (inventory.length === 0 && activeEffectsWithTime.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Active Effects Display */}
      {activeEffectsWithTime.length > 0 && (
        <div className="active-effects-container">
          <div className="active-effects-bg" />
          <div className="active-effects-content">
            {activeEffectsWithTime.map((effect) => {
              const item = ITEMS[effect.itemId];
              if (!item) return null;

              const remaining = Math.max(0, effect.endTime - Date.now());
              const seconds = Math.ceil(remaining / 1000);
              const isLow = seconds <= 5;

              return (
                <div key={effect.itemId} className={`active-effect-item ${isLow ? 'warning' : ''}`}>
                  <div className="active-effect-indicator" />
                  <span className="active-effect-icon">{item.emoji}</span>
                  <div className="active-effect-info">
                    <span className={`active-effect-time ${isLow ? 'low' : ''}`}>{seconds}s</span>
                    <span className="active-effect-label">Active</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inventory Items Bar */}
      {inventory.length > 0 && (
        <div className="inventory-container">
          <div className="inventory-bg" />
          <div className="inventory-content">
            {inventory.map((invItem) => {
              const item = ITEMS[invItem.itemId];
              if (!item) return null;

              const effectTime = getEffectTimeRemaining(invItem.itemId);
              const isActive = effectTime !== null && effectTime > 0;

              return (
                <div key={invItem.itemId} className="item-slot">
                  <button
                    className={`item-button ${isActive ? 'in-use' : ''}`}
                    onClick={() => onItemClick(invItem.itemId)}
                    title={`${item.name}\n${item.description}`}
                    disabled={isActive}
                  >
                    <div className="item-inner-layer" />
                    <span className="item-icon">{item.emoji}</span>

                    {/* In-use overlay */}
                    {isActive && (
                      <div className="item-active-overlay">
                        <div className="item-active-pulse" />
                      </div>
                    )}
                  </button>

                  {/* Quantity badge */}
                  {invItem.quantity > 1 && (
                    <span className="item-quantity">{invItem.quantity}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

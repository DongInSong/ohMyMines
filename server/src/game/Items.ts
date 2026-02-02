import {
  ItemType,
  Item,
  ActiveEffect,
  Position,
  ItemDropEvent,
} from 'shared';
import { ITEMS, ITEM_LIST, TOTAL_ITEM_DROP_RATE } from 'shared';
import { PlayerManager } from './Player.js';

export class ItemManager {
  private pendingDrops: ItemDropEvent[] = [];

  constructor(private playerManager: PlayerManager) {}

  // Check if an item should drop when a cell is revealed
  checkItemDrop(position: Position, playerId: string, guildBonus: number = 0): ItemDropEvent | null {
    const roll = Math.random();
    const adjustedDropRate = TOTAL_ITEM_DROP_RATE * (1 + guildBonus);

    if (roll > adjustedDropRate) {
      return null;
    }

    // Determine which item dropped
    const itemRoll = Math.random() * adjustedDropRate;
    let cumulative = 0;

    for (const item of ITEM_LIST) {
      cumulative += item.dropRate * (1 + guildBonus);
      if (itemRoll <= cumulative) {
        const dropEvent: ItemDropEvent = {
          itemId: item.id,
          position,
          playerId,
        };

        this.pendingDrops.push(dropEvent);
        return dropEvent;
      }
    }

    return null;
  }

  // Player collects an item
  collectItem(playerId: string, itemId: ItemType): boolean {
    const item = ITEMS[itemId];
    if (!item) return false;

    this.playerManager.addItem(playerId, itemId);
    return true;
  }

  // Use an item from inventory
  useItem(playerId: string, itemId: ItemType): { success: boolean; effect?: ActiveEffect; message?: string } {
    const item = ITEMS[itemId];
    if (!item) {
      return { success: false, message: '아이템을 찾을 수 없습니다' };
    }

    const player = this.playerManager.getPlayer(playerId);
    if (!player) {
      return { success: false, message: '플레이어를 찾을 수 없습니다' };
    }

    // Check if player has the item
    if (!this.playerManager.useItem(playerId, itemId)) {
      return { success: false, message: '인벤토리에 아이템이 없습니다' };
    }

    let effect: ActiveEffect | undefined;
    let message = `${item.emoji} ${item.name} 사용!`;

    switch (itemId) {
      case 'cooldown_reduction':
        // Instantly reduce all skill cooldowns by 50%
        // Show effect for 3 seconds so user can see it was activated
        effect = this.playerManager.addEffect(playerId, {
          itemId,
          startTime: Date.now(),
          endTime: Date.now() + 3000,
          value: item.effectValue,
        });
        message = '⏱️ 모든 스킬 쿨다운 50% 감소!';
        break;

      case 'double_points':
        effect = this.playerManager.addEffect(playerId, {
          itemId,
          startTime: Date.now(),
          endTime: Date.now() + (item.duration ?? 30) * 1000,
          value: item.effectValue,
        });
        {
          const totalSeconds = Math.ceil((effect.endTime - Date.now()) / 1000);
          if (effect.stackCount && effect.stackCount > 1) {
            message = `💎 더블 포인트 x${effect.stackCount}! (${totalSeconds}초)`;
          } else {
            message = `💎 더블 포인트 활성화! (${totalSeconds}초)`;
          }
        }
        break;

      case 'magnet':
        // Magnet effect is handled separately in game logic
        // Show effect for 3 seconds so user can see it was activated
        effect = this.playerManager.addEffect(playerId, {
          itemId,
          startTime: Date.now(),
          endTime: Date.now() + 3000,
          value: item.effectValue,
        });
        message = '🧲 자석 발동! 주변 아이템 수집!';
        break;

      case 'mystery_box':
        const reward = this.openMysteryBox(playerId);
        message = reward.message;
        break;

      case 'ghost_mode':
        effect = this.playerManager.addEffect(playerId, {
          itemId,
          startTime: Date.now(),
          endTime: Date.now() + (item.duration ?? 15) * 1000,
        });
        {
          const totalSeconds = Math.ceil((effect.endTime - Date.now()) / 1000);
          if (effect.stackCount && effect.stackCount > 1) {
            message = `👻 유령 모드 x${effect.stackCount}! (${totalSeconds}초)`;
          } else {
            message = `👻 유령 모드 활성화! (${totalSeconds}초)`;
          }
        }
        break;

      default:
        return { success: false, message: '알 수 없는 아이템' };
    }

    return { success: true, effect, message };
  }

  private openMysteryBox(playerId: string): { message: string } {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) return { message: '🎁 상자 열기 실패' };

    const roll = Math.random();

    if (roll < 0.4) {
      // 40% chance: Random score bonus
      const bonus = Math.floor(Math.random() * 100) + 50;
      this.playerManager.addScore(playerId, bonus);
      return { message: `🎁 미스터리 박스: +${bonus}점!` };
    } else if (roll < 0.7) {
      // 30% chance: Skill cooldown reset
      // Reset all skills (set lastUsed to 0)
      const skills = player.skills as Record<string, { lastUsed: number }>;
      for (const skillId of Object.keys(skills)) {
        skills[skillId].lastUsed = 0;
      }
      return { message: '🎁 미스터리 박스: 모든 스킬 초기화!' };
    } else if (roll < 0.9) {
      // 20% chance: Random item
      const randomItem = ITEM_LIST[Math.floor(Math.random() * ITEM_LIST.length)];
      this.playerManager.addItem(playerId, randomItem.id);
      return { message: `🎁 미스터리 박스: ${randomItem.emoji} ${randomItem.name} 획득!` };
    } else {
      // 10% chance: Jackpot
      const jackpot = 500;
      this.playerManager.addScore(playerId, jackpot);
      // Give one of each item
      for (const item of ITEM_LIST) {
        if (item.id !== 'mystery_box') {
          this.playerManager.addItem(playerId, item.id);
        }
      }
      return { message: `🎰 잭팟! +${jackpot}점과 모든 아이템 획득!` };
    }
  }

  // Get nearby item drops for magnet effect
  collectNearbyItems(
    playerId: string,
    position: Position,
    range: number
  ): ItemDropEvent[] {
    const collected: ItemDropEvent[] = [];
    const remaining: ItemDropEvent[] = [];

    for (const drop of this.pendingDrops) {
      const dist = Math.abs(drop.position.x - position.x) + Math.abs(drop.position.y - position.y);
      if (dist <= range) {
        this.collectItem(playerId, drop.itemId);
        collected.push(drop);
      } else {
        remaining.push(drop);
      }
    }

    this.pendingDrops = remaining;
    return collected;
  }

  // Check if item drop is still pending (not collected)
  hasPendingDrop(position: Position): ItemDropEvent | undefined {
    return this.pendingDrops.find(
      d => d.position.x === position.x && d.position.y === position.y
    );
  }

  // Remove a specific drop
  removeDrop(position: Position): void {
    this.pendingDrops = this.pendingDrops.filter(
      d => d.position.x !== position.x || d.position.y !== position.y
    );
  }

  // Get all pending drops (for syncing to new clients)
  getPendingDrops(): ItemDropEvent[] {
    return [...this.pendingDrops];
  }

  // Clear all drops (for new session)
  clearAllDrops(): void {
    this.pendingDrops = [];
  }

  // Calculate guild bonus for item drops
  getGuildItemBonus(guildId: string | undefined, memberCount: number): number {
    if (!guildId) return 0;

    // 20% bonus at 20+ members
    if (memberCount >= 20) return 0.20;
    return 0;
  }
}

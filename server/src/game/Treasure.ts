import { v4 as uuidv4 } from 'uuid';
import { TreasureCell, Position } from 'shared';
import { TREASURE, MAP_WIDTH, MAP_HEIGHT } from 'shared';

export class TreasureManager {
  private treasures: Map<string, TreasureCell> = new Map();
  private spawnTimer: NodeJS.Timeout | null = null;

  constructor(
    private onSpawn: (treasure: TreasureCell) => void,
    private onExpire: (treasureId: string) => void
  ) {}

  start(): void {
    this.spawnTreasure();
    this.spawnTimer = setInterval(() => {
      this.spawnTreasure();
    }, TREASURE.SPAWN_INTERVAL);
  }

  stop(): void {
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
    this.treasures.clear();
  }

  private spawnTreasure(): void {
    // Don't spawn if we have max treasures
    if (this.treasures.size >= TREASURE.MAX_ACTIVE) {
      return;
    }

    // Determine treasure type based on chance
    const roll = Math.random();
    let type: 'gold' | 'diamond' | 'rainbow';
    let reward: number;

    if (roll < TREASURE.REWARDS.rainbow.chance) {
      type = 'rainbow';
      reward = Math.floor(
        Math.random() * (TREASURE.REWARDS.rainbow.max - TREASURE.REWARDS.rainbow.min) +
        TREASURE.REWARDS.rainbow.min
      );
    } else if (roll < TREASURE.REWARDS.rainbow.chance + TREASURE.REWARDS.diamond.chance) {
      type = 'diamond';
      reward = Math.floor(
        Math.random() * (TREASURE.REWARDS.diamond.max - TREASURE.REWARDS.diamond.min) +
        TREASURE.REWARDS.diamond.min
      );
    } else {
      type = 'gold';
      reward = Math.floor(
        Math.random() * (TREASURE.REWARDS.gold.max - TREASURE.REWARDS.gold.min) +
        TREASURE.REWARDS.gold.min
      );
    }

    // Random position (avoid edges)
    const position: Position = {
      x: Math.floor(Math.random() * (MAP_WIDTH - 100)) + 50,
      y: Math.floor(Math.random() * (MAP_HEIGHT - 100)) + 50,
    };

    // Random duration
    const duration = Math.floor(
      Math.random() * (TREASURE.MAX_DURATION - TREASURE.MIN_DURATION) +
      TREASURE.MIN_DURATION
    );

    const now = Date.now();
    const treasure: TreasureCell = {
      id: uuidv4(),
      position,
      reward,
      spawnTime: now,
      expireTime: now + duration,
      type,
    };

    this.treasures.set(treasure.id, treasure);
    this.onSpawn(treasure);

    // Set expiration timer
    setTimeout(() => {
      this.expireTreasure(treasure.id);
    }, duration);
  }

  private expireTreasure(treasureId: string): void {
    if (this.treasures.has(treasureId)) {
      this.treasures.delete(treasureId);
      this.onExpire(treasureId);
    }
  }

  collectTreasure(treasureId: string, playerId: string): TreasureCell | null {
    const treasure = this.treasures.get(treasureId);
    if (!treasure) return null;

    // Check if expired
    if (Date.now() > treasure.expireTime) {
      this.treasures.delete(treasureId);
      return null;
    }

    this.treasures.delete(treasureId);
    return treasure;
  }

  getTreasureAtPosition(position: Position): TreasureCell | null {
    for (const treasure of this.treasures.values()) {
      if (treasure.position.x === position.x && treasure.position.y === position.y) {
        return treasure;
      }
    }
    return null;
  }

  getTreasureNearPosition(position: Position, range: number = 0): TreasureCell | null {
    for (const treasure of this.treasures.values()) {
      const dx = Math.abs(treasure.position.x - position.x);
      const dy = Math.abs(treasure.position.y - position.y);
      if (dx <= range && dy <= range) {
        return treasure;
      }
    }
    return null;
  }

  getAllTreasures(): TreasureCell[] {
    return Array.from(this.treasures.values());
  }

  getTreasureById(id: string): TreasureCell | undefined {
    return this.treasures.get(id);
  }
}

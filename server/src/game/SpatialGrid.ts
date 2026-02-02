/**
 * Spatial Grid for efficient proximity queries
 * Used to optimize cursor broadcasts by only sending to nearby players
 */

import { Position } from 'shared';

interface GridEntity {
  id: string;
  position: Position;
}

export class SpatialGrid<T extends GridEntity> {
  private cells: Map<string, Set<string>> = new Map();
  private entities: Map<string, T> = new Map();

  constructor(
    private cellSize: number = 100, // Size of each grid cell in game units
    private mapWidth: number = 1000,
    private mapHeight: number = 1000
  ) {}

  /**
   * Get the cell key for a position
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Add or update an entity in the grid
   */
  update(entity: T): void {
    const oldEntity = this.entities.get(entity.id);

    // Remove from old cell if position changed
    if (oldEntity) {
      const oldKey = this.getCellKey(oldEntity.position.x, oldEntity.position.y);
      const newKey = this.getCellKey(entity.position.x, entity.position.y);

      if (oldKey !== newKey) {
        const oldCell = this.cells.get(oldKey);
        if (oldCell) {
          oldCell.delete(entity.id);
          if (oldCell.size === 0) {
            this.cells.delete(oldKey);
          }
        }
      }
    }

    // Add to new cell
    const key = this.getCellKey(entity.position.x, entity.position.y);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = new Set();
      this.cells.set(key, cell);
    }
    cell.add(entity.id);

    // Update entity reference
    this.entities.set(entity.id, entity);
  }

  /**
   * Remove an entity from the grid
   */
  remove(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    const key = this.getCellKey(entity.position.x, entity.position.y);
    const cell = this.cells.get(key);
    if (cell) {
      cell.delete(entityId);
      if (cell.size === 0) {
        this.cells.delete(key);
      }
    }

    this.entities.delete(entityId);
  }

  /**
   * Get all entities within a rectangular viewport
   */
  getEntitiesInViewport(
    centerX: number,
    centerY: number,
    viewWidth: number,
    viewHeight: number
  ): T[] {
    const result: T[] = [];
    const halfWidth = viewWidth / 2;
    const halfHeight = viewHeight / 2;

    const startCellX = Math.floor((centerX - halfWidth) / this.cellSize);
    const endCellX = Math.floor((centerX + halfWidth) / this.cellSize);
    const startCellY = Math.floor((centerY - halfHeight) / this.cellSize);
    const endCellY = Math.floor((centerY + halfHeight) / this.cellSize);

    for (let cy = startCellY; cy <= endCellY; cy++) {
      for (let cx = startCellX; cx <= endCellX; cx++) {
        const key = `${cx},${cy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const entityId of cell) {
            const entity = this.entities.get(entityId);
            if (entity) {
              result.push(entity);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all entities within a certain distance of a position
   */
  getEntitiesNearby(position: Position, radius: number): T[] {
    return this.getEntitiesInViewport(
      position.x,
      position.y,
      radius * 2,
      radius * 2
    ).filter(entity => {
      const dx = entity.position.x - position.x;
      const dy = entity.position.y - position.y;
      return dx * dx + dy * dy <= radius * radius;
    });
  }

  /**
   * Get all entities in the grid
   */
  getAllEntities(): T[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entity by ID
   */
  get(entityId: string): T | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Check if entity exists
   */
  has(entityId: string): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Get the number of entities in the grid
   */
  size(): number {
    return this.entities.size;
  }

  /**
   * Clear all entities from the grid
   */
  clear(): void {
    this.cells.clear();
    this.entities.clear();
  }
}

// Default viewport size for cursor queries (in game cells)
// This should cover the typical player viewport
export const DEFAULT_VIEWPORT_SIZE = 50;

// Create a specialized spatial grid for player cursors
export interface CursorEntity {
  id: string;
  playerId: string;
  position: Position;
  socketId: string;
}

export class CursorSpatialGrid extends SpatialGrid<CursorEntity> {
  constructor() {
    // Use larger cell size for cursors since we don't need fine-grained queries
    super(100);
  }

  /**
   * Get cursors that should be visible to a player at a given position
   */
  getCursorsVisibleFrom(position: Position, viewportSize: number = DEFAULT_VIEWPORT_SIZE): CursorEntity[] {
    return this.getEntitiesInViewport(
      position.x,
      position.y,
      viewportSize,
      viewportSize
    );
  }

  /**
   * Get socket IDs of players who should see a specific cursor
   * (players whose viewport includes the cursor's position)
   */
  getPlayersWhoCanSee(cursorPosition: Position, viewportSize: number = DEFAULT_VIEWPORT_SIZE): string[] {
    // Get all cursors (representing players) that are close enough to see this position
    const nearbyPlayers = this.getEntitiesInViewport(
      cursorPosition.x,
      cursorPosition.y,
      viewportSize * 2, // Double to account for both viewports
      viewportSize * 2
    );

    return nearbyPlayers.map(p => p.socketId);
  }
}

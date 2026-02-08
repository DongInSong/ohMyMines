import {
  Cell,
  Chunk,
  ChunkCoord,
  Position,
  Zone,
  ZoneType,
} from 'shared';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  CHUNK_SIZE,
  CHUNKS_X,
  CHUNKS_Y,
  ZONE_LAYOUT,
  ZONE_CONFIGS,
  MAX_FLOOD_FILL_CELLS,
} from 'shared';

export class GameMap {
  private chunks: Map<string, Chunk> = new Map();
  private totalMines = 0;
  private revealedCells = 0;
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
    this.generateMap();
  }

  private seededRandom(x: number, y: number): number {
    // Simple seeded random for reproducible map generation
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  }

  private getZoneForPosition(x: number, y: number): Zone {
    for (const zone of ZONE_LAYOUT) {
      if (
        x >= zone.bounds.startX &&
        x < zone.bounds.endX &&
        y >= zone.bounds.startY &&
        y < zone.bounds.endY
      ) {
        return zone;
      }
    }
    // Default to beginner zone if not found
    return { ...ZONE_CONFIGS.beginner, bounds: { startX: 0, startY: 0, endX: MAP_WIDTH, endY: MAP_HEIGHT } };
  }

  getZoneTypeForPosition(x: number, y: number): ZoneType {
    return this.getZoneForPosition(x, y).type;
  }

  getScoreMultiplier(x: number, y: number): number {
    return this.getZoneForPosition(x, y).scoreMultiplier;
  }

  private generateMap(): void {
    // Generate all chunks
    for (let cy = 0; cy < CHUNKS_Y; cy++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        this.generateChunk({ cx, cy });
      }
    }
  }

  private generateChunk(coord: ChunkCoord): Chunk {
    const key = this.getChunkKey(coord);
    if (this.chunks.has(key)) {
      return this.chunks.get(key)!;
    }

    const cells: Cell[][] = [];
    let mineCount = 0;
    const startX = coord.cx * CHUNK_SIZE;
    const startY = coord.cy * CHUNK_SIZE;

    // First pass: create cells and place mines
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const row: Cell[] = [];
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = startX + lx;
        const y = startY + ly;
        const zone = this.getZoneForPosition(x, y);
        const isMine = this.seededRandom(x, y) < zone.mineDensity;

        if (isMine) {
          mineCount++;
          this.totalMines++;
        }

        row.push({
          x,
          y,
          isMine,
          adjacentMines: 0,
          state: 'hidden',
        });
      }
      cells.push(row);
    }

    // Second pass: calculate adjacent mine counts
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (!cells[ly][lx].isMine) {
          cells[ly][lx].adjacentMines = this.countAdjacentMines(
            startX + lx,
            startY + ly,
            cells,
            coord
          );
        }
      }
    }

    const chunk: Chunk = {
      coord,
      cells,
      mineCount,
      revealedCount: 0,
    };

    this.chunks.set(key, chunk);
    return chunk;
  }

  private countAdjacentMines(
    x: number,
    y: number,
    localCells: Cell[][],
    chunkCoord: ChunkCoord
  ): number {
    let count = 0;
    const startX = chunkCoord.cx * CHUNK_SIZE;
    const startY = chunkCoord.cy * CHUNK_SIZE;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;

        // Check bounds
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;

        // Check if in same chunk
        const lx = nx - startX;
        const ly = ny - startY;

        if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE) {
          if (localCells[ly][lx].isMine) count++;
        } else {
          // Need to check adjacent chunk
          if (this.isMineAt(nx, ny)) count++;
        }
      }
    }
    return count;
  }

  private isMineAt(x: number, y: number): boolean {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;

    const zone = this.getZoneForPosition(x, y);
    return this.seededRandom(x, y) < zone.mineDensity;
  }

  private getChunkKey(coord: ChunkCoord): string {
    return `${coord.cx},${coord.cy}`;
  }

  getChunkCoord(x: number, y: number): ChunkCoord {
    return {
      cx: Math.floor(x / CHUNK_SIZE),
      cy: Math.floor(y / CHUNK_SIZE),
    };
  }

  getChunk(coord: ChunkCoord): Chunk | undefined {
    return this.chunks.get(this.getChunkKey(coord));
  }

  getCell(x: number, y: number): Cell | undefined {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return undefined;

    const chunkCoord = this.getChunkCoord(x, y);
    const chunk = this.getChunk(chunkCoord);
    if (!chunk) return undefined;

    const lx = x % CHUNK_SIZE;
    const ly = y % CHUNK_SIZE;
    return chunk.cells[ly][lx];
  }

  revealCell(x: number, y: number, playerId: string): { cells: Cell[]; hitMine: boolean; truncated: boolean } {
    const result: { cells: Cell[]; hitMine: boolean; truncated: boolean } = {
      cells: [],
      hitMine: false,
      truncated: false,
    };
    const cell = this.getCell(x, y);

    if (!cell || cell.state !== 'hidden') return result;

    if (cell.isMine) {
      cell.state = 'revealed';
      cell.revealedBy = playerId;
      cell.revealedAt = Date.now();
      result.cells.push({ ...cell });
      result.hitMine = true;
      return result;
    }

    // Flood fill for revealing cells (with limit to prevent revealing too many at once)
    // Use numeric encoding for visited set to reduce string allocation overhead
    const toReveal: Position[] = [{ x, y }];
    const visited = new Set<number>();
    visited.add(y * MAP_WIDTH + x);
    const maxCells = MAX_FLOOD_FILL_CELLS || 500; // Fallback if not defined
    const now = Date.now();

    while (toReveal.length > 0 && result.cells.length < maxCells) {
      const pos = toReveal.pop()!;

      const currentCell = this.getCell(pos.x, pos.y);
      if (!currentCell || currentCell.state !== 'hidden' || currentCell.isMine) continue;

      currentCell.state = 'revealed';
      currentCell.revealedBy = playerId;
      currentCell.revealedAt = now;
      result.cells.push({ ...currentCell });

      // Update chunk revealed count
      const chunkCoord = this.getChunkCoord(pos.x, pos.y);
      const chunk = this.getChunk(chunkCoord);
      if (chunk) {
        chunk.revealedCount++;
      }

      this.revealedCells++;

      // If cell is empty (0 adjacent mines), reveal neighbors
      if (currentCell.adjacentMines === 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = pos.x + dx;
            const ny = pos.y + dy;
            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
              const nKey = ny * MAP_WIDTH + nx;
              if (!visited.has(nKey)) {
                visited.add(nKey);
                toReveal.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
    }

    // Check if flood fill was truncated (there were more cells to reveal)
    if (toReveal.length > 0) {
      result.truncated = true;
    }

    return result;
  }

  flagCell(x: number, y: number, playerId: string): Cell | undefined {
    const cell = this.getCell(x, y);
    if (!cell) return undefined;

    if (cell.state === 'hidden') {
      cell.state = 'flagged';
      cell.flaggedBy = playerId;
    } else if (cell.state === 'flagged' && cell.flaggedBy === playerId) {
      cell.state = 'hidden';
      cell.flaggedBy = undefined;
    }

    return { ...cell };
  }

  // For skill: reveal area without triggering mines
  revealAreaSafe(centerX: number, centerY: number, range: number, playerId: string): Cell[] {
    const revealed: Cell[] = [];
    const halfRange = Math.floor(range / 2);

    for (let dy = -halfRange; dy <= halfRange; dy++) {
      for (let dx = -halfRange; dx <= halfRange; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const cell = this.getCell(x, y);

        if (cell && cell.state === 'hidden' && !cell.isMine) {
          cell.state = 'revealed';
          cell.revealedBy = playerId;
          cell.revealedAt = Date.now();
          revealed.push({ ...cell });

          const chunkCoord = this.getChunkCoord(x, y);
          const chunk = this.getChunk(chunkCoord);
          if (chunk) {
            chunk.revealedCount++;
          }
          this.revealedCells++;
        }
      }
    }

    return revealed;
  }

  // For skill: scan area for mines (temporary reveal)
  scanArea(centerX: number, centerY: number, range: number): Position[] {
    const mines: Position[] = [];
    const halfRange = Math.floor(range / 2);

    for (let dy = -halfRange; dy <= halfRange; dy++) {
      for (let dx = -halfRange; dx <= halfRange; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const cell = this.getCell(x, y);

        if (cell && cell.isMine && cell.state === 'hidden') {
          mines.push({ x, y });
        }
      }
    }

    return mines;
  }

  // For skill: mark a mine
  findNearestMine(x: number, y: number, range: number): Position | undefined {
    const halfRange = Math.floor(range / 2);
    let nearest: Position | undefined;
    let minDist = Infinity;

    for (let dy = -halfRange; dy <= halfRange; dy++) {
      for (let dx = -halfRange; dx <= halfRange; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        const cell = this.getCell(nx, ny);

        if (cell && cell.isMine && cell.state === 'hidden') {
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist < minDist) {
            minDist = dist;
            nearest = { x: nx, y: ny };
          }
        }
      }
    }

    return nearest;
  }

  updateChunkDominance(coord: ChunkCoord, playerReveals: Map<string, number>, guildReveals: Map<string, number>): void {
    const chunk = this.getChunk(coord);
    if (!chunk) return;

    // Find player with most reveals
    let maxPlayerReveals = 0;
    let dominantPlayer: string | undefined;
    for (const [playerId, count] of playerReveals) {
      if (count > maxPlayerReveals) {
        maxPlayerReveals = count;
        dominantPlayer = playerId;
      }
    }
    chunk.dominantPlayer = dominantPlayer;

    // Find guild with most reveals
    let maxGuildReveals = 0;
    let dominantGuild: string | undefined;
    for (const [guildId, count] of guildReveals) {
      if (count > maxGuildReveals) {
        maxGuildReveals = count;
        dominantGuild = guildId;
      }
    }
    chunk.dominantGuild = dominantGuild;
  }

  getTotalMines(): number {
    return this.totalMines;
  }

  getRevealedCells(): number {
    return this.revealedCells;
  }

  getTotalCells(): number {
    return MAP_WIDTH * MAP_HEIGHT;
  }

  getRevealProgress(): number {
    const nonMineCells = this.getTotalCells() - this.totalMines;
    return this.revealedCells / nonMineCells;
  }

  // Serialize chunk for sending to client
  serializeChunk(coord: ChunkCoord): Chunk | undefined {
    return this.getChunk(coord);
  }

  // Get chunks in viewport
  getChunksInViewport(centerX: number, centerY: number, viewWidth: number, viewHeight: number): ChunkCoord[] {
    const chunks: ChunkCoord[] = [];

    const startCX = Math.max(0, Math.floor((centerX - viewWidth / 2) / CHUNK_SIZE));
    const endCX = Math.min(CHUNKS_X - 1, Math.floor((centerX + viewWidth / 2) / CHUNK_SIZE));
    const startCY = Math.max(0, Math.floor((centerY - viewHeight / 2) / CHUNK_SIZE));
    const endCY = Math.min(CHUNKS_Y - 1, Math.floor((centerY + viewHeight / 2) / CHUNK_SIZE));

    for (let cy = startCY; cy <= endCY; cy++) {
      for (let cx = startCX; cx <= endCX; cx++) {
        chunks.push({ cx, cy });
      }
    }

    return chunks;
  }
}

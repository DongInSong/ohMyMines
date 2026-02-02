import {
  SkillType,
  SkillUseResult,
  Position,
  Cell,
} from 'shared';
import { SKILLS } from 'shared';
import { GameMap } from './GameMap.js';
import { PlayerManager } from './Player.js';

export class SkillManager {
  constructor(
    private gameMap: GameMap,
    private playerManager: PlayerManager
  ) {}

  updateGameMap(gameMap: GameMap): void {
    this.gameMap = gameMap;
  }

  useSkill(
    playerId: string,
    skillId: SkillType,
    targetPosition?: Position
  ): SkillUseResult {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) {
      return { success: false, skillId, playerId, message: 'Player not found' };
    }

    const { canUse, remainingCooldown } = this.playerManager.canUseSkill(playerId, skillId);
    if (!canUse) {
      return {
        success: false,
        skillId,
        playerId,
        message: `Skill on cooldown for ${Math.ceil(remainingCooldown / 1000)}s`,
      };
    }

    const skill = SKILLS[skillId];
    const position = targetPosition ?? player.position;

    let affectedCells: Position[] = [];
    let message = '';

    switch (skillId) {
      case 'scan':
        affectedCells = this.handleScan(position, skill.range ?? 3);
        message = `Scanned ${affectedCells.length} mine(s)`;
        break;

      case 'shield':
        message = 'Shield activated';
        break;

      case 'chain':
        message = 'Chain reveal activated for 10 seconds';
        break;

      case 'vision':
        affectedCells = this.handleVision(position, skill.range ?? 5, playerId);
        message = `Revealed ${affectedCells.length} cell(s)`;
        break;

      case 'mark':
        // Use skill.range instead of hardcoded value (default to 5 for backwards compat)
        const markRange = skill.range ?? 5;
        const markedPosition = this.handleMark(position, markRange);
        if (markedPosition) {
          affectedCells = [markedPosition];
          message = 'Mine marked!';
        } else {
          return {
            success: false,
            skillId,
            playerId,
            message: 'No mine found nearby',
          };
        }
        break;

      case 'speed':
        message = 'Speed boost activated for 10 seconds';
        break;

      default:
        return { success: false, skillId, playerId, message: 'Unknown skill' };
    }

    // Mark skill as used
    this.playerManager.useSkill(playerId, skillId);

    return {
      success: true,
      skillId,
      playerId,
      affectedCells,
      message,
    };
  }

  private handleScan(position: Position, range: number): Position[] {
    // Returns positions of mines in range (for temporary display)
    return this.gameMap.scanArea(position.x, position.y, range);
  }

  private handleVision(position: Position, range: number, playerId: string): Position[] {
    // Reveal all non-mine cells in range
    const cells = this.gameMap.revealAreaSafe(position.x, position.y, range, playerId);
    return cells.map(c => ({ x: c.x, y: c.y }));
  }

  private handleMark(position: Position, range: number): Position | undefined {
    // Find and mark nearest mine
    return this.gameMap.findNearestMine(position.x, position.y, range);
  }

  // Chain reveal: when active, revealing a number cell also reveals safe neighbors
  // Limited to prevent infinite chain reactions
  private static readonly MAX_CHAIN_REVEAL_CELLS = 100;

  performChainReveal(
    cells: Cell[],
    playerId: string
  ): Cell[] {
    if (!this.playerManager.isSkillActive(playerId, 'chain')) {
      return cells;
    }

    const additionalCells: Cell[] = [];
    const revealed = new Set<string>(cells.map(c => `${c.x},${c.y}`));
    const totalLimit = SkillManager.MAX_CHAIN_REVEAL_CELLS;

    for (const cell of cells) {
      // Stop if we've reached the limit
      if (cells.length + additionalCells.length >= totalLimit) {
        break;
      }

      if (cell.adjacentMines > 0) {
        // Reveal safe neighbors of numbered cells (only direct neighbors, not flood fill)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            // Stop if we've reached the limit
            if (cells.length + additionalCells.length >= totalLimit) {
              break;
            }

            const nx = cell.x + dx;
            const ny = cell.y + dy;
            const key = `${nx},${ny}`;

            if (!revealed.has(key)) {
              const neighborCell = this.gameMap.getCell(nx, ny);
              if (neighborCell && !neighborCell.isMine && neighborCell.state === 'hidden') {
                // Only reveal the direct neighbor cell, not trigger another flood fill
                neighborCell.state = 'revealed';
                neighborCell.revealedBy = playerId;
                neighborCell.revealedAt = Date.now();
                additionalCells.push({ ...neighborCell });
                revealed.add(key);
              }
            }
          }
        }
      }
    }

    return [...cells, ...additionalCells];
  }

  // Check if player has shield active (to block mine explosion)
  checkShield(playerId: string): boolean {
    if (this.playerManager.hasShield(playerId)) {
      this.playerManager.consumeShield(playerId);
      return true;
    }
    return false;
  }

  // Check if a skill is currently active
  isSkillActive(playerId: string, skillId: SkillType): boolean {
    return this.playerManager.isSkillActive(playerId, skillId);
  }

  // Check if speed skill is active
  isSpeedActive(playerId: string): boolean {
    return this.playerManager.isSkillActive(playerId, 'speed');
  }

  // Get all active effects for a player
  getActiveSkills(playerId: string): SkillType[] {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) return [];

    const activeSkills: SkillType[] = [];
    for (const skillId of Object.keys(SKILLS) as SkillType[]) {
      if (this.playerManager.isSkillActive(playerId, skillId)) {
        activeSkills.push(skillId);
      }
    }
    return activeSkills;
  }

  // Get cooldown status for all skills
  getSkillCooldowns(playerId: string): Record<SkillType, number> {
    const cooldowns: Record<SkillType, number> = {} as Record<SkillType, number>;

    for (const skillId of Object.keys(SKILLS) as SkillType[]) {
      const { remainingCooldown } = this.playerManager.canUseSkill(playerId, skillId);
      cooldowns[skillId] = remainingCooldown;
    }

    return cooldowns;
  }
}

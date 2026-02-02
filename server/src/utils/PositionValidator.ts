/**
 * Position Validator
 * Prevents teleport cheats and validates player movement
 */

import { Position } from 'shared';
import { MAP_WIDTH, MAP_HEIGHT, RENDER } from 'shared';

interface PositionValidationResult {
  valid: boolean;
  correctedPosition?: Position;
  message?: string;
}

interface PlayerMovementState {
  lastPosition: Position;
  lastUpdateTime: number;
  speedMultiplier: number;
}

export class PositionValidator {
  private playerStates: Map<string, PlayerMovementState> = new Map();

  // Maximum pixels per millisecond (base movement speed)
  // Assuming 60fps and typical viewport size, allow generous movement
  private readonly BASE_MAX_SPEED = 2; // pixels per ms

  // Grace period for initial position (first update is always accepted)
  private readonly INITIAL_GRACE_PERIOD_MS = 1000;

  // Maximum allowed distance for a single update (prevents extreme teleports)
  // This is a hard cap regardless of time elapsed
  private readonly MAX_TELEPORT_DISTANCE = 500;

  /**
   * Initialize or update player's movement state
   */
  initializePlayer(playerId: string, position: Position, speedMultiplier: number = 1): void {
    this.playerStates.set(playerId, {
      lastPosition: { ...position },
      lastUpdateTime: Date.now(),
      speedMultiplier,
    });
  }

  /**
   * Update player's speed multiplier (e.g., when speed skill is active)
   */
  setSpeedMultiplier(playerId: string, multiplier: number): void {
    const state = this.playerStates.get(playerId);
    if (state) {
      state.speedMultiplier = multiplier;
    }
  }

  /**
   * Validate a position update
   * Returns corrected position if the update is suspicious
   */
  validatePosition(playerId: string, newPosition: Position): PositionValidationResult {
    const state = this.playerStates.get(playerId);
    const now = Date.now();

    // First, validate position is within map bounds
    const boundedPosition = this.clampToBounds(newPosition);
    const wasOutOfBounds =
      boundedPosition.x !== newPosition.x || boundedPosition.y !== newPosition.y;

    // If no previous state, accept the position (with bounds correction)
    if (!state) {
      this.playerStates.set(playerId, {
        lastPosition: boundedPosition,
        lastUpdateTime: now,
        speedMultiplier: 1,
      });
      return {
        valid: true,
        correctedPosition: wasOutOfBounds ? boundedPosition : undefined,
      };
    }

    // Calculate distance and time elapsed
    const distance = this.calculateDistance(state.lastPosition, boundedPosition);
    const timeElapsed = now - state.lastUpdateTime;

    // Grace period check (accept any reasonable movement shortly after join)
    if (timeElapsed < this.INITIAL_GRACE_PERIOD_MS && distance < this.MAX_TELEPORT_DISTANCE) {
      state.lastPosition = boundedPosition;
      state.lastUpdateTime = now;
      return {
        valid: true,
        correctedPosition: wasOutOfBounds ? boundedPosition : undefined,
      };
    }

    // Calculate maximum allowed distance based on time and speed
    const maxSpeed = this.BASE_MAX_SPEED * state.speedMultiplier * RENDER.FAST_PAN_MULTIPLIER;
    const maxAllowedDistance = Math.min(
      maxSpeed * Math.max(timeElapsed, 16), // Minimum 16ms (60fps assumption)
      this.MAX_TELEPORT_DISTANCE
    );

    // Check if movement is suspicious
    if (distance > maxAllowedDistance) {
      // Movement too fast - could be a teleport cheat
      // Instead of rejecting, we'll correct the position
      const correctedPosition = this.interpolatePosition(
        state.lastPosition,
        boundedPosition,
        maxAllowedDistance / distance
      );

      state.lastPosition = correctedPosition;
      state.lastUpdateTime = now;

      return {
        valid: false,
        correctedPosition,
        message: `이동 속도가 너무 빠릅니다`,
      };
    }

    // Valid movement - update state
    state.lastPosition = boundedPosition;
    state.lastUpdateTime = now;

    return {
      valid: true,
      correctedPosition: wasOutOfBounds ? boundedPosition : undefined,
    };
  }

  /**
   * Validate a position without updating state (for read-only checks)
   */
  isValidPosition(position: Position): boolean {
    return (
      typeof position.x === 'number' &&
      typeof position.y === 'number' &&
      !isNaN(position.x) &&
      !isNaN(position.y) &&
      position.x >= 0 &&
      position.x < MAP_WIDTH &&
      position.y >= 0 &&
      position.y < MAP_HEIGHT
    );
  }

  /**
   * Remove player from tracking
   */
  removePlayer(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  /**
   * Clamp position to map bounds
   */
  private clampToBounds(position: Position): Position {
    return {
      x: Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor(position.x))),
      y: Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor(position.y))),
    };
  }

  /**
   * Calculate Euclidean distance between two positions
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Interpolate between two positions
   */
  private interpolatePosition(from: Position, to: Position, ratio: number): Position {
    return {
      x: Math.floor(from.x + (to.x - from.x) * ratio),
      y: Math.floor(from.y + (to.y - from.y) * ratio),
    };
  }

  /**
   * Clean up old player states (call periodically)
   */
  cleanup(maxIdleTimeMs: number = 300000): void {
    const now = Date.now();
    for (const [playerId, state] of this.playerStates) {
      if (now - state.lastUpdateTime > maxIdleTimeMs) {
        this.playerStates.delete(playerId);
      }
    }
  }
}

// Singleton instance for shared use
export const positionValidator = new PositionValidator();

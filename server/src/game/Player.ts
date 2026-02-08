import { v4 as uuidv4 } from 'uuid';
import {
  Player,
  PlayerStats,
  PlayerSkillState,
  SkillType,
  InventoryItem,
  ActiveEffect,
  ItemType,
  Position,
  SavedPlayerData,
  AchievementProgress,
  ComboState,
} from 'shared';
import { SKILLS, PLAYER_COLORS, COMBO } from 'shared';

export class PlayerManager {
  private players: Map<string, Player> = new Map();
  private socketToPlayer: Map<string, string> = new Map();
  private effectTimers: Map<string, NodeJS.Timeout> = new Map(); // playerId:itemId -> timeout
  private skillTimers: Map<string, NodeJS.Timeout> = new Map(); // playerId:skillId -> timeout
  private feverTimers: Map<string, NodeJS.Timeout> = new Map(); // playerId -> fever timeout

  createPlayer(socketId: string, name: string, color?: string, savedData?: SavedPlayerData): Player {
    const id = savedData?.id ?? uuidv4();
    const playerColor = color ?? PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

    // Check if player already exists (reconnecting)
    const existingPlayer = this.players.get(id);
    if (existingPlayer) {
      // Reconnect: restore existing player with their score
      existingPlayer.name = name;
      existingPlayer.color = playerColor;
      existingPlayer.isOnline = true;
      existingPlayer.lastActivity = Date.now();
      this.socketToPlayer.set(socketId, id);
      console.log(`[PlayerManager] Player reconnected: ${name} (score: ${existingPlayer.score})`);
      return existingPlayer;
    }

    const skills: Record<SkillType, PlayerSkillState> = {
      scan: { skillId: 'scan', lastUsed: 0, isActive: false },
      shield: { skillId: 'shield', lastUsed: 0, isActive: false },
      chain: { skillId: 'chain', lastUsed: 0, isActive: false },
      vision: { skillId: 'vision', lastUsed: 0, isActive: false },
      mark: { skillId: 'mark', lastUsed: 0, isActive: false },
      speed: { skillId: 'speed', lastUsed: 0, isActive: false },
    };

    const player: Player = {
      id,
      name,
      color: playerColor,
      position: { x: 100, y: 100 }, // Start in safe zone
      viewportCenter: { x: 100, y: 100 },
      score: 0,
      stats: {
        cellsRevealed: 0,
        correctFlags: 0,
        minesTriggered: 0,
        score: 0,
        chainReveals: 0,
        itemsCollected: 0,
      },
      skills,
      items: [],
      activeEffects: [],
      isOnline: true,
      lastActivity: Date.now(),
      achievements: savedData?.achievements?.filter(a => a.completed).map(a => a.achievementId) ?? [],
      cooldownReduction: 0,
      scoreMultiplier: 1,
      isGhostMode: false,
      combo: {
        count: 0,
        multiplier: 1,
        lastRevealTime: 0,
        isFever: false,
      },
    };

    this.players.set(id, player);
    this.socketToPlayer.set(socketId, id);
    console.log(`[PlayerManager] New player created: ${name}`);

    return player;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getPlayerBySocket(socketId: string): Player | undefined {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return undefined;
    return this.players.get(playerId);
  }

  removePlayer(socketId: string): Player | undefined {
    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return undefined;

    const player = this.players.get(playerId);
    if (player) {
      player.isOnline = false;
      // Clear all timers for this player
      this.clearPlayerTimers(playerId);
    }

    this.socketToPlayer.delete(socketId);
    // Don't remove from players map - keep their data for session
    return player;
  }

  /**
   * Clear all timers associated with a player
   */
  private clearPlayerTimers(playerId: string): void {
    // Clear effect timers
    for (const [key, timer] of this.effectTimers) {
      if (key.startsWith(playerId + ':')) {
        clearTimeout(timer);
        this.effectTimers.delete(key);
      }
    }

    // Clear skill timers
    for (const [key, timer] of this.skillTimers) {
      if (key.startsWith(playerId + ':')) {
        clearTimeout(timer);
        this.skillTimers.delete(key);
      }
    }

    // Clear fever timer
    const feverTimer = this.feverTimers.get(playerId);
    if (feverTimer) {
      clearTimeout(feverTimer);
      this.feverTimers.delete(playerId);
    }
  }

  updatePosition(playerId: string, position: Position): void {
    const player = this.players.get(playerId);
    if (player) {
      player.position = position;
      player.viewportCenter = position;
      player.lastActivity = Date.now();
    }
  }

  addScore(playerId: string, points: number): number {
    const player = this.players.get(playerId);
    if (!player) return 0;

    const actualPoints = Math.round(points * player.scoreMultiplier);
    player.score += actualPoints;
    player.stats.score = player.score;
    player.lastActivity = Date.now();
    return actualPoints;
  }

  incrementStat(playerId: string, stat: keyof PlayerStats, amount: number = 1): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.stats[stat] += amount;
    player.lastActivity = Date.now();
  }

  // Skill Management
  canUseSkill(playerId: string, skillId: SkillType): { canUse: boolean; remainingCooldown: number } {
    const player = this.players.get(playerId);
    if (!player) return { canUse: false, remainingCooldown: 0 };

    const skillState = player.skills[skillId];
    const skill = SKILLS[skillId];
    const now = Date.now();
    const cooldownMs = skill.cooldown * 1000 * (1 - player.cooldownReduction);
    const elapsed = now - skillState.lastUsed;

    if (elapsed >= cooldownMs) {
      return { canUse: true, remainingCooldown: 0 };
    }

    return { canUse: false, remainingCooldown: cooldownMs - elapsed };
  }

  useSkill(playerId: string, skillId: SkillType): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    const { canUse } = this.canUseSkill(playerId, skillId);
    if (!canUse) return false;

    const skillState = player.skills[skillId];
    skillState.lastUsed = Date.now();
    skillState.isActive = true;

    const skill = SKILLS[skillId];
    if (skill.duration) {
      skillState.activeUntil = Date.now() + skill.duration * 1000;

      // Clear any existing timer for this skill
      const timerKey = `${playerId}:${skillId}`;
      const existingTimer = this.skillTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Auto-deactivate after duration (with tracked timer)
      const timer = setTimeout(() => {
        skillState.isActive = false;
        skillState.activeUntil = undefined;
        this.skillTimers.delete(timerKey);
      }, skill.duration * 1000);

      this.skillTimers.set(timerKey, timer);
    }

    return true;
  }

  isSkillActive(playerId: string, skillId: SkillType): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    const skillState = player.skills[skillId];
    if (!skillState.isActive) return false;

    const skill = SKILLS[skillId];
    if (skill.duration && skillState.activeUntil) {
      return Date.now() < skillState.activeUntil;
    }

    return skillState.isActive;
  }

  hasShield(playerId: string): boolean {
    return this.isSkillActive(playerId, 'shield');
  }

  consumeShield(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    const skills = player.skills as Record<SkillType, PlayerSkillState>;
    const skillState = skills.shield;
    if (!skillState.isActive) return false;

    // Verify the shield hasn't expired (race condition check)
    if (skillState.activeUntil && Date.now() >= skillState.activeUntil) {
      skillState.isActive = false;
      skillState.activeUntil = undefined;
      return false;
    }

    skillState.isActive = false;
    skillState.activeUntil = undefined;

    // Clear the shield timer since it was consumed
    const timerKey = `${playerId}:shield`;
    const existingTimer = this.skillTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.skillTimers.delete(timerKey);
    }

    return true;
  }

  // Item Management
  addItem(playerId: string, itemId: ItemType): void {
    const player = this.players.get(playerId);
    if (!player) return;

    const existingItem = player.items.find(i => i.itemId === itemId);
    if (existingItem) {
      existingItem.quantity++;
    } else {
      player.items.push({ itemId, quantity: 1 });
    }

    player.stats.itemsCollected++;
  }

  useItem(playerId: string, itemId: ItemType): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    const itemIndex = player.items.findIndex(i => i.itemId === itemId && i.quantity > 0);
    if (itemIndex === -1) return false;

    player.items[itemIndex].quantity--;
    if (player.items[itemIndex].quantity <= 0) {
      player.items.splice(itemIndex, 1);
    }

    return true;
  }

  addEffect(playerId: string, effect: ActiveEffect): ActiveEffect {
    const player = this.players.get(playerId);
    if (!player) return effect;

    const timerKey = `${playerId}:${effect.itemId}`;

    // Check for existing effect of same type
    const existingIndex = player.activeEffects.findIndex(e => e.itemId === effect.itemId);

    let finalEffect: ActiveEffect;

    if (existingIndex !== -1) {
      // Stack the effect - extend duration from current time
      const existing = player.activeEffects[existingIndex];
      const remainingTime = Math.max(0, existing.endTime - Date.now());
      const newDuration = effect.endTime - effect.startTime;

      finalEffect = {
        ...effect,
        startTime: Date.now(),
        endTime: Date.now() + remainingTime + newDuration,
        stackCount: (existing.stackCount ?? 1) + 1,
      };

      player.activeEffects[existingIndex] = finalEffect;

      // Cancel old timer
      const oldTimer = this.effectTimers.get(timerKey);
      if (oldTimer) {
        clearTimeout(oldTimer);
      }
    } else {
      // New effect
      finalEffect = {
        ...effect,
        stackCount: 1,
      };
      player.activeEffects.push(finalEffect);
    }

    // Apply effect with state validation
    switch (effect.itemId) {
      case 'double_points':
        player.scoreMultiplier = effect.value ?? 2;
        break;
      case 'ghost_mode':
        // Only apply if not already in ghost mode (prevent duplicate state transitions)
        if (!player.isGhostMode) {
          player.isGhostMode = true;
        }
        break;
      case 'cooldown_reduction':
        player.cooldownReduction = Math.min(0.9, player.cooldownReduction + (effect.value ?? 0.5));
        break;
    }

    // Auto-remove after duration
    const duration = finalEffect.endTime - Date.now();
    const timer = setTimeout(() => {
      this.removeEffect(playerId, effect.itemId);
      this.effectTimers.delete(timerKey);
    }, duration);

    this.effectTimers.set(timerKey, timer);

    return finalEffect;
  }

  removeEffect(playerId: string, itemId: ItemType): void {
    const player = this.players.get(playerId);
    if (!player) return;

    // Verify the effect actually exists before removing (race condition guard)
    const effectExists = player.activeEffects.some(e => e.itemId === itemId);
    if (!effectExists) return;

    player.activeEffects = player.activeEffects.filter(e => e.itemId !== itemId);

    // Remove effect
    switch (itemId) {
      case 'double_points':
        player.scoreMultiplier = 1;
        break;
      case 'ghost_mode':
        player.isGhostMode = false;
        break;
      case 'cooldown_reduction':
        // Keep the reduction permanent after use
        break;
    }
  }

  // Combo Management
  // Buffer for network latency (50ms) to prevent unfair combo resets
  private static readonly COMBO_LATENCY_BUFFER_MS = 50;

  updateCombo(playerId: string): { combo: ComboState; feverTriggered: boolean } {
    const player = this.players.get(playerId);
    if (!player) {
      return {
        combo: { count: 0, multiplier: 1, lastRevealTime: 0, isFever: false },
        feverTriggered: false,
      };
    }

    const now = Date.now();
    const timeSinceLastReveal = now - player.combo.lastRevealTime;

    // Check if combo should reset (with latency buffer)
    const effectiveTimeout = COMBO.TIMEOUT + PlayerManager.COMBO_LATENCY_BUFFER_MS;
    if (timeSinceLastReveal > effectiveTimeout && player.combo.count > 0) {
      player.combo = {
        count: 0,
        multiplier: 1,
        lastRevealTime: now,
        isFever: false,
      };
      return { combo: player.combo, feverTriggered: false };
    }

    // Increment combo
    player.combo.count++;
    player.combo.lastRevealTime = now;

    // Calculate multiplier based on combo count
    let multiplier = 1;
    for (const threshold of COMBO.MULTIPLIER_STEPS) {
      if (player.combo.count >= threshold) {
        multiplier++;
      }
    }
    player.combo.multiplier = Math.min(multiplier, COMBO.MAX_MULTIPLIER);

    // Check for fever mode
    let feverTriggered = false;
    if (player.combo.count >= COMBO.FEVER_THRESHOLD && !player.combo.isFever) {
      player.combo.isFever = true;
      player.combo.feverEndTime = now + COMBO.FEVER_DURATION;
      feverTriggered = true;

      // Clear any existing fever timer
      const existingFeverTimer = this.feverTimers.get(playerId);
      if (existingFeverTimer) {
        clearTimeout(existingFeverTimer);
      }

      // Auto-end fever (with tracked timer)
      const feverTimer = setTimeout(() => {
        this.endFever(playerId);
        this.feverTimers.delete(playerId);
      }, COMBO.FEVER_DURATION);

      this.feverTimers.set(playerId, feverTimer);
    }

    return { combo: player.combo, feverTriggered };
  }

  resetCombo(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.combo = {
        count: 0,
        multiplier: 1,
        lastRevealTime: 0,
        isFever: false,
      };
    }
  }

  endFever(playerId: string): void {
    const player = this.players.get(playerId);
    if (player && player.combo.isFever) {
      player.combo.isFever = false;
      player.combo.feverEndTime = undefined;
    }
  }

  getComboMultiplier(playerId: string): number {
    const player = this.players.get(playerId);
    if (!player) return 1;

    // During fever, use fever multiplier
    if (player.combo.isFever) {
      return COMBO.FEVER_MULTIPLIER;
    }

    return player.combo.multiplier;
  }

  // Achievement Management
  addAchievement(playerId: string, achievementId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    if (!player.achievements.includes(achievementId)) {
      player.achievements.push(achievementId);
      return true;
    }
    return false;
  }

  // Guild Management
  setGuild(playerId: string, guildId: string | undefined): void {
    const player = this.players.get(playerId);
    if (player) {
      player.guildId = guildId;
    }
  }

  getGuild(playerId: string): string | undefined {
    return this.players.get(playerId)?.guildId;
  }

  // Socket Mapping
  getSocketIdByPlayerId(playerId: string): string | undefined {
    for (const [socketId, pId] of this.socketToPlayer.entries()) {
      if (pId === playerId) {
        return socketId;
      }
    }
    return undefined;
  }

  getSocketPlayerMap(): Map<string, string> {
    return new Map(this.socketToPlayer);
  }

  // Utility
  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getOnlinePlayers(): Player[] {
    return Array.from(this.players.values()).filter(p => p.isOnline);
  }

  getPlayerCount(): number {
    return this.getOnlinePlayers().length;
  }

  getLeaderboard(limit: number = 10): Player[] {
    return this.getOnlinePlayers()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Serialize for client
  serializePlayer(player: Player): Player {
    return {
      ...player,
      skills: player.skills,
    };
  }

  // Reset all players for new session
  resetForNewSession(): void {
    // Clear all timers first
    this.clearAllTimers();

    // Keep all players (including offline) - don't delete anyone
    // This allows players to reconnect and keep their accumulated score

    // Reset all session data including score for new map
    for (const player of this.players.values()) {
      // Reset score for new session/map
      player.score = 0;

      // Reset all stats
      player.stats.score = 0;
      player.stats.cellsRevealed = 0;
      player.stats.correctFlags = 0;
      player.stats.minesTriggered = 0;
      player.stats.chainReveals = 0;
      player.stats.itemsCollected = 0;

      player.items = [];
      player.activeEffects = [];
      player.cooldownReduction = 0;
      player.scoreMultiplier = 1;
      player.isGhostMode = false;
      player.combo = {
        count: 0,
        multiplier: 1,
        lastRevealTime: 0,
        isFever: false,
      };

      // Reset skill cooldowns
      for (const skillId of Object.keys(player.skills) as SkillType[]) {
        player.skills[skillId] = {
          skillId,
          lastUsed: 0,
          isActive: false,
        };
      }
    }
  }

  /**
   * Clear all timers (for session reset or shutdown)
   */
  private clearAllTimers(): void {
    // Clear all effect timers
    for (const timer of this.effectTimers.values()) {
      clearTimeout(timer);
    }
    this.effectTimers.clear();

    // Clear all skill timers
    for (const timer of this.skillTimers.values()) {
      clearTimeout(timer);
    }
    this.skillTimers.clear();

    // Clear all fever timers
    for (const timer of this.feverTimers.values()) {
      clearTimeout(timer);
    }
    this.feverTimers.clear();
  }

  /**
   * Cleanup method for graceful shutdown
   */
  cleanup(): void {
    this.clearAllTimers();
  }
}

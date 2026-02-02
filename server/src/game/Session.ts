import { v4 as uuidv4 } from 'uuid';
import {
  Session,
  SessionState,
  SessionEndData,
  LeaderboardEntry,
  GuildLeaderboardEntry,
} from 'shared';
import { MAP_WIDTH, MAP_HEIGHT, SESSION } from 'shared';
import { GameMap } from './GameMap.js';
import { PlayerManager } from './Player.js';
import { GuildManager } from './Guild.js';

export class SessionManager {
  private currentSession: Session | null = null;
  private gameMap: GameMap | null = null;
  private minesExploded = 0;
  private sessionTimer: NodeJS.Timeout | null = null;
  private onSessionEnd: ((data: SessionEndData) => void) | null = null;
  private onSessionNew: ((session: Session) => void) | null = null;

  constructor(
    private playerManager: PlayerManager,
    private guildManager: GuildManager
  ) {}

  setCallbacks(
    onSessionEnd: (data: SessionEndData) => void,
    onSessionNew: (session: Session) => void
  ): void {
    this.onSessionEnd = onSessionEnd;
    this.onSessionNew = onSessionNew;
  }

  startNewSession(): Session {
    // Clean up old session
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    // Reset state
    this.minesExploded = 0;
    this.playerManager.resetForNewSession();

    // Create new map
    this.gameMap = new GameMap();

    // Create session
    this.currentSession = {
      id: uuidv4(),
      state: 'active',
      startTime: Date.now(),
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      totalMines: this.gameMap.getTotalMines(),
      minesExploded: 0,
      cellsRevealed: 0,
      totalCells: this.gameMap.getTotalCells(),
      playerCount: this.playerManager.getPlayerCount(),
    };

    // Set session timeout
    this.sessionTimer = setTimeout(() => {
      this.endSession('time_limit');
    }, SESSION.MAX_DURATION);

    return this.currentSession;
  }

  getSession(): Session | null {
    return this.currentSession;
  }

  getGameMap(): GameMap | null {
    return this.gameMap;
  }

  updateSession(): void {
    if (!this.currentSession || !this.gameMap) return;

    this.currentSession.cellsRevealed = this.gameMap.getRevealedCells();
    this.currentSession.minesExploded = this.minesExploded;
    this.currentSession.playerCount = this.playerManager.getPlayerCount();
  }

  recordMineExplosion(): boolean {
    if (!this.currentSession || !this.gameMap) return false;

    this.minesExploded++;
    this.currentSession.minesExploded = this.minesExploded;

    // Check if session should end
    const explosionRatio = this.minesExploded / this.currentSession.totalMines;
    if (explosionRatio >= SESSION.MINES_EXPLODED_THRESHOLD) {
      this.endSession('mines_exploded');
      return true;
    }

    return false;
  }

  checkMapCleared(): boolean {
    if (!this.currentSession || !this.gameMap) return false;

    const progress = this.gameMap.getRevealProgress();
    if (progress >= SESSION.MAP_CLEARED_THRESHOLD) {
      this.endSession('map_cleared');
      return true;
    }

    return false;
  }

  private endSession(reason: 'mines_exploded' | 'map_cleared' | 'time_limit'): void {
    if (!this.currentSession) return;

    this.currentSession.state = 'ending';
    this.currentSession.endReason = reason;

    // Generate leaderboard
    const leaderboard = this.generateLeaderboard();
    const guildLeaderboard = this.generateGuildLeaderboard();

    const endData: SessionEndData = {
      session: { ...this.currentSession },
      leaderboard,
      guildLeaderboard,
      topAchievements: [],
    };

    // Notify callback
    if (this.onSessionEnd) {
      this.onSessionEnd(endData);
    }

    // Schedule new session
    setTimeout(() => {
      this.currentSession!.state = 'finished';
      this.currentSession!.endTime = Date.now();

      setTimeout(() => {
        const newSession = this.startNewSession();
        if (this.onSessionNew) {
          this.onSessionNew(newSession);
        }
      }, SESSION.NEW_SESSION_DELAY);
    }, SESSION.ENDING_COUNTDOWN * 1000);
  }

  private generateLeaderboard(): LeaderboardEntry[] {
    const players = this.playerManager.getLeaderboard(100);

    return players.map((player, index) => {
      const guild = player.guildId ? this.guildManager.getGuild(player.guildId) : undefined;

      return {
        rank: index + 1,
        playerId: player.id,
        playerName: player.name,
        playerColor: player.color,
        score: player.score,
        cellsRevealed: player.stats.cellsRevealed,
        guildTag: guild?.tag,
      };
    });
  }

  private generateGuildLeaderboard(): GuildLeaderboardEntry[] {
    const guilds = this.guildManager.getAllGuilds();
    const guildScores: Map<string, { score: number; members: number; chunks: number }> = new Map();

    // Calculate guild scores from members
    for (const player of this.playerManager.getAllPlayers()) {
      if (player.guildId) {
        const existing = guildScores.get(player.guildId) || { score: 0, members: 0, chunks: 0 };
        existing.score += player.score;
        guildScores.set(player.guildId, existing);
      }
    }

    // Add guild info
    for (const guild of guilds) {
      const existing = guildScores.get(guild.id) || { score: 0, members: 0, chunks: 0 };
      existing.members = guild.memberIds.length;
      existing.chunks = guild.chunksOwned.length;
      guildScores.set(guild.id, existing);
    }

    // Sort and create entries
    return guilds
      .map(guild => {
        const data = guildScores.get(guild.id) || { score: 0, members: 0, chunks: 0 };
        return {
          rank: 0,
          guildId: guild.id,
          guildName: guild.name,
          guildTag: guild.tag,
          guildColor: guild.color,
          totalScore: data.score,
          memberCount: data.members,
          chunksOwned: data.chunks,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
      .slice(0, 20);
  }

  isActive(): boolean {
    return this.currentSession?.state === 'active';
  }

  getState(): SessionState {
    return this.currentSession?.state ?? 'waiting';
  }
}

import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  Position,
  ChunkCoord,
  SkillType,
  ItemType,
  PlayerCursor,
  ChatMessage,
  Notification,
  LeaderboardEntry,
  Cell,
  TreasureCell,
} from 'shared';
import { SCORES, NETWORK, EMOJI_REACTIONS, COMBO, TREASURE, MAX_PLAYERS } from 'shared';
import { SERVER_EVENTS, CLIENT_EVENTS } from './events.js';
import {
  GameMap,
  PlayerManager,
  SessionManager,
  SkillManager,
  ItemManager,
  GuildManager,
} from '../game/index.js';
import { TreasureManager } from '../game/Treasure.js';
import { saveSessionHistory, getSessionHistory, getSessionDetail } from '../supabase/sessionHistory.js';
import { GameRateLimiters, checkRateLimit } from '../utils/RateLimiter.js';
import { positionValidator } from '../utils/PositionValidator.js';
import { InputValidator } from '../utils/InputValidator.js';

export class SocketHandlers {
  private cursorUpdateInterval: NodeJS.Timeout | null = null;
  private leaderboardUpdateInterval: NodeJS.Timeout | null = null;
  private playerCursors: Map<string, PlayerCursor> = new Map();
  private treasureManager: TreasureManager;
  private peakPlayerCount: number = 0;

  constructor(
    private io: Server,
    private playerManager: PlayerManager,
    private sessionManager: SessionManager,
    private skillManager: SkillManager,
    private itemManager: ItemManager,
    private guildManager: GuildManager
  ) {
    this.startCursorBroadcast();
    this.startLeaderboardBroadcast();

    // Initialize treasure system
    this.treasureManager = new TreasureManager(
      (treasure) => this.onTreasureSpawn(treasure),
      (treasureId) => this.onTreasureExpire(treasureId)
    );
    this.treasureManager.start();
  }

  private onTreasureSpawn(treasure: TreasureCell): void {
    this.io.emit('treasure:spawned', treasure);

    // Broadcast notification
    const emoji = TREASURE.EMOJIS[treasure.type];
    const timeLeft = Math.ceil((treasure.expireTime - Date.now()) / 1000);
    this.broadcastNotification({
      id: uuidv4(),
      type: 'item',
      message: `${emoji} 보물이 나타났습니다! (${timeLeft}초)`,
      timestamp: Date.now(),
      duration: 5000,
    });
  }

  private onTreasureExpire(treasureId: string): void {
    this.io.emit('treasure:expired', { treasureId });
  }

  setupSocketHandlers(socket: Socket): void {
    // Connection events
    socket.on(CLIENT_EVENTS.PLAYER_JOIN, (data) => this.handlePlayerJoin(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));
    socket.on(CLIENT_EVENTS.PLAYER_HEARTBEAT, () => this.handleHeartbeat(socket));
    socket.on(CLIENT_EVENTS.PLAYER_UPDATE_POSITION, (data) => this.handlePositionUpdate(socket, data));

    // Game actions
    socket.on(CLIENT_EVENTS.CELL_REVEAL, (data) => this.handleCellReveal(socket, data));
    socket.on(CLIENT_EVENTS.CELL_FLAG, (data) => this.handleCellFlag(socket, data));
    socket.on(CLIENT_EVENTS.CHUNK_REQUEST, (data) => this.handleChunkRequest(socket, data));

    // Skills
    socket.on(CLIENT_EVENTS.SKILL_USE, (data) => this.handleSkillUse(socket, data));

    // Items
    socket.on(CLIENT_EVENTS.ITEM_USE, (data) => this.handleItemUse(socket, data));

    // Guild
    socket.on(CLIENT_EVENTS.GUILD_CREATE, (data) => this.handleGuildCreate(socket, data));
    socket.on(CLIENT_EVENTS.GUILD_JOIN, (data) => this.handleGuildJoin(socket, data));
    socket.on(CLIENT_EVENTS.GUILD_LEAVE, () => this.handleGuildLeave(socket));
    socket.on(CLIENT_EVENTS.GUILD_INVITE, (data) => this.handleGuildInvite(socket, data));
    socket.on(CLIENT_EVENTS.GUILD_KICK, (data) => this.handleGuildKick(socket, data));

    // Chat
    socket.on(CLIENT_EVENTS.CHAT_SEND, (data) => this.handleChatSend(socket, data));

    // Session History
    socket.on('session_history:request', (data) => this.handleSessionHistoryRequest(socket, data));
    socket.on('session_history:detail', (data) => this.handleSessionHistoryDetail(socket, data));
  }

  // ==================== Connection Handlers ====================

  private handlePlayerJoin(
    socket: Socket,
    data: { name: string; color: string; savedData?: unknown }
  ): void {
    // Validate inputs
    const nameResult = InputValidator.validatePlayerName(data.name);
    if (!nameResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: nameResult.error });
      return;
    }

    const colorResult = InputValidator.validateColor(data.color);
    if (!colorResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: colorResult.error });
      return;
    }

    // Check max player limit
    if (this.playerManager.getPlayerCount() >= MAX_PLAYERS) {
      socket.emit(SERVER_EVENTS.ERROR, { message: '서버가 가득 찼습니다. 나중에 다시 시도해주세요.' });
      return;
    }

    console.log('[Server] Player joining:', { name: nameResult.sanitized, socketId: socket.id });

    const player = this.playerManager.createPlayer(
      socket.id,
      nameResult.sanitized!,
      colorResult.sanitized!,
      data.savedData as any
    );

    // Initialize position validator for this player
    positionValidator.initializePlayer(player.id, player.position);

    console.log('[Server] Player created:', { id: player.id, name: player.name });

    // Send current session state
    const session = this.sessionManager.getSession();
    if (session) {
      socket.emit(SERVER_EVENTS.SESSION_STATE, session);
    }

    // Send player data back
    socket.emit(SERVER_EVENTS.PLAYER_SYNC, { player: this.playerManager.serializePlayer(player) });

    // Send existing treasures
    const treasures = this.treasureManager.getAllTreasures();
    if (treasures.length > 0) {
      socket.emit('treasure:list', treasures);
    }

    // Broadcast to others
    socket.broadcast.emit(SERVER_EVENTS.PLAYER_JOINED, {
      player: { id: player.id, name: player.name, color: player.color },
      playerCount: this.playerManager.getPlayerCount(),
    });

    // Update peak player count for session history
    this.updatePeakPlayerCount();

    // Initialize cursor
    this.playerCursors.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      color: player.color,
      position: player.position,
      lastUpdate: Date.now(),
    });

    // Send notification
    this.broadcastNotification({
      id: uuidv4(),
      type: 'info',
      message: `${player.name}님이 게임에 참가했습니다!`,
      timestamp: Date.now(),
      duration: 3000,
    });
  }

  private handleDisconnect(socket: Socket): void {
    const player = this.playerManager.removePlayer(socket.id);
    if (player) {
      this.playerCursors.delete(player.id);
      positionValidator.removePlayer(player.id);

      this.io.emit(SERVER_EVENTS.PLAYER_LEFT, {
        playerId: player.id,
        playerCount: this.playerManager.getPlayerCount(),
      });
    }
  }

  private handleHeartbeat(socket: Socket): void {
    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (player) {
      player.lastActivity = Date.now();
    }
  }

  private handlePositionUpdate(socket: Socket, position: Position): void {
    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    // Rate limiting
    const rateCheck = checkRateLimit(GameRateLimiters.positionUpdate, socket.id, '위치 업데이트');
    if (!rateCheck.allowed) return;

    // Validate position
    const posResult = InputValidator.validatePosition(position);
    if (!posResult.valid) return;

    // Validate movement (anti-cheat)
    const validationResult = positionValidator.validatePosition(player.id, posResult.position!);
    const finalPosition = validationResult.correctedPosition || posResult.position!;

    this.playerManager.updatePosition(player.id, finalPosition);

    // Update cursor
    const cursor = this.playerCursors.get(player.id);
    if (cursor) {
      cursor.position = finalPosition;
      cursor.lastUpdate = Date.now();
    }
  }

  // ==================== Game Action Handlers ====================

  private handleCellReveal(socket: Socket, position: Position): void {
    // Rate limiting
    const rateCheck = checkRateLimit(GameRateLimiters.cellReveal, socket.id, '셀 공개');
    if (!rateCheck.allowed) {
      socket.emit(SERVER_EVENTS.ERROR, { message: rateCheck.message });
      return;
    }

    // Validate position
    const posResult = InputValidator.validatePosition(position);
    if (!posResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: posResult.error });
      return;
    }

    console.log('[Server] cell:reveal received', { position: posResult.position, socketId: socket.id });

    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) {
      console.log('[Server] No player found for socket', socket.id);
      return;
    }

    const gameMap = this.sessionManager.getGameMap();
    if (!gameMap || !this.sessionManager.isActive()) {
      console.log('[Server] No active game map');
      return;
    }

    const result = gameMap.revealCell(posResult.position!.x, posResult.position!.y, player.id);

    if (result.hitMine) {
      // Check for shield
      if (this.skillManager.checkShield(player.id)) {
        // Shield blocked the mine
        this.broadcastNotification({
          id: uuidv4(),
          type: 'info',
          message: `${player.name}의 보호막이 지뢰를 막았습니다!`,
          timestamp: Date.now(),
          duration: 3000,
        });
        return;
      }

      // Reset combo on mine hit
      this.playerManager.resetCombo(player.id);
      const resetCombo = this.playerManager.getPlayer(player.id)?.combo ?? {
        count: 0,
        multiplier: 1,
        lastRevealTime: Date.now(),
        isFever: false,
      };
      socket.emit('combo:update', { playerId: player.id, combo: resetCombo });

      // Mine exploded
      this.playerManager.addScore(player.id, SCORES.MINE_PENALTY);
      this.playerManager.incrementStat(player.id, 'minesTriggered');

      // Send the mine cell data so client can render it
      if (result.cells.length > 0) {
        this.io.emit(SERVER_EVENTS.CELL_REVEALED, {
          cells: result.cells,
          playerId: player.id,
          score: SCORES.MINE_PENALTY,
        });
      }

      this.io.emit(SERVER_EVENTS.MINE_EXPLODED, {
        position,
        playerId: player.id,
        minesExploded: this.sessionManager.getSession()?.minesExploded ?? 0,
      });

      // Broadcast notification
      this.broadcastNotification({
        id: uuidv4(),
        type: 'warning',
        message: `💥 ${player.name}님이 지뢰를 밟았습니다!`,
        timestamp: Date.now(),
        duration: 3000,
      });

      // Check session end condition and broadcast updated session
      this.sessionManager.recordMineExplosion();
      const session = this.sessionManager.getSession();
      if (session) {
        this.io.emit(SERVER_EVENTS.SESSION_STATE, session);
      }
    } else if (result.cells.length > 0) {
      // Update combo
      const { combo, feverTriggered } = this.playerManager.updateCombo(player.id);
      socket.emit('combo:update', { playerId: player.id, combo });

      if (feverTriggered) {
        // Notify player of fever mode
        this.io.emit('combo:fever', { playerId: player.id, feverEndTime: combo.feverEndTime });
        this.broadcastNotification({
          id: uuidv4(),
          type: 'success',
          message: `🔥 ${player.name}님이 피버 모드 돌입! (x${COMBO.FEVER_MULTIPLIER})`,
          timestamp: Date.now(),
          duration: 3000,
        });
      }

      // Apply chain reveal if active
      let cells = result.cells;
      if (this.skillManager.isSkillActive(player.id, 'chain')) {
        cells = this.skillManager.performChainReveal(cells, player.id);
      }

      // Calculate score with combo multiplier
      const zone = gameMap.getZoneTypeForPosition(position.x, position.y);
      const multiplier = gameMap.getScoreMultiplier(position.x, position.y);
      const comboMultiplier = this.playerManager.getComboMultiplier(player.id);
      const isChain = cells.length > 1;
      const chainMultiplier = isChain ? SCORES.CHAIN_MULTIPLIER : 1;
      const baseScore = cells.length * SCORES.CELL_REVEAL;
      const score = Math.round(baseScore * multiplier * chainMultiplier * comboMultiplier);

      const actualScore = this.playerManager.addScore(player.id, score);
      this.playerManager.incrementStat(player.id, 'cellsRevealed', cells.length);

      if (isChain) {
        this.playerManager.incrementStat(player.id, 'chainReveals');
      }

      console.log(`[Server] Revealing ${cells.length} cells for ${player.name}, score: ${actualScore}, combo: ${combo.count}`);

      // Broadcast cell reveal
      this.io.emit(SERVER_EVENTS.CELL_REVEALED, {
        cells,
        playerId: player.id,
        score: actualScore,
      });

      // Notify player if flood fill was truncated
      if (result.truncated) {
        socket.emit(SERVER_EVENTS.NOTIFICATION_BROADCAST, {
          id: uuidv4(),
          type: 'info',
          message: `연속 공개가 최대 ${cells.length}개로 제한되었습니다. 주변을 계속 탐색해주세요.`,
          timestamp: Date.now(),
          duration: 3000,
        });
      }

      // Check for treasure collection
      for (const cell of cells) {
        const treasure = this.treasureManager.getTreasureNearPosition(cell, 0);
        if (treasure) {
          const collected = this.treasureManager.collectTreasure(treasure.id, player.id);
          if (collected) {
            const treasureScore = this.playerManager.addScore(player.id, collected.reward);
            const emoji = TREASURE.EMOJIS[collected.type];

            this.io.emit('treasure:collected', {
              treasureId: collected.id,
              playerId: player.id,
              playerName: player.name,
              reward: treasureScore,
            });

            this.broadcastNotification({
              id: uuidv4(),
              type: 'success',
              message: `${emoji} ${player.name}님이 보물 획득! +${treasureScore}점`,
              timestamp: Date.now(),
              duration: 3000,
            });
          }
        }
      }

      // Check for item drops
      this.checkItemDrops(cells, player.id);

      // Update session and broadcast
      this.sessionManager.updateSession();
      const session = this.sessionManager.getSession();
      if (session) {
        this.io.emit(SERVER_EVENTS.SESSION_STATE, session);
      }
      this.sessionManager.checkMapCleared();
    }
  }

  private handleCellFlag(socket: Socket, position: Position): void {
    // Rate limiting
    const rateCheck = checkRateLimit(GameRateLimiters.cellFlag, socket.id, '깃발');
    if (!rateCheck.allowed) {
      socket.emit(SERVER_EVENTS.ERROR, { message: rateCheck.message });
      return;
    }

    // Validate position
    const posResult = InputValidator.validatePosition(position);
    if (!posResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: posResult.error });
      return;
    }

    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    const gameMap = this.sessionManager.getGameMap();
    if (!gameMap || !this.sessionManager.isActive()) return;

    const cell = gameMap.flagCell(posResult.position!.x, posResult.position!.y, player.id);
    if (!cell) return;

    // Check if flag is correct
    if (cell.state === 'flagged' && cell.isMine) {
      this.playerManager.addScore(player.id, SCORES.CORRECT_FLAG);
      this.playerManager.incrementStat(player.id, 'correctFlags');
    }

    this.io.emit(SERVER_EVENTS.CELL_FLAGGED, {
      cell,
      playerId: player.id,
    });
  }

  private handleChunkRequest(socket: Socket, coord: ChunkCoord): void {
    // Rate limiting
    const rateCheck = checkRateLimit(GameRateLimiters.chunkRequest, socket.id, '청크 요청');
    if (!rateCheck.allowed) return;

    // Validate chunk coord
    const coordResult = InputValidator.validateChunkCoord(coord);
    if (!coordResult.valid) return;

    const gameMap = this.sessionManager.getGameMap();
    if (!gameMap) return;

    const chunk = gameMap.serializeChunk(coordResult.coord!);
    if (chunk) {
      socket.emit(SERVER_EVENTS.CHUNK_DATA, { chunk });
    }
  }

  // ==================== Skill Handlers ====================

  private handleSkillUse(
    socket: Socket,
    data: { skillId: SkillType; targetPosition?: Position }
  ): void {
    // Rate limiting
    const rateCheck = checkRateLimit(GameRateLimiters.skillUse, socket.id, '스킬 사용');
    if (!rateCheck.allowed) {
      socket.emit(SERVER_EVENTS.ERROR, { message: rateCheck.message });
      return;
    }

    // Validate skill ID
    const skillResult = InputValidator.validateSkillId(data.skillId);
    if (!skillResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: skillResult.error });
      return;
    }

    // Validate target position if provided
    let targetPosition = data.targetPosition;
    if (targetPosition) {
      const posResult = InputValidator.validatePosition(targetPosition);
      if (!posResult.valid) {
        socket.emit(SERVER_EVENTS.ERROR, { message: posResult.error });
        return;
      }
      targetPosition = posResult.position;
    }

    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    const result = this.skillManager.useSkill(player.id, skillResult.skillId!, targetPosition);

    socket.emit(SERVER_EVENTS.SKILL_USED, result);

    if (result.success && result.affectedCells && result.affectedCells.length > 0) {
      // Broadcast skill effect to all players
      this.io.emit(SERVER_EVENTS.SKILL_EFFECT, {
        skillId: data.skillId,
        playerId: player.id,
        cells: result.affectedCells,
      });
    }
  }

  // ==================== Item Handlers ====================

  private checkItemDrops(cells: Cell[], playerId: string): void {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) return;

    const guild = player.guildId ? this.guildManager.getGuild(player.guildId) : undefined;
    const guildBonus = guild ? this.guildManager.getGuildBuff(guild.id).itemDropBonus : 0;

    const collectedItems: string[] = [];

    for (const cell of cells) {
      const drop = this.itemManager.checkItemDrop({ x: cell.x, y: cell.y }, playerId, guildBonus);
      if (drop) {
        // Auto-collect
        this.itemManager.collectItem(playerId, drop.itemId);
        collectedItems.push(drop.itemId);

        this.io.emit(SERVER_EVENTS.ITEM_COLLECTED, {
          playerId,
          itemId: drop.itemId,
        });
      }
    }

    // Send a single batched notification if any items were collected
    if (collectedItems.length > 0) {
      const message = collectedItems.length === 1
        ? `${player.name}님이 아이템을 획득했습니다!`
        : `${player.name}님이 아이템 ${collectedItems.length}개를 획득했습니다!`;

      this.broadcastNotification({
        id: uuidv4(),
        type: 'item',
        message,
        timestamp: Date.now(),
        duration: 2000,
      });
    }
  }

  private handleItemUse(socket: Socket, data: { itemId: ItemType }): void {
    // Rate limiting
    const rateCheck = checkRateLimit(GameRateLimiters.itemUse, socket.id, '아이템 사용');
    if (!rateCheck.allowed) {
      socket.emit(SERVER_EVENTS.ERROR, { message: rateCheck.message });
      return;
    }

    // Validate item ID
    const itemResult = InputValidator.validateItemId(data.itemId);
    if (!itemResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: itemResult.error });
      return;
    }

    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    const result = this.itemManager.useItem(player.id, itemResult.itemId!);

    if (result.success) {
      // Send updated inventory to the player
      socket.emit(SERVER_EVENTS.ITEM_USED, {
        playerId: player.id,
        itemId: data.itemId,
        inventory: player.items,
      });

      if (result.effect) {
        socket.emit(SERVER_EVENTS.EFFECT_STARTED, {
          playerId: player.id,
          effect: result.effect,
        });
      }

      // For magnet, collect nearby items
      if (data.itemId === 'magnet') {
        const collected = this.itemManager.collectNearbyItems(player.id, player.position, 5);
        for (const item of collected) {
          this.io.emit(SERVER_EVENTS.ITEM_COLLECTED, {
            playerId: player.id,
            itemId: item.itemId,
          });
        }
      }
    }

    socket.emit(SERVER_EVENTS.NOTIFICATION_BROADCAST, {
      id: uuidv4(),
      type: result.success ? 'success' : 'error',
      message: result.message || (result.success ? 'Item used' : 'Failed to use item'),
      timestamp: Date.now(),
      duration: 2000,
    });
  }

  // ==================== Guild Handlers ====================

  private handleGuildCreate(
    socket: Socket,
    data: { name: string; tag: string; color: string }
  ): void {
    // Rate limiting
    const rateCheck = checkRateLimit(GameRateLimiters.guildAction, socket.id, '길드 생성');
    if (!rateCheck.allowed) {
      socket.emit(SERVER_EVENTS.ERROR, { message: rateCheck.message });
      return;
    }

    // Validate inputs
    const nameResult = InputValidator.validateGuildName(data.name);
    if (!nameResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: nameResult.error });
      return;
    }

    const tagResult = InputValidator.validateGuildTag(data.tag);
    if (!tagResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: tagResult.error });
      return;
    }

    const colorResult = InputValidator.validateColor(data.color);
    if (!colorResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: colorResult.error });
      return;
    }

    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    const result = this.guildManager.createGuild(
      player.id,
      nameResult.sanitized!,
      tagResult.sanitized!,
      colorResult.sanitized!
    );

    if (result.success && result.guild) {
      this.io.emit(SERVER_EVENTS.GUILD_CREATED, result.guild);

      this.broadcastNotification({
        id: uuidv4(),
        type: 'success',
        message: `길드 [${result.guild.tag}] ${result.guild.name}이(가) 창설되었습니다!`,
        timestamp: Date.now(),
        duration: 3000,
      });
    } else {
      socket.emit(SERVER_EVENTS.ERROR, { message: result.error });
    }
  }

  private handleGuildJoin(socket: Socket, data: { guildId: string }): void {
    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    const result = this.guildManager.joinGuild(player.id, data.guildId);

    if (result.success) {
      const guild = this.guildManager.getGuild(data.guildId);
      if (guild) {
        this.io.emit(SERVER_EVENTS.GUILD_MEMBER_JOINED, {
          guildId: data.guildId,
          playerId: player.id,
          playerName: player.name,
        });
        this.io.emit(SERVER_EVENTS.GUILD_UPDATED, guild);
      }
    } else {
      socket.emit(SERVER_EVENTS.ERROR, { message: result.error });
    }
  }

  private handleGuildLeave(socket: Socket): void {
    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    const guildId = player.guildId;
    const result = this.guildManager.leaveGuild(player.id);

    if (result.success && guildId) {
      this.io.emit(SERVER_EVENTS.GUILD_MEMBER_LEFT, {
        guildId,
        playerId: player.id,
      });

      if (!result.disbanded) {
        const guild = this.guildManager.getGuild(guildId);
        if (guild) {
          this.io.emit(SERVER_EVENTS.GUILD_UPDATED, guild);
        }
      }
    }
  }

  private handleGuildInvite(socket: Socket, data: { playerId: string }): void {
    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    const result = this.guildManager.invitePlayer(player.id, data.playerId);

    if (result.success && result.invite) {
      // Find target player's socket and send invite
      const targetSocketId = this.getSocketIdForPlayer(data.playerId);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit(SERVER_EVENTS.GUILD_INVITE, result.invite);
      }
    } else {
      socket.emit(SERVER_EVENTS.ERROR, { message: result.error });
    }
  }

  private handleGuildKick(socket: Socket, data: { playerId: string }): void {
    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    const result = this.guildManager.kickMember(player.id, data.playerId);

    if (result.success) {
      const guild = this.guildManager.getGuildByPlayer(player.id);
      if (guild) {
        this.io.emit(SERVER_EVENTS.GUILD_MEMBER_LEFT, {
          guildId: guild.id,
          playerId: data.playerId,
        });
        this.io.emit(SERVER_EVENTS.GUILD_UPDATED, guild);
      }
    } else {
      socket.emit(SERVER_EVENTS.ERROR, { message: result.error });
    }
  }

  // Helper to get socket-player mapping
  private getSocketPlayerMap(): Map<string, string> {
    return this.playerManager.getSocketPlayerMap();
  }

  // Helper to get socket ID for a specific player
  private getSocketIdForPlayer(playerId: string): string | undefined {
    return this.playerManager.getSocketIdByPlayerId(playerId);
  }

  // ==================== Chat Handlers ====================

  private handleChatSend(
    socket: Socket,
    data: { content: string; isEmoji: boolean; guildOnly?: boolean }
  ): void {
    // Rate limiting
    const rateCheck = checkRateLimit(GameRateLimiters.chat, socket.id, '채팅');
    if (!rateCheck.allowed) {
      socket.emit(SERVER_EVENTS.ERROR, { message: rateCheck.message });
      return;
    }

    const player = this.playerManager.getPlayerBySocket(socket.id);
    if (!player) return;

    // Validate content using InputValidator
    const chatResult = InputValidator.validateChatMessage(data.content, data.isEmoji);
    if (!chatResult.valid) {
      socket.emit(SERVER_EVENTS.ERROR, { message: chatResult.error });
      return;
    }

    // If emoji, validate it's in allowed list
    if (data.isEmoji && !EMOJI_REACTIONS.includes(chatResult.content!)) {
      return;
    }

    const message: ChatMessage = {
      id: uuidv4(),
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      content: chatResult.content!,
      timestamp: Date.now(),
      isEmoji: data.isEmoji,
      guildOnly: data.guildOnly,
    };

    if (data.guildOnly && player.guildId) {
      // Send only to guild members
      const guild = this.guildManager.getGuild(player.guildId);
      if (guild) {
        for (const memberId of guild.memberIds) {
          // Find member's socket and emit
          for (const s of this.io.sockets.sockets.values()) {
            const p = this.playerManager.getPlayerBySocket(s.id);
            if (p && p.id === memberId) {
              s.emit(SERVER_EVENTS.CHAT_MESSAGE, message);
            }
          }
        }
      }
    } else {
      this.io.emit(SERVER_EVENTS.CHAT_MESSAGE, message);
    }
  }

  // ==================== Broadcast Utilities ====================

  private broadcastNotification(notification: Notification): void {
    this.io.emit(SERVER_EVENTS.NOTIFICATION_BROADCAST, notification);
  }

  private startCursorBroadcast(): void {
    this.cursorUpdateInterval = setInterval(() => {
      const cursors: PlayerCursor[] = [];

      for (const player of this.playerManager.getOnlinePlayers()) {
        if (player.isGhostMode) continue;

        const cursor = this.playerCursors.get(player.id);
        if (cursor) {
          cursors.push(cursor);
        }
      }

      if (cursors.length > 0) {
        this.io.emit(SERVER_EVENTS.CURSOR_UPDATE, cursors);
      }
    }, NETWORK.CURSOR_UPDATE_INTERVAL);
  }

  private startLeaderboardBroadcast(): void {
    this.leaderboardUpdateInterval = setInterval(() => {
      const players = this.playerManager.getLeaderboard(20);
      const leaderboard: LeaderboardEntry[] = players.map((player, index) => {
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

      this.io.emit(SERVER_EVENTS.LEADERBOARD_UPDATE, leaderboard);

      // Guild leaderboard
      const guilds = this.guildManager.getGuildLeaderboard(10);
      const guildLeaderboard = guilds.map((guild, index) => ({
        rank: index + 1,
        guildId: guild.id,
        guildName: guild.name,
        guildTag: guild.tag,
        guildColor: guild.color,
        totalScore: guild.score,
        memberCount: guild.memberIds.length,
        chunksOwned: guild.chunksOwned.length,
      }));

      this.io.emit(SERVER_EVENTS.GUILD_LEADERBOARD_UPDATE, guildLeaderboard);
    }, NETWORK.LEADERBOARD_UPDATE_INTERVAL);
  }

  // Session callbacks
  setupSessionCallbacks(): void {
    this.sessionManager.setCallbacks(
      async (endData) => {
        this.io.emit(SERVER_EVENTS.SESSION_ENDING, {
          reason: endData.session.endReason,
          countdown: 10,
        });

        // Send final leaderboard
        this.io.emit(SERVER_EVENTS.LEADERBOARD_UPDATE, endData.leaderboard);
        this.io.emit(SERVER_EVENTS.GUILD_LEADERBOARD_UPDATE, endData.guildLeaderboard);

        // Save session history to Supabase
        try {
          await saveSessionHistory({
            session: endData.session,
            leaderboard: endData.leaderboard.map((entry, index) => ({
              ...entry,
              name: entry.playerName,
              color: entry.playerColor,
              stats: this.playerManager.getPlayer(entry.playerId)?.stats,
            })),
            peakPlayerCount: this.peakPlayerCount,
          });
          console.log('[SessionHistory] Session saved to database');
        } catch (error) {
          console.error('[SessionHistory] Failed to save session:', error);
        }
      },
      (newSession) => {
        // Reset peak player count for new session
        this.peakPlayerCount = this.playerManager.getPlayerCount();

        // Update skill manager with new map
        const gameMap = this.sessionManager.getGameMap();
        if (gameMap) {
          this.skillManager.updateGameMap(gameMap);
        }

        this.io.emit(SERVER_EVENTS.SESSION_NEW, newSession);

        this.broadcastNotification({
          id: uuidv4(),
          type: 'success',
          message: '🎮 새로운 세션이 시작되었습니다!',
          timestamp: Date.now(),
          duration: 5000,
        });
      }
    );
  }

  // ==================== Session History Handlers ====================

  private async handleSessionHistoryRequest(
    socket: Socket,
    data: { limit?: number; offset?: number }
  ): Promise<void> {
    try {
      const limit = Math.min(data.limit || 20, 50);
      const offset = data.offset || 0;
      const history = await getSessionHistory(limit, offset);
      socket.emit('session_history:list', history);
    } catch (error) {
      console.error('[SessionHistory] Error fetching history:', error);
      socket.emit('session_history:list', []);
    }
  }

  private async handleSessionHistoryDetail(
    socket: Socket,
    data: { sessionId: string }
  ): Promise<void> {
    try {
      const detail = await getSessionDetail(data.sessionId);
      socket.emit('session_history:detail', detail);
    } catch (error) {
      console.error('[SessionHistory] Error fetching detail:', error);
      socket.emit('session_history:detail', null);
    }
  }

  // Update peak player count when players join
  updatePeakPlayerCount(): void {
    const currentCount = this.playerManager.getPlayerCount();
    if (currentCount > this.peakPlayerCount) {
      this.peakPlayerCount = currentCount;
    }
  }

  cleanup(): void {
    if (this.cursorUpdateInterval) {
      clearInterval(this.cursorUpdateInterval);
    }
    if (this.leaderboardUpdateInterval) {
      clearInterval(this.leaderboardUpdateInterval);
    }
  }
}

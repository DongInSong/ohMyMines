import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Position,
  ChunkCoord,
  SkillType,
  ItemType,
} from 'shared';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { useGuildStore } from '../stores/guildStore';
import { soundManager } from '../utils/SoundManager';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Singleton socket instance - preserved across HMR
const SOCKET_KEY = '__oh_my_mines_socket__';
const INIT_KEY = '__oh_my_mines_initialized__';

// Use window to persist socket across HMR
function getSocket(): TypedSocket {
  if (typeof window !== 'undefined') {
    if (!(window as any)[SOCKET_KEY]) {
      console.log('[Socket] Creating new socket connection to', SOCKET_URL);
      (window as any)[SOCKET_KEY] = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true,
      });
    }
    return (window as any)[SOCKET_KEY];
  }
  // Fallback for SSR (not used in this app)
  return io(SOCKET_URL, { transports: ['websocket'], autoConnect: true });
}

function isInitialized(): boolean {
  return typeof window !== 'undefined' && (window as any)[INIT_KEY] === true;
}

function setInitialized(): void {
  if (typeof window !== 'undefined') {
    (window as any)[INIT_KEY] = true;
  }
}

// Initialize socket event handlers (called once)
function initializeSocketHandlers(socket: TypedSocket) {
  if (isInitialized()) return;
  setInitialized();
  console.log('[Socket] Initializing event handlers');

  // Connection events
  socket.on('connect', () => {
    console.log('[Socket] Connected to server, socket id:', socket.id);
    useGameStore.getState().setConnected(true);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    useGameStore.getState().setConnected(false);
  });

  // Player events
  socket.on('player:sync', ({ player }) => {
    console.log('[Socket] Received player:sync', player);
    usePlayerStore.getState().setPlayer(player);
  });

  socket.on('player:joined', ({ player, playerCount }) => {
    useGameStore.getState().addNotification({
      id: crypto.randomUUID(),
      type: 'info',
      message: `${player.name}님이 참가했습니다! (${playerCount}명)`,
      timestamp: Date.now(),
      duration: 3000,
    });
  });

  socket.on('player:left', ({ playerId, playerCount }) => {
    useGameStore.getState().addNotification({
      id: crypto.randomUUID(),
      type: 'info',
      message: `플레이어가 나갔습니다. (${playerCount}명)`,
      timestamp: Date.now(),
      duration: 2000,
    });
  });

  // Session events
  socket.on('session:state', (session) => {
    useGameStore.getState().setSession(session);
  });

  socket.on('session:ending', ({ reason, countdown }) => {
    useGameStore.getState().addNotification({
      id: crypto.randomUUID(),
      type: 'warning',
      message: `세션 종료! ${countdown}초 후 새 게임 시작...`,
      timestamp: Date.now(),
      duration: countdown * 1000,
    });
  });

  socket.on('session:new', (session) => {
    useGameStore.getState().reset();
    useGameStore.getState().setSession(session);
    useGameStore.getState().addNotification({
      id: crypto.randomUUID(),
      type: 'success',
      message: '🎮 새로운 게임이 시작되었습니다!',
      timestamp: Date.now(),
      duration: 5000,
    });
  });

  // Map events
  socket.on('chunk:data', ({ chunk }) => {
    console.log('[Socket] Received chunk:data', chunk.coord);
    useGameStore.getState().setChunk(chunk);
  });

  socket.on('cell:revealed', ({ cells, playerId, score }) => {
    console.log('[Socket] Received cell:revealed', { count: cells.length, playerId, score });
    useGameStore.getState().updateCells(cells);

    // Trigger reveal visual effect (only for non-mine reveals)
    const revealedCells = cells.filter((c) => !c.isMine && c.state === 'revealed');
    if (revealedCells.length > 0) {
      useGameStore.getState().triggerReveal(
        revealedCells.map((c) => ({ x: c.x, y: c.y }))
      );
    }

    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      const isChain = cells.length > 1;
      // Play sound effect
      soundManager.play(isChain ? 'revealChain' : 'reveal');

      usePlayerStore.getState().updatePlayer({
        score: player.score + score,
        stats: {
          ...player.stats,
          cellsRevealed: player.stats.cellsRevealed + cells.length,
          chainReveals: player.stats.chainReveals + (isChain ? 1 : 0),
        },
      });
    }
  });

  socket.on('cell:flagged', ({ cell, playerId }) => {
    useGameStore.getState().updateCells([cell]);

    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      // Play flag/unflag sound
      soundManager.play(cell.state === 'flagged' ? 'flag' : 'unflag');

      if (cell.state === 'flagged' && cell.isMine) {
        usePlayerStore.getState().updatePlayer({
          stats: {
            ...player.stats,
            correctFlags: player.stats.correctFlags + 1,
          },
        });
      }
    }
  });

  socket.on('mine:exploded', ({ position, playerId, minesExploded }) => {
    // Trigger explosion visual effect
    useGameStore.getState().triggerExplosion(position);

    // Play explosion sound
    soundManager.play('explosion');

    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      usePlayerStore.getState().updatePlayer({
        stats: {
          ...player.stats,
          minesTriggered: player.stats.minesTriggered + 1,
        },
      });
    }

    useGameStore.getState().addNotification({
      id: crypto.randomUUID(),
      type: 'error',
      message: `💥 지뢰 폭발! (총 ${minesExploded}개)`,
      timestamp: Date.now(),
      duration: 3000,
    });
  });

  // Cursor events
  socket.on('cursor:update', (cursors) => {
    const player = usePlayerStore.getState().player;
    if (player) {
      useGameStore.getState().setCursors(cursors.filter((c) => c.playerId !== player.id));
    }
  });

  // Combo events
  socket.on('combo:update', ({ playerId, combo }) => {
    try {
      const player = usePlayerStore.getState().player;
      if (player && playerId === player.id && combo) {
        usePlayerStore.getState().setCombo(combo);
      }
    } catch (err) {
      console.error('[Socket] Error handling combo:update:', err);
    }
  });

  socket.on('combo:fever', ({ playerId, feverEndTime }) => {
    try {
      const player = usePlayerStore.getState().player;
      if (player && playerId === player.id) {
        const currentCombo = usePlayerStore.getState().combo ?? {
          count: 0,
          multiplier: 1,
          lastRevealTime: 0,
          isFever: false,
        };
        usePlayerStore.getState().setCombo({
          ...currentCombo,
          isFever: true,
          feverEndTime,
        });
      }
    } catch (err) {
      console.error('[Socket] Error handling combo:fever:', err);
    }
  });

  // Treasure events
  socket.on('treasure:spawned', (treasure) => {
    useGameStore.getState().addTreasure(treasure);
  });

  socket.on('treasure:collected', ({ treasureId }) => {
    useGameStore.getState().removeTreasure(treasureId);
  });

  socket.on('treasure:expired', ({ treasureId }) => {
    useGameStore.getState().removeTreasure(treasureId);
  });

  socket.on('treasure:list', (treasures) => {
    useGameStore.getState().setTreasures(treasures);
  });

  // Skill events
  socket.on('skill:used', (result) => {
    const player = usePlayerStore.getState().player;
    if (player && result.playerId === player.id) {
      // Play skill or error sound
      soundManager.play(result.success ? 'skill' : 'error');
    }

    if (result.message) {
      useGameStore.getState().addNotification({
        id: crypto.randomUUID(),
        type: result.success ? 'success' : 'error',
        message: result.message,
        timestamp: Date.now(),
        duration: 2000,
      });
    }
  });

  socket.on('skill:effect', ({ skillId, playerId, cells }) => {
    if (skillId === 'scan') {
      useGameStore.getState().setScanHighlights(cells, 3000);
    }
  });

  // Item events
  socket.on('item:collected', ({ playerId, itemId }) => {
    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      // Play item pickup sound
      soundManager.play('item');

      usePlayerStore.getState().addItem(itemId);
      usePlayerStore.getState().updatePlayer({
        stats: {
          ...player.stats,
          itemsCollected: player.stats.itemsCollected + 1,
        },
      });
    }
  });

  socket.on('item:used', ({ playerId, itemId, inventory }) => {
    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      usePlayerStore.getState().setInventory(inventory);
    }
  });

  socket.on('effect:started', ({ playerId, effect }) => {
    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      usePlayerStore.getState().addEffect(effect);
    }
  });

  socket.on('effect:ended', ({ playerId, itemId }) => {
    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      usePlayerStore.getState().removeEffect(itemId);
    }
  });

  // Achievement events
  socket.on('achievement:unlocked', ({ playerId, achievement }) => {
    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      // Play achievement fanfare
      soundManager.play('achievement');

      useGameStore.getState().addNotification({
        id: crypto.randomUUID(),
        type: 'achievement',
        message: `🏆 업적 달성: ${achievement.emoji} ${achievement.name}`,
        timestamp: Date.now(),
        duration: 5000,
      });
    }
  });

  // Guild events
  socket.on('guild:created', (guild) => {
    const player = usePlayerStore.getState().player;
    if (player && guild.leaderId === player.id) {
      useGuildStore.getState().setCurrentGuild(guild);
    }
    useGuildStore.getState().updateGuild(guild);
  });

  socket.on('guild:updated', (guild) => {
    useGuildStore.getState().updateGuild(guild);
  });

  socket.on('guild:invite', (invite) => {
    useGuildStore.getState().addInvite(invite);
    useGameStore.getState().addNotification({
      id: crypto.randomUUID(),
      type: 'info',
      message: `${invite.inviterName}님이 [${invite.guildName}] 길드에 초대했습니다!`,
      timestamp: Date.now(),
      duration: 10000,
    });
  });

  socket.on('guild:member_joined', ({ guildId, playerId, playerName }) => {
    useGameStore.getState().addNotification({
      id: crypto.randomUUID(),
      type: 'success',
      message: `${playerName}님이 길드에 가입했습니다!`,
      timestamp: Date.now(),
      duration: 3000,
    });
  });

  socket.on('guild:member_left', ({ guildId, playerId }) => {
    const player = usePlayerStore.getState().player;
    if (player && playerId === player.id) {
      useGuildStore.getState().setCurrentGuild(null);
    }
  });

  // Leaderboard events
  socket.on('leaderboard:update', (entries) => {
    useGameStore.getState().setLeaderboard(entries);
  });

  socket.on('guild_leaderboard:update', (entries) => {
    useGameStore.getState().setGuildLeaderboard(entries);
  });

  // Chat events
  socket.on('chat:message', (message) => {
    useGameStore.getState().addChatMessage(message);

    // Play chat sound for messages from others
    const player = usePlayerStore.getState().player;
    if (player && message.playerId !== player.id) {
      soundManager.play('chat');
    }
  });

  // Notification events
  socket.on('notification:broadcast', (notification) => {
    useGameStore.getState().addNotification(notification);
  });

  // Error events
  socket.on('error', ({ message }) => {
    useGameStore.getState().addNotification({
      id: crypto.randomUUID(),
      type: 'error',
      message,
      timestamp: Date.now(),
      duration: 5000,
    });
  });
}

export function useSocket() {
  // Initialize socket on first hook call
  useEffect(() => {
    const socket = getSocket();
    initializeSocketHandlers(socket);
  }, []);

  // Emit functions
  const joinGame = useCallback((name: string, color: string) => {
    const { savedId, savedName, savedColor, achievements, totalScore, gamesPlayed, settings } =
      usePlayerStore.getState();

    console.log('[Socket] Emitting player:join', { name, color, savedId });
    getSocket().emit('player:join', {
      name,
      color,
      savedData: savedId
        ? {
            id: savedId,
            name: savedName,
            color: savedColor,
            achievements,
            totalScore,
            gamesPlayed,
            settings,
          }
        : undefined,
    });
  }, []);

  const updatePosition = useCallback((position: Position) => {
    getSocket().emit('player:update_position', position);
  }, []);

  const revealCell = useCallback((position: Position) => {
    console.log('[Socket] Emitting cell:reveal', position);
    getSocket().emit('cell:reveal', position);
  }, []);

  const flagCell = useCallback((position: Position) => {
    getSocket().emit('cell:flag', position);
  }, []);

  const requestChunk = useCallback((coord: ChunkCoord) => {
    getSocket().emit('chunk:request', coord);
  }, []);

  const useSkill = useCallback((skillId: SkillType, targetPosition?: Position) => {
    getSocket().emit('skill:use', { skillId, targetPosition });
  }, []);

  const useItem = useCallback((itemId: ItemType) => {
    getSocket().emit('item:use', { itemId });
  }, []);

  const createGuild = useCallback((name: string, tag: string, color: string) => {
    getSocket().emit('guild:create', { name, tag, color });
  }, []);

  const joinGuild = useCallback((guildId: string) => {
    getSocket().emit('guild:join', { guildId });
  }, []);

  const leaveGuild = useCallback(() => {
    getSocket().emit('guild:leave');
  }, []);

  const inviteToGuild = useCallback((playerId: string) => {
    getSocket().emit('guild:invite', { playerId });
  }, []);

  const kickFromGuild = useCallback((playerId: string) => {
    getSocket().emit('guild:kick', { playerId });
  }, []);

  const sendChat = useCallback((content: string, isEmoji: boolean, guildOnly?: boolean) => {
    getSocket().emit('chat:send', { content, isEmoji, guildOnly });
  }, []);

  const heartbeat = useCallback(() => {
    getSocket().emit('player:heartbeat');
  }, []);

  const requestSessionHistory = useCallback((limit?: number, offset?: number) => {
    getSocket().emit('session_history:request', { limit, offset });
  }, []);

  const requestSessionDetail = useCallback((sessionId: string) => {
    getSocket().emit('session_history:detail', { sessionId });
  }, []);

  return {
    socket: getSocket(),
    joinGame,
    updatePosition,
    revealCell,
    flagCell,
    requestChunk,
    useSkill,
    useItem,
    createGuild,
    joinGuild,
    leaveGuild,
    inviteToGuild,
    kickFromGuild,
    sendChat,
    heartbeat,
    requestSessionHistory,
    requestSessionDetail,
  };
}

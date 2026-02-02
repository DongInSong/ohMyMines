import { useCallback, useEffect, useRef } from 'react';
import type { Position, ChunkCoord } from 'shared';
import { NETWORK } from 'shared';
import { useSocket } from './useSocket';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';

export function useGame() {
  const {
    joinGame,
    updatePosition,
    revealCell,
    flagCell,
    requestChunk,
    useSkill,
    useItem,
    heartbeat,
  } = useSocket();

  const chunks = useGameStore((s) => s.chunks);
  const isConnected = useGameStore((s) => s.isConnected);
  const viewportCenter = useGameStore((s) => s.viewportCenter);
  const cursorPosition = useGameStore((s) => s.cursorPosition);
  const player = usePlayerStore((s) => s.player);

  const loadedChunksRef = useRef<Set<string>>(new Set());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const positionUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate chunk key
  const getChunkKey = (cx: number, cy: number) => `${cx},${cy}`;

  // Load chunks that are in viewport
  const loadVisibleChunks = useCallback(
    (visibleChunks: ChunkCoord[]) => {
      for (const { cx, cy } of visibleChunks) {
        const key = getChunkKey(cx, cy);
        if (!loadedChunksRef.current.has(key) && !chunks.has(key)) {
          loadedChunksRef.current.add(key);
          requestChunk({ cx, cy });
        }
      }
    },
    [chunks, requestChunk]
  );

  // Handle cell click (reveal)
  const handleCellClick = useCallback(
    (position: Position) => {
      console.log('[Game] handleCellClick', { position, isConnected, hasPlayer: !!player });
      if (!isConnected || !player) {
        console.log('[Game] Blocked - not connected or no player');
        return;
      }
      console.log('[Game] Emitting cell:reveal');
      revealCell(position);
    },
    [isConnected, player, revealCell]
  );

  // Handle cell right-click (flag)
  const handleCellRightClick = useCallback(
    (position: Position) => {
      if (!isConnected || !player) return;
      flagCell(position);
    },
    [isConnected, player, flagCell]
  );

  // Use a skill
  const handleUseSkill = useCallback(
    (skillId: Parameters<typeof useSkill>[0], targetPosition?: Position) => {
      if (!isConnected || !player) return;
      useSkill(skillId, targetPosition ?? viewportCenter);
    },
    [isConnected, player, useSkill, viewportCenter]
  );

  // Use an item
  const handleUseItem = useCallback(
    (itemId: Parameters<typeof useItem>[0]) => {
      if (!isConnected || !player) return;
      useItem(itemId);
    },
    [isConnected, player, useItem]
  );

  // Start game
  const startGame = useCallback(
    (name: string, color: string) => {
      console.log('[Game] startGame called', { name, color, isConnected });
      if (!isConnected) {
        console.log('[Game] Blocked - not connected');
        return;
      }

      // Save to localStorage
      const { savedId, setSavedData } = usePlayerStore.getState();
      const id = savedId ?? crypto.randomUUID();
      setSavedData(id, name, color);

      joinGame(name, color);
    },
    [isConnected, joinGame]
  );

  // Setup heartbeat
  useEffect(() => {
    if (isConnected && player) {
      heartbeatIntervalRef.current = setInterval(() => {
        heartbeat();
      }, NETWORK.HEARTBEAT_INTERVAL);
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isConnected, player, heartbeat]);

  // Setup position update - use cursor position (mouse hover) for real-time sync
  useEffect(() => {
    if (isConnected && player) {
      positionUpdateIntervalRef.current = setInterval(() => {
        // Send cursor position if available, otherwise send viewport center
        const positionToSend = cursorPosition ?? viewportCenter;
        updatePosition(positionToSend);
      }, NETWORK.CURSOR_UPDATE_INTERVAL);
    }

    return () => {
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
      }
    };
  }, [isConnected, player, cursorPosition, viewportCenter, updatePosition]);

  // Clean up loaded chunks periodically
  useEffect(() => {
    const interval = setInterval(() => {
      // Clear chunks that are far from viewport
      const chunksToRemove: string[] = [];
      const centerCX = Math.floor(viewportCenter.x / 100);
      const centerCY = Math.floor(viewportCenter.y / 100);

      for (const key of loadedChunksRef.current) {
        const [cx, cy] = key.split(',').map(Number);
        if (Math.abs(cx - centerCX) > 3 || Math.abs(cy - centerCY) > 3) {
          chunksToRemove.push(key);
        }
      }

      for (const key of chunksToRemove) {
        loadedChunksRef.current.delete(key);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [viewportCenter]);

  return {
    startGame,
    loadVisibleChunks,
    handleCellClick,
    handleCellRightClick,
    handleUseSkill,
    handleUseItem,
    isConnected,
    player,
  };
}

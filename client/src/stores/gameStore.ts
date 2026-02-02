import { create } from 'zustand';
import type {
  Session,
  Cell,
  Chunk,
  ChunkCoord,
  Position,
  Notification,
  LeaderboardEntry,
  GuildLeaderboardEntry,
  ChatMessage,
  PlayerCursor,
  TreasureCell,
} from 'shared';

interface GameState {
  // Session
  session: Session | null;
  isConnected: boolean;

  // Map data
  chunks: Map<string, Chunk>;
  visibleCells: Map<string, Cell>;

  // Viewport
  viewportCenter: Position;
  zoom: number;

  // UI State
  notifications: Notification[];
  leaderboard: LeaderboardEntry[];
  guildLeaderboard: GuildLeaderboardEntry[];
  chatMessages: ChatMessage[];
  otherCursors: PlayerCursor[];

  // Cursor position for sync
  cursorPosition: Position | null;

  // Scan results (temporary mine highlights)
  scanHighlights: Position[];
  scanEndTime: number;

  // Explosion effects queue
  pendingExplosions: Position[];

  // Reveal effects queue
  pendingReveals: { cells: Position[]; timestamp: number }[];

  // Navigation request (for minimap clicks, etc.)
  navigationTarget: Position | null;

  // Treasure system
  treasures: TreasureCell[];

  // Actions
  setSession: (session: Session | null) => void;
  setConnected: (connected: boolean) => void;

  setChunk: (chunk: Chunk) => void;
  updateCells: (cells: Cell[]) => void;
  getCell: (x: number, y: number) => Cell | undefined;

  setViewportCenter: (position: Position) => void;
  setZoom: (zoom: number) => void;

  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;

  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setGuildLeaderboard: (entries: GuildLeaderboardEntry[]) => void;

  addChatMessage: (message: ChatMessage) => void;
  setCursors: (cursors: PlayerCursor[]) => void;
  setCursorPosition: (position: Position | null) => void;

  setScanHighlights: (positions: Position[], duration: number) => void;
  clearScanHighlights: () => void;

  triggerExplosion: (position: Position) => void;
  consumeExplosions: () => Position[];

  triggerReveal: (cells: Position[]) => void;
  consumeReveals: () => { cells: Position[]; timestamp: number }[];

  navigateTo: (position: Position) => void;
  clearNavigationTarget: () => void;

  // Treasure actions
  setTreasures: (treasures: TreasureCell[]) => void;
  addTreasure: (treasure: TreasureCell) => void;
  removeTreasure: (treasureId: string) => void;

  reset: () => void;
}

const getChunkKey = (cx: number, cy: number) => `${cx},${cy}`;
const getCellKey = (x: number, y: number) => `${x},${y}`;

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  session: null,
  isConnected: false,
  chunks: new Map(),
  visibleCells: new Map(),
  viewportCenter: { x: 100, y: 100 },
  zoom: 1,
  notifications: [],
  leaderboard: [],
  guildLeaderboard: [],
  chatMessages: [],
  otherCursors: [],
  cursorPosition: null,
  scanHighlights: [],
  scanEndTime: 0,
  pendingExplosions: [],
  pendingReveals: [],
  navigationTarget: null,
  treasures: [],

  // Session actions
  setSession: (session) => set({ session }),
  setConnected: (isConnected) => set({ isConnected }),

  // Chunk/Cell actions
  setChunk: (chunk) => {
    const { chunks, visibleCells } = get();
    const key = getChunkKey(chunk.coord.cx, chunk.coord.cy);
    const newChunks = new Map(chunks);
    newChunks.set(key, chunk);

    // Update visible cells from chunk
    const newVisibleCells = new Map(visibleCells);
    for (const row of chunk.cells) {
      for (const cell of row) {
        newVisibleCells.set(getCellKey(cell.x, cell.y), cell);
      }
    }

    set({ chunks: newChunks, visibleCells: newVisibleCells });
  },

  updateCells: (cells) => {
    const { visibleCells, chunks } = get();
    const newVisibleCells = new Map(visibleCells);
    const newChunks = new Map(chunks);

    for (const cell of cells) {
      newVisibleCells.set(getCellKey(cell.x, cell.y), cell);

      // Update chunk as well
      const cx = Math.floor(cell.x / 100);
      const cy = Math.floor(cell.y / 100);
      const chunkKey = getChunkKey(cx, cy);
      const chunk = newChunks.get(chunkKey);

      if (chunk) {
        const lx = cell.x % 100;
        const ly = cell.y % 100;
        chunk.cells[ly][lx] = cell;
        if (cell.state === 'revealed') {
          chunk.revealedCount++;
        }
      }
    }

    set({ visibleCells: newVisibleCells, chunks: newChunks });
  },

  getCell: (x, y) => {
    return get().visibleCells.get(getCellKey(x, y));
  },

  // Viewport actions
  setViewportCenter: (position) => set({ viewportCenter: position }),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(2, zoom)) }),

  // Notification actions
  addNotification: (notification) => {
    set((state) => ({
      notifications: [...state.notifications, notification].slice(-10),
    }));

    // Auto-remove after duration
    if (notification.duration) {
      setTimeout(() => {
        get().removeNotification(notification.id);
      }, notification.duration);
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  // Leaderboard actions
  setLeaderboard: (entries) => set({ leaderboard: entries }),
  setGuildLeaderboard: (entries) => set({ guildLeaderboard: entries }),

  // Chat actions
  addChatMessage: (message) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, message].slice(-100),
    }));
  },

  // Cursor actions
  setCursors: (cursors) => set({ otherCursors: cursors }),
  setCursorPosition: (position) => set({ cursorPosition: position }),

  // Scan highlight actions
  setScanHighlights: (positions, duration) => {
    set({
      scanHighlights: positions,
      scanEndTime: Date.now() + duration,
    });

    setTimeout(() => {
      get().clearScanHighlights();
    }, duration);
  },

  clearScanHighlights: () => {
    set({ scanHighlights: [], scanEndTime: 0 });
  },

  // Explosion actions
  triggerExplosion: (position) => {
    set((state) => ({
      pendingExplosions: [...state.pendingExplosions, position],
    }));
  },

  consumeExplosions: () => {
    const explosions = get().pendingExplosions;
    if (explosions.length > 0) {
      set({ pendingExplosions: [] });
    }
    return explosions;
  },

  triggerReveal: (cells) => {
    if (cells.length === 0) return;
    set((state) => ({
      pendingReveals: [...state.pendingReveals, { cells, timestamp: Date.now() }],
    }));
  },

  consumeReveals: () => {
    const reveals = get().pendingReveals;
    if (reveals.length > 0) {
      set({ pendingReveals: [] });
    }
    return reveals;
  },

  // Navigation actions
  navigateTo: (position) => {
    set({ navigationTarget: position });
  },

  clearNavigationTarget: () => {
    set({ navigationTarget: null });
  },

  // Treasure actions
  setTreasures: (treasures) => {
    set({ treasures });
  },

  addTreasure: (treasure) => {
    set((state) => ({
      treasures: [...state.treasures, treasure],
    }));
  },

  removeTreasure: (treasureId) => {
    set((state) => ({
      treasures: state.treasures.filter((t) => t.id !== treasureId),
    }));
  },

  // Reset all state
  reset: () => {
    set({
      chunks: new Map(),
      visibleCells: new Map(),
      notifications: [],
      chatMessages: [],
      scanHighlights: [],
      scanEndTime: 0,
      pendingExplosions: [],
      pendingReveals: [],
      navigationTarget: null,
      treasures: [],
    });
  },
}));

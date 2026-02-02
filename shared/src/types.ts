// ============================================
// Core Game Types
// ============================================

export type CellState = 'hidden' | 'revealed' | 'flagged';

export interface Cell {
  x: number;
  y: number;
  isMine: boolean;
  adjacentMines: number;
  state: CellState;
  revealedBy?: string; // Player ID who revealed
  flaggedBy?: string; // Player ID who flagged
  revealedAt?: number; // Timestamp
}

export interface ChunkCoord {
  cx: number; // Chunk X (0-9 for 1000x1000 map with 100x100 chunks)
  cy: number;
}

export interface Chunk {
  coord: ChunkCoord;
  cells: Cell[][];
  mineCount: number;
  revealedCount: number;
  dominantPlayer?: string; // Player with most reveals
  dominantGuild?: string; // Guild with most reveals
}

// ============================================
// Zone System
// ============================================

export type ZoneType = 'safe' | 'beginner' | 'intermediate' | 'advanced' | 'danger' | 'mystery';

export interface Zone {
  type: ZoneType;
  mineDensity: number; // 0.05 to 0.25
  scoreMultiplier: number;
  bounds: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
}

// ============================================
// Player Types
// ============================================

export interface Position {
  x: number;
  y: number;
}

export interface PlayerStats {
  cellsRevealed: number;
  correctFlags: number;
  minesTriggered: number;
  score: number;
  chainReveals: number;
  itemsCollected: number;
}

export interface PlayerSkillState {
  skillId: SkillType;
  lastUsed: number; // Timestamp
  isActive: boolean;
  activeUntil?: number; // For skills with duration
}

export interface Player {
  id: string;
  name: string;
  color: string;
  position: Position;
  viewportCenter: Position;
  score: number;
  stats: PlayerStats;
  skills: Map<SkillType, PlayerSkillState> | Record<SkillType, PlayerSkillState>;
  items: InventoryItem[];
  activeEffects: ActiveEffect[];
  guildId?: string;
  isOnline: boolean;
  lastActivity: number;
  achievements: string[]; // Achievement IDs
  cooldownReduction: number; // Percentage (0-1)
  scoreMultiplier: number; // Default 1
  isGhostMode: boolean;
  combo: ComboState;
}

export interface PlayerCursor {
  playerId: string;
  playerName: string;
  color: string;
  position: Position;
  lastUpdate: number;
}

// ============================================
// Skill System
// ============================================

export type SkillType = 'scan' | 'shield' | 'chain' | 'vision' | 'mark' | 'speed';

export interface Skill {
  id: SkillType;
  name: string;
  emoji: string;
  description: string;
  cooldown: number; // Seconds
  duration?: number; // Seconds (for skills with duration)
  range?: number; // Grid cells
}

export interface SkillUseResult {
  success: boolean;
  skillId: SkillType;
  playerId: string;
  affectedCells?: Position[];
  message?: string;
}

// ============================================
// Item System
// ============================================

export type ItemType = 'cooldown_reduction' | 'double_points' | 'magnet' | 'mystery_box' | 'ghost_mode';

export interface Item {
  id: ItemType;
  name: string;
  emoji: string;
  description: string;
  dropRate: number; // Percentage (0-1)
  duration?: number; // Seconds
  effectValue?: number;
}

export interface InventoryItem {
  itemId: ItemType;
  quantity: number;
}

export interface ActiveEffect {
  itemId: ItemType;
  startTime: number;
  endTime: number;
  value?: number;
  stackCount?: number; // Number of times this effect has been stacked
}

export interface ItemDropEvent {
  itemId: ItemType;
  position: Position;
  playerId: string;
}

// ============================================
// Achievement System
// ============================================

export type AchievementCategory = 'exploration' | 'accuracy' | 'speed' | 'social' | 'collection' | 'mastery';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: AchievementCategory;
  requirement: {
    type: string;
    value: number;
  };
  reward?: {
    type: 'score' | 'item' | 'title';
    value: number | string;
  };
}

export interface AchievementProgress {
  achievementId: string;
  currentValue: number;
  completed: boolean;
  completedAt?: number;
}

// ============================================
// Guild System
// ============================================

export interface Guild {
  id: string;
  name: string;
  tag: string; // 3-5 character tag
  color: string;
  leaderId: string;
  memberIds: string[];
  score: number;
  createdAt: number;
  chunksOwned: ChunkCoord[];
}

export interface GuildBuff {
  minMembers: number;
  scoreBonus: number; // Percentage
  cooldownReduction: number; // Percentage
  itemDropBonus: number; // Percentage
}

export interface GuildInvite {
  guildId: string;
  guildName: string;
  inviterId: string;
  inviterName: string;
  timestamp: number;
}

// ============================================
// Session System
// ============================================

export type SessionState = 'waiting' | 'active' | 'ending' | 'finished';

export interface Session {
  id: string;
  state: SessionState;
  startTime: number;
  endTime?: number;
  mapWidth: number;
  mapHeight: number;
  totalMines: number;
  minesExploded: number;
  cellsRevealed: number;
  totalCells: number;
  playerCount: number;
  endReason?: 'mines_exploded' | 'map_cleared' | 'time_limit';
}

export interface SessionEndData {
  session: Session;
  leaderboard: LeaderboardEntry[];
  guildLeaderboard: GuildLeaderboardEntry[];
  topAchievements: { playerId: string; playerName: string; achievement: Achievement }[];
}

// Session History (for persistence)
export interface SessionHistoryEntry {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  endReason: 'mines_exploded' | 'map_cleared' | 'time_limit';
  mapWidth: number;
  mapHeight: number;
  totalMines: number;
  minesExploded: number;
  cellsRevealed: number;
  totalCells: number;
  revealPercentage: number;
  mineExplosionPercentage: number;
  peakPlayerCount: number;
}

export interface SessionTopPlayer {
  rank: number;
  playerName: string;
  playerColor: string;
  score: number;
  cellsRevealed: number;
  minesTriggered: number;
  chainReveals: number;
}

export interface SessionHistoryDetail {
  session: SessionHistoryEntry;
  topPlayers: SessionTopPlayer[];
}

// ============================================
// Leaderboard
// ============================================

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  playerColor: string;
  score: number;
  cellsRevealed: number;
  guildTag?: string;
}

export interface GuildLeaderboardEntry {
  rank: number;
  guildId: string;
  guildName: string;
  guildTag: string;
  guildColor: string;
  totalScore: number;
  memberCount: number;
  chunksOwned: number;
}

// ============================================
// Combo System
// ============================================

export interface ComboState {
  count: number;
  multiplier: number;
  lastRevealTime: number;
  isFever: boolean;
  feverEndTime?: number;
}

// ============================================
// Treasure System
// ============================================

export interface TreasureCell {
  id: string;
  position: Position;
  reward: number; // Bonus points
  spawnTime: number;
  expireTime: number;
  type: 'gold' | 'diamond' | 'rainbow'; // Different treasure tiers
}

// ============================================
// Chat & Notifications
// ============================================

export type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'achievement' | 'item';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  content: string; // Can be text or emoji code
  timestamp: number;
  isEmoji: boolean;
  guildOnly?: boolean;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  duration?: number; // How long to show (ms)
  data?: Record<string, unknown>;
}

// ============================================
// Socket Events
// ============================================

export interface ServerToClientEvents {
  // Connection
  'player:joined': (data: { player: Player; playerCount: number }) => void;
  'player:left': (data: { playerId: string; playerCount: number }) => void;
  'player:sync': (data: { player: Player }) => void;

  // Game State
  'session:state': (data: Session) => void;
  'session:ending': (data: { reason: string; countdown: number }) => void;
  'session:new': (data: Session) => void;

  // Map Updates
  'chunk:data': (data: { chunk: Chunk }) => void;
  'cell:revealed': (data: { cells: Cell[]; playerId: string; score: number }) => void;
  'cell:flagged': (data: { cell: Cell; playerId: string }) => void;
  'mine:exploded': (data: { position: Position; playerId: string; minesExploded: number }) => void;

  // Player Updates
  'cursor:update': (data: PlayerCursor[]) => void;
  'score:update': (data: { playerId: string; score: number; delta: number }) => void;

  // Combo System
  'combo:update': (data: { playerId: string; combo: ComboState }) => void;
  'combo:fever': (data: { playerId: string; feverEndTime: number }) => void;

  // Treasure System
  'treasure:spawned': (data: TreasureCell) => void;
  'treasure:collected': (data: { treasureId: string; playerId: string; playerName: string; reward: number }) => void;
  'treasure:expired': (data: { treasureId: string }) => void;
  'treasure:list': (data: TreasureCell[]) => void;

  // Skills
  'skill:used': (data: SkillUseResult) => void;
  'skill:effect': (data: { skillId: SkillType; playerId: string; cells: Position[] }) => void;

  // Items
  'item:dropped': (data: ItemDropEvent) => void;
  'item:collected': (data: { playerId: string; itemId: ItemType }) => void;
  'item:used': (data: { playerId: string; itemId: ItemType; inventory: InventoryItem[] }) => void;
  'effect:started': (data: { playerId: string; effect: ActiveEffect }) => void;
  'effect:ended': (data: { playerId: string; itemId: ItemType }) => void;

  // Achievements
  'achievement:unlocked': (data: { playerId: string; achievement: Achievement }) => void;

  // Guild
  'guild:created': (data: Guild) => void;
  'guild:updated': (data: Guild) => void;
  'guild:invite': (data: GuildInvite) => void;
  'guild:member_joined': (data: { guildId: string; playerId: string; playerName: string }) => void;
  'guild:member_left': (data: { guildId: string; playerId: string }) => void;

  // Leaderboard
  'leaderboard:update': (data: LeaderboardEntry[]) => void;
  'guild_leaderboard:update': (data: GuildLeaderboardEntry[]) => void;

  // Session History
  'session_history:list': (data: SessionHistoryEntry[]) => void;
  'session_history:detail': (data: SessionHistoryDetail | null) => void;

  // Chat & Notifications
  'chat:message': (data: ChatMessage) => void;
  'notification:broadcast': (data: Notification) => void;

  // Error
  'error': (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  // Connection
  'player:join': (data: { name: string; color: string; savedData?: SavedPlayerData }) => void;
  'player:update_position': (data: Position) => void;
  'player:heartbeat': () => void;

  // Game Actions
  'cell:reveal': (data: Position) => void;
  'cell:flag': (data: Position) => void;
  'chunk:request': (data: ChunkCoord) => void;

  // Skills
  'skill:use': (data: { skillId: SkillType; targetPosition?: Position }) => void;

  // Items
  'item:use': (data: { itemId: ItemType }) => void;

  // Guild
  'guild:create': (data: { name: string; tag: string; color: string }) => void;
  'guild:join': (data: { guildId: string }) => void;
  'guild:leave': () => void;
  'guild:invite': (data: { playerId: string }) => void;
  'guild:kick': (data: { playerId: string }) => void;

  // Chat
  'chat:send': (data: { content: string; isEmoji: boolean; guildOnly?: boolean }) => void;

  // Session History
  'session_history:request': (data: { limit?: number; offset?: number }) => void;
  'session_history:detail': (data: { sessionId: string }) => void;
}

// ============================================
// Local Storage Types
// ============================================

export interface SavedPlayerData {
  id: string;
  name: string;
  color: string;
  achievements: AchievementProgress[];
  totalScore: number;
  gamesPlayed: number;
  settings: GameSettings;
}

export interface GameSettings {
  soundEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  showOtherCursors: boolean;
  cursorUpdateRate: 'low' | 'medium' | 'high';
  chatEnabled: boolean;
  notificationsEnabled: boolean;
}

// ============================================
// Canvas Rendering Types
// ============================================

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface RenderOptions {
  showGrid: boolean;
  showZoneBorders: boolean;
  showChunkBorders: boolean;
  showMiniMap: boolean;
  highlightOwnCells: boolean;
}

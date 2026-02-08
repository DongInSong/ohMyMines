import type { Skill, Item, Zone, ZoneType, GuildBuff, GameSettings } from './types.js';

// ============================================
// Map Constants
// ============================================

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 1000;
export const CHUNK_SIZE = 100;
export const CHUNKS_X = MAP_WIDTH / CHUNK_SIZE;
export const CHUNKS_Y = MAP_HEIGHT / CHUNK_SIZE;
export const TOTAL_CELLS = MAP_WIDTH * MAP_HEIGHT;

// ============================================
// Cell Rendering
// ============================================

export const CELL_SIZE = 24; // Pixels
export const CELL_PADDING = 1;
export const CELL_COLORS = {
  hidden: '#e8e8e8',
  hiddenHover: '#dcdcdc',
  revealed: '#f7f7f7',
  revealedEmpty: '#fcfcfc',
  flagged: '#c75450',
  mine: '#c75450',
  mineExploded: '#a63d3a',
} as const;

// Light mono number colors - muted tones
export const NUMBER_COLORS: Record<number, string> = {
  1: '#5a7fa8', // Muted blue
  2: '#5a9a6e', // Muted green
  3: '#a85a5a', // Muted red
  4: '#7a6a9a', // Muted purple
  5: '#9a5a7a', // Muted pink
  6: '#5a8a8a', // Muted cyan
  7: '#6a6a6a', // Gray
  8: '#4a4a4a', // Dark gray
};

// ============================================
// Zone Configuration
// ============================================

export const ZONE_CONFIGS: Record<ZoneType, Omit<Zone, 'bounds'>> = {
  safe: {
    type: 'safe',
    mineDensity: 0.12, // Increased from 0.05 to prevent huge flood fills
    scoreMultiplier: 0.5,
  },
  beginner: {
    type: 'beginner',
    mineDensity: 0.15, // Increased from 0.10
    scoreMultiplier: 1,
  },
  intermediate: {
    type: 'intermediate',
    mineDensity: 0.18,
    scoreMultiplier: 2,
  },
  advanced: {
    type: 'advanced',
    mineDensity: 0.22,
    scoreMultiplier: 3,
  },
  danger: {
    type: 'danger',
    mineDensity: 0.27,
    scoreMultiplier: 5,
  },
  mystery: {
    type: 'mystery',
    mineDensity: 0.20,
    scoreMultiplier: 4,
  },
};

// Maximum cells that can be revealed in a single flood-fill
export const MAX_FLOOD_FILL_CELLS = 500;

// Light mono zone colors - subtle muted tones
export const ZONE_COLORS: Record<ZoneType, { bg: string; border: string; text: string }> = {
  safe: { bg: '#5a9a6e08', border: '#5a9a6e', text: '#5a9a6e' },
  beginner: { bg: '#5a7fa808', border: '#5a7fa8', text: '#5a7fa8' },
  intermediate: { bg: '#9a7a5a08', border: '#9a7a5a', text: '#9a7a5a' },
  advanced: { bg: '#a8785a08', border: '#a8785a', text: '#a8785a' },
  danger: { bg: '#a85a5a08', border: '#a85a5a', text: '#a85a5a' },
  mystery: { bg: '#7a6a9a08', border: '#7a6a9a', text: '#7a6a9a' },
};

// Zone bounds (in chunk coordinates, 0-9 for 10x10 chunks)
export const ZONE_LAYOUT: Zone[] = [
  // Safe Zone - Top Left corner
  { ...ZONE_CONFIGS.safe, bounds: { startX: 0, startY: 0, endX: 200, endY: 200 } },
  // Beginner - Top Right
  { ...ZONE_CONFIGS.beginner, bounds: { startX: 200, startY: 0, endX: 500, endY: 300 } },
  // Intermediate - Middle Left
  { ...ZONE_CONFIGS.intermediate, bounds: { startX: 0, startY: 200, endX: 400, endY: 600 } },
  // Advanced - Middle Right
  { ...ZONE_CONFIGS.advanced, bounds: { startX: 400, startY: 300, endX: 800, endY: 700 } },
  // Danger - Bottom Left
  { ...ZONE_CONFIGS.danger, bounds: { startX: 0, startY: 600, endX: 500, endY: 1000 } },
  // Mystery - Bottom Right
  { ...ZONE_CONFIGS.mystery, bounds: { startX: 500, startY: 700, endX: 1000, endY: 1000 } },
  // Beginner fills remaining top area
  { ...ZONE_CONFIGS.beginner, bounds: { startX: 500, startY: 0, endX: 1000, endY: 300 } },
  // Intermediate fills remaining middle area
  { ...ZONE_CONFIGS.intermediate, bounds: { startX: 800, startY: 300, endX: 1000, endY: 700 } },
];

// ============================================
// Skill Definitions
// ============================================

export const SKILLS: Record<string, Skill> = {
  scan: {
    id: 'scan',
    name: '스캔',
    emoji: '🔍',
    description: '3x3 영역의 지뢰 위치를 3초간 표시합니다',
    cooldown: 30,
    duration: 3,
    range: 3,
  },
  shield: {
    id: 'shield',
    name: '보호막',
    emoji: '🛡️',
    description: '다음 폭탄 1회를 무효화합니다',
    cooldown: 60,
  },
  chain: {
    id: 'chain',
    name: '연쇄',
    emoji: '⚡',
    description: '숫자 셀도 주변 안전셀을 자동 공개합니다',
    cooldown: 45,
    duration: 10,
  },
  vision: {
    id: 'vision',
    name: '투시',
    emoji: '👁️',
    description: '5x5 영역을 완전 공개합니다 (지뢰 제외)',
    cooldown: 90,
    range: 5,
  },
  mark: {
    id: 'mark',
    name: '마킹',
    emoji: '🎯',
    description: '지뢰 1개를 확정 표시합니다 (모든 플레이어에게)',
    cooldown: 20,
    range: 1,
  },
  speed: {
    id: 'speed',
    name: '이동속도',
    emoji: '💨',
    description: '10초간 빠른 맵 이동이 가능합니다',
    cooldown: 15,
    duration: 10,
  },
};

export const SKILL_LIST = Object.values(SKILLS);

// ============================================
// Item Definitions
// ============================================

export const ITEMS: Record<string, Item> = {
  cooldown_reduction: {
    id: 'cooldown_reduction',
    name: '쿨다운 감소',
    emoji: '⏱️',
    description: '모든 스킬 쿨다운 50% 감소 (1회)',
    dropRate: 0.005, // Reduced from 0.05
    effectValue: 0.5,
  },
  double_points: {
    id: 'double_points',
    name: '더블 포인트',
    emoji: '💎',
    description: '30초간 획득 점수 2배',
    dropRate: 0.003, // Reduced from 0.03
    duration: 30,
    effectValue: 2,
  },
  magnet: {
    id: 'magnet',
    name: '자석',
    emoji: '🧲',
    description: '주변 5칸 내 아이템 자동 수집',
    dropRate: 0.002, // Reduced from 0.02
    effectValue: 5,
  },
  mystery_box: {
    id: 'mystery_box',
    name: '미스터리 박스',
    emoji: '🎁',
    description: '랜덤 보상 (점수/스킬 초기화/희귀 아이템)',
    dropRate: 0.001, // Reduced from 0.01
  },
  ghost_mode: {
    id: 'ghost_mode',
    name: '유령 모드',
    emoji: '👻',
    description: '15초간 다른 플레이어에게 안 보임',
    dropRate: 0.0005, // Reduced from 0.005
    duration: 15,
  },
};

export const ITEM_LIST = Object.values(ITEMS);

// Total drop rate for normalization
export const TOTAL_ITEM_DROP_RATE = ITEM_LIST.reduce((sum, item) => sum + item.dropRate, 0);

// ============================================
// Score Constants
// ============================================

export const SCORES = {
  CELL_REVEAL: 1,
  CORRECT_FLAG: 5,
  CHAIN_MULTIPLIER: 1.5,
  MINE_PENALTY: -50,
  MINE_COOLDOWN: 5000, // 5 seconds in ms
} as const;

// ============================================
// Combo System
// ============================================

export const COMBO = {
  TIMEOUT: 5000, // 5 seconds to maintain combo
  FEVER_THRESHOLD: 20, // Combo count to trigger fever
  FEVER_DURATION: 10000, // 10 seconds of fever mode
  FEVER_MULTIPLIER: 3, // Score multiplier during fever
  MAX_MULTIPLIER: 5, // Maximum combo multiplier
  MULTIPLIER_STEPS: [5, 10, 15, 20], // Combo counts for multiplier increases
} as const;

// ============================================
// Treasure System
// ============================================

export const TREASURE = {
  SPAWN_INTERVAL: 30000, // New treasure every 30 seconds
  MIN_DURATION: 20000, // Minimum time before expiry (20s)
  MAX_DURATION: 45000, // Maximum time before expiry (45s)
  MAX_ACTIVE: 5, // Maximum treasures on map at once
  REWARDS: {
    gold: { min: 50, max: 100, chance: 0.6 },
    diamond: { min: 150, max: 300, chance: 0.3 },
    rainbow: { min: 500, max: 1000, chance: 0.1 },
  },
  EMOJIS: {
    gold: '💰',
    diamond: '💎',
    rainbow: '🌈',
  },
} as const;

// ============================================
// Guild System
// ============================================

export const GUILD_BUFFS: GuildBuff[] = [
  { minMembers: 5, scoreBonus: 0.05, cooldownReduction: 0, itemDropBonus: 0 },
  { minMembers: 10, scoreBonus: 0.05, cooldownReduction: 0.10, itemDropBonus: 0 },
  { minMembers: 20, scoreBonus: 0.05, cooldownReduction: 0.10, itemDropBonus: 0.20 },
];

export const GUILD_CONSTRAINTS = {
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 20,
  TAG_LENGTH_MIN: 2,
  TAG_LENGTH_MAX: 5,
  MAX_MEMBERS: 50,
} as const;

// ============================================
// Player Limits
// ============================================

export const MAX_PLAYERS = 100;

// ============================================
// Session Constants
// ============================================

export const SESSION = {
  MAX_DURATION: 24 * 60 * 60 * 1000, // 24 hours in ms
  MINES_EXPLODED_THRESHOLD: 0.30, // 30% of mines
  MAP_CLEARED_THRESHOLD: 0.80, // 80% of map
  ENDING_COUNTDOWN: 10, // seconds
  NEW_SESSION_DELAY: 5000, // 5 seconds before new session
} as const;

// ============================================
// Network Constants
// ============================================

export const NETWORK = {
  CURSOR_UPDATE_INTERVAL: 50, // ms
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  CHUNK_CACHE_DURATION: 60000, // 1 minute
  LEADERBOARD_UPDATE_INTERVAL: 5000, // 5 seconds
  MAX_CHAT_MESSAGE_LENGTH: 200,
  CHAT_COOLDOWN: 1000, // 1 second between messages
} as const;

// ============================================
// Player Colors
// ============================================

export const PLAYER_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
];

// ============================================
// Emoji Reactions
// ============================================

export const EMOJI_REACTIONS = [
  '👍', '👎', '😀', '😢', '😮', '🎉',
  '🔥', '💀', '🤔', '👀', '💪', '🙏',
];

// ============================================
// Default Settings
// ============================================

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  showOtherCursors: true,
  cursorUpdateRate: 'medium',
  chatEnabled: true,
  notificationsEnabled: true,
};

// ============================================
// Render Constants
// ============================================

export const RENDER = {
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 2,
  ZOOM_STEP: 0.1,
  PAN_SPEED: 20,
  FAST_PAN_MULTIPLIER: 3, // When speed skill is active
  MINIMAP_SIZE: 200, // pixels
  MINIMAP_SCALE: 0.15,
} as const;

// Socket event names - matching the types in shared/types.ts

export const SERVER_EVENTS = {
  // Connection
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_SYNC: 'player:sync',

  // Game State
  SESSION_STATE: 'session:state',
  SESSION_ENDING: 'session:ending',
  SESSION_NEW: 'session:new',

  // Map Updates
  CHUNK_DATA: 'chunk:data',
  CELL_REVEALED: 'cell:revealed',
  CELL_FLAGGED: 'cell:flagged',
  MINE_EXPLODED: 'mine:exploded',

  // Player Updates
  CURSOR_UPDATE: 'cursor:update',
  SCORE_UPDATE: 'score:update',

  // Skills
  SKILL_USED: 'skill:used',
  SKILL_EFFECT: 'skill:effect',

  // Items
  ITEM_DROPPED: 'item:dropped',
  ITEM_COLLECTED: 'item:collected',
  ITEM_USED: 'item:used',
  EFFECT_STARTED: 'effect:started',
  EFFECT_ENDED: 'effect:ended',

  // Achievements
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',

  // Guild
  GUILD_CREATED: 'guild:created',
  GUILD_UPDATED: 'guild:updated',
  GUILD_INVITE: 'guild:invite',
  GUILD_MEMBER_JOINED: 'guild:member_joined',
  GUILD_MEMBER_LEFT: 'guild:member_left',

  // Leaderboard
  LEADERBOARD_UPDATE: 'leaderboard:update',
  GUILD_LEADERBOARD_UPDATE: 'guild_leaderboard:update',

  // Chat & Notifications
  CHAT_MESSAGE: 'chat:message',
  NOTIFICATION_BROADCAST: 'notification:broadcast',

  // Error
  ERROR: 'error',
} as const;

export const CLIENT_EVENTS = {
  // Connection
  PLAYER_JOIN: 'player:join',
  PLAYER_UPDATE_POSITION: 'player:update_position',
  PLAYER_HEARTBEAT: 'player:heartbeat',

  // Game Actions
  CELL_REVEAL: 'cell:reveal',
  CELL_FLAG: 'cell:flag',
  CHUNK_REQUEST: 'chunk:request',

  // Skills
  SKILL_USE: 'skill:use',

  // Items
  ITEM_USE: 'item:use',

  // Guild
  GUILD_CREATE: 'guild:create',
  GUILD_JOIN: 'guild:join',
  GUILD_LEAVE: 'guild:leave',
  GUILD_INVITE: 'guild:invite',
  GUILD_KICK: 'guild:kick',

  // Chat
  CHAT_SEND: 'chat:send',
} as const;

export type ServerEvent = typeof SERVER_EVENTS[keyof typeof SERVER_EVENTS];
export type ClientEvent = typeof CLIENT_EVENTS[keyof typeof CLIENT_EVENTS];

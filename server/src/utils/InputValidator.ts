/**
 * Input Validator
 * Validates and sanitizes user input to prevent XSS, injection, and other attacks
 */

import { Position, ChunkCoord, SkillType, ItemType } from 'shared';
import { MAP_WIDTH, MAP_HEIGHT, CHUNKS_X, CHUNKS_Y, NETWORK, GUILD_CONSTRAINTS } from 'shared';

// Valid skill and item IDs
const VALID_SKILLS: SkillType[] = ['scan', 'shield', 'chain', 'vision', 'mark', 'speed'];
const VALID_ITEMS: ItemType[] = [
  'cooldown_reduction',
  'double_points',
  'magnet',
  'mystery_box',
  'ghost_mode',
];

// Patterns for dangerous content
const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i, // onclick=, onerror=, etc.
  /data:/i,
  /vbscript:/i,
];

// Unicode control characters to strip
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F]/g;

export class InputValidator {
  /**
   * Validate and sanitize a player name
   */
  static validatePlayerName(name: unknown): { valid: boolean; sanitized?: string; error?: string } {
    if (typeof name !== 'string') {
      return { valid: false, error: '이름은 문자열이어야 합니다' };
    }

    // Remove control characters and trim
    let sanitized = name.replace(CONTROL_CHAR_REGEX, '').trim();

    // Check length (allow 2-20 characters)
    if (sanitized.length < 2) {
      return { valid: false, error: '이름은 최소 2자 이상이어야 합니다' };
    }

    if (sanitized.length > 20) {
      sanitized = sanitized.substring(0, 20);
    }

    // Check for dangerous content
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        return { valid: false, error: '허용되지 않는 문자가 포함되어 있습니다' };
      }
    }

    return { valid: true, sanitized };
  }

  /**
   * Validate a hex color code
   */
  static validateColor(color: unknown): { valid: boolean; sanitized?: string; error?: string } {
    if (typeof color !== 'string') {
      return { valid: false, error: '색상은 문자열이어야 합니다' };
    }

    // Check for valid hex color format
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    if (!hexPattern.test(color)) {
      return { valid: false, error: '올바른 색상 형식이 아닙니다 (#RRGGBB)' };
    }

    return { valid: true, sanitized: color.toUpperCase() };
  }

  /**
   * Validate a cell position
   */
  static validatePosition(position: unknown): { valid: boolean; position?: Position; error?: string } {
    if (!position || typeof position !== 'object') {
      return { valid: false, error: '위치는 객체여야 합니다' };
    }

    const pos = position as Record<string, unknown>;

    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      return { valid: false, error: '위치 좌표는 숫자여야 합니다' };
    }

    if (isNaN(pos.x) || isNaN(pos.y)) {
      return { valid: false, error: '위치 좌표가 유효하지 않습니다' };
    }

    // Convert to integers and clamp to bounds
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);

    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
      return { valid: false, error: '위치가 맵 범위를 벗어났습니다' };
    }

    return { valid: true, position: { x, y } };
  }

  /**
   * Validate a chunk coordinate
   */
  static validateChunkCoord(coord: unknown): { valid: boolean; coord?: ChunkCoord; error?: string } {
    if (!coord || typeof coord !== 'object') {
      return { valid: false, error: '청크 좌표는 객체여야 합니다' };
    }

    const c = coord as Record<string, unknown>;

    if (typeof c.cx !== 'number' || typeof c.cy !== 'number') {
      return { valid: false, error: '청크 좌표는 숫자여야 합니다' };
    }

    const cx = Math.floor(c.cx);
    const cy = Math.floor(c.cy);

    if (cx < 0 || cx >= CHUNKS_X || cy < 0 || cy >= CHUNKS_Y) {
      return { valid: false, error: '청크 좌표가 범위를 벗어났습니다' };
    }

    return { valid: true, coord: { cx, cy } };
  }

  /**
   * Validate a skill ID
   */
  static validateSkillId(skillId: unknown): { valid: boolean; skillId?: SkillType; error?: string } {
    if (typeof skillId !== 'string') {
      return { valid: false, error: '스킬 ID는 문자열이어야 합니다' };
    }

    if (!VALID_SKILLS.includes(skillId as SkillType)) {
      return { valid: false, error: '유효하지 않은 스킬입니다' };
    }

    return { valid: true, skillId: skillId as SkillType };
  }

  /**
   * Validate an item ID
   */
  static validateItemId(itemId: unknown): { valid: boolean; itemId?: ItemType; error?: string } {
    if (typeof itemId !== 'string') {
      return { valid: false, error: '아이템 ID는 문자열이어야 합니다' };
    }

    if (!VALID_ITEMS.includes(itemId as ItemType)) {
      return { valid: false, error: '유효하지 않은 아이템입니다' };
    }

    return { valid: true, itemId: itemId as ItemType };
  }

  /**
   * Validate and sanitize chat message
   */
  static validateChatMessage(
    content: unknown,
    isEmoji: unknown
  ): { valid: boolean; content?: string; error?: string } {
    if (typeof content !== 'string') {
      return { valid: false, error: '메시지는 문자열이어야 합니다' };
    }

    // Remove control characters
    let sanitized = content.replace(CONTROL_CHAR_REGEX, '');

    // For emoji messages, the content should be short
    if (isEmoji) {
      if (sanitized.length > 10) {
        return { valid: false, error: '이모지가 너무 깁니다' };
      }
      return { valid: true, content: sanitized };
    }

    // For text messages
    if (sanitized.length === 0) {
      return { valid: false, error: '메시지가 비어있습니다' };
    }

    if (sanitized.length > NETWORK.MAX_CHAT_MESSAGE_LENGTH) {
      sanitized = sanitized.substring(0, NETWORK.MAX_CHAT_MESSAGE_LENGTH);
    }

    // Check for dangerous content
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        return { valid: false, error: '허용되지 않는 내용이 포함되어 있습니다' };
      }
    }

    return { valid: true, content: sanitized };
  }

  /**
   * Validate guild name
   */
  static validateGuildName(name: unknown): { valid: boolean; sanitized?: string; error?: string } {
    if (typeof name !== 'string') {
      return { valid: false, error: '길드 이름은 문자열이어야 합니다' };
    }

    let sanitized = name.replace(CONTROL_CHAR_REGEX, '').trim();

    if (sanitized.length < GUILD_CONSTRAINTS.MIN_NAME_LENGTH) {
      return {
        valid: false,
        error: `길드 이름은 최소 ${GUILD_CONSTRAINTS.MIN_NAME_LENGTH}자 이상이어야 합니다`,
      };
    }

    if (sanitized.length > GUILD_CONSTRAINTS.MAX_NAME_LENGTH) {
      sanitized = sanitized.substring(0, GUILD_CONSTRAINTS.MAX_NAME_LENGTH);
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        return { valid: false, error: '허용되지 않는 문자가 포함되어 있습니다' };
      }
    }

    return { valid: true, sanitized };
  }

  /**
   * Validate guild tag
   */
  static validateGuildTag(tag: unknown): { valid: boolean; sanitized?: string; error?: string } {
    if (typeof tag !== 'string') {
      return { valid: false, error: '길드 태그는 문자열이어야 합니다' };
    }

    // Only allow alphanumeric characters for tags
    let sanitized = tag.replace(/[^a-zA-Z0-9가-힣]/g, '').trim();

    if (sanitized.length < GUILD_CONSTRAINTS.TAG_LENGTH_MIN) {
      return {
        valid: false,
        error: `길드 태그는 최소 ${GUILD_CONSTRAINTS.TAG_LENGTH_MIN}자 이상이어야 합니다`,
      };
    }

    if (sanitized.length > GUILD_CONSTRAINTS.TAG_LENGTH_MAX) {
      sanitized = sanitized.substring(0, GUILD_CONSTRAINTS.TAG_LENGTH_MAX);
    }

    return { valid: true, sanitized: sanitized.toUpperCase() };
  }

  /**
   * Validate player ID (UUID format)
   */
  static validatePlayerId(id: unknown): { valid: boolean; id?: string; error?: string } {
    if (typeof id !== 'string') {
      return { valid: false, error: '플레이어 ID는 문자열이어야 합니다' };
    }

    // UUID v4 pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return { valid: false, error: '유효하지 않은 플레이어 ID입니다' };
    }

    return { valid: true, id };
  }

  /**
   * Sanitize generic string input
   */
  static sanitizeString(input: unknown, maxLength: number = 100): string | null {
    if (typeof input !== 'string') {
      return null;
    }

    let sanitized = input.replace(CONTROL_CHAR_REGEX, '').trim();

    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }
}

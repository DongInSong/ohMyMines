/**
 * Rate Limiter for game actions
 * Prevents spam and abuse of game mechanics
 */

interface RateLimitConfig {
  maxRequests: number;  // Maximum requests allowed in the window
  windowMs: number;     // Time window in milliseconds
  blockDurationMs?: number; // Optional: duration to block after exceeding limit
}

interface RateLimitEntry {
  requests: number;
  windowStart: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: RateLimitConfig,
    cleanupIntervalMs: number = 60000 // Clean up every minute by default
  ) {
    // Start cleanup interval to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Check if an action is allowed for the given key (e.g., playerId or socketId)
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    let entry = this.limits.get(key);

    // Check if blocked
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      return false;
    }

    // No entry or window expired - create new entry
    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      this.limits.set(key, {
        requests: 1,
        windowStart: now,
      });
      return true;
    }

    // Within window - check limit
    if (entry.requests >= this.config.maxRequests) {
      // Apply block if configured
      if (this.config.blockDurationMs) {
        entry.blockedUntil = now + this.config.blockDurationMs;
      }
      return false;
    }

    // Allowed - increment counter
    entry.requests++;
    return true;
  }

  /**
   * Get remaining requests in the current window
   */
  getRemainingRequests(key: string): number {
    const entry = this.limits.get(key);
    const now = Date.now();

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - entry.requests);
  }

  /**
   * Get time until rate limit resets (in ms)
   */
  getResetTime(key: string): number {
    const entry = this.limits.get(key);
    const now = Date.now();

    if (!entry) {
      return 0;
    }

    // If blocked, return block remaining time
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return entry.blockedUntil - now;
    }

    // Return window remaining time
    const windowEnd = entry.windowStart + this.config.windowMs;
    return Math.max(0, windowEnd - now);
  }

  /**
   * Check if a key is currently blocked
   */
  isBlocked(key: string): boolean {
    const entry = this.limits.get(key);
    return !!(entry?.blockedUntil && Date.now() < entry.blockedUntil);
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.limits) {
      const windowExpired = now - entry.windowStart >= this.config.windowMs * 2;
      const blockExpired = !entry.blockedUntil || now >= entry.blockedUntil;

      if (windowExpired && blockExpired) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.limits.delete(key);
    }
  }

  /**
   * Stop the cleanup interval (call when shutting down)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.limits.clear();
  }
}

/**
 * Pre-configured rate limiters for common game actions
 */
export const GameRateLimiters = {
  // Cell reveal: 30 actions per second (prevents rapid-fire clicking)
  cellReveal: new RateLimiter({
    maxRequests: 30,
    windowMs: 1000,
    blockDurationMs: 2000, // Block for 2 seconds if exceeded
  }),

  // Cell flag: 20 actions per second
  cellFlag: new RateLimiter({
    maxRequests: 20,
    windowMs: 1000,
    blockDurationMs: 1000,
  }),

  // Chat: 5 messages per 5 seconds
  chat: new RateLimiter({
    maxRequests: 5,
    windowMs: 5000,
    blockDurationMs: 10000, // Block for 10 seconds if spamming
  }),

  // Skill use: 10 skill uses per 5 seconds (covers all skills)
  skillUse: new RateLimiter({
    maxRequests: 10,
    windowMs: 5000,
    blockDurationMs: 5000,
  }),

  // Item use: 5 items per 5 seconds
  itemUse: new RateLimiter({
    maxRequests: 5,
    windowMs: 5000,
    blockDurationMs: 3000,
  }),

  // Position updates: 60 per second (allows smooth cursor movement)
  positionUpdate: new RateLimiter({
    maxRequests: 60,
    windowMs: 1000,
  }),

  // Chunk requests: 20 per second (allows fast panning)
  chunkRequest: new RateLimiter({
    maxRequests: 20,
    windowMs: 1000,
  }),

  // Guild actions: 3 per 10 seconds
  guildAction: new RateLimiter({
    maxRequests: 3,
    windowMs: 10000,
    blockDurationMs: 30000,
  }),
};

/**
 * Helper function to check rate limit and emit error if limited
 */
export function checkRateLimit(
  limiter: RateLimiter,
  key: string,
  actionName: string
): { allowed: boolean; message?: string } {
  if (limiter.isAllowed(key)) {
    return { allowed: true };
  }

  const resetTime = Math.ceil(limiter.getResetTime(key) / 1000);
  return {
    allowed: false,
    message: `${actionName} 속도 제한 - ${resetTime}초 후 다시 시도하세요`,
  };
}

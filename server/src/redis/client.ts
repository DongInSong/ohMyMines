import { Redis } from 'ioredis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: Redis | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let subscriber: Redis | null = null;
let redisAvailable = false;

export function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  if (!redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy() {
        // Don't retry - Redis is optional
        return null;
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redis.on('connect', () => {
      redisAvailable = true;
      console.log('✅ Redis connected');
    });

    // Suppress error logging - Redis is optional
    redis.on('error', () => {});
  }

  return redis;
}

export function createSubscriber(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  if (!subscriber) {
    subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy() {
        return null;
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    // Suppress error logging
    subscriber.on('error', () => {});
  }

  return subscriber;
}

export function getRedis(): Redis | null {
  return redisAvailable ? redis : null;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function connectRedis(): Promise<boolean> {
  try {
    const client = createRedisClient();
    await client.connect();
    redisAvailable = true;
    return true;
  } catch {
    // Redis is optional - silently continue without it
    redisAvailable = false;
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {}
    redis = null;
  }
  if (subscriber) {
    try {
      await subscriber.quit();
    } catch {}
    subscriber = null;
  }
  redisAvailable = false;
}

// Redis key prefixes
export const KEYS = {
  SESSION: 'session:',
  CHUNK: 'chunk:',
  PLAYER: 'player:',
  LEADERBOARD: 'leaderboard',
  GUILD: 'guild:',
  GUILD_LEADERBOARD: 'guild_leaderboard',
} as const;

// Helper functions for common operations
export class RedisStore {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  // Session
  async saveSession(sessionId: string, data: object): Promise<void> {
    await this.redis.set(
      `${KEYS.SESSION}${sessionId}`,
      JSON.stringify(data),
      'EX',
      86400 // 24 hours
    );
  }

  async getSession(sessionId: string): Promise<object | null> {
    const data = await this.redis.get(`${KEYS.SESSION}${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  // Chunk caching
  async cacheChunk(sessionId: string, cx: number, cy: number, data: object): Promise<void> {
    await this.redis.set(
      `${KEYS.CHUNK}${sessionId}:${cx}:${cy}`,
      JSON.stringify(data),
      'EX',
      3600 // 1 hour
    );
  }

  async getChunk(sessionId: string, cx: number, cy: number): Promise<object | null> {
    const data = await this.redis.get(`${KEYS.CHUNK}${sessionId}:${cx}:${cy}`);
    return data ? JSON.parse(data) : null;
  }

  // Leaderboard
  async updateLeaderboard(playerId: string, score: number): Promise<void> {
    await this.redis.zadd(KEYS.LEADERBOARD, score, playerId);
  }

  async getLeaderboard(limit: number = 10): Promise<{ playerId: string; score: number }[]> {
    const results = await this.redis.zrevrange(KEYS.LEADERBOARD, 0, limit - 1, 'WITHSCORES');
    const leaderboard: { playerId: string; score: number }[] = [];

    for (let i = 0; i < results.length; i += 2) {
      leaderboard.push({
        playerId: results[i],
        score: parseInt(results[i + 1], 10),
      });
    }

    return leaderboard;
  }

  async clearLeaderboard(): Promise<void> {
    await this.redis.del(KEYS.LEADERBOARD);
  }

  // Guild leaderboard
  async updateGuildLeaderboard(guildId: string, score: number): Promise<void> {
    await this.redis.zadd(KEYS.GUILD_LEADERBOARD, score, guildId);
  }

  async getGuildLeaderboard(limit: number = 10): Promise<{ guildId: string; score: number }[]> {
    const results = await this.redis.zrevrange(KEYS.GUILD_LEADERBOARD, 0, limit - 1, 'WITHSCORES');
    const leaderboard: { guildId: string; score: number }[] = [];

    for (let i = 0; i < results.length; i += 2) {
      leaderboard.push({
        guildId: results[i],
        score: parseInt(results[i + 1], 10),
      });
    }

    return leaderboard;
  }

  // Player data
  async savePlayer(playerId: string, data: object): Promise<void> {
    await this.redis.set(
      `${KEYS.PLAYER}${playerId}`,
      JSON.stringify(data),
      'EX',
      86400 * 7 // 7 days
    );
  }

  async getPlayer(playerId: string): Promise<object | null> {
    const data = await this.redis.get(`${KEYS.PLAYER}${playerId}`);
    return data ? JSON.parse(data) : null;
  }

  // Guild data
  async saveGuild(guildId: string, data: object): Promise<void> {
    await this.redis.set(
      `${KEYS.GUILD}${guildId}`,
      JSON.stringify(data),
      'EX',
      86400 * 30 // 30 days
    );
  }

  async getGuild(guildId: string): Promise<object | null> {
    const data = await this.redis.get(`${KEYS.GUILD}${guildId}`);
    return data ? JSON.parse(data) : null;
  }

  // Pub/Sub helpers
  async publish(channel: string, message: object): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }
}

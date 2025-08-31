import { createClient, RedisClientType } from 'redis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private useMemoryFallback = false;
  private forceMemoryMode = false;
  private memoryStore = new Map<string, { value: any; expiry?: number }>();
  private usageStats = {
    apiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastResetTime: Date.now(),
  };

  constructor() {
    // Check if Redis is disabled by configuration
    this.forceMemoryMode = !config.redis.enabled;

    if (this.forceMemoryMode) {
      logger.info('Redis disabled by configuration (ENABLE_REDIS=false), using memory fallback');
      this.useMemoryFallback = true;
      this.isConnected = true;
      return;
    }

    // Initialize with memory fallback by default
    this.useMemoryFallback = true;
    this.isConnected = true; // Consider memory fallback as "connected"

    // Create Redis client but don't connect immediately
    this.client = createClient({
      url: config.redis.url,
    });

    this.client.on('error', (err) => {
      logger.debug('Redis Client Error (using memory fallback)', { error: err.message });
      this.useMemoryFallback = true;
      this.isConnected = true;
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
      this.useMemoryFallback = false;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected, switching to memory fallback');
      this.isConnected = true; // Keep "connected" for fallback
      this.useMemoryFallback = true;
    });
  }

  async connect(): Promise<void> {
    if (this.forceMemoryMode) {
      logger.info('Using memory-only mode (Redis disabled by ENABLE_REDIS=false)');
      return;
    }

    // Try to connect to Redis, but don't fail if it's not available
    try {
      if (this.client && !this.client.isOpen) {
        await this.client.connect();
        logger.info('Successfully connected to Redis');
        this.useMemoryFallback = false;
      }
    } catch (error) {
      logger.info('Redis not available, using in-memory storage fallback');
      this.useMemoryFallback = true;
    }
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected && !this.useMemoryFallback && this.client) {
      await this.client.disconnect();
    }
    if (this.useMemoryFallback) {
      this.memoryStore.clear();
    }
  }

  // Cache methods with fallback and usage tracking
  async get<T>(key: string): Promise<T | null> {
    this.trackUsage();

    if (this.useMemoryFallback) {
      const item = this.memoryStore.get(key);
      if (!item) {
        this.usageStats.cacheMisses++;
        return null;
      }

      // Check expiry
      if (item.expiry && Date.now() > item.expiry) {
        this.memoryStore.delete(key);
        this.usageStats.cacheMisses++;
        return null;
      }

      this.usageStats.cacheHits++;
      return item.value;
    }

    try {
      if (!this.client) {
        this.usageStats.cacheMisses++;
        return null;
      }

      const value = await this.client.get(key);
      if (value) {
        this.usageStats.cacheHits++;
        return JSON.parse(value);
      } else {
        this.usageStats.cacheMisses++;
        return null;
      }
    } catch (error) {
      logger.error('Redis GET error', { key, error });
      this.usageStats.cacheMisses++;
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (this.useMemoryFallback) {
      const item: { value: any; expiry?: number } = { value };
      if (ttlSeconds) {
        item.expiry = Date.now() + (ttlSeconds * 1000);
      }
      this.memoryStore.set(key, item);
      return true;
    }

    try {
      if (!this.client) {
        return false;
      }

      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      return this.memoryStore.delete(key);
    }

    try {
      if (!this.client) {
        return false;
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error', { key, error });
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    if (this.useMemoryFallback) {
      const item = this.memoryStore.get(key);
      const currentValue = item?.value || 0;
      const newValue = typeof currentValue === 'number' ? currentValue + 1 : 1;
      const newItem: { value: any; expiry?: number } = { value: newValue };
      if (item?.expiry !== undefined) {
        newItem.expiry = item.expiry;
      }
      this.memoryStore.set(key, newItem);
      return newValue;
    }

    try {
      if (!this.client) {
        return 0;
      }

      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis INCR error', { key, error });
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      const item = this.memoryStore.get(key);
      if (!item) return false;

      // Check expiry
      if (item.expiry && Date.now() > item.expiry) {
        this.memoryStore.delete(key);
        return false;
      }

      return true;
    }

    try {
      if (!this.client) {
        return false;
      }

      const result = await this.client.exists(key);
      return Boolean(result);
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error });
      return false;
    }
  }

  // Session methods
  async setSession(sessionId: string, data: any, ttlSeconds = 86400): Promise<boolean> {
    return this.set(`session:${sessionId}`, data, ttlSeconds);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.del(`session:${sessionId}`);
  }

  // OAuth state methods
  async setOAuthState(state: string, data: any, ttlSeconds = 600): Promise<boolean> {
    return this.set(`oauth:${state}`, data, ttlSeconds);
  }

  async getOAuthState<T>(state: string): Promise<T | null> {
    return this.get<T>(`oauth:${state}`);
  }

  async deleteOAuthState(state: string): Promise<boolean> {
    return this.del(`oauth:${state}`);
  }

  // Cache keys for GitHub data
  getCacheKey(type: string, ...identifiers: (string | number)[]): string {
    return `github:${type}:${identifiers.join(':')}`;
  }

  // Usage monitoring
  private trackUsage(): void {
    this.usageStats.apiCalls++;

    // Reset stats every hour
    const now = Date.now();
    if (now - this.usageStats.lastResetTime > 3600000) { // 1 hour
      this.checkUsageAndRecommend();
      this.resetUsageStats();
    }
  }

  private checkUsageAndRecommend(): void {
    const { apiCalls, cacheHits, cacheMisses } = this.usageStats;
    const hitRate = apiCalls > 0 ? cacheHits / apiCalls : 0;

    if (this.forceMemoryMode && apiCalls > 100 && hitRate > 0.5) {
      logger.warn('High cache usage detected!', {
        apiCalls,
        cacheHits,
        cacheMisses,
        hitRate: `${(hitRate * 100).toFixed(1)}%`,
        recommendation: 'Consider enabling Redis (ENABLE_REDIS=true) for better performance'
      });
    }

    if (!this.forceMemoryMode && this.useMemoryFallback && apiCalls > 50) {
      logger.info('Cache usage stats', {
        apiCalls,
        cacheHits,
        cacheMisses,
        hitRate: `${(hitRate * 100).toFixed(1)}%`,
        status: 'Using memory fallback (Redis unavailable)'
      });
    }
  }

  private resetUsageStats(): void {
    this.usageStats = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastResetTime: Date.now(),
    };
  }

  // Get current usage statistics
  getUsageStats(): typeof this.usageStats & { hitRate: string; mode: string } {
    const hitRate = this.usageStats.apiCalls > 0
      ? (this.usageStats.cacheHits / this.usageStats.apiCalls * 100).toFixed(1)
      : '0.0';

    const mode = this.forceMemoryMode
      ? 'memory-only'
      : this.useMemoryFallback
        ? 'memory-fallback'
        : 'redis';

    return {
      ...this.usageStats,
      hitRate: `${hitRate}%`,
      mode,
    };
  }

  // Manual trigger for usage check (development only)
  triggerUsageCheck(): void {
    this.checkUsageAndRecommend();
  }

  /**
   * Delete keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (this.useMemoryFallback) {
      let deleted = 0;
      const regex = new RegExp(pattern.replace('*', '.*'));

      for (const key of this.memoryStore.keys()) {
        if (regex.test(key)) {
          this.memoryStore.delete(key);
          deleted++;
        }
      }

      return deleted;
    }

    try {
      if (!this.client) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.client.del(keys);
      logger.debug('Deleted keys by pattern', { pattern, count: deleted });
      return deleted;
    } catch (error) {
      logger.error('Error deleting keys by pattern', { pattern, error });
      return 0;
    }
  }

  /**
   * Get Redis info and statistics
   */
  async getInfo(): Promise<{
    keyCount: number;
    memoryUsage: string;
    hitRate: number;
    uptime: number;
  }> {
    if (this.useMemoryFallback) {
      return {
        keyCount: this.memoryStore.size,
        memoryUsage: `${Math.round(JSON.stringify(Array.from(this.memoryStore.entries())).length / 1024)}KB`,
        hitRate: this.usageStats.apiCalls > 0 ? this.usageStats.cacheHits / this.usageStats.apiCalls : 0,
        uptime: Math.floor((Date.now() - this.usageStats.lastResetTime) / 1000),
      };
    }

    try {
      if (!this.client) {
        return {
          keyCount: 0,
          memoryUsage: '0B',
          hitRate: 0,
          uptime: 0,
        };
      }

      const info = await this.client.info();
      const dbInfo = await this.client.info('keyspace');

      // Parse info string
      const lines = info.split('\\r\\n');
      const stats: Record<string, string> = {};

      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      }

      // Parse keyspace info
      const keyspaceLines = dbInfo.split('\\r\\n');
      let keyCount = 0;

      for (const line of keyspaceLines) {
        if (line.startsWith('db0:')) {
          const match = line.match(/keys=(\\d+)/);
          if (match) {
            keyCount = parseInt(match[1] || '0');
          }
        }
      }

      return {
        keyCount,
        memoryUsage: stats.used_memory_human || '0B',
        hitRate: parseFloat(stats.keyspace_hit_rate || '0'),
        uptime: parseInt(stats.uptime_in_seconds || '0'),
      };
    } catch (error) {
      logger.error('Error getting Redis info', { error });
      return {
        keyCount: 0,
        memoryUsage: '0B',
        hitRate: 0,
        uptime: 0,
      };
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async getKeys(pattern: string): Promise<string[]> {
    if (this.useMemoryFallback) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return Array.from(this.memoryStore.keys()).filter(key => regex.test(key));
    }

    try {
      if (!this.client) {
        return [];
      }

      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Error getting keys', { pattern, error });
      return [];
    }
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    if (this.useMemoryFallback) {
      const item = this.memoryStore.get(key);
      if (!item || !item.expiry) {
        return -1;
      }

      const remaining = Math.floor((item.expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }

    try {
      if (!this.client) {
        return -1;
      }

      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Error getting TTL', { key, error });
      return -1;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (this.useMemoryFallback) {
      const item = this.memoryStore.get(key);
      if (!item) {
        return false;
      }

      item.expiry = Date.now() + (seconds * 1000);
      this.memoryStore.set(key, item);
      return true;
    }

    try {
      if (!this.client) {
        return false;
      }

      const result = await this.client.expire(key, seconds);
      return Boolean(result);
    } catch (error) {
      logger.error('Error setting expiration', { key, seconds, error });
      return false;
    }
  }
}

export const redisService = new RedisService();
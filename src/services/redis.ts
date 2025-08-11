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
      return result === 1;
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
}

export const redisService = new RedisService();
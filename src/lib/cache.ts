// Advanced caching system for production performance
import { PerformanceOptimizer } from '../utils/performance';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export class AdvancedCache<T = any> {
  private cache = new Map<string, CacheItem<T>>();
  private maxSize: number;
  private defaultTtl: number;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, hitRate: 0 };
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize: number = 1000, defaultTtl: number = 300000) { // 5 minutes default
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
    
    // Cleanup expired items every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const itemTtl = ttl || this.defaultTtl;

    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: itemTtl,
      accessCount: 0,
      lastAccessed: now
    });

    this.updateStats();
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    
    // Check if item has expired
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access statistics
    item.accessCount++;
    item.lastAccessed = now;
    this.stats.hits++;
    this.updateHitRate();

    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.updateStats();
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0, hitRate: 0 };
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Get all keys matching a pattern
  getKeys(pattern?: RegExp): string[] {
    const keys = Array.from(this.cache.keys());
    return pattern ? keys.filter(key => pattern.test(key)) : keys;
  }

  // Bulk operations
  setMany(items: Array<{ key: string; data: T; ttl?: number }>): void {
    items.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  getMany(keys: string[]): Array<{ key: string; data: T | null }> {
    return keys.map(key => ({
      key,
      data: this.get(key)
    }));
  }

  deleteMany(keys: string[]): number {
    let deleted = 0;
    keys.forEach(key => {
      if (this.delete(key)) deleted++;
    });
    return deleted;
  }

  // Delete all keys matching a pattern
  deletePattern(pattern: RegExp): number {
    const keysToDelete = this.getKeys(pattern);
    return this.deleteMany(keysToDelete);
  }

  // Preload data with background refresh
  async preload<K>(
    key: string,
    loader: () => Promise<K>,
    ttl?: number
  ): Promise<K> {
    const cached = this.get(key) as K;
    if (cached) {
      return cached;
    }

    const data = await loader();
    this.set(key, data as unknown as T, ttl);
    return data;
  }

  // Memoized function caching
  memoize<Args extends any[], Return>(
    fn: (...args: Args) => Return,
    keyGenerator?: (...args: Args) => string,
    ttl?: number
  ): (...args: Args) => Return {
    return (...args: Args): Return => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      const cached = this.get(key) as Return;
      if (cached !== null) {
        return cached;
      }

      const result = fn(...args);
      this.set(key, result as unknown as T, ttl);
      return result;
    };
  }

  // Async memoized function caching
  memoizeAsync<Args extends any[], Return>(
    fn: (...args: Args) => Promise<Return>,
    keyGenerator?: (...args: Args) => string,
    ttl?: number
  ): (...args: Args) => Promise<Return> {
    return async (...args: Args): Promise<Return> => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      const cached = this.get(key) as Return;
      if (cached !== null) {
        return cached;
      }

      const result = await fn(...args);
      this.set(key, result as unknown as T, ttl);
      return result;
    };
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    this.updateStats();
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Global cache instances
export const queryCache = new AdvancedCache(500, 300000); // 5 minutes for queries
export const userCache = new AdvancedCache(100, 900000); // 15 minutes for user data
export const staticCache = new AdvancedCache(200, 3600000); // 1 hour for static data

// Cache utilities
export const CacheUtils = {
  // Generate cache keys
  generateKey: (prefix: string, ...parts: (string | number)[]): string => {
    return `${prefix}:${parts.join(':')}`;
  },

  // Cache with automatic invalidation
  withInvalidation: <T>(
    cache: AdvancedCache<T>,
    key: string,
    data: T,
    invalidationKeys: string[] = [],
    ttl?: number
  ): void => {
    cache.set(key, data, ttl);
    
    // Set up invalidation
    invalidationKeys.forEach(invalidationKey => {
      const existingKeys = cache.get(`invalidation:${invalidationKey}`) as string[] || [];
      existingKeys.push(key);
      cache.set(`invalidation:${invalidationKey}`, existingKeys, ttl);
    });
  },

  // Invalidate related cache entries
  invalidate: <T>(cache: AdvancedCache<T>, invalidationKey: string): void => {
    const keysToInvalidate = cache.get(`invalidation:${invalidationKey}`) as string[] || [];
    keysToInvalidate.forEach(key => cache.delete(key));
    cache.delete(`invalidation:${invalidationKey}`);
  },

  // Warm up cache with frequently accessed data
  warmUp: async <T>(
    cache: AdvancedCache<T>,
    warmUpData: Array<{
      key: string;
      loader: () => Promise<T>;
      ttl?: number;
    }>
  ): Promise<void> => {
    const promises = warmUpData.map(async ({ key, loader, ttl }) => {
      try {
        const data = await loader();
        cache.set(key, data, ttl);
      } catch (error) {
        console.warn(`Failed to warm up cache for key: ${key}`, error);
      }
    });

    await Promise.allSettled(promises);
  },

  // Cache health monitoring
  getHealthReport: (): {
    query: CacheStats;
    user: CacheStats;
    static: CacheStats;
    overall: {
      totalSize: number;
      averageHitRate: number;
    };
  } => {
    const queryStats = queryCache.getStats();
    const userStats = userCache.getStats();
    const staticStats = staticCache.getStats();

    return {
      query: queryStats,
      user: userStats,
      static: staticStats,
      overall: {
        totalSize: queryStats.size + userStats.size + staticStats.size,
        averageHitRate: (queryStats.hitRate + userStats.hitRate + staticStats.hitRate) / 3
      }
    };
  }
};

// Performance monitoring for cache
export const CacheMonitor = {
  startMonitoring: (intervalMs: number = 60000): NodeJS.Timeout => {
    return setInterval(() => {
      const health = CacheUtils.getHealthReport();
      
      // Log cache performance
      console.log('Cache Performance Report:', {
        timestamp: new Date().toISOString(),
        ...health
      });

      // Alert if hit rate is too low
      if (health.overall.averageHitRate < 50) {
        console.warn('Low cache hit rate detected:', health.overall.averageHitRate);
      }

      // Alert if cache is getting too large
      if (health.overall.totalSize > 800) {
        console.warn('Cache size approaching limit:', health.overall.totalSize);
      }
    }, intervalMs);
  }
};
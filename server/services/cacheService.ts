/**
 * Generic Cache Service
 *
 * Provides a unified caching interface that can use either:
 * - Redis (production, preferred)
 * - In-memory Map (development fallback)
 *
 * This abstraction allows the application to work with or without Redis,
 * making development easier while maintaining production performance.
 */

import { getRedisClient, isRedisHealthy } from './redisClient.js';

// In-memory fallback cache (development only)
const memoryCache = new Map<string, { value: string; expiresAt: number | null; createdAt: number }>();

// Maximum number of entries in the in-memory cache to prevent unbounded growth
const MAX_CACHE_SIZE = 1000;

/**
 * Evict oldest entries from memory cache when size limit is exceeded.
 * Uses LRU-style eviction based on creation time.
 */
function evictOldestEntries(): void {
  if (memoryCache.size <= MAX_CACHE_SIZE) {
    return;
  }

  // Sort entries by creation time and remove oldest until under limit
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].createdAt - b[1].createdAt);

  const entriesToRemove = entries.slice(0, memoryCache.size - MAX_CACHE_SIZE + 1);
  for (const [key] of entriesToRemove) {
    memoryCache.delete(key);
  }

  console.log(`[Cache] Evicted ${entriesToRemove.length} oldest entries from memory cache (size now: ${memoryCache.size})`);
}

/**
 * Get a value from cache
 *
 * @param key - Cache key
 * @returns Cached value or null if not found/expired
 */
export async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      const value = await redis.get(key);
      return value;
    } catch (error) {
      console.error(`[Cache] Redis GET error for key "${key}":`, error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  const cached = memoryCache.get(key);
  if (!cached) {
    return null;
  }

  // Check if expired
  if (cached.expiresAt && cached.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return cached.value;
}

/**
 * Set a value in cache with optional TTL
 *
 * @param key - Cache key
 * @param value - Value to cache (will be stringified if object)
 * @param ttlSeconds - Time to live in seconds (optional)
 */
export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value);
      } else {
        await redis.set(key, value);
      }
      return;
    } catch (error) {
      console.error(`[Cache] Redis SET error for key "${key}":`, error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    createdAt: Date.now(),
  });

  // Evict oldest entries if cache exceeds size limit
  evictOldestEntries();
}

/**
 * Delete a value from cache
 *
 * @param key - Cache key
 */
export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      await redis.del(key);
      return;
    } catch (error) {
      console.error(`[Cache] Redis DEL error for key "${key}":`, error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  memoryCache.delete(key);
}

/**
 * Check if a key exists in cache
 *
 * @param key - Cache key
 * @returns True if key exists and not expired
 */
export async function cacheExists(key: string): Promise<boolean> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`[Cache] Redis EXISTS error for key "${key}":`, error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  const cached = memoryCache.get(key);
  if (!cached) {
    return false;
  }

  // Check if expired
  if (cached.expiresAt && cached.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return false;
  }

  return true;
}

/**
 * Get and parse JSON from cache
 *
 * @param key - Cache key
 * @returns Parsed object or null if not found
 */
export async function cacheGetJSON<T>(key: string): Promise<T | null> {
  const value = await cacheGet(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`[Cache] JSON parse error for key "${key}":`, error);
    await cacheDelete(key); // Delete corrupted data
    return null;
  }
}

/**
 * Stringify and set JSON in cache
 *
 * @param key - Cache key
 * @param value - Object to cache
 * @param ttlSeconds - Time to live in seconds (optional)
 */
export async function cacheSetJSON<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const stringValue = JSON.stringify(value);
  await cacheSet(key, stringValue, ttlSeconds);
}

/**
 * Get multiple keys at once (batch operation)
 *
 * @param keys - Array of cache keys
 * @returns Array of values (null for missing keys)
 */
export async function cacheMultiGet(keys: string[]): Promise<(string | null)[]> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      const values = await redis.mget(...keys);
      return values;
    } catch (error) {
      console.error('[Cache] Redis MGET error:', error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  return Promise.all(keys.map(key => cacheGet(key)));
}

/**
 * Set multiple key-value pairs at once (batch operation)
 *
 * @param entries - Array of [key, value, ttlSeconds?] tuples
 */
export async function cacheMultiSet(
  entries: Array<[string, string, number?]>
): Promise<void> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      // Use pipeline for atomic batch operation
      const pipeline = redis.pipeline();
      entries.forEach(([key, value, ttl]) => {
        if (ttl) {
          pipeline.setex(key, ttl, value);
        } else {
          pipeline.set(key, value);
        }
      });
      await pipeline.exec();
      return;
    } catch (error) {
      console.error('[Cache] Redis MSET error:', error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  await Promise.all(entries.map(([key, value, ttl]) => cacheSet(key, value, ttl)));
}

/**
 * Get all keys matching a pattern
 * WARNING: Use with caution in production - can be slow with many keys
 *
 * @param pattern - Redis key pattern (e.g., "projections:*")
 * @returns Array of matching keys
 */
export async function cacheKeys(pattern: string): Promise<string[]> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      const keys = await redis.keys(pattern);
      return keys;
    } catch (error) {
      console.error('[Cache] Redis KEYS error:', error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  const allKeys = Array.from(memoryCache.keys());
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return allKeys.filter(key => regex.test(key));
}

/**
 * Clear all keys matching a pattern
 *
 * @param pattern - Redis key pattern (e.g., "projections:*")
 */
export async function cacheClear(pattern: string): Promise<number> {
  const keys = await cacheKeys(pattern);

  if (keys.length === 0) {
    return 0;
  }

  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      const deleted = await redis.del(...keys);
      return deleted;
    } catch (error) {
      console.error('[Cache] Redis DEL error:', error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  keys.forEach(key => memoryCache.delete(key));
  return keys.length;
}

/**
 * Get TTL (time to live) for a key in seconds
 *
 * @param key - Cache key
 * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
 */
export async function cacheTTL(key: string): Promise<number> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      const ttl = await redis.ttl(key);
      return ttl;
    } catch (error) {
      console.error(`[Cache] Redis TTL error for key "${key}":`, error);
      // Fall through to memory cache
    }
  }

  // Fallback to in-memory cache
  const cached = memoryCache.get(key);
  if (!cached) {
    return -2; // Key doesn't exist
  }

  if (!cached.expiresAt) {
    return -1; // No expiry
  }

  const ttlMs = cached.expiresAt - Date.now();
  return Math.max(0, Math.floor(ttlMs / 1000));
}

/**
 * Get cache statistics
 *
 * @returns Cache size and backend info
 */
export async function getCacheStats(): Promise<{
  backend: 'redis' | 'memory';
  size: number;
  redisInfo?: any;
}> {
  const redis = getRedisClient();

  if (redis && isRedisHealthy()) {
    try {
      const dbsize = await redis.dbsize();
      const info = await redis.info('memory');
      return {
        backend: 'redis',
        size: dbsize,
        redisInfo: info,
      };
    } catch (error) {
      console.error('[Cache] Redis INFO error:', error);
    }
  }

  // Fallback to in-memory cache
  return {
    backend: 'memory',
    size: memoryCache.size,
  };
}

/**
 * Clear the in-memory cache (development only)
 * Redis cache should be cleared using cacheClear() with patterns
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
  console.log('[Cache] Memory cache cleared');
}

/**
 * Clean up expired entries from memory cache
 * This is automatically done on read, but can be called manually
 */
export function cleanupMemoryCache(): number {
  let cleaned = 0;
  const now = Date.now();

  for (const [key, cached] of memoryCache.entries()) {
    if (cached.expiresAt && cached.expiresAt < now) {
      memoryCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Cache] Cleaned up ${cleaned} expired memory cache entries`);
  }

  return cleaned;
}

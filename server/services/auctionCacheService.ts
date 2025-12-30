/**
 * Auction Cache Service
 * Redis-based caching with file fallback for Couch Managers auction data
 *
 * Purpose: Reduce live scraping frequency to avoid rate limiting from Couch Managers.
 *
 * Cache Strategy:
 * - Primary: Redis with configurable TTL (default: 5 minutes)
 * - Fallback: File-based cache (development without Redis)
 * - Key format: auction:{roomId}:state
 * - Per-room caching - each room ID has its own cache entry
 * - Stale-while-revalidate option for better UX
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { cacheGetJSON, cacheSetJSON, cacheDelete, cacheExists } from './cacheService.js';
import { env } from '../config/env.js';
import type { ScrapedAuctionData } from '../types/auction.js';

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), 'cache', 'auctions');
const DEFAULT_CACHE_TTL_SECONDS = env.AUCTION_CACHE_TTL_MINUTES * 60; // From env (default: 5 minutes)
const DEFAULT_CACHE_TTL_MS = DEFAULT_CACHE_TTL_SECONDS * 1000;

export interface AuctionCacheEntry {
  metadata: AuctionCacheMetadata;
  data: ScrapedAuctionData;
}

export interface AuctionCacheMetadata {
  roomId: string;
  fetchedAt: string;
  expiresAt: string;
  ttlMs: number;
  playerCount: number;
  draftedCount: number;
  teamsCount: number;
}

export interface CacheOptions {
  /** TTL in milliseconds. Default: 5 minutes */
  ttlMs?: number;
  /** If true, return stale data while refreshing in background */
  staleWhileRevalidate?: boolean;
}

/**
 * Gets the Redis cache key for an auction room
 */
function getCacheKey(roomId: string): string {
  return `auction:${roomId}:state`;
}

/**
 * Retrieves cached auction data if available and not expired.
 * Tries Redis first, falls back to file-based cache.
 *
 * @param roomId - The Couch Managers room ID
 * @param options - Cache options (ttl override, stale-while-revalidate)
 * @returns Cached data if valid, null if expired or not found
 */
export async function getCachedAuctionData(
  roomId: string,
  options: CacheOptions = {}
): Promise<{ data: ScrapedAuctionData; isStale: boolean } | null> {
  const cacheKey = getCacheKey(roomId);
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;

  // Try Redis first
  try {
    const cache = await cacheGetJSON<AuctionCacheEntry>(cacheKey);
    if (cache) {
      const expiresAt = new Date(cache.metadata.expiresAt);
      const now = new Date();

      if (expiresAt > now) {
        // Cache is fresh
        const ageMs = now.getTime() - new Date(cache.metadata.fetchedAt).getTime();
        console.log(
          `[AuctionCache] Redis cache hit for room ${roomId} ` +
          `(age: ${Math.round(ageMs / 1000)}s, expires in ${Math.round((expiresAt.getTime() - now.getTime()) / 1000)}s)`
        );
        return { data: cache.data, isStale: false };
      }

      // Cache is expired
      if (options.staleWhileRevalidate) {
        const staleAgeMs = now.getTime() - expiresAt.getTime();
        console.log(
          `[AuctionCache] Returning stale Redis data for room ${roomId} ` +
          `(stale by ${Math.round(staleAgeMs / 1000)}s)`
        );
        return { data: cache.data, isStale: true };
      }

      // Delete expired cache
      await cacheDelete(cacheKey);
    }
  } catch (error) {
    console.warn(`[AuctionCache] Redis error for room ${roomId}, falling back to file cache:`, error);
  }

  // Fallback to file-based cache
  const cacheFile = getCacheFilePath(roomId);
  try {
    const content = await fs.readFile(cacheFile, 'utf-8');
    const cache: AuctionCacheEntry = JSON.parse(content);

    const expiresAt = new Date(cache.metadata.expiresAt);
    const now = new Date();

    if (expiresAt > now) {
      // Cache is fresh
      const ageMs = now.getTime() - new Date(cache.metadata.fetchedAt).getTime();
      console.log(
        `[AuctionCache] File cache hit for room ${roomId} ` +
        `(age: ${Math.round(ageMs / 1000)}s, expires in ${Math.round((expiresAt.getTime() - now.getTime()) / 1000)}s)`
      );
      return { data: cache.data, isStale: false };
    }

    // Cache is expired
    if (options.staleWhileRevalidate) {
      const staleAgeMs = now.getTime() - expiresAt.getTime();
      console.log(
        `[AuctionCache] Returning stale file data for room ${roomId} ` +
        `(stale by ${Math.round(staleAgeMs / 1000)}s)`
      );
      return { data: cache.data, isStale: true };
    }

    console.log(`[AuctionCache] File cache expired for room ${roomId}`);
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[AuctionCache] Error reading file cache for room ${roomId}:`, error);
    }
    return null;
  }
}

/**
 * Stores auction data in the cache (both Redis and file for redundancy).
 *
 * @param roomId - The Couch Managers room ID
 * @param data - The scraped auction data
 * @param options - Cache options (ttl override)
 */
export async function setCachedAuctionData(
  roomId: string,
  data: ScrapedAuctionData,
  options: CacheOptions = {}
): Promise<void> {
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const ttlSeconds = Math.floor(ttlMs / 1000);
  const now = new Date();

  const draftedCount = data.players.filter(p => p.status === 'drafted').length;

  const metadata: AuctionCacheMetadata = {
    roomId,
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    ttlMs,
    playerCount: data.players.length,
    draftedCount,
    teamsCount: data.teams.length,
  };

  const entry: AuctionCacheEntry = { metadata, data };
  const cacheKey = getCacheKey(roomId);

  // Store in Redis with TTL
  try {
    await cacheSetJSON(cacheKey, entry, ttlSeconds);
    console.log(
      `[AuctionCache] Redis cached room ${roomId}: ${data.players.length} players, ` +
      `${draftedCount} drafted, ${data.teams.length} teams ` +
      `(TTL: ${ttlSeconds}s)`
    );
  } catch (error) {
    console.warn(`[AuctionCache] Failed to cache to Redis for room ${roomId}:`, error);
  }

  // Also store in file system as backup
  try {
    await ensureCacheDir();
    const cacheFile = getCacheFilePath(roomId);
    await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
    console.log(`[AuctionCache] File backup created for room ${roomId}`);
  } catch (error) {
    console.warn(`[AuctionCache] Failed to create file backup for room ${roomId}:`, error);
  }
}

/**
 * Invalidates (deletes) cached auction data for a room (both Redis and file).
 */
export async function invalidateAuctionCache(roomId: string): Promise<void> {
  const cacheKey = getCacheKey(roomId);

  // Delete from Redis
  try {
    await cacheDelete(cacheKey);
    console.log(`[AuctionCache] Invalidated Redis cache for room ${roomId}`);
  } catch (error) {
    console.warn(`[AuctionCache] Error invalidating Redis cache for room ${roomId}:`, error);
  }

  // Delete from file system
  const cacheFile = getCacheFilePath(roomId);
  try {
    await fs.unlink(cacheFile);
    console.log(`[AuctionCache] Invalidated file cache for room ${roomId}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[AuctionCache] Error invalidating file cache for room ${roomId}:`, error);
    }
  }
}

/**
 * Gets cache status for a specific room (checks both Redis and file).
 */
export async function getAuctionCacheStatus(roomId: string): Promise<{
  exists: boolean;
  expired: boolean;
  metadata: AuctionCacheMetadata | null;
  ageSeconds: number | null;
  expiresInSeconds: number | null;
  backend?: 'redis' | 'file' | 'both' | 'none';
}> {
  const cacheKey = getCacheKey(roomId);
  let redisExists = false;
  let fileExists = false;
  let cache: AuctionCacheEntry | null = null;

  // Check Redis
  try {
    redisExists = await cacheExists(cacheKey);
    if (redisExists) {
      cache = await cacheGetJSON<AuctionCacheEntry>(cacheKey);
    }
  } catch (error) {
    console.warn(`[AuctionCache] Error checking Redis for room ${roomId}:`, error);
  }

  // Check file system
  const cacheFile = getCacheFilePath(roomId);
  try {
    await fs.access(cacheFile);
    fileExists = true;
    if (!cache) {
      const content = await fs.readFile(cacheFile, 'utf-8');
      cache = JSON.parse(content);
    }
  } catch {
    // File doesn't exist
  }

  if (!cache) {
    return {
      exists: false,
      expired: true,
      metadata: null,
      ageSeconds: null,
      expiresInSeconds: null,
      backend: 'none',
    };
  }

  const now = new Date();
  const fetchedAt = new Date(cache.metadata.fetchedAt);
  const expiresAt = new Date(cache.metadata.expiresAt);
  const expired = expiresAt <= now;

  let backend: 'redis' | 'file' | 'both' | 'none' = 'none';
  if (redisExists && fileExists) backend = 'both';
  else if (redisExists) backend = 'redis';
  else if (fileExists) backend = 'file';

  return {
    exists: true,
    expired,
    metadata: cache.metadata,
    ageSeconds: Math.round((now.getTime() - fetchedAt.getTime()) / 1000),
    expiresInSeconds: expired ? 0 : Math.round((expiresAt.getTime() - now.getTime()) / 1000),
    backend,
  };
}

/**
 * Lists all cached auction rooms.
 */
export async function listCachedAuctionRooms(): Promise<Array<{
  roomId: string;
  metadata: AuctionCacheMetadata;
  expired: boolean;
}>> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);

    const results = [];
    for (const file of files) {
      if (!file.startsWith('room-') || !file.endsWith('.json')) continue;

      const roomId = file.replace('room-', '').replace('.json', '');
      const status = await getAuctionCacheStatus(roomId);

      if (status.exists && status.metadata) {
        results.push({
          roomId,
          metadata: status.metadata,
          expired: status.expired,
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Cleans up expired cache entries older than a threshold.
 *
 * @param maxAgeMs - Maximum age of expired entries to keep (default: 1 hour)
 */
export async function cleanupExpiredCaches(maxAgeMs: number = 60 * 60 * 1000): Promise<number> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);
    const now = new Date();
    let cleaned = 0;

    for (const file of files) {
      if (!file.startsWith('room-') || !file.endsWith('.json')) continue;

      const filePath = path.join(CACHE_DIR, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const cache: AuctionCacheEntry = JSON.parse(content);
        const expiresAt = new Date(cache.metadata.expiresAt);

        // Delete if expired and older than maxAge
        if (expiresAt <= now && (now.getTime() - expiresAt.getTime()) > maxAgeMs) {
          await fs.unlink(filePath);
          cleaned++;
        }
      } catch {
        // Invalid file, delete it
        await fs.unlink(filePath);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[AuctionCache] Cleaned up ${cleaned} expired cache entries`);
    }
    return cleaned;
  } catch {
    return 0;
  }
}

/**
 * Gets the cache file path for an auction room.
 */
function getCacheFilePath(roomId: string): string {
  return path.join(CACHE_DIR, `room-${roomId}.json`);
}

/**
 * Ensures the cache directory exists.
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

// Export constants for configuration
export const AUCTION_CACHE_DEFAULTS = {
  TTL_MS: DEFAULT_CACHE_TTL_MS,
  TTL_SECONDS: DEFAULT_CACHE_TTL_MS / 1000,
  CACHE_DIR,
};

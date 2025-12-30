/**
 * Auction Cache Service
 * File-based caching for Couch Managers auction data with configurable TTL.
 *
 * Purpose: Reduce live scraping frequency to avoid rate limiting from Couch Managers.
 *
 * Cache Strategy:
 * - Default 5-minute TTL for active drafts (configurable)
 * - File-based storage survives server restarts
 * - Per-room caching - each room ID has its own cache file
 * - Stale-while-revalidate option for better UX
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { ScrapedAuctionData } from '../types/auction';

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), 'cache', 'auctions');
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default

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
 * Retrieves cached auction data if available and not expired.
 *
 * @param roomId - The Couch Managers room ID
 * @param options - Cache options (ttl override, stale-while-revalidate)
 * @returns Cached data if valid, null if expired or not found
 */
export async function getCachedAuctionData(
  roomId: string,
  options: CacheOptions = {}
): Promise<{ data: ScrapedAuctionData; isStale: boolean } | null> {
  const cacheFile = getCacheFilePath(roomId);
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;

  try {
    const content = await fs.readFile(cacheFile, 'utf-8');
    const cache: AuctionCacheEntry = JSON.parse(content);

    const expiresAt = new Date(cache.metadata.expiresAt);
    const now = new Date();

    if (expiresAt > now) {
      // Cache is fresh
      const ageMs = now.getTime() - new Date(cache.metadata.fetchedAt).getTime();
      console.log(
        `[AuctionCache] Cache hit for room ${roomId} ` +
        `(age: ${Math.round(ageMs / 1000)}s, expires in ${Math.round((expiresAt.getTime() - now.getTime()) / 1000)}s)`
      );
      return { data: cache.data, isStale: false };
    }

    // Cache is expired
    if (options.staleWhileRevalidate) {
      // Return stale data but flag it
      const staleAgeMs = now.getTime() - expiresAt.getTime();
      console.log(
        `[AuctionCache] Returning stale data for room ${roomId} ` +
        `(stale by ${Math.round(staleAgeMs / 1000)}s)`
      );
      return { data: cache.data, isStale: true };
    }

    console.log(`[AuctionCache] Cache expired for room ${roomId}`);
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[AuctionCache] Error reading cache for room ${roomId}:`, error);
    }
    return null;
  }
}

/**
 * Stores auction data in the cache.
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
  await ensureCacheDir();

  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
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
  const cacheFile = getCacheFilePath(roomId);

  await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));

  console.log(
    `[AuctionCache] Cached room ${roomId}: ${data.players.length} players, ` +
    `${draftedCount} drafted, ${data.teams.length} teams ` +
    `(TTL: ${Math.round(ttlMs / 1000)}s)`
  );
}

/**
 * Invalidates (deletes) cached auction data for a room.
 */
export async function invalidateAuctionCache(roomId: string): Promise<void> {
  const cacheFile = getCacheFilePath(roomId);

  try {
    await fs.unlink(cacheFile);
    console.log(`[AuctionCache] Invalidated cache for room ${roomId}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[AuctionCache] Error invalidating cache for room ${roomId}:`, error);
    }
  }
}

/**
 * Gets cache status for a specific room.
 */
export async function getAuctionCacheStatus(roomId: string): Promise<{
  exists: boolean;
  expired: boolean;
  metadata: AuctionCacheMetadata | null;
  ageSeconds: number | null;
  expiresInSeconds: number | null;
}> {
  const cacheFile = getCacheFilePath(roomId);

  try {
    const content = await fs.readFile(cacheFile, 'utf-8');
    const cache: AuctionCacheEntry = JSON.parse(content);

    const now = new Date();
    const fetchedAt = new Date(cache.metadata.fetchedAt);
    const expiresAt = new Date(cache.metadata.expiresAt);
    const expired = expiresAt <= now;

    return {
      exists: true,
      expired,
      metadata: cache.metadata,
      ageSeconds: Math.round((now.getTime() - fetchedAt.getTime()) / 1000),
      expiresInSeconds: expired ? 0 : Math.round((expiresAt.getTime() - now.getTime()) / 1000),
    };
  } catch {
    return {
      exists: false,
      expired: true,
      metadata: null,
      ageSeconds: null,
      expiresInSeconds: null,
    };
  }
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

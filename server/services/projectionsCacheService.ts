/**
 * Projections Cache Service
 * Redis-based caching with file-based fallback for projection data with 24-hour TTL
 *
 * Cache Strategy:
 * - Primary: Redis with 24-hour TTL (production)
 * - Fallback: File-based cache (development without Redis)
 * - Key format: projections:{system}:{year}
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { cacheGetJSON, cacheSetJSON, cacheDelete, cacheExists } from './cacheService.js';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import type {
  NormalizedProjection,
  ProjectionCacheEntry,
  ProjectionCacheMetadata,
} from '../types/projections.js';

// Cache directory - use process.cwd() to find project root (fallback only)
const CACHE_DIR = path.join(process.cwd(), 'cache');
const CACHE_TTL_SECONDS = env.PROJECTIONS_CACHE_TTL_HOURS * 60 * 60; // From env config (default: 24 hours)
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Gets the Redis cache key for a projection system
 */
function getCacheKey(system: string): string {
  return `projections:${system}:${CURRENT_YEAR}`;
}

/**
 * Retrieves cached projections if available and not expired
 * Tries Redis first, falls back to file-based cache
 */
export async function getCachedProjections(
  system: string
): Promise<ProjectionCacheEntry | null> {
  const cacheKey = getCacheKey(system);

  // Try Redis first
  try {
    const cached = await cacheGetJSON<ProjectionCacheEntry>(cacheKey);
    if (cached) {
      // Check if cache is still valid (Redis TTL handles this, but double-check)
      const expiresAt = new Date(cached.metadata.expiresAt);
      if (expiresAt > new Date()) {
        logger.debug({ system, expiresAt: expiresAt.toISOString() }, 'Redis cache hit for projections');
        return cached;
      }
      // Expired - delete from Redis
      await cacheDelete(cacheKey);
    }
  } catch (error) {
    logger.warn({ error, system }, 'Redis error for projections, falling back to file cache');
  }

  // Fallback to file-based cache
  const cacheFile = getCacheFilePath(system);
  try {
    const content = await fs.readFile(cacheFile, 'utf-8');
    const cache: ProjectionCacheEntry = JSON.parse(content);

    // Check if cache is still valid
    const expiresAt = new Date(cache.metadata.expiresAt);
    if (expiresAt > new Date()) {
      logger.debug({ system, expiresAt: expiresAt.toISOString() }, 'File cache hit for projections');
      return cache;
    }

    logger.debug({ system }, 'File cache expired for projections');
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ error, system }, 'Error reading file cache for projections');
    }
    return null;
  }
}

/**
 * Stores projections in cache (both Redis and file-based for redundancy)
 */
export async function setCachedProjections(
  system: string,
  projections: NormalizedProjection[]
): Promise<void> {
  const now = new Date();
  const hitterCount = projections.filter(p => p.playerType === 'hitter').length;
  const pitcherCount = projections.filter(p => p.playerType === 'pitcher').length;

  const metadata: ProjectionCacheMetadata = {
    system,
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    playerCount: projections.length,
    hitterCount,
    pitcherCount,
  };

  const entry: ProjectionCacheEntry = {
    metadata,
    projections,
  };

  const cacheKey = getCacheKey(system);

  // Store in Redis with TTL
  try {
    await cacheSetJSON(cacheKey, entry, CACHE_TTL_SECONDS);
    logger.info({
      system,
      playerCount: projections.length,
      hitterCount,
      pitcherCount,
      ttlHours: CACHE_TTL_SECONDS / 3600,
    }, 'Redis cached projections');
  } catch (error) {
    logger.warn({ error, system }, 'Failed to cache projections to Redis');
  }

  // Also store in file system as backup (survives Redis restarts in development)
  try {
    await ensureCacheDir();
    const cacheFile = getCacheFilePath(system);
    await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
    logger.debug({ system }, 'File backup created for projections');
  } catch (error) {
    logger.warn({ error, system }, 'Failed to create file backup for projections');
  }
}

/**
 * Invalidates (deletes) cached projections for a system (both Redis and file)
 */
export async function invalidateCache(system: string): Promise<void> {
  const cacheKey = getCacheKey(system);

  // Delete from Redis
  try {
    await cacheDelete(cacheKey);
    logger.info({ system }, 'Invalidated Redis cache for projections');
  } catch (error) {
    logger.warn({ error, system }, 'Error invalidating Redis cache for projections');
  }

  // Delete from file system
  const cacheFile = getCacheFilePath(system);
  try {
    await fs.unlink(cacheFile);
    logger.info({ system }, 'Invalidated file cache for projections');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ error, system }, 'Error invalidating file cache for projections');
    }
  }
}

/**
 * Gets cache status for a projection system
 */
export async function getCacheStatus(system: string): Promise<{
  exists: boolean;
  expired: boolean;
  metadata: ProjectionCacheMetadata | null;
  backend?: 'redis' | 'file' | 'both' | 'none';
}> {
  const cacheKey = getCacheKey(system);
  let redisExists = false;
  let fileExists = false;
  let cached: ProjectionCacheEntry | null = null;

  // Check Redis
  try {
    redisExists = await cacheExists(cacheKey);
    if (redisExists) {
      cached = await cacheGetJSON<ProjectionCacheEntry>(cacheKey);
    }
  } catch (error) {
    logger.warn({ error, system }, 'Error checking Redis for projections');
  }

  // Check file system
  const cacheFile = getCacheFilePath(system);
  try {
    await fs.access(cacheFile);
    fileExists = true;
    if (!cached) {
      const content = await fs.readFile(cacheFile, 'utf-8');
      cached = JSON.parse(content);
    }
  } catch {
    // File doesn't exist
  }

  if (!cached) {
    return {
      exists: false,
      expired: true,
      metadata: null,
      backend: 'none',
    };
  }

  const expiresAt = new Date(cached.metadata.expiresAt);
  const expired = expiresAt <= new Date();

  let backend: 'redis' | 'file' | 'both' | 'none' = 'none';
  if (redisExists && fileExists) backend = 'both';
  else if (redisExists) backend = 'redis';
  else if (fileExists) backend = 'file';

  return {
    exists: true,
    expired,
    metadata: cached.metadata,
    backend,
  };
}

/**
 * Lists all cached projection systems (checks both Redis and files)
 */
export async function listCachedSystems(): Promise<string[]> {
  const systems = new Set<string>();

  // Check file system
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);

    files
      .filter(f => f.startsWith('projections-') && f.endsWith('.json'))
      .forEach(f => {
        // Extract system name from filename: projections-{system}.json
        const match = f.match(/^projections-(.+)\.json$/);
        if (match) systems.add(match[1]);
      });
  } catch (error) {
    logger.warn({ error }, 'Error listing file cache for projections');
  }

  // Note: We don't check Redis keys here because KEYS command is expensive
  // The file system should have all cached systems as we write to both

  return Array.from(systems);
}

/**
 * Gets the cache file path for a projection system
 */
function getCacheFilePath(system: string): string {
  // Use simple filename without date - we check expiry via metadata
  return path.join(CACHE_DIR, `projections-${system}.json`);
}

/**
 * Ensures the cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists or other error
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

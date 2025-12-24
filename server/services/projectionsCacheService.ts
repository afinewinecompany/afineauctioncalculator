/**
 * Projections Cache Service
 * File-based caching for projection data with 24-hour TTL
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  NormalizedProjection,
  ProjectionCacheEntry,
  ProjectionCacheMetadata,
} from '../types/projections';

// Cache directory relative to server folder
const CACHE_DIR = path.join(__dirname, '../../cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Retrieves cached projections if available and not expired
 */
export async function getCachedProjections(
  system: string
): Promise<ProjectionCacheEntry | null> {
  const cacheFile = getCacheFilePath(system);

  try {
    const content = await fs.readFile(cacheFile, 'utf-8');
    const cache: ProjectionCacheEntry = JSON.parse(content);

    // Check if cache is still valid
    const expiresAt = new Date(cache.metadata.expiresAt);
    if (expiresAt > new Date()) {
      console.log(`Cache hit for ${system} projections (expires ${expiresAt.toISOString()})`);
      return cache;
    }

    console.log(`Cache expired for ${system} projections`);
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Error reading cache for ${system}:`, error);
    }
    return null;
  }
}

/**
 * Stores projections in cache
 */
export async function setCachedProjections(
  system: string,
  projections: NormalizedProjection[]
): Promise<void> {
  await ensureCacheDir();

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

  const cacheFile = getCacheFilePath(system);
  await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));

  console.log(
    `Cached ${projections.length} ${system} projections ` +
    `(${hitterCount} hitters, ${pitcherCount} pitchers)`
  );
}

/**
 * Invalidates (deletes) cached projections for a system
 */
export async function invalidateCache(system: string): Promise<void> {
  const cacheFile = getCacheFilePath(system);

  try {
    await fs.unlink(cacheFile);
    console.log(`Invalidated cache for ${system} projections`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Error invalidating cache for ${system}:`, error);
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
}> {
  const cached = await getCachedProjections(system);

  if (!cached) {
    return { exists: false, expired: true, metadata: null };
  }

  const expiresAt = new Date(cached.metadata.expiresAt);
  const expired = expiresAt <= new Date();

  return {
    exists: true,
    expired,
    metadata: cached.metadata,
  };
}

/**
 * Lists all cached projection systems
 */
export async function listCachedSystems(): Promise<string[]> {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);

    return files
      .filter(f => f.startsWith('projections-') && f.endsWith('.json'))
      .map(f => {
        // Extract system name from filename: projections-{system}.json
        const match = f.match(/^projections-(.+)\.json$/);
        return match ? match[1] : null;
      })
      .filter((s): s is string => s !== null);
  } catch {
    return [];
  }
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

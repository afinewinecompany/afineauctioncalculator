import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { scrapeAuction, scrapeDraftedPlayers } from '../services/couchManagersScraper.js';
import { matchAllPlayers } from '../services/playerMatcher.js';
import { calculateInflationStats } from '../services/inflationCalculator.js';
import { getCachedProjections } from '../services/projectionsCacheService.js';
import { getDynastyRankings } from '../services/dynastyRankingsScraper.js';
import { calculateAuctionValues } from '../services/valueCalculator.js';
import {
  getCachedAuctionData,
  setCachedAuctionData,
  invalidateAuctionCache,
  getAuctionCacheStatus,
  listCachedAuctionRooms,
  cleanupExpiredCaches,
  AUCTION_CACHE_DEFAULTS,
} from '../services/auctionCacheService.js';
import { getRedisClient, isRedisHealthy } from '../services/redisClient.js';
import { logger } from '../services/logger.js';
import type { AuctionSyncResult, ScrapedAuctionData } from '../types/auction.js';
import type { LeagueSettings } from '../../src/lib/types.js';

// Zod validation schemas for API input validation
const RosterSlotsSchema = z.object({
  C: z.number().min(0),
  '1B': z.number().min(0),
  '2B': z.number().min(0),
  '3B': z.number().min(0),
  SS: z.number().min(0),
  OF: z.number().min(0),
  CI: z.number().min(0),
  MI: z.number().min(0),
  UTIL: z.number().min(0),
  SP: z.number().min(0),
  RP: z.number().min(0),
  P: z.number().min(0),
  Bench: z.number().min(0),
}).partial();

const LeagueConfigSchema = z.object({
  numTeams: z.number().min(2).max(20),
  budgetPerTeam: z.number().min(1).max(10000),
  totalRosterSpots: z.number().min(1).max(50).optional(),
  rosterSpots: RosterSlotsSchema.optional(),
  // scoringType must match LeagueSettings - 'rotisserie' | 'h2h-categories' | 'h2h-points'
  scoringType: z.enum(['rotisserie', 'h2h-categories', 'h2h-points']).optional(),
  // leagueType must match LeagueSettings - 'redraft' | 'dynasty'
  leagueType: z.enum(['redraft', 'dynasty']).optional(),
  // Categories are passed as Record<string, boolean> from LeagueSettings
  hittingCategories: z.record(z.boolean()).optional(),
  pitchingCategories: z.record(z.boolean()).optional(),
  pointsSettings: z.record(z.number()).optional(),
  // Dynasty settings matching LeagueSettings interface
  dynastySettings: z.object({
    dynastyWeight: z.number().min(0).max(1),
    includeMinors: z.boolean(),
    rankingsSource: z.enum(['harryknowsball', 'custom']).optional(),
    customRankings: z.array(z.object({
      name: z.string(),
      rank: z.number(),
      team: z.string().optional(),
      positions: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
});

type ValidatedLeagueConfig = z.infer<typeof LeagueConfigSchema>;

/**
 * Interface matching what calculateInflationStats expects
 */
interface InflationLeagueConfig {
  numTeams: number;
  budgetPerTeam: number;
  totalRosterSpots: number;
  rosterSpots?: Record<string, number>;
}

/**
 * Validates league config from request body.
 * Returns validated config or throws an error with validation details.
 */
function validateLeagueConfig(leagueConfig: unknown): ValidatedLeagueConfig {
  const result = LeagueConfigSchema.safeParse(leagueConfig);
  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err: { path: (string | number)[]; message: string }) => `${err.path.join('.')}: ${err.message}`)
      .join('; ');
    throw new Error(`Invalid league config: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Converts validated config to the format expected by calculateInflationStats
 */
function toInflationLeagueConfig(config: ValidatedLeagueConfig): InflationLeagueConfig {
  // Calculate totalRosterSpots from rosterSpots if not provided
  const totalRosterSpots = config.totalRosterSpots ??
    (config.rosterSpots ? Object.values(config.rosterSpots).reduce((a, b) => a + (b ?? 0), 0) : 23);

  return {
    numTeams: config.numTeams,
    budgetPerTeam: config.budgetPerTeam,
    totalRosterSpots,
    rosterSpots: config.rosterSpots as Record<string, number> | undefined,
  };
}

const router = Router();

// In-memory lock map for fallback when Redis is not available
// Also used for local deduplication within a single instance
const scrapingLocks = new Map<string, Promise<ScrapedAuctionData>>();

// Redis distributed lock configuration
const REDIS_LOCK_PREFIX = 'scrape-lock:';
const REDIS_LOCK_TTL_SECONDS = 60; // Auto-expire lock after 60 seconds (safety net)

/**
 * Attempt to acquire a distributed lock using Redis.
 * Uses SET with NX (only set if not exists) and EX (expiration) for atomic lock acquisition.
 *
 * @param lockKey - The key to lock on
 * @returns true if lock was acquired, false if already locked by another instance
 */
async function acquireDistributedLock(lockKey: string): Promise<boolean> {
  if (!isRedisHealthy()) {
    return true; // Fall back to in-memory only
  }

  const redis = getRedisClient();
  if (!redis) {
    return true; // Fall back to in-memory only
  }

  try {
    // SET key value NX EX seconds - atomic operation
    // NX = only set if key doesn't exist
    // EX = expire after TTL seconds (safety net if process crashes)
    const result = await redis.set(
      `${REDIS_LOCK_PREFIX}${lockKey}`,
      Date.now().toString(), // Store timestamp as value for debugging
      'EX',
      REDIS_LOCK_TTL_SECONDS,
      'NX'
    );
    return result === 'OK';
  } catch (error) {
    logger.error({ error }, 'Redis lock acquisition failed');
    return true; // Fall back to in-memory only on error
  }
}

/**
 * Release a distributed lock in Redis.
 *
 * @param lockKey - The key to unlock
 */
async function releaseDistributedLock(lockKey: string): Promise<void> {
  if (!isRedisHealthy()) {
    return;
  }

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(`${REDIS_LOCK_PREFIX}${lockKey}`);
  } catch (error) {
    logger.error({ error, lockKey }, 'Redis lock release failed');
    // Lock will auto-expire via TTL if release fails
  }
}

/**
 * Check if a distributed lock exists in Redis.
 *
 * @param lockKey - The key to check
 * @returns true if locked by another instance, false if not locked
 */
async function isDistributedLocked(lockKey: string): Promise<boolean> {
  if (!isRedisHealthy()) {
    return false; // Can't check, assume not locked
  }

  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const exists = await redis.exists(`${REDIS_LOCK_PREFIX}${lockKey}`);
    return exists === 1;
  } catch (error) {
    logger.error({ error, lockKey }, 'Redis lock check failed');
    return false; // On error, assume not locked
  }
}

// Periodic cleanup of expired file caches (runs every 30 minutes)
// Store interval ID so it can be cleared on shutdown
let cacheCleanupIntervalId: ReturnType<typeof setInterval> | null = null;

cacheCleanupIntervalId = setInterval(() => {
  cleanupExpiredCaches(60 * 60 * 1000); // Clean entries expired > 1 hour ago
}, 30 * 60 * 1000);

/**
 * Cleanup function to be called during graceful shutdown.
 * Clears the cache cleanup interval to allow process to terminate promptly.
 */
export function cleanupAuctionRoutes(): void {
  if (cacheCleanupIntervalId) {
    clearInterval(cacheCleanupIntervalId);
    cacheCleanupIntervalId = null;
    logger.info('Cache cleanup interval cleared');
  }
}

/**
 * Helper to get auction data with file-based caching.
 * Uses distributed Redis locks (with in-memory fallback) to prevent concurrent scrapes
 * for the same room across multiple server instances.
 */
async function getAuctionDataWithCache(
  roomId: string,
  forceRefresh: boolean = false
): Promise<ScrapedAuctionData> {
  // Check file-based cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedAuctionData(roomId);
    if (cached && !cached.isStale) {
      return cached.data;
    }
  }

  const lockKey = `scraping-${roomId}`;

  // Check in-memory lock first (handles requests within same instance)
  let scrapePromise = scrapingLocks.get(lockKey);
  if (scrapePromise) {
    logger.debug({ roomId }, 'Waiting for existing local scrape');
    return scrapePromise;
  }

  // Check distributed lock (handles requests across instances)
  const isLockedRemotely = await isDistributedLocked(lockKey);
  if (isLockedRemotely) {
    // Another instance is scraping - wait briefly and check cache
    logger.debug({ roomId }, 'Room is being scraped by another instance, waiting');
    // Wait up to 30 seconds, polling cache every 2 seconds
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const cached = await getCachedAuctionData(roomId);
      if (cached && !cached.isStale) {
        logger.debug({ roomId }, 'Found cached data after waiting');
        return cached.data;
      }
      // Check if still locked
      if (!(await isDistributedLocked(lockKey))) {
        logger.debug({ roomId }, 'Remote lock released, checking cache');
        const freshCached = await getCachedAuctionData(roomId);
        if (freshCached && !freshCached.isStale) {
          return freshCached.data;
        }
        break; // Lock released but no cache - we should scrape
      }
    }
    logger.debug({ roomId }, 'Timeout waiting for remote scrape, attempting own scrape');
  }

  // Try to acquire distributed lock
  const acquiredDistributedLock = await acquireDistributedLock(lockKey);
  if (!acquiredDistributedLock) {
    // Race condition - another instance just acquired the lock
    // Wait briefly and check cache again
    logger.debug({ roomId }, 'Lost race for distributed lock, waiting');
    await new Promise(resolve => setTimeout(resolve, 5000));
    const cached = await getCachedAuctionData(roomId);
    if (cached && !cached.isStale) {
      return cached.data;
    }
    // If still no cache, proceed with scrape anyway (lock may have been released)
  }

  // No scrape in progress, start one
  logger.info({ roomId }, 'Scraping fresh auction data');
  const startTime = Date.now();

  // Create the promise and immediately add it to the local lock map
  scrapePromise = scrapeAuction(roomId).then(async data => {
    logger.info({ roomId, durationMs: Date.now() - startTime }, 'Scrape completed');

    // Cache the result if valid
    if (data.status !== 'not_found') {
      await setCachedAuctionData(roomId, data);
    }

    return data;
  }).finally(async () => {
    // Release both locks
    scrapingLocks.delete(lockKey);
    await releaseDistributedLock(lockKey);
  });

  // Set the local lock immediately (synchronously)
  scrapingLocks.set(lockKey, scrapePromise);

  return scrapePromise;
}

/**
 * GET /api/auction/:roomId
 * Scrapes the full auction state from Couch Managers.
 * Uses file-based caching with 5-minute TTL to reduce API load.
 *
 * Query params:
 * - refresh=true: Force a fresh scrape, bypassing cache
 */
router.get('/:roomId', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const forceRefresh = req.query.refresh === 'true';

  if (!roomId || !/^\d+$/.test(roomId) || roomId.length > 6) {
    return res.status(400).json({
      error: 'Invalid room ID',
      message: 'Room ID must be a numeric value up to 6 digits',
    });
  }

  try {
    // Get cache status for response metadata
    const cacheStatus = await getAuctionCacheStatus(roomId);

    const auctionData = await getAuctionDataWithCache(roomId, forceRefresh);

    if (auctionData.status === 'not_found') {
      return res.status(404).json({
        error: `Auction room ${roomId} not found`,
      });
    }

    // Include cache metadata in response
    res.json({
      ...auctionData,
      fromCache: !forceRefresh && cacheStatus.exists && !cacheStatus.expired,
      cacheInfo: {
        ageSeconds: cacheStatus.ageSeconds,
        expiresInSeconds: cacheStatus.expiresInSeconds,
        ttlSeconds: AUCTION_CACHE_DEFAULTS.TTL_SECONDS,
      },
    });
  } catch (error) {
    logger.error({ error, roomId }, 'Error fetching auction');
    res.status(503).json({
      error: 'Failed to scrape auction data. The website may be unavailable.',
    });
  }
});

/**
 * POST /api/auction/:roomId/sync
 * Syncs auction data with player projections and calculates inflation.
 * Uses file-based caching to reduce Couch Managers API load.
 *
 * Body should contain:
 * - projections: Array of player projections from the client
 * - leagueConfig: { numTeams, budgetPerTeam, totalRosterSpots }
 *
 * Query params:
 * - refresh=true: Force a fresh scrape, bypassing cache
 */
router.post('/:roomId/sync', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { projections, leagueConfig } = req.body;
  const forceRefresh = req.query.refresh === 'true';

  if (!roomId || !/^\d+$/.test(roomId) || roomId.length > 6) {
    return res.status(400).json({
      error: 'Invalid room ID',
      message: 'Room ID must be a numeric value up to 6 digits',
    });
  }

  if (!projections || !Array.isArray(projections)) {
    return res.status(400).json({
      error: 'Projections array is required in request body.',
    });
  }

  // Validate league config with Zod
  let validatedConfig;
  try {
    validatedConfig = validateLeagueConfig(leagueConfig);
  } catch (validationError) {
    return res.status(400).json({
      error: validationError instanceof Error ? validationError.message : 'Invalid league config.',
    });
  }

  try {
    // Get auction data with caching
    const auctionData = await getAuctionDataWithCache(roomId, forceRefresh);

    if (auctionData.status === 'not_found') {
      return res.status(404).json({
        error: `Auction room ${roomId} not found`,
      });
    }

    // Match scraped players to projections
    const { matched, unmatched } = matchAllPlayers(auctionData.players, projections);

    // Calculate inflation stats with team data for effective budget and positional scarcity
    const inflationLeagueConfig = toInflationLeagueConfig(validatedConfig);
    const inflationStats = calculateInflationStats(matched, inflationLeagueConfig, auctionData.teams);

    const result: AuctionSyncResult = {
      auctionData,
      matchedPlayers: matched,
      inflationStats,
      unmatchedPlayers: unmatched,
    };

    res.json(result);
  } catch (error) {
    logger.error({ error, roomId }, 'Error syncing auction');
    res.status(503).json({
      error: 'Failed to sync auction data.',
    });
  }
});

/**
 * POST /api/auction/:roomId/sync-lite
 * Lightweight sync that uses server-cached projections instead of client sending full player list.
 * Much smaller payload - only sends league config.
 * Uses file-based caching with 5-minute TTL to reduce Couch Managers API load.
 *
 * Body should contain:
 * - projectionSystem: 'steamer' | 'batx' | 'ja'
 * - leagueConfig: { numTeams, budgetPerTeam, totalRosterSpots }
 *
 * Query params:
 * - refresh=true: Force a fresh scrape, bypassing cache
 */
router.post('/:roomId/sync-lite', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { projectionSystem = 'steamer', leagueConfig } = req.body;
  const forceRefresh = req.query.refresh === 'true';

  if (!roomId || !/^\d+$/.test(roomId) || roomId.length > 6) {
    return res.status(400).json({
      error: 'Invalid room ID',
      message: 'Room ID must be a numeric value up to 6 digits',
    });
  }

  // Validate league config with Zod
  let validatedConfig;
  try {
    validatedConfig = validateLeagueConfig(leagueConfig);
  } catch (validationError) {
    return res.status(400).json({
      error: validationError instanceof Error ? validationError.message : 'Invalid league config.',
    });
  }

  try {
    // Get projections from server cache, or fetch fresh if cache is empty
    let cachedProjections = await getCachedProjections(projectionSystem);
    if (!cachedProjections) {
      logger.info({ projectionSystem }, 'No cached projections, fetching fresh');
      try {
        // Import and fetch projections dynamically based on system
        const { fetchSteamerProjections } = await import('../services/projectionsService');
        const { fetchJAProjections } = await import('../services/jaProjectionsService');
        const { setCachedProjections } = await import('../services/projectionsCacheService');

        let projections;
        switch (projectionSystem) {
          case 'steamer':
            projections = await fetchSteamerProjections();
            break;
          case 'ja':
            projections = await fetchJAProjections();
            break;
          default:
            return res.status(400).json({ error: `Unsupported projection system: ${projectionSystem}` });
        }

        await setCachedProjections(projectionSystem, projections);
        cachedProjections = await getCachedProjections(projectionSystem);
        logger.info({ projectionSystem, count: projections.length }, 'Successfully fetched and cached projections');
      } catch (fetchError) {
        logger.error({ error: fetchError, projectionSystem }, 'Failed to fetch projections');
        return res.status(503).json({
          error: `Failed to fetch projections for ${projectionSystem}. Please try again.`,
        });
      }
    }

    if (!cachedProjections) {
      return res.status(503).json({
        error: `No projections available for ${projectionSystem}.`,
      });
    }

    // Build LeagueSettings from validated config for value calculation
    // Use provided rosterSpots or defaults (must have all required fields)
    const defaultRosterSpots: LeagueSettings['rosterSpots'] = {
      C: 2, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 5,
      CI: 1, MI: 1, UTIL: 2, SP: 4, RP: 2, P: 1, Bench: 2
    };
    // Merge provided slots with defaults to ensure all required fields
    const rosterSpots: LeagueSettings['rosterSpots'] = {
      ...defaultRosterSpots,
      ...(validatedConfig.rosterSpots ?? {}),
    };

    // Use scoring type from client, with sensible defaults
    const scoringType: LeagueSettings['scoringType'] = validatedConfig.scoringType || 'h2h-categories';
    const leagueType: LeagueSettings['leagueType'] = validatedConfig.leagueType || 'redraft';

    const leagueSettings: LeagueSettings = {
      leagueName: 'Auction',
      couchManagerRoomId: roomId,
      numTeams: validatedConfig.numTeams,
      budgetPerTeam: validatedConfig.budgetPerTeam,
      rosterSpots,
      leagueType,
      scoringType,
      projectionSystem: projectionSystem as LeagueSettings['projectionSystem'],
      // Pass user-selected categories if provided (cast to expected type)
      hittingCategories: validatedConfig.hittingCategories as LeagueSettings['hittingCategories'],
      pitchingCategories: validatedConfig.pitchingCategories as LeagueSettings['pitchingCategories'],
      pointsSettings: validatedConfig.pointsSettings,
      dynastySettings: validatedConfig.dynastySettings,
    };

    // For dynasty leagues, fetch dynasty rankings
    let dynastyRankings;
    if (leagueSettings.leagueType === 'dynasty') {
      logger.info('Dynasty mode - fetching dynasty rankings');
      try {
        dynastyRankings = await getDynastyRankings();
        logger.info({ count: dynastyRankings.length }, 'Loaded dynasty rankings');
      } catch (dynastyError) {
        logger.warn({ error: dynastyError }, 'Failed to load dynasty rankings, using steamer-only');
      }
    }

    // Calculate auction values for all players (with optional dynasty rankings)
    const valuedResult = calculateAuctionValues(cachedProjections.projections, leagueSettings, dynastyRankings);

    // Transform to the format expected by playerMatcher
    // Include mlbamId for cross-projection-system matching
    const projections = valuedResult.players.map(p => ({
      id: p.externalId,
      mlbamId: p.mlbamId, // MLB.com ID - consistent across projection systems
      name: p.name,
      team: p.team,
      positions: p.positions,
      projectedValue: p.auctionValue ?? 0,
    }));

    // Get auction data with file-based caching
    const auctionData = await getAuctionDataWithCache(roomId, forceRefresh);

    if (auctionData.status === 'not_found') {
      return res.status(404).json({
        error: `Auction room ${roomId} not found`,
      });
    }

    // Match scraped players to projections
    const { matched, unmatched } = matchAllPlayers(auctionData.players, projections);

    // Calculate inflation stats with team data for effective budget and positional scarcity
    const inflationLeagueConfig = toInflationLeagueConfig(validatedConfig);
    const inflationStats = calculateInflationStats(matched, inflationLeagueConfig, auctionData.teams);

    // Get cache status for response metadata
    const cacheStatus = await getAuctionCacheStatus(roomId);

    const result: AuctionSyncResult = {
      auctionData,
      matchedPlayers: matched,
      inflationStats,
      unmatchedPlayers: unmatched,
    };

    res.json({
      ...result,
      fromCache: !forceRefresh && cacheStatus.exists && !cacheStatus.expired,
      cacheInfo: {
        ageSeconds: cacheStatus.ageSeconds,
        expiresInSeconds: cacheStatus.expiresInSeconds,
        ttlSeconds: AUCTION_CACHE_DEFAULTS.TTL_SECONDS,
      },
    });
  } catch (error) {
    logger.error({ error, roomId }, 'Error syncing auction (lite)');
    res.status(503).json({
      error: 'Failed to sync auction data.',
    });
  }
});

/**
 * GET /api/auction/:roomId/current
 * Gets only the current auction (player on block) - lightweight endpoint for frequent polling.
 * Uses file-based caching with 5-minute TTL.
 */
router.get('/:roomId/current', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const forceRefresh = req.query.refresh === 'true';

  if (!roomId || !/^\d+$/.test(roomId) || roomId.length > 6) {
    return res.status(400).json({
      error: 'Invalid room ID',
      message: 'Room ID must be a numeric value up to 6 digits',
    });
  }

  try {
    // Use same cache as full auction data
    const auctionData = await getAuctionDataWithCache(roomId, forceRefresh);

    if (auctionData.status === 'not_found') {
      return res.status(404).json({
        error: `Auction room ${roomId} not found`,
      });
    }

    const cacheStatus = await getAuctionCacheStatus(roomId);

    res.json({
      draftedPlayers: auctionData.players.filter(p => p.status === 'drafted'),
      currentAuction: auctionData.currentAuction,
      totalMoneySpent: auctionData.totalMoneySpent,
      fromCache: !forceRefresh && cacheStatus.exists && !cacheStatus.expired,
      cacheInfo: {
        ageSeconds: cacheStatus.ageSeconds,
        expiresInSeconds: cacheStatus.expiresInSeconds,
        ttlSeconds: AUCTION_CACHE_DEFAULTS.TTL_SECONDS,
      },
    });
  } catch (error) {
    logger.error({ error, roomId }, 'Error fetching current auction');
    res.status(503).json({
      error: 'Failed to fetch current auction.',
    });
  }
});

/**
 * GET /api/auction/:roomId/cache
 * Gets cache status for a specific room. Useful for debugging.
 */
router.get('/:roomId/cache', async (req: Request, res: Response) => {
  const { roomId } = req.params;

  if (!roomId || !/^\d+$/.test(roomId) || roomId.length > 6) {
    return res.status(400).json({
      error: 'Invalid room ID',
      message: 'Room ID must be a numeric value up to 6 digits',
    });
  }

  const status = await getAuctionCacheStatus(roomId);
  res.json({
    roomId,
    ...status,
    ttlSeconds: AUCTION_CACHE_DEFAULTS.TTL_SECONDS,
  });
});

/**
 * DELETE /api/auction/:roomId/cache
 * Invalidates (clears) the cache for a specific room.
 * Useful when you know the data is stale and need fresh data.
 */
router.delete('/:roomId/cache', async (req: Request, res: Response) => {
  const { roomId } = req.params;

  if (!roomId || !/^\d+$/.test(roomId) || roomId.length > 6) {
    return res.status(400).json({
      error: 'Invalid room ID',
      message: 'Room ID must be a numeric value up to 6 digits',
    });
  }

  await invalidateAuctionCache(roomId);
  res.json({
    success: true,
    message: `Cache invalidated for room ${roomId}`,
  });
});

/**
 * GET /api/auction/cache/status
 * Lists all cached auction rooms and their status.
 * Useful for monitoring cache health.
 */
router.get('/cache/status', async (_req: Request, res: Response) => {
  try {
    const rooms = await listCachedAuctionRooms();
    res.json({
      cachedRoomCount: rooms.length,
      ttlSeconds: AUCTION_CACHE_DEFAULTS.TTL_SECONDS,
      rooms: rooms.map(r => ({
        roomId: r.roomId,
        expired: r.expired,
        fetchedAt: r.metadata.fetchedAt,
        expiresAt: r.metadata.expiresAt,
        playerCount: r.metadata.playerCount,
        draftedCount: r.metadata.draftedCount,
        teamsCount: r.metadata.teamsCount,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Error listing cached rooms');
    res.status(500).json({ error: 'Failed to list cached rooms' });
  }
});

/**
 * POST /api/auction/cache/cleanup
 * Manually trigger cleanup of expired cache entries.
 */
router.post('/cache/cleanup', async (_req: Request, res: Response) => {
  try {
    const cleaned = await cleanupExpiredCaches(0); // Clean all expired entries
    res.json({
      success: true,
      cleanedCount: cleaned,
      message: `Cleaned ${cleaned} expired cache entries`,
    });
  } catch (error) {
    logger.error({ error }, 'Error cleaning up caches');
    res.status(500).json({ error: 'Failed to cleanup caches' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { scrapeAuction, scrapeDraftedPlayers } from '../services/couchManagersScraper';
import { matchAllPlayers } from '../services/playerMatcher';
import { calculateInflationStats } from '../services/inflationCalculator';
import { getCachedProjections } from '../services/projectionsCacheService';
import { calculateAuctionValues } from '../services/valueCalculator';
import type { AuctionSyncResult } from '../types/auction';
import type { LeagueSettings } from '../../src/lib/types';

const router = Router();

// In-memory cache to avoid hammering the website
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds for scrape cache
const SYNC_CACHE_TTL = 60000; // 60 seconds for full sync results (slightly longer)

// Lock map to prevent cache stampede (multiple concurrent scrapes for same room)
const scrapingLocks = new Map<string, Promise<any>>();

// Periodic cache cleanup to prevent memory leaks (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > SYNC_CACHE_TTL * 2) {
      cache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
  }
}, 5 * 60 * 1000);

function getCached<T>(key: string, ttl: number = CACHE_TTL): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T;
  }
  return null;
}

function getCacheAge(key: string): number {
  const entry = cache.get(key);
  if (!entry) return Infinity;
  return Date.now() - entry.timestamp;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * GET /api/auction/:roomId
 * Scrapes the full auction state from Couch Managers
 */
router.get('/:roomId', async (req: Request, res: Response) => {
  const { roomId } = req.params;

  if (!roomId || !/^\d+$/.test(roomId)) {
    return res.status(400).json({
      error: 'Invalid room ID. Must be a numeric value.',
    });
  }

  try {
    // Check cache first
    const cacheKey = `auction-${roomId}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const auctionData = await scrapeAuction(roomId);

    if (auctionData.status === 'not_found') {
      return res.status(404).json({
        error: `Auction room ${roomId} not found`,
      });
    }

    setCache(cacheKey, auctionData);
    res.json(auctionData);
  } catch (error) {
    console.error(`Error fetching auction ${roomId}:`, error);
    res.status(503).json({
      error: 'Failed to scrape auction data. The website may be unavailable.',
    });
  }
});

/**
 * POST /api/auction/:roomId/sync
 * Syncs auction data with player projections and calculates inflation.
 *
 * Body should contain:
 * - projections: Array of player projections from the client
 * - leagueConfig: { numTeams, budgetPerTeam, totalRosterSpots }
 */
router.post('/:roomId/sync', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { projections, leagueConfig } = req.body;

  if (!roomId || !/^\d+$/.test(roomId)) {
    return res.status(400).json({
      error: 'Invalid room ID. Must be a numeric value.',
    });
  }

  if (!projections || !Array.isArray(projections)) {
    return res.status(400).json({
      error: 'Projections array is required in request body.',
    });
  }

  if (!leagueConfig || !leagueConfig.numTeams || !leagueConfig.budgetPerTeam) {
    return res.status(400).json({
      error: 'League config (numTeams, budgetPerTeam, totalRosterSpots) is required.',
    });
  }

  try {
    // Scrape current auction state
    const auctionData = await scrapeAuction(roomId);

    if (auctionData.status === 'not_found') {
      return res.status(404).json({
        error: `Auction room ${roomId} not found`,
      });
    }

    // Match scraped players to projections
    const { matched, unmatched } = matchAllPlayers(auctionData.players, projections);

    // Calculate inflation stats with team data for effective budget and positional scarcity
    const inflationStats = calculateInflationStats(matched, leagueConfig, auctionData.teams);

    const result: AuctionSyncResult = {
      auctionData,
      matchedPlayers: matched,
      inflationStats,
      unmatchedPlayers: unmatched,
    };

    res.json(result);
  } catch (error) {
    console.error(`Error syncing auction ${roomId}:`, error);
    res.status(503).json({
      error: 'Failed to sync auction data.',
    });
  }
});

/**
 * POST /api/auction/:roomId/sync-lite
 * Lightweight sync that uses server-cached projections instead of client sending full player list.
 * Much smaller payload - only sends league config.
 *
 * Body should contain:
 * - projectionSystem: 'steamer' | 'batx' | 'ja'
 * - leagueConfig: { numTeams, budgetPerTeam, totalRosterSpots }
 */
router.post('/:roomId/sync-lite', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { projectionSystem = 'steamer', leagueConfig } = req.body;

  if (!roomId || !/^\d+$/.test(roomId)) {
    return res.status(400).json({
      error: 'Invalid room ID. Must be a numeric value.',
    });
  }

  if (!leagueConfig || !leagueConfig.numTeams || !leagueConfig.budgetPerTeam) {
    return res.status(400).json({
      error: 'League config (numTeams, budgetPerTeam, totalRosterSpots) is required.',
    });
  }

  try {
    // PERFORMANCE: Check for cached sync result first (saves ~30-60 seconds on repeat requests)
    const syncCacheKey = `sync-lite-${roomId}-${projectionSystem}`;
    const cachedResult = getCached<AuctionSyncResult>(syncCacheKey, SYNC_CACHE_TTL);
    if (cachedResult) {
      console.log(`[sync-lite] Returning cached result for room ${roomId} (age: ${Math.round(getCacheAge(syncCacheKey) / 1000)}s)`);
      return res.json({ ...cachedResult, fromCache: true });
    }

    // Get projections from server cache
    const cachedProjections = await getCachedProjections(projectionSystem);
    if (!cachedProjections) {
      return res.status(503).json({
        error: `No cached projections available for ${projectionSystem}. Please load projections first.`,
      });
    }

    // Build LeagueSettings from leagueConfig for value calculation
    // Use provided rosterSpots or defaults
    const defaultRosterSpots = {
      C: 2, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 5,
      CI: 1, MI: 1, UTIL: 2, SP: 4, RP: 2, P: 1, Bench: 2
    };
    const rosterSpots = leagueConfig.rosterSpots || defaultRosterSpots;

    // Use scoring type and categories from client, with sensible defaults
    const scoringType = leagueConfig.scoringType || 'h2h-categories';

    const leagueSettings: LeagueSettings = {
      leagueName: 'Auction',
      couchManagerRoomId: roomId,
      numTeams: leagueConfig.numTeams,
      budgetPerTeam: leagueConfig.budgetPerTeam,
      rosterSpots,
      scoringType,
      projectionSystem: projectionSystem as LeagueSettings['projectionSystem'],
      // Pass user-selected categories if provided
      hittingCategories: leagueConfig.hittingCategories,
      pitchingCategories: leagueConfig.pitchingCategories,
      pointsSettings: leagueConfig.pointsSettings,
    };

    // Calculate auction values for all players
    const valuedResult = calculateAuctionValues(cachedProjections.projections, leagueSettings);

    // Transform to the format expected by playerMatcher
    const projections = valuedResult.players.map(p => ({
      id: p.externalId,
      name: p.name,
      team: p.team,
      positions: p.positions,
      projectedValue: p.auctionValue ?? 0,
    }));

    // PERFORMANCE: Check for cached scrape data first, otherwise scrape fresh
    // Uses lock to prevent cache stampede (multiple concurrent scrapes for same room)
    const scrapeCacheKey = `auction-${roomId}`;
    let auctionData = getCached<any>(scrapeCacheKey);

    if (!auctionData) {
      // Check if a scrape is already in progress for this room
      const lockKey = `scraping-${roomId}`;
      let scrapePromise = scrapingLocks.get(lockKey);

      if (!scrapePromise) {
        // No scrape in progress, start one
        console.log(`[sync-lite] Scraping auction data for room ${roomId}...`);
        const startTime = Date.now();

        scrapePromise = scrapeAuction(roomId).then(data => {
          console.log(`[sync-lite] Scrape completed in ${Date.now() - startTime}ms`);
          if (data.status !== 'not_found') {
            setCache(scrapeCacheKey, data);
          }
          return data;
        }).finally(() => {
          scrapingLocks.delete(lockKey);
        });

        scrapingLocks.set(lockKey, scrapePromise);
      } else {
        console.log(`[sync-lite] Waiting for existing scrape for room ${roomId}...`);
      }

      auctionData = await scrapePromise;
    } else {
      console.log(`[sync-lite] Using cached scrape data for room ${roomId} (age: ${Math.round(getCacheAge(scrapeCacheKey) / 1000)}s)`);
    }

    if (auctionData.status === 'not_found') {
      return res.status(404).json({
        error: `Auction room ${roomId} not found`,
      });
    }

    // Match scraped players to projections
    const { matched, unmatched } = matchAllPlayers(auctionData.players, projections);

    // Calculate inflation stats with team data for effective budget and positional scarcity
    const inflationStats = calculateInflationStats(matched, leagueConfig, auctionData.teams);

    const result: AuctionSyncResult = {
      auctionData,
      matchedPlayers: matched,
      inflationStats,
      unmatchedPlayers: unmatched,
    };

    // Cache the full sync result for faster subsequent requests
    setCache(syncCacheKey, result);

    res.json(result);
  } catch (error) {
    console.error(`Error syncing auction ${roomId}:`, error);
    res.status(503).json({
      error: 'Failed to sync auction data.',
    });
  }
});

/**
 * GET /api/auction/:roomId/current
 * Gets only the current auction (player on block) - lightweight endpoint for frequent polling
 */
router.get('/:roomId/current', async (req: Request, res: Response) => {
  const { roomId } = req.params;

  if (!roomId || !/^\d+$/.test(roomId)) {
    return res.status(400).json({
      error: 'Invalid room ID. Must be a numeric value.',
    });
  }

  try {
    const cacheKey = `current-${roomId}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const data = await scrapeDraftedPlayers(roomId);
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error(`Error fetching current auction ${roomId}:`, error);
    res.status(503).json({
      error: 'Failed to fetch current auction.',
    });
  }
});

export default router;

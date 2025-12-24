import { Router, Request, Response } from 'express';
import { scrapeAuction, scrapeDraftedPlayers } from '../services/couchManagersScraper';
import { matchAllPlayers } from '../services/playerMatcher';
import { calculateInflationStats } from '../services/inflationCalculator';
import { getCachedProjections } from '../services/projectionsCacheService';
import type { AuctionSyncResult } from '../types/auction';

const router = Router();

// In-memory cache to avoid hammering the website
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
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

    // Calculate inflation stats
    const inflationStats = calculateInflationStats(matched, leagueConfig);

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
    // Get projections from server cache
    const cachedProjections = await getCachedProjections(projectionSystem);
    if (!cachedProjections) {
      return res.status(503).json({
        error: `No cached projections available for ${projectionSystem}. Please load projections first.`,
      });
    }

    // Transform cached projections to the format expected by playerMatcher
    const projections = cachedProjections.projections.map(p => ({
      id: p.externalId,
      name: p.name,
      team: p.team,
      positions: p.positions,
      projectedValue: 0, // Will be calculated by matcher if needed
    }));

    // Scrape current auction state
    const auctionData = await scrapeAuction(roomId);

    if (auctionData.status === 'not_found') {
      return res.status(404).json({
        error: `Auction room ${roomId} not found`,
      });
    }

    // Match scraped players to projections
    const { matched, unmatched } = matchAllPlayers(auctionData.players, projections);

    // Calculate inflation stats
    const inflationStats = calculateInflationStats(matched, leagueConfig);

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

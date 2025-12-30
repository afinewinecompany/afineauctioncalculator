/**
 * Projections API Routes
 * Endpoints for fetching projections and calculating auction values
 */

import { Router, Request, Response } from 'express';
import { fetchSteamerProjections } from '../services/projectionsService.js';
import { fetchJAProjections } from '../services/jaProjectionsService.js';
import {
  getCachedProjections,
  setCachedProjections,
  invalidateCache,
  getCacheStatus,
} from '../services/projectionsCacheService.js';
import {
  getDynastyRankings,
  refreshDynastyRankings,
  getDynastyRankingsCacheStatus,
} from '../services/dynastyRankingsScraper.js';
import { calculateAuctionValues } from '../services/valueCalculator.js';
import { refreshLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../services/logger.js';
import type { LeagueSettings } from '../../src/lib/types.js';

const router = Router();

const VALID_SYSTEMS = ['steamer', 'batx', 'ja'] as const;
type ProjectionSystem = typeof VALID_SYSTEMS[number];

function isValidSystem(system: string): system is ProjectionSystem {
  return VALID_SYSTEMS.includes(system as ProjectionSystem);
}

/**
 * GET /api/projections/:system
 * Returns projections for the specified system (steamer, batx, ja)
 * Uses cache with 24-hour TTL
 */
router.get('/:system', async (req: Request, res: Response) => {
  const { system } = req.params;

  if (!isValidSystem(system)) {
    return res.status(400).json({
      error: `Invalid projection system. Must be one of: ${VALID_SYSTEMS.join(', ')}`,
    });
  }

  try {
    // Check cache first
    const cached = await getCachedProjections(system);
    if (cached) {
      return res.json({
        ...cached,
        fromCache: true,
      });
    }

    // Fetch fresh projections
    let projections;
    switch (system) {
      case 'steamer':
        projections = await fetchSteamerProjections();
        break;
      case 'ja':
        projections = await fetchJAProjections();
        break;
      case 'batx':
        // BatX is currently unavailable
        return res.status(503).json({
          error: 'BatX projections are currently unavailable. Please use Steamer or JA Projections.',
        });
      default:
        return res.status(400).json({ error: 'Invalid projection system' });
    }

    // Cache the results
    await setCachedProjections(system, projections);

    // Return with metadata
    const hitterCount = projections.filter(p => p.playerType === 'hitter').length;
    const pitcherCount = projections.filter(p => p.playerType === 'pitcher').length;

    res.json({
      metadata: {
        system,
        fetchedAt: new Date().toISOString(),
        playerCount: projections.length,
        hitterCount,
        pitcherCount,
      },
      projections,
      fromCache: false,
    });
  } catch (error) {
    logger.error({ error, system }, 'Error fetching projections');
    res.status(503).json({
      error: 'Failed to fetch projections. FanGraphs API may be unavailable.',
      message: error instanceof Error ? error.message : undefined,
    });
  }
});

/**
 * GET /api/projections/:system/status
 * Returns cache status for a projection system
 */
router.get('/:system/status', async (req: Request, res: Response) => {
  const { system } = req.params;

  if (!isValidSystem(system)) {
    return res.status(400).json({
      error: `Invalid projection system. Must be one of: ${VALID_SYSTEMS.join(', ')}`,
    });
  }

  try {
    const status = await getCacheStatus(system);
    res.json({
      system,
      ...status,
    });
  } catch (error) {
    logger.error({ error, system }, 'Error getting cache status');
    res.status(500).json({
      error: 'Failed to get cache status',
    });
  }
});

/**
 * POST /api/projections/:system/refresh
 * Forces a cache refresh for a projection system
 * Rate limited to 5 requests per minute (hits external APIs)
 */
router.post('/:system/refresh', refreshLimiter, async (req: Request, res: Response) => {
  const { system } = req.params;

  if (!isValidSystem(system)) {
    return res.status(400).json({
      error: `Invalid projection system. Must be one of: ${VALID_SYSTEMS.join(', ')}`,
    });
  }

  try {
    // Invalidate existing cache
    await invalidateCache(system);

    // Fetch fresh projections
    let projections;
    switch (system) {
      case 'steamer':
        projections = await fetchSteamerProjections();
        break;
      case 'ja':
        projections = await fetchJAProjections();
        break;
      case 'batx':
        return res.status(503).json({
          error: 'BatX projections are currently unavailable. Please use Steamer or JA Projections.',
        });
      default:
        return res.status(400).json({ error: 'Invalid projection system' });
    }

    // Cache the results
    await setCachedProjections(system, projections);

    const hitterCount = projections.filter(p => p.playerType === 'hitter').length;
    const pitcherCount = projections.filter(p => p.playerType === 'pitcher').length;

    res.json({
      success: true,
      message: `${system} projections refreshed`,
      playerCount: projections.length,
      hitterCount,
      pitcherCount,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, system }, 'Error refreshing projections');
    res.status(503).json({
      error: 'Failed to refresh projections',
      message: error instanceof Error ? error.message : undefined,
    });
  }
});

/**
 * POST /api/projections/calculate-values
 * Calculates auction values for a league configuration
 * Supports both redraft (steamer-only) and dynasty (blended) modes
 *
 * Body: {
 *   projectionSystem: 'steamer' | 'batx' | 'ja',
 *   leagueSettings: LeagueSettings
 * }
 */
router.post('/calculate-values', async (req: Request, res: Response) => {
  const { projectionSystem, leagueSettings } = req.body as {
    projectionSystem: string;
    leagueSettings: LeagueSettings;
  };

  // Validate required fields
  if (!projectionSystem) {
    return res.status(400).json({
      error: 'projectionSystem is required',
    });
  }

  if (!isValidSystem(projectionSystem)) {
    return res.status(400).json({
      error: `Invalid projection system. Must be one of: ${VALID_SYSTEMS.join(', ')}`,
    });
  }

  if (!leagueSettings) {
    return res.status(400).json({
      error: 'leagueSettings is required',
    });
  }

  if (!leagueSettings.numTeams || !leagueSettings.budgetPerTeam) {
    return res.status(400).json({
      error: 'leagueSettings must include numTeams and budgetPerTeam',
    });
  }

  if (!leagueSettings.rosterSpots) {
    return res.status(400).json({
      error: 'leagueSettings must include rosterSpots configuration',
    });
  }

  try {
    // Get projections (from cache or fresh)
    let cached = await getCachedProjections(projectionSystem);

    if (!cached) {
      logger.info({ projectionSystem }, 'No cached projections, fetching fresh');

      let projections;
      switch (projectionSystem) {
        case 'steamer':
          projections = await fetchSteamerProjections();
          break;
        case 'ja':
          projections = await fetchJAProjections();
          break;
        case 'batx':
          return res.status(503).json({
            error: 'BatX projections are currently unavailable. Please use Steamer or JA Projections.',
          });
        default:
          return res.status(400).json({ error: 'Invalid projection system' });
      }

      await setCachedProjections(projectionSystem, projections);
      cached = await getCachedProjections(projectionSystem);
    }

    if (!cached) {
      return res.status(503).json({
        error: 'Failed to load projections',
      });
    }

    // For dynasty leagues, also fetch dynasty rankings
    logger.debug({ leagueType: leagueSettings.leagueType, dynastyWeight: leagueSettings.dynastySettings?.dynastyWeight }, 'calculate-values called');
    let dynastyRankings;
    if (leagueSettings.leagueType === 'dynasty') {
      logger.info('Dynasty mode - fetching dynasty rankings');
      try {
        dynastyRankings = await getDynastyRankings();
        logger.info({ count: dynastyRankings.length }, 'Loaded dynasty rankings');
      } catch (dynastyError) {
        logger.warn({ error: dynastyError }, 'Failed to load dynasty rankings, falling back to steamer-only');
        // Continue without dynasty rankings - will use steamer-only values
      }
    }

    // Calculate auction values (with optional dynasty rankings)
    const result = calculateAuctionValues(
      cached.projections,
      {
        ...leagueSettings,
        projectionSystem: projectionSystem as LeagueSettings['projectionSystem'],
      },
      dynastyRankings
    );

    res.json(result);
  } catch (error) {
    logger.error({ error }, 'Error calculating auction values');

    // Only include stack trace in development mode to avoid leaking implementation details
    const isDevelopment = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: 'Failed to calculate auction values',
      message: error instanceof Error ? error.message : undefined,
      ...(isDevelopment && error instanceof Error ? { stack: error.stack } : {}),
    });
  }
});

// ============================================================================
// DYNASTY RANKINGS ENDPOINTS
// ============================================================================

/**
 * GET /api/projections/dynasty-rankings
 * Returns crowd-sourced dynasty rankings from Harry Knows Ball
 * Uses cache with 12-hour TTL
 */
router.get('/dynasty-rankings', async (req: Request, res: Response) => {
  try {
    const rankings = await getDynastyRankings();

    res.json({
      metadata: {
        source: 'harryknowsball',
        fetchedAt: new Date().toISOString(),
        playerCount: rankings.length,
      },
      rankings,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching dynasty rankings');
    res.status(503).json({
      error: 'Failed to fetch dynasty rankings',
      message: error instanceof Error ? error.message : undefined,
    });
  }
});

/**
 * GET /api/projections/dynasty-rankings/status
 * Returns cache status for dynasty rankings
 */
router.get('/dynasty-rankings/status', async (req: Request, res: Response) => {
  try {
    const status = await getDynastyRankingsCacheStatus();
    res.json(status);
  } catch (error) {
    logger.error({ error }, 'Error getting dynasty rankings cache status');
    res.status(500).json({
      error: 'Failed to get cache status',
    });
  }
});

/**
 * POST /api/projections/dynasty-rankings/refresh
 * Forces a cache refresh for dynasty rankings
 * Rate limited to 5 requests per minute (hits external APIs)
 */
router.post('/dynasty-rankings/refresh', refreshLimiter, async (req: Request, res: Response) => {
  try {
    const rankings = await refreshDynastyRankings();

    res.json({
      success: true,
      message: 'Dynasty rankings refreshed',
      playerCount: rankings.length,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Error refreshing dynasty rankings');
    res.status(503).json({
      error: 'Failed to refresh dynasty rankings',
      message: error instanceof Error ? error.message : undefined,
    });
  }
});

export default router;

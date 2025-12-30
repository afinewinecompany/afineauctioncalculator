/**
 * Projections API Routes
 * Endpoints for fetching projections and calculating auction values
 */

import { Router, Request, Response } from 'express';
import { fetchSteamerProjections } from '../services/projectionsService';
import { fetchJAProjections } from '../services/jaProjectionsService';
import {
  getCachedProjections,
  setCachedProjections,
  invalidateCache,
  getCacheStatus,
} from '../services/projectionsCacheService';
import {
  getDynastyRankings,
  refreshDynastyRankings,
  getDynastyRankingsCacheStatus,
} from '../services/dynastyRankingsScraper';
import { calculateAuctionValues } from '../services/valueCalculator';
import type { LeagueSettings } from '../../src/lib/types';

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
    console.error(`Error fetching ${system} projections:`, error);
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
    console.error(`Error getting cache status for ${system}:`, error);
    res.status(500).json({
      error: 'Failed to get cache status',
    });
  }
});

/**
 * POST /api/projections/:system/refresh
 * Forces a cache refresh for a projection system
 */
router.post('/:system/refresh', async (req: Request, res: Response) => {
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
    console.error(`Error refreshing ${system} projections:`, error);
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
      console.log(`No cached projections for ${projectionSystem}, fetching fresh...`);

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
    console.log(`[API] calculate-values called with leagueType: ${leagueSettings.leagueType}, dynastyWeight: ${leagueSettings.dynastySettings?.dynastyWeight}`);
    let dynastyRankings;
    if (leagueSettings.leagueType === 'dynasty') {
      console.log('[API] Dynasty mode - fetching dynasty rankings');
      try {
        dynastyRankings = await getDynastyRankings();
        console.log(`[API] Loaded ${dynastyRankings.length} dynasty rankings`);
      } catch (dynastyError) {
        console.warn('[API] Failed to load dynasty rankings, falling back to steamer-only:', dynastyError);
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
    console.error('Error calculating auction values:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    res.status(500).json({
      error: 'Failed to calculate auction values',
      message: error instanceof Error ? error.message : undefined,
      stack: error instanceof Error ? error.stack : undefined,
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
    console.error('Error fetching dynasty rankings:', error);
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
    const status = getDynastyRankingsCacheStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting dynasty rankings cache status:', error);
    res.status(500).json({
      error: 'Failed to get cache status',
    });
  }
});

/**
 * POST /api/projections/dynasty-rankings/refresh
 * Forces a cache refresh for dynasty rankings
 */
router.post('/dynasty-rankings/refresh', async (req: Request, res: Response) => {
  try {
    const rankings = await refreshDynastyRankings();

    res.json({
      success: true,
      message: 'Dynasty rankings refreshed',
      playerCount: rankings.length,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error refreshing dynasty rankings:', error);
    res.status(503).json({
      error: 'Failed to refresh dynasty rankings',
      message: error instanceof Error ? error.message : undefined,
    });
  }
});

export default router;

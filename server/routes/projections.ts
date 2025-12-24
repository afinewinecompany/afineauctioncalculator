/**
 * Projections API Routes
 * Endpoints for fetching projections and calculating auction values
 */

import { Router, Request, Response } from 'express';
import { fetchSteamerProjections } from '../services/projectionsService';
import {
  getCachedProjections,
  setCachedProjections,
  invalidateCache,
  getCacheStatus,
} from '../services/projectionsCacheService';
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
      case 'batx':
      case 'ja':
        // Not yet implemented
        return res.status(501).json({
          error: `${system} projections not yet implemented. Use 'steamer' for now.`,
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
      case 'batx':
      case 'ja':
        return res.status(501).json({
          error: `${system} projections not yet implemented`,
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
        case 'batx':
        case 'ja':
          return res.status(501).json({
            error: `${projectionSystem} projections not yet implemented`,
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

    // Calculate auction values
    const result = calculateAuctionValues(cached.projections, {
      ...leagueSettings,
      projectionSystem: projectionSystem as LeagueSettings['projectionSystem'],
    });

    res.json(result);
  } catch (error) {
    console.error('Error calculating auction values:', error);
    res.status(500).json({
      error: 'Failed to calculate auction values',
      message: error instanceof Error ? error.message : undefined,
    });
  }
});

export default router;

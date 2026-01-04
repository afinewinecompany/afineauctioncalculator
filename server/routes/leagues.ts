/**
 * League Routes
 *
 * CRUD operations for user leagues. Leagues are stored in the database
 * and persist across login/logout sessions.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, getAuthUser } from '../middleware/auth.js';
import { logger } from '../services/logger.js';
import { fetchSteamerProjections, fetchBatXProjections } from '../services/projectionsService.js';
import { fetchJAProjections } from '../services/jaProjectionsService.js';
import { getCachedProjections, setCachedProjections } from '../services/projectionsCacheService.js';
import { getDynastyRankings } from '../services/dynastyRankingsScraper.js';
import { calculateAuctionValues } from '../services/valueCalculator.js';
import type { LeagueSettings } from '../../src/lib/types.js';
import type { PlayerWithValue, PlayerWithDynastyValue } from '../types/projections.js';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/**
 * Roster spots schema - matches frontend LeagueSettings.rosterSpots
 */
const rosterSpotsSchema = z.object({
  C: z.number().int().min(0).max(10),
  '1B': z.number().int().min(0).max(10),
  '2B': z.number().int().min(0).max(10),
  '3B': z.number().int().min(0).max(10),
  SS: z.number().int().min(0).max(10),
  OF: z.number().int().min(0).max(10),
  CI: z.number().int().min(0).max(10),
  MI: z.number().int().min(0).max(10),
  UTIL: z.number().int().min(0).max(10),
  SP: z.number().int().min(0).max(10),
  RP: z.number().int().min(0).max(10),
  P: z.number().int().min(0).max(10),
  Bench: z.number().int().min(0).max(20),
});

/**
 * League creation/update schema
 */
const leagueSettingsSchema = z.object({
  leagueName: z.string().min(1).max(100),
  couchManagerRoomId: z.string().optional().default(''),
  numTeams: z.number().int().min(2).max(30),
  budgetPerTeam: z.number().int().min(100).max(1000),
  rosterSpots: rosterSpotsSchema,
  leagueType: z.enum(['redraft', 'dynasty']),
  scoringType: z.enum(['rotisserie', 'h2h-categories', 'h2h-points']),
  projectionSystem: z.enum(['steamer', 'batx', 'ja']),
  dynastySettings: z.object({
    dynastyWeight: z.number().min(0).max(1),
    includeMinors: z.boolean(),
    rankingsSource: z.enum(['harryknowsball', 'custom']).optional(),
    customRankings: z.array(z.object({
      name: z.string(),
      rank: z.number(),
      playerId: z.string().optional(),
    })).optional(),
  }).optional(),
  hittingCategories: z.record(z.boolean()).optional(),
  pitchingCategories: z.record(z.boolean()).optional(),
  pointsSettings: z.record(z.number()).optional(),
  hitterPitcherSplit: z.object({
    hitter: z.number(),
    pitcher: z.number(),
  }).optional(),
  inflationSettings: z.object({
    enableMarketCorrection: z.boolean(),
    enablePositionScarcity: z.boolean(),
    tierFactors: z.record(z.number()).optional(),
    positionFactors: z.record(z.number()).optional(),
  }).optional(),
});

/**
 * Full league data schema (for create/update with player data)
 */
const createLeagueSchema = z.object({
  id: z.string().optional(), // Client may provide ID
  leagueName: z.string().min(1).max(100),
  settings: leagueSettingsSchema,
  players: z.array(z.any()).optional(), // Player data is complex, store as JSON
  status: z.enum(['setup', 'drafting', 'complete']).default('setup'),
  setupStep: z.number().int().min(1).max(5).nullish(), // Current step in setup wizard (null when not in setup)
  createdAt: z.string().optional(),
  lastModified: z.string().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/leagues
 * List all leagues for the authenticated user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);

    logger.info({ userId: user.id }, 'Fetching user leagues');

    // Get all leagues owned by this user
    const leagues = await prisma.league.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to frontend format
    const formattedLeagues = leagues.map(league => ({
      id: league.id,
      leagueName: league.name,
      settings: {
        leagueName: league.name,
        couchManagerRoomId: league.couchManagerRoomId || '',
        numTeams: league.numTeams,
        budgetPerTeam: league.budgetPerTeam,
        rosterSpots: league.rosterSpots,
        leagueType: league.leagueType,
        scoringType: league.scoringType,
        projectionSystem: league.projectionSystem,
        dynastySettings: league.dynastySettings,
        hittingCategories: league.hittingCategories,
        pitchingCategories: league.pitchingCategories,
      },
      players: [], // Players are fetched separately when needed
      createdAt: league.createdAt.toISOString(),
      lastModified: league.updatedAt.toISOString(),
      status: league.status,
      setupStep: league.setupStep,
    }));

    logger.info({ userId: user.id, count: leagues.length }, 'Leagues fetched successfully');

    res.json({ leagues: formattedLeagues });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch leagues');
    res.status(500).json({
      error: 'Failed to fetch leagues',
      code: 'LEAGUE_FETCH_ERROR',
      message: 'An error occurred while fetching your leagues',
    });
  }
});

/**
 * GET /api/leagues/:id
 * Get a specific league with full details
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;

    const league = await prisma.league.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!league) {
      res.status(404).json({
        error: 'League not found',
        code: 'LEAGUE_NOT_FOUND',
        message: 'The requested league does not exist or you do not have access to it',
      });
      return;
    }

    const formattedLeague = {
      id: league.id,
      leagueName: league.name,
      settings: {
        leagueName: league.name,
        couchManagerRoomId: league.couchManagerRoomId || '',
        numTeams: league.numTeams,
        budgetPerTeam: league.budgetPerTeam,
        rosterSpots: league.rosterSpots,
        leagueType: league.leagueType,
        scoringType: league.scoringType,
        projectionSystem: league.projectionSystem,
        dynastySettings: league.dynastySettings,
        hittingCategories: league.hittingCategories,
        pitchingCategories: league.pitchingCategories,
      },
      players: [],
      createdAt: league.createdAt.toISOString(),
      lastModified: league.updatedAt.toISOString(),
      status: league.status,
      setupStep: league.setupStep,
    };

    res.json({ league: formattedLeague });
  } catch (error) {
    logger.error({ error, leagueId: req.params.id }, 'Failed to fetch league');
    res.status(500).json({
      error: 'Failed to fetch league',
      code: 'LEAGUE_FETCH_ERROR',
      message: 'An error occurred while fetching the league',
    });
  }
});

/**
 * POST /api/leagues
 * Create a new league
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);

    // Validate request body
    const validationResult = createLeagueSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.warn({ errors: validationResult.error.errors }, 'Invalid league data');
      res.status(400).json({
        error: 'Invalid league data',
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors,
      });
      return;
    }

    const data = validationResult.data;

    logger.info({ userId: user.id, leagueName: data.leagueName }, 'Creating new league');

    // Create the league
    const league = await prisma.league.create({
      data: {
        name: data.leagueName,
        ownerId: user.id,
        couchManagerRoomId: data.settings.couchManagerRoomId || null,
        numTeams: data.settings.numTeams,
        budgetPerTeam: data.settings.budgetPerTeam,
        scoringType: data.settings.scoringType,
        projectionSystem: data.settings.projectionSystem,
        leagueType: data.settings.leagueType,
        rosterSpots: data.settings.rosterSpots,
        hittingCategories: data.settings.hittingCategories ?? undefined,
        pitchingCategories: data.settings.pitchingCategories ?? undefined,
        dynastySettings: data.settings.dynastySettings ?? undefined,
        status: data.status,
        setupStep: data.setupStep ?? null,
      },
    });

    // Also create the UserLeague relationship
    await prisma.userLeague.create({
      data: {
        userId: user.id,
        leagueId: league.id,
        role: 'owner',
      },
    });

    logger.info({ userId: user.id, leagueId: league.id }, 'League created successfully');

    const formattedLeague = {
      id: league.id,
      leagueName: league.name,
      settings: {
        leagueName: league.name,
        couchManagerRoomId: league.couchManagerRoomId || '',
        numTeams: league.numTeams,
        budgetPerTeam: league.budgetPerTeam,
        rosterSpots: league.rosterSpots,
        leagueType: league.leagueType,
        scoringType: league.scoringType,
        projectionSystem: league.projectionSystem,
        dynastySettings: league.dynastySettings,
        hittingCategories: league.hittingCategories,
        pitchingCategories: league.pitchingCategories,
      },
      players: [],
      createdAt: league.createdAt.toISOString(),
      lastModified: league.updatedAt.toISOString(),
      status: league.status,
      setupStep: league.setupStep,
    };

    res.status(201).json({ league: formattedLeague });
  } catch (error) {
    logger.error({ error }, 'Failed to create league');
    res.status(500).json({
      error: 'Failed to create league',
      code: 'LEAGUE_CREATE_ERROR',
      message: 'An error occurred while creating the league',
    });
  }
});

/**
 * PUT /api/leagues/:id
 * Update an existing league
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;

    // Check if league exists and belongs to user
    const existingLeague = await prisma.league.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!existingLeague) {
      res.status(404).json({
        error: 'League not found',
        code: 'LEAGUE_NOT_FOUND',
        message: 'The requested league does not exist or you do not have access to it',
      });
      return;
    }

    // Validate request body
    const validationResult = createLeagueSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.warn({ errors: validationResult.error.errors }, `League validation failed for ${id}`);

      res.status(400).json({
        error: 'Invalid league data',
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors,
      });
      return;
    }

    const data = validationResult.data;

    logger.info({ userId: user.id, leagueId: id }, 'Updating league');

    // Update the league
    // Clear setupStep when status changes from 'setup' to 'drafting' or 'complete'
    const setupStepValue = data.status === 'setup' ? (data.setupStep ?? existingLeague.setupStep) : null;

    const league = await prisma.league.update({
      where: { id },
      data: {
        name: data.leagueName,
        couchManagerRoomId: data.settings.couchManagerRoomId || null,
        numTeams: data.settings.numTeams,
        budgetPerTeam: data.settings.budgetPerTeam,
        scoringType: data.settings.scoringType,
        projectionSystem: data.settings.projectionSystem,
        leagueType: data.settings.leagueType,
        rosterSpots: data.settings.rosterSpots,
        hittingCategories: data.settings.hittingCategories ?? undefined,
        pitchingCategories: data.settings.pitchingCategories ?? undefined,
        dynastySettings: data.settings.dynastySettings ?? undefined,
        status: data.status,
        setupStep: setupStepValue,
        updatedAt: new Date(),
      },
    });

    logger.info({ userId: user.id, leagueId: id }, 'League updated successfully');

    const formattedLeague = {
      id: league.id,
      leagueName: league.name,
      settings: {
        leagueName: league.name,
        couchManagerRoomId: league.couchManagerRoomId || '',
        numTeams: league.numTeams,
        budgetPerTeam: league.budgetPerTeam,
        rosterSpots: league.rosterSpots,
        leagueType: league.leagueType,
        scoringType: league.scoringType,
        projectionSystem: league.projectionSystem,
        dynastySettings: league.dynastySettings,
        hittingCategories: league.hittingCategories,
        pitchingCategories: league.pitchingCategories,
      },
      players: [],
      createdAt: league.createdAt.toISOString(),
      lastModified: league.updatedAt.toISOString(),
      status: league.status,
      setupStep: league.setupStep,
    };

    res.json({ league: formattedLeague });
  } catch (error) {
    logger.error({ error, leagueId: req.params.id }, 'Failed to update league');
    res.status(500).json({
      error: 'Failed to update league',
      code: 'LEAGUE_UPDATE_ERROR',
      message: 'An error occurred while updating the league',
    });
  }
});

// =============================================================================
// DRAFT STATE PERSISTENCE
// =============================================================================

/**
 * Schema for draft player state - lightweight structure for persistence
 */
const draftPlayerSchema = z.object({
  id: z.string(),                    // Player ID (external ID from projections)
  name: z.string(),
  status: z.enum(['available', 'drafted', 'onMyTeam', 'on_block']),
  draftedPrice: z.number().optional(),
  draftedBy: z.string().optional(),  // Team name that drafted this player
  isTargeted: z.boolean().optional(), // Whether player is marked as a target/watchlist
});

const saveDraftStateSchema = z.object({
  players: z.array(draftPlayerSchema),
  // Optional: for optimistic locking - if provided, save will fail if data has been modified
  expectedLastModified: z.string().datetime().optional(),
});

/**
 * GET /api/leagues/:id/draft-state
 * Get the saved draft state (drafted players) for a league
 */
router.get('/:id/draft-state', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;

    // Verify league exists and belongs to user
    const league = await prisma.league.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!league) {
      res.status(404).json({
        error: 'League not found',
        code: 'LEAGUE_NOT_FOUND',
        message: 'The requested league does not exist or you do not have access to it',
      });
      return;
    }

    // Fetch draft state from draftState JSON column
    const draftState = league.draftState as { players: Array<{
      id: string;
      name: string;
      status: string;
      draftedPrice?: number;
      draftedBy?: string;
      isTargeted?: boolean;
    }> } | null;

    logger.info(
      { userId: user.id, leagueId: id, playerCount: draftState?.players?.length ?? 0 },
      'Draft state fetched'
    );

    res.json({
      leagueId: id,
      players: draftState?.players ?? [],
      lastModified: league.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error({ error, leagueId: req.params.id }, 'Failed to fetch draft state');
    res.status(500).json({
      error: 'Failed to fetch draft state',
      code: 'DRAFT_STATE_FETCH_ERROR',
      message: 'An error occurred while fetching draft state',
    });
  }
});

/**
 * PUT /api/leagues/:id/draft-state
 * Save the draft state (drafted players) for a league
 * Only saves players that have been drafted (status !== 'available')
 */
router.put('/:id/draft-state', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;

    // Verify league exists and belongs to user
    const existingLeague = await prisma.league.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!existingLeague) {
      res.status(404).json({
        error: 'League not found',
        code: 'LEAGUE_NOT_FOUND',
        message: 'The requested league does not exist or you do not have access to it',
      });
      return;
    }

    // Validate request body
    const validationResult = saveDraftStateSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.warn({ errors: validationResult.error.errors }, 'Invalid draft state data');
      res.status(400).json({
        error: 'Invalid draft state data',
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors,
      });
      return;
    }

    const { players, expectedLastModified } = validationResult.data;

    // Optimistic locking: check if data has been modified since client last read it
    if (expectedLastModified) {
      const expectedDate = new Date(expectedLastModified);
      const actualDate = existingLeague.updatedAt;

      // Allow 1 second tolerance for timing differences
      if (Math.abs(actualDate.getTime() - expectedDate.getTime()) > 1000) {
        logger.warn(
          { userId: user.id, leagueId: id, expected: expectedLastModified, actual: actualDate.toISOString() },
          'Draft state conflict detected'
        );
        res.status(409).json({
          error: 'Draft state conflict',
          code: 'CONFLICT',
          message: 'The draft state has been modified by another device. Please refresh and try again.',
          serverLastModified: actualDate.toISOString(),
        });
        return;
      }
    }

    // Store players that are either drafted/on_block OR targeted (even if available)
    // This allows us to persist watchlist/target selections across sessions
    const playersToSave = players.filter(p => p.status !== 'available' || p.isTargeted === true);

    logger.info(
      { userId: user.id, leagueId: id, savedCount: playersToSave.length },
      'Saving draft state'
    );

    // Store draft state as JSON in the league record
    const newUpdatedAt = new Date();
    await prisma.league.update({
      where: { id },
      data: {
        draftState: { players: playersToSave },
        updatedAt: newUpdatedAt,
      },
    });

    logger.info({ userId: user.id, leagueId: id }, 'Draft state saved successfully');

    res.json({
      success: true,
      leagueId: id,
      savedCount: playersToSave.length,
      lastModified: newUpdatedAt.toISOString(),
      message: 'Draft state saved successfully',
    });
  } catch (error) {
    logger.error({ error, leagueId: req.params.id }, 'Failed to save draft state');
    res.status(500).json({
      error: 'Failed to save draft state',
      code: 'DRAFT_STATE_SAVE_ERROR',
      message: 'An error occurred while saving draft state',
    });
  }
});

// =============================================================================
// LEAGUE PROJECTIONS EXPORT
// =============================================================================

const VALID_PROJECTION_SYSTEMS = ['steamer', 'batx', 'ja'] as const;
type ProjectionSystem = typeof VALID_PROJECTION_SYSTEMS[number];

function isValidProjectionSystem(system: string): system is ProjectionSystem {
  return VALID_PROJECTION_SYSTEMS.includes(system as ProjectionSystem);
}

/**
 * Export player projection format for the projections endpoint
 */
interface ExportPlayer {
  id: string;
  name: string;
  team: string;
  positions: string[];
  projectedValue: number;
  tier: number;
  stats: Record<string, number>;
}

/**
 * GET /api/leagues/:id/projections
 * Get league projections data for export
 *
 * Returns player projections calculated using the league's settings,
 * including auction values, tiers, and projected stats.
 */
router.get('/:id/projections', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;

    // Verify league exists and belongs to user
    const league = await prisma.league.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!league) {
      res.status(404).json({
        error: 'League not found',
        code: 'LEAGUE_NOT_FOUND',
        message: 'The requested league does not exist or you do not have access to it',
      });
      return;
    }

    // Validate projection system
    const projectionSystem = league.projectionSystem;
    if (!isValidProjectionSystem(projectionSystem)) {
      res.status(400).json({
        error: 'Invalid projection system',
        code: 'INVALID_PROJECTION_SYSTEM',
        message: `League has invalid projection system: ${projectionSystem}`,
      });
      return;
    }

    logger.info(
      { userId: user.id, leagueId: id, projectionSystem },
      'Fetching league projections for export'
    );

    // Get projections (from cache or fetch fresh)
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
          projections = await fetchBatXProjections();
          break;
        default:
          res.status(400).json({
            error: 'Invalid projection system',
            code: 'INVALID_PROJECTION_SYSTEM',
            message: `Unsupported projection system: ${projectionSystem}`,
          });
          return;
      }

      await setCachedProjections(projectionSystem, projections);
      cached = await getCachedProjections(projectionSystem);
    }

    if (!cached) {
      res.status(503).json({
        error: 'Failed to load projections',
        code: 'PROJECTIONS_UNAVAILABLE',
        message: 'Unable to fetch or load projection data',
      });
      return;
    }

    // Build league settings from stored league data
    const leagueSettings: LeagueSettings = {
      leagueName: league.name,
      couchManagerRoomId: league.couchManagerRoomId || '',
      numTeams: league.numTeams,
      budgetPerTeam: league.budgetPerTeam,
      rosterSpots: league.rosterSpots as LeagueSettings['rosterSpots'],
      leagueType: league.leagueType as LeagueSettings['leagueType'],
      scoringType: league.scoringType as LeagueSettings['scoringType'],
      projectionSystem: projectionSystem,
      dynastySettings: league.dynastySettings as unknown as LeagueSettings['dynastySettings'],
      hittingCategories: league.hittingCategories as LeagueSettings['hittingCategories'],
      pitchingCategories: league.pitchingCategories as LeagueSettings['pitchingCategories'],
    };

    // For dynasty leagues, also fetch dynasty rankings
    let dynastyRankings;
    if (leagueSettings.leagueType === 'dynasty') {
      logger.info('Dynasty mode - fetching dynasty rankings for export');
      try {
        dynastyRankings = await getDynastyRankings();
        logger.info({ count: dynastyRankings.length }, 'Loaded dynasty rankings');
      } catch (dynastyError) {
        logger.warn({ error: dynastyError }, 'Failed to load dynasty rankings, using projections only');
      }
    }

    // Calculate auction values
    const result = calculateAuctionValues(
      cached.projections,
      leagueSettings,
      dynastyRankings
    );

    // Transform players to export format
    const exportPlayers: ExportPlayer[] = result.players.map((player: PlayerWithValue | PlayerWithDynastyValue) => {
      // Build stats object from hitting or pitching stats
      const stats: Record<string, number> = {};

      if (player.hitting) {
        stats.G = player.hitting.games;
        stats.AB = player.hitting.atBats;
        stats.PA = player.hitting.plateAppearances;
        stats.R = player.hitting.runs;
        stats.H = player.hitting.hits;
        stats['1B'] = player.hitting.singles;
        stats['2B'] = player.hitting.doubles;
        stats['3B'] = player.hitting.triples;
        stats.HR = player.hitting.homeRuns;
        stats.RBI = player.hitting.rbi;
        stats.SB = player.hitting.stolenBases;
        stats.CS = player.hitting.caughtStealing;
        stats.BB = player.hitting.walks;
        stats.SO = player.hitting.strikeouts;
        stats.AVG = player.hitting.battingAvg;
        stats.OBP = player.hitting.onBasePct;
        stats.SLG = player.hitting.sluggingPct;
        stats.OPS = player.hitting.ops;
        stats.wOBA = player.hitting.wOBA;
        stats['wRC+'] = player.hitting.wrcPlus;
        stats.WAR = player.hitting.war;
      }

      if (player.pitching) {
        stats.G = player.pitching.games;
        stats.GS = player.pitching.gamesStarted;
        stats.IP = player.pitching.inningsPitched;
        stats.W = player.pitching.wins;
        stats.L = player.pitching.losses;
        stats.SV = player.pitching.saves;
        stats.HLD = player.pitching.holds;
        stats.H = player.pitching.hitsAllowed;
        stats.ER = player.pitching.earnedRuns;
        stats.HR = player.pitching.homeRunsAllowed;
        stats.BB = player.pitching.walks;
        stats.K = player.pitching.strikeouts;
        stats.ERA = player.pitching.era;
        stats.WHIP = player.pitching.whip;
        stats['K/9'] = player.pitching.k9;
        stats['BB/9'] = player.pitching.bb9;
        stats.FIP = player.pitching.fip;
        stats.WAR = player.pitching.war;
      }

      return {
        id: player.externalId,
        name: player.name,
        team: player.team,
        positions: player.positions,
        projectedValue: player.auctionValue,
        tier: player.tier,
        stats,
      };
    });

    logger.info(
      { userId: user.id, leagueId: id, playerCount: exportPlayers.length },
      'League projections fetched successfully'
    );

    res.json({
      leagueId: league.id,
      leagueName: league.name,
      projectionSystem,
      players: exportPlayers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error, leagueId: req.params.id }, 'Failed to fetch league projections');
    res.status(500).json({
      error: 'Failed to fetch projections',
      code: 'PROJECTIONS_FETCH_ERROR',
      message: 'An error occurred while fetching league projections',
    });
  }
});

/**
 * DELETE /api/leagues/:id
 * Delete a league
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;

    // Check if league exists and belongs to user
    const existingLeague = await prisma.league.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!existingLeague) {
      res.status(404).json({
        error: 'League not found',
        code: 'LEAGUE_NOT_FOUND',
        message: 'The requested league does not exist or you do not have access to it',
      });
      return;
    }

    logger.info({ userId: user.id, leagueId: id }, 'Deleting league');

    // Delete the league (cascade will handle related records)
    await prisma.league.delete({
      where: { id },
    });

    logger.info({ userId: user.id, leagueId: id }, 'League deleted successfully');

    res.json({ success: true, message: 'League deleted successfully' });
  } catch (error) {
    logger.error({ error, leagueId: req.params.id }, 'Failed to delete league');
    res.status(500).json({
      error: 'Failed to delete league',
      code: 'LEAGUE_DELETE_ERROR',
      message: 'An error occurred while deleting the league',
    });
  }
});

export default router;

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
  setupStep: z.number().int().min(1).max(5).optional(), // Current step in setup wizard
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
      logger.warn({ errors: validationResult.error.errors }, 'Invalid league data');
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

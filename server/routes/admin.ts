/**
 * Admin Routes
 *
 * Administrative endpoints for platform management.
 * All routes require authentication and admin role.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin, getAuthUser } from '../middleware/auth.js';
import { logger } from '../services/logger.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth, requireAdmin);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

const errorFiltersSchema = z.object({
  source: z.enum(['frontend', 'backend', 'all']).optional().default('all'),
  severity: z.enum(['error', 'warning', 'info', 'all']).optional().default('all'),
  resolved: z.enum(['true', 'false', 'all']).optional().default('all'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// =============================================================================
// STATS ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/stats
 * Get platform statistics for admin dashboard
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Run all queries in parallel for performance
    const [
      totalUsers,
      usersThisMonth,
      usersThisWeek,
      totalLeagues,
      activelyDraftingLeagues,
      completedLeagues,
      totalErrors,
      unresolvedErrors,
      errorsLast24Hours,
    ] = await Promise.all([
      // User stats
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      // League stats
      prisma.league.count(),
      prisma.league.count({
        where: { status: 'drafting' },
      }),
      prisma.league.count({
        where: { status: 'complete' },
      }),
      // Error stats
      prisma.errorLog.count(),
      prisma.errorLog.count({
        where: { resolved: false },
      }),
      prisma.errorLog.count({
        where: { createdAt: { gte: last24Hours } },
      }),
    ]);

    // Calculate currently active draft rooms (leagues currently being drafted)
    const currentlyActiveDraftRooms = activelyDraftingLeagues;

    res.json({
      users: {
        total: totalUsers,
        thisMonth: usersThisMonth,
        thisWeek: usersThisWeek,
      },
      leagues: {
        total: totalLeagues,
        activelyDrafting: activelyDraftingLeagues,
        completed: completedLeagues,
      },
      draftRooms: {
        currentlyActive: currentlyActiveDraftRooms,
      },
      errors: {
        total: totalErrors,
        unresolvedCount: unresolvedErrors,
        last24Hours: errorsLast24Hours,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch admin stats');
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// USER MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/users
 * List all users with pagination and search
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          subscriptionTier: true,
          authProvider: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              ownedLeagues: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        authProvider: user.authProvider,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        leagueCount: user._count.ownedLeagues,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch users');
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/users/:id
 * Get a single user's details
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionTier: true,
        authProvider: true,
        profilePictureUrl: true,
        createdAt: true,
        lastLoginAt: true,
        ownedLeagues: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            errorLogs: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        authProvider: user.authProvider,
        profilePictureUrl: user.profilePictureUrl,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        leagues: user.ownedLeagues.map((league) => ({
          id: league.id,
          name: league.name,
          status: league.status,
          createdAt: league.createdAt.toISOString(),
        })),
        errorCount: user._count.errorLogs,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch user');
    res.status(500).json({
      error: 'Failed to fetch user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update a user's role (promote/demote)
 */
router.put('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = getAuthUser(req);

    // Validate request body
    const validation = updateRoleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { role } = validation.data;

    // Prevent admin from demoting themselves
    if (id === admin.id && role !== 'admin') {
      res.status(400).json({
        error: 'Cannot demote yourself',
        message: 'You cannot remove your own admin privileges',
      });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    logger.info(
      {
        adminId: admin.id,
        adminEmail: admin.email,
        targetUserId: id,
        targetEmail: user.email,
        previousRole: user.role,
        newRole: role,
      },
      'User role updated by admin'
    );

    res.json({
      success: true,
      user: updatedUser,
      message: `User ${updatedUser.email} role updated to ${role}`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update user role');
    res.status(500).json({
      error: 'Failed to update user role',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =============================================================================
// ERROR LOG ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/errors
 * List error logs with pagination and filtering
 */
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Parse filters
    const filtersValidation = errorFiltersSchema.safeParse(req.query);
    if (!filtersValidation.success) {
      res.status(400).json({
        error: 'Invalid filters',
        details: filtersValidation.error.errors,
      });
      return;
    }

    const filters = filtersValidation.data;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (filters.source !== 'all') {
      where.source = filters.source;
    }
    if (filters.severity !== 'all') {
      where.severity = filters.severity;
    }
    if (filters.resolved !== 'all') {
      where.resolved = filters.resolved === 'true';
    }
    if (filters.startDate) {
      where.createdAt = { ...(where.createdAt as object || {}), gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.createdAt = { ...(where.createdAt as object || {}), lte: new Date(filters.endDate) };
    }

    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.errorLog.count({ where }),
    ]);

    res.json({
      errors: errors.map((error) => ({
        id: error.id,
        userId: error.userId,
        userName: error.user?.name || error.user?.email || null,
        userEmail: error.user?.email || null,
        errorCode: error.errorCode,
        errorMessage: error.errorMessage,
        source: error.source,
        severity: error.severity,
        context: error.context,
        resolved: error.resolved,
        resolvedAt: error.resolvedAt?.toISOString() || null,
        resolvedBy: error.resolvedBy,
        createdAt: error.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch error logs');
    res.status(500).json({
      error: 'Failed to fetch error logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/errors/:id
 * Get a single error log with full details
 */
router.get('/errors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const error = await prisma.errorLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!error) {
      res.status(404).json({ error: 'Error log not found' });
      return;
    }

    res.json({
      error: {
        id: error.id,
        userId: error.userId,
        userName: error.user?.name || error.user?.email || null,
        userEmail: error.user?.email || null,
        errorCode: error.errorCode,
        errorMessage: error.errorMessage,
        stackTrace: error.stackTrace,
        source: error.source,
        severity: error.severity,
        context: error.context,
        resolved: error.resolved,
        resolvedAt: error.resolvedAt?.toISOString() || null,
        resolvedBy: error.resolvedBy,
        createdAt: error.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch error log');
    res.status(500).json({
      error: 'Failed to fetch error log',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/admin/errors/:id/resolve
 * Mark an error as resolved
 */
router.put('/errors/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = getAuthUser(req);

    const error = await prisma.errorLog.findUnique({
      where: { id },
      select: { id: true, resolved: true },
    });

    if (!error) {
      res.status(404).json({ error: 'Error log not found' });
      return;
    }

    if (error.resolved) {
      res.status(400).json({ error: 'Error already resolved' });
      return;
    }

    const updatedError = await prisma.errorLog.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: admin.id,
      },
    });

    logger.info(
      {
        adminId: admin.id,
        adminEmail: admin.email,
        errorId: id,
      },
      'Error log resolved by admin'
    );

    res.json({
      success: true,
      error: {
        id: updatedError.id,
        resolved: updatedError.resolved,
        resolvedAt: updatedError.resolvedAt?.toISOString(),
        resolvedBy: updatedError.resolvedBy,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to resolve error log');
    res.status(500).json({
      error: 'Failed to resolve error log',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/admin/errors/:id/unresolve
 * Mark an error as unresolved (reopen)
 */
router.put('/errors/:id/unresolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = getAuthUser(req);

    const error = await prisma.errorLog.findUnique({
      where: { id },
      select: { id: true, resolved: true },
    });

    if (!error) {
      res.status(404).json({ error: 'Error log not found' });
      return;
    }

    if (!error.resolved) {
      res.status(400).json({ error: 'Error is not resolved' });
      return;
    }

    const updatedError = await prisma.errorLog.update({
      where: { id },
      data: {
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
      },
    });

    logger.info(
      {
        adminId: admin.id,
        adminEmail: admin.email,
        errorId: id,
      },
      'Error log reopened by admin'
    );

    res.json({
      success: true,
      error: {
        id: updatedError.id,
        resolved: updatedError.resolved,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to unresolve error log');
    res.status(500).json({
      error: 'Failed to unresolve error log',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

/**
 * Cleanup Job for Draft Leagues
 *
 * Purges leagues that have been in 'setup' status for more than 120 days.
 * This prevents abandoned draft setups from accumulating in the database.
 *
 * Runs daily at midnight UTC.
 */

import { prisma } from '../db.js';
import { logger } from '../services/logger.js';

const CLEANUP_DAYS = 120;

/**
 * Delete leagues that have been in 'setup' status for more than CLEANUP_DAYS
 */
export async function cleanupDraftLeagues(): Promise<{ deleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_DAYS);

  logger.info(
    { cutoffDate: cutoffDate.toISOString(), cleanupDays: CLEANUP_DAYS },
    'Starting draft league cleanup'
  );

  try {
    // Find leagues to delete (for logging purposes)
    const leaguesToDelete = await prisma.league.findMany({
      where: {
        status: 'setup',
        updatedAt: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        updatedAt: true,
      },
    });

    if (leaguesToDelete.length === 0) {
      logger.info('No stale draft leagues found to clean up');
      return { deleted: 0 };
    }

    logger.info(
      { count: leaguesToDelete.length, leagues: leaguesToDelete.map(l => l.id) },
      'Found stale draft leagues to delete'
    );

    // Delete the leagues (cascade will handle related records)
    const result = await prisma.league.deleteMany({
      where: {
        status: 'setup',
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(
      { deleted: result.count },
      'Draft league cleanup completed'
    );

    return { deleted: result.count };
  } catch (error) {
    logger.error({ error }, 'Failed to cleanup draft leagues');
    throw error;
  }
}

/**
 * Calculate milliseconds until next midnight UTC
 */
function msUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

let cleanupInterval: ReturnType<typeof setInterval> | null = null;
let initialTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Start the cleanup job scheduler
 * Runs at midnight UTC daily
 *
 * NOTE: Currently disabled. Call this function manually to enable when ready.
 */
export function startCleanupScheduler(): void {
  // DISABLED: Purge job is not active. Uncomment below to enable.
  logger.info('Draft league cleanup scheduler is DISABLED');
  return;

  /*
  // Don't run in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  logger.info('Starting draft league cleanup scheduler');

  // Run immediately on startup (but not in production to avoid startup delays)
  if (process.env.NODE_ENV === 'development') {
    cleanupDraftLeagues().catch(error => {
      logger.error({ error }, 'Startup cleanup failed');
    });
  }

  // Schedule to run at next midnight UTC, then every 24 hours
  const msUntilMidnight = msUntilMidnightUTC();

  logger.info(
    { msUntilMidnight, hours: (msUntilMidnight / (1000 * 60 * 60)).toFixed(2) },
    'Scheduling first cleanup run'
  );

  initialTimeout = setTimeout(() => {
    // Run at midnight
    cleanupDraftLeagues().catch(error => {
      logger.error({ error }, 'Scheduled cleanup failed');
    });

    // Then run every 24 hours
    cleanupInterval = setInterval(() => {
      cleanupDraftLeagues().catch(error => {
        logger.error({ error }, 'Scheduled cleanup failed');
      });
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, msUntilMidnight);
  */
}

/**
 * Stop the cleanup job scheduler
 */
export function stopCleanupScheduler(): void {
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  logger.info('Draft league cleanup scheduler stopped');
}

import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from './config/env.js';
import { logger } from './services/logger.js';

/**
 * Prisma Client singleton
 *
 * This ensures we don't create multiple Prisma Client instances during development
 * due to hot reloading, which can exhaust database connections.
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: isDevelopment
      ? ['query', 'error', 'warn']
      : ['error'],
    errorFormat: isDevelopment ? 'pretty' : 'minimal',
  });

if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}

/**
 * Connect to the database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    throw error;
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

// Note: Shutdown handlers are registered in index.ts to avoid race conditions
// from duplicate handlers. The index.ts shutdown handler calls prisma.$disconnect()

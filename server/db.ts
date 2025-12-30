import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from './config/env.js';

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
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('Database disconnected');
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Note: Shutdown handlers are registered in index.ts to avoid race conditions
// from duplicate handlers. The index.ts shutdown handler calls prisma.$disconnect()

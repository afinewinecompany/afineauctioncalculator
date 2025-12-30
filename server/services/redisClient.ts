/**
 * Redis Client Configuration
 *
 * Provides a centralized Redis connection with:
 * - Connection pooling and retry logic
 * - Graceful degradation (fallback to in-memory in development)
 * - Health check support
 * - Automatic reconnection
 */

import Redis from 'ioredis';
import { env, isDevelopment, isProduction } from '../config/env.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis connection with proper configuration
 */
export function initializeRedis(): Redis | null {
  // Skip Redis in development if REDIS_URL not configured
  if (!env.REDIS_URL) {
    if (isDevelopment) {
      logger.info('No REDIS_URL configured - running without Redis (development only)');
      logger.info('File-based caching will be used as fallback');
      return null;
    } else {
      logger.warn('No REDIS_URL configured in production - this is not recommended');
      return null;
    }
  }

  try {
    redisClient = new Redis(env.REDIS_URL, {
      // Connection retry strategy
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        logger.info({ attempt: times, delayMs: delay }, 'Retrying Redis connection');
        return delay;
      },

      // Maximum retries before giving up
      maxRetriesPerRequest: 3,

      // Enable auto-reconnect
      enableOfflineQueue: true,

      // Connection timeout
      connectTimeout: 10000,

      // Keep-alive
      keepAlive: 30000,

      // Lazy connect - don't connect until first command
      lazyConnect: true,

      // TLS configuration for production (Railway uses TLS)
      ...(isProduction && env.REDIS_URL.includes('rediss://') ? {
        tls: {
          rejectUnauthorized: false, // Railway self-signed certs
        }
      } : {}),
    });

    // Connection event handlers
    redisClient.on('connect', () => {
      logger.info('Connecting to Redis');
    });

    redisClient.on('ready', () => {
      logger.info('Redis connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('error', (error) => {
      logger.error({ error: error.message }, 'Redis error');
      isRedisAvailable = false;

      // In development, log but don't crash
      if (isDevelopment) {
        logger.info('Continuing without Redis (development mode)');
      }
    });

    redisClient.on('close', () => {
      logger.info('Redis connection closed');
      isRedisAvailable = false;
    });

    redisClient.on('reconnecting', (delay: number) => {
      logger.info({ delayMs: delay }, 'Redis reconnecting');
    });

    // Connect immediately
    redisClient.connect().catch(error => {
      logger.error({ error: error.message }, 'Failed to connect to Redis');
      if (!isDevelopment) {
        throw error;
      }
    });

    return redisClient;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis');
    if (!isDevelopment) {
      throw error;
    }
    return null;
  }
}

/**
 * Get the Redis client instance
 * Returns null if Redis is not available
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Check if Redis is available and healthy
 */
export async function checkRedisHealth(): Promise<boolean> {
  if (!redisClient || !isRedisAvailable) {
    return false;
  }

  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return false;
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    logger.info('Closing Redis connection');
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error({ error }, 'Error during Redis shutdown');
      // Force disconnect if graceful shutdown fails
      redisClient.disconnect();
    }
    redisClient = null;
    isRedisAvailable = false;
  }
}

/**
 * Get Redis connection info for debugging
 */
export function getRedisInfo(): {
  available: boolean;
  configured: boolean;
  status: string;
} {
  return {
    available: isRedisAvailable,
    configured: env.REDIS_URL !== undefined,
    status: redisClient ? redisClient.status : 'not_initialized',
  };
}

/**
 * Helper to check if Redis is available
 * Useful for conditional logic in services
 */
export function isRedisHealthy(): boolean {
  return isRedisAvailable && redisClient !== null;
}

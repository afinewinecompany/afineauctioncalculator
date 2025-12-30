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
import { env, isDevelopment, isProduction } from '../config/env';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis connection with proper configuration
 */
export function initializeRedis(): Redis | null {
  // Skip Redis in development if REDIS_URL not configured
  if (!env.REDIS_URL) {
    if (isDevelopment) {
      console.log('[Redis] No REDIS_URL configured - running without Redis (development only)');
      console.log('[Redis] File-based caching will be used as fallback');
      return null;
    } else {
      console.warn('[Redis] WARNING: No REDIS_URL configured in production - this is not recommended');
      return null;
    }
  }

  try {
    redisClient = new Redis(env.REDIS_URL, {
      // Connection retry strategy
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        console.log(`[Redis] Retrying connection (attempt ${times}) in ${delay}ms...`);
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
      console.log('[Redis] Connecting to Redis...');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Connected successfully');
      isRedisAvailable = true;
    });

    redisClient.on('error', (error) => {
      console.error('[Redis] Error:', error.message);
      isRedisAvailable = false;

      // In development, log but don't crash
      if (isDevelopment) {
        console.log('[Redis] Continuing without Redis (development mode)');
      }
    });

    redisClient.on('close', () => {
      console.log('[Redis] Connection closed');
      isRedisAvailable = false;
    });

    redisClient.on('reconnecting', (delay) => {
      console.log(`[Redis] Reconnecting in ${delay}ms...`);
    });

    // Connect immediately
    redisClient.connect().catch(error => {
      console.error('[Redis] Failed to connect:', error.message);
      if (!isDevelopment) {
        throw error;
      }
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
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
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    console.log('[Redis] Closing connection...');
    try {
      await redisClient.quit();
      console.log('[Redis] Connection closed gracefully');
    } catch (error) {
      console.error('[Redis] Error during shutdown:', error);
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

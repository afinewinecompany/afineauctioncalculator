/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting for different API endpoints to prevent abuse
 * and protect against DDoS attacks.
 *
 * Uses Redis store for distributed rate limiting when Redis is available,
 * with automatic fallback to in-memory store for development or when
 * Redis is not configured.
 */

import rateLimit, { type Store, type Options, type IncrementResponse } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { getRedisClient, isRedisHealthy } from '../services/redisClient.js';
import type Redis from 'ioredis';

/**
 * Standard rate limit message format
 */
interface RateLimitErrorResponse {
  error: string;
  code: string;
  retryAfter: number;
  message: string;
}

/**
 * Creates a standardized rate limit response
 */
function createRateLimitResponse(retryAfterSeconds: number): RateLimitErrorResponse {
  return {
    error: 'Rate limit exceeded',
    code: 'RATE_LIMITED',
    retryAfter: retryAfterSeconds,
    message: `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
  };
}

/**
 * Redis Store for express-rate-limit
 * Implements the Store interface using ioredis
 */
class RedisStore implements Store {
  private client: Redis;
  public prefix: string;
  private windowMs: number;

  constructor(options: { client: Redis; prefix?: string; windowMs: number }) {
    this.client = options.client;
    this.prefix = options.prefix || 'rl:';
    this.windowMs = options.windowMs;
  }

  /**
   * Get the key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Initialize the store (called when the middleware is created)
   */
  init(_options: Options): void {
    // No initialization needed for Redis
  }

  /**
   * Increment the hit count for a client
   */
  async increment(key: string): Promise<IncrementResponse> {
    const redisKey = this.getKey(key);
    const windowSeconds = Math.ceil(this.windowMs / 1000);

    try {
      // Use MULTI/EXEC for atomic operations
      const results = await this.client
        .multi()
        .incr(redisKey)
        .pttl(redisKey)
        .exec();

      if (!results) {
        throw new Error('Redis transaction failed');
      }

      const [[incrErr, totalHits], [pttlErr, ttl]] = results as [[Error | null, number], [Error | null, number]];

      if (incrErr) throw incrErr;
      if (pttlErr) throw pttlErr;

      // If key is new (no TTL), set expiration
      if (ttl === -1) {
        await this.client.expire(redisKey, windowSeconds);
      }

      // Calculate reset time
      const resetTime = ttl > 0
        ? new Date(Date.now() + ttl)
        : new Date(Date.now() + this.windowMs);

      return {
        totalHits: totalHits as number,
        resetTime,
      };
    } catch (error) {
      console.error('[RateLimiter] Redis increment error:', error);
      // Return a fallback that allows the request through
      // This prevents Redis failures from blocking all requests
      return {
        totalHits: 0,
        resetTime: new Date(Date.now() + this.windowMs),
      };
    }
  }

  /**
   * Decrement the hit count for a client (used when a request fails validation)
   */
  async decrement(key: string): Promise<void> {
    const redisKey = this.getKey(key);
    try {
      await this.client.decr(redisKey);
    } catch (error) {
      console.error('[RateLimiter] Redis decrement error:', error);
      // Ignore decrement errors - they're not critical
    }
  }

  /**
   * Reset the hit count for a client
   */
  async resetKey(key: string): Promise<void> {
    const redisKey = this.getKey(key);
    try {
      await this.client.del(redisKey);
    } catch (error) {
      console.error('[RateLimiter] Redis reset error:', error);
      // Ignore reset errors - they're not critical
    }
  }
}

/**
 * Create a store for rate limiting
 * Uses Redis when available, falls back to in-memory (default) otherwise
 */
function createStore(windowMs: number, prefix: string): Store | undefined {
  const redisClient = getRedisClient();

  if (redisClient && isRedisHealthy()) {
    console.log(`[RateLimiter] Using Redis store for ${prefix}`);
    return new RedisStore({
      client: redisClient,
      prefix: `ratelimit:${prefix}:`,
      windowMs,
    });
  }

  console.log(`[RateLimiter] Using in-memory store for ${prefix} (Redis not available)`);
  return undefined; // Returns undefined to use default in-memory store
}

/**
 * Key generator function - extracts client IP from request
 */
function keyGenerator(req: Request): string {
  // Use X-Forwarded-For header if behind a proxy, otherwise use IP
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create rate limiter with Redis support
 * Lazily initializes the store on first request to ensure Redis is connected
 */
function createRateLimiter(options: {
  windowMs: number;
  max: number;
  prefix: string;
  handler?: (req: Request, res: Response) => void;
  skip?: (req: Request) => boolean;
  message?: RateLimitErrorResponse | object;
}) {
  let store: Store | undefined;
  let storeInitialized = false;

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: options.message || createRateLimitResponse(Math.ceil(options.windowMs / 1000)),
    handler: options.handler || ((req: Request, res: Response) => {
      res.status(429).json(createRateLimitResponse(Math.ceil(options.windowMs / 1000)));
    }),
    keyGenerator,
    skip: options.skip,
    // Lazily initialize store on first use
    store: {
      init(rateLimitOptions: Options): void {
        if (!storeInitialized) {
          store = createStore(options.windowMs, options.prefix);
          storeInitialized = true;
          if (store) {
            store.init?.(rateLimitOptions);
          }
        }
      },
      async increment(key: string): Promise<IncrementResponse> {
        if (store) {
          return store.increment(key);
        }
        // Fallback: use a simple in-memory approach if store not ready
        return {
          totalHits: 1,
          resetTime: new Date(Date.now() + options.windowMs),
        };
      },
      async decrement(key: string): Promise<void> {
        if (store) {
          return store.decrement?.(key);
        }
      },
      async resetKey(key: string): Promise<void> {
        if (store) {
          return store.resetKey?.(key);
        }
      },
    } as Store,
  });
}

/**
 * General API rate limiter
 * 100 requests per minute for standard API endpoints
 */
export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  prefix: 'api',
  skip: (req: Request): boolean => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
});

/**
 * Authentication rate limiter (strict)
 * 10 requests per minute for login/register endpoints
 * Stricter to prevent brute force attacks
 */
export const authLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  prefix: 'auth',
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(createRateLimitResponse(60));
  },
  skip: (req: Request): boolean => {
    // Don't apply strict rate limiting to session verification endpoints
    // These are called frequently and don't need brute force protection
    const path = req.path;
    return path === '/me' ||
           path === '/refresh' ||
           path === '/google/status' ||
           path === '/logout';
  },
});

/**
 * Scraping/Auction rate limiter
 * 20 requests per minute for auction endpoints
 * These endpoints are resource-intensive (Puppeteer scraping)
 */
export const scrapingLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  prefix: 'scraping',
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Scraping rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      ...createRateLimitResponse(60),
      message: 'Too many auction requests. Scraping is resource-intensive. Please wait before trying again.',
    });
  },
});

/**
 * Projections refresh rate limiter
 * 5 requests per minute for projection refresh endpoints
 * These hit external APIs (FanGraphs) and should be used sparingly
 */
export const refreshLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  prefix: 'refresh',
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Refresh rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      ...createRateLimitResponse(60),
      message: 'Too many refresh requests. Projections are cached for 24 hours.',
    });
  },
});

/**
 * Password reset rate limiter (very strict)
 * 3 requests per 15 minutes for password reset requests
 * Prevents abuse and email enumeration attacks
 */
export const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per 15 minutes
  prefix: 'password-reset',
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Password reset rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      ...createRateLimitResponse(900), // 15 minutes in seconds
      message: 'Too many password reset requests. Please try again later.',
    });
  },
});

/**
 * Chat assistant rate limiter
 * 30 requests per minute for LLM chat endpoints
 * Prevents abuse of the LLM API while allowing normal conversation flow
 */
export const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  prefix: 'chat',
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Chat rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      ...createRateLimitResponse(60),
      message: 'Too many chat requests. Please slow down and try again.',
    });
  },
});

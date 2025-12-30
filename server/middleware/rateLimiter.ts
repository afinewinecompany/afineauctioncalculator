/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting for different API endpoints to prevent abuse
 * and protect against DDoS attacks.
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

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
 * General API rate limiter
 * 100 requests per minute for standard API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: createRateLimitResponse(60),
  handler: (req: Request, res: Response) => {
    res.status(429).json(createRateLimitResponse(60));
  },
  keyGenerator: (req: Request): string => {
    // Use X-Forwarded-For header if behind a proxy, otherwise use IP
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
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
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitResponse(60),
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json(createRateLimitResponse(60));
  },
  keyGenerator: (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
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
export const scrapingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitResponse(60),
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Scraping rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      ...createRateLimitResponse(60),
      message: 'Too many auction requests. Scraping is resource-intensive. Please wait before trying again.',
    });
  },
  keyGenerator: (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Projections refresh rate limiter
 * 5 requests per minute for projection refresh endpoints
 * These hit external APIs (FanGraphs) and should be used sparingly
 */
export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitResponse(60),
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Refresh rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      ...createRateLimitResponse(60),
      message: 'Too many refresh requests. Projections are cached for 24 hours.',
    });
  },
  keyGenerator: (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable validation schema using Zod
 *
 * This ensures all required configuration is present and valid before
 * the server starts, preventing runtime errors from misconfiguration.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis connection string').optional(),

  // JWT Secrets (with test defaults for CI/testing)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security')
    .default('test-jwt-secret-that-is-at-least-32-chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .default('test-refresh-secret-that-is-at-least-32-chars'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Environment
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3001'),

  // Frontend
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').default('http://localhost:3000'),
  // Support both CORS_ORIGINS (preferred) and CORS_ORIGIN (legacy)
  CORS_ORIGINS: z.string().transform((val) => val.split(',')).optional(),
  CORS_ORIGIN: z.string().optional(),

  // OAuth (optional for now)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().int().positive()).default('100'),
  AUTH_RATE_LIMIT_MAX: z.string().transform(Number).pipe(z.number().int().positive()).default('20'),

  // Scraping Configuration
  COUCH_MANAGERS_BASE_URL: z.string().url().default('https://couchmanagers.com'),
  SCRAPING_TIMEOUT_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('30000'),

  // Cache Configuration
  PROJECTIONS_CACHE_TTL_HOURS: z.string().transform(Number).pipe(z.number().int().positive()).default('24'),
  AUCTION_CACHE_TTL_MINUTES: z.string().transform(Number).pipe(z.number().int().positive()).default('5'),
  DYNASTY_CACHE_TTL_HOURS: z.string().transform(Number).pipe(z.number().int().positive()).default('12'),
});

/**
 * Validated and typed environment configuration
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed configuration
 *
 * @throws {z.ZodError} If validation fails with detailed error messages
 */
function validateEnv(): EnvConfig {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );

      console.error('\n❌ Environment validation failed:\n');
      errorMessages.forEach((msg) => console.error(`  - ${msg}`));
      console.error('\nPlease check your .env file and ensure all required variables are set.');
      console.error('See .env.example for reference.\n');

      throw new Error('Invalid environment configuration');
    }
    throw error;
  }
}

/**
 * Validated environment configuration singleton
 *
 * Usage:
 * ```typescript
 * import { env } from './config/env';
 *
 * const dbUrl = env.DATABASE_URL;
 * const port = env.PORT;
 * ```
 */
export const env = validateEnv();

/**
 * Helper to check if running in production
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Helper to check if running in development
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Helper to check if running in staging
 */
export const isStaging = env.NODE_ENV === 'staging';

/**
 * Database configuration object
 */
export const dbConfig = {
  url: env.DATABASE_URL,
  poolMin: isDevelopment ? 2 : 5,
  poolMax: isDevelopment ? 10 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

/**
 * Redis configuration object
 */
export const redisConfig = env.REDIS_URL ? {
  url: env.REDIS_URL,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
} : null;

/**
 * Get CORS origins - supports both CORS_ORIGINS (array) and CORS_ORIGIN (single)
 */
function getCorsOrigins(): string[] | string {
  // Check for CORS_ORIGINS first (comma-separated list)
  if (env.CORS_ORIGINS && env.CORS_ORIGINS.length > 0) {
    return env.CORS_ORIGINS;
  }
  // Fall back to CORS_ORIGIN (single origin)
  if (env.CORS_ORIGIN) {
    return [env.CORS_ORIGIN];
  }
  // Default to FRONTEND_URL
  return [env.FRONTEND_URL];
}

/**
 * CORS configuration
 */
export const corsConfig = {
  origin: isProduction ? getCorsOrigins() : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

/**
 * JWT configuration
 */
export const jwtConfig = {
  secret: env.JWT_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiry: env.JWT_ACCESS_EXPIRY,
  refreshExpiry: env.JWT_REFRESH_EXPIRY,
};

/**
 * Rate limit configuration
 */
export const rateLimitConfig = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Auth-specific rate limit configuration (stricter)
 */
export const authRateLimitConfig = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Log configuration details on startup (non-sensitive only)
 */
export function logConfig() {
  const origins = getCorsOrigins();
  const originsStr = Array.isArray(origins) ? origins.join(', ') : origins;

  console.log('\n📋 Server Configuration:');
  console.log(`  Environment: ${env.NODE_ENV}`);
  console.log(`  Port: ${env.PORT}`);
  console.log(`  Frontend URL: ${env.FRONTEND_URL}`);
  console.log(`  CORS Origins: ${originsStr}`);
  console.log(`  Log Level: ${env.LOG_LEVEL}`);
  console.log(`  Database: ${env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`  Redis: ${env.REDIS_URL ? 'Configured' : 'Not configured (optional)'}`);
  console.log(`  Google OAuth: ${env.GOOGLE_CLIENT_ID ? 'Configured' : 'Not configured'}`);
  console.log('');
}

/**
 * Express Server Configuration
 *
 * Production-ready server setup with:
 * - Structured logging (Pino)
 * - Request tracking with unique IDs
 * - Centralized error handling
 * - Error tracking (Sentry)
 * - CORS configuration (environment-based origins)
 * - Rate limiting (per endpoint type)
 * - Security headers (helmet)
 * - Input sanitization (XSS protection)
 * - Compression
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import auctionRoutes from './routes/auction.js';
import projectionsRoutes from './routes/projections.js';
import { closeBrowser, prewarmBrowser } from './services/couchManagersScraper.js';
import { apiLimiter, authLimiter, scrapingLimiter } from './middleware/rateLimiter.js';
import { sanitizeBody } from './middleware/sanitize.js';
import requestLogger, { slowRequestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { env, corsConfig, logConfig, isDevelopment, isProduction } from './config/env.js';
import { prisma, connectDatabase, checkDatabaseHealth } from './db.js';
import { logger, flushLogs } from './services/logger.js';
import { errorTracking } from './services/errorTracking.js';
import { initializeRedis, checkRedisHealth, closeRedis, getRedisInfo } from './services/redisClient.js';

export function createServer(): Express {
  const app = express();

  // Validate environment and log configuration on startup (only log once)
  if (isDevelopment) {
    logConfig();
  }

  // PERFORMANCE: Pre-warm browser on server start (saves ~2-5s on first scrape)
  prewarmBrowser().catch(err => {
    logger.warn({ error: err.message }, 'Failed to pre-warm browser');
  });

  // ==========================================================================
  // LOGGING MIDDLEWARE (must be early in chain)
  // ==========================================================================

  // 1. Request logger with unique request IDs
  app.use(requestLogger);

  // 2. Slow request detection (warn if request takes > 1s)
  app.use(slowRequestLogger(1000));

  // 3. Sentry request handler (if configured)
  if (errorTracking) {
    app.use(errorTracking.getExpressRequestHandler());
  }

  // ==========================================================================
  // SECURITY MIDDLEWARE (order matters!)
  // ==========================================================================

  // 4. Security headers with helmet
  // Configure CSP to allow frontend resources
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
        imgSrc: ["'self'", 'data:', 'https://img.mlbstatic.com'], // Allow MLB player photos
        connectSrc: ["'self'", env.FRONTEND_URL],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    } : false, // Disable CSP in development for easier debugging
    crossOriginEmbedderPolicy: false, // Allow embedding resources
  }));

  // 5. CORS configuration using validated environment config
  app.use(cors({
    ...corsConfig,
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'X-Request-Id'],
    maxAge: 86400, // Cache preflight requests for 24 hours
  }));

  // 6. Compression for response bodies
  app.use(compression({
    level: 6, // Balance between speed and compression ratio
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't accept it
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  }));

  // 7. Body parsing - increase JSON body limit for large player lists
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // 8. Input sanitization for XSS protection (after body parsing)
  app.use(sanitizeBody);

  // 9. General rate limiting for all API routes
  app.use('/api/', apiLimiter);

  // 10. Stricter rate limiting for auth routes
  app.use('/api/auth/', authLimiter);

  // 11. Stricter rate limiting for scraping/auction routes
  app.use('/api/auction/', scrapingLimiter);

  // ==========================================================================
  // ROUTES
  // ==========================================================================

  // Health check endpoint with database and Redis status (not rate limited)
  app.get('/api/health', async (req: Request, res: Response) => {
    const dbHealthy = await checkDatabaseHealth();
    const redisHealthy = await checkRedisHealth();
    const redisInfo = getRedisInfo();

    const health = {
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        redis: redisInfo.configured
          ? (redisHealthy ? 'connected' : 'disconnected')
          : 'not_configured',
      },
    };

    // Return 200 if DB is healthy (Redis is optional)
    // Return 503 if DB is unhealthy
    res.status(dbHealthy ? 200 : 503).json(health);
  });

  // Authentication routes
  app.use('/api/auth', authRoutes);

  // Auction routes (scraping endpoints)
  app.use('/api/auction', auctionRoutes);

  // Projections routes
  app.use('/api/projections', projectionsRoutes);

  // ==========================================================================
  // STATIC FILE SERVING (Production only - serves built frontend)
  // ==========================================================================

  if (isProduction) {
    // Get directory path for ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Serve static files from the dist folder (built frontend)
    // Server runs from dist/server/index.js, frontend is at dist/
    // So we go up one level from dist/server/ to dist/
    const distPath = path.join(__dirname, '..');

    logger.info({ distPath }, 'Serving static files from');

    app.use(express.static(distPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Skip if it's an API route (should have been handled above)
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ==========================================================================
  // ERROR HANDLING (must be last)
  // ==========================================================================

  // Sentry error handler (must be before other error handlers)
  if (errorTracking) {
    app.use(errorTracking.getExpressErrorHandler());
  }

  // 404 handler for unknown routes
  app.use(notFoundHandler);

  // Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}

// ==========================================================================
// SERVER STARTUP
// ==========================================================================

/**
 * Start the server with database, Redis initialization, and error tracking
 */
export async function startServer(): Promise<void> {
  try {
    // Initialize error tracking (Sentry)
    await errorTracking.init();

    // Connect to database
    await connectDatabase();

    // Initialize Redis (optional - won't fail if not configured)
    const redis = initializeRedis();
    if (redis) {
      logger.info('Redis initialization started');
    } else {
      logger.warn('Redis not configured - using file-based cache fallback');
    }

    // Create Express app
    const app = createServer();

    // Start listening
    const server = app.listen(env.PORT, () => {
      logger.info({
        port: env.PORT,
        environment: env.NODE_ENV,
        frontendUrl: env.FRONTEND_URL,
      }, 'Server started successfully');

      // Console output for development
      if (isDevelopment) {
        console.log(`\n🚀 Server running on http://localhost:${env.PORT}`);
        console.log(`📊 Health check: http://localhost:${env.PORT}/api/health`);
        console.log(`🌐 Frontend URL: ${env.FRONTEND_URL}\n`);
      }
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');

      // Close HTTP server (stop accepting new connections)
      server.close(() => {
        logger.info('HTTP server closed');
      });

      try {
        // Close browser
        await closeBrowser();
        logger.info('Browser closed');

        // Close Redis connection
        await closeRedis();
        logger.info('Redis connection closed');

        // Flush logs
        await flushLogs();
        logger.info('Logs flushed');

        // Flush error tracking
        await errorTracking.flush(2000);
        logger.info('Error tracking flushed');

        // Disconnect from database
        await prisma.$disconnect();
        logger.info('Database disconnected');

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error) => {
      logger.fatal({ error }, 'Uncaught exception, shutting down');
      errorTracking.captureException(error, { context: 'uncaughtException' });
      await shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error({ reason, promise }, 'Unhandled promise rejection');
      if (reason instanceof Error) {
        errorTracking.captureException(reason, { context: 'unhandledRejection' });
      }
      // Don't exit on unhandled rejection, just log it
    });

  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

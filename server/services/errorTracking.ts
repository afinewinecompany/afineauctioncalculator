/**
 * Error Tracking Service (Sentry Integration)
 *
 * Features:
 * - Conditional initialization (only if SENTRY_DSN is configured)
 * - Environment-aware (dev vs prod)
 * - User context enrichment
 * - Performance monitoring
 * - Custom error tagging
 */

import { isProduction, isDevelopment, env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Sentry configuration interface
 */
interface SentryConfig {
  dsn: string;
  environment: string;
  enabled: boolean;
  tracesSampleRate: number;
  beforeSend?: (event: any) => any;
}

/**
 * Check if Sentry is configured
 */
const SENTRY_DSN = process.env.SENTRY_DSN;
const isSentryEnabled = Boolean(SENTRY_DSN) && isProduction;

/**
 * Sentry configuration
 */
const sentryConfig: SentryConfig | null = isSentryEnabled ? {
  dsn: SENTRY_DSN!,
  environment: env.NODE_ENV,
  enabled: true,

  // Sample rate for performance monitoring
  // 1.0 = 100% of transactions (adjust based on traffic)
  tracesSampleRate: isProduction ? 0.1 : 1.0,

  // Filter out errors before sending to Sentry
  beforeSend: (event: any) => {
    // Don't send errors in development
    if (isDevelopment) {
      return null;
    }

    // Filter out known errors that aren't actionable
    if (event.exception?.values?.[0]?.value?.includes('ECONNREFUSED')) {
      logger.warn({ error: event }, 'Filtered ECONNREFUSED error from Sentry');
      return null;
    }

    return event;
  },
} : null;

/**
 * Error tracking service wrapper
 * Provides no-op implementations when Sentry is not configured
 */
class ErrorTrackingService {
  private initialized = false;
  private Sentry: any = null;

  /**
   * Initialize Sentry (called on server startup)
   */
  async init(): Promise<void> {
    if (!isSentryEnabled) {
      logger.info('Sentry not configured (SENTRY_DSN not set)');
      return;
    }

    try {
      // Dynamically import Sentry only if configured
      this.Sentry = await import('@sentry/node');
      const { nodeProfilingIntegration } = await import('@sentry/profiling-node');

      this.Sentry.init({
        dsn: sentryConfig!.dsn,
        environment: sentryConfig!.environment,
        tracesSampleRate: sentryConfig!.tracesSampleRate,
        beforeSend: sentryConfig!.beforeSend,

        // Integrations (updated for @sentry/node v8)
        integrations: [
          nodeProfilingIntegration(),
        ],

        // Release tracking (from package.json version or git commit)
        release: process.env.npm_package_version || 'unknown',
      });

      this.initialized = true;
      logger.info({
        environment: sentryConfig!.environment,
        tracesSampleRate: sentryConfig!.tracesSampleRate,
      }, 'Sentry error tracking initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Sentry');
    }
  }

  /**
   * Capture an exception with context
   */
  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.initialized) {
      logger.debug({ error, context }, 'Sentry not initialized, skipping exception capture');
      return;
    }

    this.Sentry.captureException(error, {
      extra: context,
    });
  }

  /**
   * Capture a message (non-error event)
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, unknown>): void {
    if (!this.initialized) {
      logger.debug({ message, level, context }, 'Sentry not initialized, skipping message capture');
      return;
    }

    this.Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) return;

    this.Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }

  /**
   * Clear user context (e.g., on logout)
   */
  clearUser(): void {
    if (!this.initialized) return;

    this.Sentry.setUser(null);
  }

  /**
   * Set custom tags for filtering errors
   */
  setTags(tags: Record<string, string>): void {
    if (!this.initialized) return;

    this.Sentry.setTags(tags);
  }

  /**
   * Add breadcrumb (trail of events leading to error)
   */
  addBreadcrumb(breadcrumb: {
    message: string;
    category?: string;
    level?: 'debug' | 'info' | 'warning' | 'error';
    data?: Record<string, unknown>;
  }): void {
    if (!this.initialized) return;

    this.Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Start a new transaction for performance monitoring
   */
  startTransaction(name: string, op: string): any {
    if (!this.initialized) {
      return {
        finish: () => {},
        setStatus: () => {},
        setTag: () => {},
        setData: () => {},
      };
    }

    return this.Sentry.startTransaction({ name, op });
  }

  /**
   * Flush pending events (important before shutdown)
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    if (!this.initialized) return true;

    try {
      await this.Sentry.close(timeout);
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to flush Sentry events');
      return false;
    }
  }

  /**
   * Express error handler integration
   */
  getExpressErrorHandler(): any {
    if (!this.initialized) {
      return (err: Error, req: any, res: any, next: any) => next(err);
    }

    return this.Sentry.Handlers.errorHandler();
  }

  /**
   * Express request handler integration
   */
  getExpressRequestHandler(): any {
    if (!this.initialized) {
      return (req: any, res: any, next: any) => next();
    }

    return this.Sentry.Handlers.requestHandler();
  }
}

/**
 * Singleton instance
 */
export const errorTracking = new ErrorTrackingService();

/**
 * Helper function to track errors with automatic context
 */
export function trackError(error: Error, context?: Record<string, unknown>): void {
  // Always log locally
  logger.error({ error, ...context }, error.message);

  // Also send to Sentry if configured
  errorTracking.captureException(error, context);
}

/**
 * Helper function to track business events
 */
export function trackEvent(event: string, data?: Record<string, unknown>): void {
  logger.info({ event, ...data }, `Event: ${event}`);

  errorTracking.addBreadcrumb({
    message: event,
    category: 'business',
    level: 'info',
    data,
  });
}

/**
 * Default export
 */
export default errorTracking;

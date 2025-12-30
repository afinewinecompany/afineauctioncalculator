/**
 * Request Logger Middleware
 *
 * Features:
 * - Unique request ID generation (UUID)
 * - Request/response logging with timing
 * - Sensitive header masking
 * - Request ID in response headers
 * - Automatic error logging
 */

import { Request, Response, NextFunction } from 'express';
import pinoHttp, { Options as PinoHttpOptions } from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from '../services/logger.js';
import { isDevelopment } from '../config/env.js';

/**
 * Headers to mask in logs (sensitive data)
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
];

/**
 * Mask sensitive header values
 */
function maskHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...headers };
  SENSITIVE_HEADERS.forEach(header => {
    if (masked[header]) {
      masked[header] = '[REDACTED]';
    }
  });
  return masked;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return randomUUID();
}

/**
 * Pino HTTP middleware configuration
 */
const pinoHttpOptions: PinoHttpOptions = {
  logger,

  // Generate unique request ID
  genReqId: (req, res) => {
    const existingId = req.headers['x-request-id'] as string;
    const requestId = existingId || generateRequestId();

    // Add to response headers for client tracking
    res.setHeader('X-Request-Id', requestId);

    return requestId;
  },

  // Custom serializers for request/response
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      path: req.raw.url,
      headers: maskHeaders(req.headers),
      query: req.raw.query,
      params: req.raw.params,
      // Don't log request body by default (can be huge, may contain sensitive data)
      // Add req.raw.body if needed for debugging specific endpoints
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: maskHeaders(res.getHeaders() as Record<string, unknown>),
    }),
    err: (err) => ({
      message: err.message,
      stack: isDevelopment ? err.stack : undefined,
      type: err.constructor.name,
      ...err,
    }),
  },

  // Custom log level based on response status
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'info';
    return 'info';
  },

  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },

  // Custom error message
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  },

  // Custom attribute keys for request/response
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'duration',
  },

  // Don't log health checks (too noisy)
  autoLogging: {
    ignore: (req) => req.url === '/api/health',
  },
};

/**
 * Pino HTTP middleware instance
 */
export const requestLogger = pinoHttp(pinoHttpOptions);

/**
 * Enhanced request logger that adds user context
 * Use this after authentication middleware to include user info
 */
export function enhancedRequestLogger(req: Request, res: Response, next: NextFunction): void {
  // Add user context if authenticated
  if (req.user) {
    req.log = req.log.child({
      userId: (req.user as { id: string }).id,
      userEmail: (req.user as { email?: string }).email,
    });
  }

  next();
}

/**
 * Log request body for specific routes (debugging)
 * Only use this for non-sensitive endpoints
 */
export function logRequestBody(req: Request, res: Response, next: NextFunction): void {
  if (req.body && Object.keys(req.body).length > 0) {
    req.log.debug({ body: req.body }, 'Request body');
  }
  next();
}

/**
 * Middleware to track slow requests
 */
export function slowRequestLogger(thresholdMs: number = 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      if (duration > thresholdMs) {
        req.log.warn({
          duration,
          threshold: thresholdMs,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
        }, `Slow request detected: ${req.method} ${req.url} took ${duration}ms`);
      }
    });

    next();
  };
}

/**
 * Default export
 */
export default requestLogger;

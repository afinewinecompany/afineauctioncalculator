/**
 * Centralized Logging Service using Pino
 *
 * Features:
 * - Structured JSON logging for production
 * - Pretty-printed logs for development
 * - Request context enrichment
 * - Performance timing
 * - Error tracking integration
 */

import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';
import { env, isDevelopment, isProduction } from '../config/env.js';

/**
 * Pino logger configuration
 */
const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,

  // Format timestamps in ISO 8601
  timestamp: pino.stdTimeFunctions.isoTime,

  // Add base fields to all logs
  base: {
    env: env.NODE_ENV,
    version: process.env.npm_package_version,
  },

  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      'access_token',
      'refresh_token',
      'api_key',
      'secret',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
    ],
    censor: '[REDACTED]',
  },

  // Pretty print in development
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname,env,version',
      singleLine: false,
      levelFirst: true,
    },
  } : undefined,

  // Serialize errors with stack traces
  serializers: {
    error: pino.stdSerializers.err,
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
};

/**
 * Main application logger instance
 */
export const logger: PinoLogger = pino(loggerOptions);

/**
 * Create a child logger with additional context
 *
 * @example
 * const userLogger = createChildLogger({ userId: '123', requestId: 'abc' });
 * userLogger.info('User logged in');
 */
export function createChildLogger(context: Record<string, unknown>): PinoLogger {
  return logger.child(context);
}

/**
 * Log levels for type safety
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Helper class for structured logging with common patterns
 */
export class LoggerHelper {
  /**
   * Log a database query
   */
  static logQuery(operation: string, table: string, duration: number, metadata?: Record<string, unknown>) {
    logger.debug({
      type: 'database',
      operation,
      table,
      duration,
      ...metadata,
    }, `Database ${operation} on ${table} (${duration}ms)`);
  }

  /**
   * Log an external API call
   */
  static logExternalCall(
    service: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, unknown>
  ) {
    const level = statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      type: 'external_api',
      service,
      method,
      url,
      statusCode,
      duration,
      ...metadata,
    }, `${service} ${method} ${url} - ${statusCode} (${duration}ms)`);
  }

  /**
   * Log a cache operation
   */
  static logCache(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, metadata?: Record<string, unknown>) {
    logger.debug({
      type: 'cache',
      operation,
      key,
      ...metadata,
    }, `Cache ${operation}: ${key}`);
  }

  /**
   * Log an authentication event
   */
  static logAuth(event: string, userId?: string, metadata?: Record<string, unknown>) {
    logger.info({
      type: 'auth',
      event,
      userId,
      ...metadata,
    }, `Auth: ${event}${userId ? ` (user: ${userId})` : ''}`);
  }

  /**
   * Log a business event
   */
  static logBusiness(event: string, metadata: Record<string, unknown>) {
    logger.info({
      type: 'business',
      event,
      ...metadata,
    }, `Business Event: ${event}`);
  }

  /**
   * Log performance metrics
   */
  static logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>) {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    logger[level]({
      type: 'performance',
      operation,
      duration,
      ...metadata,
    }, `Performance: ${operation} took ${duration}ms`);
  }

  /**
   * Log a security event
   */
  static logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: Record<string, unknown>) {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    logger[level]({
      type: 'security',
      event,
      severity,
      ...metadata,
    }, `Security: ${event} (severity: ${severity})`);
  }
}

/**
 * Performance timer utility
 *
 * @example
 * const timer = new PerformanceTimer();
 * await someOperation();
 * const duration = timer.end();
 * logger.info({ duration }, 'Operation completed');
 */
export class PerformanceTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  end(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Log the duration with a message
   */
  log(message: string, metadata?: Record<string, unknown>) {
    const duration = this.end();
    LoggerHelper.logPerformance(message, duration, metadata);
    return duration;
  }
}

/**
 * Development-only logging (no-op in production)
 */
export function logDev(message: string, ...args: unknown[]): void {
  if (isDevelopment) {
    logger.debug({ args }, message);
  }
}

/**
 * Flush logs before shutdown (important for cloud platforms)
 */
export async function flushLogs(): Promise<void> {
  return new Promise((resolve) => {
    logger.flush(() => {
      resolve();
    });
  });
}

/**
 * Default export for convenience
 */
export default logger;

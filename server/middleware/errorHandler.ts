/**
 * Centralized Error Handler Middleware
 *
 * Features:
 * - Structured error responses
 * - Environment-aware (dev vs prod)
 * - Prisma error handling
 * - Zod validation error handling
 * - Error tracking integration
 * - Security (no stack trace leaks in production)
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  InternalError,
  isAppError,
  isOperationalError,
  createValidationError,
} from '../errors/index.js';
import { ErrorCodes } from '../errors/errorCodes.js';
import { logger } from '../services/logger.js';
import { errorTracking } from '../services/errorTracking.js';
import { isDevelopment } from '../config/env.js';

/**
 * Structured error response format
 */
interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  stack?: string;
  timestamp: string;
}

/**
 * Convert Prisma errors to AppErrors
 */
function handlePrismaError(error: Error): AppError {
  // Prisma Client Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // Unique constraint violation
      case 'P2002': {
        const target = (error.meta?.target as string[]) || [];
        return new ConflictError(
          `A record with this ${target.join(', ')} already exists`,
          ErrorCodes.DB_UNIQUE_CONSTRAINT
        );
      }

      // Foreign key constraint violation
      case 'P2003':
        return new ValidationError(
          'Invalid reference to related record',
          undefined,
          ErrorCodes.DB_FOREIGN_KEY_CONSTRAINT
        );

      // Record not found
      case 'P2025':
        return new NotFoundError('Record', ErrorCodes.DB_RECORD_NOT_FOUND);

      // Not null constraint violation
      case 'P2011':
        return new ValidationError(
          'Required field is missing',
          undefined,
          ErrorCodes.DB_NOT_NULL_CONSTRAINT
        );

      // Invalid query
      case 'P2019':
        return new ValidationError(
          'Invalid query parameters',
          undefined,
          ErrorCodes.VAL_INVALID_INPUT
        );

      default:
        return new DatabaseError(
          'Database operation failed',
          ErrorCodes.DB_QUERY_FAILED,
          { prismaCode: error.code }
        );
    }
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError(
      'Invalid data provided',
      undefined,
      ErrorCodes.VAL_INVALID_INPUT
    );
  }

  // Prisma initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new DatabaseError(
      'Database connection failed',
      ErrorCodes.DB_CONNECTION_FAILED
    );
  }

  // Prisma request errors (timeouts, etc.)
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new InternalError(
      'Database error occurred',
      ErrorCodes.DB_QUERY_FAILED
    );
  }

  // Unknown Prisma error
  return new DatabaseError(
    'Database error occurred',
    ErrorCodes.DB_QUERY_FAILED
  );
}

/**
 * Convert Zod validation errors to ValidationError
 */
function handleZodError(error: ZodError): ValidationError {
  return createValidationError(error);
}

/**
 * Convert generic errors to AppError
 */
function normalizeError(error: Error): AppError {
  // Already an AppError
  if (isAppError(error)) {
    return error;
  }

  // Zod validation error
  if (error instanceof ZodError) {
    return handleZodError(error);
  }

  // Prisma error
  if (error.constructor.name.startsWith('Prisma')) {
    return handlePrismaError(error);
  }

  // JWT errors (if using jsonwebtoken)
  if (error.name === 'JsonWebTokenError') {
    return new AppError(
      'Invalid token',
      401,
      ErrorCodes.AUTH_TOKEN_INVALID,
      true
    );
  }

  if (error.name === 'TokenExpiredError') {
    return new AppError(
      'Token expired',
      401,
      ErrorCodes.AUTH_TOKEN_EXPIRED,
      true
    );
  }

  // Unknown error
  return new InternalError(
    isDevelopment ? error.message : 'An unexpected error occurred',
    ErrorCodes.GEN_INTERNAL_ERROR,
    isDevelopment ? { originalError: error.message, stack: error.stack } : undefined
  );
}

/**
 * Build error response object
 */
function buildErrorResponse(error: AppError, requestId?: string): ErrorResponse {
  return {
    error: error.message,
    code: error.code,
    message: isDevelopment
      ? error.message
      : isOperationalError(error)
      ? error.message
      : 'An unexpected error occurred',
    details: isDevelopment ? error.details : undefined,
    requestId,
    stack: isDevelopment ? error.stack : undefined,
    timestamp: error.timestamp,
  };
}

/**
 * Log error with appropriate level and context
 */
function logError(error: AppError, req: Request): void {
  const context = {
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
    user: req.user ? {
      id: (req.user as any).id,
      email: (req.user as any).email,
    } : undefined,
  };

  // Log level based on error type
  if (!isOperationalError(error) || error.statusCode >= 500) {
    logger.error(context, `Error: ${error.message}`);
    // Send to Sentry for non-operational errors
    errorTracking.captureException(error, context);
  } else if (error.statusCode >= 400) {
    logger.warn(context, `Client Error: ${error.message}`);
  } else {
    logger.info(context, `Error: ${error.message}`);
  }
}

/**
 * Main error handler middleware
 * Must be registered LAST in middleware chain
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Normalize error to AppError
  const error = normalizeError(err);

  // Log error
  logError(error, req);

  // Get request ID from logger (added by request logger middleware)
  const requestId = (req as any).id || req.headers['x-request-id'] as string;

  // Build response
  const response = buildErrorResponse(error, requestId);

  // Send response
  res.status(error.statusCode).json(response);
}

/**
 * 404 Not Found handler
 * Use this before the error handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(
    `Route ${req.method} ${req.path}`,
    ErrorCodes.GEN_NOT_FOUND
  );
  next(error);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await prisma.user.findMany();
 *   res.json(users);
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Default exports
 */
export default errorHandler;

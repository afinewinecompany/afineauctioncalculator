/**
 * Custom Error Classes for Application
 *
 * Structured error hierarchy with:
 * - HTTP status codes
 * - Machine-readable error codes
 * - Operational vs programmer error distinction
 * - Type-safe error handling
 */

/**
 * Base application error class
 * All custom errors should extend this
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);

    // Maintains proper stack trace for where error was thrown (V8 only)
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.details = details;

    // Set prototype explicitly for TypeScript
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      details: this.details,
    };
  }
}

/**
 * 400 Bad Request - Invalid input validation
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown, code: string = 'VAL_INVALID_INPUT') {
    super(message, 400, code, true, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', code: string = 'AUTH_REQUIRED') {
    super(message, 401, code, true);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', code: string = 'AUTH_INSUFFICIENT_PERMISSIONS') {
    super(message, 403, code, true);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', code: string = 'NOT_FOUND') {
    super(`${resource} not found`, 404, code, true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict - Resource already exists or conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(message, 409, code, true);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests, please try again later', code: string = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code, true);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 503 Service Unavailable - External service failure
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string, code: string = 'EXTERNAL_SERVICE_ERROR') {
    super(
      message || `External service (${service}) is currently unavailable`,
      503,
      code,
      true,
      { service }
    );
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * 500 Internal Server Error - Unexpected errors
 */
export class InternalError extends AppError {
  constructor(message: string = 'An unexpected error occurred', code: string = 'INTERNAL_ERROR', details?: unknown) {
    super(message, 500, code, false, details);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

/**
 * 400 Bad Request - Database operation errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, code: string = 'DATABASE_ERROR', details?: unknown) {
    super(message, 500, code, false, details);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is operational (expected/handled)
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Helper to create validation error from Zod errors
 */
export function createValidationError(zodError: any): ValidationError {
  const errors = zodError.errors.map((err: any) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return new ValidationError(
    'Validation failed',
    { errors },
    'VAL_INVALID_INPUT'
  );
}

/**
 * Authentication Middleware
 *
 * Provides middleware functions for protecting routes and extracting
 * user information from JWT tokens.
 */

import { Request, Response, NextFunction } from 'express';
import {
  verifyAccessToken,
  findUserById,
} from '../services/authService.js';
import { toAuthUser, AuthUser } from '../types/auth.js';

/**
 * Error codes for authentication failures
 */
const AUTH_ERRORS = {
  NO_TOKEN: {
    error: 'No token provided',
    code: 'AUTH_REQUIRED',
    message: 'Authorization header with Bearer token is required',
  },
  INVALID_FORMAT: {
    error: 'Invalid authorization format',
    code: 'AUTH_INVALID_FORMAT',
    message: 'Authorization header must be in format: Bearer <token>',
  },
  INVALID_TOKEN: {
    error: 'Invalid token',
    code: 'AUTH_INVALID_TOKEN',
    message: 'The provided token is invalid',
  },
  EXPIRED_TOKEN: {
    error: 'Token expired',
    code: 'TOKEN_EXPIRED',
    message: 'Your session has expired. Please login again or refresh your token.',
  },
  USER_NOT_FOUND: {
    error: 'User not found',
    code: 'AUTH_USER_NOT_FOUND',
    message: 'The user associated with this token no longer exists',
  },
} as const;

/**
 * Extract the Bearer token from the Authorization header
 *
 * @param authHeader - The Authorization header value
 * @returns The token string or null if not found/invalid
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Require authentication middleware
 *
 * Validates the JWT access token from the Authorization header,
 * looks up the user in the database, and attaches user info to the request.
 *
 * Returns 401 Unauthorized if:
 * - No Authorization header is present
 * - Token format is invalid
 * - Token is expired
 * - Token is invalid (bad signature, malformed, etc.)
 * - User no longer exists
 *
 * @example
 * ```typescript
 * router.get('/protected', requireAuth, (req, res) => {
 *   // req.user is guaranteed to exist here
 *   res.json({ user: req.user });
 * });
 * ```
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from header first, then fall back to query parameter
    // (query param is used by sendBeacon which doesn't support custom headers)
    const authHeader = req.headers.authorization;
    let token = extractBearerToken(authHeader);

    // Fall back to query parameter token (for sendBeacon support)
    if (!token && req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      if (!authHeader) {
        res.status(401).json(AUTH_ERRORS.NO_TOKEN);
      } else {
        res.status(401).json(AUTH_ERRORS.INVALID_FORMAT);
      }
      return;
    }

    // Verify the token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';

      if (message.includes('expired')) {
        res.status(401).json(AUTH_ERRORS.EXPIRED_TOKEN);
      } else {
        res.status(401).json(AUTH_ERRORS.INVALID_TOKEN);
      }
      return;
    }

    // Look up the user in the database
    const user = await findUserById(payload.userId);

    if (!user) {
      res.status(401).json(AUTH_ERRORS.USER_NOT_FOUND);
      return;
    }

    // Attach user info to request
    req.user = toAuthUser(user);
    req.tokenPayload = payload;

    next();
  } catch (error) {
    console.error('[Auth Middleware] Unexpected error:', error);
    res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR',
      message: 'An unexpected error occurred during authentication',
    });
  }
}

/**
 * Optional authentication middleware
 *
 * Attempts to validate the JWT access token if present,
 * but allows the request to proceed even if no token is provided.
 *
 * If a token IS provided but is invalid/expired, the request still proceeds
 * but req.user will be undefined.
 *
 * This is useful for endpoints that have different behavior for
 * authenticated vs unauthenticated users.
 *
 * @example
 * ```typescript
 * router.get('/posts', optionalAuth, (req, res) => {
 *   if (req.user) {
 *     // Show personalized content for logged-in user
 *   } else {
 *     // Show public content
 *   }
 * });
 * ```
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    const token = extractBearerToken(authHeader);

    // If no token, just continue without user
    if (!token) {
      next();
      return;
    }

    // Try to verify the token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      // Token invalid or expired - continue without user
      // This is intentional for optional auth
      next();
      return;
    }

    // Look up the user in the database
    const user = await findUserById(payload.userId);

    // If user found, attach to request
    if (user) {
      req.user = toAuthUser(user);
      req.tokenPayload = payload;
    }

    next();
  } catch (error) {
    // Don't fail for optional auth - just log and continue
    console.error('[Auth Middleware] Optional auth error:', error);
    next();
  }
}

/**
 * Helper to get the authenticated user from a request
 * Throws if user is not authenticated (use after requireAuth)
 *
 * @param req - Express request object
 * @returns The authenticated user
 * @throws Error if no user is attached to the request
 */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
  return req.user;
}

/**
 * Middleware factory to require specific subscription tiers
 *
 * @param allowedTiers - Array of subscription tiers that can access the route
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * router.get('/premium-feature', requireAuth, requireTier(['premium']), (req, res) => {
 *   // Only accessible by premium users
 * });
 * ```
 */
export function requireTier(allowedTiers: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(AUTH_ERRORS.NO_TOKEN);
      return;
    }

    if (!allowedTiers.includes(req.user.subscriptionTier)) {
      res.status(403).json({
        error: 'Insufficient subscription',
        code: 'SUBSCRIPTION_REQUIRED',
        message: `This feature requires one of the following subscription tiers: ${allowedTiers.join(', ')}`,
        requiredTiers: allowedTiers,
        currentTier: req.user.subscriptionTier,
      });
      return;
    }

    next();
  };
}

/**
 * Require admin role middleware
 *
 * Must be used AFTER requireAuth middleware.
 * Returns 403 Forbidden if user is not an admin.
 *
 * @example
 * ```typescript
 * router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
 *   // Only accessible by admin users
 * });
 * ```
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json(AUTH_ERRORS.NO_TOKEN);
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
      message: 'This endpoint requires administrator privileges',
    });
    return;
  }

  next();
}

/**
 * Middleware factory to require specific roles
 *
 * @param allowedRoles - Array of roles that can access the route
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * router.get('/moderator-panel', requireAuth, requireRole(['admin', 'moderator']), (req, res) => {
 *   // Accessible by admins and moderators
 * });
 * ```
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(AUTH_ERRORS.NO_TOKEN);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'ROLE_REQUIRED',
        message: `This endpoint requires one of the following roles: ${allowedRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
      return;
    }

    next();
  };
}

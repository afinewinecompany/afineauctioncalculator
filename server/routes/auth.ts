/**
 * Authentication Routes
 *
 * Handles user registration, login, token refresh, and logout.
 * All routes use Zod for request validation.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  isRefreshTokenValid,
  updateLastLogin,
  findUserByEmail,
  findUserById,
  createUser,
} from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import {
  toUserResponse,
  AuthResponse,
  TokenRefreshResponse,
} from '../types/auth.js';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/**
 * Password validation:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number');

/**
 * Registration request schema
 */
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
});

/**
 * Login request schema
 */
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Refresh token request schema
 */
const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate request body against a Zod schema
 */
function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

/**
 * Format Zod validation errors for response
 */
function formatValidationErrors(errors: z.ZodIssue[]): { field: string; message: string }[] {
  return errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/auth/register
 *
 * Create a new user account with email/password authentication.
 *
 * Request body:
 * - email: Valid email address
 * - password: Min 8 chars, 1 uppercase, 1 number
 * - name: Display name (1-100 chars)
 *
 * Response:
 * - 201: User created successfully with tokens
 * - 400: Validation error
 * - 409: Email already exists
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = validateBody(registerSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatValidationErrors(validation.errors),
      });
    }

    const { email, password, name } = validation.data;

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered',
        code: 'USER_EXISTS',
        message: 'An account with this email address already exists',
      });
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, name);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken } = generateRefreshToken(user);

    // Store refresh token in database
    await storeRefreshToken(user.id, refreshToken);

    // Prepare response
    const response: AuthResponse = {
      user: toUserResponse(user),
      accessToken,
      refreshToken,
    };

    console.log(`[Auth] User registered: ${user.email}`);

    return res.status(201).json(response);
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    return res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR',
      message: 'An unexpected error occurred during registration',
    });
  }
});

/**
 * POST /api/auth/login
 *
 * Authenticate a user with email/password.
 *
 * Request body:
 * - email: Email address
 * - password: Password
 *
 * Response:
 * - 200: Login successful with tokens
 * - 400: Validation error
 * - 401: Invalid credentials
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = validateBody(loginSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatValidationErrors(validation.errors),
      });
    }

    const { email, password } = validation.data;

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      // Use generic message to prevent email enumeration
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        message: 'The email or password you entered is incorrect',
      });
    }

    // Check if user has a password (might be OAuth-only user)
    if (!user.passwordHash) {
      return res.status(401).json({
        error: 'Invalid login method',
        code: 'OAUTH_ONLY',
        message: 'This account uses social login. Please sign in with Google.',
      });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        message: 'The email or password you entered is incorrect',
      });
    }

    // Update last login timestamp
    await updateLastLogin(user.id);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken } = generateRefreshToken(user);

    // Store refresh token in database
    await storeRefreshToken(user.id, refreshToken);

    // Prepare response
    const response: AuthResponse = {
      user: toUserResponse(user),
      accessToken,
      refreshToken,
    };

    console.log(`[Auth] User logged in: ${user.email}`);

    return res.status(200).json(response);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR',
      message: 'An unexpected error occurred during login',
    });
  }
});

/**
 * POST /api/auth/refresh
 *
 * Get a new access token using a refresh token.
 *
 * Request body:
 * - refreshToken: Valid refresh token
 *
 * Response:
 * - 200: New access token
 * - 400: Validation error
 * - 401: Invalid or expired refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = validateBody(refreshSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatValidationErrors(validation.errors),
      });
    }

    const { refreshToken } = validation.data;

    // Verify the JWT structure and signature
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
        message: message.includes('expired')
          ? 'Your session has expired. Please login again.'
          : 'The refresh token is invalid.',
      });
    }

    // Verify token exists in database (not revoked)
    const isValid = await isRefreshTokenValid(refreshToken);
    if (!isValid) {
      return res.status(401).json({
        error: 'Refresh token revoked',
        code: 'TOKEN_REVOKED',
        message: 'This refresh token has been revoked. Please login again.',
      });
    }

    // Find the user
    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        message: 'The user associated with this token no longer exists.',
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    const response: TokenRefreshResponse = {
      accessToken,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[Auth] Token refresh error:', error);
    return res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR',
      message: 'An unexpected error occurred during token refresh',
    });
  }
});

/**
 * POST /api/auth/logout
 *
 * Logout the current user by revoking their refresh token.
 * Requires authentication.
 *
 * Request body:
 * - refreshToken: The refresh token to revoke
 *
 * Response:
 * - 200: Logout successful
 * - 400: Validation error
 * - 401: Not authenticated
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = validateBody(refreshSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatValidationErrors(validation.errors),
      });
    }

    const { refreshToken } = validation.data;

    // Revoke the refresh token
    const revoked = await revokeRefreshToken(refreshToken);

    if (revoked) {
      console.log(`[Auth] User logged out: ${req.user?.email}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
      message: 'An unexpected error occurred during logout',
    });
  }
});

/**
 * GET /api/auth/me
 *
 * Get the current authenticated user's information.
 * Requires authentication.
 *
 * Response:
 * - 200: User information
 * - 401: Not authenticated
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    // User is guaranteed to exist after requireAuth
    const userId = req.user!.id;

    // Fetch fresh user data from database
    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        message: 'Your user account no longer exists',
      });
    }

    return res.status(200).json({
      user: toUserResponse(user),
    });
  } catch (error) {
    console.error('[Auth] Get current user error:', error);
    return res.status(500).json({
      error: 'Failed to get user',
      code: 'GET_USER_ERROR',
      message: 'An unexpected error occurred while fetching user information',
    });
  }
});

export default router;

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
  findOrCreateGoogleUser,
} from '../services/authService.js';
import { env } from '../config/env.js';
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

// =============================================================================
// GOOGLE OAUTH ROUTES
// =============================================================================

/**
 * GET /api/auth/google
 *
 * Redirect user to Google OAuth consent screen.
 * After authorization, Google redirects to the callback URL.
 */
router.get('/google', (req: Request, res: Response) => {
  // Check if Google OAuth is configured
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({
      error: 'Google OAuth not configured',
      code: 'OAUTH_NOT_CONFIGURED',
      message: 'Google OAuth is not available. Please use email/password login.',
    });
  }

  // Build the Google OAuth URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', env.GOOGLE_CALLBACK_URL || `${env.FRONTEND_URL}/auth/google/callback`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');

  // Redirect to Google
  return res.redirect(googleAuthUrl.toString());
});

/**
 * POST /api/auth/google/callback
 *
 * Exchange Google authorization code for tokens and user info.
 * Creates or updates user in database.
 *
 * Request body:
 * - code: Authorization code from Google
 *
 * Response:
 * - 200: Login successful with tokens
 * - 400: Invalid or missing code
 * - 500: OAuth exchange failed
 */
router.post('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        code: 'MISSING_CODE',
        message: 'Authorization code is required',
      });
    }

    // Check if Google OAuth is configured
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return res.status(501).json({
        error: 'Google OAuth not configured',
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not available.',
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: env.GOOGLE_CALLBACK_URL || `${env.FRONTEND_URL}/auth/google/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('[Auth] Google token exchange failed:', errorData);
      return res.status(400).json({
        error: 'OAuth failed',
        code: 'TOKEN_EXCHANGE_FAILED',
        message: 'Failed to exchange authorization code. Please try again.',
      });
    }

    const tokenData = await tokenResponse.json() as { access_token: string; id_token?: string };

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error('[Auth] Failed to get Google user info');
      return res.status(500).json({
        error: 'OAuth failed',
        code: 'USER_INFO_FAILED',
        message: 'Failed to retrieve user information from Google.',
      });
    }

    const googleUser = await userInfoResponse.json() as {
      id: string;
      email: string;
      name: string;
      picture?: string;
      verified_email: boolean;
    };

    if (!googleUser.email) {
      return res.status(400).json({
        error: 'OAuth failed',
        code: 'NO_EMAIL',
        message: 'Google account does not have an email address.',
      });
    }

    // Find or create user in database
    const user = await findOrCreateGoogleUser({
      email: googleUser.email,
      name: googleUser.name || googleUser.email.split('@')[0],
      picture: googleUser.picture,
      sub: googleUser.id,
    });

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

    console.log(`[Auth] User logged in via Google: ${user.email}`);

    return res.status(200).json(response);
  } catch (error) {
    console.error('[Auth] Google OAuth error:', error);
    return res.status(500).json({
      error: 'OAuth failed',
      code: 'OAUTH_ERROR',
      message: 'An unexpected error occurred during Google login.',
    });
  }
});

export default router;

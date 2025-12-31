/**
 * Authentication Routes
 *
 * Handles user registration, login, token refresh, logout, and password reset.
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
  generatePasswordResetToken,
  storePasswordResetToken,
  verifyPasswordResetToken,
  updatePassword,
} from '../services/authService.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { passwordResetLimiter } from '../middleware/rateLimiter.js';
import {
  toUserResponse,
  AuthResponse,
  TokenRefreshResponse,
} from '../types/auth.js';
import { logger, LoggerHelper } from '../services/logger.js';

const router = Router();

// =============================================================================
// SECURITY CONSTANTS
// =============================================================================

/**
 * Dummy bcrypt hash used for timing attack protection.
 *
 * When a user is not found during login, we still need to run bcrypt.compare()
 * to ensure consistent response times. Without this, an attacker could enumerate
 * valid email addresses by measuring response times:
 * - Fast response = user not found (no bcrypt)
 * - Slow response = user found (bcrypt runs)
 *
 * This hash was generated with cost factor 12 (same as production hashes)
 * using: await bcrypt.hash('dummy_password_for_timing_protection', 12)
 */
const DUMMY_PASSWORD_HASH = '$2a$12$K8HpHMKlWMBIJqRHkTz3/.wTBqPTnWL6P8KjHsXJd.HJvMdXKfGJu';

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

/**
 * Forgot password request schema
 */
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Reset password request schema
 */
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
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

    LoggerHelper.logAuth('user_registered', user.id, { email: user.email });

    return res.status(201).json(response);
  } catch (error) {
    logger.error({ error }, 'Registration error');
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

    // SECURITY: Timing attack protection for email enumeration
    // Always run bcrypt.compare() regardless of whether the user exists.
    // This ensures consistent response times whether the email is valid or not,
    // preventing attackers from enumerating valid email addresses via timing analysis.
    //
    // We use DUMMY_PASSWORD_HASH when:
    // 1. User does not exist
    // 2. User exists but has no password (OAuth-only account)
    const hashToCompare = user?.passwordHash || DUMMY_PASSWORD_HASH;
    const isValidPassword = await verifyPassword(password, hashToCompare);

    // Determine if this is an OAuth-only user (exists but has no password)
    const isOAuthOnlyUser = user && !user.passwordHash;

    // Check if user exists and has valid credentials
    // Note: We perform all checks after bcrypt to maintain constant time
    if (!user || !isValidPassword) {
      // For OAuth-only users, provide a more helpful error message
      // This is safe to disclose since the user already knows their email exists
      // (they created the account via OAuth)
      if (isOAuthOnlyUser) {
        return res.status(401).json({
          error: 'Invalid login method',
          code: 'OAUTH_ONLY',
          message: 'This account uses social login. Please sign in with Google.',
        });
      }

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

    LoggerHelper.logAuth('user_login', user.id, { email: user.email });

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'Login error');
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
    logger.error({ error }, 'Token refresh error');
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
 * Logout by revoking a refresh token.
 * Does NOT require authentication - validates the refresh token directly.
 * This allows clients to logout even if the access token has expired.
 *
 * Request body:
 * - refreshToken: The refresh token to revoke
 *
 * Response:
 * - 200: Logout successful
 * - 400: Validation error
 */
router.post('/logout', async (req: Request, res: Response) => {
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

    // Revoke the refresh token - this validates the token exists in the database
    const revoked = await revokeRefreshToken(refreshToken);

    if (revoked) {
      // Try to get user info from the token for logging (best effort)
      try {
        const payload = verifyRefreshToken(refreshToken);
        LoggerHelper.logAuth('user_logout', payload.userId, {});
      } catch {
        // Token might be invalid/expired, just log without user context
        LoggerHelper.logAuth('user_logout', 'unknown', {});
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Logout error');
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
    logger.error({ error }, 'Get current user error');
    return res.status(500).json({
      error: 'Failed to get user',
      code: 'GET_USER_ERROR',
      message: 'An unexpected error occurred while fetching user information',
    });
  }
});

// =============================================================================
// PASSWORD RESET ROUTES
// =============================================================================

/**
 * POST /api/auth/forgot-password
 *
 * Request a password reset link. Sends an email with a reset token.
 * Rate limited to prevent abuse.
 *
 * Request body:
 * - email: Email address of the account
 *
 * Response:
 * - 200: Always returns success (to prevent email enumeration)
 * - 400: Validation error
 * - 429: Rate limited
 */
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = validateBody(forgotPasswordSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatValidationErrors(validation.errors),
      });
    }

    const { email } = validation.data;

    // Find user by email
    const user = await findUserByEmail(email);

    // SECURITY: Always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      logger.info({ email }, 'Password reset requested for non-existent email');
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.',
      });
    }

    // Check if user is OAuth-only (no password to reset)
    if (!user.passwordHash) {
      logger.info({ email, userId: user.id }, 'Password reset requested for OAuth-only user');
      // Still return success to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.',
      });
    }

    // Generate reset token
    const { token, tokenHash } = generatePasswordResetToken();

    // Store the hashed token in the database (expires in 1 hour)
    await storePasswordResetToken(user.id, tokenHash, 60);

    // Build reset URL
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

    // TODO: Send email with reset link
    // For now, log the reset URL for development purposes
    logger.info({
      email,
      resetUrl,
      expiresIn: '1 hour',
    }, 'Password reset link generated (email not yet implemented)');

    LoggerHelper.logAuth('password_reset_requested', user.id, { email });

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.',
    });
  } catch (error) {
    logger.error({ error }, 'Forgot password error');
    return res.status(500).json({
      error: 'Password reset request failed',
      code: 'FORGOT_PASSWORD_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

/**
 * POST /api/auth/reset-password
 *
 * Reset password using a valid reset token.
 *
 * Request body:
 * - token: Password reset token from email
 * - password: New password (min 8 chars, 1 uppercase, 1 number)
 *
 * Response:
 * - 200: Password reset successful
 * - 400: Validation error or invalid/expired token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = validateBody(resetPasswordSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatValidationErrors(validation.errors),
      });
    }

    const { token, password } = validation.data;

    // Verify the reset token and get the user
    const user = await verifyPasswordResetToken(token);

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        code: 'INVALID_RESET_TOKEN',
        message: 'This password reset link is invalid or has expired. Please request a new one.',
      });
    }

    // Hash the new password
    const newPasswordHash = await hashPassword(password);

    // Update password and clear reset token
    await updatePassword(user.id, newPasswordHash);

    LoggerHelper.logAuth('password_reset_completed', user.id, { email: user.email });

    return res.status(200).json({
      success: true,
      message: 'Your password has been reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    logger.error({ error }, 'Reset password error');
    return res.status(500).json({
      error: 'Password reset failed',
      code: 'RESET_PASSWORD_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

// =============================================================================
// GOOGLE OAUTH ROUTES
// =============================================================================

/**
 * GET /api/auth/google/status
 *
 * Check if Google OAuth is configured on the server.
 * Used by frontend to show appropriate UI before attempting OAuth.
 *
 * Response:
 * - 200: { configured: boolean }
 */
router.get('/google/status', (req: Request, res: Response) => {
  const configured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  return res.status(200).json({
    configured,
    message: configured
      ? 'Google OAuth is available'
      : 'Google OAuth is not configured. Please use email/password authentication.',
  });
});

/**
 * GET /api/auth/google
 *
 * Redirect user to Google OAuth consent screen.
 * After authorization, Google redirects to the callback URL.
 */
router.get('/google', (req: Request, res: Response) => {
  try {
    // Check if Google OAuth is configured
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return res.status(501).json({
        error: 'Google OAuth not configured',
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not available. Please use email/password login.',
      });
    }

    // Build the Google OAuth URL
    const redirectUri = env.GOOGLE_CALLBACK_URL || `${env.FRONTEND_URL}/auth/google/callback`;
    logger.debug({ redirectUri }, 'Google OAuth redirect_uri');

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    const finalUrl = googleAuthUrl.toString();
    logger.debug('Redirecting to Google OAuth');

    // Redirect to Google
    return res.redirect(finalUrl);
  } catch (error) {
    logger.error({ error }, 'Error in /google route');
    return res.status(500).json({
      error: 'OAuth redirect failed',
      code: 'OAUTH_REDIRECT_ERROR',
      message: 'Failed to initiate Google login.',
    });
  }
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
    logger.debug({ codePresent: !!code }, 'Google callback received');

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
    const redirectUri = env.GOOGLE_CALLBACK_URL || `${env.FRONTEND_URL}/auth/google/callback`;
    logger.debug({ redirectUri }, 'Token exchange redirect_uri');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      logger.error({ errorData }, 'Google token exchange failed');
      return res.status(400).json({
        error: 'OAuth failed',
        code: 'TOKEN_EXCHANGE_FAILED',
        message: 'Failed to exchange authorization code. Please try again.',
        details: errorData,
      });
    }

    const tokenData = await tokenResponse.json() as { access_token: string; id_token?: string };

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      logger.error('Failed to get Google user info');
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
    logger.debug({ email: googleUser.email }, 'Looking up/creating user');
    const user = await findOrCreateGoogleUser({
      email: googleUser.email,
      name: googleUser.name || googleUser.email.split('@')[0],
      picture: googleUser.picture,
      sub: googleUser.id,
    });
    logger.debug({ userId: user.id }, 'User found/created');

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken } = generateRefreshToken(user);

    // Store refresh token in database
    await storeRefreshToken(user.id, refreshToken);
    logger.debug('Tokens generated and stored');

    // Prepare response
    const response: AuthResponse = {
      user: toUserResponse(user),
      accessToken,
      refreshToken,
    };

    LoggerHelper.logAuth('google_login', user.id, { email: user.email });

    return res.status(200).json(response);
  } catch (error) {
    logger.error({ error }, 'Google OAuth error');
    return res.status(500).json({
      error: 'OAuth failed',
      code: 'OAUTH_ERROR',
      message: 'An unexpected error occurred during Google login.',
    });
  }
});

export default router;

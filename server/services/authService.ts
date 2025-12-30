/**
 * Authentication Service
 *
 * Handles password hashing, JWT generation/verification, and token management.
 * Uses bcrypt for password hashing and jsonwebtoken for JWT operations.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db';
import { jwtConfig } from '../config/env';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  AuthUser,
} from '../types/auth';

// =============================================================================
// PASSWORD HASHING
// =============================================================================

/**
 * Hash a password using bcrypt with 12 rounds
 *
 * @param password - Plain text password to hash
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 *
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// =============================================================================
// JWT TOKEN GENERATION
// =============================================================================

/**
 * Generate an access token for a user
 *
 * @param user - User object with id and email
 * @returns JWT access token string (15 minute expiry)
 */
export function generateAccessToken(user: { id: string; email: string }): string {
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    type: 'access',
  };

  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.accessExpiry,
  });
}

/**
 * Generate a refresh token for a user
 *
 * @param user - User object with id
 * @returns Object containing the JWT refresh token and tokenId (7 day expiry)
 */
export function generateRefreshToken(user: { id: string }): { token: string; tokenId: string } {
  const tokenId = crypto.randomUUID();

  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    userId: user.id,
    tokenId,
    type: 'refresh',
  };

  const token = jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiry,
  });

  return { token, tokenId };
}

// =============================================================================
// JWT TOKEN VERIFICATION
// =============================================================================

/**
 * Verify and decode an access token
 *
 * @param token - JWT access token string
 * @returns Decoded token payload
 * @throws Error if token is invalid, expired, or wrong type
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as AccessTokenPayload;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Verify and decode a refresh token
 *
 * @param token - JWT refresh token string
 * @returns Decoded token payload
 * @throws Error if token is invalid, expired, or wrong type
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, jwtConfig.refreshSecret) as RefreshTokenPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

// =============================================================================
// REFRESH TOKEN DATABASE OPERATIONS
// =============================================================================

/**
 * Hash a token for secure storage in the database
 *
 * @param token - Raw token string
 * @returns SHA-256 hash of the token
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Calculate expiry date from JWT expiry string (e.g., '7d', '15m')
 *
 * @param expiry - JWT expiry string
 * @returns Date object for expiry time
 */
function calculateExpiryDate(expiry: string): Date {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    // Default to 7 days if parsing fails
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + value * multipliers[unit]);
}

/**
 * Store a refresh token in the database
 *
 * @param userId - User ID
 * @param token - Raw refresh token (will be hashed before storage)
 */
export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = calculateExpiryDate(jwtConfig.refreshExpiry);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

/**
 * Verify a refresh token exists in the database and is not expired
 *
 * @param token - Raw refresh token
 * @returns True if token exists and is valid, false otherwise
 */
export async function isRefreshTokenValid(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!storedToken) {
    return false;
  }

  // Check if token has expired
  if (storedToken.expiresAt < new Date()) {
    // Clean up expired token
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });
    return false;
  }

  return true;
}

/**
 * Revoke a specific refresh token
 *
 * @param token - Raw refresh token to revoke
 * @returns True if token was revoked, false if it didn't exist
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  try {
    await prisma.refreshToken.delete({
      where: { tokenHash },
    });
    return true;
  } catch (error) {
    // Token doesn't exist (already revoked or never existed)
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 *
 * @param userId - User ID
 * @returns Number of tokens revoked
 */
export async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { userId },
  });

  return result.count;
}

/**
 * Clean up expired refresh tokens (maintenance task)
 *
 * @returns Number of tokens deleted
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

// =============================================================================
// USER OPERATIONS
// =============================================================================

/**
 * Update user's last login timestamp
 *
 * @param userId - User ID
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

/**
 * Find user by email
 *
 * @param email - User email address
 * @returns User object or null if not found
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

/**
 * Find user by ID
 *
 * @param id - User ID
 * @returns User object or null if not found
 */
export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  });
}

/**
 * Create a new user with email/password authentication
 *
 * @param email - User email address
 * @param passwordHash - Hashed password
 * @param name - User display name
 * @returns Created user object
 */
export async function createUser(email: string, passwordHash: string, name: string) {
  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name,
      authProvider: 'email',
      lastLoginAt: new Date(),
    },
  });
}

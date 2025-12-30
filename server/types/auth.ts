/**
 * Authentication Types
 *
 * Type definitions for authentication-related data structures
 */

import { User } from '@prisma/client';

/**
 * User information attached to authenticated requests
 * Excludes sensitive fields like passwordHash
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  profilePictureUrl: string | null;
  authProvider: string;
  subscriptionTier: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * JWT Access Token Payload
 */
export interface AccessTokenPayload {
  userId: string;
  email: string;
  type: 'access';
  iat?: number;
  exp?: number;
}

/**
 * JWT Refresh Token Payload
 */
export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Generic token payload for verification
 */
export type TokenPayload = AccessTokenPayload | RefreshTokenPayload;

/**
 * Login request body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Registration request body
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

/**
 * Token refresh request body
 */
export interface RefreshRequest {
  refreshToken: string;
}

/**
 * User response (safe to return to client)
 */
export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  profilePictureUrl: string | null;
  authProvider: string;
  subscriptionTier: string;
  createdAt: string;
  lastLoginAt: string | null;
}

/**
 * Authentication response with tokens
 */
export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

/**
 * Token refresh response (only new access token)
 */
export interface TokenRefreshResponse {
  accessToken: string;
}

/**
 * Converts a Prisma User to a safe UserResponse
 */
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profilePictureUrl: user.profilePictureUrl,
    authProvider: user.authProvider,
    subscriptionTier: user.subscriptionTier,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
  };
}

/**
 * Converts a Prisma User to AuthUser (for request attachment)
 */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profilePictureUrl: user.profilePictureUrl,
    authProvider: user.authProvider,
    subscriptionTier: user.subscriptionTier,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tokenPayload?: AccessTokenPayload;
    }
  }
}

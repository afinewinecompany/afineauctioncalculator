/**
 * Authentication API Client
 * Handles all auth-related API calls to the backend
 */

// Get API base URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || '';
const AUTH_BASE = `${API_URL}/api/auth`;

// Token storage keys
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// Types
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  profilePictureUrl: string | null;
  authProvider: 'email' | 'google';
  subscriptionTier: 'free' | 'premium';
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Error types
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Token management
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Helper to make authenticated requests
async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

// Handle API errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new AuthError(
      data.error || 'An error occurred',
      data.code || 'UNKNOWN_ERROR',
      response.status
    );
  }
  return response.json();
}

/**
 * Register a new user with email and password
 */
export async function register(data: RegisterRequest): Promise<LoginResponse> {
  const response = await fetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const result = await handleResponse<LoginResponse>(response);
  setTokens(result.accessToken, result.refreshToken);
  return result;
}

/**
 * Login with email and password
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const result = await handleResponse<LoginResponse>(response);
  setTokens(result.accessToken, result.refreshToken);
  return result;
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new AuthError('No refresh token available', 'NO_REFRESH_TOKEN', 401);
  }

  const response = await fetch(`${AUTH_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const result = await handleResponse<{ accessToken: string }>(response);
  // Only update the access token, keep the existing refresh token
  localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
  return result.accessToken;
}

/**
 * Logout - revokes refresh token on server
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  // Clear tokens locally first
  clearTokens();

  // Then revoke on server (fire and forget - don't fail if server is down)
  if (refreshToken) {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore server errors during logout
    }
  }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const response = await authFetch(`${AUTH_BASE}/me`);
  const result = await handleResponse<{ user: AuthUser }>(response);
  return result.user;
}

/**
 * Check if user is authenticated (has valid tokens)
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Google OAuth - redirect to Google login
 */
export function initiateGoogleLogin(): void {
  // Redirect to backend OAuth endpoint
  window.location.href = `${AUTH_BASE}/google`;
}

/**
 * Handle Google OAuth callback
 * Called when user is redirected back from Google with auth code
 */
export async function handleGoogleCallback(code: string): Promise<LoginResponse> {
  const response = await fetch(`${AUTH_BASE}/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  const result = await handleResponse<LoginResponse>(response);
  setTokens(result.accessToken, result.refreshToken);
  return result;
}

/**
 * Create an authenticated fetch wrapper that auto-refreshes tokens
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let response = await authFetch(url, options);

  // If unauthorized, try to refresh token and retry
  if (response.status === 401) {
    try {
      await refreshAccessToken();
      response = await authFetch(url, options);
    } catch {
      // Refresh failed, user needs to login again
      clearTokens();
      throw new AuthError('Session expired. Please login again.', 'SESSION_EXPIRED', 401);
    }
  }

  return response;
}

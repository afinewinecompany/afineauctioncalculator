/**
 * Authentication API Client
 * Handles all auth-related API calls to the backend
 */

// Get API base URL from environment variables
// Ensure the URL has a protocol prefix
function getApiUrl(): string {
  const rawUrl = import.meta.env.VITE_API_URL;
  const isDev = import.meta.env.DEV;

  // In production, VITE_API_URL must be configured
  if (!rawUrl && !isDev) {
    throw new Error(
      'VITE_API_URL environment variable is not configured. ' +
      'This is required in production. Please set VITE_API_URL to your API server URL ' +
      '(e.g., https://api.example.com).'
    );
  }

  // In development, warn if not set but allow empty string for Vite proxy
  if (!rawUrl && isDev) {
    console.warn(
      '[authApi] VITE_API_URL is not set. Using relative URLs which will be proxied by Vite. ' +
      'If you see API errors, ensure your Vite proxy is configured correctly in vite.config.ts.'
    );
    return '';
  }

  // Ensure the URL has a protocol prefix
  let url = rawUrl || '';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

const API_URL = getApiUrl();
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

// Token refresh mutex to prevent concurrent refresh attempts
let refreshPromise: Promise<string> | null = null;

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
 * Uses a mutex to prevent concurrent refresh attempts - multiple callers
 * will await the same promise if a refresh is already in progress
 */
export async function refreshAccessToken(): Promise<string> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    if (import.meta.env.DEV) {
      console.log('[authApi] Token refresh already in progress, waiting...');
    }
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    if (import.meta.env.DEV) {
      console.error('[authApi] No refresh token in localStorage');
    }
    throw new AuthError('No refresh token available', 'NO_REFRESH_TOKEN', 401);
  }

  // Create the refresh promise and store it
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${AUTH_BASE}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (import.meta.env.DEV) {
          console.error('[authApi] Token refresh failed:', response.status, errorData);
        }
        throw new AuthError(
          errorData.message || 'Token refresh failed',
          errorData.code || 'REFRESH_FAILED',
          response.status
        );
      }

      const result = await response.json() as { accessToken: string };
      // Only update the access token, keep the existing refresh token
      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      if (import.meta.env.DEV) {
        console.log('[authApi] Token refreshed successfully');
      }
      return result.accessToken;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      if (import.meta.env.DEV) {
        console.error('[authApi] Token refresh error:', error);
      }
      throw new AuthError('Token refresh failed', 'REFRESH_ERROR', 401);
    } finally {
      // Clear the mutex after completion (success or failure)
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
 * Uses authenticatedFetch to auto-refresh tokens if expired
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const response = await authenticatedFetch(`${AUTH_BASE}/me`);
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
  // Check if we have a token before making the request
  const token = getAccessToken();
  if (!token) {
    if (import.meta.env.DEV) {
      console.error('[authApi] No access token available for authenticated request to:', url);
    }
    throw new AuthError('No authentication token available. Please login.', 'NO_TOKEN', 401);
  }

  let response = await authFetch(url, options);

  // If unauthorized, try to refresh token and retry
  if (response.status === 401) {
    if (import.meta.env.DEV) {
      console.log('[authApi] Got 401, attempting token refresh for:', url);
    }
    try {
      await refreshAccessToken();
      response = await authFetch(url, options);
    } catch (refreshError) {
      // Refresh failed, user needs to login again
      if (import.meta.env.DEV) {
        console.error('[authApi] Token refresh failed:', refreshError);
      }
      clearTokens();
      throw new AuthError('Session expired. Please login again.', 'SESSION_EXPIRED', 401);
    }
  }

  return response;
}

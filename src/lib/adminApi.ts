/**
 * Admin API Client
 * Handles all admin-related API calls to the backend
 */

import { getAccessToken, refreshAccessToken, AuthError } from './authApi';
import type {
  AdminStats,
  AdminUserEntry,
  AdminUserDetail,
  ErrorLogEntry,
  AdminPagination,
  ErrorLogFilters,
} from './types';

// Get API base URL from environment variables
function getApiUrl(): string {
  const rawUrl = import.meta.env.VITE_API_URL;
  const isDev = import.meta.env.DEV;

  if (!rawUrl && !isDev) {
    throw new Error('VITE_API_URL environment variable is not configured.');
  }

  if (!rawUrl && isDev) {
    return '';
  }

  let url = rawUrl || '';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

const API_URL = getApiUrl();
const ADMIN_BASE = `${API_URL}/api/admin`;

/**
 * Make an authenticated request to the admin API
 * Automatically refreshes token if expired
 */
async function adminFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();

  if (!token) {
    throw new AuthError('Not authenticated', 'AUTH_REQUIRED', 401);
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  let response = await fetch(`${ADMIN_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // If token expired, try to refresh and retry
  if (response.status === 401) {
    try {
      const newToken = await refreshAccessToken();
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${ADMIN_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch {
      throw new AuthError('Session expired', 'TOKEN_EXPIRED', 401);
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new AuthError(
      data.error || data.message || 'Admin API error',
      data.code || 'ADMIN_ERROR',
      response.status
    );
  }

  return response.json();
}

// =============================================================================
// STATS
// =============================================================================

/**
 * Fetch platform statistics for admin dashboard
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  return adminFetch<AdminStats>('/stats');
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export interface UsersResponse {
  users: AdminUserEntry[];
  pagination: AdminPagination;
}

/**
 * Fetch paginated list of users
 */
export async function fetchUsers(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<UsersResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) {
    params.append('search', search);
  }

  return adminFetch<UsersResponse>(`/users?${params.toString()}`);
}

/**
 * Fetch detailed user information
 */
export async function fetchUserDetail(userId: string): Promise<{ user: AdminUserDetail }> {
  return adminFetch<{ user: AdminUserDetail }>(`/users/${userId}`);
}

/**
 * Update a user's role
 */
export async function updateUserRole(
  userId: string,
  role: 'user' | 'admin'
): Promise<{ success: boolean; user: AdminUserEntry; message: string }> {
  return adminFetch(`/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

// =============================================================================
// ERROR LOGS
// =============================================================================

export interface ErrorsResponse {
  errors: ErrorLogEntry[];
  pagination: AdminPagination;
}

/**
 * Fetch paginated list of error logs
 */
export async function fetchErrorLogs(
  page: number = 1,
  limit: number = 20,
  filters?: ErrorLogFilters
): Promise<ErrorsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (filters?.source && filters.source !== 'all') {
    params.append('source', filters.source);
  }
  if (filters?.severity && filters.severity !== 'all') {
    params.append('severity', filters.severity);
  }
  if (filters?.resolved && filters.resolved !== 'all') {
    params.append('resolved', filters.resolved);
  }
  if (filters?.startDate) {
    params.append('startDate', filters.startDate);
  }
  if (filters?.endDate) {
    params.append('endDate', filters.endDate);
  }

  return adminFetch<ErrorsResponse>(`/errors?${params.toString()}`);
}

/**
 * Fetch detailed error log
 */
export async function fetchErrorDetail(errorId: string): Promise<{ error: ErrorLogEntry }> {
  return adminFetch<{ error: ErrorLogEntry }>(`/errors/${errorId}`);
}

/**
 * Mark an error as resolved
 */
export async function resolveError(
  errorId: string
): Promise<{ success: boolean; error: { id: string; resolved: boolean; resolvedAt: string } }> {
  return adminFetch(`/errors/${errorId}/resolve`, {
    method: 'PUT',
  });
}

/**
 * Mark an error as unresolved (reopen)
 */
export async function unresolveError(
  errorId: string
): Promise<{ success: boolean; error: { id: string; resolved: boolean } }> {
  return adminFetch(`/errors/${errorId}/unresolve`, {
    method: 'PUT',
  });
}

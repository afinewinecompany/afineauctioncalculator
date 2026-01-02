/**
 * Notifications API Client
 * Handles SMS notification settings and team selection
 */

import { getAccessToken } from './authApi';

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
const NOTIFICATIONS_BASE = `${API_URL}/api/notifications`;

// Types
export interface NotificationSettings {
  phoneNumber: string | null;
  selectedTeamName: string | null;
  selectedRoomId: string | null;
  smsNotificationsEnabled: boolean;
  smsServiceAvailable: boolean;
}

export interface NotificationLogEntry {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
}

// Error class
export class NotificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

// Helper to make authenticated requests
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();

  if (!token) {
    throw new NotificationError('Not authenticated', 'AUTH_REQUIRED', 401);
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new NotificationError(
      data.message || data.error || 'Request failed',
      data.code || 'UNKNOWN_ERROR',
      response.status
    );
  }

  return response;
}

/**
 * Get current notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await authFetch(`${NOTIFICATIONS_BASE}/settings`);
  return response.json();
}

/**
 * Update phone number
 */
export async function updatePhoneNumber(phoneNumber: string): Promise<void> {
  await authFetch(`${NOTIFICATIONS_BASE}/phone`, {
    method: 'PUT',
    body: JSON.stringify({ phoneNumber }),
  });
}

/**
 * Remove phone number
 */
export async function removePhoneNumber(): Promise<void> {
  await authFetch(`${NOTIFICATIONS_BASE}/phone`, {
    method: 'DELETE',
  });
}

/**
 * Select team to watch for notifications
 */
export async function selectTeam(teamName: string, roomId: string): Promise<void> {
  await authFetch(`${NOTIFICATIONS_BASE}/team`, {
    method: 'PUT',
    body: JSON.stringify({ teamName, roomId }),
  });
}

/**
 * Clear team selection
 */
export async function clearTeamSelection(): Promise<void> {
  await authFetch(`${NOTIFICATIONS_BASE}/team`, {
    method: 'DELETE',
  });
}

/**
 * Update SMS notification preferences
 */
export async function updateSMSPreferences(enabled: boolean): Promise<void> {
  await authFetch(`${NOTIFICATIONS_BASE}/preferences`, {
    method: 'PUT',
    body: JSON.stringify({ smsNotificationsEnabled: enabled }),
  });
}

/**
 * Send test SMS
 */
export async function sendTestSMS(): Promise<{ success: boolean; message: string }> {
  const response = await authFetch(`${NOTIFICATIONS_BASE}/test`, {
    method: 'POST',
  });
  return response.json();
}

/**
 * Get notification history
 */
export async function getNotificationHistory(limit = 20): Promise<{
  notifications: NotificationLogEntry[];
  count: number;
}> {
  const response = await authFetch(`${NOTIFICATIONS_BASE}/history?limit=${limit}`);
  return response.json();
}

/**
 * Check if SMS service is available
 */
export async function checkSMSStatus(): Promise<{
  smsServiceAvailable: boolean;
  provider: string | null;
}> {
  const response = await authFetch(`${NOTIFICATIONS_BASE}/status`);
  return response.json();
}

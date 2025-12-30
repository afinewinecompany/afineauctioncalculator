/**
 * Leagues API Client
 * Handles all league-related API calls to the backend for persistent storage
 */

import { SavedLeague, LeagueSettings } from './types';
import { authenticatedFetch, AuthError } from './authApi';

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
const LEAGUES_BASE = `${API_URL}/api/leagues`;

// Error types
export class LeagueApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'LeagueApiError';
  }
}

// Handle API errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new LeagueApiError(
      data.error || data.message || 'An error occurred',
      data.code || 'UNKNOWN_ERROR',
      response.status
    );
  }
  return response.json();
}

/**
 * Fetch all leagues for the current user
 * Returns leagues stored in the database
 */
export async function fetchLeagues(): Promise<SavedLeague[]> {
  try {
    const response = await authenticatedFetch(LEAGUES_BASE);
    const result = await handleResponse<{ leagues: SavedLeague[] }>(response);
    return result.leagues;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('[leaguesApi] Failed to fetch leagues:', error);
    throw new LeagueApiError(
      'Failed to fetch leagues',
      'FETCH_ERROR',
      500
    );
  }
}

/**
 * Fetch a single league by ID
 */
export async function fetchLeague(id: string): Promise<SavedLeague> {
  try {
    const response = await authenticatedFetch(`${LEAGUES_BASE}/${id}`);
    const result = await handleResponse<{ league: SavedLeague }>(response);
    return result.league;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('[leaguesApi] Failed to fetch league:', error);
    throw new LeagueApiError(
      'Failed to fetch league',
      'FETCH_ERROR',
      500
    );
  }
}

/**
 * Create a new league in the database
 */
export async function createLeague(league: SavedLeague): Promise<SavedLeague> {
  try {
    const response = await authenticatedFetch(LEAGUES_BASE, {
      method: 'POST',
      body: JSON.stringify({
        leagueName: league.leagueName,
        settings: league.settings,
        status: league.status,
        createdAt: league.createdAt,
        lastModified: league.lastModified,
      }),
    });
    const result = await handleResponse<{ league: SavedLeague }>(response);
    return result.league;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('[leaguesApi] Failed to create league:', error);
    throw new LeagueApiError(
      'Failed to create league',
      'CREATE_ERROR',
      500
    );
  }
}

/**
 * Update an existing league in the database
 */
export async function updateLeague(id: string, league: Partial<SavedLeague>): Promise<SavedLeague> {
  try {
    const response = await authenticatedFetch(`${LEAGUES_BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        leagueName: league.leagueName,
        settings: league.settings,
        status: league.status,
        lastModified: new Date().toISOString(),
      }),
    });
    const result = await handleResponse<{ league: SavedLeague }>(response);
    return result.league;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('[leaguesApi] Failed to update league:', error);
    throw new LeagueApiError(
      'Failed to update league',
      'UPDATE_ERROR',
      500
    );
  }
}

/**
 * Delete a league from the database
 */
export async function deleteLeague(id: string): Promise<void> {
  try {
    const response = await authenticatedFetch(`${LEAGUES_BASE}/${id}`, {
      method: 'DELETE',
    });
    await handleResponse<{ success: boolean }>(response);
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('[leaguesApi] Failed to delete league:', error);
    throw new LeagueApiError(
      'Failed to delete league',
      'DELETE_ERROR',
      500
    );
  }
}

/**
 * Sync local leagues to the backend
 * Used when user has leagues in localStorage that need to be persisted
 */
export async function syncLeaguesToBackend(localLeagues: SavedLeague[]): Promise<SavedLeague[]> {
  const syncedLeagues: SavedLeague[] = [];

  for (const league of localLeagues) {
    try {
      // Check if this is a local-only league (ID starts with 'league-')
      // These need to be created on the backend
      if (league.id.startsWith('league-')) {
        const created = await createLeague(league);
        syncedLeagues.push({
          ...league,
          id: created.id, // Use backend-generated ID
        });
      } else {
        // Already has a backend ID, just update
        const updated = await updateLeague(league.id, league);
        syncedLeagues.push(updated);
      }
    } catch (error) {
      console.error('[leaguesApi] Failed to sync league:', league.leagueName, error);
      // Keep the local version if sync fails
      syncedLeagues.push(league);
    }
  }

  return syncedLeagues;
}

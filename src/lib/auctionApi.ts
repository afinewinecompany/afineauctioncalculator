import type {
  ScrapedAuctionData,
  AuctionSyncResult,
  Player,
  LeagueSettings,
} from './types';

const API_BASE = '/api/auction';
const PROJECTIONS_BASE = '/api/projections';

// Types for projection API responses
export interface ProjectionMetadata {
  system: string;
  fetchedAt: string;
  expiresAt?: string;
  playerCount: number;
  hitterCount: number;
  pitcherCount: number;
}

export interface NormalizedProjection {
  externalId: string;
  mlbamId: number;
  name: string;
  team: string;
  positions: string[];
  playerType: 'hitter' | 'pitcher';
  hitting?: {
    games: number;
    atBats: number;
    plateAppearances: number;
    runs: number;
    hits: number;
    singles: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    rbi: number;
    stolenBases: number;
    caughtStealing: number;
    walks: number;
    strikeouts: number;
    battingAvg: number;
    onBasePct: number;
    sluggingPct: number;
    ops: number;
    wOBA: number;
    wrcPlus: number;
    war: number;
  };
  pitching?: {
    games: number;
    gamesStarted: number;
    inningsPitched: number;
    wins: number;
    losses: number;
    saves: number;
    holds: number;
    hitsAllowed: number;
    earnedRuns: number;
    homeRunsAllowed: number;
    walks: number;
    strikeouts: number;
    era: number;
    whip: number;
    k9: number;
    bb9: number;
    fip: number;
    war: number;
  };
}

export interface ProjectionsResponse {
  metadata: ProjectionMetadata;
  projections: NormalizedProjection[];
  fromCache: boolean;
}

export interface PlayerWithValue extends NormalizedProjection {
  auctionValue: number;
  sgpValue?: number;
  pointsValue?: number;
  tier: number;
  isInDraftPool: boolean;
}

export interface CalculatedValuesResponse {
  projectionSystem: string;
  calculatedAt: string;
  leagueSummary: {
    numTeams: number;
    budgetPerTeam: number;
    totalBudget: number;
    scoringType: string;
    draftablePoolSize: number;
    hitterPoolSize: number;
    pitcherPoolSize: number;
    hitterBudget: number;
    pitcherBudget: number;
  };
  players: PlayerWithValue[];
}

/**
 * Fetches raw auction data from Couch Managers
 */
export async function fetchAuctionData(roomId: string): Promise<ScrapedAuctionData> {
  const response = await fetch(`${API_BASE}/${roomId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Auction room ${roomId} not found`);
    }
    throw new Error('Failed to fetch auction data');
  }

  return response.json();
}

/**
 * Syncs auction data with player projections and calculates inflation.
 * This is the main endpoint for the DraftRoom to use.
 */
export async function syncAuction(
  roomId: string,
  players: Player[],
  settings: LeagueSettings
): Promise<AuctionSyncResult> {
  // Transform players to the format expected by the API
  const projections = players.map(p => ({
    id: p.id,
    name: p.name,
    team: p.team,
    positions: p.positions,
    projectedValue: p.projectedValue,
  }));

  // Calculate total roster spots
  const totalRosterSpots = Object.values(settings.rosterSpots).reduce(
    (sum, count) => sum + count,
    0
  );

  const response = await fetch(`${API_BASE}/${roomId}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projections,
      leagueConfig: {
        numTeams: settings.numTeams,
        budgetPerTeam: settings.budgetPerTeam,
        totalRosterSpots,
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Auction room ${roomId} not found`);
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to sync auction data');
  }

  return response.json();
}

/**
 * Lightweight sync that uses server-cached projections instead of sending full player list.
 * Much smaller payload - only sends league config and projection system.
 */
export async function syncAuctionLite(
  roomId: string,
  settings: LeagueSettings
): Promise<AuctionSyncResult> {
  // Calculate total roster spots
  const totalRosterSpots = Object.values(settings.rosterSpots).reduce(
    (sum, count) => sum + count,
    0
  );

  const response = await fetch(`${API_BASE}/${roomId}/sync-lite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectionSystem: settings.projectionSystem || 'steamer',
      leagueConfig: {
        numTeams: settings.numTeams,
        budgetPerTeam: settings.budgetPerTeam,
        totalRosterSpots,
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Auction room ${roomId} not found`);
    }
    if (response.status === 503) {
      // No cached projections - fall back to regular sync would need player data
      throw new Error('No cached projections available. Please reload projections.');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to sync auction data');
  }

  return response.json();
}

/**
 * Fetches only the current auction info (lightweight endpoint for quick updates)
 */
export async function fetchCurrentAuction(roomId: string): Promise<{
  draftedPlayers: ScrapedAuctionData['players'];
  currentAuction?: ScrapedAuctionData['currentAuction'];
  totalMoneySpent: number;
}> {
  const response = await fetch(`${API_BASE}/${roomId}/current`);

  if (!response.ok) {
    throw new Error('Failed to fetch current auction');
  }

  return response.json();
}

/**
 * Normalizes a player name for matching (client-side utility)
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats the time since last sync for display
 */
export function formatLastSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'Never';

  const syncDate = new Date(lastSyncAt);
  const now = new Date();
  const diffMs = now.getTime() - syncDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  return syncDate.toLocaleTimeString();
}

// =============================================================================
// PROJECTIONS API
// =============================================================================

/**
 * Fetches projections for a given system (steamer, batx, ja)
 * Uses 24-hour cache on the server
 */
export async function fetchProjections(
  system: 'steamer' | 'batx' | 'ja' = 'steamer'
): Promise<ProjectionsResponse> {
  const response = await fetch(`${PROJECTIONS_BASE}/${system}`);

  if (!response.ok) {
    if (response.status === 501) {
      throw new Error(`${system} projections are not yet implemented`);
    }
    throw new Error('Failed to fetch projections');
  }

  return response.json();
}

/**
 * Calculates auction values for a league based on projections and settings
 * This is the main function to use when setting up a league
 */
export async function calculateLeagueAuctionValues(
  leagueSettings: LeagueSettings
): Promise<CalculatedValuesResponse> {
  const response = await fetch(`${PROJECTIONS_BASE}/calculate-values`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectionSystem: leagueSettings.projectionSystem,
      leagueSettings,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to calculate auction values');
  }

  return response.json();
}

/**
 * Forces a refresh of projections cache for a system
 */
export async function refreshProjections(
  system: 'steamer' | 'batx' | 'ja' = 'steamer'
): Promise<{ success: boolean; playerCount: number; refreshedAt: string }> {
  const response = await fetch(`${PROJECTIONS_BASE}/${system}/refresh`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to refresh projections');
  }

  return response.json();
}

/**
 * Gets the cache status for a projection system
 */
export async function getProjectionsCacheStatus(
  system: 'steamer' | 'batx' | 'ja' = 'steamer'
): Promise<{
  system: string;
  exists: boolean;
  expired: boolean;
  metadata: ProjectionMetadata | null;
}> {
  const response = await fetch(`${PROJECTIONS_BASE}/${system}/status`);

  if (!response.ok) {
    throw new Error('Failed to get cache status');
  }

  return response.json();
}

/**
 * Converts calculated values to the Player format used by the draft room
 */
export function convertToPlayers(
  calculatedValues: CalculatedValuesResponse
): Player[] {
  return calculatedValues.players.map((p) => {
    const projectedStats: Player['projectedStats'] = {};

    if (p.hitting) {
      projectedStats.HR = p.hitting.homeRuns;
      projectedStats.RBI = p.hitting.rbi;
      projectedStats.SB = p.hitting.stolenBases;
      projectedStats.AVG = p.hitting.battingAvg;
      projectedStats.R = p.hitting.runs;
      projectedStats.H = p.hitting.hits;
      projectedStats.OBP = p.hitting.onBasePct;
      projectedStats.SLG = p.hitting.sluggingPct;
    }

    if (p.pitching) {
      projectedStats.W = p.pitching.wins;
      projectedStats.K = p.pitching.strikeouts;
      projectedStats.ERA = p.pitching.era;
      projectedStats.WHIP = p.pitching.whip;
      projectedStats.SV = p.pitching.saves;
      projectedStats.IP = p.pitching.inningsPitched;
    }

    return {
      id: p.externalId,
      externalId: p.externalId,
      name: p.name,
      team: p.team,
      positions: p.positions,
      projectedValue: p.auctionValue,
      adjustedValue: p.auctionValue, // Will be adjusted by inflation during draft
      projectedStats,
      status: 'available' as const,
      tier: p.tier,
      isInDraftPool: p.isInDraftPool,
    };
  });
}

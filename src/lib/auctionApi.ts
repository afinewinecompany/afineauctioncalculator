import type {
  ScrapedAuctionData,
  AuctionSyncResult,
  Player,
  LeagueSettings,
} from './types';

// Get API base URL from environment variables
// In development: defaults to empty string (relative URLs proxied by Vite)
// In production: uses VITE_API_URL (e.g., https://api.example.com)
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
      '[auctionApi] VITE_API_URL is not set. Using relative URLs which will be proxied by Vite. ' +
      'If you see API errors, ensure your Vite proxy is configured correctly in vite.config.ts.'
    );
    return '';
  }

  // Ensure the URL has a protocol prefix for production
  let url = rawUrl || '';
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

const API_URL = getApiUrl();
const API_BASE = `${API_URL}/api/auction`;
const PROJECTIONS_BASE = `${API_URL}/api/projections`;

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
  // Dynasty-specific fields
  dynastyRank?: number;
  dynastyValue?: number;
  steamerValue?: number;
  blendedScore?: number;
  ageAdjustment?: number;
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
    leagueType?: 'redraft' | 'dynasty';
    dynastyWeight?: number;
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
        rosterSpots: settings.rosterSpots, // Include per-position slots for scarcity calculation
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
 * Supports both redraft and dynasty modes.
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
        rosterSpots: settings.rosterSpots, // Include per-position slots for scarcity calculation
        scoringType: settings.scoringType,
        hittingCategories: settings.hittingCategories,
        pitchingCategories: settings.pitchingCategories,
        pointsSettings: settings.pointsSettings,
        // Dynasty settings
        leagueType: settings.leagueType || 'redraft',
        dynastySettings: settings.dynastySettings,
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
 * Generates the MLB player photo URL from mlbamId
 * Uses MLB's official mugshot service
 * @param mlbamId - MLB Advanced Media player ID
 * @param size - Image size multiplier (1x, 2x, 4x available)
 * @returns URL to the player's headshot image
 */
export function getPlayerPhotoUrl(mlbamId: number | undefined, size: '1x' | '2x' | '4x' = '4x'): string | null {
  if (!mlbamId) return null;
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbamId}/headshot/67/current`;
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

// =============================================================================
// DYNASTY RANKINGS API
// =============================================================================

export interface DynastyRanking {
  id: string;
  name: string;
  team: string;
  positions: string[];
  age: number | null;
  level: 'MLB' | 'AAA' | 'AA' | 'A+' | 'A' | 'other';
  overallRank: number;
  positionRank: number;
  dynastyValue: number;
  normalizedValue: number;
  trend: {
    rank7Day: number;
    rank30Day: number;
    value7Day: number;
    value30Day: number;
  };
}

export interface DynastyRankingsResponse {
  metadata: {
    source: string;
    fetchedAt: string;
    playerCount: number;
  };
  rankings: DynastyRanking[];
}

/**
 * Fetches dynasty rankings from Harry Knows Ball
 * Used for dynasty league value calculations
 */
export async function fetchDynastyRankings(): Promise<DynastyRankingsResponse> {
  const response = await fetch(`${PROJECTIONS_BASE}/dynasty-rankings`);

  if (!response.ok) {
    throw new Error('Failed to fetch dynasty rankings');
  }

  return response.json();
}

/**
 * Gets the cache status for dynasty rankings
 */
export async function getDynastyRankingsCacheStatus(): Promise<{
  isCached: boolean;
  fetchedAt: string | null;
  expiresAt: string | null;
  playerCount: number;
}> {
  const response = await fetch(`${PROJECTIONS_BASE}/dynasty-rankings/status`);

  if (!response.ok) {
    throw new Error('Failed to get dynasty rankings cache status');
  }

  return response.json();
}

/**
 * Forces a refresh of dynasty rankings cache
 */
export async function refreshDynastyRankings(): Promise<{
  success: boolean;
  playerCount: number;
  refreshedAt: string;
}> {
  const response = await fetch(`${PROJECTIONS_BASE}/dynasty-rankings/refresh`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to refresh dynasty rankings');
  }

  return response.json();
}

/**
 * Converts calculated values to the Player format used by the draft room
 * Handles two-way players (like Shohei Ohtani) by combining their hitter and pitcher entries
 *
 * IMPORTANT: Only includes players that are in the draft pool (isInDraftPool: true)
 * This ensures only the top N players by value (where N = total roster spots * teams) are shown
 */
export function convertToPlayers(
  calculatedValues: CalculatedValuesResponse
): Player[] {
  // CRITICAL: Filter to only players in the draft pool BEFORE processing
  // This excludes low-value players who won't realistically be drafted
  // Pool size = numTeams * totalRosterSpots (e.g., 12 teams * 23 spots = 276 players)
  const draftablePlayersOnly = calculatedValues.players.filter(p => p.isInDraftPool);

  // Debug: Check if problematic players are being included
  if (import.meta.env.DEV) {
    const jesusCheck = calculatedValues.players.find(p => p.name.includes('Jesus Rodriguez'));
    const rafaelCheck = calculatedValues.players.find(p => p.name.includes('Rafael Flores'));
    if (jesusCheck || rafaelCheck) {
      console.log('[convertToPlayers] Debug - Jesus Rodriguez:', jesusCheck ? { isInDraftPool: jesusCheck.isInDraftPool, tier: jesusCheck.tier, auctionValue: jesusCheck.auctionValue } : 'not found');
      console.log('[convertToPlayers] Debug - Rafael Flores:', rafaelCheck ? { isInDraftPool: rafaelCheck.isInDraftPool, tier: rafaelCheck.tier, auctionValue: rafaelCheck.auctionValue } : 'not found');
    }
    console.log(`[convertToPlayers] Total players: ${calculatedValues.players.length}, In draft pool: ${draftablePlayersOnly.length}`);
  }

  // Group players by mlbamId (if available) OR externalId to identify two-way players
  // Two-way players like Ohtani have separate hitter/pitcher entries with different externalIds
  // but may share the same mlbamId. If mlbamId is not available (0), fall back to name+team matching.
  const playerMap = new Map<string, CalculatedValuesResponse['players']>();

  // First pass: group by mlbamId if available, else by externalId
  draftablePlayersOnly.forEach((p) => {
    // Use mlbamId for grouping if available (consistent across hitter/pitcher entries)
    // Otherwise fall back to externalId
    const groupKey = p.mlbamId && p.mlbamId > 0
      ? `mlbam-${p.mlbamId}`
      : p.externalId;

    const existing = playerMap.get(groupKey) || [];
    existing.push(p);
    playerMap.set(groupKey, existing);
  });

  // Second pass: find two-way players that weren't grouped by mlbamId
  // (e.g., if pitcher entry has mlbamId=0 but hitter has the real mlbamId)
  // Group by normalized name+team for players with different entry types
  const nameTeamGroups = new Map<string, { key: string; entries: CalculatedValuesResponse['players'] }[]>();

  playerMap.forEach((entries, key) => {
    if (entries.length === 1) {
      const p = entries[0];
      const nameTeamKey = `${p.name.toLowerCase().trim()}|${p.team.toLowerCase().trim()}`;
      const existing = nameTeamGroups.get(nameTeamKey) || [];
      existing.push({ key, entries });
      nameTeamGroups.set(nameTeamKey, existing);
    }
  });

  // Merge entries that have the same name+team but different externalIds (two-way players)
  nameTeamGroups.forEach((groups) => {
    if (groups.length > 1) {
      // Found a player with multiple entries (likely two-way player like Ohtani)
      const hitterGroup = groups.find(g => g.entries.some(e => e.playerType === 'hitter'));
      const pitcherGroup = groups.find(g => g.entries.some(e => e.playerType === 'pitcher'));

      if (hitterGroup && pitcherGroup && hitterGroup.key !== pitcherGroup.key) {
        // Merge pitcher entries into hitter group
        const hitterEntries = playerMap.get(hitterGroup.key) || [];
        const pitcherEntries = playerMap.get(pitcherGroup.key) || [];

        // Combine into one group under the hitter's key
        playerMap.set(hitterGroup.key, [...hitterEntries, ...pitcherEntries]);
        // Remove the pitcher's separate entry
        playerMap.delete(pitcherGroup.key);

        if (import.meta.env.DEV) {
          console.log('[convertToPlayers] Merged two-way player entries:', {
            name: hitterEntries[0]?.name,
            hitterKey: hitterGroup.key,
            pitcherKey: pitcherGroup.key,
          });
        }
      }
    }
  });

  const players: Player[] = [];

  playerMap.forEach((entries) => {
    if (entries.length === 1) {
      // Normal player - single entry
      const p = entries[0];
      players.push(createPlayerFromProjection(p));
    } else {
      // Two-way player (like Ohtani) - combine entries
      const hitterEntry = entries.find(e => e.playerType === 'hitter');
      const pitcherEntry = entries.find(e => e.playerType === 'pitcher');

      if (hitterEntry && pitcherEntry) {
        // Combine both entries into a single player
        const combinedPlayer = combineTwoWayPlayer(hitterEntry, pitcherEntry);
        players.push(combinedPlayer);
      } else {
        // Shouldn't happen, but handle gracefully - use highest value entry
        const bestEntry = entries.reduce((best, current) =>
          current.auctionValue > best.auctionValue ? current : best
        );
        players.push(createPlayerFromProjection(bestEntry));
      }
    }
  });

  return players;
}

/**
 * Creates a Player object from a single projection entry
 */
function createPlayerFromProjection(p: CalculatedValuesResponse['players'][0]): Player {
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
    projectedStats.OPS = p.hitting.ops;
    projectedStats.BB = p.hitting.walks;
  }

  if (p.pitching) {
    projectedStats.W = p.pitching.wins;
    projectedStats.K = p.pitching.strikeouts;
    projectedStats.ERA = p.pitching.era;
    projectedStats.WHIP = p.pitching.whip;
    projectedStats.SV = p.pitching.saves;
    projectedStats.IP = p.pitching.inningsPitched;
    projectedStats.QS = p.pitching.qualityStarts;
    projectedStats.HLD = p.pitching.holds;
  }

  return {
    id: p.externalId,
    externalId: p.externalId,
    mlbamId: p.mlbamId,
    name: p.name,
    team: p.team,
    positions: p.positions,
    projectedValue: p.auctionValue,
    adjustedValue: p.auctionValue, // Will be adjusted by inflation during draft
    projectedStats,
    status: 'available' as const,
    tier: p.tier,
    isInDraftPool: p.isInDraftPool,
    sgpValue: p.sgpValue,
  };
}

/**
 * Combines a two-way player's hitter and pitcher projections into a single player
 * Used for players like Shohei Ohtani who have separate hitter and pitcher entries
 */
function combineTwoWayPlayer(
  hitter: CalculatedValuesResponse['players'][0],
  pitcher: CalculatedValuesResponse['players'][0]
): Player {
  // Combine positions: include both hitting position(s) and pitching position(s)
  const allPositions = [...new Set([...hitter.positions, ...pitcher.positions])];

  // Combined auction value is sum of both (they contribute value in both ways)
  const combinedValue = hitter.auctionValue + pitcher.auctionValue;

  // Use the better tier (lower number = better)
  const combinedTier = Math.min(hitter.tier, pitcher.tier);

  // Combine stats from both projections
  const projectedStats: Player['projectedStats'] = {};

  // Hitting stats
  if (hitter.hitting) {
    projectedStats.HR = hitter.hitting.homeRuns;
    projectedStats.RBI = hitter.hitting.rbi;
    projectedStats.SB = hitter.hitting.stolenBases;
    projectedStats.AVG = hitter.hitting.battingAvg;
    projectedStats.R = hitter.hitting.runs;
    projectedStats.H = hitter.hitting.hits;
    projectedStats.OBP = hitter.hitting.onBasePct;
    projectedStats.SLG = hitter.hitting.sluggingPct;
    projectedStats.OPS = hitter.hitting.ops;
    projectedStats.BB = hitter.hitting.walks;
  }

  // Pitching stats
  if (pitcher.pitching) {
    projectedStats.W = pitcher.pitching.wins;
    projectedStats.K = pitcher.pitching.strikeouts;
    projectedStats.ERA = pitcher.pitching.era;
    projectedStats.WHIP = pitcher.pitching.whip;
    projectedStats.SV = pitcher.pitching.saves;
    projectedStats.IP = pitcher.pitching.inningsPitched;
    projectedStats.QS = pitcher.pitching.qualityStarts;
    projectedStats.HLD = pitcher.pitching.holds;
  }

  // Combine SGP values from both hitter and pitcher entries
  const combinedSgpValue = (hitter.sgpValue ?? 0) + (pitcher.sgpValue ?? 0);

  return {
    id: hitter.externalId, // Same ID for both entries
    externalId: hitter.externalId,
    mlbamId: hitter.mlbamId,
    name: hitter.name,
    team: hitter.team,
    positions: allPositions,
    projectedValue: Math.round(combinedValue),
    adjustedValue: Math.round(combinedValue),
    projectedStats,
    status: 'available' as const,
    tier: combinedTier,
    isInDraftPool: hitter.isInDraftPool || pitcher.isInDraftPool,
    isTwoWayPlayer: true, // Flag to indicate this is a combined two-way player
    sgpValue: combinedSgpValue,
  };
}

/**
 * Dynasty Rankings Scraper Service
 * Fetches crowd-sourced dynasty rankings from Harry Knows Ball
 *
 * Data source: https://harryknowsball.com/rankings
 * The data is embedded as JSON in the page's __NEXT_DATA__ script tag
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DynastyRanking, DynastyRankingsCacheEntry } from '../types/projections';

const DYNASTY_RANKINGS_URL = 'https://harryknowsball.com/rankings';
const CACHE_DIR = path.join(process.cwd(), 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'dynasty-rankings.json');
const CACHE_TTL_HOURS = 12; // Rankings update daily, 12-hour cache is reasonable

/**
 * Fetch dynasty rankings with caching
 */
export async function getDynastyRankings(): Promise<DynastyRanking[]> {
  // Check cache first
  const cached = getCachedRankings();
  if (cached) {
    console.log('[Dynasty] Using cached rankings');
    return cached;
  }

  // Fetch fresh rankings
  console.log('[Dynasty] Fetching fresh rankings from Harry Knows Ball');
  const rankings = await fetchDynastyRankings();

  // Cache the results
  cacheRankings(rankings);

  return rankings;
}

/**
 * Check if we have valid cached rankings
 */
function getCachedRankings(): DynastyRanking[] | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }

    const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache: DynastyRankingsCacheEntry = JSON.parse(cacheContent);

    // Check if cache is expired
    const expiresAt = new Date(cache.metadata.expiresAt);
    if (expiresAt < new Date()) {
      console.log('[Dynasty] Cache expired');
      return null;
    }

    console.log(`[Dynasty] Cache valid, ${cache.rankings.length} players`);
    return cache.rankings;
  } catch (error) {
    console.error('[Dynasty] Error reading cache:', error);
    return null;
  }
}

/**
 * Save rankings to cache
 */
function cacheRankings(rankings: DynastyRanking[]): void {
  try {
    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

    const cacheEntry: DynastyRankingsCacheEntry = {
      metadata: {
        source: 'harryknowsball',
        fetchedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        playerCount: rankings.length,
      },
      rankings,
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheEntry, null, 2));
    console.log(`[Dynasty] Cached ${rankings.length} rankings`);
  } catch (error) {
    console.error('[Dynasty] Error writing cache:', error);
  }
}

/**
 * Fetch dynasty rankings from Harry Knows Ball
 */
async function fetchDynastyRankings(): Promise<DynastyRanking[]> {
  try {
    const response = await fetch(DYNASTY_RANKINGS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract __NEXT_DATA__ JSON from the page
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

    if (!nextDataMatch || !nextDataMatch[1]) {
      throw new Error('Could not find __NEXT_DATA__ in page');
    }

    const nextData = JSON.parse(nextDataMatch[1]);

    // Navigate to the players data - structure may vary
    const pageProps = nextData?.props?.pageProps;
    if (!pageProps) {
      throw new Error('Could not find pageProps in __NEXT_DATA__');
    }

    // The players array should be in pageProps
    const rawPlayers = pageProps.players || pageProps.rankings || [];

    if (!Array.isArray(rawPlayers) || rawPlayers.length === 0) {
      console.warn('[Dynasty] No players found in page data, checking alternative paths...');
      // Try alternative data paths
      const altPlayers = findPlayersInData(pageProps);
      if (altPlayers.length === 0) {
        throw new Error('Could not find players data in page');
      }
      return normalizeRankings(altPlayers);
    }

    return normalizeRankings(rawPlayers);
  } catch (error) {
    console.error('[Dynasty] Error fetching rankings:', error);
    throw error;
  }
}

/**
 * Recursively search for players array in data structure
 */
function findPlayersInData(data: unknown, depth = 0): unknown[] {
  if (depth > 5) return []; // Prevent infinite recursion

  if (Array.isArray(data) && data.length > 0) {
    // Check if this looks like a players array
    const first = data[0];
    if (first && typeof first === 'object' && ('name' in first || 'playerName' in first)) {
      return data;
    }
  }

  if (data && typeof data === 'object') {
    for (const value of Object.values(data)) {
      const result = findPlayersInData(value, depth + 1);
      if (result.length > 0) return result;
    }
  }

  return [];
}

/**
 * Normalize raw player data to our DynastyRanking format
 */
function normalizeRankings(rawPlayers: unknown[]): DynastyRanking[] {
  // Find min/max values for normalization
  const values = rawPlayers
    .map((p: any) => p.value || p.dynastyValue || 0)
    .filter((v: number) => v > 0);

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  return rawPlayers
    .map((player: any, index: number) => {
      try {
        return normalizePlayer(player, index, minValue, valueRange);
      } catch (error) {
        console.warn(`[Dynasty] Error normalizing player:`, player?.name, error);
        return null;
      }
    })
    .filter((p): p is DynastyRanking => p !== null);
}

/**
 * Normalize a single player to DynastyRanking format
 */
function normalizePlayer(
  player: any,
  fallbackRank: number,
  minValue: number,
  valueRange: number
): DynastyRanking {
  // Extract name
  const name = player.name || player.playerName || player.fullName || 'Unknown';

  // Extract team
  const team = player.team || player.mlbTeam || player.organization || '';

  // Extract positions
  let positions: string[] = [];
  if (Array.isArray(player.positions)) {
    positions = player.positions;
  } else if (typeof player.positions === 'string') {
    positions = player.positions.split(/[,\/]/).map((p: string) => p.trim());
  } else if (player.position) {
    positions = [player.position];
  } else if (player.positionRanks && typeof player.positionRanks === 'object') {
    positions = Object.keys(player.positionRanks);
  }

  // Normalize positions to standard format
  positions = positions.map(normalizePosition).filter(Boolean);

  // Extract age
  const age = typeof player.age === 'number' ? player.age : null;

  // Determine level
  const level = determineLevel(player);

  // Extract rankings
  const overallRank = player.rank || player.overallRank || fallbackRank + 1;

  // Extract position rank (use first position's rank if available)
  let positionRank = overallRank;
  if (player.positionRanks && typeof player.positionRanks === 'object') {
    const firstPosRank = Object.values(player.positionRanks)[0];
    if (typeof firstPosRank === 'number') {
      positionRank = firstPosRank;
    }
  }

  // Extract dynasty value
  const dynastyValue = player.value || player.dynastyValue || 5000;

  // Normalize to 0-100 scale
  const normalizedValue = ((dynastyValue - minValue) / valueRange) * 100;

  // Extract trend data
  const trend = {
    rank7Day: player.rankChange7Days || player.rank7Day || 0,
    rank30Day: player.rankChange30Days || player.rank30Day || 0,
    value7Day: player.valueChange7Days || player.value7Day || 0,
    value30Day: player.valueChange30Days || player.value30Day || 0,
  };

  return {
    id: String(player.id || player.playerId || `dynasty-${fallbackRank}`),
    name,
    team,
    positions,
    age,
    level,
    overallRank,
    positionRank,
    dynastyValue,
    normalizedValue,
    trend,
  };
}

/**
 * Normalize position strings to standard format
 */
function normalizePosition(pos: string): string {
  const normalized = pos.toUpperCase().trim();

  const positionMap: Record<string, string> = {
    'CATCHER': 'C',
    'FIRST': '1B',
    'FIRST BASE': '1B',
    'SECOND': '2B',
    'SECOND BASE': '2B',
    'THIRD': '3B',
    'THIRD BASE': '3B',
    'SHORTSTOP': 'SS',
    'SHORT': 'SS',
    'OUTFIELD': 'OF',
    'LEFT FIELD': 'OF',
    'CENTER FIELD': 'OF',
    'RIGHT FIELD': 'OF',
    'LF': 'OF',
    'CF': 'OF',
    'RF': 'OF',
    'DESIGNATED HITTER': 'UTIL',
    'DH': 'UTIL',
    'UTILITY': 'UTIL',
    'UT': 'UTIL',
    'STARTING PITCHER': 'SP',
    'STARTER': 'SP',
    'RELIEF PITCHER': 'RP',
    'RELIEVER': 'RP',
    'CLOSER': 'RP',
    'CL': 'RP',
    'PITCHER': 'P',
  };

  return positionMap[normalized] || normalized;
}

/**
 * Determine player's level (MLB, minors, etc.)
 */
function determineLevel(player: any): DynastyRanking['level'] {
  const level = (player.level || player.mlbLevel || player.currentLevel || '').toUpperCase();

  if (level.includes('MLB') || level.includes('MAJORS') || level === 'ML') {
    return 'MLB';
  }
  if (level.includes('AAA') || level === 'TRIPLE-A') {
    return 'AAA';
  }
  if (level.includes('AA') || level === 'DOUBLE-A') {
    return 'AA';
  }
  if (level.includes('A+') || level === 'HIGH-A') {
    return 'A+';
  }
  if (level.includes('A') || level === 'LOW-A' || level === 'SINGLE-A') {
    return 'A';
  }

  // If no level specified but player has MLB team stats, assume MLB
  if (player.stats || player.projectedStats) {
    return 'MLB';
  }

  return 'other';
}

/**
 * Force refresh of dynasty rankings cache
 */
export async function refreshDynastyRankings(): Promise<DynastyRanking[]> {
  // Delete existing cache
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  } catch (error) {
    console.error('[Dynasty] Error deleting cache:', error);
  }

  // Fetch fresh
  return getDynastyRankings();
}

/**
 * Get cache status for dynasty rankings
 */
export function getDynastyRankingsCacheStatus(): {
  isCached: boolean;
  fetchedAt: string | null;
  expiresAt: string | null;
  playerCount: number;
} {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return { isCached: false, fetchedAt: null, expiresAt: null, playerCount: 0 };
    }

    const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache: DynastyRankingsCacheEntry = JSON.parse(cacheContent);

    return {
      isCached: true,
      fetchedAt: cache.metadata.fetchedAt,
      expiresAt: cache.metadata.expiresAt,
      playerCount: cache.metadata.playerCount,
    };
  } catch (error) {
    return { isCached: false, fetchedAt: null, expiresAt: null, playerCount: 0 };
  }
}

/**
 * Match dynasty rankings to projections by name
 * Returns a map of projection externalId -> DynastyRanking
 */
export function matchDynastyRankingsToProjections(
  rankings: DynastyRanking[],
  projections: Array<{ externalId: string; name: string; team: string }>
): Map<string, DynastyRanking> {
  const matchMap = new Map<string, DynastyRanking>();

  // Create normalized name index for rankings
  const rankingsByNormalizedName = new Map<string, DynastyRanking>();
  for (const ranking of rankings) {
    const normalizedName = normalizeName(ranking.name);
    rankingsByNormalizedName.set(normalizedName, ranking);
  }

  // Match projections to rankings
  for (const projection of projections) {
    const normalizedName = normalizeName(projection.name);

    // Try exact match first
    let match = rankingsByNormalizedName.get(normalizedName);

    // Try without Jr/Sr/III suffixes
    if (!match) {
      const nameWithoutSuffix = normalizedName.replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '');
      match = rankingsByNormalizedName.get(nameWithoutSuffix);
    }

    // Try last name + first name prefix match (for name variations like "Mike" vs "Michael")
    // IMPORTANT: Require at least 3 characters of first name to match, not just initial
    // This prevents false matches like "Jesus Rodriguez" matching "Julio Rodriguez"
    if (!match) {
      const parts = normalizedName.split(' ');
      if (parts.length >= 2) {
        const lastName = parts[parts.length - 1];
        const firstName = parts[0];
        const firstNamePrefix = firstName.slice(0, 3); // At least 3 chars

        for (const [rankName, ranking] of Array.from(rankingsByNormalizedName.entries())) {
          const rankParts = rankName.split(' ');
          if (rankParts.length >= 2) {
            const rankLastName = rankParts[rankParts.length - 1];
            const rankFirstName = rankParts[0];
            // Require same last name AND first name starts with same 3+ characters
            if (lastName === rankLastName &&
                firstNamePrefix.length >= 3 &&
                rankFirstName.startsWith(firstNamePrefix)) {
              match = ranking;
              break;
            }
          }
        }
      }
    }

    if (match) {
      matchMap.set(projection.externalId, match);
    }
  }

  console.log(`[Dynasty] Matched ${matchMap.size}/${projections.length} projections to dynasty rankings`);
  return matchMap;
}

/**
 * Normalize player name for matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z\s]/g, '') // Remove non-alpha
    .replace(/\s+/g, ' ')
    .trim();
}

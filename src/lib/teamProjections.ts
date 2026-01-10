/**
 * Team Projections Calculator
 * Calculates projected league standings based on team rosters and player projections
 */

import type { Player, LeagueSettings, ScrapedAuctionData } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface CategoryProjection {
  value: number;
  rank: number;
  isLowerBetter: boolean;
}

export interface TeamProjectedStats {
  teamName: string;
  categories: Record<string, CategoryProjection>;
  totalRotoPoints: number;
  overallRank: number;
  playerCount: number;
}

interface TeamRawStats {
  teamName: string;
  playerCount: number;
  // Counting stats
  countingStats: Record<string, number>;
  // For ratio stat calculations
  totalHits: number;
  totalAtBats: number;
  totalIP: number;
  totalER: number;
  totalWHIPComponent: number; // (H + BB) for pitchers
  totalOBPComponent: number;  // (H + BB + HBP) for hitters
  totalOBPDenominator: number; // (AB + BB + HBP + SF)
  totalTB: number; // Total bases for SLG
  totalKPitching: number; // For K/9 calculation
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Categories where lower values are better (inverted for ranking)
 */
const LOWER_IS_BETTER_CATEGORIES = new Set([
  'ERA', 'WHIP', 'BB/9', 'BB9', 'H/IP', 'HR/9', 'HR9', 'L', 'ER', 'HA', 'BBA', 'HRA', 'BS',
  'K', 'SO', 'CS', 'GIDP', 'E', // Hitter negative stats
]);

/**
 * Ratio stats that need weighted averaging (not simple summing)
 */
const HITTING_RATIO_STATS = new Set(['AVG', 'OBP', 'SLG', 'OPS', 'BABIP', 'ISO']);
const PITCHING_RATIO_STATS = new Set(['ERA', 'WHIP', 'K/9', 'K9', 'BB/9', 'BB9', 'H/IP', 'HR/9', 'HR9', 'K/BB', 'K_BB', 'FIP', 'K/BF%', 'BB%', 'BAA', 'OBPA']);

/**
 * Counting stats that can be directly summed
 */
const COUNTING_STATS = new Set([
  // Hitting
  'R', 'HR', 'RBI', 'SB', 'H', 'BB', 'TB', 'XBH', '1B', '2B', '3B', 'HBP', 'SF', 'SH',
  'CS', 'SO', 'K', 'GIDP', 'PA', 'AB', 'GP',
  // Pitching
  'W', 'K', 'SV', 'IP', 'QS', 'HLD', 'HD', 'L', 'CG', 'SHO', 'NH', 'GS', 'GF', 'BS',
  'ER', 'HA', 'BBA', 'HRA', 'SVH', 'NS', 'BF',
]);

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate projected standings for all teams in a league
 */
export function calculateProjectedStandings(
  allPlayers: Player[],
  allDrafted: Player[],
  settings: LeagueSettings,
  auctionData: ScrapedAuctionData | null
): TeamProjectedStats[] {
  // Get team names from auction data or from drafted players
  const teamNames = getTeamNames(allDrafted, auctionData);

  if (teamNames.length === 0) {
    return [];
  }

  // Get enabled categories
  const enabledCategories = getEnabledCategories(settings);

  if (enabledCategories.length === 0) {
    return [];
  }

  // Group players by team
  const playersByTeam = groupPlayersByTeam(allPlayers, allDrafted, teamNames);

  // Calculate raw stats for each team
  const teamRawStats = teamNames.map(teamName =>
    calculateTeamRawStats(teamName, playersByTeam.get(teamName) || [], enabledCategories)
  );

  // Convert raw stats to final category values (handling ratio stats)
  const teamCategoryValues = teamRawStats.map(raw => ({
    teamName: raw.teamName,
    playerCount: raw.playerCount,
    values: calculateFinalCategoryValues(raw, enabledCategories),
  }));

  // Calculate rankings for each category
  const rankedTeams = calculateCategoryRankings(teamCategoryValues, enabledCategories);

  return rankedTeams;
}

/**
 * Get list of team names from auction data or drafted players
 */
function getTeamNames(allDrafted: Player[], auctionData: ScrapedAuctionData | null): string[] {
  if (auctionData?.teams && auctionData.teams.length > 0) {
    return auctionData.teams.map(t => t.name);
  }

  // Fall back to extracting from drafted players
  const teams = new Set<string>();
  allDrafted.forEach(p => {
    if (p.draftedBy) {
      teams.add(p.draftedBy);
    }
  });
  return Array.from(teams);
}

/**
 * Get enabled categories from league settings
 */
export function getEnabledCategories(settings: LeagueSettings): string[] {
  const categories: string[] = [];

  // Hitting categories
  if (settings.hittingCategories) {
    Object.entries(settings.hittingCategories).forEach(([cat, enabled]) => {
      if (enabled) categories.push(cat);
    });
  }

  // Pitching categories
  if (settings.pitchingCategories) {
    Object.entries(settings.pitchingCategories).forEach(([cat, enabled]) => {
      if (enabled) categories.push(cat);
    });
  }

  return categories;
}

/**
 * Group players by their team
 */
function groupPlayersByTeam(
  allPlayers: Player[],
  allDrafted: Player[],
  teamNames: string[]
): Map<string, Player[]> {
  const playersByTeam = new Map<string, Player[]>();

  // Initialize empty arrays for all teams
  teamNames.forEach(name => playersByTeam.set(name, []));

  // Map drafted player IDs to their full projection data
  const draftedById = new Map<string, Player>();
  allDrafted.forEach(p => {
    draftedById.set(p.id, p);
  });

  // Find the full player data for each drafted player
  allDrafted.forEach(draftedPlayer => {
    if (!draftedPlayer.draftedBy) return;

    // Try to find the player in allPlayers (which has projections)
    const fullPlayer = allPlayers.find(p => p.id === draftedPlayer.id);
    const playerToAdd = fullPlayer || draftedPlayer;

    const teamPlayers = playersByTeam.get(draftedPlayer.draftedBy);
    if (teamPlayers) {
      teamPlayers.push({
        ...playerToAdd,
        draftedBy: draftedPlayer.draftedBy,
        draftedPrice: draftedPlayer.draftedPrice,
      });
    }
  });

  return playersByTeam;
}

/**
 * Calculate raw stats for a single team
 */
function calculateTeamRawStats(
  teamName: string,
  players: Player[],
  enabledCategories: string[]
): TeamRawStats {
  const raw: TeamRawStats = {
    teamName,
    playerCount: players.length,
    countingStats: {},
    totalHits: 0,
    totalAtBats: 0,
    totalIP: 0,
    totalER: 0,
    totalWHIPComponent: 0,
    totalOBPComponent: 0,
    totalOBPDenominator: 0,
    totalTB: 0,
    totalKPitching: 0,
  };

  // Initialize counting stats
  enabledCategories.forEach(cat => {
    if (COUNTING_STATS.has(cat)) {
      raw.countingStats[cat] = 0;
    }
  });

  // Aggregate stats from all players
  players.forEach(player => {
    const stats = player.projectedStats;
    if (!stats) return;

    // Sum counting stats directly
    enabledCategories.forEach(cat => {
      if (COUNTING_STATS.has(cat)) {
        const value = getStatValue(stats, cat);
        if (value !== null && !isNaN(value)) {
          raw.countingStats[cat] = (raw.countingStats[cat] || 0) + value;
        }
      }
    });

    // Aggregate components for ratio stats
    // Hitting ratio components
    if (stats.H !== undefined && stats.AVG !== undefined && stats.AVG > 0) {
      const estimatedAB = stats.H / stats.AVG;
      raw.totalHits += stats.H;
      raw.totalAtBats += estimatedAB;

      // OBP components: (H + BB + HBP) / (AB + BB + HBP + SF)
      // We'll approximate HBP and SF
      const bb = stats.BB || 0;
      raw.totalOBPComponent += stats.H + bb;
      raw.totalOBPDenominator += estimatedAB + bb;

      // Total bases for SLG: TB = H + 2B + 2*3B + 3*HR (approximated)
      // Since we have OPS = OBP + SLG, and we know H and AB
      // TB ≈ SLG * AB
      if (stats.SLG !== undefined) {
        raw.totalTB += stats.SLG * estimatedAB;
      }
    }

    // Pitching ratio components
    if (stats.IP !== undefined && stats.IP > 0) {
      raw.totalIP += stats.IP;

      // ERA components: ER = ERA * IP / 9
      if (stats.ERA !== undefined) {
        raw.totalER += (stats.ERA * stats.IP) / 9;
      }

      // WHIP components: (H + BB) = WHIP * IP
      if (stats.WHIP !== undefined) {
        raw.totalWHIPComponent += stats.WHIP * stats.IP;
      }

      // Strikeouts for K/9
      if (stats.K !== undefined) {
        raw.totalKPitching += stats.K;
      }
    }
  });

  return raw;
}

/**
 * Calculate final category values from raw stats
 */
function calculateFinalCategoryValues(
  raw: TeamRawStats,
  enabledCategories: string[]
): Record<string, number> {
  const values: Record<string, number> = {};

  enabledCategories.forEach(cat => {
    if (COUNTING_STATS.has(cat)) {
      // Counting stats - use the summed value
      values[cat] = raw.countingStats[cat] || 0;
    } else if (HITTING_RATIO_STATS.has(cat)) {
      // Hitting ratio stats - calculate weighted average
      values[cat] = calculateHittingRatioStat(raw, cat);
    } else if (PITCHING_RATIO_STATS.has(cat)) {
      // Pitching ratio stats - calculate weighted average
      values[cat] = calculatePitchingRatioStat(raw, cat);
    } else {
      // Unknown category - default to 0
      values[cat] = 0;
    }
  });

  return values;
}

/**
 * Calculate hitting ratio stat from raw components
 */
function calculateHittingRatioStat(raw: TeamRawStats, category: string): number {
  switch (category) {
    case 'AVG':
      return raw.totalAtBats > 0 ? raw.totalHits / raw.totalAtBats : 0;
    case 'OBP':
      return raw.totalOBPDenominator > 0 ? raw.totalOBPComponent / raw.totalOBPDenominator : 0;
    case 'SLG':
      return raw.totalAtBats > 0 ? raw.totalTB / raw.totalAtBats : 0;
    case 'OPS':
      const obp = raw.totalOBPDenominator > 0 ? raw.totalOBPComponent / raw.totalOBPDenominator : 0;
      const slg = raw.totalAtBats > 0 ? raw.totalTB / raw.totalAtBats : 0;
      return obp + slg;
    case 'ISO':
      const avg = raw.totalAtBats > 0 ? raw.totalHits / raw.totalAtBats : 0;
      const slgForIso = raw.totalAtBats > 0 ? raw.totalTB / raw.totalAtBats : 0;
      return slgForIso - avg;
    default:
      return 0;
  }
}

/**
 * Calculate pitching ratio stat from raw components
 */
function calculatePitchingRatioStat(raw: TeamRawStats, category: string): number {
  if (raw.totalIP <= 0) return category === 'ERA' || category === 'WHIP' ? 99.99 : 0;

  switch (category) {
    case 'ERA':
      return (raw.totalER / raw.totalIP) * 9;
    case 'WHIP':
      return raw.totalWHIPComponent / raw.totalIP;
    case 'K/9':
    case 'K9':
      return (raw.totalKPitching / raw.totalIP) * 9;
    case 'BB/9':
    case 'BB9':
      // Approximate from WHIP - K/9 correlation
      return 0; // Would need BB component
    case 'K/BB':
    case 'K_BB':
      // Would need both K and BB components
      return 0;
    case 'K/BF%':
    case 'BB%':
      // Would need BF data
      return 0;
    default:
      return 0;
  }
}

/**
 * Get stat value from projectedStats object
 */
function getStatValue(stats: Player['projectedStats'], category: string): number | null {
  // Map category codes to projectedStats keys
  const categoryMapping: Record<string, keyof NonNullable<Player['projectedStats']>> = {
    'R': 'R',
    'HR': 'HR',
    'RBI': 'RBI',
    'SB': 'SB',
    'H': 'H',
    'BB': 'BB',
    'AVG': 'AVG',
    'OBP': 'OBP',
    'SLG': 'SLG',
    'OPS': 'OPS',
    'W': 'W',
    'K': 'K',
    'ERA': 'ERA',
    'WHIP': 'WHIP',
    'SV': 'SV',
    'IP': 'IP',
    'QS': 'QS',
    'HLD': 'HLD',
    'HD': 'HLD',
    'K/BF%': 'K/BF%',
    'BB%': 'BB%',
  };

  const key = categoryMapping[category];
  if (key && stats[key] !== undefined) {
    return stats[key] as number;
  }

  // Handle composite stats
  switch (category) {
    case 'SVH':
    case 'SV+HD':
      return (stats.SV || 0) + (stats.HLD || 0);
    case 'R+RBI':
      return (stats.R || 0) + (stats.RBI || 0);
    case 'HR+SB':
      return (stats.HR || 0) + (stats.SB || 0);
    case 'TB':
      // Approximate: TB ≈ H + 2B + 2*3B + 3*HR, but we don't have components
      // Use SLG * AB approximation if available
      if (stats.SLG && stats.H && stats.AVG && stats.AVG > 0) {
        const ab = stats.H / stats.AVG;
        return stats.SLG * ab;
      }
      return null;
    default:
      return null;
  }
}

/**
 * Calculate rankings for each category and overall standings
 */
function calculateCategoryRankings(
  teamCategoryValues: Array<{ teamName: string; playerCount: number; values: Record<string, number> }>,
  enabledCategories: string[]
): TeamProjectedStats[] {
  const results: TeamProjectedStats[] = teamCategoryValues.map(team => ({
    teamName: team.teamName,
    categories: {},
    totalRotoPoints: 0,
    overallRank: 0,
    playerCount: team.playerCount,
  }));

  // Rank teams in each category
  enabledCategories.forEach(category => {
    const isLowerBetter = LOWER_IS_BETTER_CATEGORIES.has(category);

    // Create array of [teamIndex, value] for sorting
    const teamValues = teamCategoryValues.map((team, index) => ({
      index,
      value: team.values[category] || 0,
    }));

    // Sort by value (descending for higher-is-better, ascending for lower-is-better)
    teamValues.sort((a, b) => {
      if (isLowerBetter) {
        return a.value - b.value; // Lower is better
      }
      return b.value - a.value; // Higher is better
    });

    // Assign ranks (handle ties with average rank)
    let rank = 1;
    let i = 0;
    while (i < teamValues.length) {
      // Find all teams with the same value (ties)
      const currentValue = teamValues[i].value;
      const tiedTeams: number[] = [i];

      while (i + 1 < teamValues.length && teamValues[i + 1].value === currentValue) {
        i++;
        tiedTeams.push(i);
      }

      // Calculate average rank for tied teams
      const avgRank = tiedTeams.reduce((sum, idx) => sum + (rank + idx - tiedTeams[0]), 0) / tiedTeams.length;

      // Assign rank to all tied teams
      tiedTeams.forEach(idx => {
        const teamIndex = teamValues[idx].index;
        results[teamIndex].categories[category] = {
          value: currentValue,
          rank: avgRank,
          isLowerBetter,
        };
        // Add to roto points (in roto, you get points equal to your rank position from bottom)
        // So 1st place gets numTeams points, last place gets 1 point
        const rotoPoints = teamValues.length - avgRank + 1;
        results[teamIndex].totalRotoPoints += rotoPoints;
      });

      rank += tiedTeams.length;
      i++;
    }
  });

  // Calculate overall rank by total roto points (higher is better)
  const sortedByPoints = [...results].sort((a, b) => b.totalRotoPoints - a.totalRotoPoints);

  // Assign overall ranks (handle ties)
  let rank = 1;
  let i = 0;
  while (i < sortedByPoints.length) {
    const currentPoints = sortedByPoints[i].totalRotoPoints;
    const tiedTeams: TeamProjectedStats[] = [sortedByPoints[i]];

    while (i + 1 < sortedByPoints.length && sortedByPoints[i + 1].totalRotoPoints === currentPoints) {
      i++;
      tiedTeams.push(sortedByPoints[i]);
    }

    // Assign same rank to tied teams
    tiedTeams.forEach(team => {
      team.overallRank = rank;
    });

    rank += tiedTeams.length;
    i++;
  }

  // Return sorted by overall rank
  return results.sort((a, b) => a.overallRank - b.overallRank);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a category is a "lower is better" category
 */
export function isLowerBetterCategory(category: string): boolean {
  return LOWER_IS_BETTER_CATEGORIES.has(category);
}

/**
 * Format stat value for display
 */
export function formatStatValue(value: number, category: string): string {
  // Rate stats - show 3 decimal places
  if (HITTING_RATIO_STATS.has(category)) {
    if (category === 'OPS') {
      return value.toFixed(3);
    }
    return value.toFixed(3).replace(/^0/, ''); // Remove leading zero for AVG, OBP, SLG
  }

  // ERA, WHIP - show 2 decimal places
  if (category === 'ERA' || category === 'WHIP') {
    return value.toFixed(2);
  }

  // K/9, BB/9 - show 1 decimal place
  if (category === 'K/9' || category === 'K9' || category === 'BB/9' || category === 'BB9') {
    return value.toFixed(1);
  }

  // IP - show 1 decimal place
  if (category === 'IP') {
    return value.toFixed(1);
  }

  // Counting stats - show whole number
  return Math.round(value).toString();
}

/**
 * Get display name for category
 */
export function getCategoryDisplayName(category: string): string {
  const displayNames: Record<string, string> = {
    'R': 'R',
    'HR': 'HR',
    'RBI': 'RBI',
    'SB': 'SB',
    'H': 'H',
    'BB': 'BB',
    'AVG': 'AVG',
    'OBP': 'OBP',
    'SLG': 'SLG',
    'OPS': 'OPS',
    'W': 'W',
    'K': 'K',
    'ERA': 'ERA',
    'WHIP': 'WHIP',
    'SV': 'SV',
    'IP': 'IP',
    'QS': 'QS',
    'HLD': 'HLD',
    'HD': 'HLD',
    'SVH': 'SV+H',
    'SV+HD': 'SV+H',
    'K/9': 'K/9',
    'K9': 'K/9',
    'BB/9': 'BB/9',
    'BB9': 'BB/9',
    'K/BB': 'K/BB',
    'K_BB': 'K/BB',
  };
  return displayNames[category] || category;
}

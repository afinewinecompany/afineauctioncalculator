/**
 * Value Calculator Service
 * Calculates auction dollar values based on league settings and projections
 *
 * Key principle: Only players in the draftable pool get auction values.
 * Players outside the pool = $0 until they appear on the auction block.
 */

import type {
  NormalizedProjection,
  PlayerWithValue,
  CalculatedValuesResult,
  HittingStats,
  PitchingStats,
} from '../types/projections';
import type { LeagueSettings } from '../../src/lib/types';

// Default hitter/pitcher budget split
const DEFAULT_HITTER_SPLIT = 0.68;
const DEFAULT_PITCHER_SPLIT = 0.32;

// Minimum auction value for players in the pool
const MIN_AUCTION_VALUE = 1;

/**
 * Main entry point for calculating auction values
 */
export function calculateAuctionValues(
  projections: NormalizedProjection[],
  settings: LeagueSettings
): CalculatedValuesResult {
  // Calculate total roster spots and budget
  const totalRosterSpots = calculateTotalRosterSpots(settings);
  const totalBudget = settings.numTeams * settings.budgetPerTeam;
  const draftablePoolSize = settings.numTeams * totalRosterSpots;

  // Get budget split (use settings or defaults)
  const hitterSplit = settings.hitterPitcherSplit?.hitter ?? DEFAULT_HITTER_SPLIT;
  const pitcherSplit = settings.hitterPitcherSplit?.pitcher ?? DEFAULT_PITCHER_SPLIT;

  // Calculate hitter and pitcher roster needs
  const { hitterSpots, pitcherSpots } = calculatePositionNeeds(settings);
  const hitterPoolSize = settings.numTeams * hitterSpots;
  const pitcherPoolSize = settings.numTeams * pitcherSpots;

  const hitterBudget = Math.round(totalBudget * hitterSplit);
  const pitcherBudget = totalBudget - hitterBudget;

  // Separate hitters and pitchers
  const hitters = projections.filter(p => p.playerType === 'hitter');
  const pitchers = projections.filter(p => p.playerType === 'pitcher');

  // Calculate values based on scoring type
  let playersWithValues: PlayerWithValue[];

  switch (settings.scoringType) {
    case 'rotisserie':
    case 'h2h-categories':
      playersWithValues = calculateCategoryValues(
        hitters,
        pitchers,
        settings,
        hitterPoolSize,
        pitcherPoolSize,
        hitterBudget,
        pitcherBudget
      );
      break;
    case 'h2h-points':
      playersWithValues = calculatePointsValues(
        hitters,
        pitchers,
        settings,
        hitterPoolSize,
        pitcherPoolSize,
        hitterBudget,
        pitcherBudget
      );
      break;
    default:
      throw new Error(`Unknown scoring type: ${settings.scoringType}`);
  }

  return {
    projectionSystem: settings.projectionSystem,
    calculatedAt: new Date().toISOString(),
    leagueSummary: {
      numTeams: settings.numTeams,
      budgetPerTeam: settings.budgetPerTeam,
      totalBudget,
      scoringType: settings.scoringType,
      draftablePoolSize,
      hitterPoolSize,
      pitcherPoolSize,
      hitterBudget,
      pitcherBudget,
    },
    players: playersWithValues,
  };
}

/**
 * Calculate values for Rotisserie and H2H Categories leagues using SGP
 */
function calculateCategoryValues(
  hitters: NormalizedProjection[],
  pitchers: NormalizedProjection[],
  settings: LeagueSettings,
  hitterPoolSize: number,
  pitcherPoolSize: number,
  hitterBudget: number,
  pitcherBudget: number
): PlayerWithValue[] {
  const enabledHittingCats = getEnabledHittingCategories(settings);
  const enabledPitchingCats = getEnabledPitchingCategories(settings);

  // Calculate SGP for all hitters
  const hitterSGPs = calculateHitterSGPs(hitters, enabledHittingCats, hitterPoolSize);

  // Calculate SGP for all pitchers
  const pitcherSGPs = calculatePitcherSGPs(pitchers, enabledPitchingCats, pitcherPoolSize);

  // Sort by SGP and take top N for each pool
  const sortedHitters = [...hitterSGPs].sort((a, b) => b.sgp - a.sgp);
  const sortedPitchers = [...pitcherSGPs].sort((a, b) => b.sgp - a.sgp);

  // Calculate total SGP for players IN the pool
  const poolHitters = sortedHitters.slice(0, hitterPoolSize);
  const poolPitchers = sortedPitchers.slice(0, pitcherPoolSize);

  const totalHitterSGP = poolHitters.reduce((sum, h) => sum + Math.max(0, h.sgp), 0);
  const totalPitcherSGP = poolPitchers.reduce((sum, p) => sum + Math.max(0, p.sgp), 0);

  // Convert SGP to dollar values
  const hitterResults = convertSGPToDollars(
    sortedHitters,
    hitterPoolSize,
    hitterBudget,
    totalHitterSGP
  );

  const pitcherResults = convertSGPToDollars(
    sortedPitchers,
    pitcherPoolSize,
    pitcherBudget,
    totalPitcherSGP
  );

  return [...hitterResults, ...pitcherResults];
}

/**
 * Calculate values for H2H Points leagues
 */
function calculatePointsValues(
  hitters: NormalizedProjection[],
  pitchers: NormalizedProjection[],
  settings: LeagueSettings,
  hitterPoolSize: number,
  pitcherPoolSize: number,
  hitterBudget: number,
  pitcherBudget: number
): PlayerWithValue[] {
  const pointSettings = settings.pointsSettings || {};

  // Calculate total points for each hitter
  const hitterPoints = hitters.map(h => ({
    player: h,
    points: calculateHitterPoints(h.hitting!, pointSettings),
  }));

  // Calculate total points for each pitcher
  const pitcherPoints = pitchers.map(p => ({
    player: p,
    points: calculatePitcherPoints(p.pitching!, pointSettings),
  }));

  // Sort by points
  const sortedHitters = [...hitterPoints].sort((a, b) => b.points - a.points);
  const sortedPitchers = [...pitcherPoints].sort((a, b) => b.points - a.points);

  // Get pool and calculate total points
  const poolHitters = sortedHitters.slice(0, hitterPoolSize);
  const poolPitchers = sortedPitchers.slice(0, pitcherPoolSize);

  const totalHitterPoints = poolHitters.reduce((sum, h) => sum + Math.max(0, h.points), 0);
  const totalPitcherPoints = poolPitchers.reduce((sum, p) => sum + Math.max(0, p.points), 0);

  // Convert points to dollars
  const hitterResults = convertPointsToDollars(
    sortedHitters,
    hitterPoolSize,
    hitterBudget,
    totalHitterPoints
  );

  const pitcherResults = convertPointsToDollars(
    sortedPitchers,
    pitcherPoolSize,
    pitcherBudget,
    totalPitcherPoints
  );

  return [...hitterResults, ...pitcherResults];
}

/**
 * Calculate SGP values for hitters
 */
function calculateHitterSGPs(
  hitters: NormalizedProjection[],
  enabledCategories: string[],
  poolSize: number
): Array<{ player: NormalizedProjection; sgp: number; categoryBreakdown: Record<string, number> }> {
  if (hitters.length === 0) return [];

  // Get stats for replacement-level calculation (top N players)
  const topHitters = [...hitters]
    .filter(h => h.hitting)
    .sort((a, b) => (b.hitting?.war || 0) - (a.hitting?.war || 0))
    .slice(0, poolSize);

  // Calculate averages and standard deviations for each category
  const categoryStats = calculateCategoryStats(topHitters, enabledCategories, 'hitting');

  // Calculate SGP for each hitter
  return hitters.map(hitter => {
    const breakdown: Record<string, number> = {};
    let totalSGP = 0;

    if (hitter.hitting) {
      for (const cat of enabledCategories) {
        const stats = categoryStats[cat];
        if (stats && stats.stdDev > 0) {
          const value = getHittingStat(hitter.hitting, cat);
          const sgp = (value - stats.avg) / stats.stdDev;
          breakdown[cat] = sgp;
          // Invert for negative categories (K for hitters is bad)
          totalSGP += cat === 'K' ? -sgp : sgp;
        }
      }
    }

    return {
      player: hitter,
      sgp: totalSGP,
      categoryBreakdown: breakdown,
    };
  });
}

/**
 * Calculate SGP values for pitchers
 */
function calculatePitcherSGPs(
  pitchers: NormalizedProjection[],
  enabledCategories: string[],
  poolSize: number
): Array<{ player: NormalizedProjection; sgp: number; categoryBreakdown: Record<string, number> }> {
  if (pitchers.length === 0) return [];

  // Get stats for replacement-level calculation
  const topPitchers = [...pitchers]
    .filter(p => p.pitching)
    .sort((a, b) => (b.pitching?.war || 0) - (a.pitching?.war || 0))
    .slice(0, poolSize);

  // Calculate averages and standard deviations
  const categoryStats = calculateCategoryStats(topPitchers, enabledCategories, 'pitching');

  return pitchers.map(pitcher => {
    const breakdown: Record<string, number> = {};
    let totalSGP = 0;

    if (pitcher.pitching) {
      for (const cat of enabledCategories) {
        const stats = categoryStats[cat];
        if (stats && stats.stdDev > 0) {
          const value = getPitchingStat(pitcher.pitching, cat);
          const sgp = (value - stats.avg) / stats.stdDev;
          breakdown[cat] = sgp;
          // Invert for negative categories (ERA, WHIP - lower is better)
          const isNegativeCat = ['ERA', 'WHIP', 'BB/9'].includes(cat);
          totalSGP += isNegativeCat ? -sgp : sgp;
        }
      }
    }

    return {
      player: pitcher,
      sgp: totalSGP,
      categoryBreakdown: breakdown,
    };
  });
}

/**
 * Calculate category statistics (avg, stddev) for a group of players
 */
function calculateCategoryStats(
  players: NormalizedProjection[],
  categories: string[],
  type: 'hitting' | 'pitching'
): Record<string, { avg: number; stdDev: number }> {
  const stats: Record<string, { avg: number; stdDev: number }> = {};

  for (const cat of categories) {
    const values = players
      .map(p => {
        if (type === 'hitting' && p.hitting) {
          return getHittingStat(p.hitting, cat);
        } else if (type === 'pitching' && p.pitching) {
          return getPitchingStat(p.pitching, cat);
        }
        return 0;
      })
      .filter(v => v !== 0);

    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      // Use sample variance (Bessel's correction: N-1) instead of population variance (N)
      // This provides an unbiased estimate of variance for sample data
      const variance = values.length > 1
        ? values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1)
        : 0;
      const stdDev = Math.sqrt(variance);

      stats[cat] = { avg, stdDev: stdDev || 1 }; // Avoid division by zero
    }
  }

  return stats;
}

/**
 * Get a hitting stat value by category code
 */
function getHittingStat(stats: HittingStats, category: string): number {
  switch (category) {
    case 'R': return stats.runs;
    case 'HR': return stats.homeRuns;
    case 'RBI': return stats.rbi;
    case 'SB': return stats.stolenBases;
    case 'AVG': return stats.battingAvg;
    case 'OBP': return stats.onBasePct;
    case 'SLG': return stats.sluggingPct;
    case 'OPS': return stats.ops;
    case 'H': return stats.hits;
    case 'XBH': return stats.doubles + stats.triples + stats.homeRuns;
    case 'K': return stats.strikeouts;
    case 'BB': return stats.walks;
    default: return 0;
  }
}

/**
 * Estimates Quality Starts from IP, ERA, and GS
 * QS = 6+ IP with 3 or fewer ER
 *
 * Uses historical QS/GS ratios based on ERA and average IP per start:
 * - Elite starters (6.5+ IP/start, ERA <= 3.50): ~75% QS rate
 * - Good starters (6.0+ IP/start, ERA <= 4.00): ~65% QS rate
 * - Average starters (5.5+ IP/start, ERA <= 4.50): ~50% QS rate
 * - Below average (5.0+ IP/start): ~35% QS rate
 * - Poor starters: ~20% QS rate
 */
function estimateQualityStarts(stats: PitchingStats): number {
  if (stats.gamesStarted === 0) return 0;

  const avgIPperStart = stats.inningsPitched / stats.gamesStarted;

  let qsRate = 0;

  if (avgIPperStart >= 6.5 && stats.era <= 3.50) {
    qsRate = 0.75; // Elite starters
  } else if (avgIPperStart >= 6.0 && stats.era <= 4.00) {
    qsRate = 0.65; // Good starters
  } else if (avgIPperStart >= 5.5 && stats.era <= 4.50) {
    qsRate = 0.50; // Average starters
  } else if (avgIPperStart >= 5.0) {
    qsRate = 0.35; // Below average starters
  } else {
    qsRate = 0.20; // Poor starters / spot starters
  }

  return Math.round(stats.gamesStarted * qsRate);
}

/**
 * Get a pitching stat value by category code
 */
function getPitchingStat(stats: PitchingStats, category: string): number {
  switch (category) {
    case 'W': return stats.wins;
    case 'K': return stats.strikeouts;
    case 'ERA': return stats.era;
    case 'WHIP': return stats.whip;
    case 'SV': return stats.saves;
    case 'QS': return estimateQualityStarts(stats);
    case 'K/BB': return stats.walks > 0 ? stats.strikeouts / stats.walks : 0;
    case 'K/9': return stats.k9;
    case 'IP': return stats.inningsPitched;
    case 'SV+HD': return stats.saves + stats.holds;
    case 'HD': return stats.holds;
    default: return 0;
  }
}

/**
 * Convert SGP values to dollar values
 * Includes budget normalization to ensure values sum exactly to total budget
 */
function convertSGPToDollars(
  players: Array<{ player: NormalizedProjection; sgp: number; categoryBreakdown?: Record<string, number> }>,
  poolSize: number,
  totalBudget: number,
  totalPoolSGP: number
): PlayerWithValue[] {
  // Reserve $1 per player in pool
  const reservedDollars = poolSize * MIN_AUCTION_VALUE;
  const distributableDollars = totalBudget - reservedDollars;

  const results = players.map((p, index) => {
    const isInPool = index < poolSize;
    let auctionValue = 0;

    if (isInPool && totalPoolSGP > 0 && p.sgp > 0) {
      // Distribute remaining dollars proportionally to SGP
      const sgpShare = p.sgp / totalPoolSGP;
      auctionValue = MIN_AUCTION_VALUE + Math.round(sgpShare * distributableDollars);
    } else if (isInPool) {
      // In pool but negative/zero SGP - gets minimum
      auctionValue = MIN_AUCTION_VALUE;
    }
    // Players outside pool get $0

    return {
      ...p.player,
      auctionValue,
      sgpValue: p.sgp,
      tier: calculateTier(index, poolSize),
      isInDraftPool: isInPool,
    };
  });

  // Normalize to ensure exact budget match (handles rounding errors)
  const playersInPool = results.filter(p => p.isInDraftPool);
  const totalAllocated = playersInPool.reduce((sum, p) => sum + p.auctionValue, 0);

  if (totalAllocated !== totalBudget && playersInPool.length > 0) {
    const difference = totalBudget - totalAllocated;
    // Apply adjustment to the top player (most value, smallest relative impact)
    const topPlayer = playersInPool[0];
    if (topPlayer) {
      topPlayer.auctionValue = Math.max(MIN_AUCTION_VALUE, topPlayer.auctionValue + difference);
    }
  }

  return results;
}

/**
 * Calculate total points for a hitter
 */
function calculateHitterPoints(
  stats: HittingStats,
  pointSettings: NonNullable<LeagueSettings['pointsSettings']>
): number {
  let points = 0;

  // Singles (H - 2B - 3B - HR)
  points += (stats.hits - stats.doubles - stats.triples - stats.homeRuns) * (pointSettings.H || 1);
  points += stats.doubles * (pointSettings['2B'] || 2);
  points += stats.triples * (pointSettings['3B'] || 3);
  points += stats.homeRuns * (pointSettings.HR || 4);
  points += stats.rbi * (pointSettings.RBI || 1);
  points += stats.runs * (pointSettings.R || 1);
  points += stats.stolenBases * (pointSettings.SB || 2);
  points += stats.walks * (pointSettings.BB || 1);
  points += stats.strikeouts * (pointSettings.K_hitter || -1);

  return points;
}

/**
 * Calculate total points for a pitcher
 */
function calculatePitcherPoints(
  stats: PitchingStats,
  pointSettings: NonNullable<LeagueSettings['pointsSettings']>
): number {
  let points = 0;

  points += stats.inningsPitched * (pointSettings.IP || 3);
  points += stats.wins * (pointSettings.W || 5);
  points += stats.strikeouts * (pointSettings.K_pitcher || 1);
  points += stats.saves * (pointSettings.SV || 5);
  points += stats.holds * (pointSettings.HD || 2);
  points += stats.earnedRuns * (pointSettings.ER || -2);
  points += stats.hitsAllowed * (pointSettings.H_allowed || -1);
  points += stats.walks * (pointSettings.BB_allowed || -1);

  return points;
}

/**
 * Convert points to dollar values
 * Includes budget normalization to ensure values sum exactly to total budget
 */
function convertPointsToDollars(
  players: Array<{ player: NormalizedProjection; points: number }>,
  poolSize: number,
  totalBudget: number,
  totalPoolPoints: number
): PlayerWithValue[] {
  const reservedDollars = poolSize * MIN_AUCTION_VALUE;
  const distributableDollars = totalBudget - reservedDollars;

  const results = players.map((p, index) => {
    const isInPool = index < poolSize;
    let auctionValue = 0;

    if (isInPool && totalPoolPoints > 0 && p.points > 0) {
      const pointsShare = p.points / totalPoolPoints;
      auctionValue = MIN_AUCTION_VALUE + Math.round(pointsShare * distributableDollars);
    } else if (isInPool) {
      auctionValue = MIN_AUCTION_VALUE;
    }

    return {
      ...p.player,
      auctionValue,
      pointsValue: p.points,
      tier: calculateTier(index, poolSize),
      isInDraftPool: isInPool,
    };
  });

  // Normalize to ensure exact budget match (handles rounding errors)
  const playersInPool = results.filter(p => p.isInDraftPool);
  const totalAllocated = playersInPool.reduce((sum, p) => sum + p.auctionValue, 0);

  if (totalAllocated !== totalBudget && playersInPool.length > 0) {
    const difference = totalBudget - totalAllocated;
    // Apply adjustment to the top player (most value, smallest relative impact)
    const topPlayer = playersInPool[0];
    if (topPlayer) {
      topPlayer.auctionValue = Math.max(MIN_AUCTION_VALUE, topPlayer.auctionValue + difference);
    }
  }

  return results;
}

/**
 * Calculate tier (1-10) based on ranking within pool
 * Uses percentile-based assignment for consistent tier sizes regardless of pool size
 */
function calculateTier(rank: number, poolSize: number): number {
  if (rank >= poolSize) return 10; // Outside pool
  if (poolSize === 0) return 10;
  // Percentile-based tier assignment: each tier gets ~10% of players
  // rank 0 = tier 1, rank poolSize-1 = tier 10
  return Math.min(10, Math.ceil(((rank + 1) / poolSize) * 10));
}

/**
 * Calculate total roster spots from settings
 */
function calculateTotalRosterSpots(settings: LeagueSettings): number {
  const rs = settings.rosterSpots;
  return (
    rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
    rs.OF + rs.CI + rs.MI + rs.UTIL +
    rs.SP + rs.RP + rs.P + rs.Bench
  );
}

/**
 * Calculate hitter and pitcher spot needs
 */
function calculatePositionNeeds(settings: LeagueSettings): { hitterSpots: number; pitcherSpots: number } {
  const rs = settings.rosterSpots;

  const hitterSpots = rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
    rs.OF + rs.CI + rs.MI + rs.UTIL;

  const pitcherSpots = rs.SP + rs.RP + rs.P;

  // Bench can be either - split proportionally
  const totalActive = hitterSpots + pitcherSpots;
  const hitterRatio = hitterSpots / totalActive;
  const benchHitters = Math.round(rs.Bench * hitterRatio);
  const benchPitchers = rs.Bench - benchHitters;

  return {
    hitterSpots: hitterSpots + benchHitters,
    pitcherSpots: pitcherSpots + benchPitchers,
  };
}

/**
 * Get enabled hitting categories from settings
 * Defaults to standard 5x5 categories if none specified
 */
function getEnabledHittingCategories(settings: LeagueSettings): string[] {
  const cats = settings.hittingCategories || {};
  const enabled = Object.entries(cats)
    .filter(([_, enabled]) => enabled)
    .map(([cat]) => cat);

  // Default to standard 5x5 hitting categories if none specified
  if (enabled.length === 0) {
    return ['R', 'HR', 'RBI', 'SB', 'AVG'];
  }
  return enabled;
}

/**
 * Get enabled pitching categories from settings
 * Defaults to standard 5x5 categories if none specified
 */
function getEnabledPitchingCategories(settings: LeagueSettings): string[] {
  const cats = settings.pitchingCategories || {};
  const enabled = Object.entries(cats)
    .filter(([_, enabled]) => enabled)
    .map(([cat]) => cat);

  // Default to standard 5x5 pitching categories if none specified
  if (enabled.length === 0) {
    return ['W', 'K', 'ERA', 'WHIP', 'SV'];
  }
  return enabled;
}

import { Player, LeagueSettings, DraftedPlayer, PositionalScarcity, TeamBudgetConstraint } from './types';

// Type for players that have been drafted (with price information)
type DraftedPlayerLike = Pick<Player, 'draftedPrice' | 'projectedValue' | 'tier'>;

/**
 * Normalizes a player name by removing diacritics, punctuation, and converting to lowercase.
 * This ensures matching works correctly for names like:
 * - "Félix Bautista" → "felix bautista"
 * - "Ronald Acuña Jr." → "ronald acuna jr"
 * - "J.T. Realmuto" → "jt realmuto"
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
    .toLowerCase()
    .replace(/\./g, '') // Remove periods (J.T. → JT)
    .replace(/[^a-z\s]/g, '') // Remove other punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Type for all players (needed for tier-weighted calculation)
// Includes currentBid for on_block players to count them in inflation
type PlayerLike = Pick<Player, 'projectedValue' | 'tier' | 'status'> & { currentBid?: number };

/**
 * Historical inflation baselines from Couch Managers auction analysis
 * Based on analysis of 6 auctions with ~500 players each
 * Generated: 2025-12-24
 */
export const HISTORICAL_INFLATION_BASELINES = {
  // Overall statistics
  overall: {
    avgInflationRate: 20.33,
    stdDeviation: 44.83,
    minInflationRate: -28.04,
    maxInflationRate: 100.62,
  },

  // Tier-based inflation (Tier 1 = top 10%, Tier 10 = bottom 10%)
  // Key insight: Elite players (Tier 1) are DEFLATED, low-value players are extremely inflated
  byTier: {
    1: { avgInflation: -19.84, label: 'Elite (top 10%)', insight: 'Often go BELOW projection' },
    2: { avgInflation: 21.93, label: 'Star', insight: 'Slight premium expected' },
    3: { avgInflation: 59.39, label: 'Quality starter', insight: 'Moderate inflation' },
    4: { avgInflation: 548.34, label: 'Above average', insight: 'High inflation zone' },
    5: { avgInflation: 1000.43, label: 'Average', insight: 'Extreme inflation' },
    6: { avgInflation: 952.83, label: 'Below average', insight: 'Extreme inflation' },
    7: { avgInflation: 1580.36, label: 'Roster filler', insight: 'HIGHEST inflation tier' },
    8: { avgInflation: 1090.76, label: 'Deep bench', insight: 'Extreme inflation' },
    9: { avgInflation: 1365.35, label: 'Speculative', insight: 'Very high inflation' },
    10: { avgInflation: 1100.30, label: 'Lottery ticket', insight: 'Extreme inflation' },
  } as Record<number, { avgInflation: number; label: string; insight: string }>,

  // Price range inflation patterns
  // Key insight: Low-value players have EXTREME inflation, elite players are often discounted
  byPriceRange: [
    { range: '$1-$5', avgInflation: 991.64, trend: 'extreme', advice: 'Avoid unless must-have' },
    { range: '$6-$15', avgInflation: 74.42, trend: 'moderate', advice: 'Budget 50-75% extra' },
    { range: '$16-$30', avgInflation: 18.23, trend: 'normal', advice: 'Budget 10-20% extra' },
    { range: '$31+', avgInflation: -17.54, trend: 'deflated', advice: 'Often go BELOW projection - be patient' },
  ],

  // Position-based inflation patterns
  byPosition: {
    MiLB: { avgInflation: 1347.40, trend: 'severely_inflated', advice: 'Speculative - avoid overbidding' },
    RP: { avgInflation: 974.62, trend: 'severely_inflated', advice: 'High demand - target early or late' },
    SP: { avgInflation: 870.42, trend: 'severely_inflated', advice: 'High demand - target early or late' },
    C: { avgInflation: 268.48, trend: 'highly_inflated', advice: 'Scarce position - budget extra' },
    '2B': { avgInflation: 153.76, trend: 'moderately_inflated', advice: 'Moderate premium' },
    '3B': { avgInflation: 128.25, trend: 'moderately_inflated', advice: 'Moderate premium' },
    OF: { avgInflation: 83.86, trend: 'slightly_inflated', advice: 'Deep position - can wait' },
    '1B': { avgInflation: 83.73, trend: 'slightly_inflated', advice: 'Deep position - can wait' },
    SS: { avgInflation: 76.35, trend: 'slightly_inflated', advice: 'Moderate depth' },
    DH: { avgInflation: 69.42, trend: 'slightly_inflated', advice: 'Low priority position' },
  } as Record<string, { avgInflation: number; trend: string; advice: string }>,
};

/**
 * Tier inflation data - tracks inflation by player tier
 */
export interface TierInflationData {
  tier: number;
  draftedCount: number;
  totalProjectedValue: number;
  totalActualSpent: number;
  inflationRate: number; // As decimal (0.15 = 15%)
}

/**
 * Result from tier-weighted inflation calculation
 */
export interface InflationResult {
  overallInflationRate: number; // Weighted average inflation rate
  tierInflation: TierInflationData[];
  remainingBudget: number;
  remainingProjectedValue: number;
  // Enhanced fields from server-side calculation
  positionalScarcity?: PositionalScarcity[];
  teamConstraints?: TeamBudgetConstraint[];
  leagueEffectiveBudget?: number;
  adjustedRemainingBudget?: number;
}

/**
 * Calculates tier-weighted inflation based on how drafted players performed
 * relative to their projected values, with higher-tier players weighted more heavily.
 *
 * This is the primary inflation calculation that should be used.
 */
export function calculateTierWeightedInflation(
  leagueSettings: LeagueSettings,
  allDrafted: DraftedPlayerLike[],
  allPlayers: PlayerLike[]
): InflationResult {
  const totalBudget = leagueSettings.numTeams * leagueSettings.budgetPerTeam;

  // Initialize tier data (tiers 1-10)
  const tierData: Map<number, TierInflationData> = new Map();
  for (let i = 1; i <= 10; i++) {
    tierData.set(i, {
      tier: i,
      draftedCount: 0,
      totalProjectedValue: 0,
      totalActualSpent: 0,
      inflationRate: 0,
    });
  }

  // Process drafted players by tier
  allDrafted.forEach(player => {
    const tier = player.tier || 10; // Default to tier 10 if not set
    const data = tierData.get(tier)!;
    data.draftedCount++;
    data.totalProjectedValue += player.projectedValue || 0;
    data.totalActualSpent += player.draftedPrice || 0;
  });

  // Also include on_block players in inflation calculation
  // Their currentBid represents the likely final cost, so treat them as "virtually drafted"
  allPlayers.forEach(player => {
    if (player.status === 'on_block' && player.currentBid !== undefined) {
      const tier = player.tier || 10;
      const data = tierData.get(tier)!;
      data.draftedCount++;
      data.totalProjectedValue += player.projectedValue || 0;
      data.totalActualSpent += player.currentBid;
    }
  });

  // Calculate inflation rate for each tier
  tierData.forEach(data => {
    if (data.totalProjectedValue > 0) {
      data.inflationRate = (data.totalActualSpent - data.totalProjectedValue) / data.totalProjectedValue;
    }
  });

  // Calculate weighted average inflation (weight by projected value - higher value tiers matter more)
  let totalWeight = 0;
  let weightedInflationSum = 0;

  tierData.forEach(data => {
    if (data.draftedCount > 0) {
      // Weight by total projected value in this tier (not count)
      const weight = data.totalProjectedValue;
      totalWeight += weight;
      weightedInflationSum += data.inflationRate * weight;
    }
  });

  const overallInflationRate = totalWeight > 0 ? weightedInflationSum / totalWeight : 0;

  // Calculate remaining budget and projected value
  // Include on_block players' currentBid as money that's "virtually spent"
  const draftedMoneySpent = allDrafted.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
  const onBlockMoneyCommitted = allPlayers
    .filter(p => p.status === 'on_block' && p.currentBid !== undefined)
    .reduce((sum, p) => sum + (p.currentBid || 0), 0);
  const moneySpent = draftedMoneySpent + onBlockMoneyCommitted;
  const remainingBudget = totalBudget - moneySpent;

  // Only 'available' players are truly remaining
  // on_block players are "virtually drafted" at their current bid
  const remainingProjectedValue = allPlayers
    .filter(p => p.status === 'available')
    .reduce((sum, p) => sum + (p.projectedValue || 0), 0);

  return {
    overallInflationRate: Math.round(overallInflationRate * 100) / 100, // Round to 2 decimal places
    tierInflation: Array.from(tierData.values()),
    remainingBudget,
    remainingProjectedValue,
  };
}

/**
 * Simple inflation calculation (legacy - for backward compatibility)
 * Use calculateTierWeightedInflation for more accurate results.
 */
export function calculateInflation(
  leagueSettings: LeagueSettings,
  allDrafted: DraftedPlayerLike[]
): number {
  const totalBudget = leagueSettings.numTeams * leagueSettings.budgetPerTeam;
  const totalRosterSpots = leagueSettings.numTeams * Object.values(leagueSettings.rosterSpots).reduce((a, b) => a + b, 0);

  // Calculate money spent so far
  const moneySpent = allDrafted.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
  const moneyRemaining = totalBudget - moneySpent;

  // Calculate players drafted
  const playersDrafted = allDrafted.length;
  const playersRemaining = totalRosterSpots - playersDrafted;

  if (playersRemaining === 0) return 0;

  // Use actual projected values if available, otherwise estimate
  const totalProjectedValue = allDrafted.reduce((sum, p) => sum + (p.projectedValue || 0), 0);
  const totalActualSpent = moneySpent;

  // If we have real data, use actual inflation calculation
  if (totalProjectedValue > 0 && playersDrafted > 0) {
    // Calculate remaining expected value based on drafted player average
    const avgProjectedPerDrafted = totalProjectedValue / playersDrafted;
    const expectedRemainingValue = playersRemaining * avgProjectedPerDrafted;

    if (expectedRemainingValue === 0) return 0;

    const inflationRate = (moneyRemaining / expectedRemainingValue) - 1;
    return Math.round(inflationRate * 100) / 100;
  }

  // Fallback: estimate based on average per-player value
  const avgProjectedValue = (totalBudget * 0.95) / totalRosterSpots;
  const expectedRemainingValue = playersRemaining * avgProjectedValue;

  if (expectedRemainingValue === 0) return 0;

  const inflationRate = (moneyRemaining / expectedRemainingValue) - 1;

  return Math.round(inflationRate * 100) / 100;
}

/**
 * Simple inflation adjustment (legacy - applies same rate to all players)
 * Use adjustPlayerValuesWithTiers for correct behavior.
 */
export function adjustPlayerValues(
  players: Player[],
  inflationRate: number
): Player[] {
  return players.map(player => ({
    ...player,
    adjustedValue: Math.round(player.projectedValue * (1 + inflationRate))
  }));
}

/**
 * Adjusts player values based on their status, remaining budget inflation,
 * and positional scarcity.
 *
 * For DRAFTED players:
 * - adjustedValue = the actual price paid (draftedPrice)
 * - This allows UI to calculate and display the surplus/deficit vs projectedValue
 *
 * For AVAILABLE players:
 * - Use REMAINING BUDGET INFLATION method:
 *   adjustedValue = projectedValue × (remainingBudget / remainingProjectedValue)
 * - Apply POSITIONAL SCARCITY adjustment:
 *   Multi-position players get the HIGHEST scarcity adjustment among their positions
 *   - Severe scarcity: +25%
 *   - Moderate scarcity: +12%
 *   - Normal: no adjustment
 *   - Surplus: -5%
 *
 * KEY INSIGHT on why this is better than tier-specific rates:
 * - Low-tier players (Tier 7-10) often have EXTREME inflation rates (200-500%)
 *   because a $1 player going for $5 = 400% inflation
 * - High-tier players (Tier 1-3) have modest inflation (20-50%)
 *   because a $30 player going for $40 = 33% inflation
 * - The remaining budget method automatically accounts for this by looking at
 *   total money left vs total value left, regardless of how it was distributed
 *
 * Example: If $1000 remains and $800 of projected value remains:
 *   - Inflation multiplier = 1000/800 = 1.25 (25% inflation)
 *   - $40 projected player → $50 adjusted
 *   - $10 projected player → $12.50 adjusted
 *   - $1 projected player  → $1.25 adjusted → rounds to $1
 */
export function adjustPlayerValuesWithTiers(
  players: Player[],
  inflationResult: InflationResult
): Player[] {
  // Use effective remaining budget if available, otherwise raw remaining budget
  const effectiveBudget = inflationResult.adjustedRemainingBudget ?? inflationResult.remainingBudget;
  const { remainingProjectedValue, positionalScarcity } = inflationResult;

  // Build scarcity lookup by position
  const scarcityByPosition = new Map<string, PositionalScarcity>();
  positionalScarcity?.forEach(ps => scarcityByPosition.set(ps.position, ps));

  // If no remaining value, use overall rate as fallback
  let baseInflationMultiplier: number;
  if (remainingProjectedValue > 0) {
    // Remaining budget method: money_left / value_left
    baseInflationMultiplier = effectiveBudget / remainingProjectedValue;
  } else {
    // Fallback to overall rate (as a multiplier, not percentage)
    baseInflationMultiplier = 1 + inflationResult.overallInflationRate;
  }

  return players.map(player => {
    // For drafted players: store the actual price paid
    if (player.status === 'drafted' || player.status === 'onMyTeam') {
      return {
        ...player,
        adjustedValue: player.draftedPrice || 0,
      };
    }

    // Get highest scarcity adjustment among player's positions
    let maxScarcityAdjustment = 1.0;
    let highestScarcityLevel: PositionalScarcity['scarcityLevel'] | undefined;

    player.positions.forEach(pos => {
      const scarcity = scarcityByPosition.get(pos);
      if (scarcity && scarcity.inflationAdjustment > maxScarcityAdjustment) {
        maxScarcityAdjustment = scarcity.inflationAdjustment;
        highestScarcityLevel = scarcity.scarcityLevel;
      }
    });

    // Apply both base inflation and positional scarcity
    const finalMultiplier = baseInflationMultiplier * maxScarcityAdjustment;
    const adjustedValue = Math.round(player.projectedValue * finalMultiplier);

    return {
      ...player,
      adjustedValue: Math.max(1, adjustedValue), // Minimum $1
    };
  });
}

/**
 * Calculates the surplus/deficit for a drafted player
 * Positive = overpay, Negative = steal/value
 */
export function getDraftSurplus(player: Player): number | null {
  if (player.status !== 'drafted' && player.status !== 'onMyTeam') {
    return null;
  }
  if (player.draftedPrice === undefined) {
    return null;
  }
  return player.draftedPrice - player.projectedValue;
}

export function getValueIndicator(bid: number, adjustedValue: number): {
  color: string;
  label: string;
  percentage: number;
} {
  if (adjustedValue === 0) {
    return { color: 'text-gray-500', label: 'N/A', percentage: 0 };
  }
  
  const percentage = ((bid - adjustedValue) / adjustedValue) * 100;
  
  if (percentage <= 20) {
    return { color: 'text-green-600', label: 'Great Deal', percentage };
  } else if (percentage <= 40) {
    return { color: 'text-yellow-600', label: 'Fair Value', percentage };
  } else if (percentage <= 60) {
    return { color: 'text-orange-600', label: 'Slightly Expensive', percentage };
  } else {
    return { color: 'text-red-600', label: 'Overpay', percentage };
  }
}

export function getInflationIndicator(inflationRate: number): {
  color: string;
  bgColor: string;
  label: string;
} {
  const percentage = inflationRate * 100;
  
  if (percentage < 5) {
    return { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Low' };
  } else if (percentage < 15) {
    return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Moderate' };
  } else if (percentage < 25) {
    return { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'High' };
  } else {
    return { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Very High' };
  }
}

export function calculateRosterNeeds(
  leagueSettings: LeagueSettings,
  myRoster: Player[]
): LeagueSettings['rosterSpots'] {
  const needs = { ...leagueSettings.rosterSpots };
  
  // Count filled positions (simplified - using primary position only)
  myRoster.forEach(player => {
    const primaryPosition = player.positions[0];
    if (primaryPosition in needs && needs[primaryPosition as keyof typeof needs] > 0) {
      needs[primaryPosition as keyof typeof needs]--;
    } else if (needs.Bench > 0) {
      needs.Bench--;
    }
  });
  
  return needs;
}

export function getPositionScarcity(
  position: string,
  players: Player[],
  threshold: number = 20
): 'high' | 'medium' | 'low' {
  const availableAtPosition = players.filter(
    p => p.status === 'available' && p.positions.includes(position)
  ).length;
  
  if (availableAtPosition < threshold * 0.3) return 'high';
  if (availableAtPosition < threshold * 0.6) return 'medium';
  return 'low';
}

/**
 * Strategic bid analysis result - helps users understand realistic bidding limits
 */
export interface StrategicBidAnalysis {
  /** Budget after mandatory $1 reserves for remaining roster spots */
  effectiveBudget: number;
  /** Amount reserved for $1 minimum bids on remaining spots */
  mandatoryReserve: number;
  /** Max bid that leaves competitive $ for remaining roster (avg $2.50/spot) */
  competitiveMaxBid: number;
  /** Hard ceiling - 50% of effective budget (don't put all eggs in one basket) */
  absoluteMax: number;
  /** Recommended max bid (min of competitive and absolute) */
  recommendedMax: number;
  /** What % of effective budget the adjusted value represents */
  adjustedValuePercent: number;
  /** Risk level based on adjusted value vs limits */
  riskLevel: 'safe' | 'aggressive' | 'dangerous';
  /** Strategic advice message */
  advice: string;
}

/**
 * Calculates strategic bidding limits based on roster constraints.
 *
 * Key insight: You can't spend $171 on one player and fill 11 remaining spots
 * with $1 players and expect to win. This function provides realistic limits.
 *
 * @param moneyRemaining - User's remaining auction budget
 * @param rosterSpotsRemaining - Number of roster spots left to fill
 * @param adjustedValue - The player's inflation-adjusted value
 * @param projectedValue - The player's base projected value
 */
export function calculateStrategicMaxBid(
  moneyRemaining: number,
  rosterSpotsRemaining: number,
  adjustedValue: number,
  projectedValue: number
): StrategicBidAnalysis {
  // Calculate effective budget after $1 minimums for remaining spots
  // Reserve $1 for each remaining spot except the one we're bidding on
  const mandatoryReserve = Math.max(0, rosterSpotsRemaining - 1) * 1;
  const effectiveBudget = Math.max(0, moneyRemaining - mandatoryReserve);

  // Calculate "smart max" - leave enough to fill roster competitively
  // Historical data shows you need at least $2-3 average per remaining player
  // to have competitive depth. Using $2.50 as baseline.
  const competitiveReserve = Math.max(0, rosterSpotsRemaining - 1) * 2.5;
  const competitiveMaxBid = Math.max(1, moneyRemaining - competitiveReserve);

  // Hard ceiling - never more than 50% of effective budget on one player
  // This prevents roster-crippling bids
  const absoluteMax = Math.max(1, Math.floor(effectiveBudget * 0.5));

  // Recommended max is the more conservative of the two limits
  const recommendedMax = Math.min(competitiveMaxBid, absoluteMax);

  // Calculate what % of effective budget the adjusted value represents
  const adjustedValuePercent = effectiveBudget > 0
    ? Math.round((adjustedValue / effectiveBudget) * 100)
    : 100;

  // Determine risk level
  let riskLevel: 'safe' | 'aggressive' | 'dangerous';
  if (adjustedValue <= recommendedMax) {
    riskLevel = 'safe';
  } else if (adjustedValue <= effectiveBudget) {
    riskLevel = 'aggressive';
  } else {
    riskLevel = 'dangerous';
  }

  // Generate strategic advice based on player value tier and risk
  let advice: string;
  if (projectedValue >= 31) {
    // Elite player - historical data shows they go BELOW projection
    advice = 'Elite players ($31+) historically sell 17% BELOW projections. Be patient and let others overbid.';
  } else if (projectedValue <= 5) {
    // Low-value player - extreme inflation typical
    advice = 'Low-value players see extreme inflation (500%+). Only bid on must-haves for roster needs.';
  } else if (riskLevel === 'dangerous') {
    advice = `This adjusted value would use ${adjustedValuePercent}% of your effective budget. Consider waiting for similar players at better value.`;
  } else if (riskLevel === 'aggressive') {
    advice = `Bidding to adjusted value is aggressive but possible. You\'ll need bargains for remaining ${rosterSpotsRemaining - 1} spots.`;
  } else {
    advice = 'Adjusted value is within strategic limits. Bid confidently up to this amount.';
  }

  return {
    effectiveBudget,
    mandatoryReserve,
    competitiveMaxBid: Math.round(competitiveMaxBid),
    absoluteMax,
    recommendedMax: Math.round(recommendedMax),
    adjustedValuePercent,
    riskLevel,
    advice,
  };
}

export function calculateTeamProjectedStats(roster: Player[]): {
  totalSpent: number;
  projectedHR: number;
  projectedRBI: number;
  projectedSB: number;
  projectedW: number;
  projectedK: number;
  projectedSV: number;
} {
  return roster.reduce((acc, player) => ({
    totalSpent: acc.totalSpent + (player.draftedPrice || 0),
    projectedHR: acc.projectedHR + (player.projectedStats.HR || 0),
    projectedRBI: acc.projectedRBI + (player.projectedStats.RBI || 0),
    projectedSB: acc.projectedSB + (player.projectedStats.SB || 0),
    projectedW: acc.projectedW + (player.projectedStats.W || 0),
    projectedK: acc.projectedK + (player.projectedStats.K || 0),
    projectedSV: acc.projectedSV + (player.projectedStats.SV || 0),
  }), {
    totalSpent: 0,
    projectedHR: 0,
    projectedRBI: 0,
    projectedSB: 0,
    projectedW: 0,
    projectedK: 0,
    projectedSV: 0,
  });
}

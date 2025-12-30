import type {
  MatchedPlayer,
  InflationStats,
  ScrapedTeam,
  PositionalScarcity,
  TeamBudgetConstraint,
  EnhancedInflationStats,
} from '../types/auction.js';

interface LeagueConfig {
  numTeams: number;
  budgetPerTeam: number;
  totalRosterSpots: number;
  rosterSpots?: Record<string, number>;
}

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
    1: { avgInflation: -19.84, stdDev: 33.26, label: 'Elite (top 10%)' },
    2: { avgInflation: 21.93, stdDev: 37.58, label: 'Star' },
    3: { avgInflation: 59.39, stdDev: 35.22, label: 'Quality starter' },
    4: { avgInflation: 548.34, stdDev: 283.55, label: 'Above average' },
    5: { avgInflation: 1000.43, stdDev: 457.18, label: 'Average' },
    6: { avgInflation: 952.83, stdDev: 639.43, label: 'Below average' },
    7: { avgInflation: 1580.36, stdDev: 594.38, label: 'Roster filler' },
    8: { avgInflation: 1090.76, stdDev: 349.72, label: 'Deep bench' },
    9: { avgInflation: 1365.35, stdDev: 604.95, label: 'Speculative' },
    10: { avgInflation: 1100.30, stdDev: 244.64, label: 'Lottery ticket' },
  } as Record<number, { avgInflation: number; stdDev: number; label: string }>,

  // Position-based inflation patterns
  // Key insight: Pitching positions (especially RP, SP) and MiLB are heavily inflated
  byPosition: {
    MiLB: { avgInflation: 1347.40, stdDev: 719.12, trend: 'severely_inflated' },
    RP: { avgInflation: 974.62, stdDev: 1506.02, trend: 'severely_inflated' },
    SP: { avgInflation: 870.42, stdDev: 464.67, trend: 'severely_inflated' },
    C: { avgInflation: 268.48, stdDev: 125.35, trend: 'highly_inflated' },
    '2B': { avgInflation: 153.76, stdDev: 109.11, trend: 'moderately_inflated' },
    '3B': { avgInflation: 128.25, stdDev: 91.11, trend: 'moderately_inflated' },
    OF: { avgInflation: 83.86, stdDev: 72.57, trend: 'slightly_inflated' },
    '1B': { avgInflation: 83.73, stdDev: 78.59, trend: 'slightly_inflated' },
    SS: { avgInflation: 76.35, stdDev: 85.37, trend: 'slightly_inflated' },
    DH: { avgInflation: 69.42, stdDev: 56.79, trend: 'slightly_inflated' },
  } as Record<string, { avgInflation: number; stdDev: number; trend: string }>,

  // Price range inflation patterns
  // Key insight: Low-value players have EXTREME inflation, elite players are often discounted
  byPriceRange: {
    '$1-$5': { avgInflation: 991.64, stdDev: 374.33, trend: 'extreme' },
    '$6-$15': { avgInflation: 74.42, stdDev: 53.03, trend: 'moderate' },
    '$16-$30': { avgInflation: 18.23, stdDev: 36.55, trend: 'normal' },
    '$31+': { avgInflation: -17.54, stdDev: 36.13, trend: 'deflated' },
  } as Record<string, { avgInflation: number; stdDev: number; trend: string }>,
};

/**
 * Gets historical inflation context for a player based on their tier and value
 */
export function getHistoricalInflationContext(
  projectedValue: number,
  tier?: number,
  positions?: string[]
): {
  expectedInflation: number;
  priceRangeTrend: string;
  tierLabel: string;
  positionTrend: string;
  recommendation: string;
} {
  // Determine price range
  let priceRange: string;
  if (projectedValue <= 5) priceRange = '$1-$5';
  else if (projectedValue <= 15) priceRange = '$6-$15';
  else if (projectedValue <= 30) priceRange = '$16-$30';
  else priceRange = '$31+';

  const priceRangeData = HISTORICAL_INFLATION_BASELINES.byPriceRange[priceRange];
  const tierData = tier ? HISTORICAL_INFLATION_BASELINES.byTier[tier] : null;

  // Get position trend (use highest inflation position for multi-position players)
  let positionTrend = 'unknown';
  let maxPositionInflation = 0;
  positions?.forEach(pos => {
    const posData = HISTORICAL_INFLATION_BASELINES.byPosition[pos];
    if (posData && posData.avgInflation > maxPositionInflation) {
      maxPositionInflation = posData.avgInflation;
      positionTrend = posData.trend;
    }
  });

  // Calculate expected inflation (weighted by price range primarily)
  const expectedInflation = priceRangeData?.avgInflation ?? HISTORICAL_INFLATION_BASELINES.overall.avgInflationRate;

  // Generate recommendation
  let recommendation: string;
  if (projectedValue >= 31) {
    recommendation = 'Elite players typically go BELOW projections. Be patient and wait for value.';
  } else if (projectedValue <= 5) {
    recommendation = 'Low-value players see extreme inflation. Only bid on must-haves or wait for late-draft steals.';
  } else if (projectedValue <= 15) {
    recommendation = 'Mid-tier players see moderate inflation. Budget 50-75% extra for targets.';
  } else {
    recommendation = 'Quality players see slight inflation. Budget 10-20% extra.';
  }

  return {
    expectedInflation,
    priceRangeTrend: priceRangeData?.trend ?? 'unknown',
    tierLabel: tierData?.label ?? 'Unknown tier',
    positionTrend,
    recommendation,
  };
}

/**
 * Tier inflation data - tracks inflation by player tier
 */
export interface TierInflationData {
  tier: number;
  draftedCount: number;
  totalProjectedValue: number;
  totalActualSpent: number;
  inflationRate: number; // As percentage (15 = 15%)
}

/**
 * Extended inflation stats including tier breakdown
 * @deprecated Use EnhancedInflationStats from types/auction.ts instead
 */
export interface ExtendedInflationStats extends InflationStats {
  tierInflation: TierInflationData[];
  weightedInflationRate: number;
}

/**
 * Calculates effective budget for each team, accounting for mandatory $1 reserves.
 *
 * A team with $50 remaining but 10 open roster spots only has $41 of
 * "spendable" money (50 - (10-1)*$1 reserve for remaining spots).
 */
export function calculateEffectiveBudget(
  teams: ScrapedTeam[],
  leagueConfig: LeagueConfig
): TeamBudgetConstraint[] {
  const totalRosterSpots = leagueConfig.totalRosterSpots;

  return teams.map(team => {
    const rosterSpotsRemaining = Math.max(0, totalRosterSpots - team.playersDrafted);
    // Reserve $1 for each remaining spot except one (the current bid slot)
    const mandatoryReserve = Math.max(0, rosterSpotsRemaining - 1) * 1;
    const effectiveBudget = Math.max(0, team.remaining - mandatoryReserve);

    return {
      teamName: team.name,
      rawRemaining: team.remaining,
      rosterSpotsRemaining,
      effectiveBudget,
      // Teams typically won't bid more than 50% of effective budget on one player
      canAffordThreshold: effectiveBudget * 0.5,
    };
  });
}

/**
 * Calculates positional scarcity based on available players vs league need.
 *
 * Multi-position players count toward ALL their eligible positions.
 * Quality threshold is top 50% by projected value at each position.
 *
 * ENHANCEMENT: Now incorporates historical position inflation data from auction analysis.
 * Positions with historically high inflation (SP, RP, MiLB) get additional adjustments.
 */
export function calculatePositionalScarcity(
  matchedPlayers: MatchedPlayer[],
  leagueConfig: LeagueConfig
): PositionalScarcity[] {
  // All positions that might have roster slots
  const positions = ['C', '1B', '2B', '3B', 'SS', 'OF', 'CI', 'MI', 'UTIL', 'SP', 'RP', 'P', 'Bench'];

  // Get available players with projected values
  const available = matchedPlayers.filter(
    p => p.scrapedPlayer.status !== 'drafted' && p.projectedValue !== null && p.projectedValue > 0
  );

  // Get drafted players for need calculation
  const drafted = matchedPlayers.filter(p => p.scrapedPlayer.status === 'drafted');

  return positions
    .filter(pos => {
      // Only include positions that have roster slots
      const slots = leagueConfig.rosterSpots?.[pos] ?? 0;
      return slots > 0;
    })
    .map(pos => {
      // Players at this position (multi-position counts toward all)
      const atPosition = available.filter(p => p.scrapedPlayer.positions.includes(pos));

      // Quality threshold: top 50% by projected value at this position
      const sortedByValue = [...atPosition].sort(
        (a, b) => (b.projectedValue ?? 0) - (a.projectedValue ?? 0)
      );
      const qualityCount = Math.ceil(sortedByValue.length / 2);

      // League need: total slots at position minus drafted at position
      const draftedAtPosition = drafted.filter(p => p.scrapedPlayer.positions.includes(pos)).length;
      const slotsPerTeam = leagueConfig.rosterSpots?.[pos] ?? 0;
      const totalSlotsAtPosition = leagueConfig.numTeams * slotsPerTeam;
      const leagueNeed = Math.max(0, totalSlotsAtPosition - draftedAtPosition);

      // Scarcity ratio: how many teams need vs how many quality players available
      const scarcityRatio = qualityCount > 0 ? leagueNeed / qualityCount : leagueNeed > 0 ? 999 : 0;

      // Get historical position inflation data
      const historicalData = HISTORICAL_INFLATION_BASELINES.byPosition[pos];

      // Determine level and adjustment, incorporating historical data
      let scarcityLevel: PositionalScarcity['scarcityLevel'];
      let inflationAdjustment: number;

      // Base scarcity adjustment from current supply/demand
      if (scarcityRatio >= 2.0) {
        scarcityLevel = 'severe';
        inflationAdjustment = 1.25; // +25%
      } else if (scarcityRatio >= 1.0) {
        scarcityLevel = 'moderate';
        inflationAdjustment = 1.12; // +12%
      } else if (scarcityRatio >= 0.5) {
        scarcityLevel = 'normal';
        inflationAdjustment = 1.0; // No adjustment
      } else {
        scarcityLevel = 'surplus';
        inflationAdjustment = 0.95; // -5%
      }

      // Apply historical position premium for notoriously inflated positions
      // This reflects observed auction behavior (SP/RP/MiLB consistently overbid)
      if (historicalData) {
        if (historicalData.trend === 'severely_inflated') {
          // SP, RP, MiLB: Add 15% on top of scarcity adjustment (observed 800-1300% inflation historically)
          inflationAdjustment *= 1.15;
          // Bump scarcity level if not already severe
          if (scarcityLevel === 'normal') scarcityLevel = 'moderate';
        } else if (historicalData.trend === 'highly_inflated') {
          // C: Add 10% on top (observed 268% inflation historically)
          inflationAdjustment *= 1.10;
        } else if (historicalData.trend === 'moderately_inflated') {
          // 2B, 3B: Add 5% on top (observed 128-153% inflation historically)
          inflationAdjustment *= 1.05;
        }
        // 'slightly_inflated' positions (OF, 1B, SS, DH) don't get additional adjustment
      }

      return {
        position: pos,
        availableCount: atPosition.length,
        qualityCount,
        leagueNeed,
        scarcityRatio: Math.round(scarcityRatio * 100) / 100,
        scarcityLevel,
        inflationAdjustment: Math.round(inflationAdjustment * 100) / 100,
      };
    });
}

/**
 * Calculates competition factor based on how many teams can afford a player.
 *
 * Uses moderate weighting: teams with tighter budgets get reduced weight,
 * but aren't completely excluded unless they literally can't afford the player.
 */
export function calculateCompetitionFactor(
  playerValue: number,
  teamConstraints: TeamBudgetConstraint[]
): number {
  if (teamConstraints.length === 0) return 1.0;

  // Count teams that can afford this player
  const teamsCanAfford = teamConstraints.filter(t => t.effectiveBudget >= playerValue);

  if (teamsCanAfford.length === 0) return 0.25; // Minimum factor if no one can afford

  // Calculate weighted bidding capacity
  let totalCapacity = 0;
  teamsCanAfford.forEach(t => {
    // Weight by how much of their budget they'd need
    const budgetPercentNeeded = playerValue / t.effectiveBudget;
    // Teams with more slack get higher weight (moderate approach)
    const weight = Math.max(0.1, 1 - budgetPercentNeeded * 0.5);
    totalCapacity += weight;
  });

  // Normalize: if all teams can easily afford, factor approaches 1.0
  const maxPossibleCapacity = teamConstraints.length;
  return Math.min(1.0, totalCapacity / maxPossibleCapacity);
}

/**
 * Calculates dampened weight for a player based on their projected value.
 *
 * Low-value players ($1-$2) have extreme inflation percentages that can
 * distort tier-weighted averages. This dampens their influence:
 * - $1-$2 players: 75% reduction (weight = value * 0.25)
 * - $3-$5 players: 50% reduction (weight = value * 0.5)
 * - $6+ players: full weight
 */
function getDampenedWeight(projectedValue: number): number {
  if (projectedValue <= 2) {
    return projectedValue * 0.25; // 75% reduction
  } else if (projectedValue <= 5) {
    return projectedValue * 0.5; // 50% reduction
  }
  return projectedValue; // Full weight
}

/**
 * Calculates enhanced inflation statistics with positional scarcity and team constraints.
 *
 * Key features:
 * 1. Tier-weighted inflation with dampened low-value player influence
 * 2. Effective budget calculation (accounting for $1 reserves)
 * 3. Positional scarcity analysis
 * 4. Team budget constraint tracking
 *
 * For remaining budget adjustments:
 * Uses EFFECTIVE remaining budget (not raw) for forward-looking inflation.
 */
export function calculateInflationStats(
  matchedPlayers: MatchedPlayer[],
  leagueConfig: LeagueConfig,
  teams?: ScrapedTeam[]
): EnhancedInflationStats {
  // Filter to only drafted players with both actual bid and projected value
  const draftedWithValues = matchedPlayers.filter(
    p =>
      p.scrapedPlayer.status === 'drafted' &&
      p.actualBid !== null &&
      p.projectedValue !== null &&
      p.projectedValue > 0
  );

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

  // Calculate team constraints if teams data provided
  const teamConstraints = teams ? calculateEffectiveBudget(teams, leagueConfig) : [];
  const leagueEffectiveBudget = teamConstraints.reduce((sum, t) => sum + t.effectiveBudget, 0);

  // Calculate positional scarcity
  const positionalScarcity = calculatePositionalScarcity(matchedPlayers, leagueConfig);

  // Empty state return
  if (draftedWithValues.length === 0) {
    const totalLeagueBudget = leagueConfig.numTeams * leagueConfig.budgetPerTeam;
    // Calculate league-wide reserve: each team needs $1 per remaining roster spot (minus 1)
    const totalRosterSpots = leagueConfig.totalRosterSpots * leagueConfig.numTeams;
    const leagueReserve = Math.max(0, totalRosterSpots - leagueConfig.numTeams) * 1; // Reserve for all unfilled spots
    const effectiveRemainingBudget = Math.max(0, totalLeagueBudget - leagueReserve);

    // Calculate remaining projected value from undrafted players
    const undraftedPlayers = matchedPlayers.filter(
      p => p.scrapedPlayer.status !== 'drafted' && p.projectedValue !== null && p.projectedValue > 0
    );
    const remainingProjectedValue = undraftedPlayers.reduce(
      (sum, p) => sum + (p.projectedValue ?? 0),
      0
    );

    return {
      overallInflationRate: 0,
      totalProjectedValue: 0,
      totalActualSpent: 0,
      draftedPlayersCount: 0,
      averageInflationPerPlayer: 0,
      remainingBudgetInflationAdjustment: 0,
      tierInflation: Array.from(tierData.values()),
      weightedInflationRate: 0,
      positionalScarcity,
      teamConstraints,
      leagueEffectiveBudget: effectiveRemainingBudget,
      adjustedRemainingBudget: effectiveRemainingBudget,
      remainingProjectedValue,
    };
  }

  // Process drafted players by tier
  // Tier 1 = top 10% by value, Tier 10 = bottom 10%
  const sortedDrafted = [...draftedWithValues].sort(
    (a, b) => (b.projectedValue ?? 0) - (a.projectedValue ?? 0)
  );

  draftedWithValues.forEach(player => {
    // Determine tier based on relative position in sorted list
    // Uses percentile-based assignment for consistent tier sizes regardless of pool size
    const rankIndex = sortedDrafted.findIndex(p => p === player);
    const tier = sortedDrafted.length > 0
      ? Math.min(10, Math.ceil(((rankIndex + 1) / sortedDrafted.length) * 10))
      : 10;

    const data = tierData.get(tier)!;
    data.draftedCount++;
    data.totalProjectedValue += player.projectedValue ?? 0;
    data.totalActualSpent += player.actualBid ?? 0;
  });

  // Calculate inflation rate for each tier
  tierData.forEach(data => {
    if (data.totalProjectedValue > 0) {
      data.inflationRate =
        ((data.totalActualSpent - data.totalProjectedValue) / data.totalProjectedValue) * 100;
    }
  });

  // Calculate weighted average inflation with DAMPENED weights for low-value players
  let totalWeight = 0;
  let weightedInflationSum = 0;

  draftedWithValues.forEach(player => {
    const projectedValue = player.projectedValue ?? 0;
    const actualBid = player.actualBid ?? 0;

    // Calculate individual player inflation
    const playerInflation =
      projectedValue > 0 ? ((actualBid - projectedValue) / projectedValue) * 100 : 0;

    // Apply dampened weight
    const weight = getDampenedWeight(projectedValue);
    totalWeight += weight;
    weightedInflationSum += playerInflation * weight;
  });

  const weightedInflationRate = totalWeight > 0 ? weightedInflationSum / totalWeight : 0;

  const totalProjectedValue = draftedWithValues.reduce((sum, p) => sum + (p.projectedValue ?? 0), 0);

  const totalActualSpent = draftedWithValues.reduce((sum, p) => sum + (p.actualBid ?? 0), 0);

  const draftedPlayersCount = draftedWithValues.length;

  // Average inflation per player (using dampened calculation)
  const averageInflationPerPlayer =
    draftedPlayersCount > 0 ? weightedInflationRate / draftedPlayersCount : 0;

  // Calculate remaining budget using raw remaining minus league-wide reserves
  // IMPORTANT: We use rawRemainingBudget (total budget - total spent), NOT the sum of team effective budgets
  // The sum of team effective budgets can be incorrect when team spending data is incomplete from scraping
  const totalLeagueBudget = leagueConfig.numTeams * leagueConfig.budgetPerTeam;
  const rawRemainingBudget = totalLeagueBudget - totalActualSpent;

  // Calculate league-wide reserve requirement
  // Each team needs $1 per remaining roster spot (minus 1 for current bid)
  const totalRosterSpots = leagueConfig.totalRosterSpots;
  const playersRemainingToDraft = (totalRosterSpots * leagueConfig.numTeams) - draftedPlayersCount;
  const leagueReserve = Math.max(0, playersRemainingToDraft - leagueConfig.numTeams) * 1;
  const adjustedRemainingBudget = Math.max(0, rawRemainingBudget - leagueReserve);

  // Get total projected value of undrafted matched players
  const undraftedWithValues = matchedPlayers.filter(
    p =>
      p.scrapedPlayer.status !== 'drafted' && p.projectedValue !== null && p.projectedValue > 0
  );

  const remainingProjectedValue = undraftedWithValues.reduce(
    (sum, p) => sum + (p.projectedValue ?? 0),
    0
  );

  // Remaining budget inflation adjustment using EFFECTIVE budget
  const remainingBudgetInflationAdjustment =
    remainingProjectedValue > 0
      ? ((adjustedRemainingBudget / remainingProjectedValue) - 1) * 100
      : 0;

  return {
    overallInflationRate: weightedInflationRate, // Dampened weighted rate as main rate
    totalProjectedValue,
    totalActualSpent,
    draftedPlayersCount,
    averageInflationPerPlayer,
    remainingBudgetInflationAdjustment,
    tierInflation: Array.from(tierData.values()),
    weightedInflationRate,
    positionalScarcity,
    teamConstraints,
    leagueEffectiveBudget: adjustedRemainingBudget, // Use the correctly calculated value
    adjustedRemainingBudget,
    remainingProjectedValue,
  };
}

/**
 * Adjusts a player's projected value based on the current inflation rate.
 */
export function adjustValueForInflation(projectedValue: number, inflationRate: number): number {
  // Inflation rate is in percentage, convert to multiplier
  const inflationMultiplier = 1 + inflationRate / 100;
  return Math.round(projectedValue * inflationMultiplier * 10) / 10;
}

/**
 * Determines the inflation severity level for UI display.
 */
export function getInflationLevel(
  inflationRate: number
): 'low' | 'moderate' | 'high' | 'very_high' {
  if (inflationRate < 5) return 'low';
  if (inflationRate < 15) return 'moderate';
  if (inflationRate < 30) return 'high';
  return 'very_high';
}

/**
 * Calculates the value difference indicator for a single player.
 * Returns a string like "+$5" or "-$3" for display.
 */
export function getValueDifferenceDisplay(
  actualBid: number | null,
  projectedValue: number | null
): string {
  if (actualBid === null || projectedValue === null) {
    return '--';
  }

  const difference = actualBid - projectedValue;
  if (difference >= 0) {
    return `+$${difference.toFixed(0)}`;
  }
  return `-$${Math.abs(difference).toFixed(0)}`;
}

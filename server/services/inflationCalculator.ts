import type { MatchedPlayer, InflationStats } from '../types/auction';

interface LeagueConfig {
  numTeams: number;
  budgetPerTeam: number;
  totalRosterSpots: number;
}

/**
 * Calculates inflation statistics based on matched player data.
 *
 * Inflation Rate = (Total Actual Spent - Total Projected Value) / Total Projected Value
 *
 * For remaining budget adjustments:
 * Remaining Value = Sum of undrafted players' projected values
 * Remaining Budget = Total league budget - Total spent
 * Adjusted Inflation = (Remaining Budget / Remaining Value) - 1
 */
export function calculateInflationStats(
  matchedPlayers: MatchedPlayer[],
  leagueConfig: LeagueConfig
): InflationStats {
  // Filter to only drafted players with both actual bid and projected value
  const draftedWithValues = matchedPlayers.filter(
    p =>
      p.scrapedPlayer.status === 'drafted' &&
      p.actualBid !== null &&
      p.projectedValue !== null &&
      p.projectedValue > 0
  );

  if (draftedWithValues.length === 0) {
    return {
      overallInflationRate: 0,
      totalProjectedValue: 0,
      totalActualSpent: 0,
      draftedPlayersCount: 0,
      averageInflationPerPlayer: 0,
      remainingBudgetInflationAdjustment: 0,
    };
  }

  const totalProjectedValue = draftedWithValues.reduce(
    (sum, p) => sum + (p.projectedValue ?? 0),
    0
  );

  const totalActualSpent = draftedWithValues.reduce(
    (sum, p) => sum + (p.actualBid ?? 0),
    0
  );

  const draftedPlayersCount = draftedWithValues.length;

  // Overall inflation rate
  const overallInflationRate =
    totalProjectedValue > 0
      ? ((totalActualSpent - totalProjectedValue) / totalProjectedValue) * 100
      : 0;

  // Average inflation per player
  const averageInflationPerPlayer =
    draftedPlayersCount > 0 ? overallInflationRate / draftedPlayersCount : 0;

  // Calculate remaining budget inflation adjustment
  // This helps project what undrafted players should be valued at
  const totalLeagueBudget = leagueConfig.numTeams * leagueConfig.budgetPerTeam;
  const remainingBudget = totalLeagueBudget - totalActualSpent;

  // Get total projected value of undrafted matched players
  const undraftedWithValues = matchedPlayers.filter(
    p =>
      p.scrapedPlayer.status !== 'drafted' &&
      p.projectedValue !== null &&
      p.projectedValue > 0
  );

  const remainingProjectedValue = undraftedWithValues.reduce(
    (sum, p) => sum + (p.projectedValue ?? 0),
    0
  );

  // Remaining budget inflation adjustment
  // If remainingBudget / remainingProjectedValue > 1, there's more money than value = inflation
  const remainingBudgetInflationAdjustment =
    remainingProjectedValue > 0
      ? ((remainingBudget / remainingProjectedValue) - 1) * 100
      : 0;

  return {
    overallInflationRate,
    totalProjectedValue,
    totalActualSpent,
    draftedPlayersCount,
    averageInflationPerPlayer,
    remainingBudgetInflationAdjustment,
  };
}

/**
 * Adjusts a player's projected value based on the current inflation rate.
 */
export function adjustValueForInflation(
  projectedValue: number,
  inflationRate: number
): number {
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

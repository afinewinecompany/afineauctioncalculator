import type { MatchedPlayer, InflationStats, ScrapedTeam, PositionalScarcity, TeamBudgetConstraint, EnhancedInflationStats } from '../types/auction';
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
export declare const HISTORICAL_INFLATION_BASELINES: {
    overall: {
        avgInflationRate: number;
        stdDeviation: number;
        minInflationRate: number;
        maxInflationRate: number;
    };
    byTier: Record<number, {
        avgInflation: number;
        stdDev: number;
        label: string;
    }>;
    byPosition: Record<string, {
        avgInflation: number;
        stdDev: number;
        trend: string;
    }>;
    byPriceRange: Record<string, {
        avgInflation: number;
        stdDev: number;
        trend: string;
    }>;
};
/**
 * Gets historical inflation context for a player based on their tier and value
 */
export declare function getHistoricalInflationContext(projectedValue: number, tier?: number, positions?: string[]): {
    expectedInflation: number;
    priceRangeTrend: string;
    tierLabel: string;
    positionTrend: string;
    recommendation: string;
};
/**
 * Tier inflation data - tracks inflation by player tier
 */
export interface TierInflationData {
    tier: number;
    draftedCount: number;
    totalProjectedValue: number;
    totalActualSpent: number;
    inflationRate: number;
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
export declare function calculateEffectiveBudget(teams: ScrapedTeam[], leagueConfig: LeagueConfig): TeamBudgetConstraint[];
/**
 * Calculates positional scarcity based on available players vs league need.
 *
 * Multi-position players count toward ALL their eligible positions.
 * Quality threshold is top 50% by projected value at each position.
 *
 * ENHANCEMENT: Now incorporates historical position inflation data from auction analysis.
 * Positions with historically high inflation (SP, RP, MiLB) get additional adjustments.
 */
export declare function calculatePositionalScarcity(matchedPlayers: MatchedPlayer[], leagueConfig: LeagueConfig): PositionalScarcity[];
/**
 * Calculates competition factor based on how many teams can afford a player.
 *
 * Uses moderate weighting: teams with tighter budgets get reduced weight,
 * but aren't completely excluded unless they literally can't afford the player.
 */
export declare function calculateCompetitionFactor(playerValue: number, teamConstraints: TeamBudgetConstraint[]): number;
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
export declare function calculateInflationStats(matchedPlayers: MatchedPlayer[], leagueConfig: LeagueConfig, teams?: ScrapedTeam[]): EnhancedInflationStats;
/**
 * Adjusts a player's projected value based on the current inflation rate.
 */
export declare function adjustValueForInflation(projectedValue: number, inflationRate: number): number;
/**
 * Determines the inflation severity level for UI display.
 */
export declare function getInflationLevel(inflationRate: number): 'low' | 'moderate' | 'high' | 'very_high';
/**
 * Calculates the value difference indicator for a single player.
 * Returns a string like "+$5" or "-$3" for display.
 */
export declare function getValueDifferenceDisplay(actualBid: number | null, projectedValue: number | null): string;
export {};

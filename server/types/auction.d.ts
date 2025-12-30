export interface ScrapedPlayer {
    couchManagersId: number;
    firstName: string;
    lastName: string;
    fullName: string;
    normalizedName: string;
    positions: string[];
    mlbTeam: string;
    status: 'available' | 'drafted' | 'on_block' | 'passed';
    winningBid?: number;
    winningTeam?: string;
    stats?: {
        avg?: string;
        hr?: number;
        rbi?: number;
        sb?: number;
        runs?: number;
    };
}
export interface ScrapedTeam {
    name: string;
    budget: number;
    spent: number;
    remaining: number;
    playersDrafted: number;
    isOnline: boolean;
}
export interface CurrentAuction {
    playerId: number;
    playerName: string;
    currentBid: number;
    currentBidder: string;
    timeRemaining: number;
}
export interface ScrapedAuctionData {
    roomId: string;
    scrapedAt: string;
    status: 'active' | 'paused' | 'completed' | 'not_found';
    players: ScrapedPlayer[];
    teams: ScrapedTeam[];
    currentAuction?: CurrentAuction;
    totalPlayersDrafted: number;
    totalMoneySpent: number;
}
export interface MatchedPlayer {
    scrapedPlayer: ScrapedPlayer;
    projectionPlayerId: string | null;
    projectedValue: number | null;
    actualBid: number | null;
    inflationAmount: number | null;
    inflationPercent: number | null;
    matchConfidence: 'exact' | 'partial' | 'unmatched';
}
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
export interface InflationStats {
    overallInflationRate: number;
    totalProjectedValue: number;
    totalActualSpent: number;
    draftedPlayersCount: number;
    averageInflationPerPlayer: number;
    remainingBudgetInflationAdjustment: number;
    tierInflation?: TierInflationData[];
    weightedInflationRate?: number;
}
export interface AuctionSyncResult {
    auctionData: ScrapedAuctionData;
    matchedPlayers: MatchedPlayer[];
    inflationStats: InflationStats;
    unmatchedPlayers: ScrapedPlayer[];
}
/**
 * Positional scarcity data - tracks supply/demand at each position
 */
export interface PositionalScarcity {
    position: string;
    availableCount: number;
    qualityCount: number;
    leagueNeed: number;
    scarcityRatio: number;
    scarcityLevel: 'surplus' | 'normal' | 'moderate' | 'severe';
    inflationAdjustment: number;
}
/**
 * Per-team budget constraint data - tracks effective spending power
 */
export interface TeamBudgetConstraint {
    teamName: string;
    rawRemaining: number;
    rosterSpotsRemaining: number;
    effectiveBudget: number;
    canAffordThreshold: number;
}
/**
 * Enhanced inflation stats with positional scarcity and team constraints
 */
export interface EnhancedInflationStats extends InflationStats {
    positionalScarcity: PositionalScarcity[];
    teamConstraints: TeamBudgetConstraint[];
    leagueEffectiveBudget: number;
    adjustedRemainingBudget: number;
    remainingProjectedValue: number;
}

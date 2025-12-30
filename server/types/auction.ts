// Types for Couch Managers auction scraping

export interface ScrapedPlayer {
  couchManagersId: number;
  mlbamId?: number; // MLB.com player ID for cross-system matching
  firstName: string;
  lastName: string;
  fullName: string;
  normalizedName: string;
  positions: string[];
  mlbTeam: string;
  // Status based on Couch Managers flags:
  // - available: drafted=false, open=0
  // - on_block: open=1 (currently being auctioned)
  // - drafted: drafted=true (won by a team)
  // - passed: in passed_array (no bids, returned to pool)
  status: 'available' | 'drafted' | 'on_block' | 'passed';
  winningBid?: number;
  winningTeam?: string;
  // Stats from playerArray (batting avg, HR, RBI, SB, runs)
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
  /** All currently active auctions (players on the block) */
  activeAuctions?: CurrentAuction[];
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
  inflationRate: number; // As percentage (15 = 15%)
}

export interface InflationStats {
  overallInflationRate: number;
  totalProjectedValue: number;
  totalActualSpent: number;
  draftedPlayersCount: number;
  averageInflationPerPlayer: number;
  remainingBudgetInflationAdjustment: number;
  // Tier-based inflation breakdown (optional for backward compatibility)
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
  availableCount: number;           // Total available players at position
  qualityCount: number;             // Above threshold (top 50% by value)
  leagueNeed: number;               // Total unfilled slots league-wide
  scarcityRatio: number;            // leagueNeed / qualityCount
  scarcityLevel: 'surplus' | 'normal' | 'moderate' | 'severe';
  inflationAdjustment: number;      // Multiplier (e.g., 1.15 = +15%)
}

/**
 * Per-team budget constraint data - tracks effective spending power
 */
export interface TeamBudgetConstraint {
  teamName: string;
  rawRemaining: number;             // From Couch Managers
  rosterSpotsRemaining: number;     // Calculated from league settings
  effectiveBudget: number;          // rawRemaining - mandatory $1 reserves
  canAffordThreshold: number;       // Max player value they can reasonably bid
}

/**
 * Enhanced inflation stats with positional scarcity and team constraints
 */
export interface EnhancedInflationStats extends InflationStats {
  positionalScarcity: PositionalScarcity[];
  teamConstraints: TeamBudgetConstraint[];
  leagueEffectiveBudget: number;    // Sum of all team effectiveBudgets
  adjustedRemainingBudget: number;  // Effective budget for forward-looking inflation
  remainingProjectedValue: number;  // Sum of projected values for undrafted players
}

export interface LeagueSettings {
  leagueName: string;
  couchManagerRoomId: string;
  numTeams: number;
  budgetPerTeam: number;
  rosterSpots: {
    C: number;
    '1B': number;
    '2B': number;
    '3B': number;
    SS: number;
    OF: number;
    CI: number;
    MI: number;
    UTIL: number;
    SP: number;
    RP: number;
    P: number;
    Bench: number;
  };
  scoringType: 'rotisserie' | 'h2h-categories' | 'h2h-points';
  projectionSystem: 'steamer' | 'batx' | 'ja';
  // Scoring categories for Roto and H2H Categories
  hittingCategories?: {
    R?: boolean;
    HR?: boolean;
    RBI?: boolean;
    SB?: boolean;
    AVG?: boolean;
    OBP?: boolean;
    SLG?: boolean;
    OPS?: boolean;
    H?: boolean;
    XBH?: boolean;
  };
  pitchingCategories?: {
    W?: boolean;
    K?: boolean;
    ERA?: boolean;
    WHIP?: boolean;
    SV?: boolean;
    QS?: boolean;
    K_BB?: boolean;
    K9?: boolean;
    IP?: boolean;
    SV_HD?: boolean;
  };
  // Point values for H2H Points
  pointsSettings?: {
    // Hitting
    H?: number;
    '2B'?: number;
    '3B'?: number;
    HR?: number;
    RBI?: number;
    R?: number;
    SB?: number;
    BB?: number;
    K_hitter?: number;
    // Pitching
    IP?: number;
    W?: number;
    K_pitcher?: number;
    QS?: number;
    SV?: number;
    HD?: number;
    ER?: number;
    H_allowed?: number;
    BB_allowed?: number;
  };
  // Budget allocation split between hitters and pitchers (default 68/32)
  hitterPitcherSplit?: {
    hitter: number; // e.g., 0.68 for 68%
    pitcher: number; // e.g., 0.32 for 32%
  };
}

export interface Player {
  id: string;
  externalId?: string; // FanGraphs player ID for projection matching
  mlbamId?: number; // MLB Advanced Media ID for player photos
  name: string;
  team: string;
  positions: string[];
  projectedValue: number;
  adjustedValue: number;
  projectedStats: {
    HR?: number;
    RBI?: number;
    SB?: number;
    AVG?: number;
    R?: number;
    H?: number;
    OBP?: number;
    SLG?: number;
    W?: number;
    K?: number;
    ERA?: number;
    WHIP?: number;
    SV?: number;
    IP?: number;
  };
  status: 'available' | 'drafted' | 'onMyTeam' | 'on_block';
  draftedPrice?: number;
  draftedBy?: string;
  currentBid?: number; // For on_block status - current auction bid
  currentBidder?: string; // For on_block status - current highest bidder
  tier?: number;
  isInDraftPool?: boolean; // Whether player is in the draftable pool
}

export interface DraftedPlayer extends Player {
  status: 'drafted' | 'onMyTeam';
  draftedPrice: number;
  draftedBy: string;
}

export interface DraftState {
  players: Player[];
  myRoster: DraftedPlayer[];
  allDrafted: DraftedPlayer[];
  moneySpent: number;
  moneyRemaining: number;
  currentNomination: Player | null;
  currentBid: number;
  inflationRate: number;
  rosterNeedsRemaining: LeagueSettings['rosterSpots'];
}

export interface SavedLeague {
  id: string;
  leagueName: string;
  settings: LeagueSettings;
  players: Player[];
  createdAt: string;
  lastModified: string;
  status: 'setup' | 'drafting' | 'complete';
}

export interface UserData {
  username: string;
  email: string;
  leagues: SavedLeague[];
  authProvider?: 'email' | 'google';
  profilePicture?: string;
}

// Couch Managers Auction Sync Types
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
  teams: {
    name: string;
    budget: number;
    spent: number;
    remaining: number;
    playersDrafted: number;
    isOnline: boolean;
  }[];
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

export interface SyncState {
  isConnected: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  isSyncing: boolean;
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
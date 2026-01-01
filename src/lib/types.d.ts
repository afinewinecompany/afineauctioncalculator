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
    leagueType: 'redraft' | 'dynasty';
    scoringType: 'rotisserie' | 'h2h-categories' | 'h2h-points';
    projectionSystem: 'steamer' | 'batx' | 'ja';
    dynastySettings?: {
        dynastyWeight: number;
        includeMinors: boolean;
        rankingsSource?: 'harryknowsball' | 'custom';
        customRankings?: CustomDynastyRanking[];
    };
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
    pointsSettings?: {
        H?: number;
        '2B'?: number;
        '3B'?: number;
        HR?: number;
        RBI?: number;
        R?: number;
        SB?: number;
        BB?: number;
        K_hitter?: number;
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
    hitterPitcherSplit?: {
        hitter: number;
        pitcher: number;
    };
}
export interface Player {
    id: string;
    externalId?: string;
    mlbamId?: number;
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
    currentBid?: number;
    currentBidder?: string;
    timeRemaining?: number;
    tier?: number;
    isInDraftPool?: boolean;
    isTwoWayPlayer?: boolean;
    isTargeted?: boolean;
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
/**
 * Custom dynasty ranking entry from user-uploaded CSV/Excel
 */
export interface CustomDynastyRanking {
    name: string;
    rank: number;
    playerId?: string;
}

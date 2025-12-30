/**
 * Raw FanGraphs API response for hitters
 * From: https://www.fangraphs.com/api/projections?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all
 */
export interface FanGraphsHitter {
    PlayerName: string;
    playerid: string;
    xMLBAMID: number;
    Team: string | null;
    minpos: string;
    G: number;
    AB: number;
    PA: number;
    H: number;
    '1B': number;
    '2B': number;
    '3B': number;
    HR: number;
    R: number;
    RBI: number;
    BB: number;
    SO: number;
    SB: number;
    CS: number;
    AVG: number;
    OBP: number;
    SLG: number;
    OPS: number;
    wOBA: number;
    'wRC+': number;
    WAR: number;
}
/**
 * Raw FanGraphs API response for pitchers
 * From: https://www.fangraphs.com/api/projections?type=steamer&stats=pit&pos=all&team=0&players=0&lg=all
 */
export interface FanGraphsPitcher {
    PlayerName: string;
    playerid: string;
    xMLBAMID: number;
    Team: string | null;
    G: number;
    GS: number;
    IP: number;
    W: number;
    L: number;
    SV: number;
    HLD: number;
    H: number;
    ER: number;
    HR: number;
    BB: number;
    SO: number;
    ERA: number;
    WHIP: number;
    'K/9': number;
    'BB/9': number;
    FIP: number;
    WAR: number;
}
/**
 * Normalized hitting stats
 */
export interface HittingStats {
    games: number;
    atBats: number;
    plateAppearances: number;
    runs: number;
    hits: number;
    singles: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    rbi: number;
    stolenBases: number;
    caughtStealing: number;
    walks: number;
    strikeouts: number;
    battingAvg: number;
    onBasePct: number;
    sluggingPct: number;
    ops: number;
    wOBA: number;
    wrcPlus: number;
    war: number;
}
/**
 * Normalized pitching stats
 */
export interface PitchingStats {
    games: number;
    gamesStarted: number;
    inningsPitched: number;
    wins: number;
    losses: number;
    saves: number;
    holds: number;
    hitsAllowed: number;
    earnedRuns: number;
    homeRunsAllowed: number;
    walks: number;
    strikeouts: number;
    era: number;
    whip: number;
    k9: number;
    bb9: number;
    fip: number;
    war: number;
}
/**
 * Internal normalized projection type
 * Unified format for all projection systems
 */
export interface NormalizedProjection {
    externalId: string;
    mlbamId: number;
    name: string;
    team: string;
    positions: string[];
    playerType: 'hitter' | 'pitcher';
    hitting?: HittingStats;
    pitching?: PitchingStats;
}
/**
 * Cache metadata stored alongside projections
 */
export interface ProjectionCacheMetadata {
    system: string;
    fetchedAt: string;
    expiresAt: string;
    playerCount: number;
    hitterCount: number;
    pitcherCount: number;
}
/**
 * Full cache entry structure
 */
export interface ProjectionCacheEntry {
    metadata: ProjectionCacheMetadata;
    projections: NormalizedProjection[];
}
/**
 * Player with calculated auction value
 */
export interface PlayerWithValue extends NormalizedProjection {
    auctionValue: number;
    sgpValue?: number;
    pointsValue?: number;
    tier: number;
    isInDraftPool: boolean;
}
/**
 * Result from value calculation endpoint
 */
export interface CalculatedValuesResult {
    projectionSystem: string;
    calculatedAt: string;
    leagueSummary: {
        numTeams: number;
        budgetPerTeam: number;
        totalBudget: number;
        scoringType: string;
        draftablePoolSize: number;
        hitterPoolSize: number;
        pitcherPoolSize: number;
        hitterBudget: number;
        pitcherBudget: number;
        leagueType?: 'redraft' | 'dynasty';
        dynastyWeight?: number;
    };
    players: PlayerWithValue[];
}
/**
 * Dynasty ranking from external source (Harry Knows Ball)
 */
export interface DynastyRanking {
    id: string;
    name: string;
    team: string;
    positions: string[];
    age: number | null;
    level: 'MLB' | 'AAA' | 'AA' | 'A+' | 'A' | 'other';
    overallRank: number;
    positionRank: number;
    dynastyValue: number;
    normalizedValue: number;
    trend: {
        rank7Day: number;
        rank30Day: number;
        value7Day: number;
        value30Day: number;
    };
}
/**
 * Cache structure for dynasty rankings
 */
export interface DynastyRankingsCacheEntry {
    metadata: {
        source: string;
        fetchedAt: string;
        expiresAt: string;
        playerCount: number;
    };
    rankings: DynastyRanking[];
}
/**
 * Player with dynasty-adjusted value
 */
export interface PlayerWithDynastyValue extends PlayerWithValue {
    dynastyRank?: number;
    dynastyValue?: number;
    steamerValue?: number;
    blendedScore?: number;
}

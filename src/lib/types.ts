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
  // Dynasty-specific settings (only used when leagueType === 'dynasty')
  dynastySettings?: {
    dynastyWeight: number; // 0.0-1.0 (how much to weight dynasty rankings vs projections)
    includeMinors: boolean; // Include minor league players in rankings
    rankingsSource?: 'harryknowsball' | 'custom'; // Source of dynasty rankings (undefined = not selected yet)
    customRankings?: CustomDynastyRanking[]; // User-uploaded custom rankings
  };
  // Scoring categories for Roto and H2H Categories
  hittingCategories?: {
    // Core counting stats
    R?: boolean;      // Runs Scored
    HR?: boolean;     // Home Runs
    RBI?: boolean;    // Runs Batted In
    SB?: boolean;     // Stolen Bases
    H?: boolean;      // Hits
    // Rate stats
    AVG?: boolean;    // Batting Average
    OBP?: boolean;    // On-Base Percentage
    SLG?: boolean;    // Slugging Percentage
    OPS?: boolean;    // On-Base + Slugging
    // Additional counting stats
    XBH?: boolean;    // Extra Base Hits (2B + 3B + HR)
    TB?: boolean;     // Total Bases
    BB?: boolean;     // Walks
    '1B'?: boolean;   // Singles
    '2B'?: boolean;   // Doubles
    '3B'?: boolean;   // Triples
    // Advanced/less common
    SBN?: boolean;    // Net Stolen Bases (SB - CS)
    CS?: boolean;     // Caught Stealing (negative)
    SO?: boolean;     // Strikeouts (negative)
    GIDP?: boolean;   // Grounded Into Double Play (negative)
    HBP?: boolean;    // Hit By Pitch
    SF?: boolean;     // Sacrifice Flies
    RC?: boolean;     // Runs Created
    GP?: boolean;     // Games Played
    PA?: boolean;     // Plate Appearances
    AB?: boolean;     // At Bats
    // Fielding
    A?: boolean;      // Assists
    E?: boolean;      // Errors (negative)
    'FLD%'?: boolean; // Fielding Percentage
    // Advanced Yahoo Stats - Hitting
    AOF?: boolean;    // Assists by Outfielders
    BABIP?: boolean;  // Batting Avg on Balls in Play
    BAP?: boolean;    // Batting Average Points
    BC?: boolean;     // Bases Custom (BB + 2×2B + 3×3B + 3×SB)
    AVOB?: boolean;   // Batting Avg On Base ((AVG + OBP) / 2)
    CI?: boolean;     // Catcher Interference
    'CS-PO'?: boolean; // Caught Stealing - Picked Off
    CYC?: boolean;    // Hit For The Cycle
    DP?: boolean;     // Double Plays Fielded
    EBN?: boolean;    // Extra Base Numbers (BB + 2×2B + 3×3B)
    FB?: boolean;     // Fly Balls
    GB?: boolean;     // Ground Balls
    'GB/FB'?: boolean; // Ground Ball/Fly Ball Ratio
    GWRBI?: boolean;  // Game Winning RBI
    IBB?: boolean;    // Intentional Walks
    IF?: boolean;     // Innings Fielded
    ISO?: boolean;    // Isolated Power (SLG - AVG)
    MOBP?: boolean;   // Modified OBP ((H + BB + HBP) / (AB + BB + HBP))
    MTB?: boolean;    // Modified Total Bases (TB + SB - CS/2)
    MHG?: boolean;    // Multiple Hit Games
    MHRG?: boolean;   // Multiple Home Run Games
    MOBG?: boolean;   // Multiple On-Base Games
    NSB?: boolean;    // Net Speed Bases (SB + 0.5×2B + 2×3B - CS - PKO)
    NIBB?: boolean;   // Non-Intentional Walks
    OUT?: boolean;    // Outs Made
    PB?: boolean;     // Passed Balls
    PKO?: boolean;    // Picked Off (negative)
    'PKO_field'?: boolean; // Pickoffs (fielding)
    PO?: boolean;     // Putouts
    POOF?: boolean;   // Putouts by Outfielders
    'P/PA'?: boolean; // Pitches Faced per PA
    PHG?: boolean;    // Perfect Hitting Games
    QAB?: boolean;    // Quality At Bats
    LOB?: boolean;    // Runners Left On Base
    RL2O?: boolean;   // Runners in Scoring Position LOB with 2 Outs
    RC2?: boolean;    // Runs Created 2
    RC27?: boolean;   // Runs Created per 27 Outs
    RP?: boolean;     // Runs Produced (RBI + R - HR)
    RP2?: boolean;    // Runs Produced 2 (RBI + R)
    'R+RBI'?: boolean; // Runs + RBI
    'R+SB'?: boolean; // Runs + Stolen Bases
    'SB%'?: boolean;  // Stolen Base Percentage
    SBN2?: boolean;   // Net SB 2 (SB - 0.5×CS)
    SBN3?: boolean;   // Net SB 3 (SB - CS - PKO)
    SH?: boolean;     // Sacrifice Hits (bunts)
    'SH+SF'?: boolean; // Sacrifice Hits + Flies
    SHFB?: boolean;   // SH + SF + SB
    Sl?: boolean;     // Grand Slams
    SOL?: boolean;    // Strikeouts Looking
    'K%'?: boolean;   // Strikeouts Per PA
    KDP?: boolean;    // K + 2×GIDP
    KDP2?: boolean;   // K + GIDP
    SFC?: boolean;    // Strikes Faced
    TSB?: boolean;    // Total + Stolen Bases
    'TB+HP'?: boolean; // Total Bases + HBP
    'TB+RBI'?: boolean; // Total Bases + RBI
    'TB+BB'?: boolean; // Total Bases + BB
    'T+B+H'?: boolean; // TB + BB + HBP
    'TB-HR'?: boolean; // Total Bases - Home Runs
    TB2?: boolean;    // Total Bases 2 (1B + 2×2B + 3×3B + BB + HBP)
    TB3?: boolean;    // Total Bases 3
    TB4?: boolean;    // Total Bases 4
    TB5?: boolean;    // Total Bases 5
    TB6?: boolean;    // Total Bases 6
    TP?: boolean;     // Triple Plays Fielded
    '3BSB'?: boolean; // Triples + Stolen Bases
    '3B2SB'?: boolean; // 2×Triples + Stolen Bases
    CSA?: boolean;    // Caught Stealing Against
    'CSA%'?: boolean; // Caught Stealing Against %
    SBA?: boolean;    // Stolen Bases Against
    WOBA?: boolean;   // Weighted On Base Average
    WSB?: boolean;    // Weighted Stolen Bases
    'HR+SB'?: boolean; // Home Runs + Stolen Bases
    'HR/PA'?: boolean; // Home Runs per PA
    HR2B?: boolean;   // HR/Doubles combo (2×HR + 2B)
    '2B+3B'?: boolean; // Doubles + Triples
    '2B+3B2'?: boolean; // Doubles + 2×Triples
    '2B2+3B5'?: boolean; // 2×Doubles + 5×Triples
    XB?: boolean;     // Extra Bases (2B + 2×3B + 3×HR)
    XBS?: boolean;    // Extra Bases + Sacrifice Hits
    'H+R+RBI'?: boolean; // Hits + Runs + RBI
    HBB?: boolean;    // Hits + Walks
    HBBHBP?: boolean; // Hits + Walks + HBP
    RTB?: boolean;    // Revised Total Bases
    SP?: boolean;     // Scoring Production (R + RBI - HR)
    SPP?: boolean;    // Scoring Production %
    '1B+2B+3B'?: boolean; // Singles + Doubles + Triples
    '1B+BB'?: boolean; // Singles + Walks
    'BB+HBP'?: boolean; // Walks + HBP
    BBHS?: boolean;   // BB + HBP + SB
    'BB+R'?: boolean; // Walks + Runs
    'BB+SB'?: boolean; // Walks + SB
    'BB/PA'?: boolean; // Walks per PA
    'BB/K'?: boolean; // Walks per Strikeout
    'BBK/G'?: boolean; // (BB - K) / Game
    BLF?: boolean;    // Balls Faced
    // Hitter Points formulas
    HP?: boolean;     // Hitter Points
    HP2?: boolean;    // Hitter Points 2
    HP3?: boolean;    // Hitter Points 3
    HP4?: boolean;    // Hitter Points 4
    HP5?: boolean;    // Hitter Points 5
    BBKS?: boolean;   // Hitter Points 6 (2×BB - 0.5×K)
    HP7?: boolean;    // Hitter Points 7
    HP8?: boolean;    // Hitter Points 8
    HP9?: boolean;    // Hitter Points 9
    HP10?: boolean;   // Hitter Points 10
    // Fielding Points
    FPT?: boolean;    // Fielding Points
    FPT2?: boolean;   // Fielding Points 2
    FPT3?: boolean;   // Fielding Points 3
  };
  pitchingCategories?: {
    // Core stats
    W?: boolean;      // Wins
    K?: boolean;      // Strikeouts Pitched
    ERA?: boolean;    // Earned Run Average
    WHIP?: boolean;   // Walks + Hits per IP
    SV?: boolean;     // Saves
    QS?: boolean;     // Quality Starts
    // Ratio stats
    K_BB?: boolean;   // K/BB Ratio
    K9?: boolean;     // Strikeouts per 9 IP
    BB9?: boolean;    // Walks per 9 IP
    HR9?: boolean;    // Home Runs per 9 IP
    'H/IP'?: boolean; // Hits per IP
    BAA?: boolean;    // Batting Average Against
    // Additional counting stats
    IP?: boolean;     // Innings Pitched
    SVH?: boolean;    // Saves + Holds
    SVH2?: boolean;   // Saves + Holds 2 (SV + 0.5×HLD)
    SVH3?: boolean;   // Saves + Holds 3 (0.5×SV + HLD)
    SVH4?: boolean;   // Saves + Holds 4 (SV + 0.75×HLD)
    SVH5?: boolean;   // Saves + Holds 5 (0.75×SV + HLD)
    SVH6?: boolean;   // Saves + Holds 6 (SV + 0.25×HLD)
    SVH7?: boolean;   // Saves + Holds 7 (0.25×SV + HLD)
    HLD?: boolean;    // Holds
    BS?: boolean;     // Blown Saves (negative)
    NS?: boolean;     // Net Saves (SV - BS)
    NS2?: boolean;    // Net Saves 2 (SV - 0.5×BS)
    NS3?: boolean;    // Net Saves 3 (SV - BS + HLD)
    NS4?: boolean;    // Net Saves 4 (SV + HLD - BS)
    NSH?: boolean;    // Net Saves + Holds (SVH - BS)
    NSH2?: boolean;   // Net Saves + Holds 2 ((SV + HLD) - BS)
    L?: boolean;      // Losses (negative)
    CG?: boolean;     // Complete Games
    SHO?: boolean;    // Shutouts
    NH?: boolean;     // No Hitters
    // Negative stats
    ER?: boolean;     // Earned Runs (negative)
    HA?: boolean;     // Hits Allowed (negative)
    BBA?: boolean;    // Walks Allowed (negative)
    HRA?: boolean;    // Home Runs Allowed (negative)
    // Other
    GS?: boolean;     // Games Started
    GF?: boolean;     // Games Finished
    SVO?: boolean;    // Save Opportunities
    'SV%'?: boolean;  // Save Percentage
    'W%'?: boolean;   // Win Percentage
    BF?: boolean;     // Batters Faced
    'W+QS'?: boolean; // Wins + Quality Starts
    // Advanced Yahoo Stats - Pitching
    BK?: boolean;     // Balks
    BLL?: boolean;    // Balls Pitched
    BRA?: boolean;    // Baserunners Allowed (BB + H + HB)
    'BR/9'?: boolean; // Baserunners per 9 IP
    BABIPA?: boolean; // BABIP Against
    CGL?: boolean;    // Complete Game Losses
    DICE?: boolean;   // Defense-Independent Component ERA
    DPI?: boolean;    // Double Plays Induced
    '2BA'?: boolean;  // Doubles Allowed
    '3BA'?: boolean;  // Triples Allowed
    '1BA'?: boolean;  // Singles Allowed
    ERAP?: boolean;   // ERA Points
    ERAP2?: boolean;  // ERA Points 2
    HB?: boolean;     // Hit Batsmen
    IR?: boolean;     // Inherited Runners
    IRS?: boolean;    // Inherited Runners Stranded
    'K/BF'?: boolean; // Strikeouts per Batter Faced
    'K/BF%'?: boolean; // K/BF Percentage
    'K/IP'?: boolean; // Strikeouts per Inning
    OBPA?: boolean;   // On Base Percentage Against
    PG?: boolean;     // Perfect Games
    PIT?: boolean;    // Pitches Thrown
    PKO?: boolean;    // Pickoffs
    RA?: boolean;     // Relief Appearances
    R_allowed?: boolean; // Runs Allowed
    RW?: boolean;     // Relief Wins
    RL?: boolean;     // Relief Losses
    SW?: boolean;     // Starter Wins
    SL?: boolean;     // Starter Losses
    TBA?: boolean;    // Total Bases Allowed
    'T+B/IP'?: boolean; // (TB + BB) / IP
    WP?: boolean;     // Wild Pitches
    XBHA?: boolean;   // Extra Base Hits Allowed
    UER?: boolean;    // Unearned Runs
    CSA?: boolean;    // Caught Stealing Against
    'CSA%'?: boolean; // Caught Stealing Against %
    SBA?: boolean;    // Stolen Bases Against
    GIDP_pitcher?: boolean; // GIDP Against
    IBB_allowed?: boolean; // Intentional Walks Allowed
    SF_allowed?: boolean; // Sacrifice Flies Allowed
    A?: boolean;      // Assists (pitching)
    E?: boolean;      // Errors (pitching)
    'FLD%'?: boolean; // Fielding % (pitching)
    'OPS_against'?: boolean; // OPS Against
    'SLG_against'?: boolean; // Slugging Against
    OPSA?: boolean;   // OPS Against
    'EBN_allowed'?: boolean; // Extra Base Numbers Allowed
    XB_allowed?: boolean; // Extra Bases Allowed
    // Additional Advanced Stats
    'K-BB'?: boolean;   // Strikeouts - Walks
    'BB%'?: boolean;    // Walk Percentage
    'K%'?: boolean;     // Strikeout Percentage
    FIP?: boolean;      // Fielding Independent Pitching
    xFIP?: boolean;     // Expected FIP
    SIERA?: boolean;    // Skill-Interactive ERA
    LOB_pct?: boolean;  // Left On Base %
    GB_pct?: boolean;   // Ground Ball %
    FB_pct?: boolean;   // Fly Ball %
    LD_pct?: boolean;   // Line Drive %
    HR_FB?: boolean;    // Home Runs per Fly Ball
    'IP/GS'?: boolean;  // Innings per Game Started
    'P/IP'?: boolean;   // Pitches per Inning
    'P/GS'?: boolean;   // Pitches per Game Started
    'K/W'?: boolean;    // Strikeouts per Walk
    SVC?: boolean;      // Save Conversion (SV / SVO)
    BSV?: boolean;      // Blown Save Percentage
    HLD_pct?: boolean;  // Hold Percentage
    BQS?: boolean;      // Blown Quality Starts
    BQR?: boolean;      // Blown Quality Relief
    TQB?: boolean;      // Tough Quality Batters
    // Pitcher Points formulas
    PP?: boolean;       // Pitcher Points
    PP2?: boolean;      // Pitcher Points 2
    PP3?: boolean;      // Pitcher Points 3
    PP4?: boolean;      // Pitcher Points 4
    PP5?: boolean;      // Pitcher Points 5
  };
  // Point values for H2H Points
  pointsSettings?: {
    // ===== HITTING STATS =====
    // Core Counting
    H?: number;           // Hits
    '1B'?: number;        // Singles
    '2B'?: number;        // Doubles
    '3B'?: number;        // Triples
    HR?: number;          // Home Runs
    RBI?: number;         // Runs Batted In
    R?: number;           // Runs Scored
    BB?: number;          // Walks
    SB?: number;          // Stolen Bases
    // Negative Stats
    K_hitter?: number;    // Strikeouts (hitting)
    CS?: number;          // Caught Stealing
    GIDP?: number;        // Grounded Into Double Play
    SO_look?: number;     // Strikeouts Looking
    E_hitter?: number;    // Errors (fielding by hitter)
    // Additional Counting
    TB?: number;          // Total Bases
    XBH?: number;         // Extra Base Hits
    HBP?: number;         // Hit By Pitch
    SF?: number;          // Sacrifice Flies
    SH?: number;          // Sacrifice Hits (bunts)
    IBB?: number;         // Intentional Walks
    SBN?: number;         // Net Stolen Bases (SB - CS)
    GP_hitter?: number;   // Games Played (hitter)
    PA?: number;          // Plate Appearances
    AB?: number;          // At Bats
    // Rare Events
    Sl?: number;          // Grand Slams
    CYC?: number;         // Hit For The Cycle
    GWRBI?: number;       // Game Winning RBI
    // Fielding (by hitters)
    A?: number;           // Assists
    PO?: number;          // Putouts
    DP?: number;          // Double Plays Fielded
    TP?: number;          // Triple Plays Fielded
    PB?: number;          // Passed Balls (catcher)
    CSA_hitter?: number;  // Caught Stealing Against (catcher)
    SBA_hitter?: number;  // Stolen Bases Against (catcher)
    PKO_field?: number;   // Pickoffs (fielding)
    PKO_hitting?: number; // Picked Off (negative)
    // Advanced (less common)
    FB?: number;          // Fly Balls
    GB?: number;          // Ground Balls
    IF_hitter?: number;   // Innings Fielded
    AOF?: number;         // Assists by Outfielders
    POOF?: number;        // Putouts by Outfielders

    // ===== PITCHING STATS =====
    // Core Stats
    IP?: number;          // Innings Pitched
    W?: number;           // Wins
    K_pitcher?: number;   // Strikeouts Pitched
    SV?: number;          // Saves
    QS?: number;          // Quality Starts
    // Negative Stats
    L?: number;           // Losses
    ER?: number;          // Earned Runs Allowed
    H_allowed?: number;   // Hits Allowed
    BB_allowed?: number;  // Walks Allowed
    HR_allowed?: number;  // Home Runs Allowed
    R_allowed?: number;   // Runs Allowed (earned + unearned)
    BS?: number;          // Blown Saves
    HB?: number;          // Hit Batsmen
    WP?: number;          // Wild Pitches
    BK?: number;          // Balks
    // Additional Counting
    HD?: number;          // Holds
    SVH?: number;         // Saves + Holds
    SVH2?: number;        // Saves + Holds 2 (SV + 0.5×HLD)
    SVH3?: number;        // Saves + Holds 3 (0.5×SV + HLD)
    SVH4?: number;        // Saves + Holds 4 (SV + 0.75×HLD)
    SVH5?: number;        // Saves + Holds 5 (0.75×SV + HLD)
    SVH6?: number;        // Saves + Holds 6 (SV + 0.25×HLD)
    SVH7?: number;        // Saves + Holds 7 (0.25×SV + HLD)
    NS?: number;          // Net Saves (SV - BS)
    NS2?: number;         // Net Saves 2 (SV - 0.5×BS)
    NS3?: number;         // Net Saves 3 (SV - BS + HLD)
    NS4?: number;         // Net Saves 4 (SV + HLD - BS)
    NSH?: number;         // Net Saves + Holds (SVH - BS)
    NSH2?: number;        // Net Saves + Holds 2 ((SV + HLD) - BS)
    CG?: number;          // Complete Games
    SHO?: number;         // Shutouts
    NH?: number;          // No Hitters
    PG?: number;          // Perfect Games
    GS?: number;          // Games Started
    GF?: number;          // Games Finished
    GP_pitcher?: number;  // Games Played (pitcher)
    SVO?: number;         // Save Opportunities
    BF?: number;          // Batters Faced
    PIT?: number;         // Pitches Thrown
    'W+QS'?: number;      // Wins + Quality Starts
    // Splits
    SW?: number;          // Starter Wins
    SL?: number;          // Starter Losses
    RW?: number;          // Relief Wins
    RL?: number;          // Relief Losses
    RA?: number;          // Relief Appearances
    // Allowed Stats
    '1B_allowed'?: number;  // Singles Allowed
    '2B_allowed'?: number;  // Doubles Allowed
    '3B_allowed'?: number;  // Triples Allowed
    TB_allowed?: number;    // Total Bases Allowed
    IBB_allowed?: number;   // Intentional Walks Allowed
    SF_allowed?: number;    // Sacrifice Flies Allowed
    // Base Running Against
    SBA_pitcher?: number;   // Stolen Bases Against (pitcher)
    CSA_pitcher?: number;   // Caught Stealing Against (pitcher)
    PKO_pitcher?: number;   // Pickoffs (pitcher)
    // Inherited Runners
    IR?: number;          // Inherited Runners
    IRS?: number;         // Inherited Runners Stranded
    // Advanced (less common)
    GIDP_pitcher?: number; // Grounded Into Double Plays Against
    CGL?: number;         // Complete Game Losses
    DPI?: number;         // Double Plays Induced
    UER?: number;         // Unearned Runs Allowed
  };
  // Budget allocation split between hitters and pitchers (default 68/32)
  hitterPitcherSplit?: {
    hitter: number; // e.g., 0.68 for 68%
    pitcher: number; // e.g., 0.32 for 32%
  };
  /**
   * Market inflation adjustment settings
   * Controls how projected values are adjusted for real auction market behavior
   * Based on historical analysis showing elite players are undervalued and
   * replacement-level players are massively overvalued in projections
   */
  inflationSettings?: {
    /** Enable market-aware value adjustment (default: true) */
    enableMarketCorrection: boolean;
    /** Enable position-based scarcity adjustments (default: true) */
    enablePositionScarcity: boolean;
    /** Custom tier inflation factors (overrides defaults if provided) */
    tierFactors?: Record<number, number>;
    /** Custom position scarcity factors (overrides defaults if provided) */
    positionFactors?: Record<string, number>;
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
  timeRemaining?: number; // For on_block status - seconds remaining in auction
  tier?: number;
  isInDraftPool?: boolean; // Whether player is in the draftable pool
  isTwoWayPlayer?: boolean; // Whether this is a combined two-way player (e.g., Ohtani)
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
  setupStep?: number; // Current step in setup wizard (1-5), only for status='setup'
}

export interface SubscriptionInfo {
  tier: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodEnd?: string; // ISO date string for when subscription ends
  cancelAtPeriodEnd?: boolean; // If true, subscription won't renew
}

export interface UserData {
  username: string;
  email: string;
  leagues: SavedLeague[];
  authProvider?: 'email' | 'google';
  profilePicture?: string;
  subscription?: SubscriptionInfo;
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

/**
 * Custom dynasty ranking entry from user-uploaded CSV/Excel
 */
export interface CustomDynastyRanking {
  name: string;           // Player name from upload
  rank: number;           // Dynasty rank
  playerId?: string;      // Optional player ID (FanGraphs, MLB, etc.)
}
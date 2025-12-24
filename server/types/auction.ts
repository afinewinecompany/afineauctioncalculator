// Types for Couch Managers auction scraping

export interface ScrapedPlayer {
  couchManagersId: number;
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

export interface InflationStats {
  overallInflationRate: number;
  totalProjectedValue: number;
  totalActualSpent: number;
  draftedPlayersCount: number;
  averageInflationPerPlayer: number;
  remainingBudgetInflationAdjustment: number;
}

export interface AuctionSyncResult {
  auctionData: ScrapedAuctionData;
  matchedPlayers: MatchedPlayer[];
  inflationStats: InflationStats;
  unmatchedPlayers: ScrapedPlayer[];
}

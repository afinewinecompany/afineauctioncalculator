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
}

export interface Player {
  id: string;
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
    W?: number;
    K?: number;
    ERA?: number;
    WHIP?: number;
    SV?: number;
  };
  status: 'available' | 'drafted' | 'onMyTeam';
  draftedPrice?: number;
  draftedBy?: string;
  tier?: number;
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
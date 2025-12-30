import { Player, LeagueSettings } from './types';

export const defaultLeagueSettings: LeagueSettings = {
  leagueName: 'My Fantasy League',
  couchManagerRoomId: '',
  numTeams: 12,
  budgetPerTeam: 260,
  rosterSpots: {
    C: 1,
    '1B': 1,
    '2B': 1,
    '3B': 1,
    SS: 1,
    OF: 3,
    CI: 1,
    MI: 1,
    UTIL: 1,
    SP: 0,
    RP: 0,
    P: 7,
    Bench: 3
  },
  leagueType: 'redraft',
  scoringType: 'rotisserie',
  projectionSystem: 'steamer',
  // Default Roto categories (5x5)
  hittingCategories: {
    R: true,
    HR: true,
    RBI: true,
    SB: true,
    AVG: true
  },
  pitchingCategories: {
    W: true,
    K: true,
    ERA: true,
    WHIP: true,
    SV: true
  },
  // Dynasty settings (used when leagueType === 'dynasty')
  dynastySettings: {
    dynastyWeight: 0.5, // 50/50 blend of projections and dynasty rankings
    includeMinors: true,
    rankingsSource: undefined, // User must select a rankings source
    customRankings: undefined
  }
};

export const generateMockPlayers = (): Player[] => {
  const hitters = [
    { name: 'Aaron Judge', team: 'NYY', positions: ['OF'], tier: 1, HR: 58, RBI: 144, SB: 10, AVG: 0.311, value: 51 },
    { name: 'Ronald Acuña Jr.', team: 'ATL', positions: ['OF'], tier: 1, HR: 41, RBI: 106, SB: 73, AVG: 0.337, value: 54 },
    { name: 'Mookie Betts', team: 'LAD', positions: ['OF', '2B'], tier: 1, HR: 39, RBI: 107, SB: 16, AVG: 0.307, value: 49 },
    { name: 'Freddie Freeman', team: 'LAD', positions: ['1B'], tier: 1, HR: 29, RBI: 102, SB: 8, AVG: 0.331, value: 43 },
    { name: 'Jose Ramirez', team: 'CLE', positions: ['3B'], tier: 1, HR: 39, RBI: 118, SB: 20, AVG: 0.269, value: 45 },
    
    { name: 'Corey Seager', team: 'TEX', positions: ['SS'], tier: 2, HR: 33, RBI: 96, SB: 2, AVG: 0.327, value: 38 },
    { name: 'Kyle Tucker', team: 'HOU', positions: ['OF'], tier: 2, HR: 29, RBI: 112, SB: 30, AVG: 0.284, value: 41 },
    { name: 'Juan Soto', team: 'NYY', positions: ['OF'], tier: 2, HR: 35, RBI: 109, SB: 7, AVG: 0.288, value: 40 },
    { name: 'Bobby Witt Jr.', team: 'KC', positions: ['SS'], tier: 2, HR: 30, RBI: 96, SB: 49, AVG: 0.276, value: 42 },
    { name: 'Matt Olson', team: 'ATL', positions: ['1B'], tier: 2, HR: 54, RBI: 139, SB: 0, AVG: 0.283, value: 39 },
    
    { name: 'Marcus Semien', team: 'TEX', positions: ['2B'], tier: 2, HR: 29, RBI: 100, SB: 14, AVG: 0.276, value: 34 },
    { name: 'Will Smith', team: 'LAD', positions: ['C'], tier: 2, HR: 19, RBI: 76, SB: 3, AVG: 0.261, value: 28 },
    { name: 'Rafael Devers', team: 'BOS', positions: ['3B'], tier: 2, HR: 33, RBI: 105, SB: 3, AVG: 0.272, value: 36 },
    { name: 'Fernando Tatis Jr.', team: 'SD', positions: ['OF'], tier: 2, HR: 36, RBI: 97, SB: 36, AVG: 0.276, value: 44 },
    { name: 'Yordan Alvarez', team: 'HOU', positions: ['OF', 'UTIL'], tier: 2, HR: 35, RBI: 97, SB: 1, AVG: 0.293, value: 37 },
    
    { name: 'Luis Arraez', team: 'MIA', positions: ['1B', '2B'], tier: 3, HR: 4, RBI: 37, SB: 10, AVG: 0.354, value: 25 },
    { name: 'Adley Rutschman', team: 'BAL', positions: ['C'], tier: 3, HR: 20, RBI: 80, SB: 2, AVG: 0.277, value: 24 },
    { name: 'J.T. Realmuto', team: 'PHI', positions: ['C'], tier: 3, HR: 20, RBI: 72, SB: 21, AVG: 0.252, value: 26 },
    { name: 'Austin Riley', team: 'ATL', positions: ['3B'], tier: 3, HR: 37, RBI: 97, SB: 3, AVG: 0.271, value: 32 },
    { name: 'Trea Turner', team: 'PHI', positions: ['SS'], tier: 3, HR: 26, RBI: 86, SB: 30, AVG: 0.266, value: 35 },
    
    { name: 'Julio Rodriguez', team: 'SEA', positions: ['OF'], tier: 3, HR: 32, RBI: 103, SB: 37, AVG: 0.275, value: 38 },
    { name: 'Randy Arozarena', team: 'TB', positions: ['OF'], tier: 3, HR: 23, RBI: 69, SB: 26, AVG: 0.254, value: 27 },
    { name: 'Ketel Marte', team: 'ARI', positions: ['2B', 'OF'], tier: 3, HR: 25, RBI: 85, SB: 11, AVG: 0.283, value: 29 },
    { name: 'Gunnar Henderson', team: 'BAL', positions: ['SS', '3B'], tier: 3, HR: 28, RBI: 82, SB: 18, AVG: 0.255, value: 31 },
    { name: 'Vladimir Guerrero Jr.', team: 'TOR', positions: ['1B'], tier: 3, HR: 26, RBI: 94, SB: 3, AVG: 0.264, value: 30 },
    
    { name: 'Bo Bichette', team: 'TOR', positions: ['SS'], tier: 4, HR: 20, RBI: 73, SB: 13, AVG: 0.277, value: 25 },
    { name: 'Pete Alonso', team: 'NYM', positions: ['1B'], tier: 4, HR: 46, RBI: 118, SB: 2, AVG: 0.217, value: 28 },
    { name: 'Manny Machado', team: 'SD', positions: ['3B'], tier: 4, HR: 30, RBI: 98, SB: 8, AVG: 0.258, value: 27 },
    { name: 'Ozzie Albies', team: 'ATL', positions: ['2B'], tier: 4, HR: 35, RBI: 106, SB: 10, AVG: 0.263, value: 29 },
    { name: 'George Springer', team: 'TOR', positions: ['OF'], tier: 4, HR: 21, RBI: 55, SB: 7, AVG: 0.252, value: 20 },
    
    { name: 'Michael Harris II', team: 'ATL', positions: ['OF'], tier: 4, HR: 18, RBI: 56, SB: 20, AVG: 0.297, value: 23 },
    { name: 'Salvador Perez', team: 'KC', positions: ['C'], tier: 4, HR: 28, RBI: 98, SB: 0, AVG: 0.254, value: 22 },
    { name: 'Dansby Swanson', team: 'CHC', positions: ['SS'], tier: 4, HR: 22, RBI: 80, SB: 16, AVG: 0.244, value: 22 },
    { name: 'Anthony Santander', team: 'BAL', positions: ['OF'], tier: 4, HR: 28, RBI: 89, SB: 5, AVG: 0.257, value: 21 },
    { name: 'Christian Yelich', team: 'MIL', positions: ['OF'], tier: 4, HR: 19, RBI: 76, SB: 28, AVG: 0.278, value: 24 },
  ];

  const pitchers = [
    { name: 'Spencer Strider', team: 'ATL', positions: ['SP'], tier: 1, W: 20, K: 281, ERA: 3.86, WHIP: 1.08, value: 42 },
    { name: 'Gerrit Cole', team: 'NYY', positions: ['SP'], tier: 1, W: 15, K: 222, ERA: 2.63, WHIP: 1.02, value: 38 },
    { name: 'Kevin Gausman', team: 'TOR', positions: ['SP'], tier: 1, W: 12, K: 237, ERA: 3.16, WHIP: 1.07, value: 35 },
    { name: 'Zack Wheeler', team: 'PHI', positions: ['SP'], tier: 1, W: 13, K: 212, ERA: 3.61, WHIP: 1.08, value: 34 },
    { name: 'Corbin Burnes', team: 'BAL', positions: ['SP'], tier: 1, W: 10, K: 200, ERA: 3.39, WHIP: 1.08, value: 33 },
    
    { name: 'Sonny Gray', team: 'STL', positions: ['SP'], tier: 2, W: 14, K: 183, ERA: 2.79, WHIP: 1.09, value: 31 },
    { name: 'Blake Snell', team: 'SD', positions: ['SP'], tier: 2, W: 14, K: 234, ERA: 2.25, WHIP: 1.19, value: 32 },
    { name: 'Logan Webb', team: 'SF', positions: ['SP'], tier: 2, W: 13, K: 194, ERA: 3.25, WHIP: 1.13, value: 29 },
    { name: 'Freddy Peralta', team: 'MIL', positions: ['SP'], tier: 2, W: 11, K: 214, ERA: 3.58, WHIP: 1.15, value: 28 },
    { name: 'Pablo Lopez', team: 'MIN', positions: ['SP'], tier: 2, W: 15, K: 204, ERA: 3.66, WHIP: 1.12, value: 30 },
    
    { name: 'Emmanuel Clase', team: 'CLE', positions: ['RP'], tier: 2, W: 3, K: 66, ERA: 1.36, WHIP: 0.75, SV: 44, value: 28 },
    { name: 'Josh Hader', team: 'HOU', positions: ['RP'], tier: 2, W: 4, K: 71, ERA: 1.28, WHIP: 0.83, SV: 33, value: 26 },
    { name: 'Félix Bautista', team: 'BAL', positions: ['RP'], tier: 2, W: 2, K: 77, ERA: 1.48, WHIP: 0.93, SV: 35, value: 25 },
    { name: 'Ryan Helsley', team: 'STL', positions: ['RP'], tier: 3, W: 7, K: 79, ERA: 2.91, WHIP: 1.17, SV: 14, value: 18 },
    { name: 'Andrés Muñoz', team: 'SEA', positions: ['RP'], tier: 3, W: 3, K: 72, ERA: 2.60, WHIP: 0.96, SV: 18, value: 19 },
    
    { name: 'Framber Valdez', team: 'HOU', positions: ['SP'], tier: 3, W: 12, K: 166, ERA: 2.91, WHIP: 1.11, value: 27 },
    { name: 'Joe Ryan', team: 'MIN', positions: ['SP'], tier: 3, W: 11, K: 183, ERA: 3.60, WHIP: 1.14, value: 25 },
    { name: 'George Kirby', team: 'SEA', positions: ['SP'], tier: 3, W: 13, K: 190, ERA: 3.28, WHIP: 1.07, value: 26 },
    { name: 'Luis Castillo', team: 'SEA', positions: ['SP'], tier: 3, W: 14, K: 219, ERA: 3.34, WHIP: 1.17, value: 28 },
    { name: 'Hunter Brown', team: 'HOU', positions: ['SP'], tier: 3, W: 11, K: 173, ERA: 3.49, WHIP: 1.23, value: 22 },
    
    { name: 'Alexis Díaz', team: 'CIN', positions: ['RP'], tier: 3, W: 2, K: 64, ERA: 3.33, WHIP: 1.16, SV: 29, value: 20 },
    { name: 'David Bednar', team: 'PIT', positions: ['RP'], tier: 3, W: 5, K: 52, ERA: 2.61, WHIP: 1.05, SV: 39, value: 21 },
    { name: 'Camilo Doval', team: 'SF', positions: ['RP'], tier: 3, W: 7, K: 62, ERA: 2.93, WHIP: 1.15, SV: 39, value: 21 },
    { name: 'Paul Sewald', team: 'ARI', positions: ['RP'], tier: 3, W: 5, K: 77, ERA: 3.58, WHIP: 1.17, SV: 36, value: 19 },
    { name: 'Clay Holmes', team: 'NYY', positions: ['RP'], tier: 4, W: 3, K: 65, ERA: 2.69, WHIP: 1.11, SV: 13, value: 15 },
    
    { name: 'Shota Imanaga', team: 'CHC', positions: ['SP'], tier: 4, W: 12, K: 174, ERA: 3.18, WHIP: 1.09, value: 23 },
    { name: 'Bryce Miller', team: 'SEA', positions: ['SP'], tier: 4, W: 11, K: 158, ERA: 3.74, WHIP: 1.16, value: 21 },
    { name: 'Tyler Glasnow', team: 'LAD', positions: ['SP'], tier: 4, W: 10, K: 162, ERA: 3.53, WHIP: 1.15, value: 22 },
    { name: 'Shane Bieber', team: 'CLE', positions: ['SP'], tier: 4, W: 10, K: 153, ERA: 3.80, WHIP: 1.22, value: 20 },
    { name: 'Cristopher Sánchez', team: 'PHI', positions: ['SP'], tier: 4, W: 11, K: 151, ERA: 3.44, WHIP: 1.17, value: 20 },
  ];

  return [...hitters, ...pitchers].map((p, index) => ({
    id: `player-${index}`,
    name: p.name,
    team: p.team,
    positions: p.positions,
    projectedValue: p.value,
    adjustedValue: p.value,
    projectedStats: {
      HR: p.HR,
      RBI: p.RBI,
      SB: p.SB,
      AVG: p.AVG,
      W: p.W,
      K: p.K,
      ERA: p.ERA,
      WHIP: p.WHIP,
      SV: p.SV
    },
    status: 'available' as const,
    tier: p.tier
  }));
};
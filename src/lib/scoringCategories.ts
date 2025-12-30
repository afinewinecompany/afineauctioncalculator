// Shared scoring category definitions used by ScoringConfig and EditLeagueModal

export interface CategoryOption {
  key: string;
  label: string;
  description: string;
  isRatio?: boolean;  // Rate stats that need special handling
  isNegative?: boolean; // Stats that hurt your team
}

export interface CategorySection {
  name: string;
  options: CategoryOption[];
}

export interface PointOption {
  key: string;
  label: string;
  defaultValue: number;
  description?: string;
}

export interface PointSection {
  name: string;
  options: PointOption[];
}

// Organized hitting categories by section
export const hittingCategorySections: CategorySection[] = [
  {
    name: 'Core Stats',
    options: [
      { key: 'R', label: 'Runs (R)', description: 'Runs scored' },
      { key: 'HR', label: 'Home Runs (HR)', description: 'Home runs hit' },
      { key: 'RBI', label: 'RBI', description: 'Runs batted in' },
      { key: 'SB', label: 'Stolen Bases (SB)', description: 'Bases stolen' },
      { key: 'H', label: 'Hits (H)', description: 'Total hits' },
    ]
  },
  {
    name: 'Rate Stats',
    options: [
      { key: 'AVG', label: 'Batting Average (AVG)', description: 'Hits / At Bats', isRatio: true },
      { key: 'OBP', label: 'On-Base % (OBP)', description: '(H + BB + HBP) / (AB + BB + HBP + SF)', isRatio: true },
      { key: 'SLG', label: 'Slugging % (SLG)', description: 'Total Bases / At Bats', isRatio: true },
      { key: 'OPS', label: 'OPS', description: 'On-Base + Slugging', isRatio: true },
    ]
  },
  {
    name: 'Additional Counting',
    options: [
      { key: 'XBH', label: 'Extra Base Hits (XBH)', description: 'Doubles + Triples + HR' },
      { key: 'TB', label: 'Total Bases (TB)', description: '1B + 2×2B + 3×3B + 4×HR' },
      { key: 'BB', label: 'Walks (BB)', description: 'Bases on balls' },
      { key: '1B', label: 'Singles (1B)', description: 'Single-base hits' },
      { key: '2B', label: 'Doubles (2B)', description: 'Two-base hits' },
      { key: '3B', label: 'Triples (3B)', description: 'Three-base hits' },
    ]
  },
  {
    name: 'Advanced / Less Common',
    options: [
      { key: 'SBN', label: 'Net Stolen Bases (SBN)', description: 'SB - CS' },
      { key: 'CS', label: 'Caught Stealing (CS)', description: 'Times caught stealing', isNegative: true },
      { key: 'SO', label: 'Strikeouts (SO)', description: 'Strikeouts (batter)', isNegative: true },
      { key: 'GIDP', label: 'Double Plays (GIDP)', description: 'Grounded into double play', isNegative: true },
      { key: 'HBP', label: 'Hit By Pitch (HBP)', description: 'Hit by pitch (batter)' },
      { key: 'SF', label: 'Sacrifice Flies (SF)', description: 'Fly out that scores a run' },
      { key: 'RC', label: 'Runs Created (RC)', description: 'Sabermetric formula', isRatio: true },
      { key: 'GP', label: 'Games Played (GP)', description: 'Games played' },
      { key: 'PA', label: 'Plate Appearances (PA)', description: 'Total plate appearances' },
      { key: 'AB', label: 'At Bats (AB)', description: 'Official at bats' },
    ]
  },
  {
    name: 'Fielding',
    options: [
      { key: 'A', label: 'Assists (A)', description: 'Fielding assists' },
      { key: 'E', label: 'Errors (E)', description: 'Fielding errors', isNegative: true },
      { key: 'FLD%', label: 'Fielding % (FLD%)', description: '(PO + A) / (PO + A + E)', isRatio: true },
      { key: 'PO', label: 'Putouts (PO)', description: 'Defensive putouts' },
      { key: 'DP', label: 'Double Plays (DP)', description: 'Double plays fielded' },
      { key: 'TP', label: 'Triple Plays (TP)', description: 'Triple plays fielded' },
      { key: 'PB', label: 'Passed Balls (PB)', description: 'Catcher passed balls', isNegative: true },
      { key: 'CSA', label: 'CS Against (CSA)', description: 'Caught stealing against' },
      { key: 'SBA', label: 'SB Against (SBA)', description: 'Stolen bases against', isNegative: true },
      { key: 'AOF', label: 'Assists by OF (AOF)', description: 'Outfield assists' },
      { key: 'IF', label: 'Innings Fielded (IF)', description: 'Defensive innings' },
    ]
  },
  {
    name: 'Advanced',
    options: [
      { key: 'BABIP', label: 'BABIP', description: 'Batting avg on balls in play', isRatio: true },
      { key: 'ISO', label: 'Isolated Power (ISO)', description: 'SLG - AVG', isRatio: true },
      { key: 'WOBA', label: 'wOBA', description: 'Weighted On-Base Average', isRatio: true },
      { key: 'EBN', label: 'Extra Base Numbers (EBN)', description: 'BB + 2×2B + 3×3B' },
      { key: 'CYC', label: 'Hit For Cycle (CYC)', description: '1B, 2B, 3B, HR in one game' },
      { key: 'GWRBI', label: 'Game Winning RBI (GWRBI)', description: 'Go-ahead RBI in final' },
      { key: 'Sl', label: 'Grand Slams (Sl)', description: 'Bases loaded home runs' },
      { key: 'IBB', label: 'Intentional Walks (IBB)', description: 'Intentional walks' },
      { key: 'SH', label: 'Sacrifice Hits (SH)', description: 'Sacrifice bunts' },
      { key: 'SB%', label: 'Stolen Base % (SB%)', description: 'SB / (SB + CS)', isRatio: true },
      { key: 'SOL', label: 'Strikeouts Looking (SOL)', description: 'Called third strikes', isNegative: true },
      { key: 'PKO', label: 'Picked Off (PKO)', description: 'Times picked off', isNegative: true },
    ]
  },
  {
    name: 'Rate Stats (Advanced)',
    options: [
      { key: 'BAP', label: 'Batting Average Points (BAP)', description: 'Formula-based batting average', isRatio: true },
      { key: 'AVOB', label: 'Batting Avg On Base (AVOB)', description: '(AVG + OBP) / 2', isRatio: true },
      { key: 'MOBP', label: 'Modified OBP (MOBP)', description: '(H + BB + HBP) / (AB + BB + HBP)', isRatio: true },
      { key: 'RC', label: 'Runs Created (RC)', description: 'Sabermetric formula', isRatio: true },
      { key: 'RC2', label: 'Runs Created 2 (RC2)', description: 'Alt runs created formula', isRatio: true },
      { key: 'RC27', label: 'Runs Created/27 (RC27)', description: 'RC per 27 outs', isRatio: true },
      { key: 'K%', label: 'Strikeout % (K%)', description: 'K / PA', isRatio: true, isNegative: true },
      { key: 'BB/PA', label: 'Walk % (BB/PA)', description: 'BB / PA', isRatio: true },
      { key: 'BB/K', label: 'Walk/K Ratio (BB/K)', description: 'BB / K', isRatio: true },
      { key: 'BBK/G', label: '(BB - K) / Game', description: 'Net BB per game', isRatio: true },
      { key: 'HR/PA', label: 'HR/PA', description: 'Home runs per PA', isRatio: true },
      { key: 'P/PA', label: 'Pitches/PA (P/PA)', description: 'Pitches seen per PA', isRatio: true },
      { key: 'GB/FB', label: 'GB/FB Ratio', description: 'Ground ball to fly ball', isRatio: true },
      { key: 'SPP', label: 'Scoring Prod % (SPP)', description: '(R + RBI - HR) / AB', isRatio: true },
    ]
  },
  {
    name: 'Counting (Advanced)',
    options: [
      { key: 'BC', label: 'Bases Custom (BC)', description: 'BB + 2×2B + 3×3B + 3×SB' },
      { key: 'MTB', label: 'Modified TB (MTB)', description: 'TB + SB - CS/2' },
      { key: 'RP', label: 'Runs Produced (RP)', description: 'RBI + R - HR' },
      { key: 'RP2', label: 'Runs Produced 2 (RP2)', description: 'RBI + R' },
      { key: 'SP', label: 'Scoring Prod (SP)', description: 'R + RBI - HR' },
      { key: 'R+RBI', label: 'R + RBI', description: 'Runs plus RBI' },
      { key: 'R+SB', label: 'R + SB', description: 'Runs plus stolen bases' },
      { key: 'HR+SB', label: 'HR + SB', description: 'Home runs plus SB' },
      { key: 'H+R+RBI', label: 'H + R + RBI', description: 'Hits + Runs + RBI' },
      { key: 'HBB', label: 'H + BB', description: 'Hits plus walks' },
      { key: 'HBBHBP', label: 'H + BB + HBP', description: 'Total times on base' },
      { key: 'TB+HP', label: 'TB + HBP', description: 'Total bases + HBP' },
      { key: 'TB+RBI', label: 'TB + RBI', description: 'Total bases + RBI' },
      { key: 'TB+BB', label: 'TB + BB', description: 'Total bases + walks' },
      { key: 'T+B+H', label: 'TB + BB + HBP', description: 'All bases gained' },
      { key: 'TB-HR', label: 'TB - HR', description: 'Total bases minus HR' },
      { key: 'TSB', label: 'TB + SB', description: 'Total + stolen bases' },
      { key: 'LOB', label: 'Runners LOB (LOB)', description: 'Runners left on base', isNegative: true },
      { key: 'RL2O', label: 'RISP LOB 2 Out', description: 'RISP left on base w/ 2 outs', isNegative: true },
      { key: 'OUT', label: 'Outs Made (OUT)', description: 'Outs made', isNegative: true },
    ]
  },
  {
    name: 'Doubles & Triples',
    options: [
      { key: '2B+3B', label: 'Doubles + Triples', description: '2B + 3B' },
      { key: '2B+3B2', label: 'Doubles + 2×Triples', description: '2B + 2×3B' },
      { key: '2B2+3B5', label: '2×2B + 5×3B', description: 'Weighted doubles and triples' },
      { key: '3BSB', label: 'Triples + SB', description: '3B + SB' },
      { key: '3B2SB', label: '2×Triples + SB', description: '2×3B + SB' },
      { key: 'HR2B', label: '2×HR + 2B', description: 'Home runs and doubles' },
      { key: 'XB', label: 'Extra Bases (XB)', description: '2B + 2×3B + 3×HR' },
      { key: 'XBS', label: 'Extra Bases + SH', description: 'XB + Sacrifice hits' },
      { key: '1B+2B+3B', label: '1B + 2B + 3B', description: 'Non-HR hits' },
    ]
  },
  {
    name: 'Total Bases Variants',
    options: [
      { key: 'TB2', label: 'Total Bases 2 (TB2)', description: '1B + 2×2B + 3×3B + BB + HBP' },
      { key: 'TB3', label: 'Total Bases 3 (TB3)', description: 'Alternate TB formula' },
      { key: 'TB4', label: 'Total Bases 4 (TB4)', description: 'Alternate TB formula' },
      { key: 'TB5', label: 'Total Bases 5 (TB5)', description: 'Alternate TB formula' },
      { key: 'TB6', label: 'Total Bases 6 (TB6)', description: 'Alternate TB formula' },
      { key: 'RTB', label: 'Revised Total Bases', description: 'Alternative TB calculation' },
    ]
  },
  {
    name: 'Walks & HBP',
    options: [
      { key: 'NIBB', label: 'Non-Intentional BB (NIBB)', description: 'Unintentional walks' },
      { key: '1B+BB', label: 'Singles + Walks', description: '1B + BB' },
      { key: 'BB+HBP', label: 'BB + HBP', description: 'Free passes' },
      { key: 'BB+R', label: 'BB + Runs', description: 'Walks plus runs' },
      { key: 'BB+SB', label: 'BB + SB', description: 'Walks plus SB' },
      { key: 'BBHS', label: 'BB + HBP + SB', description: 'Free passes plus SB' },
    ]
  },
  {
    name: 'Stolen Base Variants',
    options: [
      { key: 'SBN2', label: 'Net SB 2 (SBN2)', description: 'SB - 0.5×CS' },
      { key: 'SBN3', label: 'Net SB 3 (SBN3)', description: 'SB - CS - PKO' },
      { key: 'NSB', label: 'Net Speed Bases (NSB)', description: 'SB + 0.5×2B + 2×3B - CS - PKO' },
      { key: 'WSB', label: 'Weighted SB (WSB)', description: 'Weighted stolen bases' },
    ]
  },
  {
    name: 'Strikeout & GIDP',
    options: [
      { key: 'KDP', label: 'K + 2×GIDP (KDP)', description: 'K plus double GIDP', isNegative: true },
      { key: 'KDP2', label: 'K + GIDP (KDP2)', description: 'Strikeouts plus GIDP', isNegative: true },
      { key: 'SFC', label: 'Strikes Faced (SFC)', description: 'Strikes faced' },
      { key: 'BLF', label: 'Balls Faced (BLF)', description: 'Balls faced' },
    ]
  },
  {
    name: 'Games & Events',
    options: [
      { key: 'MHG', label: 'Multi-Hit Games (MHG)', description: '2+ hit games' },
      { key: 'MHRG', label: 'Multi-HR Games (MHRG)', description: '2+ HR games' },
      { key: 'MOBG', label: 'Multi-OB Games (MOBG)', description: '2+ times on base games' },
      { key: 'PHG', label: 'Perfect Hit Games (PHG)', description: 'Games with no outs' },
      { key: 'QAB', label: 'Quality At Bats (QAB)', description: 'Productive at-bats' },
      { key: 'CI', label: 'Catcher Interference (CI)', description: 'Reached on CI' },
      { key: 'SH+SF', label: 'Sacrifice H + F', description: 'Total sacrifices' },
      { key: 'SHFB', label: 'SH + SF + SB', description: 'Sacrifices plus SB' },
      { key: 'CS-PO', label: 'CS + Picked Off', description: 'Times erased on bases', isNegative: true },
    ]
  },
  {
    name: 'Batted Ball',
    options: [
      { key: 'FB', label: 'Fly Balls (FB)', description: 'Fly balls hit' },
      { key: 'GB', label: 'Ground Balls (GB)', description: 'Ground balls hit' },
    ]
  },
  {
    name: 'Hitter Points Formulas',
    options: [
      { key: 'HP', label: 'Hitter Points (HP)', description: 'Hitter points formula' },
      { key: 'HP2', label: 'Hitter Points 2', description: 'Alt hitter points' },
      { key: 'HP3', label: 'Hitter Points 3', description: 'Alt hitter points' },
      { key: 'HP4', label: 'Hitter Points 4', description: 'Alt hitter points' },
      { key: 'HP5', label: 'Hitter Points 5', description: 'Alt hitter points' },
      { key: 'HP7', label: 'Hitter Points 7', description: 'Alt hitter points' },
      { key: 'HP8', label: 'Hitter Points 8', description: 'Alt hitter points' },
      { key: 'HP9', label: 'Hitter Points 9', description: 'Alt hitter points' },
      { key: 'HP10', label: 'Hitter Points 10', description: 'Alt hitter points' },
      { key: 'BBKS', label: '2×BB - 0.5×K', description: 'Walk-strikeout balance' },
      { key: 'FPT', label: 'Fielding Points (FPT)', description: 'Fielding points formula' },
      { key: 'FPT2', label: 'Fielding Points 2', description: 'Alt fielding points' },
      { key: 'FPT3', label: 'Fielding Points 3', description: 'Alt fielding points' },
    ]
  },
  {
    name: 'Catcher Defense',
    options: [
      { key: 'POOF', label: 'Putouts by OF (POOF)', description: 'Outfield putouts' },
      { key: 'PKO_field', label: 'Pickoffs (PKO)', description: 'Pickoffs as catcher/fielder' },
    ]
  }
];

// Organized pitching categories by section
export const pitchingCategorySections: CategorySection[] = [
  {
    name: 'Core Stats',
    options: [
      { key: 'W', label: 'Wins (W)', description: 'Pitching wins' },
      { key: 'K', label: 'Strikeouts (K)', description: 'Strikeouts pitched' },
      { key: 'ERA', label: 'ERA', description: 'Earned runs per 9 IP', isRatio: true },
      { key: 'WHIP', label: 'WHIP', description: '(BB + H) / IP', isRatio: true },
      { key: 'SV', label: 'Saves (SV)', description: 'Games saved' },
      { key: 'QS', label: 'Quality Starts (QS)', description: '6+ IP, 3 or fewer ER' },
    ]
  },
  {
    name: 'Rate Stats',
    options: [
      { key: 'K_BB', label: 'K/BB Ratio', description: 'Strikeouts per walk', isRatio: true },
      { key: 'K9', label: 'K/9', description: 'Strikeouts per 9 IP', isRatio: true },
      { key: 'BB9', label: 'BB/9', description: 'Walks per 9 IP', isRatio: true, isNegative: true },
      { key: 'HR9', label: 'HR/9', description: 'Home runs per 9 IP', isRatio: true, isNegative: true },
      { key: 'H/IP', label: 'H/IP', description: 'Hits per inning pitched', isRatio: true, isNegative: true },
      { key: 'BAA', label: 'BAA', description: 'Batting avg against', isRatio: true },
      { key: 'SV%', label: 'Save % (SV%)', description: 'Saves / Save Opportunities', isRatio: true },
      { key: 'W%', label: 'Win % (W%)', description: 'Wins / (Wins + Losses)', isRatio: true },
    ]
  },
  {
    name: 'Saves & Holds',
    options: [
      { key: 'SVH', label: 'Saves + Holds (SVH)', description: 'SV + HLD' },
      { key: 'SVH2', label: 'Saves + Holds 2', description: 'SV + 0.5×HLD' },
      { key: 'SVH3', label: 'Saves + Holds 3', description: '0.5×SV + HLD' },
      { key: 'SVH4', label: 'Saves + Holds 4', description: 'SV + 0.75×HLD' },
      { key: 'SVH5', label: 'Saves + Holds 5', description: '0.75×SV + HLD' },
      { key: 'SVH6', label: 'Saves + Holds 6', description: 'SV + 0.25×HLD' },
      { key: 'SVH7', label: 'Saves + Holds 7', description: '0.25×SV + HLD' },
      { key: 'HLD', label: 'Holds (HLD)', description: 'Relief appearances protecting lead' },
      { key: 'BS', label: 'Blown Saves (BS)', description: 'Failed save attempts', isNegative: true },
      { key: 'SVO', label: 'Save Opportunities (SVO)', description: 'Chances to earn a save' },
    ]
  },
  {
    name: 'Net Saves',
    options: [
      { key: 'NS', label: 'Net Saves (NS)', description: 'SV - BS' },
      { key: 'NS2', label: 'Net Saves 2 (NS2)', description: 'SV - 0.5×BS' },
      { key: 'NS3', label: 'Net Saves 3 (NS3)', description: 'SV - BS + HLD' },
      { key: 'NS4', label: 'Net Saves 4 (NS4)', description: 'SV + HLD - BS' },
      { key: 'NSH', label: 'Net SVH (NSH)', description: '(SV + HLD) - BS' },
      { key: 'NSH2', label: 'Net SVH 2 (NSH2)', description: 'Alt net saves + holds' },
    ]
  },
  {
    name: 'Additional Counting',
    options: [
      { key: 'IP', label: 'Innings Pitched (IP)', description: 'Total innings pitched' },
      { key: 'L', label: 'Losses (L)', description: 'Pitching losses', isNegative: true },
      { key: 'CG', label: 'Complete Games (CG)', description: 'Games pitched start to finish' },
      { key: 'SHO', label: 'Shutouts (SHO)', description: 'Complete games with 0 runs' },
      { key: 'NH', label: 'No Hitters (NH)', description: 'No hits allowed (9+ IP)' },
      { key: 'W+QS', label: 'Wins + QS (W+QS)', description: 'Wins plus Quality Starts' },
      { key: 'GS', label: 'Games Started (GS)', description: 'Games started as pitcher' },
      { key: 'GF', label: 'Games Finished (GF)', description: 'Last pitcher in a game' },
      { key: 'BF', label: 'Batters Faced (BF)', description: 'Total batters faced' },
    ]
  },
  {
    name: 'Negative Stats',
    options: [
      { key: 'ER', label: 'Earned Runs (ER)', description: 'Earned runs allowed', isNegative: true },
      { key: 'HA', label: 'Hits Allowed (HA)', description: 'Hits given up', isNegative: true },
      { key: 'BBA', label: 'Walks Allowed (BBA)', description: 'Walks given up', isNegative: true },
      { key: 'HRA', label: 'HR Allowed (HRA)', description: 'Home runs given up', isNegative: true },
      { key: 'R_allowed', label: 'Runs Allowed (R)', description: 'Total runs allowed', isNegative: true },
      { key: 'HB', label: 'Hit Batsmen (HB)', description: 'Batters hit by pitch', isNegative: true },
      { key: 'WP', label: 'Wild Pitches (WP)', description: 'Wild pitches thrown', isNegative: true },
      { key: 'BK', label: 'Balks (BK)', description: 'Balk violations', isNegative: true },
    ]
  },
  {
    name: 'Advanced Rate Stats',
    options: [
      { key: 'BABIPA', label: 'BABIP Against', description: 'BABIP against pitcher', isRatio: true },
      { key: 'DICE', label: 'DICE', description: 'Defense-Independent ERA', isRatio: true },
      { key: 'FIP', label: 'FIP', description: 'Fielding Independent Pitching', isRatio: true },
      { key: 'xFIP', label: 'xFIP', description: 'Expected FIP', isRatio: true },
      { key: 'SIERA', label: 'SIERA', description: 'Skill-Interactive ERA', isRatio: true },
      { key: 'OBPA', label: 'OBP Against', description: 'On-base % against', isRatio: true },
      { key: 'OPSA', label: 'OPS Against', description: 'OPS against', isRatio: true },
      { key: 'SLG_against', label: 'SLG Against', description: 'Slugging against', isRatio: true },
      { key: 'K/BF', label: 'K/BF', description: 'Strikeouts per batter faced', isRatio: true },
      { key: 'K/BF%', label: 'K/BF %', description: 'K/BF as percentage', isRatio: true },
      { key: 'K/IP', label: 'K/IP', description: 'Strikeouts per inning', isRatio: true },
      { key: 'K-BB', label: 'K - BB', description: 'Strikeouts minus walks' },
      { key: 'K/W', label: 'K/W', description: 'Strikeouts per walk', isRatio: true },
      { key: 'BB%', label: 'Walk %', description: 'Walk percentage', isRatio: true, isNegative: true },
      { key: 'K%', label: 'Strikeout %', description: 'Strikeout percentage', isRatio: true },
      { key: 'BR/9', label: 'BR/9', description: 'Baserunners per 9 IP', isRatio: true, isNegative: true },
      { key: 'T+B/IP', label: '(TB + BB) / IP', description: 'Bases allowed per IP', isRatio: true, isNegative: true },
      { key: 'IP/GS', label: 'IP/GS', description: 'Innings per start', isRatio: true },
      { key: 'P/IP', label: 'P/IP', description: 'Pitches per inning', isRatio: true },
      { key: 'P/GS', label: 'P/GS', description: 'Pitches per start', isRatio: true },
    ]
  },
  {
    name: 'Batted Ball & LOB',
    options: [
      { key: 'LOB_pct', label: 'LOB %', description: 'Left on base percentage', isRatio: true },
      { key: 'GB_pct', label: 'Ground Ball %', description: 'Ground ball rate', isRatio: true },
      { key: 'FB_pct', label: 'Fly Ball %', description: 'Fly ball rate', isRatio: true },
      { key: 'LD_pct', label: 'Line Drive %', description: 'Line drive rate', isRatio: true },
      { key: 'HR_FB', label: 'HR/FB', description: 'Home runs per fly ball', isRatio: true, isNegative: true },
    ]
  },
  {
    name: 'Win/Loss Splits',
    options: [
      { key: 'SW', label: 'Starter Wins (SW)', description: 'Wins by starters' },
      { key: 'SL', label: 'Starter Losses (SL)', description: 'Losses by starters', isNegative: true },
      { key: 'RW', label: 'Relief Wins (RW)', description: 'Wins by relievers' },
      { key: 'RL', label: 'Relief Losses (RL)', description: 'Losses by relievers', isNegative: true },
      { key: 'RA', label: 'Relief Appearances (RA)', description: 'Games in relief' },
      { key: 'CGL', label: 'Complete Game Losses (CGL)', description: 'CG with loss', isNegative: true },
    ]
  },
  {
    name: 'Allowed Counting Stats',
    options: [
      { key: '1BA', label: 'Singles Allowed (1BA)', description: 'Singles given up', isNegative: true },
      { key: '2BA', label: 'Doubles Allowed (2BA)', description: 'Doubles given up', isNegative: true },
      { key: '3BA', label: 'Triples Allowed (3BA)', description: 'Triples given up', isNegative: true },
      { key: 'TBA', label: 'Total Bases Allowed (TBA)', description: 'Total bases given up', isNegative: true },
      { key: 'XBHA', label: 'XBH Allowed (XBHA)', description: 'Extra base hits allowed', isNegative: true },
      { key: 'XB_allowed', label: 'Extra Bases Allowed', description: 'Extra bases allowed', isNegative: true },
      { key: 'EBN_allowed', label: 'EBN Allowed', description: 'Extra base numbers allowed', isNegative: true },
      { key: 'BRA', label: 'Baserunners Allowed (BRA)', description: 'BB + H + HB', isNegative: true },
      { key: 'BLL', label: 'Balls Pitched (BLL)', description: 'Balls thrown', isNegative: true },
      { key: 'IBB_allowed', label: 'IBB Allowed', description: 'Intentional walks', isNegative: true },
      { key: 'SF_allowed', label: 'SF Allowed', description: 'Sac flies allowed', isNegative: true },
      { key: 'UER', label: 'Unearned Runs (UER)', description: 'Unearned runs allowed', isNegative: true },
    ]
  },
  {
    name: 'Inherited Runners & GIDP',
    options: [
      { key: 'IR', label: 'Inherited Runners (IR)', description: 'Runners inherited' },
      { key: 'IRS', label: 'Inherited Runners Stranded (IRS)', description: 'IR stranded' },
      { key: 'DPI', label: 'Double Plays Induced (DPI)', description: 'Double plays from pitching' },
      { key: 'GIDP_pitcher', label: 'GIDP Against', description: 'GIDP induced' },
    ]
  },
  {
    name: 'Base Running Against',
    options: [
      { key: 'SBA', label: 'Stolen Bases Against (SBA)', description: 'SB allowed', isNegative: true },
      { key: 'CSA', label: 'Caught Stealing Against (CSA)', description: 'CS by catcher/pitcher' },
      { key: 'CSA%', label: 'CS Against %', description: 'CS / (SBA + CS)', isRatio: true },
      { key: 'PKO', label: 'Pickoffs (PKO)', description: 'Baserunners picked off' },
    ]
  },
  {
    name: 'Pitches & Games',
    options: [
      { key: 'PIT', label: 'Pitches (PIT)', description: 'Total pitches thrown' },
      { key: 'PG', label: 'Perfect Games (PG)', description: 'No baserunners allowed' },
    ]
  },
  {
    name: 'ERA Points & Formulas',
    options: [
      { key: 'ERAP', label: 'ERA Points (ERAP)', description: 'ERA-based points' },
      { key: 'ERAP2', label: 'ERA Points 2', description: 'Alt ERA points' },
      { key: 'PP', label: 'Pitcher Points (PP)', description: 'Pitcher points formula' },
      { key: 'PP2', label: 'Pitcher Points 2', description: 'Alt pitcher points' },
      { key: 'PP3', label: 'Pitcher Points 3', description: 'Alt pitcher points' },
      { key: 'PP4', label: 'Pitcher Points 4', description: 'Alt pitcher points' },
      { key: 'PP5', label: 'Pitcher Points 5', description: 'Alt pitcher points' },
    ]
  },
  {
    name: 'Save/Hold Percentages',
    options: [
      { key: 'SVC', label: 'Save Conversion (SVC)', description: 'SV / SVO', isRatio: true },
      { key: 'BSV', label: 'Blown Save %', description: 'BS / SVO', isRatio: true, isNegative: true },
      { key: 'HLD_pct', label: 'Hold %', description: 'Hold percentage', isRatio: true },
      { key: 'BQS', label: 'Blown Quality Starts', description: 'Failed QS', isNegative: true },
      { key: 'BQR', label: 'Blown Quality Relief', description: 'Failed relief', isNegative: true },
      { key: 'TQB', label: 'Tough Quality Batters', description: 'Tough batters faced' },
    ]
  },
  {
    name: 'Fielding (Pitching)',
    options: [
      { key: 'A', label: 'Assists (A)', description: 'Pitcher assists' },
      { key: 'E', label: 'Errors (E)', description: 'Pitcher errors', isNegative: true },
      { key: 'FLD%', label: 'Fielding % (FLD%)', description: 'Pitcher fielding %', isRatio: true },
    ]
  }
];

// Legacy flat arrays for backward compatibility
export const hittingCategoryOptions = hittingCategorySections.flatMap(s => s.options);
export const pitchingCategoryOptions = pitchingCategorySections.flatMap(s => s.options);

// Organized hitting point options by section
export const hittingPointSections: PointSection[] = [
  {
    name: 'Core Stats',
    options: [
      { key: 'H', label: 'Hits (H)', defaultValue: 1 },
      { key: '1B', label: 'Singles (1B)', defaultValue: 1 },
      { key: '2B', label: 'Doubles (2B)', defaultValue: 2 },
      { key: '3B', label: 'Triples (3B)', defaultValue: 3 },
      { key: 'HR', label: 'Home Runs (HR)', defaultValue: 4 },
      { key: 'RBI', label: 'RBI', defaultValue: 1 },
      { key: 'R', label: 'Runs Scored (R)', defaultValue: 1 },
      { key: 'BB', label: 'Walks (BB)', defaultValue: 1 },
      { key: 'SB', label: 'Stolen Bases (SB)', defaultValue: 2 },
    ]
  },
  {
    name: 'Negative Stats',
    options: [
      { key: 'K_hitter', label: 'Strikeouts (K)', defaultValue: -1 },
      { key: 'CS', label: 'Caught Stealing (CS)', defaultValue: -1 },
      { key: 'GIDP', label: 'Double Plays (GIDP)', defaultValue: -1 },
      { key: 'SO_look', label: 'Strikeouts Looking (SOL)', defaultValue: 0 },
      { key: 'E_hitter', label: 'Errors (E)', defaultValue: -1 },
    ]
  },
  {
    name: 'Additional Counting',
    options: [
      { key: 'TB', label: 'Total Bases (TB)', defaultValue: 0 },
      { key: 'XBH', label: 'Extra Base Hits (XBH)', defaultValue: 0 },
      { key: 'HBP', label: 'Hit By Pitch (HBP)', defaultValue: 1 },
      { key: 'SF', label: 'Sacrifice Flies (SF)', defaultValue: 0 },
      { key: 'SH', label: 'Sacrifice Hits (SH)', defaultValue: 0 },
      { key: 'IBB', label: 'Intentional Walks (IBB)', defaultValue: 0 },
      { key: 'SBN', label: 'Net Stolen Bases (SBN)', defaultValue: 0 },
      { key: 'GP_hitter', label: 'Games Played (GP)', defaultValue: 0 },
      { key: 'PA', label: 'Plate Appearances (PA)', defaultValue: 0 },
      { key: 'AB', label: 'At Bats (AB)', defaultValue: 0 },
    ]
  },
  {
    name: 'Rare Events',
    options: [
      { key: 'Sl', label: 'Grand Slams (Sl)', defaultValue: 5 },
      { key: 'CYC', label: 'Hit For The Cycle (CYC)', defaultValue: 10 },
      { key: 'GWRBI', label: 'Game Winning RBI (GWRBI)', defaultValue: 0 },
    ]
  },
  {
    name: 'Fielding',
    options: [
      { key: 'A', label: 'Assists (A)', defaultValue: 0 },
      { key: 'PO', label: 'Putouts (PO)', defaultValue: 0 },
      { key: 'DP', label: 'Double Plays (DP)', defaultValue: 0 },
      { key: 'TP', label: 'Triple Plays (TP)', defaultValue: 0 },
      { key: 'PB', label: 'Passed Balls (PB)', defaultValue: 0 },
      { key: 'CSA_hitter', label: 'Caught Stealing Against (CSA)', defaultValue: 0 },
      { key: 'SBA_hitter', label: 'Stolen Bases Against (SBA)', defaultValue: 0 },
      { key: 'PKO_field', label: 'Pickoffs (PKO)', defaultValue: 0 },
      { key: 'PKO_hitting', label: 'Picked Off (PKO)', defaultValue: 0, description: 'Negative stat' },
      { key: 'IF_hitter', label: 'Innings Fielded (IF)', defaultValue: 0 },
      { key: 'AOF', label: 'Assists by OF (AOF)', defaultValue: 0 },
      { key: 'POOF', label: 'Putouts by OF (POOF)', defaultValue: 0 },
    ]
  },
  {
    name: 'Advanced Hitting',
    options: [
      { key: 'FB', label: 'Fly Balls (FB)', defaultValue: 0 },
      { key: 'GB', label: 'Ground Balls (GB)', defaultValue: 0 },
      { key: 'CI', label: 'Catcher Interference (CI)', defaultValue: 0 },
      { key: 'MHG', label: 'Multi-Hit Games (MHG)', defaultValue: 0 },
      { key: 'MHRG', label: 'Multi-HR Games (MHRG)', defaultValue: 0 },
      { key: 'QAB', label: 'Quality At Bats (QAB)', defaultValue: 0 },
      { key: 'LOB', label: 'Runners LOB (LOB)', defaultValue: 0, description: 'Negative stat' },
      { key: 'OUT', label: 'Outs Made (OUT)', defaultValue: 0, description: 'Negative stat' },
    ]
  }
];

// Organized pitching point options by section
export const pitchingPointSections: PointSection[] = [
  {
    name: 'Core Stats',
    options: [
      { key: 'IP', label: 'Innings Pitched (IP)', defaultValue: 3 },
      { key: 'W', label: 'Wins (W)', defaultValue: 5 },
      { key: 'K_pitcher', label: 'Strikeouts (K)', defaultValue: 1 },
      { key: 'SV', label: 'Saves (SV)', defaultValue: 5 },
      { key: 'QS', label: 'Quality Starts (QS)', defaultValue: 3 },
    ]
  },
  {
    name: 'Negative Stats',
    options: [
      { key: 'L', label: 'Losses (L)', defaultValue: -3 },
      { key: 'ER', label: 'Earned Runs (ER)', defaultValue: -2 },
      { key: 'H_allowed', label: 'Hits Allowed (H)', defaultValue: -1 },
      { key: 'BB_allowed', label: 'Walks Allowed (BB)', defaultValue: -1 },
      { key: 'HR_allowed', label: 'Home Runs Allowed (HR)', defaultValue: -2 },
      { key: 'R_allowed', label: 'Runs Allowed (R)', defaultValue: 0 },
      { key: 'BS', label: 'Blown Saves (BS)', defaultValue: -3 },
      { key: 'HB', label: 'Hit Batsmen (HB)', defaultValue: 0 },
      { key: 'WP', label: 'Wild Pitches (WP)', defaultValue: 0 },
      { key: 'BK', label: 'Balks (BK)', defaultValue: 0 },
    ]
  },
  {
    name: 'Saves & Holds',
    options: [
      { key: 'HD', label: 'Holds (HLD)', defaultValue: 3 },
      { key: 'SVH', label: 'Saves + Holds (SVH)', defaultValue: 0 },
      { key: 'SVH2', label: 'Saves + Holds 2', defaultValue: 0, description: 'SV + 0.5×HLD' },
      { key: 'SVH3', label: 'Saves + Holds 3', defaultValue: 0, description: '0.5×SV + HLD' },
      { key: 'SVH4', label: 'Saves + Holds 4', defaultValue: 0, description: 'SV + 0.75×HLD' },
      { key: 'SVH5', label: 'Saves + Holds 5', defaultValue: 0, description: '0.75×SV + HLD' },
      { key: 'SVH6', label: 'Saves + Holds 6', defaultValue: 0, description: 'SV + 0.25×HLD' },
      { key: 'SVH7', label: 'Saves + Holds 7', defaultValue: 0, description: '0.25×SV + HLD' },
      { key: 'SVO', label: 'Save Opportunities (SVO)', defaultValue: 0 },
    ]
  },
  {
    name: 'Net Saves',
    options: [
      { key: 'NS', label: 'Net Saves (NS)', defaultValue: 0, description: 'SV - BS' },
      { key: 'NS2', label: 'Net Saves 2 (NS2)', defaultValue: 0, description: 'SV - 0.5×BS' },
      { key: 'NS3', label: 'Net Saves 3 (NS3)', defaultValue: 0, description: 'SV - BS + HLD' },
      { key: 'NS4', label: 'Net Saves 4 (NS4)', defaultValue: 0, description: 'SV + HLD - BS' },
      { key: 'NSH', label: 'Net SVH (NSH)', defaultValue: 0, description: '(SV + HLD) - BS' },
      { key: 'NSH2', label: 'Net SVH 2 (NSH2)', defaultValue: 0, description: 'Alt net saves + holds' },
    ]
  },
  {
    name: 'Additional Counting',
    options: [
      { key: 'CG', label: 'Complete Games (CG)', defaultValue: 5 },
      { key: 'SHO', label: 'Shutouts (SHO)', defaultValue: 10 },
      { key: 'NH', label: 'No Hitters (NH)', defaultValue: 15 },
      { key: 'PG', label: 'Perfect Games (PG)', defaultValue: 25 },
      { key: 'GS', label: 'Games Started (GS)', defaultValue: 0 },
      { key: 'GF', label: 'Games Finished (GF)', defaultValue: 0 },
      { key: 'GP_pitcher', label: 'Games Played (GP)', defaultValue: 0 },
      { key: 'BF', label: 'Batters Faced (BF)', defaultValue: 0 },
      { key: 'PIT', label: 'Pitches (PIT)', defaultValue: 0 },
      { key: 'W+QS', label: 'Wins + QS (W+QS)', defaultValue: 0 },
    ]
  },
  {
    name: 'Win/Loss Splits',
    options: [
      { key: 'SW', label: 'Starter Wins (SW)', defaultValue: 0 },
      { key: 'SL', label: 'Starter Losses (SL)', defaultValue: 0 },
      { key: 'RW', label: 'Relief Wins (RW)', defaultValue: 0 },
      { key: 'RL', label: 'Relief Losses (RL)', defaultValue: 0 },
      { key: 'RA', label: 'Relief Appearances (RA)', defaultValue: 0 },
    ]
  },
  {
    name: 'Allowed Stats',
    options: [
      { key: '1B_allowed', label: 'Singles Allowed (1B)', defaultValue: 0 },
      { key: '2B_allowed', label: 'Doubles Allowed (2B)', defaultValue: 0 },
      { key: '3B_allowed', label: 'Triples Allowed (3B)', defaultValue: 0 },
      { key: 'TB_allowed', label: 'Total Bases Allowed (TB)', defaultValue: 0 },
      { key: 'IBB_allowed', label: 'Int. Walks Allowed (IBB)', defaultValue: 0 },
    ]
  },
  {
    name: 'Base Running Against',
    options: [
      { key: 'SBA_pitcher', label: 'Stolen Bases Against (SBA)', defaultValue: 0 },
      { key: 'CSA_pitcher', label: 'Caught Stealing Against (CSA)', defaultValue: 0 },
      { key: 'PKO_pitcher', label: 'Pickoffs (PKO)', defaultValue: 0 },
      { key: 'IR', label: 'Inherited Runners (IR)', defaultValue: 0 },
      { key: 'IRS', label: 'Inherited Runners Stranded (IRS)', defaultValue: 0 },
      { key: 'GIDP_pitcher', label: 'GIDP Against (GIDP)', defaultValue: 0 },
    ]
  },
  {
    name: 'Advanced',
    options: [
      { key: 'CGL', label: 'Complete Game Losses (CGL)', defaultValue: 0 },
      { key: 'DPI', label: 'Double Plays Induced (DPI)', defaultValue: 0 },
      { key: 'UER', label: 'Unearned Runs (UER)', defaultValue: 0, description: 'Negative stat' },
      { key: 'SF_allowed', label: 'Sac Flies Allowed (SF)', defaultValue: 0, description: 'Negative stat' },
      { key: 'BRA', label: 'Baserunners Allowed (BRA)', defaultValue: 0, description: 'Negative stat' },
      { key: 'BLL', label: 'Balls Pitched (BLL)', defaultValue: 0, description: 'Negative stat' },
      { key: 'XB_allowed', label: 'Extra Bases Allowed (XB)', defaultValue: 0, description: 'Negative stat' },
    ]
  }
];

// Legacy flat arrays for backward compatibility
export const hittingPointOptions = hittingPointSections.flatMap(s => s.options);
export const pitchingPointOptions = pitchingPointSections.flatMap(s => s.options);

/**
 * Value Calculator Service
 * Calculates auction dollar values based on league settings and projections
 *
 * Key principle: Only players in the draftable pool get auction values.
 * Players outside the pool = $0 until they appear on the auction block.
 */

import type {
  NormalizedProjection,
  PlayerWithValue,
  CalculatedValuesResult,
  HittingStats,
  PitchingStats,
  DynastyRanking,
  PlayerWithDynastyValue,
} from '../types/projections.js';
import type { LeagueSettings } from '../../src/lib/types.js';
import { matchDynastyRankingsToProjections } from './dynastyRankingsScraper.js';
import { logger } from './logger.js';

// Default hitter/pitcher budget split
const DEFAULT_HITTER_SPLIT = 0.68;
const DEFAULT_PITCHER_SPLIT = 0.32;

// Minimum auction value for players in the pool
const MIN_AUCTION_VALUE = 1;

/**
 * Maximum number of players to return from projections.
 * This limits the player pool to prevent MiLB prospects from being matched.
 * Steamer projections include ~2000+ players, but we only want the top ones.
 * 1200 is roughly aligned with JA Projections player count.
 */
const MAX_PROJECTION_PLAYERS = 1200;

// ============================================================================
// MARKET INFLATION CORRECTION FACTORS
// Based on historical auction analysis from Duke Draft (Room 1362) and others
// ============================================================================

/**
 * Market inflation correction factors by tier
 * Based on historical auction data showing:
 * - Elite players (Tier 1-2) sell for LESS than projected (budget constraints)
 * - Replacement-level players (Tier 7-10) sell for MUCH MORE than projected
 *
 * Positive values = market pays MORE than projections
 * Negative values = market pays LESS than projections
 */
const DEFAULT_MARKET_INFLATION_FACTORS: Record<number, number> = {
  1: -0.15,    // Tier 1: Elite players sell for ~15% LESS than projected
  2: -0.05,    // Tier 2: Top players sell for ~5% less
  3: 0.15,     // Tier 3: Quality players sell for ~15% MORE
  4: 0.35,     // Tier 4: Mid-tier sell for ~35% MORE
  5: 0.50,     // Tier 5: Value picks sell for ~50% MORE
  6: 0.75,     // Tier 6: Late-round sell for ~75% MORE
  7: 1.00,     // Tier 7: Replacement level - double projected
  8: 1.50,     // Tier 8: Deep bench - 2.5x projected
  9: 2.00,     // Tier 9: Filler - 3x projected
  10: 3.00,    // Tier 10: Extreme filler - 4x projected
};

/**
 * Position scarcity factors based on historical market data
 * Positions with shallow talent pools command premiums
 *
 * Historical inflation by position:
 * - RP: +975% (very scarce, critical for roster construction)
 * - SP: +870% (high demand, limited elite options)
 * - C: +268% (shallow pool, only ~5-6 quality catchers)
 * - 2B: +154% (middle ground)
 * - 3B: +128%
 * - OF: +84% (deep position)
 * - 1B: +84% (deep position)
 * - SS: +76%
 * - DH: +69%
 */
const DEFAULT_POSITION_SCARCITY_FACTORS: Record<string, number> = {
  'C': 0.20,      // Catchers: +20% due to very shallow pool
  'SS': 0.08,     // Shortstop: +8% premium
  '2B': 0.05,     // Second base: slight premium
  '3B': -0.02,    // Third base: deeper position
  '1B': -0.05,    // First base: deepest position
  'OF': -0.03,    // Outfield: lots of options
  'DH': -0.05,    // DH: utility slot, deep
  'SP': 0.12,     // Starting pitchers: +12% premium
  'RP': 0.25,     // Relief pitchers: +25% (very scarce!)
  'P': 0.08,      // Generic pitcher slot: moderate premium
  'CI': -0.03,    // Corner infield: flexible, less premium
  'MI': 0.05,     // Middle infield: slight premium
  'UTIL': -0.05,  // Utility: very flexible, no premium
};

// ============================================================================
// CATEGORY VALIDATION AND DATA SOURCE CLASSIFICATION
// ============================================================================

/**
 * Data source types for scoring categories
 * - 'direct': Comes directly from projection data (most accurate)
 * - 'calculated': Derived from projection data via formula (accurate)
 * - 'estimated': Estimated using correlations/proxies (less accurate)
 * - 'unsupported': No reliable data or estimation available
 */
export type CategoryDataSource = 'direct' | 'calculated' | 'estimated' | 'unsupported';

export interface CategoryValidation {
  category: string;
  dataSource: CategoryDataSource;
  description: string;
  accuracy: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Hitting categories and their data sources
 */
const HITTING_CATEGORY_SOURCES: Record<string, { source: CategoryDataSource; desc: string }> = {
  // Direct from projections (high accuracy)
  'R': { source: 'direct', desc: 'Runs - from projections' },
  'HR': { source: 'direct', desc: 'Home Runs - from projections' },
  'RBI': { source: 'direct', desc: 'RBI - from projections' },
  'SB': { source: 'direct', desc: 'Stolen Bases - from projections' },
  'H': { source: 'direct', desc: 'Hits - from projections' },
  'AVG': { source: 'direct', desc: 'Batting Average - from projections' },
  'OBP': { source: 'direct', desc: 'On-Base % - from projections' },
  'SLG': { source: 'direct', desc: 'Slugging % - from projections' },
  'OPS': { source: 'direct', desc: 'OPS - from projections' },
  'BB': { source: 'direct', desc: 'Walks - from projections' },
  '1B': { source: 'direct', desc: 'Singles - from projections' },
  '2B': { source: 'direct', desc: 'Doubles - from projections' },
  '3B': { source: 'direct', desc: 'Triples - from projections' },
  'CS': { source: 'direct', desc: 'Caught Stealing - from projections' },
  'SO': { source: 'direct', desc: 'Strikeouts - from projections' },
  'K': { source: 'direct', desc: 'Strikeouts - from projections' },
  'GP': { source: 'direct', desc: 'Games Played - from projections' },
  'PA': { source: 'direct', desc: 'Plate Appearances - from projections' },
  'AB': { source: 'direct', desc: 'At Bats - from projections' },
  'WOBA': { source: 'direct', desc: 'wOBA - from projections' },

  // Calculated from projections (high accuracy)
  'XBH': { source: 'calculated', desc: 'Extra Base Hits = 2B + 3B + HR' },
  'TB': { source: 'calculated', desc: 'Total Bases = 1B + 2×2B + 3×3B + 4×HR' },
  'SBN': { source: 'calculated', desc: 'Net Stolen Bases = SB - CS' },
  'ISO': { source: 'calculated', desc: 'Isolated Power = SLG - AVG' },
  'R+RBI': { source: 'calculated', desc: 'Runs + RBI' },
  'R+SB': { source: 'calculated', desc: 'Runs + Stolen Bases' },
  'HR+SB': { source: 'calculated', desc: 'Home Runs + Stolen Bases' },
  'H+R+RBI': { source: 'calculated', desc: 'Hits + Runs + RBI' },
  'HBB': { source: 'calculated', desc: 'Hits + Walks' },
  'TB+RBI': { source: 'calculated', desc: 'Total Bases + RBI' },
  'TB+BB': { source: 'calculated', desc: 'Total Bases + Walks' },
  'TB-HR': { source: 'calculated', desc: 'Total Bases - Home Runs' },
  'TSB': { source: 'calculated', desc: 'Total Bases + Stolen Bases' },
  'RP': { source: 'calculated', desc: 'Runs Produced = RBI + R - HR' },
  'RP2': { source: 'calculated', desc: 'Runs Produced = RBI + R' },
  'SP': { source: 'calculated', desc: 'Scoring Production = R + RBI - HR' },
  '2B+3B': { source: 'calculated', desc: 'Doubles + Triples' },
  'XB': { source: 'calculated', desc: 'Extra Bases = 2B + 2×3B + 3×HR' },
  '1B+2B+3B': { source: 'calculated', desc: 'Non-HR Hits' },
  'SBN2': { source: 'calculated', desc: 'Net SB = SB - 0.5×CS' },
  'BB+R': { source: 'calculated', desc: 'Walks + Runs' },
  'BB+SB': { source: 'calculated', desc: 'Walks + Stolen Bases' },
  '1B+BB': { source: 'calculated', desc: 'Singles + Walks' },
  'K%': { source: 'calculated', desc: 'Strikeout Rate = K / PA' },
  'BB/PA': { source: 'calculated', desc: 'Walk Rate = BB / PA' },
  'BB/K': { source: 'calculated', desc: 'Walk to Strikeout Ratio' },
  'HR/PA': { source: 'calculated', desc: 'Home Run Rate' },
  'SB%': { source: 'calculated', desc: 'Stolen Base Success Rate' },

  // Estimated from correlations (medium accuracy)
  'HBP': { source: 'estimated', desc: 'Hit By Pitch - estimated from walk rate' },
  'SF': { source: 'estimated', desc: 'Sacrifice Flies - estimated from RBI/HR' },
  'GIDP': { source: 'estimated', desc: 'Double Plays - estimated from K rate, speed, batted ball' },
  'BABIP': { source: 'estimated', desc: 'BABIP - estimated from hits and balls in play' },
  'HBBHBP': { source: 'estimated', desc: 'H + BB + HBP (HBP estimated)' },
  'T+B+H': { source: 'estimated', desc: 'TB + BB + HBP (HBP estimated)' },
  'TB2': { source: 'estimated', desc: 'Total Bases variant (includes estimated HBP)' },
  'KDP': { source: 'estimated', desc: 'K + 2×GIDP (GIDP estimated)' },
  'KDP2': { source: 'estimated', desc: 'K + GIDP (GIDP estimated)' },
  'BB+HBP': { source: 'estimated', desc: 'BB + HBP (HBP estimated)' },
  'BBHS': { source: 'estimated', desc: 'BB + HBP + SB (HBP estimated)' },

  // Unsupported (no reliable estimation)
  'A': { source: 'unsupported', desc: 'Fielding Assists - position-dependent, not projected' },
  'E': { source: 'unsupported', desc: 'Errors - position-dependent, not projected' },
  'FLD%': { source: 'unsupported', desc: 'Fielding % - not projected' },
  'PO': { source: 'unsupported', desc: 'Putouts - position-dependent, not projected' },
  'DP': { source: 'unsupported', desc: 'Fielding Double Plays - not projected' },
  'TP': { source: 'unsupported', desc: 'Triple Plays - extremely rare, not projected' },
  'PB': { source: 'unsupported', desc: 'Passed Balls - catcher only, not projected' },
  'CYC': { source: 'unsupported', desc: 'Hit for Cycle - too rare to estimate' },
  'Sl': { source: 'unsupported', desc: 'Grand Slams - too rare to estimate' },
  'NH': { source: 'unsupported', desc: 'No Hitters - pitcher stat, too rare' },
  'PG': { source: 'unsupported', desc: 'Perfect Games - too rare to estimate' },
  'FB': { source: 'unsupported', desc: 'Fly Balls - batted ball data not in projections' },
  'GB': { source: 'unsupported', desc: 'Ground Balls - batted ball data not in projections' },
  'LOB': { source: 'unsupported', desc: 'Left on Base - situational, not projected' },
  'GWRBI': { source: 'unsupported', desc: 'Game Winning RBI - situational, not projected' },
};

/**
 * Pitching categories and their data sources
 */
const PITCHING_CATEGORY_SOURCES: Record<string, { source: CategoryDataSource; desc: string }> = {
  // Direct from projections (high accuracy)
  'W': { source: 'direct', desc: 'Wins - from projections' },
  'K': { source: 'direct', desc: 'Strikeouts - from projections' },
  'ERA': { source: 'direct', desc: 'ERA - from projections' },
  'WHIP': { source: 'direct', desc: 'WHIP - from projections' },
  'SV': { source: 'direct', desc: 'Saves - from projections' },
  'HLD': { source: 'direct', desc: 'Holds - from projections' },
  'HD': { source: 'direct', desc: 'Holds - from projections' },
  'IP': { source: 'direct', desc: 'Innings Pitched - from projections' },
  'L': { source: 'direct', desc: 'Losses - from projections' },
  'GS': { source: 'direct', desc: 'Games Started - from projections' },
  'GP': { source: 'direct', desc: 'Games Played - from projections' },
  'ER': { source: 'direct', desc: 'Earned Runs - from projections' },
  'HA': { source: 'direct', desc: 'Hits Allowed - from projections' },
  'BBA': { source: 'direct', desc: 'Walks Allowed - from projections' },
  'HRA': { source: 'direct', desc: 'Home Runs Allowed - from projections' },
  'K/9': { source: 'direct', desc: 'K/9 - from projections' },
  'K9': { source: 'direct', desc: 'K/9 - from projections' },
  'BB/9': { source: 'direct', desc: 'BB/9 - from projections' },
  'BB9': { source: 'direct', desc: 'BB/9 - from projections' },
  'FIP': { source: 'direct', desc: 'FIP - from projections' },

  // Calculated from projections (high accuracy)
  'K/BB': { source: 'calculated', desc: 'K/BB Ratio' },
  'K_BB': { source: 'calculated', desc: 'K/BB Ratio' },
  'SVH': { source: 'calculated', desc: 'Saves + Holds' },
  'SV+HD': { source: 'calculated', desc: 'Saves + Holds' },
  'SVH2': { source: 'calculated', desc: 'SV + 0.5×HLD' },
  'SVH3': { source: 'calculated', desc: '0.5×SV + HLD' },
  'SVH4': { source: 'calculated', desc: 'SV + 0.75×HLD' },
  'SVH5': { source: 'calculated', desc: '0.75×SV + HLD' },
  'SVH6': { source: 'calculated', desc: 'SV + 0.25×HLD' },
  'SVH7': { source: 'calculated', desc: '0.25×SV + HLD' },
  'HR/9': { source: 'calculated', desc: 'Home Runs per 9 IP' },
  'HR9': { source: 'calculated', desc: 'Home Runs per 9 IP' },
  'H/IP': { source: 'calculated', desc: 'Hits per Inning' },
  'W%': { source: 'calculated', desc: 'Win Percentage = W / (W + L)' },
  'IP/GS': { source: 'calculated', desc: 'Innings per Start' },
  'K/IP': { source: 'calculated', desc: 'Strikeouts per Inning' },
  'K-BB': { source: 'calculated', desc: 'Strikeouts minus Walks' },
  'BR/9': { source: 'calculated', desc: 'Baserunners per 9 IP' },

  // Estimated (medium accuracy)
  'QS': { source: 'estimated', desc: 'Quality Starts - estimated from IP/GS and ERA' },
  'W+QS': { source: 'estimated', desc: 'Wins + Quality Starts (QS estimated)' },
  'BS': { source: 'estimated', desc: 'Blown Saves - estimated from saves and ERA' },
  'NS': { source: 'estimated', desc: 'Net Saves = SV - BS (BS estimated)' },
  'NS2': { source: 'estimated', desc: 'Net Saves variant (BS estimated)' },
  'NS3': { source: 'estimated', desc: 'Net Saves + Holds (BS estimated)' },
  'NS4': { source: 'estimated', desc: 'Net Saves variant (BS estimated)' },
  'NSH': { source: 'estimated', desc: 'Net Saves + Holds (BS estimated)' },
  'CG': { source: 'estimated', desc: 'Complete Games - estimated from IP/GS and ERA' },
  'SHO': { source: 'estimated', desc: 'Shutouts - estimated from CG and ERA' },
  'GF': { source: 'estimated', desc: 'Games Finished - estimated from saves/holds' },
  'R_allowed': { source: 'estimated', desc: 'Runs Allowed - estimated as ER × 1.12' },
  'HB': { source: 'estimated', desc: 'Hit Batsmen - estimated from BB/9' },
  'WP': { source: 'estimated', desc: 'Wild Pitches - estimated from BB/9' },
  'BAA': { source: 'estimated', desc: 'Batting Avg Against - estimated from WHIP' },
  'BF': { source: 'estimated', desc: 'Batters Faced - estimated from IP, H, BB' },
  'K/BF': { source: 'estimated', desc: 'K/BF Rate (BF estimated)' },
  'BB%': { source: 'estimated', desc: 'Walk % (BF estimated)' },
  'K%': { source: 'estimated', desc: 'Strikeout % (BF estimated)' },
  '1BA': { source: 'estimated', desc: 'Singles Allowed - estimated from hits' },
  '2BA': { source: 'estimated', desc: 'Doubles Allowed - estimated as 20% of hits' },
  '3BA': { source: 'estimated', desc: 'Triples Allowed - estimated as 3% of hits' },
  'TBA': { source: 'estimated', desc: 'Total Bases Allowed - estimated from hit breakdown' },
  'XBHA': { source: 'estimated', desc: 'Extra Base Hits Allowed - estimated' },
  'BRA': { source: 'estimated', desc: 'Baserunners Allowed - H + BB + HB (HB estimated)' },
  'SBA': { source: 'estimated', desc: 'Stolen Bases Against - estimated from IP' },
  'CSA': { source: 'estimated', desc: 'Caught Stealing Against - estimated' },
  'PKO': { source: 'estimated', desc: 'Pickoffs - estimated from IP and role' },
  'DPI': { source: 'estimated', desc: 'Double Plays Induced - estimated from IP' },
  'GIDP_pitcher': { source: 'estimated', desc: 'GIDP Induced - estimated from IP' },
  'IR': { source: 'estimated', desc: 'Inherited Runners - estimated from relief apps' },
  'IRS': { source: 'estimated', desc: 'Inherited Runners Stranded - estimated' },
  'T+B/IP': { source: 'estimated', desc: '(TB + BB) / IP - TB estimated' },

  // Unsupported
  'NH': { source: 'unsupported', desc: 'No Hitters - too rare to estimate' },
  'PG': { source: 'unsupported', desc: 'Perfect Games - too rare to estimate' },
  'BK': { source: 'unsupported', desc: 'Balks - not projected' },
  'PIT': { source: 'unsupported', desc: 'Pitches - not in projections' },
  'xFIP': { source: 'unsupported', desc: 'xFIP - not in Steamer projections' },
  'SIERA': { source: 'unsupported', desc: 'SIERA - not in Steamer projections' },
};

/**
 * Validate scoring categories and return information about data sources
 */
export function validateScoringCategories(settings: LeagueSettings): {
  hitting: CategoryValidation[];
  pitching: CategoryValidation[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const hittingValidations: CategoryValidation[] = [];
  const pitchingValidations: CategoryValidation[] = [];

  // Validate hitting categories
  const enabledHitting = Object.entries(settings.hittingCategories || {})
    .filter(([_, enabled]) => enabled)
    .map(([cat]) => cat);

  for (const cat of enabledHitting) {
    const info = HITTING_CATEGORY_SOURCES[cat];
    if (!info) {
      hittingValidations.push({
        category: cat,
        dataSource: 'unsupported',
        description: `Unknown category - will be ignored`,
        accuracy: 'none',
      });
      warnings.push(`Hitting category "${cat}" is not supported and will be ignored in calculations`);
    } else {
      const accuracy = info.source === 'direct' ? 'high' :
        info.source === 'calculated' ? 'high' :
          info.source === 'estimated' ? 'medium' : 'none';

      hittingValidations.push({
        category: cat,
        dataSource: info.source,
        description: info.desc,
        accuracy,
      });

      if (info.source === 'estimated') {
        warnings.push(`Hitting category "${cat}" uses estimated values: ${info.desc}`);
      } else if (info.source === 'unsupported') {
        warnings.push(`Hitting category "${cat}" is not supported: ${info.desc}`);
      }
    }
  }

  // Validate pitching categories
  const enabledPitching = Object.entries(settings.pitchingCategories || {})
    .filter(([_, enabled]) => enabled)
    .map(([cat]) => cat);

  for (const cat of enabledPitching) {
    const info = PITCHING_CATEGORY_SOURCES[cat];
    if (!info) {
      pitchingValidations.push({
        category: cat,
        dataSource: 'unsupported',
        description: `Unknown category - will be ignored`,
        accuracy: 'none',
      });
      warnings.push(`Pitching category "${cat}" is not supported and will be ignored in calculations`);
    } else {
      const accuracy = info.source === 'direct' ? 'high' :
        info.source === 'calculated' ? 'high' :
          info.source === 'estimated' ? 'medium' : 'none';

      pitchingValidations.push({
        category: cat,
        dataSource: info.source,
        description: info.desc,
        accuracy,
      });

      if (info.source === 'estimated') {
        warnings.push(`Pitching category "${cat}" uses estimated values: ${info.desc}`);
      } else if (info.source === 'unsupported') {
        warnings.push(`Pitching category "${cat}" is not supported: ${info.desc}`);
      }
    }
  }

  return {
    hitting: hittingValidations,
    pitching: pitchingValidations,
    warnings,
  };
}

/**
 * Get a summary of category support for display to users
 */
export function getCategorySupportSummary(settings: LeagueSettings): {
  supported: number;
  estimated: number;
  unsupported: number;
  details: string;
} {
  const validation = validateScoringCategories(settings);

  const allCategories = [...validation.hitting, ...validation.pitching];
  const supported = allCategories.filter(c => c.dataSource === 'direct' || c.dataSource === 'calculated').length;
  const estimated = allCategories.filter(c => c.dataSource === 'estimated').length;
  const unsupported = allCategories.filter(c => c.dataSource === 'unsupported').length;

  let details = '';
  if (estimated > 0) {
    details += `${estimated} categor${estimated === 1 ? 'y uses' : 'ies use'} estimated values. `;
  }
  if (unsupported > 0) {
    details += `${unsupported} categor${unsupported === 1 ? 'y is' : 'ies are'} not supported.`;
  }
  if (estimated === 0 && unsupported === 0) {
    details = 'All categories use direct projection data.';
  }

  return { supported, estimated, unsupported, details };
}

/**
 * Main entry point for calculating auction values
 * Supports both redraft (single season) and dynasty (multi-year) leagues
 */
export function calculateAuctionValues(
  projections: NormalizedProjection[],
  settings: LeagueSettings,
  dynastyRankings?: DynastyRanking[]
): CalculatedValuesResult {
  // Calculate total roster spots and budget
  const totalRosterSpots = calculateTotalRosterSpots(settings);
  const totalBudget = settings.numTeams * settings.budgetPerTeam;
  const draftablePoolSize = settings.numTeams * totalRosterSpots;

  // Get budget split (use settings or defaults)
  const hitterSplit = settings.hitterPitcherSplit?.hitter ?? DEFAULT_HITTER_SPLIT;
  const pitcherSplit = settings.hitterPitcherSplit?.pitcher ?? DEFAULT_PITCHER_SPLIT;

  // Calculate hitter and pitcher roster needs
  const { hitterSpots, pitcherSpots } = calculatePositionNeeds(settings);
  const hitterPoolSize = settings.numTeams * hitterSpots;
  const pitcherPoolSize = settings.numTeams * pitcherSpots;

  const hitterBudget = Math.round(totalBudget * hitterSplit);
  const pitcherBudget = totalBudget - hitterBudget;

  // Separate hitters and pitchers
  const hitters = projections.filter(p => p.playerType === 'hitter');
  const pitchers = projections.filter(p => p.playerType === 'pitcher');

  // Calculate values based on scoring type
  let playersWithValues: PlayerWithValue[];

  switch (settings.scoringType) {
    case 'rotisserie':
    case 'h2h-categories':
      playersWithValues = calculateCategoryValues(
        hitters,
        pitchers,
        settings,
        hitterPoolSize,
        pitcherPoolSize,
        hitterBudget,
        pitcherBudget
      );
      break;
    case 'h2h-points':
      playersWithValues = calculatePointsValues(
        hitters,
        pitchers,
        settings,
        hitterPoolSize,
        pitcherPoolSize,
        hitterBudget,
        pitcherBudget
      );
      break;
    default:
      throw new Error(`Unknown scoring type: ${settings.scoringType}`);
  }

  // Apply dynasty adjustments if in dynasty mode with rankings
  if (settings.leagueType === 'dynasty' && dynastyRankings && dynastyRankings.length > 0) {
    logger.info({ rankingsCount: dynastyRankings.length }, 'Applying dynasty adjustments');
    playersWithValues = applyDynastyAdjustments(
      playersWithValues,
      dynastyRankings,
      settings,
      hitterPoolSize,
      pitcherPoolSize,
      hitterBudget,
      pitcherBudget
    );
  }

  // CRITICAL: Limit players to top N by SGP (Z-Score) to prevent MiLB prospect confusion
  // Steamer projections include 2000+ players, but only the top ~1200 are relevant
  //
  // IMPORTANT: Sort by SGP (Z-Score), NOT auction value!
  // Many marginal players have $1 auction value, but their SGP scores differ significantly.
  // MiLB prospects typically have lower SGP than MLB players with the same name.
  // By sorting by SGP, we ensure we keep the BEST 1200 players, not just any 1200.
  //
  // For H2H Points leagues that use pointsValue instead of sgpValue, fall back to auction value
  const sortedPlayers = [...playersWithValues].sort((a, b) => {
    // Primary sort: by SGP (Z-Score) or points value
    const aValue = a.sgpValue ?? a.pointsValue ?? a.auctionValue;
    const bValue = b.sgpValue ?? b.pointsValue ?? b.auctionValue;
    return bValue - aValue;
  });
  const topPlayers = sortedPlayers.slice(0, MAX_PROJECTION_PLAYERS);

  logger.info({
    totalProjections: playersWithValues.length,
    returnedPlayers: topPlayers.length,
    maxAllowed: MAX_PROJECTION_PLAYERS,
    lowestSgpReturned: topPlayers[topPlayers.length - 1]?.sgpValue ?? topPlayers[topPlayers.length - 1]?.pointsValue ?? 0,
    lowestValueReturned: topPlayers[topPlayers.length - 1]?.auctionValue ?? 0,
  }, 'Filtered projections to top players by SGP/Z-Score');

  return {
    projectionSystem: settings.projectionSystem,
    calculatedAt: new Date().toISOString(),
    leagueSummary: {
      numTeams: settings.numTeams,
      budgetPerTeam: settings.budgetPerTeam,
      totalBudget,
      scoringType: settings.scoringType,
      draftablePoolSize,
      hitterPoolSize,
      pitcherPoolSize,
      hitterBudget,
      pitcherBudget,
      leagueType: settings.leagueType,
      dynastyWeight: settings.dynastySettings?.dynastyWeight,
    },
    players: topPlayers,
  };
}

/**
 * Calculate values for Rotisserie and H2H Categories leagues using SGP
 */
function calculateCategoryValues(
  hitters: NormalizedProjection[],
  pitchers: NormalizedProjection[],
  settings: LeagueSettings,
  hitterPoolSize: number,
  pitcherPoolSize: number,
  hitterBudget: number,
  pitcherBudget: number
): PlayerWithValue[] {
  const enabledHittingCats = getEnabledHittingCategories(settings);
  const enabledPitchingCats = getEnabledPitchingCategories(settings);

  // Calculate SGP for all hitters
  const hitterSGPs = calculateHitterSGPs(hitters, enabledHittingCats, hitterPoolSize);

  // Calculate SGP for all pitchers
  const pitcherSGPs = calculatePitcherSGPs(pitchers, enabledPitchingCats, pitcherPoolSize);

  // Sort by SGP and take top N for each pool
  const sortedHitters = [...hitterSGPs].sort((a, b) => b.sgp - a.sgp);
  const sortedPitchers = [...pitcherSGPs].sort((a, b) => b.sgp - a.sgp);

  // Calculate total SGP for players IN the pool
  const poolHitters = sortedHitters.slice(0, hitterPoolSize);
  const poolPitchers = sortedPitchers.slice(0, pitcherPoolSize);

  const totalHitterSGP = poolHitters.reduce((sum, h) => sum + Math.max(0, h.sgp), 0);
  const totalPitcherSGP = poolPitchers.reduce((sum, p) => sum + Math.max(0, p.sgp), 0);

  // Convert SGP to dollar values with market-aware adjustments
  const hitterResults = convertSGPToDollarsMarketAdjusted(
    sortedHitters,
    hitterPoolSize,
    hitterBudget,
    totalHitterSGP,
    settings
  );

  const pitcherResults = convertSGPToDollarsMarketAdjusted(
    sortedPitchers,
    pitcherPoolSize,
    pitcherBudget,
    totalPitcherSGP,
    settings
  );

  return [...hitterResults, ...pitcherResults];
}

/**
 * Calculate values for H2H Points leagues
 */
function calculatePointsValues(
  hitters: NormalizedProjection[],
  pitchers: NormalizedProjection[],
  settings: LeagueSettings,
  hitterPoolSize: number,
  pitcherPoolSize: number,
  hitterBudget: number,
  pitcherBudget: number
): PlayerWithValue[] {
  const pointSettings = settings.pointsSettings || {};

  // Calculate total points for each hitter (filter out any without hitting stats)
  const hitterPoints = hitters
    .filter(h => h.hitting)
    .map(h => ({
      player: h,
      points: calculateHitterPoints(h.hitting!, pointSettings),
    }));

  // Calculate total points for each pitcher (filter out any without pitching stats)
  const pitcherPoints = pitchers
    .filter(p => p.pitching)
    .map(p => ({
      player: p,
      points: calculatePitcherPoints(p.pitching!, pointSettings),
    }));

  // Sort by points
  const sortedHitters = [...hitterPoints].sort((a, b) => b.points - a.points);
  const sortedPitchers = [...pitcherPoints].sort((a, b) => b.points - a.points);

  // Get pool and calculate total points
  const poolHitters = sortedHitters.slice(0, hitterPoolSize);
  const poolPitchers = sortedPitchers.slice(0, pitcherPoolSize);

  const totalHitterPoints = poolHitters.reduce((sum, h) => sum + Math.max(0, h.points), 0);
  const totalPitcherPoints = poolPitchers.reduce((sum, p) => sum + Math.max(0, p.points), 0);

  // Convert points to dollars with market-aware adjustments
  const hitterResults = convertPointsToDollarsMarketAdjusted(
    sortedHitters,
    hitterPoolSize,
    hitterBudget,
    totalHitterPoints,
    settings
  );

  const pitcherResults = convertPointsToDollarsMarketAdjusted(
    sortedPitchers,
    pitcherPoolSize,
    pitcherBudget,
    totalPitcherPoints,
    settings
  );

  return [...hitterResults, ...pitcherResults];
}

/**
 * Calculate SGP values for hitters
 */
function calculateHitterSGPs(
  hitters: NormalizedProjection[],
  enabledCategories: string[],
  poolSize: number
): Array<{ player: NormalizedProjection; sgp: number; categoryBreakdown: Record<string, number> }> {
  if (hitters.length === 0) return [];

  // Get stats for replacement-level calculation (top N players)
  const topHitters = [...hitters]
    .filter(h => h.hitting)
    .sort((a, b) => (b.hitting?.war || 0) - (a.hitting?.war || 0))
    .slice(0, poolSize);

  // Calculate averages and standard deviations for each category
  const categoryStats = calculateCategoryStats(topHitters, enabledCategories, 'hitting');

  // Calculate SGP for each hitter
  return hitters.map(hitter => {
    const breakdown: Record<string, number> = {};
    let totalSGP = 0;

    if (hitter.hitting) {
      for (const cat of enabledCategories) {
        const stats = categoryStats[cat];
        if (stats && stats.stdDev > 0) {
          const value = getHittingStat(hitter.hitting, cat);
          const sgp = (value - stats.avg) / stats.stdDev;
          breakdown[cat] = sgp;
          // Invert for negative categories (K for hitters is bad)
          totalSGP += cat === 'K' ? -sgp : sgp;
        }
      }
    }

    return {
      player: hitter,
      sgp: totalSGP,
      categoryBreakdown: breakdown,
    };
  });
}

/**
 * Calculate SGP values for pitchers
 */
function calculatePitcherSGPs(
  pitchers: NormalizedProjection[],
  enabledCategories: string[],
  poolSize: number
): Array<{ player: NormalizedProjection; sgp: number; categoryBreakdown: Record<string, number> }> {
  if (pitchers.length === 0) return [];

  // Get stats for replacement-level calculation
  const topPitchers = [...pitchers]
    .filter(p => p.pitching)
    .sort((a, b) => (b.pitching?.war || 0) - (a.pitching?.war || 0))
    .slice(0, poolSize);

  // Calculate averages and standard deviations
  const categoryStats = calculateCategoryStats(topPitchers, enabledCategories, 'pitching');

  return pitchers.map(pitcher => {
    const breakdown: Record<string, number> = {};
    let totalSGP = 0;

    if (pitcher.pitching) {
      for (const cat of enabledCategories) {
        const stats = categoryStats[cat];
        if (stats && stats.stdDev > 0) {
          const value = getPitchingStat(pitcher.pitching, cat);
          const sgp = (value - stats.avg) / stats.stdDev;
          breakdown[cat] = sgp;
          // Invert for negative categories (ERA, WHIP - lower is better)
          const isNegativeCat = ['ERA', 'WHIP', 'BB/9'].includes(cat);
          totalSGP += isNegativeCat ? -sgp : sgp;
        }
      }
    }

    return {
      player: pitcher,
      sgp: totalSGP,
      categoryBreakdown: breakdown,
    };
  });
}

/**
 * Calculate category statistics (avg, stddev) for a group of players
 */
function calculateCategoryStats(
  players: NormalizedProjection[],
  categories: string[],
  type: 'hitting' | 'pitching'
): Record<string, { avg: number; stdDev: number }> {
  const stats: Record<string, { avg: number; stdDev: number }> = {};

  for (const cat of categories) {
    const values = players
      .map(p => {
        if (type === 'hitting' && p.hitting) {
          return getHittingStat(p.hitting, cat);
        } else if (type === 'pitching' && p.pitching) {
          return getPitchingStat(p.pitching, cat);
        }
        return 0;
      })
      .filter(v => v !== 0);

    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      // Use sample variance (Bessel's correction: N-1) instead of population variance (N)
      // This provides an unbiased estimate of variance for sample data
      const variance = values.length > 1
        ? values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1)
        : 0;
      const stdDev = Math.sqrt(variance);

      stats[cat] = { avg, stdDev: stdDev || 1 }; // Avoid division by zero
    }
  }

  return stats;
}

/**
 * Get a hitting stat value by category code
 * Supports all categories from ScoringConfig with estimation for missing data
 */
function getHittingStat(stats: HittingStats, category: string): number {
  switch (category) {
    // Core Stats
    case 'R': return stats.runs;
    case 'HR': return stats.homeRuns;
    case 'RBI': return stats.rbi;
    case 'SB': return stats.stolenBases;
    case 'H': return stats.hits;

    // Rate Stats
    case 'AVG': return stats.battingAvg;
    case 'OBP': return stats.onBasePct;
    case 'SLG': return stats.sluggingPct;
    case 'OPS': return stats.ops;

    // Additional Counting
    case 'XBH': return stats.doubles + stats.triples + stats.homeRuns;
    case 'TB': return calculateTotalBases(stats);
    case 'BB': return stats.walks;
    case '1B': return stats.singles;
    case '2B': return stats.doubles;
    case '3B': return stats.triples;

    // Advanced / Less Common
    case 'SBN': return stats.stolenBases - stats.caughtStealing;
    case 'CS': return stats.caughtStealing;
    case 'SO':
    case 'K': return stats.strikeouts;
    case 'GIDP': return estimateGIDP(stats);
    case 'HBP': return estimateHBP(stats);
    case 'SF': return estimateSF(stats);
    case 'GP': return stats.games;
    case 'PA': return stats.plateAppearances;
    case 'AB': return stats.atBats;

    // Advanced Rate Stats
    case 'WOBA': return stats.wOBA;
    case 'ISO': return stats.sluggingPct - stats.battingAvg;
    case 'BABIP': return estimateBABIP(stats);
    case 'K%': return stats.plateAppearances > 0 ? stats.strikeouts / stats.plateAppearances : 0;
    case 'BB/PA': return stats.plateAppearances > 0 ? stats.walks / stats.plateAppearances : 0;
    case 'BB/K': return stats.strikeouts > 0 ? stats.walks / stats.strikeouts : 0;
    case 'HR/PA': return stats.plateAppearances > 0 ? stats.homeRuns / stats.plateAppearances : 0;
    case 'SB%': return (stats.stolenBases + stats.caughtStealing) > 0
      ? stats.stolenBases / (stats.stolenBases + stats.caughtStealing) : 0;

    // Composite Counting Stats
    case 'R+RBI': return stats.runs + stats.rbi;
    case 'R+SB': return stats.runs + stats.stolenBases;
    case 'HR+SB': return stats.homeRuns + stats.stolenBases;
    case 'H+R+RBI': return stats.hits + stats.runs + stats.rbi;
    case 'HBB': return stats.hits + stats.walks;
    case 'HBBHBP': return stats.hits + stats.walks + estimateHBP(stats);
    case 'TB+RBI': return calculateTotalBases(stats) + stats.rbi;
    case 'TB+BB': return calculateTotalBases(stats) + stats.walks;
    case 'T+B+H': return calculateTotalBases(stats) + stats.walks + estimateHBP(stats);
    case 'TB-HR': return calculateTotalBases(stats) - stats.homeRuns;
    case 'TSB': return calculateTotalBases(stats) + stats.stolenBases;
    case 'RP': return stats.rbi + stats.runs - stats.homeRuns;
    case 'RP2': return stats.rbi + stats.runs;
    case 'SP': return stats.runs + stats.rbi - stats.homeRuns;

    // Doubles & Triples combinations
    case '2B+3B': return stats.doubles + stats.triples;
    case '2B+3B2': return stats.doubles + (2 * stats.triples);
    case '3BSB': return stats.triples + stats.stolenBases;
    case '3B2SB': return (2 * stats.triples) + stats.stolenBases;
    case 'HR2B': return (2 * stats.homeRuns) + stats.doubles;
    case 'XB': return stats.doubles + (2 * stats.triples) + (3 * stats.homeRuns);
    case '1B+2B+3B': return stats.singles + stats.doubles + stats.triples;

    // Net stolen base variants
    case 'SBN2': return stats.stolenBases - (0.5 * stats.caughtStealing);
    case 'SBN3': return stats.stolenBases - stats.caughtStealing; // PKO not available
    case 'NSB': return stats.stolenBases + (0.5 * stats.doubles) + (2 * stats.triples) - stats.caughtStealing;

    // Strikeout & GIDP combinations
    case 'KDP': return stats.strikeouts + (2 * estimateGIDP(stats));
    case 'KDP2': return stats.strikeouts + estimateGIDP(stats);

    // Walks & HBP combinations
    case 'BB+HBP': return stats.walks + estimateHBP(stats);
    case 'BB+R': return stats.walks + stats.runs;
    case 'BB+SB': return stats.walks + stats.stolenBases;
    case 'BBHS': return stats.walks + estimateHBP(stats) + stats.stolenBases;
    case '1B+BB': return stats.singles + stats.walks;

    // Total Bases variants (estimate components we don't have)
    case 'TB2': return stats.singles + (2 * stats.doubles) + (3 * stats.triples) + stats.walks + estimateHBP(stats);
    case 'MTB': return calculateTotalBases(stats) + stats.stolenBases - (0.5 * stats.caughtStealing);

    default: return 0;
  }
}

/**
 * Calculate Total Bases: 1B + 2×2B + 3×3B + 4×HR
 */
function calculateTotalBases(stats: HittingStats): number {
  return stats.singles + (2 * stats.doubles) + (3 * stats.triples) + (4 * stats.homeRuns);
}

/**
 * Estimate Hit By Pitch (HBP) based on plate discipline metrics
 *
 * Statistical basis:
 * - League average HBP rate: ~0.8% of PA
 * - HBP correlates with walk rate (r ≈ 0.35) - patient hitters crowd plate
 * - High contact hitters (low K) tend to get hit more (in the zone longer)
 */
function estimateHBP(stats: HittingStats): number {
  if (stats.plateAppearances === 0) return 0;

  const bbRate = stats.walks / stats.plateAppearances;
  const leagueAvgBBRate = 0.085; // ~8.5% league average

  // Base HBP rate: 0.8% of PA (league average)
  let hbpRate = 0.008;

  // Adjust for walk rate - every 1% above league avg BB rate → +0.1% HBP rate
  hbpRate += (bbRate - leagueAvgBBRate) * 0.10;

  // Floor at 0.3% (some players almost never get hit)
  hbpRate = Math.max(0.003, hbpRate);
  // Cap at 2% (extreme outliers like Rizzo/Dietrich)
  hbpRate = Math.min(0.020, hbpRate);

  return Math.round(stats.plateAppearances * hbpRate);
}

/**
 * Estimate Sacrifice Flies (SF) based on RBI production
 *
 * Statistical basis:
 * - SF correlates strongly with RBI (r ≈ 0.65)
 * - SF rate is approximately 4-5% of non-HR RBI
 * - Fly ball hitters (high HR rate) get more SF opportunities
 */
function estimateSF(stats: HittingStats): number {
  if (stats.atBats === 0) return 0;

  // Non-HR RBI represent situations where SF could occur
  const nonHrRbi = Math.max(0, stats.rbi - stats.homeRuns);

  // Base SF rate: ~4.5% of non-HR RBI
  let sfRate = 0.045;

  // Adjust for fly ball tendency using HR rate as proxy
  const hrRate = stats.homeRuns / stats.atBats;
  const leagueAvgHRRate = 0.033; // ~3.3% league average

  if (hrRate > leagueAvgHRRate) {
    // High HR rate → more fly balls → more SF opportunities
    sfRate *= (1 + (hrRate - leagueAvgHRRate) * 8);
  }

  // Cap rate at 8% (extreme fly ball hitters)
  sfRate = Math.min(0.08, sfRate);

  return Math.round(nonHrRbi * sfRate);
}

/**
 * Estimate Grounded Into Double Play (GIDP) based on contact and speed
 *
 * Statistical basis:
 * - GIDP correlates negatively with K rate (r ≈ -0.55): fewer Ks → more contact → more GIDP chances
 * - GIDP correlates negatively with SB (r ≈ -0.42): speed → beat out DP
 * - Ground ball hitters (high 2B/HR ratio) hit into more DP
 * - League average GIDP rate: ~1.2% of PA for contact hitters
 */
function estimateGIDP(stats: HittingStats): number {
  if (stats.plateAppearances === 0) return 0;

  const kRate = stats.strikeouts / stats.plateAppearances;
  const sbRate = stats.games > 0 ? stats.stolenBases / stats.games : 0;
  const doublesHrRatio = stats.homeRuns > 0 ? stats.doubles / stats.homeRuns : 2.0;

  // Base GIDP rate: 1.2% of PA (league average for contact hitters)
  let gidpRate = 0.012;

  const leagueAvgKRate = 0.23; // ~23% league average

  // Adjust for contact rate (inverse of K rate)
  if (kRate < leagueAvgKRate) {
    // Low K → more contact → more GIDP opportunities
    gidpRate *= (1 + (leagueAvgKRate - kRate) * 2);
  } else {
    // High K → fewer balls in play → fewer GIDP
    gidpRate *= (1 - (kRate - leagueAvgKRate) * 1.5);
  }

  // Adjust for speed (high SB → low GIDP)
  if (sbRate > 0.15) { // 15+ SB per 100 games = fast
    gidpRate *= 0.70; // Fast runners -30%
  } else if (sbRate < 0.05) { // < 5 SB per 100 games = slow
    gidpRate *= 1.30; // Slow runners +30%
  }

  // Adjust for ground ball tendency (high 2B/HR suggests ground ball hitter)
  if (doublesHrRatio > 2.5) {
    gidpRate *= 1.15; // Ground ball hitters +15%
  } else if (doublesHrRatio < 1.0) {
    gidpRate *= 0.85; // Fly ball hitters -15%
  }

  // Floor and cap
  gidpRate = Math.max(0.003, gidpRate); // Minimum 0.3%
  gidpRate = Math.min(0.025, gidpRate); // Maximum 2.5%

  return Math.round(stats.plateAppearances * gidpRate);
}

/**
 * Estimate BABIP (Batting Average on Balls In Play)
 * BABIP = (H - HR) / (AB - K - HR + SF)
 *
 * When we don't have SF, we estimate it
 */
function estimateBABIP(stats: HittingStats): number {
  const sf = estimateSF(stats);
  const denominator = stats.atBats - stats.strikeouts - stats.homeRuns + sf;

  if (denominator <= 0) return 0.300; // League average fallback

  return (stats.hits - stats.homeRuns) / denominator;
}

/**
 * Estimates Quality Starts from IP, ERA, and GS
 * QS = 6+ IP with 3 or fewer ER
 *
 * Uses historical QS/GS ratios based on ERA and average IP per start:
 * - Elite starters (6.5+ IP/start, ERA <= 3.50): ~75% QS rate
 * - Good starters (6.0+ IP/start, ERA <= 4.00): ~65% QS rate
 * - Average starters (5.5+ IP/start, ERA <= 4.50): ~50% QS rate
 * - Below average (5.0+ IP/start): ~35% QS rate
 * - Poor starters: ~20% QS rate
 */
function estimateQualityStarts(stats: PitchingStats): number {
  if (stats.gamesStarted === 0) return 0;

  const avgIPperStart = stats.inningsPitched / stats.gamesStarted;

  let qsRate = 0;

  if (avgIPperStart >= 6.5 && stats.era <= 3.50) {
    qsRate = 0.75; // Elite starters
  } else if (avgIPperStart >= 6.0 && stats.era <= 4.00) {
    qsRate = 0.65; // Good starters
  } else if (avgIPperStart >= 5.5 && stats.era <= 4.50) {
    qsRate = 0.50; // Average starters
  } else if (avgIPperStart >= 5.0) {
    qsRate = 0.35; // Below average starters
  } else {
    qsRate = 0.20; // Poor starters / spot starters
  }

  return Math.round(stats.gamesStarted * qsRate);
}

/**
 * Get a pitching stat value by category code
 * Supports all categories from ScoringConfig with estimation for missing data
 */
function getPitchingStat(stats: PitchingStats, category: string): number {
  switch (category) {
    // Core Stats
    case 'W': return stats.wins;
    case 'K': return stats.strikeouts;
    case 'ERA': return stats.era;
    case 'WHIP': return stats.whip;
    case 'SV': return stats.saves;
    case 'QS': return estimateQualityStarts(stats);

    // Rate Stats
    case 'K_BB':
    case 'K/BB': return stats.walks > 0 ? stats.strikeouts / stats.walks : 0;
    case 'K9':
    case 'K/9': return stats.k9;
    case 'BB9':
    case 'BB/9': return stats.bb9;
    case 'HR9':
    case 'HR/9': return stats.inningsPitched > 0 ? (stats.homeRunsAllowed * 9) / stats.inningsPitched : 0;
    case 'H/IP': return stats.inningsPitched > 0 ? stats.hitsAllowed / stats.inningsPitched : 0;
    case 'FIP': return stats.fip;
    case 'BAA': return estimateBAAFromWHIP(stats);
    case 'W%': return (stats.wins + stats.losses) > 0 ? stats.wins / (stats.wins + stats.losses) : 0;
    case 'IP/GS': return stats.gamesStarted > 0 ? stats.inningsPitched / stats.gamesStarted : 0;

    // Saves & Holds
    case 'SVH':
    case 'SV+HD': return stats.saves + stats.holds;
    case 'SVH2': return stats.saves + (0.5 * stats.holds);
    case 'SVH3': return (0.5 * stats.saves) + stats.holds;
    case 'SVH4': return stats.saves + (0.75 * stats.holds);
    case 'SVH5': return (0.75 * stats.saves) + stats.holds;
    case 'SVH6': return stats.saves + (0.25 * stats.holds);
    case 'SVH7': return (0.25 * stats.saves) + stats.holds;
    case 'HLD':
    case 'HD': return stats.holds;

    // Net Saves (BS estimated)
    case 'NS': return stats.saves - estimateBlownSaves(stats);
    case 'NS2': return stats.saves - (0.5 * estimateBlownSaves(stats));
    case 'NS3': return stats.saves - estimateBlownSaves(stats) + stats.holds;
    case 'NS4': return stats.saves + stats.holds - estimateBlownSaves(stats);
    case 'NSH': return (stats.saves + stats.holds) - estimateBlownSaves(stats);
    case 'BS': return estimateBlownSaves(stats);

    // Additional Counting
    case 'IP': return stats.inningsPitched;
    case 'L': return stats.losses;
    case 'CG': return estimateCompleteGames(stats);
    case 'SHO': return estimateShutouts(stats);
    case 'W+QS': return stats.wins + estimateQualityStarts(stats);
    case 'GS': return stats.gamesStarted;
    case 'GF': return estimateGamesFinished(stats);
    case 'GP': return stats.games;

    // Negative Stats
    case 'ER': return stats.earnedRuns;
    case 'HA': return stats.hitsAllowed;
    case 'BBA': return stats.walks;
    case 'HRA': return stats.homeRunsAllowed;
    case 'R_allowed': return estimateRunsAllowed(stats);
    case 'HB': return estimateHitBatsmen(stats);
    case 'WP': return estimateWildPitches(stats);

    // Advanced Rate Stats
    case 'K/BF': return estimateBattersFaced(stats) > 0 ? stats.strikeouts / estimateBattersFaced(stats) : 0;
    case 'K/IP': return stats.inningsPitched > 0 ? stats.strikeouts / stats.inningsPitched : 0;
    case 'K-BB': return stats.strikeouts - stats.walks;
    case 'K/W': return stats.walks > 0 ? stats.strikeouts / stats.walks : 0;
    case 'BB%': return estimateBattersFaced(stats) > 0 ? stats.walks / estimateBattersFaced(stats) : 0;
    case 'K%': return estimateBattersFaced(stats) > 0 ? stats.strikeouts / estimateBattersFaced(stats) : 0;
    case 'BR/9': return stats.inningsPitched > 0
      ? ((stats.hitsAllowed + stats.walks) * 9) / stats.inningsPitched : 0;
    case 'T+B/IP': return stats.inningsPitched > 0
      ? (estimateTotalBasesAllowed(stats) + stats.walks) / stats.inningsPitched : 0;

    // Allowed Stats
    case '1BA': return estimateSinglesAllowed(stats);
    case '2BA': return estimateDoublesAllowed(stats);
    case '3BA': return estimateTriplesAllowed(stats);
    case 'TBA': return estimateTotalBasesAllowed(stats);
    case 'XBHA': return estimateExtraBaseHitsAllowed(stats);
    case 'BRA': return stats.hitsAllowed + stats.walks + estimateHitBatsmen(stats);

    // Base Running Against
    case 'SBA': return estimateStolenBasesAllowed(stats);
    case 'CSA': return estimateCaughtStealingAgainst(stats);
    case 'PKO': return estimatePickoffs(stats);
    case 'DPI':
    case 'GIDP_pitcher': return estimateDoublePlaysPitcher(stats);

    // Inherited Runners (relievers only)
    case 'IR': return estimateInheritedRunners(stats);
    case 'IRS': return estimateInheritedRunnersStranded(stats);

    default: return 0;
  }
}

/**
 * Estimate Blown Saves based on saves and reliever profile
 * Historical BS rate is approximately 15% of save opportunities
 */
function estimateBlownSaves(stats: PitchingStats): number {
  if (stats.saves === 0) return 0;

  // Estimate save opportunities (saves + blown saves)
  // Elite closers convert ~90%, average ~85%
  const eraFactor = stats.era < 3.00 ? 0.10 : (stats.era < 4.00 ? 0.15 : 0.20);
  const estimatedSaveOpps = stats.saves / (1 - eraFactor);

  return Math.round(estimatedSaveOpps - stats.saves);
}

/**
 * Estimate Complete Games based on GS, IP/GS, and ERA
 * Modern pitchers rarely throw CG - elite starters might get 1-3 per year
 */
function estimateCompleteGames(stats: PitchingStats): number {
  if (stats.gamesStarted === 0) return 0;

  const avgIPperStart = stats.inningsPitched / stats.gamesStarted;

  // Base CG rate based on IP/start and ERA
  let cgRate = 0;

  if (avgIPperStart >= 7.0 && stats.era <= 2.50) {
    cgRate = 0.08; // Elite workload starters: ~8% of starts
  } else if (avgIPperStart >= 6.5 && stats.era <= 3.00) {
    cgRate = 0.04; // Good starters: ~4% of starts
  } else if (avgIPperStart >= 6.0 && stats.era <= 3.50) {
    cgRate = 0.02; // Average: ~2% of starts
  } else {
    cgRate = 0.01; // Below average: ~1% of starts
  }

  return Math.round(stats.gamesStarted * cgRate);
}

/**
 * Estimate Shutouts based on CG and ERA
 * Shutouts are a subset of complete games
 */
function estimateShutouts(stats: PitchingStats): number {
  const cg = estimateCompleteGames(stats);
  if (cg === 0) return 0;

  // ~30-50% of CG are shutouts for good pitchers
  const shutoutRate = stats.era <= 3.00 ? 0.50 : (stats.era <= 4.00 ? 0.35 : 0.20);
  return Math.round(cg * shutoutRate);
}

/**
 * Estimate Games Finished for relievers
 */
function estimateGamesFinished(stats: PitchingStats): number {
  // Games finished typically = saves + holds * factor + some non-save finishes
  const relieverApps = stats.games - stats.gamesStarted;
  if (relieverApps === 0) return 0;

  // Closers finish most games, setup men finish fewer
  if (stats.saves > 10) {
    return stats.saves + Math.round(stats.holds * 0.3) + Math.round(relieverApps * 0.1);
  }
  return Math.round(relieverApps * 0.4);
}

/**
 * Estimate total Runs Allowed (ER + unearned)
 * Unearned runs typically add 10-15% to earned runs
 */
function estimateRunsAllowed(stats: PitchingStats): number {
  return Math.round(stats.earnedRuns * 1.12);
}

/**
 * Estimate Hit Batsmen based on innings and wildness
 */
function estimateHitBatsmen(stats: PitchingStats): number {
  if (stats.inningsPitched === 0) return 0;

  // League average: ~0.4 HB per 9 IP
  // Wild pitchers (high BB/9) hit more batters
  let hbRate = 0.044; // per inning

  if (stats.bb9 > 4.0) {
    hbRate *= 1.3; // Wild pitchers +30%
  } else if (stats.bb9 < 2.0) {
    hbRate *= 0.8; // Control pitchers -20%
  }

  return Math.round(stats.inningsPitched * hbRate);
}

/**
 * Estimate Wild Pitches based on innings and control
 */
function estimateWildPitches(stats: PitchingStats): number {
  if (stats.inningsPitched === 0) return 0;

  // League average: ~0.35 WP per 9 IP
  let wpRate = 0.039; // per inning

  if (stats.bb9 > 4.0) {
    wpRate *= 1.5; // Wild pitchers +50%
  } else if (stats.bb9 < 2.0) {
    wpRate *= 0.7; // Control pitchers -30%
  }

  return Math.round(stats.inningsPitched * wpRate);
}

/**
 * Estimate Batters Faced from IP, H, BB
 * BF ≈ IP * 3 + H + BB + HBP
 */
function estimateBattersFaced(stats: PitchingStats): number {
  const hbp = estimateHitBatsmen(stats);
  return Math.round(stats.inningsPitched * 3 + stats.hitsAllowed + stats.walks + hbp);
}

/**
 * Estimate BAA (Batting Average Against) from WHIP and IP
 * BAA ≈ H / (IP * 3 - K) approximately
 */
function estimateBAAFromWHIP(stats: PitchingStats): number {
  const bf = estimateBattersFaced(stats);
  if (bf === 0) return 0.250;

  // Approximate: BAA = H / (BF - BB - HBP - K)
  const atBats = bf - stats.walks - estimateHitBatsmen(stats);
  if (atBats <= 0) return 0.250;

  return stats.hitsAllowed / atBats;
}

/**
 * Estimate Total Bases Allowed
 */
function estimateTotalBasesAllowed(stats: PitchingStats): number {
  // Estimate hit breakdown: ~60% singles, ~20% doubles, ~3% triples, ~17% HR
  const singles = estimateSinglesAllowed(stats);
  const doubles = estimateDoublesAllowed(stats);
  const triples = estimateTriplesAllowed(stats);

  return singles + (2 * doubles) + (3 * triples) + (4 * stats.homeRunsAllowed);
}

/**
 * Estimate Singles Allowed
 */
function estimateSinglesAllowed(stats: PitchingStats): number {
  // Singles ≈ H - XBH (where XBH ≈ 2B + 3B + HR)
  const xbh = estimateExtraBaseHitsAllowed(stats);
  return Math.max(0, stats.hitsAllowed - xbh);
}

/**
 * Estimate Doubles Allowed (~20% of hits)
 */
function estimateDoublesAllowed(stats: PitchingStats): number {
  return Math.round(stats.hitsAllowed * 0.20);
}

/**
 * Estimate Triples Allowed (~3% of hits)
 */
function estimateTriplesAllowed(stats: PitchingStats): number {
  return Math.round(stats.hitsAllowed * 0.03);
}

/**
 * Estimate Extra Base Hits Allowed (2B + 3B + HR)
 */
function estimateExtraBaseHitsAllowed(stats: PitchingStats): number {
  const doubles = estimateDoublesAllowed(stats);
  const triples = estimateTriplesAllowed(stats);
  return doubles + triples + stats.homeRunsAllowed;
}

/**
 * Estimate Stolen Bases Allowed based on IP (relievers face more SB attempts)
 */
function estimateStolenBasesAllowed(stats: PitchingStats): number {
  if (stats.inningsPitched === 0) return 0;

  // League average: ~0.7 SB per 9 IP
  const sbRate = 0.078; // per inning
  return Math.round(stats.inningsPitched * sbRate);
}

/**
 * Estimate Caught Stealing Against
 */
function estimateCaughtStealingAgainst(stats: PitchingStats): number {
  const sba = estimateStolenBasesAllowed(stats);
  // ~25% of attempts are caught
  return Math.round(sba * 0.33);
}

/**
 * Estimate Pickoffs
 */
function estimatePickoffs(stats: PitchingStats): number {
  if (stats.inningsPitched === 0) return 0;

  // League average: ~0.15 pickoffs per 9 IP for starters
  const pkoRate = stats.gamesStarted > 0 ? 0.017 : 0.008; // per inning
  return Math.round(stats.inningsPitched * pkoRate);
}

/**
 * Estimate Double Plays Induced by pitcher
 */
function estimateDoublePlaysPitcher(stats: PitchingStats): number {
  if (stats.inningsPitched === 0) return 0;

  // League average: ~0.8 GIDP per 9 IP
  const dpRate = 0.089; // per inning
  return Math.round(stats.inningsPitched * dpRate);
}

/**
 * Estimate Inherited Runners for relievers
 */
function estimateInheritedRunners(stats: PitchingStats): number {
  const relieverApps = stats.games - stats.gamesStarted;
  if (relieverApps === 0) return 0;

  // Middle relievers inherit ~0.5 runners per appearance on average
  const irRate = stats.holds > stats.saves ? 0.6 : 0.3;
  return Math.round(relieverApps * irRate);
}

/**
 * Estimate Inherited Runners Stranded
 */
function estimateInheritedRunnersStranded(stats: PitchingStats): number {
  const ir = estimateInheritedRunners(stats);
  if (ir === 0) return 0;

  // Good relievers strand ~70%, average ~65%
  const strandRate = stats.era < 3.50 ? 0.72 : 0.65;
  return Math.round(ir * strandRate);
}

// ============================================================================
// MARKET INFLATION CORRECTION HELPERS
// ============================================================================

/**
 * Get market inflation factor for a tier
 * Uses custom factors from settings if provided, otherwise defaults
 */
function getMarketInflationFactor(
  tier: number,
  customFactors?: Record<number, number>
): number {
  if (customFactors && tier in customFactors) {
    return customFactors[tier];
  }
  return DEFAULT_MARKET_INFLATION_FACTORS[tier] ?? 0;
}

/**
 * Get position scarcity factor for a position
 * Uses custom factors from settings if provided, otherwise defaults
 */
function getPositionScarcityFactor(
  positions: string[],
  customFactors?: Record<string, number>
): number {
  if (positions.length === 0) return 0;

  // Use primary position for scarcity adjustment
  const primaryPos = positions[0];
  const factors = customFactors ?? DEFAULT_POSITION_SCARCITY_FACTORS;

  return factors[primaryPos] ?? 0;
}

/**
 * Apply market inflation correction to redistribute dollars from elites to mid-tier
 * This corrects for the systematic bias where projections overvalue elites
 * and undervalue replacement-level players compared to real auction behavior
 */
function applyMarketInflationCorrection(
  playersWithBaseValues: Array<{
    player: NormalizedProjection;
    baseValue: number;
    tier: number;
    isInPool: boolean;
  }>,
  settings: LeagueSettings,
  totalBudget: number
): void {
  const customTierFactors = settings.inflationSettings?.tierFactors;
  const customPositionFactors = settings.inflationSettings?.positionFactors;
  const enablePositionScarcity = settings.inflationSettings?.enablePositionScarcity ?? true;

  const poolPlayers = playersWithBaseValues.filter(p => p.isInPool);

  // Phase 1: Calculate how much elites "release" and how much to redistribute
  let eliteRelease = 0;
  let nonEliteBaseTotal = 0;

  for (const p of poolPlayers) {
    const factor = getMarketInflationFactor(p.tier, customTierFactors);
    if (factor < 0) {
      // Elite tiers release dollars
      eliteRelease += p.baseValue * Math.abs(factor);
    } else {
      nonEliteBaseTotal += p.baseValue;
    }
  }

  // Phase 2: Apply tier-based adjustments
  for (const p of poolPlayers) {
    const tierFactor = getMarketInflationFactor(p.tier, customTierFactors);

    if (tierFactor < 0) {
      // Elite reduction
      p.baseValue = Math.round(p.baseValue * (1 + tierFactor));
    } else if (tierFactor > 0 && nonEliteBaseTotal > 0) {
      // Non-elite gets proportional share of released dollars + tier inflation
      const proportionalShare = (p.baseValue / nonEliteBaseTotal) * eliteRelease;
      const tierBonus = Math.min(proportionalShare, p.baseValue * tierFactor);
      p.baseValue = Math.round(p.baseValue + tierBonus);
    }

    // Apply position scarcity adjustment
    if (enablePositionScarcity) {
      const positionFactor = getPositionScarcityFactor(
        p.player.positions,
        customPositionFactors
      );
      if (positionFactor !== 0) {
        p.baseValue = Math.round(p.baseValue * (1 + positionFactor));
      }
    }

    // Ensure minimum value
    p.baseValue = Math.max(MIN_AUCTION_VALUE, p.baseValue);
  }

  // Phase 3: Re-normalize to exact budget
  const totalAllocated = poolPlayers.reduce((sum, p) => sum + p.baseValue, 0);
  const budgetDiff = totalBudget - totalAllocated;

  if (Math.abs(budgetDiff) > 0 && poolPlayers.length > 0) {
    // Distribute rounding errors proportionally, prioritizing mid-tier
    let remaining = budgetDiff;
    // Sort by tier (mid-tier first for adjustments)
    const sortedForAdjustment = [...poolPlayers].sort((a, b) => {
      // Prefer tiers 3-5 for adjustments
      const aPriority = Math.abs(a.tier - 4);
      const bPriority = Math.abs(b.tier - 4);
      return aPriority - bPriority;
    });

    for (const player of sortedForAdjustment) {
      if (remaining === 0) break;
      const adjustment = remaining > 0 ? 1 : -1;
      if (player.baseValue + adjustment >= MIN_AUCTION_VALUE) {
        player.baseValue += adjustment;
        remaining -= adjustment;
      }
    }

    // If still not balanced (edge case), apply to top player
    if (remaining !== 0) {
      const topPlayer = poolPlayers[0];
      if (topPlayer) {
        topPlayer.baseValue = Math.max(MIN_AUCTION_VALUE, topPlayer.baseValue + remaining);
      }
    }
  }
}

/**
 * Convert SGP values to dollar values with market-aware distribution
 * This enhanced version applies inflation corrections based on historical data
 */
function convertSGPToDollarsMarketAdjusted(
  players: Array<{ player: NormalizedProjection; sgp: number; categoryBreakdown?: Record<string, number> }>,
  poolSize: number,
  totalBudget: number,
  totalPoolSGP: number,
  settings: LeagueSettings
): PlayerWithValue[] {
  const enableMarketCorrection = settings.inflationSettings?.enableMarketCorrection ?? true;

  // Reserve $1 per player in pool
  const reservedDollars = poolSize * MIN_AUCTION_VALUE;
  const distributableDollars = totalBudget - reservedDollars;

  // Step 1: Calculate base values using SGP approach
  const playersWithBaseValues = players.map((p, index) => {
    const isInPool = index < poolSize;
    let baseValue = 0;

    if (isInPool && totalPoolSGP > 0 && p.sgp > 0) {
      const sgpShare = p.sgp / totalPoolSGP;
      baseValue = MIN_AUCTION_VALUE + Math.round(sgpShare * distributableDollars);
    } else if (isInPool) {
      baseValue = MIN_AUCTION_VALUE;
    }

    return {
      player: p.player,
      sgp: p.sgp,
      categoryBreakdown: p.categoryBreakdown,
      baseValue,
      tier: calculateTier(index, poolSize),
      isInPool,
    };
  });

  // Step 2: Apply market inflation correction if enabled
  if (enableMarketCorrection) {
    applyMarketInflationCorrection(playersWithBaseValues, settings, totalBudget);
  } else {
    // Legacy normalization for exact budget match
    const playersInPool = playersWithBaseValues.filter(p => p.isInPool);
    const totalAllocated = playersInPool.reduce((sum, p) => sum + p.baseValue, 0);

    if (totalAllocated !== totalBudget && playersInPool.length > 0) {
      const difference = totalBudget - totalAllocated;
      const topPlayer = playersInPool[0];
      if (topPlayer) {
        topPlayer.baseValue = Math.max(MIN_AUCTION_VALUE, topPlayer.baseValue + difference);
      }
    }
  }

  // Step 3: Convert to final PlayerWithValue format
  return playersWithBaseValues.map(p => ({
    ...p.player,
    auctionValue: p.baseValue,
    sgpValue: p.sgp,
    tier: p.tier,
    isInDraftPool: p.isInPool,
  }));
}

/**
 * Convert SGP values to dollar values (legacy version without market correction)
 * Includes budget normalization to ensure values sum exactly to total budget
 */
function convertSGPToDollars(
  players: Array<{ player: NormalizedProjection; sgp: number; categoryBreakdown?: Record<string, number> }>,
  poolSize: number,
  totalBudget: number,
  totalPoolSGP: number
): PlayerWithValue[] {
  // Reserve $1 per player in pool
  const reservedDollars = poolSize * MIN_AUCTION_VALUE;
  const distributableDollars = totalBudget - reservedDollars;

  const results = players.map((p, index) => {
    const isInPool = index < poolSize;
    let auctionValue = 0;

    if (isInPool && totalPoolSGP > 0 && p.sgp > 0) {
      // Distribute remaining dollars proportionally to SGP
      const sgpShare = p.sgp / totalPoolSGP;
      auctionValue = MIN_AUCTION_VALUE + Math.round(sgpShare * distributableDollars);
    } else if (isInPool) {
      // In pool but negative/zero SGP - gets minimum
      auctionValue = MIN_AUCTION_VALUE;
    }
    // Players outside pool get $0

    return {
      ...p.player,
      auctionValue,
      sgpValue: p.sgp,
      tier: calculateTier(index, poolSize),
      isInDraftPool: isInPool,
    };
  });

  // Normalize to ensure exact budget match (handles rounding errors)
  const playersInPool = results.filter(p => p.isInDraftPool);
  const totalAllocated = playersInPool.reduce((sum, p) => sum + p.auctionValue, 0);

  if (totalAllocated !== totalBudget && playersInPool.length > 0) {
    const difference = totalBudget - totalAllocated;
    // Apply adjustment to the top player (most value, smallest relative impact)
    const topPlayer = playersInPool[0];
    if (topPlayer) {
      topPlayer.auctionValue = Math.max(MIN_AUCTION_VALUE, topPlayer.auctionValue + difference);
    }
  }

  return results;
}

/**
 * Calculate total points for a hitter
 * Uses the expanded getHittingStat function for estimated stats
 */
function calculateHitterPoints(
  stats: HittingStats,
  pointSettings: NonNullable<LeagueSettings['pointsSettings']>
): number {
  let points = 0;

  // Core Stats - use direct stats or getHittingStat for estimated values
  // Singles (1B)
  if (pointSettings['1B'] !== undefined && pointSettings['1B'] !== 0) {
    points += stats.singles * pointSettings['1B'];
  } else if (pointSettings.H !== undefined && pointSettings.H !== 0) {
    // Legacy: H key uses singles value
    points += stats.singles * pointSettings.H;
  }

  points += stats.doubles * (pointSettings['2B'] ?? 0);
  points += stats.triples * (pointSettings['3B'] ?? 0);
  points += stats.homeRuns * (pointSettings.HR ?? 0);
  points += stats.rbi * (pointSettings.RBI ?? 0);
  points += stats.runs * (pointSettings.R ?? 0);
  points += stats.stolenBases * (pointSettings.SB ?? 0);
  points += stats.walks * (pointSettings.BB ?? 0);

  // Negative Stats
  points += stats.strikeouts * (pointSettings.K_hitter ?? 0);
  points += stats.caughtStealing * (pointSettings.CS ?? 0);
  points += estimateGIDP(stats) * (pointSettings.GIDP ?? 0);

  // Additional Counting with estimation
  points += calculateTotalBases(stats) * (pointSettings.TB ?? 0);
  points += (stats.doubles + stats.triples + stats.homeRuns) * (pointSettings.XBH ?? 0);
  points += estimateHBP(stats) * (pointSettings.HBP ?? 0);
  points += estimateSF(stats) * (pointSettings.SF ?? 0);
  points += (stats.stolenBases - stats.caughtStealing) * (pointSettings.SBN ?? 0);
  points += stats.games * (pointSettings.GP_hitter ?? 0);
  points += stats.plateAppearances * (pointSettings.PA ?? 0);
  points += stats.atBats * (pointSettings.AB ?? 0);

  // Rare Events (estimate as 0 - extremely rare)
  // Grand Slams, Cycles - no reliable estimation possible
  // These would need to come from actual game data

  return points;
}

/**
 * Calculate total points for a pitcher
 * Uses the expanded getPitchingStat function for estimated stats
 */
function calculatePitcherPoints(
  stats: PitchingStats,
  pointSettings: NonNullable<LeagueSettings['pointsSettings']>
): number {
  let points = 0;

  // Core Stats
  points += stats.inningsPitched * (pointSettings.IP ?? 0);
  points += stats.wins * (pointSettings.W ?? 0);
  points += stats.strikeouts * (pointSettings.K_pitcher ?? 0);
  points += stats.saves * (pointSettings.SV ?? 0);
  points += estimateQualityStarts(stats) * (pointSettings.QS ?? 0);

  // Negative Stats
  points += stats.losses * (pointSettings.L ?? 0);
  points += stats.earnedRuns * (pointSettings.ER ?? 0);
  points += stats.hitsAllowed * (pointSettings.H_allowed ?? 0);
  points += stats.walks * (pointSettings.BB_allowed ?? 0);
  points += stats.homeRunsAllowed * (pointSettings.HR_allowed ?? 0);
  points += estimateRunsAllowed(stats) * (pointSettings.R_allowed ?? 0);
  points += estimateBlownSaves(stats) * (pointSettings.BS ?? 0);
  points += estimateHitBatsmen(stats) * (pointSettings.HB ?? 0);
  points += estimateWildPitches(stats) * (pointSettings.WP ?? 0);

  // Saves & Holds
  points += stats.holds * (pointSettings.HD ?? 0);
  points += (stats.saves + stats.holds) * (pointSettings.SVH ?? 0);
  points += (stats.saves + (0.5 * stats.holds)) * (pointSettings.SVH2 ?? 0);
  points += ((0.5 * stats.saves) + stats.holds) * (pointSettings.SVH3 ?? 0);

  // Net Saves
  const bs = estimateBlownSaves(stats);
  points += (stats.saves - bs) * (pointSettings.NS ?? 0);
  points += (stats.saves - (0.5 * bs)) * (pointSettings.NS2 ?? 0);
  points += (stats.saves - bs + stats.holds) * (pointSettings.NS3 ?? 0);
  points += (stats.saves + stats.holds - bs) * (pointSettings.NS4 ?? 0);
  points += ((stats.saves + stats.holds) - bs) * (pointSettings.NSH ?? 0);

  // Additional Counting
  points += estimateCompleteGames(stats) * (pointSettings.CG ?? 0);
  points += estimateShutouts(stats) * (pointSettings.SHO ?? 0);
  points += stats.gamesStarted * (pointSettings.GS ?? 0);
  points += estimateGamesFinished(stats) * (pointSettings.GF ?? 0);
  points += stats.games * (pointSettings.GP_pitcher ?? 0);
  points += estimateBattersFaced(stats) * (pointSettings.BF ?? 0);
  points += (stats.wins + estimateQualityStarts(stats)) * (pointSettings['W+QS'] ?? 0);

  // Allowed Stats
  points += estimateSinglesAllowed(stats) * (pointSettings['1B_allowed'] ?? 0);
  points += estimateDoublesAllowed(stats) * (pointSettings['2B_allowed'] ?? 0);
  points += estimateTriplesAllowed(stats) * (pointSettings['3B_allowed'] ?? 0);
  points += estimateTotalBasesAllowed(stats) * (pointSettings.TB_allowed ?? 0);

  // Base Running Against
  points += estimateStolenBasesAllowed(stats) * (pointSettings.SBA_pitcher ?? 0);
  points += estimateCaughtStealingAgainst(stats) * (pointSettings.CSA_pitcher ?? 0);
  points += estimatePickoffs(stats) * (pointSettings.PKO_pitcher ?? 0);
  points += estimateInheritedRunners(stats) * (pointSettings.IR ?? 0);
  points += estimateInheritedRunnersStranded(stats) * (pointSettings.IRS ?? 0);
  points += estimateDoublePlaysPitcher(stats) * (pointSettings.GIDP_pitcher ?? 0);
  points += estimateDoublePlaysPitcher(stats) * (pointSettings.DPI ?? 0);

  return points;
}

/**
 * Convert points to dollar values with market-aware distribution
 * This enhanced version applies inflation corrections based on historical data
 */
function convertPointsToDollarsMarketAdjusted(
  players: Array<{ player: NormalizedProjection; points: number }>,
  poolSize: number,
  totalBudget: number,
  totalPoolPoints: number,
  settings: LeagueSettings
): PlayerWithValue[] {
  const enableMarketCorrection = settings.inflationSettings?.enableMarketCorrection ?? true;

  const reservedDollars = poolSize * MIN_AUCTION_VALUE;
  const distributableDollars = totalBudget - reservedDollars;

  // Step 1: Calculate base values using points approach
  const playersWithBaseValues = players.map((p, index) => {
    const isInPool = index < poolSize;
    let baseValue = 0;

    if (isInPool && totalPoolPoints > 0 && p.points > 0) {
      const pointsShare = p.points / totalPoolPoints;
      baseValue = MIN_AUCTION_VALUE + Math.round(pointsShare * distributableDollars);
    } else if (isInPool) {
      baseValue = MIN_AUCTION_VALUE;
    }

    return {
      player: p.player,
      points: p.points,
      baseValue,
      tier: calculateTier(index, poolSize),
      isInPool,
    };
  });

  // Step 2: Apply market inflation correction if enabled
  if (enableMarketCorrection) {
    applyMarketInflationCorrection(playersWithBaseValues, settings, totalBudget);
  } else {
    // Legacy normalization
    const playersInPool = playersWithBaseValues.filter(p => p.isInPool);
    const totalAllocated = playersInPool.reduce((sum, p) => sum + p.baseValue, 0);

    if (totalAllocated !== totalBudget && playersInPool.length > 0) {
      const difference = totalBudget - totalAllocated;
      const topPlayer = playersInPool[0];
      if (topPlayer) {
        topPlayer.baseValue = Math.max(MIN_AUCTION_VALUE, topPlayer.baseValue + difference);
      }
    }
  }

  // Step 3: Convert to final PlayerWithValue format
  return playersWithBaseValues.map(p => ({
    ...p.player,
    auctionValue: p.baseValue,
    pointsValue: p.points,
    tier: p.tier,
    isInDraftPool: p.isInPool,
  }));
}

/**
 * Convert points to dollar values (legacy version without market correction)
 * Includes budget normalization to ensure values sum exactly to total budget
 */
function convertPointsToDollars(
  players: Array<{ player: NormalizedProjection; points: number }>,
  poolSize: number,
  totalBudget: number,
  totalPoolPoints: number
): PlayerWithValue[] {
  const reservedDollars = poolSize * MIN_AUCTION_VALUE;
  const distributableDollars = totalBudget - reservedDollars;

  const results = players.map((p, index) => {
    const isInPool = index < poolSize;
    let auctionValue = 0;

    if (isInPool && totalPoolPoints > 0 && p.points > 0) {
      const pointsShare = p.points / totalPoolPoints;
      auctionValue = MIN_AUCTION_VALUE + Math.round(pointsShare * distributableDollars);
    } else if (isInPool) {
      auctionValue = MIN_AUCTION_VALUE;
    }

    return {
      ...p.player,
      auctionValue,
      pointsValue: p.points,
      tier: calculateTier(index, poolSize),
      isInDraftPool: isInPool,
    };
  });

  // Normalize to ensure exact budget match (handles rounding errors)
  const playersInPool = results.filter(p => p.isInDraftPool);
  const totalAllocated = playersInPool.reduce((sum, p) => sum + p.auctionValue, 0);

  if (totalAllocated !== totalBudget && playersInPool.length > 0) {
    const difference = totalBudget - totalAllocated;
    // Apply adjustment to the top player (most value, smallest relative impact)
    const topPlayer = playersInPool[0];
    if (topPlayer) {
      topPlayer.auctionValue = Math.max(MIN_AUCTION_VALUE, topPlayer.auctionValue + difference);
    }
  }

  return results;
}

/**
 * Calculate tier (1-10) based on ranking within pool
 * Uses percentile-based assignment for consistent tier sizes regardless of pool size
 */
function calculateTier(rank: number, poolSize: number): number {
  if (rank >= poolSize) return 10; // Outside pool
  if (poolSize === 0) return 10;
  // Percentile-based tier assignment: each tier gets ~10% of players
  // rank 0 = tier 1, rank poolSize-1 = tier 10
  return Math.min(10, Math.ceil(((rank + 1) / poolSize) * 10));
}

/**
 * Calculate total roster spots from settings
 */
function calculateTotalRosterSpots(settings: LeagueSettings): number {
  const rs = settings.rosterSpots;
  return (
    rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
    rs.OF + rs.CI + rs.MI + rs.UTIL +
    rs.SP + rs.RP + rs.P + rs.Bench
  );
}

/**
 * Calculate hitter and pitcher spot needs
 */
function calculatePositionNeeds(settings: LeagueSettings): { hitterSpots: number; pitcherSpots: number } {
  const rs = settings.rosterSpots;

  const hitterSpots = rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
    rs.OF + rs.CI + rs.MI + rs.UTIL;

  const pitcherSpots = rs.SP + rs.RP + rs.P;

  // Bench can be either - split proportionally
  const totalActive = hitterSpots + pitcherSpots;
  const hitterRatio = hitterSpots / totalActive;
  const benchHitters = Math.round(rs.Bench * hitterRatio);
  const benchPitchers = rs.Bench - benchHitters;

  return {
    hitterSpots: hitterSpots + benchHitters,
    pitcherSpots: pitcherSpots + benchPitchers,
  };
}

/**
 * Get enabled hitting categories from settings
 * Defaults to standard 5x5 categories if none specified
 */
function getEnabledHittingCategories(settings: LeagueSettings): string[] {
  const cats = settings.hittingCategories || {};
  const enabled = Object.entries(cats)
    .filter(([_, enabled]) => enabled)
    .map(([cat]) => cat);

  // Default to standard 5x5 hitting categories if none specified
  if (enabled.length === 0) {
    return ['R', 'HR', 'RBI', 'SB', 'AVG'];
  }
  return enabled;
}

/**
 * Get enabled pitching categories from settings
 * Defaults to standard 5x5 categories if none specified
 */
function getEnabledPitchingCategories(settings: LeagueSettings): string[] {
  const cats = settings.pitchingCategories || {};
  const enabled = Object.entries(cats)
    .filter(([_, enabled]) => enabled)
    .map(([cat]) => cat);

  // Default to standard 5x5 pitching categories if none specified
  if (enabled.length === 0) {
    return ['W', 'K', 'ERA', 'WHIP', 'SV'];
  }
  return enabled;
}

// ============================================================================
// DYNASTY VALUE CALCULATIONS
// ============================================================================

/**
 * Apply dynasty adjustments to calculated auction values
 *
 * Dynasty value blends:
 * 1. Steamer projections (short-term production) - uses existing auction values
 * 2. Dynasty rankings (long-term value including age, upside, contract)
 *
 * Key insight: We blend at the DOLLAR level, not the score level.
 * Dynasty adjustments ADD or SUBTRACT from base Steamer value.
 */
function applyDynastyAdjustments(
  players: PlayerWithValue[],
  dynastyRankings: DynastyRanking[],
  settings: LeagueSettings,
  hitterPoolSize: number,
  pitcherPoolSize: number,
  hitterBudget: number,
  pitcherBudget: number
): PlayerWithDynastyValue[] {
  const dynastyWeight = settings.dynastySettings?.dynastyWeight ?? 0.5;
  const includeMinors = settings.dynastySettings?.includeMinors ?? false;

  // Filter dynasty rankings based on includeMinors setting
  // When includeMinors is false, only include players at MLB level
  // This filters out prospects who have never had an MLB at-bat
  let filteredRankings = dynastyRankings;
  if (!includeMinors) {
    const beforeCount = dynastyRankings.length;
    filteredRankings = dynastyRankings.filter(r => r.level === 'MLB');
    logger.debug({ before: beforeCount, after: filteredRankings.length }, 'Filtered rankings to MLB only (excludeMinors mode)');
  }

  // Match dynasty rankings to projections
  const rankingMap = matchDynastyRankingsToProjections(
    filteredRankings,
    players.map(p => ({ externalId: p.externalId, name: p.name, team: p.team }))
  );

  logger.debug({ matched: rankingMap.size, total: players.length }, 'Matched players to dynasty rankings');

  // Debug: Check if specific players are in dynasty rankings
  const jesusPlayer = players.find(p => p.name.includes('Jesus Rodriguez'));
  const rafaelPlayer = players.find(p => p.name.includes('Rafael Flores'));
  if (jesusPlayer) {
    const jesusRanking = rankingMap.get(jesusPlayer.externalId);
    logger.debug({
      player: 'Jesus Rodriguez',
      externalId: jesusPlayer.externalId,
      matched: !!jesusRanking,
      rank: jesusRanking?.overallRank,
    }, 'Dynasty debug - player match');
  }
  if (rafaelPlayer) {
    const rafaelRanking = rankingMap.get(rafaelPlayer.externalId);
    logger.debug({
      player: 'Rafael Flores',
      externalId: rafaelPlayer.externalId,
      matched: !!rafaelRanking,
      rank: rafaelRanking?.overallRank,
    }, 'Dynasty debug - player match');
  }

  // Separate hitters and pitchers
  const hitters = players.filter(p => p.playerType === 'hitter');
  const pitchers = players.filter(p => p.playerType === 'pitcher');

  // Calculate blended values - using dollar-based approach
  const adjustedHitters = calculateDynastyAdjustedValuesDollarBased(
    hitters,
    rankingMap,
    dynastyWeight,
    hitterPoolSize,
    hitterBudget
  );

  const adjustedPitchers = calculateDynastyAdjustedValuesDollarBased(
    pitchers,
    rankingMap,
    dynastyWeight,
    pitcherPoolSize,
    pitcherBudget
  );

  return [...adjustedHitters, ...adjustedPitchers];
}

/**
 * Calculate dynasty-adjusted values using BLENDED DOLLAR approach
 *
 * This approach:
 * 1. Calculates a "dynasty dollar value" based purely on dynasty rank
 * 2. Blends dynasty dollars with Steamer dollars based on dynastyWeight
 * 3. Re-normalizes to ensure budget constraints
 *
 * Key insight: Dynasty rank should ADD value for prospects, not just multiply.
 * A #15 dynasty prospect should be worth $25-40+ regardless of their 2025 Steamer projection.
 */
function calculateDynastyAdjustedValuesDollarBased(
  players: PlayerWithValue[],
  rankingMap: Map<string, DynastyRanking>,
  dynastyWeight: number,
  poolSize: number,
  totalBudget: number
): PlayerWithDynastyValue[] {
  // Calculate what the #1 dynasty player should be worth in a pure dynasty valuation
  // The #1 overall dynasty player should be worth approximately what the #1 Steamer player would be
  // We'll find the max Steamer value in the pool and use that as our ceiling
  const maxSteamerValue = Math.max(...players.slice(0, poolSize).map(p => p.auctionValue), 40);
  // Dynasty #1 should be worth similar to Steamer #1, maybe slightly higher
  const maxDynastyDollars = Math.round(maxSteamerValue * 1.1);

  // Calculate dynasty adjustments for all players
  const playersWithAdjustments = players.map(player => {
    const dynastyRanking = rankingMap.get(player.externalId);
    const steamerValue = player.auctionValue;

    let dynastyDollarValue = 0; // Dollar value based purely on dynasty rank
    let dynastyRank: number | undefined;
    let hasNoDynastyData = false; // Track if player is unranked

    if (dynastyRanking) {
      dynastyRank = dynastyRanking.overallRank;

      // Convert dynasty rank to a dollar value using a gentler curve
      // The goal is to create values that reflect market reality:
      // - Dynasty #1 should be worth ~$50-55 (elite generational talent)
      // - Dynasty #4-5 (like Skenes) should be worth ~$35-40
      // - Dynasty #10 should be worth ~$28-32
      // - Dynasty #25 should be worth ~$18-22
      // - Dynasty #50 should be worth ~$12-15
      // - Dynasty #100 should be worth ~$8-10
      // - Dynasty #200 should be worth ~$4-6
      // - Dynasty #500+ should be worth ~$1-2
      //
      // IMPORTANT: Use a gentler exponent (1.2 instead of 1.5) to avoid
      // over-inflating top dynasty values relative to projections.
      // The steeper curve was causing top prospects like Skenes to have
      // disproportionately high dynasty dollar values.

      if (dynastyRank <= 500) {
        // Use logarithmic decay with gentler exponent (1.2 instead of 1.5)
        // This creates a smoother curve that doesn't over-reward top ranks
        const normalizedRank = Math.max(1, dynastyRank);
        const logDecay = Math.log(normalizedRank) / Math.log(500);
        // Cap maxDynastyDollars at a reasonable ceiling to prevent inflation
        // Even if Steamer #1 is worth $60, dynasty #1 shouldn't exceed ~$55
        const cappedMaxDynastyDollars = Math.min(maxDynastyDollars, 55);
        dynastyDollarValue = Math.round(cappedMaxDynastyDollars * Math.pow(1 - logDecay, 1.2));
        dynastyDollarValue = Math.max(MIN_AUCTION_VALUE, dynastyDollarValue);
      } else {
        dynastyDollarValue = MIN_AUCTION_VALUE;
      }
    } else {
      // Player has NO dynasty ranking - they're not in the Harry Knows Ball top 500
      // In dynasty leagues, unranked players should be heavily penalized
      // They're either too old, not good enough, or unknown low-level prospects
      hasNoDynastyData = true;
      dynastyDollarValue = 0;
    }

    // Blend Steamer value with Dynasty dollar value based on dynastyWeight
    // dynastyWeight of 0.65 means: 35% Steamer value + 65% dynasty dollar value
    const adjustedValue = (1 - dynastyWeight) * steamerValue + dynastyWeight * dynastyDollarValue;

    return {
      ...player,
      dynastyRank,
      dynastyValue: dynastyRanking?.dynastyValue,
      steamerValue,
      adjustedValue, // Temporary field for sorting
      hasNoDynastyData, // Track if player is unranked
    } as PlayerWithDynastyValue & { adjustedValue: number; hasNoDynastyData: boolean };
  });

  // CRITICAL: In dynasty leagues, EXCLUDE unranked players from the draft pool entirely
  // Players not in Harry Knows Ball rankings are either:
  // - Low-level minor leaguers with no dynasty value
  // - Older players not worth rostering in dynasty
  // - Unknown prospects that shouldn't be in consideration
  // They should NOT compete for budget allocation with ranked players
  //
  // FIX: Filter unranked players BEFORE pool calculation to ensure they never
  // enter the pool and don't affect budget distribution
  const rankedPlayers = playersWithAdjustments.filter(p => !p.hasNoDynastyData);
  const unrankedPlayers = playersWithAdjustments.filter(p => p.hasNoDynastyData);

  // Sort ranked players by adjusted value (highest first)
  rankedPlayers.sort((a, b) => b.adjustedValue - a.adjustedValue);

  // Sort unranked players by their Steamer value (they go after all ranked players)
  unrankedPlayers.sort((a, b) => (b.steamerValue ?? 0) - (a.steamerValue ?? 0));

  // CRITICAL FIX: Calculate the actual pool from ONLY ranked players
  // The effective pool size is the minimum of requested pool size and available ranked players
  const effectivePoolSize = Math.min(poolSize, rankedPlayers.length);

  // Get pool players from ranked players ONLY
  const poolPlayers = rankedPlayers.slice(0, effectivePoolSize);
  const totalAdjustedValue = poolPlayers.reduce(
    (sum, p) => sum + Math.max(0, p.adjustedValue),
    0
  );

  // Reserve $1 per player in the effective pool (not the requested pool size)
  const reservedDollars = effectivePoolSize * MIN_AUCTION_VALUE;
  const distributableDollars = totalBudget - reservedDollars;

  // Combine: all ranked players first, then unranked players (for output ordering)
  const sortedPlayers = [...rankedPlayers, ...unrankedPlayers];

  logger.debug({
    requestedPool: poolSize,
    rankedAvailable: rankedPlayers.length,
    effectivePool: effectivePoolSize,
    unrankedExcluded: unrankedPlayers.length,
    totalAdjustedValue,
    distributableDollars,
    maxDynastyDollars,
  }, 'Dynasty pool size calculation');

  // Log top 5 players for debugging dynasty value distribution
  const top5 = rankedPlayers.slice(0, 5);
  logger.info({
    top5Players: top5.map(p => ({
      name: p.name,
      dynastyRank: p.dynastyRank,
      steamerValue: p.steamerValue,
      adjustedValue: p.adjustedValue,
    })),
    poolStats: {
      totalAdjustedValue,
      avgAdjustedValue: totalAdjustedValue / effectivePoolSize,
      distributableDollars,
    },
  }, 'Dynasty top players debug');

  const results = sortedPlayers.map((player, index) => {
    // In dynasty mode, ONLY ranked players can be in the draft pool
    // Use effectivePoolSize (which only counts ranked players) for pool membership
    // Unranked players (hasNoDynastyData === true) are NEVER included in the pool
    const isInPool = index < effectivePoolSize && !player.hasNoDynastyData;
    let auctionValue = 0;

    // Debug: Log specific players to track why they might appear in pool
    if (player.name.includes('Jesus Rodriguez') || player.name.includes('Rafael Flores')) {
      logger.debug({
        player: player.name,
        index,
        effectivePoolSize,
        hasNoDynastyData: player.hasNoDynastyData,
        isInPool,
      }, 'Dynasty debug - pool check');
    }

    if (isInPool && totalAdjustedValue > 0 && player.adjustedValue > 0) {
      const valueShare = player.adjustedValue / totalAdjustedValue;
      auctionValue = MIN_AUCTION_VALUE + Math.round(valueShare * distributableDollars);

      // Debug logging for top players
      if (index < 5) {
        logger.debug({
          player: player.name,
          valueShare: (valueShare * 100).toFixed(2) + '%',
          adjustedValue: player.adjustedValue,
          calculatedAuctionValue: auctionValue,
        }, 'Dynasty top player auction value');
      }
    } else if (isInPool) {
      auctionValue = MIN_AUCTION_VALUE;
    }

    // Update tier based on new ranking (use effectivePoolSize for tier calculation)
    const tier = calculateTierFromRank(index, effectivePoolSize);

    // Remove temporary fields (adjustedValue and hasNoDynastyData)
    const { adjustedValue: _adj, hasNoDynastyData: _hasNo, ...playerWithoutTemp } = player;

    return {
      ...playerWithoutTemp,
      auctionValue,
      tier,
      isInDraftPool: isInPool,
    };
  });

  // Normalize to ensure exact budget match
  const playersInPool = results.filter(p => p.isInDraftPool);
  const totalAllocated = playersInPool.reduce((sum, p) => sum + p.auctionValue, 0);

  if (totalAllocated !== totalBudget && playersInPool.length > 0) {
    const difference = totalBudget - totalAllocated;
    const topPlayer = playersInPool[0];
    if (topPlayer) {
      topPlayer.auctionValue = Math.max(MIN_AUCTION_VALUE, topPlayer.auctionValue + difference);
    }
  }

  return results;
}

/**
 * Calculate age-based value adjustment for dynasty leagues
 *
 * Young players get a premium (more peak years ahead)
 * Older players get a discount (decline curve approaching)
 */
function calculateAgeAdjustment(age: number): number {
  if (age < 23) {
    // Very young - high upside but also more risk
    return 1.12;
  } else if (age < 26) {
    // Young prime - best years ahead
    return 1.15;
  } else if (age < 28) {
    // Early prime - peak production expected
    return 1.08;
  } else if (age < 30) {
    // Prime years - still valuable
    return 1.0;
  } else if (age < 32) {
    // Late prime - some decline expected
    return 0.92;
  } else if (age < 35) {
    // Decline phase
    return 0.82;
  } else {
    // Late career - significant decline risk
    return 0.70;
  }
}

/**
 * Calculate tier from rank position
 */
function calculateTierFromRank(rank: number, poolSize: number): number {
  if (rank >= poolSize) return 10;
  if (poolSize === 0) return 10;
  return Math.min(10, Math.ceil(((rank + 1) / poolSize) * 10));
}

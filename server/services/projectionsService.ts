/**
 * Projections Service
 * Fetches player projections from FanGraphs and normalizes them to internal format
 */

import type {
  FanGraphsHitter,
  FanGraphsPitcher,
  NormalizedProjection,
} from '../types/projections.js';
import { logger } from './logger.js';

const FANGRAPHS_BASE_URL = 'https://www.fangraphs.com/api/projections';

/**
 * Validates a normalized projection to catch bad data from the API
 * Returns true if the projection is valid, false if it should be filtered out
 */
function validateProjection(proj: NormalizedProjection): boolean {
  // Basic validation - must have a name and external ID
  if (!proj.name || !proj.externalId) {
    logger.warn({ name: proj.name, externalId: proj.externalId }, 'Invalid projection: missing name or ID');
    return false;
  }

  if (proj.playerType === 'hitter') {
    if (!proj.hitting) {
      logger.warn({ player: proj.name }, 'Invalid hitter projection: missing hitting stats');
      return false;
    }
    const h = proj.hitting;

    // Plate appearances should be reasonable (0-800 for a full season)
    if (h.plateAppearances < 0 || h.plateAppearances > 800) {
      logger.warn({ player: proj.name, PA: h.plateAppearances }, 'Invalid hitter projection: PA out of range');
      return false;
    }

    // Batting average must be between 0 and 1
    if (h.battingAvg < 0 || h.battingAvg > 1) {
      logger.warn({ player: proj.name, AVG: h.battingAvg }, 'Invalid hitter projection: AVG out of range');
      return false;
    }

    // WAR should be realistic (-5 to 15)
    if (h.war < -5 || h.war > 15) {
      logger.warn({ player: proj.name, WAR: h.war }, 'Invalid hitter projection: WAR out of range');
      return false;
    }

    // OBP should be between 0 and 1
    if (h.onBasePct < 0 || h.onBasePct > 1) {
      logger.warn({ player: proj.name, OBP: h.onBasePct }, 'Invalid hitter projection: OBP out of range');
      return false;
    }
  } else if (proj.playerType === 'pitcher') {
    if (!proj.pitching) {
      logger.warn({ player: proj.name }, 'Invalid pitcher projection: missing pitching stats');
      return false;
    }
    const p = proj.pitching;

    // Innings pitched should be reasonable (0-300 for a full season)
    if (p.inningsPitched < 0 || p.inningsPitched > 300) {
      logger.warn({ player: proj.name, IP: p.inningsPitched }, 'Invalid pitcher projection: IP out of range');
      return false;
    }

    // ERA should be reasonable (0-15, allowing for small sample size projections)
    if (p.era < 0 || p.era > 15) {
      logger.warn({ player: proj.name, ERA: p.era }, 'Invalid pitcher projection: ERA out of range');
      return false;
    }

    // WHIP should be reasonable (0-3)
    if (p.whip < 0 || p.whip > 3) {
      logger.warn({ player: proj.name, WHIP: p.whip }, 'Invalid pitcher projection: WHIP out of range');
      return false;
    }

    // WAR should be realistic (-5 to 15)
    if (p.war < -5 || p.war > 15) {
      logger.warn({ player: proj.name, WAR: p.war }, 'Invalid pitcher projection: WAR out of range');
      return false;
    }
  }

  return true;
}

/**
 * Fetches Steamer projections for both hitters and pitchers from FanGraphs
 */
export async function fetchSteamerProjections(): Promise<NormalizedProjection[]> {
  logger.info('Fetching Steamer projections from FanGraphs');

  // Fetch both batting and pitching in parallel
  const [hittersResponse, pitchersResponse] = await Promise.all([
    fetch(`${FANGRAPHS_BASE_URL}?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all`),
    fetch(`${FANGRAPHS_BASE_URL}?type=steamer&stats=pit&pos=all&team=0&players=0&lg=all`),
  ]);

  if (!hittersResponse.ok) {
    throw new Error(`Failed to fetch hitter projections: ${hittersResponse.status}`);
  }
  if (!pitchersResponse.ok) {
    throw new Error(`Failed to fetch pitcher projections: ${pitchersResponse.status}`);
  }

  const hitters: FanGraphsHitter[] = await hittersResponse.json();
  const pitchers: FanGraphsPitcher[] = await pitchersResponse.json();

  logger.info({ hitters: hitters.length, pitchers: pitchers.length }, 'Fetched projections from FanGraphs');

  // Normalize all projections
  const normalizedHitters = hitters.map(normalizeHitter);
  const normalizedPitchers = pitchers.map(normalizePitcher);

  // Validate projections to filter out bad data
  const validHitters = normalizedHitters.filter(validateProjection);
  const validPitchers = normalizedPitchers.filter(validateProjection);

  const filteredHitters = normalizedHitters.length - validHitters.length;
  const filteredPitchers = normalizedPitchers.length - validPitchers.length;

  if (filteredHitters > 0 || filteredPitchers > 0) {
    logger.info({ filteredHitters, filteredPitchers }, 'Filtered out invalid projections');
  }

  logger.info({ validHitters: validHitters.length, validPitchers: validPitchers.length }, 'Returning valid projections');

  return [...validHitters, ...validPitchers];
}

/**
 * Fetches BatX projections for hitters and THE BAT projections for pitchers from FanGraphs
 * BatX (Derek Carty) uses 'thebatx' for hitters and 'thebat' for pitchers
 */
export async function fetchBatXProjections(): Promise<NormalizedProjection[]> {
  logger.info('Fetching BatX projections from FanGraphs');

  // Fetch both batting (thebatx) and pitching (thebat) in parallel
  const [hittersResponse, pitchersResponse] = await Promise.all([
    fetch(`${FANGRAPHS_BASE_URL}?type=thebatx&stats=bat&pos=all&team=0&players=0&lg=all`),
    fetch(`${FANGRAPHS_BASE_URL}?type=thebat&stats=pit&pos=all&team=0&players=0&lg=all`),
  ]);

  if (!hittersResponse.ok) {
    throw new Error(`Failed to fetch BatX hitter projections: ${hittersResponse.status}`);
  }
  if (!pitchersResponse.ok) {
    throw new Error(`Failed to fetch THE BAT pitcher projections: ${pitchersResponse.status}`);
  }

  const hitters: FanGraphsHitter[] = await hittersResponse.json();
  const pitchers: FanGraphsPitcher[] = await pitchersResponse.json();

  logger.info({ hitters: hitters.length, pitchers: pitchers.length }, 'Fetched BatX projections from FanGraphs');

  // Normalize all projections
  const normalizedHitters = hitters.map(normalizeHitter);
  const normalizedPitchers = pitchers.map(normalizePitcher);

  // Validate projections to filter out bad data
  const validHitters = normalizedHitters.filter(validateProjection);
  const validPitchers = normalizedPitchers.filter(validateProjection);

  const filteredHitters = normalizedHitters.length - validHitters.length;
  const filteredPitchers = normalizedPitchers.length - validPitchers.length;

  if (filteredHitters > 0 || filteredPitchers > 0) {
    logger.info({ filteredHitters, filteredPitchers }, 'Filtered out invalid BatX projections');
  }

  logger.info({ validHitters: validHitters.length, validPitchers: validPitchers.length }, 'Returning valid BatX projections');

  return [...validHitters, ...validPitchers];
}

/**
 * Normalizes a FanGraphs hitter to internal format
 */
function normalizeHitter(raw: FanGraphsHitter): NormalizedProjection {
  return {
    externalId: raw.playerid,
    mlbamId: raw.xMLBAMID,
    name: raw.PlayerName,
    team: raw.Team || 'FA', // Free agent if no team
    positions: parsePositions(raw.minpos),
    playerType: 'hitter',
    hitting: {
      games: Math.round(raw.G || 0),
      atBats: Math.round(raw.AB || 0),
      plateAppearances: Math.round(raw.PA || 0),
      runs: Math.round(raw.R || 0),
      hits: Math.round(raw.H || 0),
      singles: Math.round(raw['1B'] || 0),
      doubles: Math.round(raw['2B'] || 0),
      triples: Math.round(raw['3B'] || 0),
      homeRuns: Math.round(raw.HR || 0),
      rbi: Math.round(raw.RBI || 0),
      stolenBases: Math.round(raw.SB || 0),
      caughtStealing: Math.round(raw.CS || 0),
      walks: Math.round(raw.BB || 0),
      strikeouts: Math.round(raw.SO || 0),
      battingAvg: raw.AVG || 0,
      onBasePct: raw.OBP || 0,
      sluggingPct: raw.SLG || 0,
      ops: raw.OPS || 0,
      wOBA: raw.wOBA || 0,
      wrcPlus: raw['wRC+'] || 0,
      war: raw.WAR || 0,
    },
  };
}

/**
 * Normalizes a FanGraphs pitcher to internal format
 */
function normalizePitcher(raw: FanGraphsPitcher): NormalizedProjection {
  // Determine if SP or RP based on games started ratio
  const gamesStarted = raw.GS || 0;
  const totalGames = raw.G || 1;
  const starterRatio = gamesStarted / totalGames;

  // If starts more than 50% of games, classify as SP; otherwise RP
  const positions = starterRatio >= 0.5 ? ['SP'] : ['RP'];

  return {
    externalId: raw.playerid,
    mlbamId: raw.xMLBAMID,
    name: raw.PlayerName,
    team: raw.Team || 'FA',
    positions,
    playerType: 'pitcher',
    pitching: {
      games: Math.round(raw.G || 0),
      gamesStarted: Math.round(raw.GS || 0),
      inningsPitched: raw.IP || 0,
      wins: Math.round(raw.W || 0),
      losses: Math.round(raw.L || 0),
      saves: Math.round(raw.SV || 0),
      holds: Math.round(raw.HLD || 0),
      hitsAllowed: Math.round(raw.H || 0),
      earnedRuns: Math.round(raw.ER || 0),
      homeRunsAllowed: Math.round(raw.HR || 0),
      walks: Math.round(raw.BB || 0),
      strikeouts: Math.round(raw.SO || 0),
      era: raw.ERA || 0,
      whip: raw.WHIP || 0,
      k9: raw['K/9'] || 0,
      bb9: raw['BB/9'] || 0,
      fip: raw.FIP || 0,
      war: raw.WAR || 0,
    },
  };
}

/**
 * Parses position string from FanGraphs into array of positions
 * FanGraphs minpos can be: "OF", "1B/DH", "SS/2B", etc.
 */
function parsePositions(minpos: string | null | undefined): string[] {
  if (!minpos) return ['UTIL'];

  // Split on common delimiters
  const positions = minpos
    .split(/[\/,]/)
    .map(p => p.trim().toUpperCase())
    .filter(Boolean);

  // Map FanGraphs position codes to standard fantasy positions
  const mappedPositions = positions.map(pos => {
    switch (pos) {
      case 'C':
      case '1B':
      case '2B':
      case '3B':
      case 'SS':
        return pos;
      case 'LF':
      case 'CF':
      case 'RF':
      case 'OF':
        return 'OF';
      case 'DH':
        return 'UTIL';
      default:
        return pos;
    }
  });

  // Remove duplicates
  return Array.from(new Set(mappedPositions));
}

/**
 * Gets the primary position for a player (first position in list)
 */
export function getPrimaryPosition(player: NormalizedProjection): string {
  return player.positions[0] || (player.playerType === 'pitcher' ? 'P' : 'UTIL');
}

/**
 * Checks if a player is eligible for a given position
 */
export function isEligibleForPosition(player: NormalizedProjection, position: string): boolean {
  // UTIL can be filled by any hitter
  if (position === 'UTIL' && player.playerType === 'hitter') {
    return true;
  }

  // P can be filled by any pitcher
  if (position === 'P' && player.playerType === 'pitcher') {
    return true;
  }

  // CI = 1B or 3B
  if (position === 'CI') {
    return player.positions.includes('1B') || player.positions.includes('3B');
  }

  // MI = 2B or SS
  if (position === 'MI') {
    return player.positions.includes('2B') || player.positions.includes('SS');
  }

  // Direct position match
  return player.positions.includes(position);
}

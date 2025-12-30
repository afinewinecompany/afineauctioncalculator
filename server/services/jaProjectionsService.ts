/**
 * JA Projections Service
 * Fetches player projections from JA Projections Google Sheet and normalizes them to internal format
 */

import type { NormalizedProjection } from '../types/projections';

// Google Sheets public URL for JA Projections
const JA_SHEET_ID = '1c2aCJakeEMLXbxZ5MRPX3IfXFaIAOyntQHjSDzYRh3k';
const HITTERS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${JA_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=hitters`;
const PITCHERS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${JA_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=pitchers`;

/**
 * Raw hitter data from JA Projections Google Sheet
 */
interface JAHitter {
  Player: string;
  Team: string;
  MLBID: string;
  Pos: string;
  $: number;
  PA: number;
  AB: number;
  R: number;
  HR: number;
  RBI: number;
  SB: number;
  AVG: number;
  OBP: number;
  SLG: number;
  OPS: number;
  'K%': number;
  'BB%': number;
  SO: number;
  BB: number;
  'Deep $': number;
}

/**
 * Raw pitcher data from JA Projections Google Sheet
 */
interface JAPitcher {
  Pitcher: string;
  Team: string;
  SAVID: string;
  $: number;
  GS: number;
  IP: number;
  TBF: number;
  ERA: number;
  WHIP: number;
  K: number;
  BB: number;
  'K%': number;
  'BB%': number;
  W: number;
  SV: number;
  'GB%': number;
  HR: number;
  H: number;
  ER: number;
  'Deep $': number;
}

/**
 * Parses CSV text into an array of objects
 */
function parseCSV<T>(csvText: string): T[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header row - handle quoted values
  const headers = parseCSVLine(lines[0]);

  const results: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const obj: Record<string, string | number> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];

      // Try to parse as number if it looks numeric
      const numValue = parseFloat(value);
      obj[header] = isNaN(numValue) ? value : numValue;
    }
    results.push(obj as T);
  }

  return results;
}

/**
 * Parses a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Fetches JA Projections for both hitters and pitchers
 */
export async function fetchJAProjections(): Promise<NormalizedProjection[]> {
  console.log('Fetching JA Projections from Google Sheets...');

  // Fetch both hitters and pitchers in parallel
  const [hittersResponse, pitchersResponse] = await Promise.all([
    fetch(HITTERS_SHEET_URL),
    fetch(PITCHERS_SHEET_URL),
  ]);

  if (!hittersResponse.ok) {
    throw new Error(`Failed to fetch JA hitter projections: ${hittersResponse.status}`);
  }
  if (!pitchersResponse.ok) {
    throw new Error(`Failed to fetch JA pitcher projections: ${pitchersResponse.status}`);
  }

  const hittersCSV = await hittersResponse.text();
  const pitchersCSV = await pitchersResponse.text();

  const hitters = parseCSV<JAHitter>(hittersCSV);
  const pitchers = parseCSV<JAPitcher>(pitchersCSV);

  console.log(`Fetched ${hitters.length} hitters and ${pitchers.length} pitchers from JA Projections`);

  // Normalize all projections
  const normalizedHitters = hitters
    .filter(h => h.Player && h.Player.trim() !== '')
    .map(normalizeJAHitter);

  const normalizedPitchers = pitchers
    .filter(p => p.Pitcher && p.Pitcher.trim() !== '')
    .map(normalizeJAPitcher);

  // Validate projections
  const validHitters = normalizedHitters.filter(validateJAProjection);
  const validPitchers = normalizedPitchers.filter(validateJAProjection);

  const filteredHitters = normalizedHitters.length - validHitters.length;
  const filteredPitchers = normalizedPitchers.length - validPitchers.length;

  if (filteredHitters > 0 || filteredPitchers > 0) {
    console.log(`Filtered out ${filteredHitters} invalid hitters and ${filteredPitchers} invalid pitchers`);
  }

  console.log(`Returning ${validHitters.length} valid hitters and ${validPitchers.length} valid pitchers from JA Projections`);

  return [...validHitters, ...validPitchers];
}

/**
 * Validates a JA projection to catch bad data
 */
function validateJAProjection(proj: NormalizedProjection): boolean {
  if (!proj.name || !proj.externalId) {
    return false;
  }

  if (proj.playerType === 'hitter') {
    if (!proj.hitting) return false;
    const h = proj.hitting;

    // Basic sanity checks
    if (h.plateAppearances < 0 || h.plateAppearances > 800) return false;
    if (h.battingAvg < 0 || h.battingAvg > 1) return false;
  } else if (proj.playerType === 'pitcher') {
    if (!proj.pitching) return false;
    const p = proj.pitching;

    // Basic sanity checks
    if (p.inningsPitched < 0 || p.inningsPitched > 300) return false;
    if (p.era < 0 || p.era > 15) return false;
  }

  return true;
}

/**
 * Normalizes a JA hitter to internal format
 */
function normalizeJAHitter(raw: JAHitter): NormalizedProjection {
  // Generate a unique ID from name + team if MLBID not available
  const externalId = raw.MLBID && raw.MLBID !== ''
    ? `ja-${raw.MLBID}`
    : `ja-${raw.Player.replace(/\s+/g, '-').toLowerCase()}-${raw.Team || 'FA'}`;

  // Parse MLBID as number if available
  const mlbamId = raw.MLBID ? parseInt(raw.MLBID, 10) : 0;

  // Parse positions
  const positions = parsePositions(raw.Pos);

  // Calculate derived stats
  const pa = raw.PA || 0;
  const ab = raw.AB || 0;
  const h = Math.round((raw.AVG || 0) * ab);
  const bb = raw.BB || 0;
  const so = raw.SO || 0;

  return {
    externalId,
    mlbamId: isNaN(mlbamId) ? 0 : mlbamId,
    name: raw.Player,
    team: raw.Team || 'FA',
    positions,
    playerType: 'hitter',
    hitting: {
      games: Math.round(pa / 4.5), // Estimate games from PA
      atBats: Math.round(ab),
      plateAppearances: Math.round(pa),
      runs: Math.round(raw.R || 0),
      hits: h,
      singles: Math.max(0, h - Math.round(raw.HR || 0)), // Simplified - just subtract HR
      doubles: 0, // Not provided in JA
      triples: 0, // Not provided in JA
      homeRuns: Math.round(raw.HR || 0),
      rbi: Math.round(raw.RBI || 0),
      stolenBases: Math.round(raw.SB || 0),
      caughtStealing: 0, // Not provided in JA
      walks: Math.round(bb),
      strikeouts: Math.round(so),
      battingAvg: raw.AVG || 0,
      onBasePct: raw.OBP || 0,
      sluggingPct: raw.SLG || 0,
      ops: raw.OPS || 0,
      wOBA: 0, // Not provided in JA
      wrcPlus: 0, // Not provided in JA
      war: 0, // Not provided in JA - will be estimated from other stats
    },
  };
}

/**
 * Normalizes a JA pitcher to internal format
 */
function normalizeJAPitcher(raw: JAPitcher): NormalizedProjection {
  // Generate a unique ID
  const externalId = raw.SAVID && raw.SAVID !== ''
    ? `ja-${raw.SAVID}`
    : `ja-${raw.Pitcher.replace(/\s+/g, '-').toLowerCase()}-${raw.Team || 'FA'}`;

  // Determine if SP or RP based on games started and saves
  const gs = raw.GS || 0;
  const sv = raw.SV || 0;
  const positions = gs > 5 ? ['SP'] : sv > 0 ? ['RP'] : ['SP'];

  const ip = raw.IP || 0;
  const er = raw.ER || 0;

  return {
    externalId,
    mlbamId: 0, // SAVID is not MLBAM ID
    name: raw.Pitcher,
    team: raw.Team || 'FA',
    positions,
    playerType: 'pitcher',
    pitching: {
      games: Math.round(ip / 5.5), // Estimate games from IP
      gamesStarted: Math.round(gs),
      inningsPitched: ip,
      wins: Math.round(raw.W || 0),
      losses: 0, // Not provided in JA
      saves: Math.round(sv),
      holds: 0, // Not provided in JA
      hitsAllowed: Math.round(raw.H || 0),
      earnedRuns: Math.round(er),
      homeRunsAllowed: Math.round(raw.HR || 0),
      walks: Math.round(raw.BB || 0),
      strikeouts: Math.round(raw.K || 0),
      era: raw.ERA || 0,
      whip: raw.WHIP || 0,
      k9: ip > 0 ? ((raw.K || 0) / ip) * 9 : 0,
      bb9: ip > 0 ? ((raw.BB || 0) / ip) * 9 : 0,
      fip: 0, // Not provided in JA
      war: 0, // Not provided in JA
    },
  };
}

/**
 * Parses position string from JA format into array of positions
 * JA format: "OF", "UT, P", "SS", etc.
 */
function parsePositions(posString: string | number | null | undefined): string[] {
  if (posString === null || posString === undefined || posString === '') return ['UTIL'];

  // Convert to string if it's a number (can happen with some CSV data)
  const posStr = String(posString);

  const positions = posStr
    .split(/[\/,]/)
    .map(p => p.trim().toUpperCase())
    .filter(Boolean);

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
      case 'UT':
        return 'UTIL';
      case 'P':
        return 'P';
      default:
        return pos;
    }
  });

  // Remove duplicates and filter out 'P' for hitters (Ohtani case handled separately)
  return Array.from(new Set(mappedPositions.filter(p => p !== 'P' || positions.includes('P'))));
}

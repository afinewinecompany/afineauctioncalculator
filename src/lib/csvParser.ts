/**
 * CSV Parser for Dynasty Rankings
 * Supports flexible column name matching for player name, rank, and ID columns.
 */

import type { CustomDynastyRanking } from './types';

/**
 * Flexible column name matching patterns.
 * Each pattern array is tested against lowercase header names.
 */
const NAME_PATTERNS = [
  // Exact matches
  'name', 'player', 'playername', 'player_name', 'fullname', 'full_name',
  // Partial matches handled separately
];

const FIRST_NAME_PATTERNS = [
  'first', 'firstname', 'first_name', 'fname',
];

const LAST_NAME_PATTERNS = [
  'last', 'lastname', 'last_name', 'lname',
];

const RANK_PATTERNS = [
  // Exact matches
  'rank', 'ranking', 'dynasty_rank', 'dynastyrank', 'overall_rank',
  'overall', 'overallrank', 'dynasty', 'pos_rank', 'posrank',
];

/**
 * Finds a column index using flexible matching.
 * First tries exact matches, then partial matches.
 */
function findColumnIndex(headers: string[], patterns: string[], partialMatch = false): number {
  // Try exact matches first
  for (const pattern of patterns) {
    const idx = headers.findIndex(h => h === pattern);
    if (idx !== -1) return idx;
  }

  // Try partial matches if enabled
  if (partialMatch) {
    for (const pattern of patterns) {
      const idx = headers.findIndex(h => h.includes(pattern));
      if (idx !== -1) return idx;
    }
  }

  return -1;
}

/**
 * Finds any column that contains 'id' in its name.
 * Prioritizes specific ID columns, then falls back to any *id column.
 */
function findIdColumn(headers: string[]): number {
  // Priority ID column patterns (most specific first)
  const priorityPatterns = [
    'mlbamid', 'mlbam_id', 'mlb_id', 'mlbid',
    'fangraphsid', 'fangraphs_id', 'fg_id', 'fgid',
    'playerid', 'player_id',
    'id',
  ];

  // Try exact matches first
  for (const pattern of priorityPatterns) {
    const idx = headers.findIndex(h => h === pattern);
    if (idx !== -1) return idx;
  }

  // Try partial matches - any column ending in 'id' or containing '_id'
  const idIndex = headers.findIndex(h =>
    h.endsWith('id') ||
    h.includes('_id') ||
    h.includes('id_')
  );

  return idIndex;
}

/**
 * Parses a CSV file to extract dynasty rankings.
 * Supports flexible column names for name, rank, and player ID.
 *
 * Name column: name, player, playername, fullname, full_name, etc.
 *   - Also supports separate first/last name columns
 * Rank column: rank, ranking, dynasty_rank, overall, etc.
 * ID column: any column containing 'id' (mlbamid, fangraphsid, playerid, etc.)
 */
export function parseCSV(text: string): CustomDynastyRanking[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('File must contain a header row and at least one data row');
  }

  // Parse headers - handle both comma-separated and tab-separated
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].toLowerCase().split(delimiter).map(h =>
    h.trim().replace(/^["']|["']$/g, '')
  );

  // Find name column (or first+last name columns)
  const nameIndex = findColumnIndex(headers, NAME_PATTERNS, true);
  const firstNameIndex = findColumnIndex(headers, FIRST_NAME_PATTERNS, true);
  const lastNameIndex = findColumnIndex(headers, LAST_NAME_PATTERNS, true);

  // Validate name column(s)
  const hasFullName = nameIndex !== -1;
  const hasFirstLast = firstNameIndex !== -1 && lastNameIndex !== -1;

  if (!hasFullName && !hasFirstLast) {
    const availableColumns = headers.join(', ');
    throw new Error(
      `Could not find a name column. Expected one of: name, player, fullname, or separate first/last name columns. ` +
      `Found columns: ${availableColumns}`
    );
  }

  // Find rank column
  const rankIndex = findColumnIndex(headers, RANK_PATTERNS, true);
  if (rankIndex === -1) {
    const availableColumns = headers.join(', ');
    throw new Error(
      `Could not find a rank column. Expected one of: rank, ranking, dynasty_rank, overall, etc. ` +
      `Found columns: ${availableColumns}`
    );
  }

  // Find ID column (optional)
  const idIndex = findIdColumn(headers);

  // Log what we found for debugging (dev only)
  if (import.meta.env.DEV) {
    console.log('[CSV Parser] Found columns:', {
      name: hasFullName ? headers[nameIndex] : `${headers[firstNameIndex]} + ${headers[lastNameIndex]}`,
      rank: headers[rankIndex],
      id: idIndex !== -1 ? headers[idIndex] : 'none',
    });
  }

  // Parse data rows
  const rankings: CustomDynastyRanking[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    // Parse values - handle quoted fields and different delimiters
    const values = parseCSVLine(line, delimiter);

    // Get player name
    let name: string;
    if (hasFullName) {
      name = values[nameIndex]?.trim();
    } else {
      const firstName = values[firstNameIndex]?.trim() || '';
      const lastName = values[lastNameIndex]?.trim() || '';
      name = `${firstName} ${lastName}`.trim();
    }

    // Get rank
    const rankValue = values[rankIndex]?.trim();
    const rank = parseInt(rankValue, 10);

    // Get optional ID
    const playerId = idIndex !== -1 ? values[idIndex]?.trim() : undefined;

    // Validate and add
    if (name && !isNaN(rank) && rank > 0) {
      rankings.push({
        name,
        rank,
        playerId: playerId || undefined,
      });
    }
  }

  if (rankings.length === 0) {
    throw new Error('No valid rankings found in file. Ensure each row has a valid name and numeric rank.');
  }

  // Sort by rank
  return rankings.sort((a, b) => a.rank - b.rank);
}

/**
 * Parses a single CSV line, handling quoted fields correctly.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === delimiter) {
        // Field separator
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Add last field
  values.push(current.trim().replace(/^["']|["']$/g, ''));

  return values;
}

/**
 * Validates a CSV file without parsing all data.
 * Returns info about what columns were found.
 */
export function validateCSVHeaders(text: string): {
  valid: boolean;
  nameColumn?: string;
  rankColumn?: string;
  idColumn?: string;
  errors: string[];
} {
  const errors: string[] = [];
  const lines = text.trim().split('\n');

  if (lines.length < 2) {
    return { valid: false, errors: ['File must contain a header row and at least one data row'] };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].toLowerCase().split(delimiter).map(h =>
    h.trim().replace(/^["']|["']$/g, '')
  );

  const nameIndex = findColumnIndex(headers, NAME_PATTERNS, true);
  const firstNameIndex = findColumnIndex(headers, FIRST_NAME_PATTERNS, true);
  const lastNameIndex = findColumnIndex(headers, LAST_NAME_PATTERNS, true);
  const rankIndex = findColumnIndex(headers, RANK_PATTERNS, true);
  const idIndex = findIdColumn(headers);

  const hasFullName = nameIndex !== -1;
  const hasFirstLast = firstNameIndex !== -1 && lastNameIndex !== -1;

  if (!hasFullName && !hasFirstLast) {
    errors.push('Missing name column (expected: name, player, fullname, or first+last columns)');
  }

  if (rankIndex === -1) {
    errors.push('Missing rank column (expected: rank, ranking, dynasty_rank, overall, etc.)');
  }

  return {
    valid: errors.length === 0,
    nameColumn: hasFullName
      ? headers[nameIndex]
      : hasFirstLast
        ? `${headers[firstNameIndex]} + ${headers[lastNameIndex]}`
        : undefined,
    rankColumn: rankIndex !== -1 ? headers[rankIndex] : undefined,
    idColumn: idIndex !== -1 ? headers[idIndex] : undefined,
    errors,
  };
}

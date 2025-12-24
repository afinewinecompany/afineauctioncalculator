import type { ScrapedPlayer, MatchedPlayer } from '../types/auction';

interface ProjectionPlayer {
  id: string;
  name: string;
  team: string;
  positions: string[];
  projectedValue: number;
}

/**
 * Normalizes a player name by removing diacritics, punctuation, and converting to lowercase.
 * Examples:
 * - "Félix Bautista" → "felix bautista"
 * - "Ronald Acuña Jr." → "ronald acuna jr"
 * - "J.T. Realmuto" → "jt realmuto"
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
    .toLowerCase()
    .replace(/\./g, '') // Remove periods (J.T. → JT)
    .replace(/[^a-z\s]/g, '') // Remove other punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Normalizes team abbreviations to a consistent format
 */
export function normalizeTeam(team: string): string {
  const teamMap: Record<string, string> = {
    // Common variations
    'ARI': 'ARI', 'ARZ': 'ARI', 'AZ': 'ARI',
    'ATL': 'ATL',
    'BAL': 'BAL',
    'BOS': 'BOS',
    'CHC': 'CHC', 'CHN': 'CHC',
    'CHW': 'CHW', 'CWS': 'CHW', 'CHA': 'CHW',
    'CIN': 'CIN',
    'CLE': 'CLE',
    'COL': 'COL',
    'DET': 'DET',
    'HOU': 'HOU',
    'KC': 'KC', 'KCR': 'KC',
    'LAA': 'LAA', 'ANA': 'LAA',
    'LAD': 'LAD', 'LA': 'LAD',
    'MIA': 'MIA', 'FLA': 'MIA',
    'MIL': 'MIL',
    'MIN': 'MIN',
    'NYM': 'NYM',
    'NYY': 'NYY',
    'OAK': 'OAK',
    'PHI': 'PHI',
    'PIT': 'PIT',
    'SD': 'SD', 'SDP': 'SD',
    'SF': 'SF', 'SFG': 'SF',
    'SEA': 'SEA',
    'STL': 'STL',
    'TB': 'TB', 'TBR': 'TB', 'TAM': 'TB',
    'TEX': 'TEX',
    'TOR': 'TOR',
    'WAS': 'WAS', 'WSH': 'WAS', 'WSN': 'WAS',
  };

  const upper = team.toUpperCase();
  return teamMap[upper] || upper;
}

/**
 * Attempts to match a scraped player from Couch Managers to a projection player.
 * Uses normalized name matching with team as a tiebreaker.
 */
export function matchPlayer(
  scrapedPlayer: ScrapedPlayer,
  projections: ProjectionPlayer[]
): { player: ProjectionPlayer | null; confidence: 'exact' | 'partial' | 'unmatched' } {
  const normalizedScraped = normalizeName(scrapedPlayer.fullName);
  const scrapedTeam = normalizeTeam(scrapedPlayer.mlbTeam);

  // First pass: exact name match
  const exactMatches = projections.filter(
    p => normalizeName(p.name) === normalizedScraped
  );

  if (exactMatches.length === 1) {
    return { player: exactMatches[0], confidence: 'exact' };
  }

  // If multiple exact matches, use team to disambiguate
  if (exactMatches.length > 1) {
    const teamMatch = exactMatches.find(
      p => normalizeTeam(p.team) === scrapedTeam
    );
    if (teamMatch) {
      return { player: teamMatch, confidence: 'exact' };
    }
    // Return first match if team doesn't help
    return { player: exactMatches[0], confidence: 'partial' };
  }

  // Second pass: partial name matching (for nicknames, suffixes, etc.)
  // Try matching without common suffixes
  const withoutSuffix = normalizedScraped
    .replace(/\s+(jr|sr|ii|iii|iv)$/, '')
    .trim();

  const partialMatches = projections.filter(p => {
    const projName = normalizeName(p.name).replace(/\s+(jr|sr|ii|iii|iv)$/, '').trim();
    return projName === withoutSuffix;
  });

  if (partialMatches.length === 1) {
    return { player: partialMatches[0], confidence: 'partial' };
  }

  if (partialMatches.length > 1) {
    const teamMatch = partialMatches.find(
      p => normalizeTeam(p.team) === scrapedTeam
    );
    if (teamMatch) {
      return { player: teamMatch, confidence: 'partial' };
    }
    return { player: partialMatches[0], confidence: 'partial' };
  }

  // Third pass: check if last name + team matches (for players with different first name formats)
  const lastNameParts = normalizedScraped.split(' ');
  if (lastNameParts.length >= 2) {
    const lastName = lastNameParts[lastNameParts.length - 1];
    const lastNameMatches = projections.filter(p => {
      const projLastName = normalizeName(p.name).split(' ').pop();
      return projLastName === lastName && normalizeTeam(p.team) === scrapedTeam;
    });

    if (lastNameMatches.length === 1) {
      return { player: lastNameMatches[0], confidence: 'partial' };
    }
  }

  return { player: null, confidence: 'unmatched' };
}

/**
 * Matches all scraped players against projections and returns matched results.
 */
export function matchAllPlayers(
  scrapedPlayers: ScrapedPlayer[],
  projections: ProjectionPlayer[]
): { matched: MatchedPlayer[]; unmatched: ScrapedPlayer[] } {
  const matched: MatchedPlayer[] = [];
  const unmatched: ScrapedPlayer[] = [];

  for (const scraped of scrapedPlayers) {
    const { player, confidence } = matchPlayer(scraped, projections);

    if (player && confidence !== 'unmatched') {
      const actualBid = scraped.winningBid ?? null;
      const projectedValue = player.projectedValue;

      let inflationAmount: number | null = null;
      let inflationPercent: number | null = null;

      if (actualBid !== null && projectedValue > 0) {
        inflationAmount = actualBid - projectedValue;
        inflationPercent = ((actualBid - projectedValue) / projectedValue) * 100;
      }

      matched.push({
        scrapedPlayer: scraped,
        projectionPlayerId: player.id,
        projectedValue,
        actualBid,
        inflationAmount,
        inflationPercent,
        matchConfidence: confidence,
      });
    } else {
      unmatched.push(scraped);
    }
  }

  return { matched, unmatched };
}

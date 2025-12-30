import type { ScrapedPlayer, MatchedPlayer } from '../types/auction.js';

interface ProjectionPlayer {
  id: string;
  mlbamId?: number; // MLB.com player ID - consistent across all projection systems
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
    'FA': 'FA', // Free Agent
  };

  const upper = team.toUpperCase();
  return teamMap[upper] || upper;
}

/**
 * Normalizes position names for comparison
 */
function normalizePosition(pos: string): string {
  const posMap: Record<string, string> = {
    'C': 'C',
    '1B': '1B',
    '2B': '2B',
    '3B': '3B',
    'SS': 'SS',
    'LF': 'OF', 'CF': 'OF', 'RF': 'OF', 'OF': 'OF',
    'DH': 'DH', 'UTIL': 'DH',
    'SP': 'SP', 'P': 'P',
    'RP': 'RP', 'CL': 'RP',
    'MI': 'MI', // Middle infield
    'CI': 'CI', // Corner infield
  };
  return posMap[pos.toUpperCase()] || pos.toUpperCase();
}

/**
 * Check if positions overlap (player could play the same role)
 */
function positionsOverlap(positions1: string[], positions2: string[]): boolean {
  const norm1 = new Set(positions1.map(normalizePosition));
  const norm2 = new Set(positions2.map(normalizePosition));

  for (const pos of norm1) {
    if (norm2.has(pos)) return true;
  }
  return false;
}

/**
 * Check if a player is primarily a pitcher (SP or RP)
 */
function isPitcher(positions: string[]): boolean {
  const pitcherPositions = new Set(['SP', 'RP', 'P', 'CL']);
  return positions.some(p => pitcherPositions.has(p.toUpperCase()));
}

/**
 * Check if a player is primarily a hitter (non-pitcher)
 */
function isHitter(positions: string[]): boolean {
  const hitterPositions = new Set(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'UTIL', 'MI', 'CI']);
  return positions.some(p => hitterPositions.has(p.toUpperCase()));
}

/**
 * Calculate a match score based on multiple factors
 * Higher score = better match
 */
function calculateMatchScore(
  scraped: ScrapedPlayer,
  projection: ProjectionPlayer,
  normalizedScrapedName: string,
  normalizedScrapedNameWithoutSuffix: string
): number {
  let score = 0;
  const normalizedProjName = normalizeName(projection.name);
  const normalizedProjNameWithoutSuffix = normalizedProjName.replace(/\s+(jr|sr|ii|iii|iv)$/, '').trim();

  // Name matching (most important)
  if (normalizedProjName === normalizedScrapedName) {
    score += 100; // Exact name match
  } else if (normalizedProjNameWithoutSuffix === normalizedScrapedNameWithoutSuffix) {
    score += 80; // Match without suffix
  } else {
    return 0; // Names don't match at all - no match
  }

  // Team matching (very important for disambiguation)
  const scrapedTeam = normalizeTeam(scraped.mlbTeam);
  const projTeam = normalizeTeam(projection.team);
  if (scrapedTeam === projTeam) {
    score += 50; // Same team
  } else if (projTeam === 'FA') {
    score += 10; // Free agent in projections (might have been traded)
  }

  // Position matching (crucial for same-name players like "Juan Soto" OF vs RP)
  const scrapedIsPitcher = isPitcher(scraped.positions);
  const projIsPitcher = isPitcher(projection.positions);
  const scrapedIsHitter = isHitter(scraped.positions);
  const projIsHitter = isHitter(projection.positions);

  if (scrapedIsPitcher && projIsPitcher) {
    score += 40; // Both pitchers
    if (positionsOverlap(scraped.positions, projection.positions)) {
      score += 20; // Specific position match (SP vs RP)
    }
  } else if (scrapedIsHitter && projIsHitter) {
    score += 40; // Both hitters
    if (positionsOverlap(scraped.positions, projection.positions)) {
      score += 20; // Specific position match
    }
  } else if ((scrapedIsPitcher && projIsHitter) || (scrapedIsHitter && projIsPitcher)) {
    // Position type mismatch - strong negative signal
    score -= 100; // This is likely a different player entirely
  }

  // Value sanity check - if projected value is very low ($1-2), likely a minor leaguer/replacement
  // This helps avoid matching star "Juan Soto" to minor league "Juan Soto"
  if (projection.projectedValue <= 1) {
    score -= 30; // Penalize matching to $1 players
  } else if (projection.projectedValue >= 20) {
    score += 10; // Slightly prefer matching to valuable players (more likely to be drafted)
  }

  return score;
}

/**
 * Attempts to match a scraped player from Couch Managers to a projection player.
 * Uses mlbamId (if available), then name, team, AND position to disambiguate players.
 */
export function matchPlayer(
  scrapedPlayer: ScrapedPlayer,
  projections: ProjectionPlayer[]
): { player: ProjectionPlayer | null; confidence: 'exact' | 'partial' | 'unmatched' } {
  // First, try to match by mlbamId if the scraped player has one
  // This is the most reliable match since mlbamId is consistent across projection systems
  if (scrapedPlayer.mlbamId && scrapedPlayer.mlbamId > 0) {
    const mlbamMatch = projections.find(p => p.mlbamId === scrapedPlayer.mlbamId);
    if (mlbamMatch) {
      return { player: mlbamMatch, confidence: 'exact' };
    }
  }

  const normalizedScraped = normalizeName(scrapedPlayer.fullName);
  const normalizedScrapedWithoutSuffix = normalizedScraped.replace(/\s+(jr|sr|ii|iii|iv)$/, '').trim();

  // Score all potential matches
  const scoredMatches: Array<{ player: ProjectionPlayer; score: number }> = [];

  for (const projection of projections) {
    const score = calculateMatchScore(
      scrapedPlayer,
      projection,
      normalizedScraped,
      normalizedScrapedWithoutSuffix
    );

    if (score > 0) {
      scoredMatches.push({ player: projection, score });
    }
  }

  // Sort by score descending
  scoredMatches.sort((a, b) => b.score - a.score);

  if (scoredMatches.length === 0) {
    return { player: null, confidence: 'unmatched' };
  }

  const bestMatch = scoredMatches[0];

  // Determine confidence level
  let confidence: 'exact' | 'partial' | 'unmatched';

  if (bestMatch.score >= 150) {
    // Exact name + team match
    confidence = 'exact';
  } else if (bestMatch.score >= 100) {
    // Good match but missing team or position confirmation
    confidence = 'partial';
  } else if (bestMatch.score >= 50) {
    // Weak match - name matches but team/position don't align well
    // Check if there's ambiguity (multiple similar scores)
    if (scoredMatches.length > 1 && scoredMatches[1].score > bestMatch.score - 30) {
      // Too much ambiguity - could be wrong player
      console.warn(`[PlayerMatcher] Ambiguous match for "${scrapedPlayer.fullName}" (${scrapedPlayer.mlbTeam}): ` +
        `Best: ${bestMatch.player.name} (${bestMatch.player.team}) score=${bestMatch.score}, ` +
        `Second: ${scoredMatches[1].player.name} (${scoredMatches[1].player.team}) score=${scoredMatches[1].score}`);
      return { player: null, confidence: 'unmatched' };
    }
    confidence = 'partial';
  } else {
    // Score too low - not a reliable match
    return { player: null, confidence: 'unmatched' };
  }

  // Additional safety check: if this is a low-value player match and the scraped player was drafted
  // for significant money, something might be wrong
  if (scrapedPlayer.status === 'drafted' && scrapedPlayer.winningBid && scrapedPlayer.winningBid > 10) {
    if (bestMatch.player.projectedValue <= 2) {
      console.warn(`[PlayerMatcher] Suspicious match: "${scrapedPlayer.fullName}" drafted for $${scrapedPlayer.winningBid} ` +
        `matched to "${bestMatch.player.name}" with projectedValue=$${bestMatch.player.projectedValue}`);
      // Still return the match, but log the warning for investigation
    }
  }

  return { player: bestMatch.player, confidence };
}

/**
 * Deduplicates scraped players by consolidating entries with the same name, team, and position type.
 * When duplicates exist (common in CouchManagers data), prefers entries with complete draft info.
 * This ensures we don't match to a duplicate that's missing winningBid/winningTeam.
 */
function deduplicateScrapedPlayers(players: ScrapedPlayer[]): ScrapedPlayer[] {
  // Group players by normalized key (name + team + position type)
  const groups = new Map<string, ScrapedPlayer[]>();

  for (const player of players) {
    const positionType = isPitcher(player.positions) ? 'pitcher' : 'hitter';
    const key = `${normalizeName(player.fullName)}|${normalizeTeam(player.mlbTeam)}|${positionType}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(player);
  }

  const deduplicated: ScrapedPlayer[] = [];

  for (const [key, group] of groups) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
      continue;
    }

    // Multiple entries - pick the best one
    // Priority: 1) Has complete draft info (winningBid + winningTeam), 2) Has any draft info, 3) First entry
    const sorted = [...group].sort((a, b) => {
      // Score based on completeness of draft info
      const scoreA = (a.winningBid !== undefined ? 2 : 0) + (a.winningTeam !== undefined ? 1 : 0);
      const scoreB = (b.winningBid !== undefined ? 2 : 0) + (b.winningTeam !== undefined ? 1 : 0);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher score first
      }

      // If same score, prefer drafted status
      if (a.status === 'drafted' && b.status !== 'drafted') return -1;
      if (b.status === 'drafted' && a.status !== 'drafted') return 1;

      // If same status, prefer lower couchManagersId (original entry)
      return a.couchManagersId - b.couchManagersId;
    });

    const best = sorted[0];

    // Log duplicate consolidation for debugging
    if (group.length > 1) {
      console.log(`[PlayerMatcher] Consolidated ${group.length} duplicate entries for "${best.fullName}" (${best.mlbTeam}). ` +
        `Selected couchManagersId=${best.couchManagersId} with winningBid=${best.winningBid}, winningTeam=${best.winningTeam}`);
    }

    deduplicated.push(best);
  }

  return deduplicated;
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

  // Deduplicate scraped players first to avoid matching to entries without draft info
  const dedupedPlayers = deduplicateScrapedPlayers(scrapedPlayers);

  if (dedupedPlayers.length !== scrapedPlayers.length) {
    console.log(`[PlayerMatcher] Deduplicated ${scrapedPlayers.length} -> ${dedupedPlayers.length} scraped players`);
  }

  // Track which projection players have been matched to prevent double-matching
  const usedProjectionIds = new Set<string>();

  for (const scraped of dedupedPlayers) {
    const { player, confidence } = matchPlayer(scraped, projections);

    if (player && confidence !== 'unmatched') {
      // Check if this projection player was already matched
      if (usedProjectionIds.has(player.id)) {
        console.warn(`[PlayerMatcher] Duplicate match attempt: "${scraped.fullName}" trying to match to already-used "${player.name}" (${player.id})`);
        unmatched.push(scraped);
        continue;
      }

      usedProjectionIds.add(player.id);

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

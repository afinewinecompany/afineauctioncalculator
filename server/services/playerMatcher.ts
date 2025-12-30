import type { ScrapedPlayer, MatchedPlayer } from '../types/auction.js';
import { logger } from './logger.js';

interface ProjectionPlayer {
  id: string;
  mlbamId?: number; // MLB.com player ID - consistent across all projection systems
  name: string;
  team: string;
  positions: string[];
  projectedValue: number;
}

/**
 * Build a set of valid MLB player keys from projections.
 * This helps validate that a scraped player is actually an MLB player
 * by checking if their name+team combination exists in projections.
 * Returns a Map of normalized "name|team" -> projection player for quick lookup.
 */
function buildProjectionLookup(projections: ProjectionPlayer[]): Map<string, ProjectionPlayer[]> {
  const lookup = new Map<string, ProjectionPlayer[]>();

  for (const proj of projections) {
    const normalizedName = normalizeName(proj.name);
    const normalizedTeam = normalizeTeam(proj.team);
    const key = `${normalizedName}|${normalizedTeam}`;

    if (!lookup.has(key)) {
      lookup.set(key, []);
    }
    lookup.get(key)!.push(proj);
  }

  return lookup;
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
 * Check if a player is a minor league player (has MiLB position marker)
 * Couch Managers marks minor league players with 'MiLB' in their positions array
 */
export function isMinorLeaguePlayer(positions: string[]): boolean {
  return positions.some(p => p.toUpperCase() === 'MILB');
}

/**
 * Get the actual playing positions (excluding markers like MiLB)
 */
export function getPlayingPositions(positions: string[]): string[] {
  return positions.filter(p => p.toUpperCase() !== 'MILB');
}

/**
 * Calculate a match score based on multiple factors
 * Higher score = better match
 *
 * IMPORTANT: This function is STRICT about matching to prevent MiLB/prospect players
 * from being confused with MLB players who share the same name.
 *
 * MATCHING PHILOSOPHY:
 * - Name alone is NOT sufficient for a match
 * - Must have EITHER: same team OR overlapping positions (same type: hitter/pitcher)
 * - Team + position type match is ideal
 * - Team mismatch with position mismatch = NO MATCH
 */
function calculateMatchScore(
  scraped: ScrapedPlayer,
  projection: ProjectionPlayer,
  normalizedScrapedName: string,
  normalizedScrapedNameWithoutSuffix: string,
  allProjections: ProjectionPlayer[] // Used for MLB player validation
): number {
  const normalizedProjName = normalizeName(projection.name);
  const normalizedProjNameWithoutSuffix = normalizedProjName.replace(/\s+(jr|sr|ii|iii|iv)$/, '').trim();

  // Name matching - REQUIRED but not sufficient
  let nameMatches = false;
  let nameScore = 0;
  if (normalizedProjName === normalizedScrapedName) {
    nameMatches = true;
    nameScore = 100; // Exact name match
  } else if (normalizedProjNameWithoutSuffix === normalizedScrapedNameWithoutSuffix) {
    nameMatches = true;
    nameScore = 80; // Match without suffix
  }

  if (!nameMatches) {
    return 0; // Names don't match at all - no match
  }

  // CRITICAL: Minor league player check
  // If the scraped player has 'MiLB' in their positions, they are a minor league prospect
  // and should NEVER match to MLB projections. Period.
  const scrapedIsMiLB = isMinorLeaguePlayer(scraped.positions);
  if (scrapedIsMiLB) {
    logger.debug({
      player: scraped.fullName,
      team: scraped.mlbTeam,
      positions: scraped.positions,
      projectionCandidate: projection.name,
    }, 'Rejecting MiLB player match - MiLB players cannot match to MLB projections');
    return 0; // Hard rejection - no MiLB player should ever match
  }

  // Team matching
  const scrapedTeam = normalizeTeam(scraped.mlbTeam);
  const projTeam = normalizeTeam(projection.team);
  const teamMatches = scrapedTeam === projTeam;
  const projIsFreeAgent = projTeam === 'FA';

  // Position matching
  const scrapedPlayingPositions = getPlayingPositions(scraped.positions);
  const scrapedIsPitcher = isPitcher(scrapedPlayingPositions);
  const projIsPitcher = isPitcher(projection.positions);
  const scrapedIsHitter = isHitter(scrapedPlayingPositions);
  const projIsHitter = isHitter(projection.positions);

  // Check position type match (both pitchers OR both hitters)
  const positionTypeMatches = (scrapedIsPitcher && projIsPitcher) || (scrapedIsHitter && projIsHitter);
  const positionTypeMismatch = (scrapedIsPitcher && projIsHitter) || (scrapedIsHitter && projIsPitcher);

  // CRITICAL: Require at least team match OR position type match
  // Name alone is NOT enough - too many prospects share names with MLB players
  if (!teamMatches && !projIsFreeAgent && !positionTypeMatches) {
    logger.debug({
      player: scraped.fullName,
      scrapedTeam,
      projTeam,
      scrapedPositions: scrapedPlayingPositions,
      projPositions: projection.positions,
    }, 'Rejecting match: name matches but neither team nor position type matches');
    return 0; // HARD REJECTION: No match without team or position confirmation
  }

  // Position type mismatch is a hard rejection (pitcher vs hitter)
  if (positionTypeMismatch) {
    logger.debug({
      player: scraped.fullName,
      scrapedIsPitcher,
      projIsPitcher,
    }, 'Rejecting match: position type mismatch (pitcher vs hitter)');
    return 0; // HARD REJECTION: Different player types
  }

  // Now calculate the actual score
  let score = nameScore;

  // Team score
  if (teamMatches) {
    score += 50; // Same team
  } else if (projIsFreeAgent) {
    score += 10; // Free agent (might have been traded)
  }
  // If we got here without team match, positionTypeMatches must be true

  // Position type score
  if (positionTypeMatches) {
    score += 40;
    // Bonus for specific position overlap
    if (positionsOverlap(scrapedPlayingPositions, projection.positions)) {
      score += 20;
    }
  }

  // Value sanity check
  if (projection.projectedValue <= 1) {
    score -= 30; // Penalize matching to $1 players
  } else if (projection.projectedValue >= 20) {
    score += 10; // Prefer valuable players
  }

  // High-value player validation
  if (projection.projectedValue >= 15) {
    if (scraped.status === 'available') {
      // Star player available might be a prospect - small penalty
      score -= 15;
    } else if (scraped.status === 'drafted' && scraped.winningBid && scraped.winningBid < 5) {
      // Star drafted for $1-4? Very suspicious
      score -= 80;
      logger.debug({
        player: scraped.fullName,
        winningBid: scraped.winningBid,
        projectedValue: projection.projectedValue,
      }, 'High-value player matched to low-bid draft - heavy penalty');
    }
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
      normalizedScrapedWithoutSuffix,
      projections // Pass all projections for name collision detection
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
      logger.warn({
        player: scrapedPlayer.fullName,
        team: scrapedPlayer.mlbTeam,
        bestMatch: { name: bestMatch.player.name, team: bestMatch.player.team, score: bestMatch.score },
        secondMatch: { name: scoredMatches[1].player.name, team: scoredMatches[1].player.team, score: scoredMatches[1].score },
      }, 'Ambiguous player match');
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
      logger.warn({
        scrapedPlayer: scrapedPlayer.fullName,
        winningBid: scrapedPlayer.winningBid,
        matchedPlayer: bestMatch.player.name,
        projectedValue: bestMatch.player.projectedValue,
      }, 'Suspicious match: high draft value matched to low projection');
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
      logger.debug({
        player: best.fullName,
        team: best.mlbTeam,
        duplicateCount: group.length,
        selectedId: best.couchManagersId,
        winningBid: best.winningBid,
        winningTeam: best.winningTeam,
      }, 'Consolidated duplicate player entries');
    }

    deduplicated.push(best);
  }

  return deduplicated;
}

/**
 * Matches all scraped players against projections and returns matched results.
 *
 * IMPORTANT: To prevent MiLB/prospect confusion, we process players in order:
 * 1. Drafted players with high bids first (most likely to be real MLB players)
 * 2. Drafted players with low bids
 * 3. Available players last
 *
 * This ensures that the real MLB player gets matched to the projection,
 * and any prospect with the same name ends up unmatched.
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
    logger.debug({ before: scrapedPlayers.length, after: dedupedPlayers.length }, 'Deduplicated scraped players');
  }

  // CRITICAL: Sort players to prioritize drafted players with high bids
  // This ensures real MLB players match first, leaving prospects unmatched
  const sortedPlayers = [...dedupedPlayers].sort((a, b) => {
    // Drafted players come first
    if (a.status === 'drafted' && b.status !== 'drafted') return -1;
    if (b.status === 'drafted' && a.status !== 'drafted') return 1;

    // Among drafted players, higher bids come first
    if (a.status === 'drafted' && b.status === 'drafted') {
      const bidA = a.winningBid ?? 0;
      const bidB = b.winningBid ?? 0;
      return bidB - bidA; // Higher bid first
    }

    // Among available players, keep original order
    return 0;
  });

  // Track which projection players have been matched to prevent double-matching
  const usedProjectionIds = new Set<string>();

  for (const scraped of sortedPlayers) {
    const { player, confidence } = matchPlayer(scraped, projections);

    if (player && confidence !== 'unmatched') {
      // Check if this projection player was already matched
      if (usedProjectionIds.has(player.id)) {
        logger.warn({
          scrapedPlayer: scraped.fullName,
          matchedPlayer: player.name,
          playerId: player.id,
        }, 'Duplicate match attempt to already-used projection player');
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

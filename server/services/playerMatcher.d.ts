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
export declare function normalizeName(name: string): string;
/**
 * Normalizes team abbreviations to a consistent format
 */
export declare function normalizeTeam(team: string): string;
/**
 * Attempts to match a scraped player from Couch Managers to a projection player.
 * Uses normalized name matching with team as a tiebreaker.
 */
export declare function matchPlayer(scrapedPlayer: ScrapedPlayer, projections: ProjectionPlayer[]): {
    player: ProjectionPlayer | null;
    confidence: 'exact' | 'partial' | 'unmatched';
};
/**
 * Matches all scraped players against projections and returns matched results.
 */
export declare function matchAllPlayers(scrapedPlayers: ScrapedPlayer[], projections: ProjectionPlayer[]): {
    matched: MatchedPlayer[];
    unmatched: ScrapedPlayer[];
};
export {};

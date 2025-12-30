/**
 * Dynasty Rankings Scraper Service
 * Fetches crowd-sourced dynasty rankings from Harry Knows Ball
 *
 * Data source: https://harryknowsball.com/rankings
 * The data is embedded as JSON in the page's __NEXT_DATA__ script tag
 */
import type { DynastyRanking } from '../types/projections';
/**
 * Fetch dynasty rankings with caching
 */
export declare function getDynastyRankings(): Promise<DynastyRanking[]>;
/**
 * Force refresh of dynasty rankings cache
 */
export declare function refreshDynastyRankings(): Promise<DynastyRanking[]>;
/**
 * Get cache status for dynasty rankings
 */
export declare function getDynastyRankingsCacheStatus(): {
    isCached: boolean;
    fetchedAt: string | null;
    expiresAt: string | null;
    playerCount: number;
};
/**
 * Match dynasty rankings to projections by name
 * Returns a map of projection externalId -> DynastyRanking
 */
export declare function matchDynastyRankingsToProjections(rankings: DynastyRanking[], projections: Array<{
    externalId: string;
    name: string;
    team: string;
}>): Map<string, DynastyRanking>;

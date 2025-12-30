/**
 * Value Calculator Service
 * Calculates auction dollar values based on league settings and projections
 *
 * Key principle: Only players in the draftable pool get auction values.
 * Players outside the pool = $0 until they appear on the auction block.
 */
import type { NormalizedProjection, CalculatedValuesResult, DynastyRanking } from '../types/projections';
import type { LeagueSettings } from '../../src/lib/types';
/**
 * Main entry point for calculating auction values
 * Supports both redraft (single season) and dynasty (multi-year) leagues
 */
export declare function calculateAuctionValues(projections: NormalizedProjection[], settings: LeagueSettings, dynastyRankings?: DynastyRanking[]): CalculatedValuesResult;

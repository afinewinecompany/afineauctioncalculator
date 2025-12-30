/**
 * Projections Service
 * Fetches player projections from FanGraphs and normalizes them to internal format
 */
import type { NormalizedProjection } from '../types/projections';
/**
 * Fetches Steamer projections for both hitters and pitchers from FanGraphs
 */
export declare function fetchSteamerProjections(): Promise<NormalizedProjection[]>;
/**
 * Gets the primary position for a player (first position in list)
 */
export declare function getPrimaryPosition(player: NormalizedProjection): string;
/**
 * Checks if a player is eligible for a given position
 */
export declare function isEligibleForPosition(player: NormalizedProjection, position: string): boolean;

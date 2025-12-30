/**
 * JA Projections Service
 * Fetches player projections from JA Projections Google Sheet and normalizes them to internal format
 */
import type { NormalizedProjection } from '../types/projections';
/**
 * Fetches JA Projections for both hitters and pitchers
 */
export declare function fetchJAProjections(): Promise<NormalizedProjection[]>;

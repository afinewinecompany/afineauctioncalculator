/**
 * Projections Cache Service
 * File-based caching for projection data with 24-hour TTL
 */
import type { NormalizedProjection, ProjectionCacheEntry, ProjectionCacheMetadata } from '../types/projections';
/**
 * Retrieves cached projections if available and not expired
 */
export declare function getCachedProjections(system: string): Promise<ProjectionCacheEntry | null>;
/**
 * Stores projections in cache
 */
export declare function setCachedProjections(system: string, projections: NormalizedProjection[]): Promise<void>;
/**
 * Invalidates (deletes) cached projections for a system
 */
export declare function invalidateCache(system: string): Promise<void>;
/**
 * Gets cache status for a projection system
 */
export declare function getCacheStatus(system: string): Promise<{
    exists: boolean;
    expired: boolean;
    metadata: ProjectionCacheMetadata | null;
}>;
/**
 * Lists all cached projection systems
 */
export declare function listCachedSystems(): Promise<string[]>;

/**
 * Centralized Error Codes
 *
 * Machine-readable error codes for:
 * - Client error handling
 * - Error tracking/monitoring
 * - Support/debugging
 * - I18n error messages
 *
 * Naming Convention: {DOMAIN}_{NUMBER}
 * - AUTH: Authentication/Authorization
 * - USER: User management
 * - LEAGUE: League operations
 * - SYNC: External data synchronization
 * - PROJ: Projections/calculations
 * - VAL: Input validation
 * - DB: Database errors
 * - CACHE: Caching errors
 */

export const ErrorCodes = {
  // ==========================================================================
  // AUTHENTICATION & AUTHORIZATION (AUTH_xxx)
  // ==========================================================================
  AUTH_REQUIRED: 'AUTH_001',
  AUTH_INVALID_CREDENTIALS: 'AUTH_002',
  AUTH_TOKEN_EXPIRED: 'AUTH_003',
  AUTH_TOKEN_INVALID: 'AUTH_004',
  AUTH_TOKEN_MISSING: 'AUTH_005',
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH_006',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_007',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_008',
  AUTH_SESSION_EXPIRED: 'AUTH_009',
  AUTH_OAUTH_FAILED: 'AUTH_010',
  AUTH_OAUTH_STATE_MISMATCH: 'AUTH_011',

  // ==========================================================================
  // USER MANAGEMENT (USER_xxx)
  // ==========================================================================
  USER_NOT_FOUND: 'USER_001',
  USER_ALREADY_EXISTS: 'USER_002',
  USER_EMAIL_TAKEN: 'USER_003',
  USER_INVALID_EMAIL: 'USER_004',
  USER_WEAK_PASSWORD: 'USER_005',
  USER_ACCOUNT_LOCKED: 'USER_006',
  USER_EMAIL_NOT_VERIFIED: 'USER_007',
  USER_PROFILE_INCOMPLETE: 'USER_008',

  // ==========================================================================
  // LEAGUE MANAGEMENT (LEAGUE_xxx)
  // ==========================================================================
  LEAGUE_NOT_FOUND: 'LEAGUE_001',
  LEAGUE_ALREADY_EXISTS: 'LEAGUE_002',
  LEAGUE_ALREADY_MEMBER: 'LEAGUE_003',
  LEAGUE_NOT_MEMBER: 'LEAGUE_004',
  LEAGUE_UNAUTHORIZED: 'LEAGUE_005',
  LEAGUE_FULL: 'LEAGUE_006',
  LEAGUE_DRAFT_STARTED: 'LEAGUE_007',
  LEAGUE_DRAFT_ENDED: 'LEAGUE_008',
  LEAGUE_INVALID_SETTINGS: 'LEAGUE_009',
  LEAGUE_DELETION_FAILED: 'LEAGUE_010',

  // ==========================================================================
  // PLAYER MANAGEMENT (PLAYER_xxx)
  // ==========================================================================
  PLAYER_NOT_FOUND: 'PLAYER_001',
  PLAYER_ALREADY_DRAFTED: 'PLAYER_002',
  PLAYER_INVALID_POSITION: 'PLAYER_003',
  PLAYER_MATCH_FAILED: 'PLAYER_004',
  PLAYER_IMPORT_FAILED: 'PLAYER_005',

  // ==========================================================================
  // DRAFT MANAGEMENT (DRAFT_xxx)
  // ==========================================================================
  DRAFT_NOT_STARTED: 'DRAFT_001',
  DRAFT_ALREADY_STARTED: 'DRAFT_002',
  DRAFT_ENDED: 'DRAFT_003',
  DRAFT_INVALID_BID: 'DRAFT_004',
  DRAFT_INSUFFICIENT_BUDGET: 'DRAFT_005',
  DRAFT_INVALID_NOMINATION: 'DRAFT_006',
  DRAFT_ROSTER_FULL: 'DRAFT_007',
  DRAFT_POSITION_FULL: 'DRAFT_008',

  // ==========================================================================
  // EXTERNAL SYNC (SYNC_xxx)
  // ==========================================================================
  SYNC_COUCH_MANAGERS_UNAVAILABLE: 'SYNC_001',
  SYNC_COUCH_MANAGERS_TIMEOUT: 'SYNC_002',
  SYNC_COUCH_MANAGERS_PARSE_ERROR: 'SYNC_003',
  SYNC_ROOM_INVALID: 'SYNC_004',
  SYNC_ROOM_NOT_FOUND: 'SYNC_005',
  SYNC_ROOM_PRIVATE: 'SYNC_006',
  SYNC_HARRY_KNOWS_BALL_UNAVAILABLE: 'SYNC_007',
  SYNC_FANGRAPHS_UNAVAILABLE: 'SYNC_008',
  SYNC_GOOGLE_SHEETS_UNAVAILABLE: 'SYNC_009',
  SYNC_RATE_LIMITED: 'SYNC_010',

  // ==========================================================================
  // PROJECTIONS & CALCULATIONS (PROJ_xxx)
  // ==========================================================================
  PROJ_SYSTEM_UNAVAILABLE: 'PROJ_001',
  PROJ_CALCULATION_FAILED: 'PROJ_002',
  PROJ_INVALID_SCORING: 'PROJ_003',
  PROJ_CACHE_MISS: 'PROJ_004',
  PROJ_CACHE_EXPIRED: 'PROJ_005',
  PROJ_INFLATION_FAILED: 'PROJ_006',
  PROJ_SGP_CALCULATION_FAILED: 'PROJ_007',
  PROJ_INSUFFICIENT_DATA: 'PROJ_008',
  PROJ_INVALID_YEAR: 'PROJ_009',

  // ==========================================================================
  // VALIDATION (VAL_xxx)
  // ==========================================================================
  VAL_INVALID_INPUT: 'VAL_001',
  VAL_MISSING_FIELD: 'VAL_002',
  VAL_INVALID_FORMAT: 'VAL_003',
  VAL_OUT_OF_RANGE: 'VAL_004',
  VAL_INVALID_TYPE: 'VAL_005',
  VAL_CONSTRAINT_VIOLATION: 'VAL_006',
  VAL_PARSE_ERROR: 'VAL_007',

  // ==========================================================================
  // DATABASE (DB_xxx)
  // ==========================================================================
  DB_CONNECTION_FAILED: 'DB_001',
  DB_QUERY_FAILED: 'DB_002',
  DB_TRANSACTION_FAILED: 'DB_003',
  DB_UNIQUE_CONSTRAINT: 'DB_004',
  DB_FOREIGN_KEY_CONSTRAINT: 'DB_005',
  DB_NOT_NULL_CONSTRAINT: 'DB_006',
  DB_RECORD_NOT_FOUND: 'DB_007',
  DB_TIMEOUT: 'DB_008',

  // ==========================================================================
  // CACHE (CACHE_xxx)
  // ==========================================================================
  CACHE_CONNECTION_FAILED: 'CACHE_001',
  CACHE_GET_FAILED: 'CACHE_002',
  CACHE_SET_FAILED: 'CACHE_003',
  CACHE_DELETE_FAILED: 'CACHE_004',
  CACHE_UNAVAILABLE: 'CACHE_005',

  // ==========================================================================
  // RATE LIMITING (RATE_xxx)
  // ==========================================================================
  RATE_LIMIT_EXCEEDED: 'RATE_001',
  RATE_LIMIT_AUTH_EXCEEDED: 'RATE_002',
  RATE_LIMIT_SCRAPING_EXCEEDED: 'RATE_003',

  // ==========================================================================
  // GENERAL (GEN_xxx)
  // ==========================================================================
  GEN_INTERNAL_ERROR: 'GEN_001',
  GEN_NOT_FOUND: 'GEN_002',
  GEN_BAD_REQUEST: 'GEN_003',
  GEN_FORBIDDEN: 'GEN_004',
  GEN_CONFLICT: 'GEN_005',
  GEN_SERVICE_UNAVAILABLE: 'GEN_006',
  GEN_TIMEOUT: 'GEN_007',
  GEN_METHOD_NOT_ALLOWED: 'GEN_008',
  GEN_UNSUPPORTED_MEDIA_TYPE: 'GEN_009',
} as const;

/**
 * Type for error codes
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Error code metadata for rich error information
 */
export interface ErrorCodeMetadata {
  code: ErrorCode;
  title: string;
  description: string;
  userMessage: string;
  retryable: boolean;
  category: 'auth' | 'user' | 'league' | 'sync' | 'proj' | 'val' | 'db' | 'cache' | 'rate' | 'general';
}

/**
 * Error code metadata mapping
 * Useful for client-side error display and handling
 */
export const ErrorCodeMetadata: Record<string, ErrorCodeMetadata> = {
  // Authentication
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: {
    code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    title: 'Invalid Credentials',
    description: 'The provided email or password is incorrect',
    userMessage: 'Invalid email or password. Please try again.',
    retryable: true,
    category: 'auth',
  },
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: {
    code: ErrorCodes.AUTH_TOKEN_EXPIRED,
    title: 'Session Expired',
    description: 'Your session has expired, please log in again',
    userMessage: 'Your session has expired. Please log in again.',
    retryable: true,
    category: 'auth',
  },

  // Sync errors
  [ErrorCodes.SYNC_COUCH_MANAGERS_UNAVAILABLE]: {
    code: ErrorCodes.SYNC_COUCH_MANAGERS_UNAVAILABLE,
    title: 'Couch Managers Unavailable',
    description: 'Unable to connect to Couch Managers for live draft sync',
    userMessage: 'Live draft sync is temporarily unavailable. Please try again in a few moments.',
    retryable: true,
    category: 'sync',
  },

  // Projections
  [ErrorCodes.PROJ_CALCULATION_FAILED]: {
    code: ErrorCodes.PROJ_CALCULATION_FAILED,
    title: 'Calculation Failed',
    description: 'Failed to calculate player values',
    userMessage: 'Unable to calculate player values. Please check your league settings and try again.',
    retryable: true,
    category: 'proj',
  },

  // Rate limiting
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    title: 'Too Many Requests',
    description: 'Rate limit exceeded',
    userMessage: 'You are making too many requests. Please wait a moment and try again.',
    retryable: true,
    category: 'rate',
  },
};

/**
 * Get metadata for an error code
 */
export function getErrorMetadata(code: ErrorCode): ErrorCodeMetadata | undefined {
  return ErrorCodeMetadata[code];
}

/**
 * Check if an error code is retryable
 */
export function isRetryable(code: ErrorCode): boolean {
  return ErrorCodeMetadata[code]?.retryable ?? false;
}

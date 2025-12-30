/**
 * Middleware Index
 *
 * Centralized exports for all security middleware
 */

// Rate limiting middleware
export {
  apiLimiter,
  authLimiter,
  scrapingLimiter,
  refreshLimiter,
} from './rateLimiter.js';

// Input sanitization middleware
export {
  sanitizeBody,
  sanitizeQuery,
  sanitizeAll,
  sanitizeString,
  sanitizeLeagueName,
  sanitizeTeamName,
} from './sanitize.js';

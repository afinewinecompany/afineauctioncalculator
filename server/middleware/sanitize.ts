/**
 * Input Sanitization Middleware
 *
 * Sanitizes user-generated content to prevent XSS attacks.
 * Works alongside Zod validation for comprehensive input security.
 */

import type { Request, Response, NextFunction } from 'express';

// Type for xss package (dynamically imported)
type XssFilter = (input: string) => string;

// Cache for the xss filter function
let xssFilter: XssFilter | null = null;

/**
 * Get or initialize the XSS filter
 * Uses dynamic import to handle the xss package
 */
async function getXssFilter(): Promise<XssFilter> {
  if (xssFilter) {
    return xssFilter;
  }

  try {
    // Dynamic import for xss package
    const xss = await import('xss');
    xssFilter = xss.default || xss;
    return xssFilter as XssFilter;
  } catch (error) {
    // Fallback: basic HTML entity encoding if xss package not available
    console.warn('[Sanitize] xss package not available, using fallback sanitization');
    xssFilter = (input: string): string => {
      return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    };
    return xssFilter;
  }
}

/**
 * Recursively sanitizes string values in an object
 */
async function sanitizeObject(obj: unknown, filter: XssFilter): Promise<unknown> {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return filter(obj);
  }

  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => sanitizeObject(item, filter)));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = await sanitizeObject(value, filter);
    }
    return sanitized;
  }

  // Numbers, booleans, etc. pass through unchanged
  return obj;
}

/**
 * Fields that should be sanitized (user-generated content)
 * These are the fields most likely to contain malicious input
 */
const SANITIZE_FIELDS = new Set([
  'leagueName',
  'teamName',
  'name',
  'username',
  'displayName',
  'description',
  'notes',
  'comment',
  'message',
  'title',
]);

/**
 * Middleware to sanitize specific fields in request body
 * Only sanitizes known user-input fields to preserve data integrity
 */
export async function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    const filter = await getXssFilter();

    // Only sanitize known user-input fields
    for (const key of Object.keys(req.body)) {
      if (SANITIZE_FIELDS.has(key) && typeof req.body[key] === 'string') {
        req.body[key] = filter(req.body[key]);
      }
    }

    // Also check nested leagueSettings if present
    if (req.body.leagueSettings && typeof req.body.leagueSettings === 'object') {
      for (const key of Object.keys(req.body.leagueSettings)) {
        if (SANITIZE_FIELDS.has(key) && typeof req.body.leagueSettings[key] === 'string') {
          req.body.leagueSettings[key] = filter(req.body.leagueSettings[key]);
        }
      }
    }

    // Check nested leagueConfig if present
    if (req.body.leagueConfig && typeof req.body.leagueConfig === 'object') {
      for (const key of Object.keys(req.body.leagueConfig)) {
        if (SANITIZE_FIELDS.has(key) && typeof req.body.leagueConfig[key] === 'string') {
          req.body.leagueConfig[key] = filter(req.body.leagueConfig[key]);
        }
      }
    }

    next();
  } catch (error) {
    console.error('[Sanitize] Error sanitizing request body:', error);
    // Don't block request on sanitization error, but log it
    next();
  }
}

/**
 * Sanitize a single string value
 * Can be used directly in route handlers
 */
export async function sanitizeString(input: string): Promise<string> {
  const filter = await getXssFilter();
  return filter(input);
}

/**
 * Sanitize query parameters
 * Useful for search queries and other user-provided params
 */
export async function sanitizeQuery(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.query || typeof req.query !== 'object') {
      return next();
    }

    const filter = await getXssFilter();

    // Sanitize all string query parameters
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === 'string') {
        req.query[key] = filter(value);
      }
    }

    next();
  } catch (error) {
    console.error('[Sanitize] Error sanitizing query params:', error);
    next();
  }
}

/**
 * Full sanitization middleware that sanitizes both body and query
 */
export async function sanitizeAll(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await sanitizeBody(req, res, () => {});
  await sanitizeQuery(req, res, next);
}

/**
 * Helper to validate and sanitize a league name
 */
export async function sanitizeLeagueName(name: string): Promise<string> {
  // Remove any HTML/script tags
  const sanitized = await sanitizeString(name);

  // Additional validation: limit length and remove special characters
  return sanitized
    .slice(0, 100) // Max 100 characters
    .replace(/[<>{}]/g, ''); // Extra safety: remove brackets
}

/**
 * Helper to validate and sanitize a team name
 */
export async function sanitizeTeamName(name: string): Promise<string> {
  const sanitized = await sanitizeString(name);

  return sanitized
    .slice(0, 50) // Max 50 characters
    .replace(/[<>{}]/g, '');
}

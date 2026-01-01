/**
 * Error Reporting Routes
 *
 * Public endpoint for frontend error reporting.
 * Captures client-side errors for admin dashboard diagnostics.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { logger } from '../services/logger.js';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const reportErrorSchema = z.object({
  errorMessage: z.string().min(1).max(5000),
  errorCode: z.string().max(50).optional(),
  stackTrace: z.string().max(50000).optional(),
  source: z.enum(['frontend', 'backend']).default('frontend'),
  severity: z.enum(['error', 'warning', 'info']).default('error'),
  context: z
    .object({
      component: z.string().optional(),
      action: z.string().optional(),
      url: z.string().optional(),
      userAgent: z.string().optional(),
      screenSize: z.string().optional(),
      timestamp: z.string().optional(),
      additionalData: z.record(z.unknown()).optional(),
    })
    .optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/errors
 * Report a frontend error
 *
 * Uses optionalAuth to capture user info if available,
 * but allows unauthenticated error reports.
 */
router.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = reportErrorSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid error report',
        details: validation.error.errors,
      });
      return;
    }

    const { errorMessage, errorCode, stackTrace, source, severity, context } = validation.data;

    // Enhance context with request info
    // Cast to Prisma.JsonObject to satisfy the type checker
    const enhancedContext: Prisma.JsonObject = {
      ...(context?.component ? { component: context.component } : {}),
      ...(context?.action ? { action: context.action } : {}),
      ...(context?.url ? { url: context.url } : {}),
      ...(context?.screenSize ? { screenSize: context.screenSize } : {}),
      ...(context?.additionalData ? { additionalData: context.additionalData as Prisma.JsonValue } : {}),
      // Add request metadata
      ip: req.ip || req.socket.remoteAddress || null,
      userAgent: (context?.userAgent || req.headers['user-agent']) ?? null,
      referer: req.headers.referer ?? null,
      // Add timestamp if not provided
      timestamp: context?.timestamp || new Date().toISOString(),
    };

    // Create error log
    const errorLog = await prisma.errorLog.create({
      data: {
        userId: req.user?.id || null,
        errorCode,
        errorMessage,
        stackTrace,
        source,
        severity,
        context: enhancedContext,
      },
    });

    // Log for server-side monitoring
    logger.warn(
      {
        errorLogId: errorLog.id,
        userId: req.user?.id,
        errorCode,
        errorMessage: errorMessage.substring(0, 200), // Truncate for log
        source,
        severity,
        component: context?.component,
        url: context?.url,
      },
      'Frontend error reported'
    );

    res.status(201).json({
      success: true,
      errorId: errorLog.id,
    });
  } catch (error) {
    // Don't fail loudly for error reporting - just log and return success
    // We don't want error reporting to cause more errors
    logger.error({ error }, 'Failed to save error report');

    // Still return success to prevent client-side retries
    res.status(201).json({
      success: true,
      errorId: null,
      note: 'Error logged locally',
    });
  }
});

/**
 * POST /api/errors/batch
 * Report multiple errors at once (for batched error reporting)
 */
router.post('/batch', optionalAuth, async (req: Request, res: Response) => {
  try {
    const errorsArray = z.array(reportErrorSchema).safeParse(req.body.errors);
    if (!errorsArray.success) {
      res.status(400).json({
        error: 'Invalid error batch',
        details: errorsArray.error.errors,
      });
      return;
    }

    const errors = errorsArray.data;

    // Limit batch size
    if (errors.length > 10) {
      res.status(400).json({
        error: 'Batch too large',
        message: 'Maximum 10 errors per batch',
      });
      return;
    }

    // Create all error logs
    const created = await prisma.errorLog.createMany({
      data: errors.map((error) => {
        const ctx = error.context;
        const contextObj: Prisma.JsonObject = {
          ...(ctx?.component ? { component: ctx.component } : {}),
          ...(ctx?.action ? { action: ctx.action } : {}),
          ...(ctx?.url ? { url: ctx.url } : {}),
          ...(ctx?.screenSize ? { screenSize: ctx.screenSize } : {}),
          ...(ctx?.additionalData ? { additionalData: ctx.additionalData as Prisma.JsonValue } : {}),
          ip: req.ip || req.socket.remoteAddress || null,
          userAgent: (ctx?.userAgent || req.headers['user-agent']) ?? null,
          timestamp: ctx?.timestamp || new Date().toISOString(),
        };
        return {
          userId: req.user?.id || null,
          errorCode: error.errorCode,
          errorMessage: error.errorMessage,
          stackTrace: error.stackTrace,
          source: error.source,
          severity: error.severity,
          context: contextObj,
        };
      }),
    });

    logger.info(
      {
        userId: req.user?.id,
        count: created.count,
      },
      'Batch error report received'
    );

    res.status(201).json({
      success: true,
      count: created.count,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to save batch error report');
    res.status(201).json({
      success: true,
      count: 0,
      note: 'Errors logged locally',
    });
  }
});

export default router;

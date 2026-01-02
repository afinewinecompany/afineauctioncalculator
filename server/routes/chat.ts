/**
 * Chat API Routes
 *
 * Handles chat requests to the LLM-powered draft assistant.
 * Uses Groq's Llama 3.1 8B Instant model for fast, cost-effective responses.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../services/logger.js';
import { getChatResponse, isChatServiceAvailable } from '../services/chatService.js';
import { buildDraftContext, DraftContext } from '../services/chatContextBuilder.js';

const router = Router();

// Request validation schema
const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(20, 'Conversation history too long')
    .optional()
    .default([]),
  draftContext: z.object({
    myRoster: z
      .array(
        z.object({
          name: z.string(),
          positions: z.array(z.string()),
          draftedPrice: z.number(),
        })
      )
      .optional(),
    moneyRemaining: z.number().optional(),
    rosterNeedsRemaining: z.record(z.number()).optional(),
    inflationRate: z.number().optional(),
    topAvailablePlayers: z
      .array(
        z.object({
          name: z.string(),
          positions: z.array(z.string()),
          adjustedValue: z.number(),
          tier: z.number().optional(),
        })
      )
      .max(20)
      .optional(),
    currentAuction: z
      .object({
        playerName: z.string(),
        currentBid: z.number(),
        adjustedValue: z.number().optional(),
      })
      .optional(),
    positionalScarcity: z
      .array(
        z.object({
          position: z.string(),
          scarcityLevel: z.string(),
        })
      )
      .optional(),
  }),
});

/**
 * GET /api/chat/status
 * Check if chat service is available
 */
router.get('/status', (_req: Request, res: Response) => {
  const available = isChatServiceAvailable();
  res.json({
    available,
    model: available ? 'llama-3.1-8b-instant' : null,
  });
});

/**
 * POST /api/chat
 * Send a message to the draft assistant
 */
router.post('/', async (req: Request, res: Response) => {
  // Check if service is available
  if (!isChatServiceAvailable()) {
    return res.status(503).json({
      error: 'Chat assistant is not available',
      message: 'The chat assistant is not configured on this server.',
    });
  }

  // Validate request body
  const result = ChatRequestSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { message, conversationHistory, draftContext } = result.data;

  try {
    // Build system prompt from draft context
    const systemPrompt = buildDraftContext(draftContext as DraftContext);

    // Get response from LLM
    const response = await getChatResponse(message, systemPrompt, conversationHistory);

    res.json({
      message: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log the error
    logger.error({ error, userMessage: message.substring(0, 100) }, 'Chat request failed');

    // Handle specific error types
    if (errorMessage.includes('Rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: errorMessage,
        retryAfter: 60,
      });
    }

    if (errorMessage.includes('API key')) {
      return res.status(503).json({
        error: 'Service configuration error',
        message: 'The chat assistant is misconfigured.',
      });
    }

    res.status(500).json({
      error: 'Failed to get response',
      message: errorMessage,
    });
  }
});

export default router;

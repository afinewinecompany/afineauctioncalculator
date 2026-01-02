/**
 * Notifications API Routes
 *
 * Handles SMS notification preferences and team selection for users.
 * Allows users to:
 * - Set their phone number
 * - Select which team they're watching in a room
 * - Enable/disable SMS notifications
 * - Send test SMS messages
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { logger } from '../services/logger.js';
import {
  sendNotificationSMS,
  isSMSServiceAvailable,
  NotificationMessages,
} from '../services/smsService.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Validation schemas
const PhoneUpdateSchema = z.object({
  phoneNumber: z.string().min(10).max(20).regex(/^[\d\s\-\+\(\)]+$/, {
    message: 'Phone number can only contain digits, spaces, dashes, plus, and parentheses',
  }),
});

const TeamSelectSchema = z.object({
  teamName: z.string().min(1).max(100),
  roomId: z.string().min(1).max(10).regex(/^\d+$/, {
    message: 'Room ID must be numeric',
  }),
});

const PreferencesSchema = z.object({
  smsNotificationsEnabled: z.boolean(),
});

/**
 * GET /api/notifications/settings
 * Get current notification settings for the authenticated user
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phoneNumber: true,
        selectedTeamName: true,
        selectedRoomId: true,
        smsNotificationsEnabled: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const smsAvailable = await isSMSServiceAvailable();

    res.json({
      phoneNumber: user.phoneNumber,
      selectedTeamName: user.selectedTeamName,
      selectedRoomId: user.selectedRoomId,
      smsNotificationsEnabled: user.smsNotificationsEnabled,
      smsServiceAvailable: smsAvailable,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching notification settings');
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

/**
 * PUT /api/notifications/phone
 * Update user's phone number
 */
router.put('/phone', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = PhoneUpdateSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid phone number',
        details: result.error.errors,
      });
    }

    const { phoneNumber } = result.data;

    await prisma.user.update({
      where: { id: userId },
      data: { phoneNumber },
    });

    logger.info({ userId }, 'Phone number updated');

    res.json({
      success: true,
      message: 'Phone number updated successfully',
      phoneNumber,
    });
  } catch (error) {
    logger.error({ error }, 'Error updating phone number');
    res.status(500).json({ error: 'Failed to update phone number' });
  }
});

/**
 * DELETE /api/notifications/phone
 * Remove user's phone number
 */
router.delete('/phone', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber: null,
        smsNotificationsEnabled: false, // Disable SMS when phone removed
      },
    });

    logger.info({ userId }, 'Phone number removed');

    res.json({
      success: true,
      message: 'Phone number removed successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Error removing phone number');
    res.status(500).json({ error: 'Failed to remove phone number' });
  }
});

/**
 * PUT /api/notifications/team
 * Select which team to watch for notifications
 */
router.put('/team', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = TeamSelectSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid team selection',
        details: result.error.errors,
      });
    }

    const { teamName, roomId } = result.data;

    await prisma.user.update({
      where: { id: userId },
      data: {
        selectedTeamName: teamName,
        selectedRoomId: roomId,
      },
    });

    logger.info({ userId, teamName, roomId }, 'Team selection updated');

    res.json({
      success: true,
      message: 'Team selection updated successfully',
      teamName,
      roomId,
    });
  } catch (error) {
    logger.error({ error }, 'Error updating team selection');
    res.status(500).json({ error: 'Failed to update team selection' });
  }
});

/**
 * DELETE /api/notifications/team
 * Clear team selection
 */
router.delete('/team', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        selectedTeamName: null,
        selectedRoomId: null,
      },
    });

    logger.info({ userId }, 'Team selection cleared');

    res.json({
      success: true,
      message: 'Team selection cleared successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Error clearing team selection');
    res.status(500).json({ error: 'Failed to clear team selection' });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences (enable/disable SMS)
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = PreferencesSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid preferences',
        details: result.error.errors,
      });
    }

    const { smsNotificationsEnabled } = result.data;

    // Check if user has phone number before enabling
    if (smsNotificationsEnabled) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phoneNumber: true },
      });

      if (!user?.phoneNumber) {
        return res.status(400).json({
          error: 'Phone number required',
          message: 'Please add a phone number before enabling SMS notifications',
        });
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { smsNotificationsEnabled },
    });

    logger.info({ userId, smsNotificationsEnabled }, 'Notification preferences updated');

    res.json({
      success: true,
      message: `SMS notifications ${smsNotificationsEnabled ? 'enabled' : 'disabled'}`,
      smsNotificationsEnabled,
    });
  } catch (error) {
    logger.error({ error }, 'Error updating notification preferences');
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

/**
 * POST /api/notifications/test
 * Send a test SMS to verify the user's phone number works
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true },
    });

    if (!user?.phoneNumber) {
      return res.status(400).json({
        error: 'No phone number',
        message: 'Please add a phone number first',
      });
    }

    const smsAvailable = await isSMSServiceAvailable();
    if (!smsAvailable) {
      return res.status(503).json({
        error: 'SMS service unavailable',
        message: 'SMS service is not configured on this server',
      });
    }

    const success = await sendNotificationSMS(
      userId,
      user.phoneNumber,
      'player_bid', // Using player_bid type for test
      NotificationMessages.test(),
      { test: true }
    );

    if (success) {
      res.json({
        success: true,
        message: 'Test SMS sent successfully',
      });
    } else {
      res.status(500).json({
        error: 'Failed to send SMS',
        message: 'The SMS could not be delivered. Please check your phone number.',
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error sending test SMS');
    res.status(500).json({ error: 'Failed to send test SMS' });
  }
});

/**
 * GET /api/notifications/history
 * Get notification history for the authenticated user
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const notifications = await prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });

    res.json({
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching notification history');
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

/**
 * GET /api/notifications/status
 * Check if SMS service is available (public health check)
 */
router.get('/status', async (_req: Request, res: Response) => {
  const available = await isSMSServiceAvailable();
  res.json({
    smsServiceAvailable: available,
    provider: available ? 'twilio' : null,
  });
});

export default router;

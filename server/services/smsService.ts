/**
 * SMS Service - Twilio Integration
 *
 * Handles sending SMS notifications for auction events.
 * Uses Twilio as the SMS provider ($0.0079/message).
 */

import { logger } from './logger.js';
import { prisma } from '../db.js';
import { env } from '../config/env.js';
import { Prisma } from '@prisma/client';

// Twilio client - dynamically imported to avoid errors if not configured
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let twilioClient: any = null;

/**
 * Initialize Twilio client if credentials are configured
 */
async function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not configured - SMS notifications disabled');
    return null;
  }

  try {
    const twilio = await import('twilio');
    twilioClient = twilio.default(accountSid, authToken);
    logger.info('Twilio SMS client initialized');
    return twilioClient;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Twilio client');
    return null;
  }
}

/**
 * Format phone number to E.164 format (required by Twilio)
 * Assumes US numbers if no country code provided
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it starts with 1 and has 11 digits, it's already US format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it already has + prefix, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Otherwise, assume it's a full international number
  return `+${digits}`;
}

/**
 * Send an SMS message
 *
 * @param to - Recipient phone number
 * @param message - Message content
 * @returns true if sent successfully, false otherwise
 */
export async function sendSMS(to: string, message: string): Promise<boolean> {
  const client = await getTwilioClient();

  if (!client) {
    logger.warn({ to }, 'SMS not sent - Twilio not configured');
    return false;
  }

  // Use Messaging Service SID (preferred) or direct phone number
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!messagingServiceSid && !fromNumber) {
    logger.error('Neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_PHONE_NUMBER configured');
    return false;
  }

  try {
    const formattedTo = formatPhoneNumber(to);

    // Use messagingServiceSid if available (handles number selection automatically)
    // Otherwise fall back to direct phone number
    const messageOptions: { body: string; to: string; messagingServiceSid?: string; from?: string } = {
      body: message,
      to: formattedTo,
    };

    if (messagingServiceSid) {
      messageOptions.messagingServiceSid = messagingServiceSid;
    } else {
      messageOptions.from = fromNumber;
    }

    await client.messages.create(messageOptions);

    logger.info({ to: formattedTo }, 'SMS sent successfully');
    return true;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send SMS');
    return false;
  }
}

/**
 * Send notification and log it to database
 */
export async function sendNotificationSMS(
  userId: string,
  phoneNumber: string,
  type: 'player_bid' | 'outbid',
  message: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const success = await sendSMS(phoneNumber, message);

  // Log notification attempt
  try {
    await prisma.notificationLog.create({
      data: {
        userId,
        type,
        message,
        status: success ? 'sent' : 'failed',
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (error) {
    logger.error({ error, userId, type }, 'Failed to log notification');
  }

  return success;
}

/**
 * Get users subscribed to notifications for a specific room
 */
export async function getSubscribedUsers(roomId: string) {
  return prisma.user.findMany({
    where: {
      selectedRoomId: roomId,
      smsNotificationsEnabled: true,
      phoneNumber: { not: null },
    },
    select: {
      id: true,
      phoneNumber: true,
      selectedTeamName: true,
    },
  });
}

/**
 * Check if SMS service is configured and available
 */
export async function isSMSServiceAvailable(): Promise<boolean> {
  const client = await getTwilioClient();
  const hasMessagingService = !!process.env.TWILIO_MESSAGING_SERVICE_SID;
  const hasPhoneNumber = !!process.env.TWILIO_PHONE_NUMBER;
  return client !== null && (hasMessagingService || hasPhoneNumber);
}

/**
 * Notification message templates
 */
export const NotificationMessages = {
  /**
   * Message when a player on the user's team is bid on
   */
  playerBid: (teamName: string, playerName: string, currentBid: number, appUrl?: string): string => {
    let message = `${teamName} has bid on ${playerName}! Current Bid: $${currentBid}`;
    if (appUrl) {
      message += `\n${appUrl}`;
    }
    return message;
  },

  /**
   * Message when user is outbid
   */
  outbid: (teamName: string, playerName: string, currentBid: number, appUrl?: string): string => {
    let message = `OUTBID - ${teamName} outbid you on ${playerName}! Current Bid: $${currentBid}`;
    if (appUrl) {
      message += `\n${appUrl}`;
    }
    return message;
  },

  /**
   * Test message to verify SMS is working
   */
  test: (): string => {
    return 'Test notification from A Fine Auction Calculator. SMS is working!';
  },
};

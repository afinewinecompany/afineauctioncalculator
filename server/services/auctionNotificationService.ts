/**
 * Auction Notification Service
 *
 * Detects bid changes and sends SMS notifications to subscribed users.
 * Integrates with auction sync to track:
 * 1. When a player on the user's team is bid on
 * 2. When the user is outbid
 */

import { logger } from './logger.js';
import {
  getSubscribedUsers,
  sendNotificationSMS,
  NotificationMessages,
} from './smsService.js';
import type { ScrapedAuctionData, CurrentAuction } from '../types/auction.js';
import { env } from '../config/env.js';

// In-memory cache of previous auction state per room
// Used to detect changes between syncs
const previousAuctionState = new Map<string, {
  currentAuction: CurrentAuction | null;
  activeAuctions: CurrentAuction[];
  timestamp: number;
}>();

// Cache expiration (10 minutes - longer than sync interval)
const CACHE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Clean up old cached states
 */
function cleanupOldStates() {
  const now = Date.now();
  for (const [roomId, state] of previousAuctionState.entries()) {
    if (now - state.timestamp > CACHE_EXPIRY_MS) {
      previousAuctionState.delete(roomId);
    }
  }
}

/**
 * Check for bid changes and send notifications
 *
 * Called after each auction sync to detect:
 * 1. New bids on players that belong to subscribed users' teams
 * 2. Outbid scenarios where a user was the previous high bidder
 *
 * @param roomId - The Couch Managers room ID
 * @param newData - The newly scraped auction data
 */
export async function checkAndSendNotifications(
  roomId: string,
  newData: ScrapedAuctionData
): Promise<void> {
  try {
    // Get previous state for this room
    const previousState = previousAuctionState.get(roomId);

    // Get all active auctions (players on block)
    const newActiveAuctions = newData.activeAuctions || [];
    const currentAuction = newData.currentAuction;

    // If this is the first sync for this room, just cache and return
    if (!previousState) {
      previousAuctionState.set(roomId, {
        currentAuction: currentAuction || null,
        activeAuctions: newActiveAuctions,
        timestamp: Date.now(),
      });
      logger.debug({ roomId }, 'First sync for room, caching state');
      return;
    }

    // Get subscribed users for this room
    const subscribers = await getSubscribedUsers(roomId);

    if (subscribers.length === 0) {
      // No subscribers, just update cache
      previousAuctionState.set(roomId, {
        currentAuction: currentAuction || null,
        activeAuctions: newActiveAuctions,
        timestamp: Date.now(),
      });
      return;
    }

    logger.debug({ roomId, subscriberCount: subscribers.length }, 'Checking notifications for subscribers');

    // Build map of previous auctions for quick lookup
    const previousAuctionsMap = new Map<number, CurrentAuction>();
    if (previousState.currentAuction) {
      previousAuctionsMap.set(previousState.currentAuction.playerId, previousState.currentAuction);
    }
    for (const auction of previousState.activeAuctions) {
      previousAuctionsMap.set(auction.playerId, auction);
    }

    // Check each active auction for changes
    const allCurrentAuctions = currentAuction
      ? [currentAuction, ...newActiveAuctions.filter(a => a.playerId !== currentAuction.playerId)]
      : newActiveAuctions;

    for (const auction of allCurrentAuctions) {
      const previousAuction = previousAuctionsMap.get(auction.playerId);

      // Check each subscriber
      for (const subscriber of subscribers) {
        if (!subscriber.phoneNumber || !subscriber.selectedTeamName) continue;

        // Case 1: Player on user's team is being bid on (new bid detected)
        if (previousAuction) {
          // There was a previous bid - check if bid amount changed
          if (auction.currentBid > previousAuction.currentBid) {
            // New bid placed!

            // Case 2: User was outbid
            if (previousAuction.currentBidder === subscriber.selectedTeamName &&
                auction.currentBidder !== subscriber.selectedTeamName) {
              // User was the previous bidder but is no longer
              const message = NotificationMessages.outbid(
                auction.currentBidder,
                auction.playerName,
                auction.currentBid,
                env.FRONTEND_URL
              );

              await sendNotificationSMS(
                subscriber.id,
                subscriber.phoneNumber,
                'outbid',
                message,
                {
                  playerId: auction.playerId,
                  playerName: auction.playerName,
                  previousBid: previousAuction.currentBid,
                  newBid: auction.currentBid,
                  newBidder: auction.currentBidder,
                  roomId,
                }
              );

              logger.info({
                userId: subscriber.id,
                playerName: auction.playerName,
                previousBid: previousAuction.currentBid,
                newBid: auction.currentBid,
              }, 'Sent outbid notification');
            }
            // Case 1b: Someone else bid on a player (not the user's own bid)
            // This notifies when any bid is placed on any player on block
            // Only notify if the bidder is NOT the subscribed user's team
            // and the new bidder is the user's team (they're now winning)
            else if (auction.currentBidder === subscriber.selectedTeamName &&
                     previousAuction.currentBidder !== subscriber.selectedTeamName) {
              // User's team just placed a bid - don't notify them of their own bid
              // This is intentional - we don't want to spam users when THEY bid
            }
          }
        } else {
          // New auction started (no previous state for this player)
          // Check if another team bid on a player
          // For now, we only notify on outbid scenarios, not every new auction
          // This prevents notification spam when auctions start
        }
      }
    }

    // Update cache with new state
    previousAuctionState.set(roomId, {
      currentAuction: currentAuction || null,
      activeAuctions: newActiveAuctions,
      timestamp: Date.now(),
    });

    // Periodic cleanup
    if (Math.random() < 0.1) {
      cleanupOldStates();
    }
  } catch (error) {
    logger.error({ error, roomId }, 'Error checking/sending notifications');
    // Don't throw - notifications are best-effort and shouldn't break sync
  }
}

/**
 * Clear cached state for a room
 * Useful when room is reset or user wants fresh state
 */
export function clearRoomState(roomId: string): void {
  previousAuctionState.delete(roomId);
}

/**
 * Get notification stats for debugging
 */
export function getNotificationStats(): {
  cachedRooms: number;
  oldestCacheMs: number | null;
} {
  let oldestTimestamp: number | null = null;

  for (const state of previousAuctionState.values()) {
    if (oldestTimestamp === null || state.timestamp < oldestTimestamp) {
      oldestTimestamp = state.timestamp;
    }
  }

  return {
    cachedRooms: previousAuctionState.size,
    oldestCacheMs: oldestTimestamp ? Date.now() - oldestTimestamp : null,
  };
}

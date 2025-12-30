import type { ScrapedAuctionData, ScrapedPlayer, CurrentAuction } from '../types/auction';
export declare function closeBrowser(): Promise<void>;
/**
 * Pre-warms the browser instance on server startup.
 * This saves ~2-5 seconds on the first scrape request.
 */
export declare function prewarmBrowser(): Promise<void>;
/**
 * Scrapes auction data from Couch Managers for a given room ID.
 *
 * The page uses JavaScript arrays:
 * - playerArray[id] = new Player(id, firstname, lastname, pos1, pos2, pos3, pos4, team, stat1-5, drafted, open, queued, ...)
 * - auctionArray contains current auction info: playerid, teamname, amount, time, sold
 * - passed_array contains IDs of passed players
 */
export declare function scrapeAuction(roomId: string): Promise<ScrapedAuctionData>;
/**
 * Scrapes only the drafted players and current auction info (lighter weight).
 * Useful for frequent polling.
 */
export declare function scrapeDraftedPlayers(roomId: string): Promise<{
    draftedPlayers: ScrapedPlayer[];
    currentAuction?: CurrentAuction;
    totalMoneySpent: number;
}>;

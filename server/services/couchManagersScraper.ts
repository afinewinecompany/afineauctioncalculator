import puppeteer, { Browser, Page } from 'puppeteer';
import type { ScrapedAuctionData, ScrapedPlayer, ScrapedTeam, CurrentAuction } from '../types/auction';
import { normalizeName } from './playerMatcher';

// Browser instance for reuse
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Scrapes auction data from Couch Managers for a given room ID.
 *
 * The page uses JavaScript arrays:
 * - playerArray[id] = new Player(id, firstname, lastname, pos1, pos2, pos3, pos4, team, stat1-5, drafted, open, queued, ...)
 * - auctionArray contains current auction info: playerid, teamname, amount, time, sold
 * - passed_array contains IDs of passed players
 */
export async function scrapeAuction(roomId: string): Promise<ScrapedAuctionData> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to the auction page
    const url = `https://www.couchmanagers.com/auctions/?auction_id=${roomId}`;
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    if (!response || response.status() === 404) {
      return {
        roomId,
        scrapedAt: new Date().toISOString(),
        status: 'not_found',
        players: [],
        teams: [],
        totalPlayersDrafted: 0,
        totalMoneySpent: 0,
      };
    }

    // Wait for the playerArray to be populated
    await page.waitForFunction(
      () => typeof (window as any).playerArray !== 'undefined' && Object.keys((window as any).playerArray).length > 0,
      { timeout: 15000 }
    );

    // Extract all data from the page
    const scrapedData = await page.evaluate(() => {
      const win = window as any;

      // Extract players from playerArray
      const players: ScrapedPlayer[] = [];
      const playerArray = win.playerArray || {};
      const passedArray = win.passed_array || [];
      const auctionArray = win.auctionArray || {};

      // Find currently active auctions (players on the block)
      const activeAuctionPlayerIds = new Set<number>();
      for (const key of Object.keys(auctionArray)) {
        const auction = auctionArray[key];
        if (auction && auction.playerid) {
          activeAuctionPlayerIds.add(auction.playerid);
        }
      }

      for (const id of Object.keys(playerArray)) {
        const p = playerArray[id];
        if (!p) continue;

        // Player constructor params based on CM code:
        // id, firstname, lastname, pos1, pos2, pos3, pos4, team, stat1, stat2, stat3, stat4, stat5, drafted, open, queued, ...
        const firstName = p.firstname || p[1] || '';
        const lastName = p.lastname || p[2] || '';
        const positions = [p.position1 || p[3], p.position2 || p[4], p.position3 || p[5], p.position4 || p[6]]
          .filter((pos: string) => pos && pos !== '');
        const mlbTeam = p.team || p[7] || '';
        const isDrafted = p.drafted === true || p.drafted === 1 || p.drafted === '1';
        const isOpen = p.open === 1 || p.open === '1' || activeAuctionPlayerIds.has(Number(id));
        const isPassed = passedArray.includes(Number(id));

        // Determine status
        let status: 'available' | 'drafted' | 'on_block' | 'passed';
        if (isDrafted) {
          status = 'drafted';
        } else if (isOpen) {
          status = 'on_block';
        } else if (isPassed) {
          status = 'passed';
        } else {
          status = 'available';
        }

        const fullName = `${firstName} ${lastName}`.trim();

        players.push({
          couchManagersId: Number(id),
          firstName,
          lastName,
          fullName,
          normalizedName: '', // Will be set server-side
          positions,
          mlbTeam,
          status,
          winningBid: isDrafted ? (Number(p.price) || Number(p.winningBid) || undefined) : undefined,
          winningTeam: isDrafted ? (p.teamname || p.winningTeam || p.team_name || undefined) : undefined,
          stats: {
            avg: p.stat1 || p[8],
            hr: Number(p.stat2 || p[9]) || undefined,
            rbi: Number(p.stat3 || p[10]) || undefined,
            sb: Number(p.stat4 || p[11]) || undefined,
            runs: Number(p.stat5 || p[12]) || undefined,
          },
        });
      }

      // Extract teams from teamArray or the teams display
      const teams: ScrapedTeam[] = [];
      const teamArray = win.teamArray || {};
      for (const key of Object.keys(teamArray)) {
        const t = teamArray[key];
        if (!t) continue;

        teams.push({
          name: t.name || t.teamname || key,
          budget: Number(t.budget) || 260,
          spent: Number(t.spent) || 0,
          remaining: Number(t.remaining) || Number(t.budget) - Number(t.spent) || 260,
          playersDrafted: Number(t.players) || Number(t.playersDrafted) || 0,
          isOnline: t.online === true || t.online === 1 || t.online === '1',
        });
      }

      // Extract current auction info
      let currentAuction: CurrentAuction | undefined;
      const activeAuctions = Object.values(auctionArray).filter((a: any) => a && !a.sold);
      if (activeAuctions.length > 0) {
        const active = activeAuctions[0] as any;
        const playerId = active.playerid || active.player_id;
        const player = playerArray[playerId];
        currentAuction = {
          playerId: Number(playerId),
          playerName: player ? `${player.firstname} ${player.lastname}`.trim() : `Player ${playerId}`,
          currentBid: Number(active.amount) || 0,
          currentBidder: active.teamname || active.team || '',
          timeRemaining: Number(active.time) || 0,
        };
      }

      // Calculate totals
      const draftedPlayers = players.filter(p => p.status === 'drafted');
      const totalPlayersDrafted = draftedPlayers.length;
      const totalMoneySpent = draftedPlayers.reduce((sum, p) => sum + (p.winningBid || 0), 0);

      // Determine auction status
      let status: 'active' | 'paused' | 'completed' = 'active';
      if (win.auction_paused === true || win.auction_paused === 1) {
        status = 'paused';
      }
      // Check if auction is complete (all roster spots filled or auction ended)
      const auctionComplete = win.auction_complete === true || win.auction_complete === 1;
      if (auctionComplete) {
        status = 'completed';
      }

      return {
        players,
        teams,
        currentAuction,
        totalPlayersDrafted,
        totalMoneySpent,
        status,
      };
    });

    // Add normalized names server-side
    const playersWithNormalizedNames = scrapedData.players.map((p: ScrapedPlayer) => ({
      ...p,
      normalizedName: normalizeName(p.fullName),
    }));

    return {
      roomId,
      scrapedAt: new Date().toISOString(),
      status: scrapedData.status as 'active' | 'paused' | 'completed',
      players: playersWithNormalizedNames,
      teams: scrapedData.teams,
      currentAuction: scrapedData.currentAuction,
      totalPlayersDrafted: scrapedData.totalPlayersDrafted,
      totalMoneySpent: scrapedData.totalMoneySpent,
    };
  } catch (error) {
    console.error(`Error scraping auction ${roomId}:`, error);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * Scrapes only the drafted players and current auction info (lighter weight).
 * Useful for frequent polling.
 */
export async function scrapeDraftedPlayers(roomId: string): Promise<{
  draftedPlayers: ScrapedPlayer[];
  currentAuction?: CurrentAuction;
  totalMoneySpent: number;
}> {
  const fullData = await scrapeAuction(roomId);

  return {
    draftedPlayers: fullData.players.filter(p => p.status === 'drafted'),
    currentAuction: fullData.currentAuction,
    totalMoneySpent: fullData.totalMoneySpent,
  };
}

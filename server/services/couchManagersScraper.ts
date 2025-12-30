import puppeteer, { Browser, Page } from 'puppeteer-core';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import type { ScrapedAuctionData, ScrapedPlayer, ScrapedTeam, CurrentAuction } from '../types/auction.js';
import { normalizeName } from './playerMatcher.js';

// Find Chrome/Chromium executable path based on environment
function getChromePath(): string {
  // Railway/Nixpacks provides Chromium - check CHROME_BIN first
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  // Common paths for different environments
  // Nixpacks adds chromium to PATH, so 'chromium' should work
  const possiblePaths = [
    // Nixpacks/Railway - chromium is in PATH, check common Nix store patterns
    '/app/.nix-profile/bin/chromium',
    '/nix/var/nix/profiles/default/bin/chromium',
    // Try to find in PATH (Nixpacks adds to PATH)
    '/usr/bin/chromium',              // Some Linux distros
    '/usr/bin/chromium-browser',      // Debian/Ubuntu
    '/usr/bin/google-chrome',         // Google Chrome on Linux
    '/usr/bin/google-chrome-stable',  // Chrome stable
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows x86
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
  ];

  // In development, try to use local Chrome
  for (const chromePath of possiblePaths) {
    if (existsSync(chromePath)) {
      console.log(`[Scraper] Found Chrome at: ${chromePath}`);
      return chromePath;
    }
  }

  // For Nixpacks: try to find chromium via which command (it's in PATH)
  try {
    const chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
    if (chromiumPath && existsSync(chromiumPath)) {
      console.log(`[Scraper] Found Chromium via PATH: ${chromiumPath}`);
      return chromiumPath;
    }
  } catch (e) {
    // Ignore errors from which command
  }

  // Fallback - let puppeteer-core fail with a helpful message
  throw new Error('Chrome/Chromium not found. Set CHROME_BIN environment variable or install Chrome. Checked paths: ' + possiblePaths.join(', '));
}

// Browser instance management constants
const MAX_PAGES = 5; // Maximum concurrent pages before recycling browser
const BROWSER_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes maximum browser lifetime

// Browser instance for reuse
let browserInstance: Browser | null = null;
let browserCreatedAt: number = 0;
let pageCount: number = 0;

/**
 * Check if the browser instance is healthy and should be reused
 */
async function isBrowserHealthy(): Promise<boolean> {
  if (!browserInstance) return false;
  if (!browserInstance.connected) return false;

  // Check if browser has exceeded maximum age
  const age = Date.now() - browserCreatedAt;
  if (age > BROWSER_MAX_AGE_MS) {
    console.log(`[Scraper] Browser exceeded max age (${Math.round(age / 1000)}s), recycling...`);
    return false;
  }

  // Check for orphaned pages (memory leak prevention)
  try {
    const pages = await browserInstance.pages();
    // More than MAX_PAGES open pages indicates a leak
    if (pages.length > MAX_PAGES) {
      console.log(`[Scraper] Browser has ${pages.length} pages (max: ${MAX_PAGES}), recycling...`);
      return false;
    }
  } catch (error) {
    console.log('[Scraper] Browser health check failed:', error);
    return false;
  }

  return true;
}

/**
 * Safely close and cleanup the browser instance
 */
async function cleanupBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      // Close all pages first
      const pages = await browserInstance.pages();
      await Promise.all(pages.map(page => page.close().catch(() => {})));
      // Then close the browser
      await browserInstance.close();
    } catch (error) {
      console.log('[Scraper] Error during browser cleanup:', error);
    }
    browserInstance = null;
    browserCreatedAt = 0;
    pageCount = 0;
  }
}

async function getBrowser(): Promise<Browser> {
  // Check if existing browser is healthy
  if (browserInstance && await isBrowserHealthy()) {
    return browserInstance;
  }

  // Cleanup old browser if it exists but is unhealthy
  if (browserInstance) {
    console.log('[Scraper] Cleaning up unhealthy browser instance...');
    await cleanupBrowser();
  }

  // Create new browser instance
  const chromePath = getChromePath();
  console.log(`[Scraper] Creating new browser instance with Chrome at: ${chromePath}`);
  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--single-process', // Required for some containerized environments
    ],
  });
  browserCreatedAt = Date.now();
  pageCount = 0;

  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  await cleanupBrowser();
}

/**
 * Pre-warms the browser instance on server startup.
 * This saves ~2-5 seconds on the first scrape request.
 */
export async function prewarmBrowser(): Promise<void> {
  console.log('[Scraper] Pre-warming browser instance...');
  const startTime = Date.now();
  await getBrowser();
  console.log(`[Scraper] Browser pre-warmed in ${Date.now() - startTime}ms`);
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
  pageCount++; // Track page creation for health monitoring

  try {
    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to the auction page
    // PERFORMANCE: Use 'domcontentloaded' instead of 'networkidle2' for faster navigation
    // 'networkidle2' waits for no network activity, which can take 20-40 seconds
    // We then wait specifically for the data we need (playerArray)
    const url = `https://www.couchmanagers.com/auctions/?auction_id=${roomId}`;
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
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
      const rosterArray = win.rosterArray || [];

      // Clean team names - normalize whitespace and trim
      function cleanTeamName(name: string): string {
        if (!name) return '';
        return name.trim().replace(/\s+/g, ' ');
      }

      // DEBUG: Capture auction structure to understand data format
      const debugInfo = {
        auctionCount: 0,
        rosterArrayLength: rosterArray.length,
        sampleAuction: null as any,
        playerHighestBidMapSize: 0,
        rosterMappedPlayers: 0,
        draftedPlayersWithTeams: 0,
        draftedPlayersWithoutTeams: 0,
        teamNameSources: [] as string[],
      };

      const auctionKeys = Object.keys(auctionArray);
      debugInfo.auctionCount = auctionKeys.length;
      if (auctionKeys.length > 0) {
        debugInfo.sampleAuction = auctionArray[auctionKeys[0]];
      }

      // ========================================
      // STRATEGY: Use rosterArray for player->team mapping
      // rosterArray is indexed by team number (1-based)
      // Each entry has rosterspot: [playerId1, playerId2, ...]
      // ========================================

      // Step 1: Build team index -> team name mapping from multiple sources
      const teamIndexToName: Record<number, string> = {};

      // Source A (BEST): Extract from <option value="N">TeamName</option> in any select dropdown
      // The Couch Managers page has a select dropdown with team options
      const selectOptions = document.querySelectorAll('select option');
      selectOptions.forEach(option => {
        const value = option.getAttribute('value');
        const text = (option as HTMLElement).innerText?.trim();
        if (value && text && /^\d+$/.test(value) && text.length > 1 && text.length < 50) {
          const teamIndex = Number(value);
          if (teamIndex > 0 && !teamIndexToName[teamIndex]) {
            teamIndexToName[teamIndex] = cleanTeamName(text);
          }
        }
      });
      if (Object.keys(teamIndexToName).length > 0) {
        debugInfo.teamNameSources.push('select options');
      }

      // Source B: Extract from players_taken_table (3rd column has team names)
      // This catches any teams that might not be in the dropdown
      if (Object.keys(teamIndexToName).length < 10) {
        const playersTakenTable = document.getElementById('players_taken_table');
        if (playersTakenTable) {
          const uniqueTeamNames: string[] = [];
          const rows = playersTakenTable.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              const teamName = cleanTeamName((cells[2] as HTMLElement).innerText || '');
              if (teamName && !uniqueTeamNames.includes(teamName)) {
                uniqueTeamNames.push(teamName);
              }
            }
          });
          // Map to indices if not already in teamIndexToName
          let nextIndex = Object.keys(teamIndexToName).length + 1;
          for (const name of uniqueTeamNames) {
            const existingIndex = Object.entries(teamIndexToName).find(([idx, n]) => n === name);
            if (!existingIndex) {
              teamIndexToName[nextIndex] = name;
              nextIndex++;
            }
          }
          if (uniqueTeamNames.length > 0) {
            debugInfo.teamNameSources.push('players_taken_table');
          }
        }
      }

      // Source C: Extract unique team names from auctionArray as fallback
      if (Object.keys(teamIndexToName).length < 10) {
        const auctionTeamNames: string[] = [];
        for (const key of Object.keys(auctionArray)) {
          const auction = auctionArray[key];
          if (auction && auction.teamname) {
            const name = cleanTeamName(auction.teamname);
            if (name && !auctionTeamNames.includes(name)) {
              auctionTeamNames.push(name);
            }
          }
        }
        let nextIndex = Object.keys(teamIndexToName).length + 1;
        for (const name of auctionTeamNames) {
          const existingIndex = Object.entries(teamIndexToName).find(([idx, n]) => n === name);
          if (!existingIndex) {
            teamIndexToName[nextIndex] = name;
            nextIndex++;
          }
        }
        if (auctionTeamNames.length > 0) {
          debugInfo.teamNameSources.push('auctionArray');
        }
      }

      // Step 2: Build player -> team mapping from rosterArray
      const playerToTeam: Record<number, string> = {};
      for (let teamIndex = 1; teamIndex < rosterArray.length; teamIndex++) {
        const roster = rosterArray[teamIndex];
        if (!roster || !roster.rosterspot) continue;

        // Get team name (fallback to generic name if not found)
        const teamName = teamIndexToName[teamIndex] || `Team ${teamIndex}`;

        for (const playerId of roster.rosterspot) {
          if (playerId && playerId !== null && Number(playerId) > 0) {
            playerToTeam[Number(playerId)] = teamName;
          }
        }
      }
      debugInfo.rosterMappedPlayers = Object.keys(playerToTeam).length;

      // Step 3: Also build highest bid map from auctionArray (for price data)
      const playerHighestBidMap = {} as Record<number, { teamname: string; amount: number }>;
      const allBidsByPlayer = {} as Record<number, Array<{ teamname: string; amount: number }>>;

      for (const key of Object.keys(auctionArray)) {
        const auction = auctionArray[key];
        if (auction && auction.playerid && auction.teamname) {
          const playerId = Number(auction.playerid);
          const amount = Number(auction.amount) || 0;
          const teamname = cleanTeamName(auction.teamname);

          if (!allBidsByPlayer[playerId]) {
            allBidsByPlayer[playerId] = [];
          }
          allBidsByPlayer[playerId].push({ teamname, amount });
        }
      }

      for (const playerIdStr of Object.keys(allBidsByPlayer)) {
        const playerId = Number(playerIdStr);
        const bids = allBidsByPlayer[playerId];
        bids.sort((a, b) => b.amount - a.amount);
        if (bids[0]) {
          playerHighestBidMap[playerId] = bids[0];
        }
      }
      debugInfo.playerHighestBidMapSize = Object.keys(playerHighestBidMap).length;

      // Find currently active auctions (players on the block) - only non-sold auctions
      const activeAuctionPlayerIds = new Set<number>();
      for (const key of Object.keys(auctionArray)) {
        const auction = auctionArray[key];
        // Only include auctions that are not yet sold (i.e., still active)
        if (auction && auction.playerid && !auction.sold) {
          activeAuctionPlayerIds.add(Number(auction.playerid));
        }
      }

      for (const id of Object.keys(playerArray)) {
        const p = playerArray[id];
        if (!p) continue;

        // Player constructor params based on CM code:
        // id, firstname, lastname, pos1, pos2, pos3, pos4, team, stat1, stat2, stat3, stat4, stat5, drafted, open, queued, ...
        const firstName = p.firstname || p[1] || '';
        const lastName = p.lastname || p[2] || '';
        const positions = [p.position || p.position1 || p[3], p.position2 || p[4], p.position3 || p[5], p.position4 || p[6]]
          .filter((pos: string) => pos && pos !== '');
        const mlbTeam = p.team || p[7] || '';
        const isDrafted = p.drafted === true || p.drafted === 1 || p.drafted === '1';
        const isOpen = p.open === 1 || p.open === '1' || activeAuctionPlayerIds.has(Number(id));
        const isPassed = passedArray.includes(Number(id));

        // Determine status
        // Priority: on_block > drafted > passed > available
        // If a player is actively being auctioned (on_block), that takes precedence
        // over the drafted flag (which may be set prematurely by CouchManagers)
        let status: 'available' | 'drafted' | 'on_block' | 'passed';
        if (isOpen) {
          status = 'on_block';
        } else if (isDrafted) {
          status = 'drafted';
        } else if (isPassed) {
          status = 'passed';
        } else {
          status = 'available';
        }

        const fullName = `${firstName} ${lastName}`.trim();

        // Get winning bid - prefer price from playerArray, fallback to auction map
        const winningBidFromPlayer = Number(p.price) || Number(p.winningBid) || 0;
        const winningBidFromAuction = playerHighestBidMap[Number(id)]?.amount || 0;
        const winningBid = isDrafted ? (winningBidFromPlayer || winningBidFromAuction || undefined) : undefined;

        // Get winning team - PRIMARY SOURCE: playerToTeam from rosterArray (most complete)
        // FALLBACK 1: auctionArray highest bid (only has recent bids)
        // FALLBACK 2: player object properties
        const winningTeamFromRoster = playerToTeam[Number(id)];
        const winningTeamFromAuction = playerHighestBidMap[Number(id)]?.teamname;
        const winningTeamFromPlayer = cleanTeamName(p.teamname || p.winningTeam || '');
        const winningTeam = isDrafted ? (winningTeamFromRoster || winningTeamFromAuction || winningTeamFromPlayer || undefined) : undefined;

        players.push({
          couchManagersId: Number(id),
          firstName,
          lastName,
          fullName,
          normalizedName: '', // Will be set server-side
          positions,
          mlbTeam,
          status,
          winningBid,
          winningTeam,
          stats: {
            avg: p.avg || p.stat1 || p[8],
            hr: Number(p.hr || p.stat2 || p[9]) || undefined,
            rbi: Number(p.rbi || p.stat3 || p[10]) || undefined,
            sb: Number(p.sb || p.stat4 || p[11]) || undefined,
            runs: Number(p.r || p.stat5 || p[12]) || undefined,
          },
        });
      }

      // Extract teams - use teamIndexToName map we already built from multiple sources
      const teams: ScrapedTeam[] = [];

      // Primary: Use the teamIndexToName map we built earlier (from rosterArray + auctionArray + DOM)
      // This ensures team names are consistent with player ownership data
      const teamIndices = Object.keys(teamIndexToName).map(Number).sort((a, b) => a - b);
      for (const idx of teamIndices) {
        const teamName = teamIndexToName[idx];
        if (teamName) {
          // Count players for this team
          const playersOnTeam = Object.values(playerToTeam).filter(t => t === teamName).length;
          teams.push({
            name: teamName,
            budget: 260,
            spent: 0,
            remaining: 260,
            playersDrafted: playersOnTeam,
            isOnline: false,
          });
        }
      }

      // Fallback: Try teamArray object if no teams from mapping
      if (teams.length === 0) {
        const teamArray = win.teamArray || win.teamsArray || win.teams || {};
        for (const key of Object.keys(teamArray)) {
          const t = teamArray[key];
          if (!t) continue;

          const teamName = t.name || t.teamname || t.team_name || t.username || key;
          if (teamName) {
            teams.push({
              name: cleanTeamName(teamName),
              budget: Number(t.budget) || 260,
              spent: Number(t.spent) || 0,
              remaining: Number(t.remaining) || Number(t.budget) - Number(t.spent) || 260,
              playersDrafted: Number(t.players) || Number(t.playersDrafted) || 0,
              isOnline: t.online === true || t.online === 1 || t.online === '1',
            });
          }
        }
      }

      // Extract current auction info - track ALL active auctions
      let currentAuction: CurrentAuction | undefined;
      const allActiveAuctions: CurrentAuction[] = [];
      const unsoldAuctions = Object.values(auctionArray).filter((a: any) => a && !a.sold);

      for (const active of unsoldAuctions) {
        const auction = active as any;
        const playerId = auction.playerid || auction.player_id;
        const player = playerArray[playerId];
        const auctionInfo: CurrentAuction = {
          playerId: Number(playerId),
          playerName: player ? `${player.firstname} ${player.lastname}`.trim() : `Player ${playerId}`,
          currentBid: Number(auction.amount) || 0,
          currentBidder: cleanTeamName(auction.teamname || auction.team || ''),
          timeRemaining: Number(auction.time) || 0,
        };
        allActiveAuctions.push(auctionInfo);
      }

      // For backward compatibility, set currentAuction to the first active auction
      if (allActiveAuctions.length > 0) {
        currentAuction = allActiveAuctions[0];
      }

      // Calculate totals
      const draftedPlayers = players.filter(p => p.status === 'drafted');
      const totalPlayersDrafted = draftedPlayers.length;
      const totalMoneySpent = draftedPlayers.reduce((sum, p) => sum + (p.winningBid || 0), 0);

      // Update debug info with drafted player team stats
      debugInfo.draftedPlayersWithTeams = draftedPlayers.filter(p => p.winningTeam).length;
      debugInfo.draftedPlayersWithoutTeams = draftedPlayers.filter(p => !p.winningTeam).length;

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
        activeAuctions: allActiveAuctions,
        totalPlayersDrafted,
        totalMoneySpent,
        status,
        debugInfo,
      };
    });

    // Add normalized names server-side
    const playersWithNormalizedNames = scrapedData.players.map((p: ScrapedPlayer) => ({
      ...p,
      normalizedName: normalizeName(p.fullName),
    }));

    const result = {
      roomId,
      scrapedAt: new Date().toISOString(),
      status: scrapedData.status as 'active' | 'paused' | 'completed',
      players: playersWithNormalizedNames,
      teams: scrapedData.teams,
      currentAuction: scrapedData.currentAuction,
      activeAuctions: scrapedData.activeAuctions,
      totalPlayersDrafted: scrapedData.totalPlayersDrafted,
      totalMoneySpent: scrapedData.totalMoneySpent,
    };

    // DEBUG: Log detailed scraper diagnostics
    const debugInfo = (scrapedData as any).debugInfo;
    console.log(`[Scraper] Room ${roomId}: DEBUG INFO:`, JSON.stringify(debugInfo, null, 2));
    console.log(`[Scraper] Room ${roomId}: Found ${result.teams.length} teams:`, result.teams.map(t => t.name));
    const draftedSample = playersWithNormalizedNames
      .filter(p => p.status === 'drafted')
      .slice(0, 10)
      .map(p => ({ name: p.fullName, winningTeam: p.winningTeam, winningBid: p.winningBid }));
    console.log(`[Scraper] Room ${roomId}: Sample drafted players:`, JSON.stringify(draftedSample, null, 2));

    return result;
  } catch (error) {
    console.error(`Error scraping auction ${roomId}:`, error);
    throw error;
  } finally {
    await page.close();
    pageCount--; // Decrement page count to accurately track open pages
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

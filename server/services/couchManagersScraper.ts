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

      // Find currently active auctions (players on the block)
      const activeAuctionPlayerIds = new Set<number>();
      for (const key of Object.keys(auctionArray)) {
        const auction = auctionArray[key];
        if (auction && auction.playerid) {
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

import puppeteer from 'puppeteer';

async function debugScraper() {
  console.log('Debugging scraper data for room 1362...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  try {
    const url = 'https://www.couchmanagers.com/auctions/?auction_id=1362';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForFunction(
      'typeof playerArray !== "undefined" && Object.keys(playerArray).length > 0',
      { timeout: 15000 }
    );

    const result = await page.evaluate(() => {
      const win = window as any;

      // Check all potential team name sources
      const auctionArray = win.auctionArray || {};
      const rosterArray = win.rosterArray || [];

      // Sample auction entries with ALL their fields
      const auctionSample = Object.entries(auctionArray).slice(0, 5).map(([key, val]) => ({
        key,
        fields: Object.keys(val as any),
        values: val,
      }));

      // Sample roster entries
      const rosterSample = rosterArray.slice(1, 4).map((roster: any, idx: number) => ({
        index: idx + 1,
        fields: roster ? Object.keys(roster) : [],
        name: roster?.name,
        teamname: roster?.teamname,
        username: roster?.username,
        team: roster?.team,
      }));

      // Check for other team-related variables
      const otherVars = {
        hasTeamArray: !!win.teamArray,
        hasTeamsArray: !!win.teamsArray,
        hasOwnerArray: !!win.ownerArray,
        hasOwnerList: !!win.ownerList,
        hasUserArray: !!win.userArray,
        hasUsernames: !!win.usernames,
      };

      // Get ownerArray if it exists
      let ownerArrayInfo = null;
      if (win.ownerArray && win.ownerArray.length > 0) {
        ownerArrayInfo = win.ownerArray.slice(0, 5).map((o: any, i: number) => ({
          index: i,
          fields: o ? Object.keys(o) : [],
          values: o,
        }));
      }

      // Check window object for any team/owner related properties
      const windowKeys = Object.keys(win).filter((k: string) =>
        k.toLowerCase().includes('team') ||
        k.toLowerCase().includes('owner') ||
        k.toLowerCase().includes('user') ||
        k.toLowerCase().includes('roster') ||
        k.toLowerCase().includes('name')
      );

      // Check DOM for tables/elements that might contain team names
      const ownerDetailsExists = !!document.querySelector('#owner_details');
      const allTables = document.querySelectorAll('table');
      const tableInfo = Array.from(allTables).map((table, idx) => {
        const rows = table.querySelectorAll('tbody tr');
        const firstRowCells = rows[0] ? Array.from(rows[0].querySelectorAll('td')).map(td => (td as HTMLElement).innerText?.trim().substring(0, 30)) : [];
        return {
          index: idx,
          id: table.id || 'no-id',
          className: table.className || 'no-class',
          rowCount: rows.length,
          firstRowSample: firstRowCells.slice(0, 3),
        };
      });

      return {
        auctionSample,
        rosterSample,
        otherVars,
        ownerArrayInfo,
        windowKeys,
        ownerDetailsExists,
        tableInfo,
      };
    });

    console.log('\n=== Auction Sample (first 5 entries) ===');
    result.auctionSample.forEach((a: any) => {
      console.log(`Key ${a.key}:`, JSON.stringify(a.values, null, 2));
    });

    console.log('\n=== Roster Sample (indices 1-3) ===');
    result.rosterSample.forEach((r: any) => {
      console.log(`Index ${r.index}:`, JSON.stringify(r, null, 2));
    });

    console.log('\n=== Other Team Variables ===');
    console.log(JSON.stringify(result.otherVars, null, 2));

    if (result.ownerArrayInfo) {
      console.log('\n=== Owner Array Sample ===');
      console.log(JSON.stringify(result.ownerArrayInfo, null, 2));
    }

    console.log('\n=== Window Keys with team/owner/user/roster/name ===');
    console.log(result.windowKeys);

    console.log('\n=== DOM Check ===');
    console.log('ownerDetailsExists:', result.ownerDetailsExists);
    console.log('\nTables found:', result.tableInfo.length);
    result.tableInfo.forEach((t: any) => {
      console.log(`  Table ${t.index}: id="${t.id}", class="${t.className}", rows=${t.rowCount}, firstRow:`, t.firstRowSample);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

debugScraper();

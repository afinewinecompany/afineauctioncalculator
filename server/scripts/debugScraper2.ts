import puppeteer from 'puppeteer';

async function debugScraper() {
  console.log('Debugging scraper data for room 1362 - finding team names...');

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
      const rosterArray = win.rosterArray || [];
      const auctionArray = win.auctionArray || {};
      const playerArray = win.playerArray || {};

      // Method 1: Extract team names from rosterTable DOM headers
      // Each rosterTable has a header row with the team name
      const rosterTableTeamNames: Record<number, string> = {};
      for (let i = 1; i <= 15; i++) {
        const table = document.getElementById(`rosterTable${i}`);
        if (table) {
          // Look for the header/title of the table
          const caption = table.querySelector('caption');
          const headerCell = table.querySelector('thead th');
          const firstCell = table.querySelector('tbody tr:first-child td:first-child');
          const editLink = table.querySelector('a[onclick*="editRoster"]');

          // Also check for divs/elements near the table
          const prevSibling = table.previousElementSibling;

          rosterTableTeamNames[i] = JSON.stringify({
            caption: caption?.textContent?.trim(),
            headerCell: headerCell?.textContent?.trim(),
            firstCellText: firstCell?.textContent?.trim().substring(0, 50),
            editLinkOnclick: editLink?.getAttribute('onclick')?.substring(0, 100),
            prevSiblingTag: prevSibling?.tagName,
            prevSiblingText: prevSibling?.textContent?.trim().substring(0, 100),
          });
        }
      }

      // Method 2: Use players_taken_table - column 3 has team names
      const playersTakenTeamNames: string[] = [];
      const playersTakenTable = document.getElementById('players_taken_table');
      if (playersTakenTable) {
        const rows = playersTakenTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const teamName = (cells[2] as HTMLElement).innerText?.trim();
            if (teamName && !playersTakenTeamNames.includes(teamName)) {
              playersTakenTeamNames.push(teamName);
            }
          }
        });
      }

      // Method 3: Extract unique team names from auctionArray
      const auctionTeamNames: string[] = [];
      for (const key of Object.keys(auctionArray)) {
        const auction = auctionArray[key];
        if (auction && auction.teamname) {
          const name = auction.teamname.trim();
          if (name && !auctionTeamNames.includes(name)) {
            auctionTeamNames.push(name);
          }
        }
      }

      // Method 4: Check window variables for team info
      const windowTeamInfo = {
        teamnum: win.teamnum,
        teamname: win.teamname,
        myteam: win.myteam,
        teamName: win.teamName,
      };

      // Method 5: Check rosterArray more carefully
      const rosterDetails: any[] = [];
      for (let i = 1; i < Math.min(rosterArray.length, 6); i++) {
        const roster = rosterArray[i];
        rosterDetails.push({
          index: i,
          allKeys: roster ? Object.keys(roster) : [],
          toString: roster ? roster.toString() : null,
          length: roster?.rosterspot?.length,
        });
      }

      // Method 6: Look at the page structure around roster tables
      const rosterAreaHTML = document.querySelector('#roster_section')?.innerHTML?.substring(0, 1000) ||
                            document.querySelector('.roster-container')?.innerHTML?.substring(0, 1000) ||
                            document.querySelector('#rosters')?.innerHTML?.substring(0, 1000);

      return {
        rosterTableTeamNames,
        playersTakenTeamNames,
        auctionTeamNames,
        windowTeamInfo,
        rosterDetails,
        rosterAreaHTML,
      };
    });

    console.log('\n=== Method 1: Roster Table DOM Inspection ===');
    for (const [idx, info] of Object.entries(result.rosterTableTeamNames)) {
      console.log(`rosterTable${idx}:`, info);
    }

    console.log('\n=== Method 2: Team Names from players_taken_table ===');
    console.log('Found', result.playersTakenTeamNames.length, 'unique team names:');
    result.playersTakenTeamNames.forEach((name: string, i: number) => {
      console.log(`  ${i + 1}. ${name}`);
    });

    console.log('\n=== Method 3: Team Names from auctionArray ===');
    console.log('Found', result.auctionTeamNames.length, 'unique team names:');
    result.auctionTeamNames.forEach((name: string, i: number) => {
      console.log(`  ${i + 1}. ${name}`);
    });

    console.log('\n=== Method 4: Window Team Variables ===');
    console.log(JSON.stringify(result.windowTeamInfo, null, 2));

    console.log('\n=== Method 5: Roster Array Details ===');
    result.rosterDetails.forEach((r: any) => {
      console.log(`  Index ${r.index}:`, JSON.stringify(r));
    });

    if (result.rosterAreaHTML) {
      console.log('\n=== Method 6: Roster Area HTML (first 1000 chars) ===');
      console.log(result.rosterAreaHTML);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

debugScraper();

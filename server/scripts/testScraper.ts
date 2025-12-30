import puppeteer from 'puppeteer';

async function testNewScrapeLogic() {
  console.log('Testing FIXED scrape logic for room 1362...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  try {
    const url = 'https://www.couchmanagers.com/auctions/?auction_id=1362';
    // Use networkidle2 to ensure all content is loaded including select dropdowns
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForFunction(
      'typeof playerArray !== "undefined" && Object.keys(playerArray).length > 0',
      { timeout: 15000 }
    );

    const result = await page.evaluate(() => {
      const win = window as any;
      const playerArray = win.playerArray || {};
      const rosterArray = win.rosterArray || [];

      function cleanTeamName(name: string): string {
        if (!name) return '';
        return name.trim().replace(/\s+/g, ' ');
      }

      // Step 1: Build team index -> team name mapping
      const teamIndexToName: Record<number, string> = {};
      const teamNameSources: string[] = [];

      // Source A (BEST): Extract from <option value="N">TeamName</option>
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
        teamNameSources.push(`select options: found ${Object.keys(teamIndexToName).length} teams`);
      }

      // Step 2: Build player -> team mapping from rosterArray
      const playerToTeam: Record<number, string> = {};
      for (let teamIndex = 1; teamIndex < rosterArray.length; teamIndex++) {
        const roster = rosterArray[teamIndex];
        if (!roster || !roster.rosterspot) continue;
        const teamName = teamIndexToName[teamIndex] || `Team ${teamIndex}`;
        for (const playerId of roster.rosterspot) {
          if (playerId && playerId !== null && Number(playerId) > 0) {
            playerToTeam[Number(playerId)] = teamName;
          }
        }
      }

      // Find drafted players with their teams
      const draftedPlayers: any[] = [];
      for (const id of Object.keys(playerArray)) {
        const p = playerArray[id];
        if (p && (p.drafted === true || p.drafted === 1 || p.drafted === '1')) {
          const playerId = Number(id);
          const winningTeam = playerToTeam[playerId];
          draftedPlayers.push({
            id: playerId,
            name: `${p.firstname} ${p.lastname}`,
            price: p.price,
            winningTeam: winningTeam || 'UNKNOWN',
          });
        }
      }

      // Find Alex (Martians) team
      const alexTeamIndex = Object.entries(teamIndexToName).find(
        ([idx, name]) => name.includes('Alex') || name.includes('Martians')
      );

      let alexPlayers: any[] = [];
      if (alexTeamIndex) {
        const [idxStr, teamName] = alexTeamIndex;
        alexPlayers = draftedPlayers.filter(p => p.winningTeam === teamName);
      }

      return {
        teamIndexToName,
        teamNameSources,
        rosterArrayLength: rosterArray.length,
        playerToTeamSize: Object.keys(playerToTeam).length,
        totalDrafted: draftedPlayers.length,
        draftedWithTeams: draftedPlayers.filter(p => p.winningTeam !== 'UNKNOWN').length,
        draftedWithoutTeams: draftedPlayers.filter(p => p.winningTeam === 'UNKNOWN').length,
        alexTeamInfo: alexTeamIndex ? { index: alexTeamIndex[0], name: alexTeamIndex[1] } : null,
        alexPlayers,
        sampleDraftedPlayers: draftedPlayers.slice(0, 15),
      };
    });

    console.log('\n=== Team Name Sources ===');
    result.teamNameSources.forEach((s: string) => console.log(`  ${s}`));

    console.log('\n=== Team Index -> Name Mapping ===');
    for (const [idx, name] of Object.entries(result.teamIndexToName)) {
      console.log(`  ${idx}: ${name}`);
    }

    console.log('\n=== Stats ===');
    console.log(`  rosterArray length: ${result.rosterArrayLength}`);
    console.log(`  Players mapped to teams: ${result.playerToTeamSize}`);
    console.log(`  Total drafted: ${result.totalDrafted}`);
    console.log(`  Drafted with teams: ${result.draftedWithTeams}`);
    console.log(`  Drafted without teams: ${result.draftedWithoutTeams}`);

    console.log('\n=== Alex (Martians) Team ===');
    if (result.alexTeamInfo) {
      console.log(`  Index: ${result.alexTeamInfo.index}, Name: ${result.alexTeamInfo.name}`);
      console.log(`  Players (${result.alexPlayers.length}):`);
      result.alexPlayers.forEach((p: any) => {
        console.log(`    - ${p.name} ($${p.price})`);
      });
    } else {
      console.log('  Team not found!');
    }

    console.log('\n=== Sample Drafted Players ===');
    result.sampleDraftedPlayers.forEach((p: any) => {
      console.log(`  ${p.name} ($${p.price}): ${p.winningTeam}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

testNewScrapeLogic();

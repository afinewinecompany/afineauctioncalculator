// server/scripts/testScraper.ts
import puppeteer from "puppeteer";
async function inspectRosterData() {
  console.log("Inspecting roster data for room 1362...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  try {
    const url = "https://www.couchmanagers.com/auctions/?auction_id=1362";
    await page.goto(url, { waitUntil: "networkidle2", timeout: 6e4 });
    await page.waitForFunction(
      'typeof playerArray !== "undefined" && Object.keys(playerArray).length > 0',
      { timeout: 15e3 }
    );
    const rosterData = await page.evaluate(() => {
      const win = window;
      const rosterArray = win.rosterArray || [];
      const playerArray = win.playerArray || {};
      const teamNames = [];
      const ownerRows = document.querySelectorAll("#owner_details tbody tr");
      ownerRows.forEach((row) => {
        const firstCell = row.querySelector("td:first-child");
        if (firstCell) {
          const text = firstCell.innerText?.trim();
          if (text && text.length > 1 && text.length < 40 && !/^\d+$/.test(text) && !/^\$/.test(text)) {
            teamNames.push(text);
          }
        }
      });
      const playerToTeam = {};
      for (let teamIndex = 1; teamIndex < rosterArray.length; teamIndex++) {
        const roster = rosterArray[teamIndex];
        if (!roster || !roster.rosterspot) continue;
        const teamName = teamNames[teamIndex - 1] || `Team ${teamIndex}`;
        for (const playerId of roster.rosterspot) {
          if (playerId && playerId !== null && playerId > 0) {
            playerToTeam[playerId] = teamName;
          }
        }
      }
      const draftedWithTeams = [];
      for (const id of Object.keys(playerArray)) {
        const p = playerArray[id];
        if (p && (p.drafted === true || p.drafted === 1 || p.drafted === "1")) {
          const playerId = Number(id);
          const team = playerToTeam[playerId];
          draftedWithTeams.push({
            id: playerId,
            name: `${p.firstname} ${p.lastname}`,
            team: team || "UNKNOWN"
          });
        }
      }
      return {
        teamNames,
        rosterArrayLength: rosterArray.length,
        playerToTeamSize: Object.keys(playerToTeam).length,
        sampleMappings: draftedWithTeams.slice(0, 20)
      };
    });
    console.log("\n=== Team Names from DOM ===");
    console.log(rosterData.teamNames);
    console.log("\n=== Roster Array Stats ===");
    console.log("rosterArray length:", rosterData.rosterArrayLength);
    console.log("Players mapped to teams:", rosterData.playerToTeamSize);
    console.log("\n=== Sample Player -> Team Mappings ===");
    rosterData.sampleMappings.forEach((p) => {
      console.log(`  ${p.name} (ID: ${p.id}): ${p.team}`);
    });
    console.log("\n=== Looking for Alex (Martians) players ===");
    const alexPlayers = await page.evaluate(() => {
      const win = window;
      const rosterArray = win.rosterArray || [];
      const playerArray = win.playerArray || {};
      const teamNames = [];
      const ownerRows = document.querySelectorAll("#owner_details tbody tr");
      ownerRows.forEach((row) => {
        const firstCell = row.querySelector("td:first-child");
        if (firstCell) {
          const text = firstCell.innerText?.trim();
          if (text && text.length > 1 && text.length < 40) {
            teamNames.push(text);
          }
        }
      });
      const alexIndex = teamNames.findIndex((n) => n.includes("Alex") || n.includes("Martians"));
      if (alexIndex === -1) return { error: "Team not found", teamNames };
      const roster = rosterArray[alexIndex + 1];
      if (!roster || !roster.rosterspot) return { error: "No roster", alexIndex };
      const players = [];
      for (const playerId of roster.rosterspot) {
        if (playerId && playerId !== null && playerId > 0) {
          const p = playerArray[playerId];
          if (p) {
            players.push({
              id: playerId,
              name: `${p.firstname} ${p.lastname}`,
              price: p.price
            });
          }
        }
      }
      return {
        teamName: teamNames[alexIndex],
        teamIndex: alexIndex + 1,
        players
      };
    });
    console.log(JSON.stringify(alexPlayers, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}
inspectRosterData();

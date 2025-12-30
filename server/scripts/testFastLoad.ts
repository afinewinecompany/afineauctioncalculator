import puppeteer from 'puppeteer';

async function testFastLoad() {
  console.log('Testing with domcontentloaded (faster)...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  try {
    const url = 'https://www.couchmanagers.com/auctions/?auction_id=1362';
    const startTime = Date.now();

    // Use domcontentloaded (fast) instead of networkidle2 (slow)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`  domcontentloaded took: ${Date.now() - startTime}ms`);

    await page.waitForFunction(
      'typeof playerArray !== "undefined" && Object.keys(playerArray).length > 0',
      { timeout: 15000 }
    );
    console.log(`  playerArray ready: ${Date.now() - startTime}ms`);

    // Check if select options are available
    const selectOptionsCount = await page.evaluate(() => {
      const options = document.querySelectorAll('select option');
      return options.length;
    });
    console.log(`  select options count: ${selectOptionsCount}`);

    if (selectOptionsCount === 0) {
      // Wait a bit more for dynamic content
      console.log('  Waiting for dynamic content...');
      await page.waitForSelector('select option', { timeout: 10000 });
      const newCount = await page.evaluate(() => document.querySelectorAll('select option').length);
      console.log(`  select options after wait: ${newCount}`);
    }

    // Run the team extraction logic
    const result = await page.evaluate(() => {
      const teamIndexToName: Record<number, string> = {};
      const selectOptions = document.querySelectorAll('select option');
      selectOptions.forEach(option => {
        const value = option.getAttribute('value');
        const text = (option as HTMLElement).innerText?.trim();
        if (value && text && /^\d+$/.test(value) && text.length > 1 && text.length < 50) {
          const teamIndex = Number(value);
          if (teamIndex > 0 && !teamIndexToName[teamIndex]) {
            teamIndexToName[teamIndex] = text;
          }
        }
      });
      return {
        teamCount: Object.keys(teamIndexToName).length,
        hasAlexMartians: Object.values(teamIndexToName).some((n: string) => n.includes('Alex') || n.includes('Martians')),
        teams: teamIndexToName,
      };
    });

    console.log(`\n  Total load time: ${Date.now() - startTime}ms`);
    console.log(`  Teams found: ${result.teamCount}`);
    console.log(`  Has Alex (Martians): ${result.hasAlexMartians}`);
    console.log('  Teams:', result.teams);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

testFastLoad();

// Test script to identify on_block players not matching to projections

import { scrapeAuctionRoom } from './server/services/couchManagersScraper.js';
import { normalizeName } from './server/services/playerMatcher.js';

const ROOM_ID = 1352;

async function testOnBlockMatching() {
  console.log(`\n=== Testing on_block matching for room ${ROOM_ID} ===\n`);

  try {
    // Scrape the room
    console.log('Scraping room...');
    const scrapeResult = await scrapeAuctionRoom(ROOM_ID);

    if (!scrapeResult.success) {
      console.error('Failed to scrape room:', scrapeResult.error);
      return;
    }

    const { players } = scrapeResult.data;

    // Find all on_block players
    const onBlockPlayers = players.filter(p => p.status === 'on_block');
    console.log(`\nFound ${onBlockPlayers.length} on_block players in Couch Managers:\n`);

    onBlockPlayers.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.fullName} (${p.mlbTeam}) - positions: ${p.positions.join(', ')} - cmId: ${p.couchManagersId}`);
    });

    // Now we need projections to test matching
    // For this test, let's just output the on_block players and their normalized names
    console.log('\n=== Normalized names for on_block players ===\n');
    onBlockPlayers.forEach((p, idx) => {
      const normalized = normalizeName(p.fullName);
      console.log(`${idx + 1}. "${p.fullName}" -> "${normalized}" | team: ${p.mlbTeam}`);
    });

    // Check for MiLB players
    const milbOnBlock = onBlockPlayers.filter(p => p.positions.includes('MiLB'));
    if (milbOnBlock.length > 0) {
      console.log('\n=== MiLB players on_block (will NOT match to MLB projections) ===\n');
      milbOnBlock.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.fullName} (${p.mlbTeam}) - positions: ${p.positions.join(', ')}`);
      });
    }

    console.log('\n=== Summary ===');
    console.log(`Total on_block: ${onBlockPlayers.length}`);
    console.log(`MiLB on_block: ${milbOnBlock.length}`);
    console.log(`Non-MiLB on_block (should match): ${onBlockPlayers.length - milbOnBlock.length}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

testOnBlockMatching().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

// Test script to identify unmatched on_block players
// This script hits the sync-lite endpoint and logs unmatched players

const ROOM_ID = '1352';
const LEAGUE_ID = 'cm-1352'; // This needs to be a real league ID

async function testUnmatchedPlayers() {
  console.log(`\n=== Testing unmatched on_block players for room ${ROOM_ID} ===\n`);

  // First we need to get the scraped data directly
  // Let's use the scrape endpoint
  const response = await fetch(`http://localhost:3000/api/auction/${ROOM_ID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.error('Failed to scrape room:', response.status, await response.text());
    return;
  }

  const data = await response.json();
  console.log('Scraped room successfully');

  const { players } = data;

  // Find all on_block players
  const onBlockPlayers = players.filter(p => p.status === 'on_block');
  console.log(`\nFound ${onBlockPlayers.length} on_block players:\n`);

  onBlockPlayers.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.fullName} (${p.mlbTeam}) - positions: ${p.positions.join(', ')} - cmId: ${p.couchManagersId}`);
  });

  // Find drafted players
  const draftedPlayers = players.filter(p => p.status === 'drafted');
  console.log(`\n=== Found ${draftedPlayers.length} drafted players ===\n`);

  console.log('\n=== Summary ===');
  console.log(`Total on_block: ${onBlockPlayers.length}`);
  console.log(`Total drafted: ${draftedPlayers.length}`);
  console.log(`Total players: ${players.length}`);
}

testUnmatchedPlayers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

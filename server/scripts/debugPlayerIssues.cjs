/**
 * Debug script to investigate:
 * 1. Nolan McLean showing $1 projection but no draft info (drafted for $15 by Carpy)
 * 2. Max Muncy (ATH) not showing in player queue (only LAD version shows)
 */

const fs = require('fs');
const path = require('path');

// Load the cached room data
const roomDataPath = path.join(__dirname, '../../room_1363_data.json');
const projectionsPath = path.join(__dirname, '../../steamer_projections.json');

console.log('=== PLAYER DEBUG SCRIPT ===\n');

// Check if we have more recent room data
const room1362Path = path.join(__dirname, '../../room_1362_data.json');
let roomData;
let roomId;
try {
  if (fs.existsSync(room1362Path)) {
    roomData = JSON.parse(fs.readFileSync(room1362Path, 'utf8'));
    roomId = '1362';
    console.log('Using room_1362_data.json');
  } else if (fs.existsSync(roomDataPath)) {
    roomData = JSON.parse(fs.readFileSync(roomDataPath, 'utf8'));
    roomId = '1363';
    console.log('Using room_1363_data.json');
  } else {
    console.error('No room data found! Please ensure room data is cached.');
    process.exit(1);
  }
} catch (e) {
  console.error('Failed to load room data:', e.message);
  process.exit(1);
}

let projectionsData;
try {
  const raw = JSON.parse(fs.readFileSync(projectionsPath, 'utf8'));
  projectionsData = raw.projections || raw;
} catch (e) {
  console.error('Failed to load projections:', e.message);
  process.exit(1);
}

// Helper to normalize names for matching
function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('\n=== ISSUE 1: NOLAN MCLEAN ===');
console.log('Expected: Drafted for $15 by Carpy');
console.log('Actual: Shows $1 projection with no adj/actual cost\n');

// Find Nolan McLean in projections
const nolanInProjections = projectionsData.filter(p =>
  normalizeName(p.name).includes('nolan') && normalizeName(p.name).includes('mclean')
);
console.log('Nolan McLean in projections:');
nolanInProjections.forEach(p => {
  console.log(`  - ${p.name} (${p.team}) [${p.positions.join(', ')}]`);
  console.log(`    externalId: ${p.externalId}, mlbamId: ${p.mlbamId}`);
  console.log(`    isInDraftPool: ${p.isInDraftPool}`);
  console.log(`    projectedValue: $${p.projectedValue || 0}`);
});

// Find Nolan McLean in scraped room data
if (roomData.players) {
  const nolanInRoom = roomData.players.filter(p => {
    const fullName = `${p.firstname || ''} ${p.lastname || ''}`.toLowerCase();
    return fullName.includes('nolan') && fullName.includes('mclean');
  });
  console.log('\nNolan McLean in scraped room data:');
  nolanInRoom.forEach(p => {
    console.log(`  - ${p.firstname} ${p.lastname} (${p.team || p.mlbTeam})`);
    console.log(`    couchManagersId: ${p.id}`);
    console.log(`    mlbamId: ${p.mlbamId}`);
    console.log(`    positions: ${JSON.stringify(p.positions || p.position)}`);
    console.log(`    status: ${p.status}`);
    if (p.status === 'drafted' || p.winningBid) {
      console.log(`    winningBid: $${p.winningBid || p.winning_bid || 'N/A'}`);
      console.log(`    winningTeam: ${p.winningTeam || p.winning_team || p.teamname || 'N/A'}`);
    }
  });
}

// Check auction data for Nolan
if (roomData.auctionData) {
  console.log('\nChecking auctionData.players...');
  const auctionPlayers = roomData.auctionData.players || [];
  const nolanInAuction = auctionPlayers.filter(p => {
    const name = (p.fullName || p.name || '').toLowerCase();
    return name.includes('nolan') && name.includes('mclean');
  });
  if (nolanInAuction.length > 0) {
    console.log('Found in auctionData.players:');
    nolanInAuction.forEach(p => console.log('  ', JSON.stringify(p, null, 2)));
  } else {
    console.log('Not found in auctionData.players');
  }
}

// Check matchedPlayers
if (roomData.matchedPlayers) {
  const nolanMatched = roomData.matchedPlayers.filter(mp => {
    const scrapedName = (mp.scrapedPlayer?.fullName || '').toLowerCase();
    return scrapedName.includes('nolan') && scrapedName.includes('mclean');
  });
  console.log('\nNolan McLean in matchedPlayers:');
  if (nolanMatched.length > 0) {
    nolanMatched.forEach(mp => {
      console.log('  scrapedPlayer:', JSON.stringify(mp.scrapedPlayer, null, 4));
      console.log('  projectionPlayerId:', mp.projectionPlayerId);
      console.log('  projectedValue:', mp.projectedValue);
      console.log('  matchConfidence:', mp.matchConfidence);
    });
  } else {
    console.log('  NOT FOUND in matchedPlayers!');
  }
}

// Check unmatchedPlayers
if (roomData.unmatchedPlayers) {
  const nolanUnmatched = roomData.unmatchedPlayers.filter(up => {
    const name = (up.fullName || '').toLowerCase();
    return name.includes('nolan') && name.includes('mclean');
  });
  console.log('\nNolan McLean in unmatchedPlayers:');
  if (nolanUnmatched.length > 0) {
    nolanUnmatched.forEach(up => console.log('  ', JSON.stringify(up, null, 2)));
  } else {
    console.log('  NOT in unmatchedPlayers');
  }
}

console.log('\n=== ISSUE 2: MAX MUNCY (ATH vs LAD) ===');
console.log('Expected: Both players should show (different people)');
console.log('Actual: Only LAD version showing as drafted, ATH not in queue\n');

// Find both Max Muncys in projections
const maxMuncyInProjections = projectionsData.filter(p =>
  normalizeName(p.name) === 'max muncy'
);
console.log('Max Muncy entries in projections:');
maxMuncyInProjections.forEach(p => {
  console.log(`  - ${p.name} (${p.team}) [${p.positions.join(', ')}]`);
  console.log(`    externalId: ${p.externalId}, mlbamId: ${p.mlbamId}`);
  console.log(`    isInDraftPool: ${p.isInDraftPool}`);
  console.log(`    projectedValue: $${p.projectedValue || 0}`);
});

// Find Max Muncy in scraped room data
if (roomData.players) {
  const maxMuncyInRoom = roomData.players.filter(p => {
    const fullName = normalizeName(`${p.firstname || ''} ${p.lastname || ''}`);
    return fullName === 'max muncy';
  });
  console.log('\nMax Muncy in scraped room data:');
  if (maxMuncyInRoom.length > 0) {
    maxMuncyInRoom.forEach(p => {
      console.log(`  - ${p.firstname} ${p.lastname} (${p.team || p.mlbTeam})`);
      console.log(`    couchManagersId: ${p.id}`);
      console.log(`    mlbamId: ${p.mlbamId}`);
      console.log(`    positions: ${JSON.stringify(p.positions || p.position)}`);
      console.log(`    status: ${p.status}`);
      if (p.status === 'drafted' || p.winningBid) {
        console.log(`    winningBid: $${p.winningBid || p.winning_bid || 'N/A'}`);
        console.log(`    winningTeam: ${p.winningTeam || p.winning_team || p.teamname || 'N/A'}`);
      }
    });
  } else {
    console.log('  NOT FOUND in scraped room data');
  }
}

// Check matchedPlayers for Max Muncy
if (roomData.matchedPlayers) {
  const maxMuncyMatched = roomData.matchedPlayers.filter(mp => {
    const scrapedName = normalizeName(mp.scrapedPlayer?.fullName || '');
    return scrapedName === 'max muncy';
  });
  console.log('\nMax Muncy in matchedPlayers:');
  if (maxMuncyMatched.length > 0) {
    maxMuncyMatched.forEach(mp => {
      console.log('  scrapedPlayer:', mp.scrapedPlayer?.fullName, `(${mp.scrapedPlayer?.mlbTeam})`);
      console.log('    couchManagersId:', mp.scrapedPlayer?.couchManagersId);
      console.log('    mlbamId:', mp.scrapedPlayer?.mlbamId);
      console.log('    status:', mp.scrapedPlayer?.status);
      console.log('    winningBid:', mp.scrapedPlayer?.winningBid);
      console.log('  projectionPlayerId:', mp.projectionPlayerId);
      console.log('  projectedValue:', mp.projectedValue);
      console.log('  matchConfidence:', mp.matchConfidence);
    });
  } else {
    console.log('  NOT FOUND in matchedPlayers');
  }
}

// Check unmatchedPlayers for Max Muncy
if (roomData.unmatchedPlayers) {
  const maxMuncyUnmatched = roomData.unmatchedPlayers.filter(up => {
    const name = normalizeName(up.fullName || '');
    return name === 'max muncy';
  });
  console.log('\nMax Muncy in unmatchedPlayers:');
  if (maxMuncyUnmatched.length > 0) {
    maxMuncyUnmatched.forEach(up => console.log('  ', JSON.stringify(up, null, 2)));
  } else {
    console.log('  NOT in unmatchedPlayers');
  }
}

// Summary of potential issues
console.log('\n=== POTENTIAL ISSUES ===');

// Check if mlbamId matching is working
const nolanProj = nolanInProjections[0];
if (nolanProj && roomData.matchedPlayers) {
  const nolanMatch = roomData.matchedPlayers.find(mp =>
    mp.projectionPlayerId === nolanProj.externalId
  );
  if (!nolanMatch) {
    console.log('1. Nolan McLean: projectionPlayerId lookup might be failing');
    console.log(`   Expected projectionPlayerId: ${nolanProj.externalId}`);
  }
}

// Check Max Muncy ATH isInDraftPool
const maxMuncyATH = maxMuncyInProjections.find(p => p.team === 'ATH' || p.team === 'OAK');
if (maxMuncyATH) {
  console.log(`2. Max Muncy (ATH): isInDraftPool = ${maxMuncyATH.isInDraftPool}`);
  if (!maxMuncyATH.isInDraftPool) {
    console.log('   This player is filtered out from initialPlayers!');
  }
}

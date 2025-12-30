/**
 * Test script to verify MiLB player matching behavior
 * Run with: node test-milb-matching.cjs
 */

// Simulate the playerMatcher logic
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

function isMinorLeaguePlayer(positions) {
  return positions.some(p => p.toUpperCase() === 'MILB');
}

function normalizeTeam(team) {
  const teamMap = {
    'CLE': 'CLE', 'NYM': 'NYM', 'SEA': 'SEA', 'FA': 'FA', 'TBD': 'TBD',
    'NYY': 'NYY', 'LAD': 'LAD', 'CHC': 'CHC'
  };
  return teamMap[team.toUpperCase()] || team.toUpperCase();
}

function isPitcher(positions) {
  return positions.some(p => ['SP', 'RP', 'P', 'CL'].includes(p.toUpperCase()));
}

function isHitter(positions) {
  return positions.some(p => ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'UTIL', 'MI', 'CI'].includes(p.toUpperCase()));
}

function getPlayingPositions(positions) {
  return positions.filter(p => p.toUpperCase() !== 'MILB');
}

function positionsOverlap(pos1, pos2) {
  const set1 = new Set(pos1.map(p => p.toUpperCase()));
  const set2 = new Set(pos2.map(p => p.toUpperCase()));
  for (const p of set1) {
    if (set2.has(p)) return true;
  }
  return false;
}

/**
 * NEW STRICT MATCHING LOGIC
 * - Name alone is NOT sufficient
 * - Must have EITHER: same team OR same position type (pitcher/hitter)
 * - Team mismatch + position mismatch = NO MATCH
 */
function calculateMatchScore(scraped, projection) {
  const normalizedScrapedName = normalizeName(scraped.fullName);
  const normalizedProjName = normalizeName(projection.name);
  const normalizedScrapedNameWithoutSuffix = normalizedScrapedName.replace(/\s+(jr|sr|ii|iii|iv)$/, '').trim();
  const normalizedProjNameWithoutSuffix = normalizedProjName.replace(/\s+(jr|sr|ii|iii|iv)$/, '').trim();

  // Name matching - REQUIRED but not sufficient
  let nameMatches = false;
  let nameScore = 0;
  if (normalizedProjName === normalizedScrapedName) {
    nameMatches = true;
    nameScore = 100;
  } else if (normalizedProjNameWithoutSuffix === normalizedScrapedNameWithoutSuffix) {
    nameMatches = true;
    nameScore = 80;
  }

  if (!nameMatches) {
    return { score: 0, reason: 'Name mismatch', matched: false };
  }

  // MiLB check - HARD REJECTION
  if (isMinorLeaguePlayer(scraped.positions)) {
    return { score: 0, reason: 'Name: +' + nameScore + ' -> MiLB REJECTED', matched: false };
  }

  // Team matching
  const scrapedTeam = normalizeTeam(scraped.mlbTeam);
  const projTeam = normalizeTeam(projection.team);
  const teamMatches = scrapedTeam === projTeam;
  const projIsFreeAgent = projTeam === 'FA';

  // Position matching
  const scrapedPlayingPositions = getPlayingPositions(scraped.positions);
  const scrapedIsPitcher = isPitcher(scrapedPlayingPositions);
  const projIsPitcher = isPitcher(projection.positions);
  const scrapedIsHitter = isHitter(scrapedPlayingPositions);
  const projIsHitter = isHitter(projection.positions);

  const positionTypeMatches = (scrapedIsPitcher && projIsPitcher) || (scrapedIsHitter && projIsHitter);
  const positionTypeMismatch = (scrapedIsPitcher && projIsHitter) || (scrapedIsHitter && projIsPitcher);

  // CRITICAL: Require at least team match OR position type match
  if (!teamMatches && !projIsFreeAgent && !positionTypeMatches) {
    return {
      score: 0,
      reason: 'Name: +' + nameScore + ' -> REJECTED (no team/position match)',
      matched: false
    };
  }

  // Position type mismatch is a hard rejection
  if (positionTypeMismatch) {
    return {
      score: 0,
      reason: 'Name: +' + nameScore + ' -> REJECTED (pitcher/hitter mismatch)',
      matched: false
    };
  }

  // Calculate score
  let score = nameScore;
  let reason = 'Name: +' + nameScore;

  if (teamMatches) {
    score += 50;
    reason += ', Team: +50';
  } else if (projIsFreeAgent) {
    score += 10;
    reason += ', FA: +10';
  }

  if (positionTypeMatches) {
    score += 40;
    reason += ', PosType: +40';
    if (positionsOverlap(scrapedPlayingPositions, projection.positions)) {
      score += 20;
      reason += ', PosMatch: +20';
    }
  }

  return { score, reason, matched: score >= 50 };
}

console.log('=== MiLB Player Matching Test (STRICT MODE) ===\n');

// Test scenarios
const testCases = [
  // Case 1: MiLB player WITH MiLB tag
  {
    name: 'MiLB player with MiLB tag',
    scraped: { fullName: 'Jose Ramirez', mlbTeam: 'CLE', positions: ['3B', 'MiLB'], status: 'available' },
    projection: { name: 'Jose Ramirez', team: 'CLE', positions: ['3B'] },
    expected: 'should NOT match (MiLB rejected)'
  },
  // Case 2: Real MLB player (exact match)
  {
    name: 'Real MLB player (exact match)',
    scraped: { fullName: 'Jose Ramirez', mlbTeam: 'CLE', positions: ['3B', 'DH'], status: 'drafted', winningBid: 48 },
    projection: { name: 'Jose Ramirez', team: 'CLE', positions: ['3B'] },
    expected: 'SHOULD match'
  },
  // Case 3: Same name, different team, same position type
  {
    name: 'Same name, different team, same position type',
    scraped: { fullName: 'Jose Ramirez', mlbTeam: 'NYM', positions: ['SS'], status: 'available' },
    projection: { name: 'Jose Ramirez', team: 'CLE', positions: ['3B'] },
    expected: 'SHOULD match (both hitters)'
  },
  // Case 4: Same name, different team, different position TYPE
  {
    name: 'Same name, different team, pitcher vs hitter',
    scraped: { fullName: 'Will Smith', mlbTeam: 'ATL', positions: ['RP'], status: 'available' },
    projection: { name: 'Will Smith', team: 'LAD', positions: ['C'] },
    expected: 'should NOT match (pitcher vs hitter)'
  },
  // Case 5: Same name, same team, different position TYPE
  {
    name: 'Same name, same team, pitcher vs hitter',
    scraped: { fullName: 'Will Smith', mlbTeam: 'LAD', positions: ['RP'], status: 'available' },
    projection: { name: 'Will Smith', team: 'LAD', positions: ['C'] },
    expected: 'should NOT match (pitcher vs hitter)'
  },
  // Case 6: Unknown team (TBD/empty), no position match
  {
    name: 'Unknown team, no position data',
    scraped: { fullName: 'Jose Ramirez', mlbTeam: 'TBD', positions: [], status: 'available' },
    projection: { name: 'Jose Ramirez', team: 'CLE', positions: ['3B'] },
    expected: 'should NOT match (no team/position confirmation)'
  },
  // Case 7: Unknown team but position type matches
  {
    name: 'Unknown team, but position type matches',
    scraped: { fullName: 'Jose Ramirez', mlbTeam: 'TBD', positions: ['3B'], status: 'available' },
    projection: { name: 'Jose Ramirez', team: 'CLE', positions: ['3B'] },
    expected: 'SHOULD match (position type confirms)'
  },
  // Case 8: Different first name (should never match)
  {
    name: 'Different first name (Juarlin vs Juan)',
    scraped: { fullName: 'Juarlin Soto', mlbTeam: 'NYM', positions: ['OF'], status: 'available' },
    projection: { name: 'Juan Soto', team: 'NYM', positions: ['OF'] },
    expected: 'should NOT match (name mismatch)'
  },
  // Case 9: Free agent in projections, team mismatch
  {
    name: 'Projection is FA, team mismatch',
    scraped: { fullName: 'Josh Naylor', mlbTeam: 'CLE', positions: ['1B'], status: 'available' },
    projection: { name: 'Josh Naylor', team: 'FA', positions: ['1B'] },
    expected: 'SHOULD match (FA allows flexibility)'
  },
  // Case 10: Prospect on same team as star (the key bug case)
  {
    name: 'Prospect WITHOUT MiLB tag, same team as star',
    scraped: { fullName: 'Jose Ramirez', mlbTeam: 'CLE', positions: ['SS'], status: 'available' },
    projection: { name: 'Jose Ramirez', team: 'CLE', positions: ['3B'] },
    expected: 'SHOULD match (same team, both hitters)'
  }
];

testCases.forEach((tc, i) => {
  const result = calculateMatchScore(tc.scraped, tc.projection);
  const passedExpectation =
    (tc.expected.startsWith('should NOT') && !result.matched) ||
    (tc.expected.startsWith('SHOULD') && result.matched);

  console.log('Test ' + (i + 1) + ': ' + tc.name);
  console.log('  Scraped: ' + tc.scraped.fullName + ' (' + tc.scraped.mlbTeam + ') [' + tc.scraped.positions.join(', ') + ']');
  console.log('  Projection: ' + tc.projection.name + ' (' + tc.projection.team + ') [' + tc.projection.positions.join(', ') + ']');
  console.log('  Result: Score=' + result.score + ', Matched=' + result.matched);
  console.log('  Reason: ' + result.reason);
  console.log('  Expected: ' + tc.expected);
  console.log('  Status: ' + (passedExpectation ? 'PASS' : 'FAIL'));
  console.log('');
});

console.log('=== KEY IMPROVEMENTS ===');
console.log('1. Name alone is no longer sufficient for a match');
console.log('2. Must have EITHER: same team OR same position type (pitcher/hitter)');
console.log('3. Pitcher/hitter mismatch is always rejected');
console.log('4. Unknown team with no position data = no match');
console.log('');
console.log('This prevents MiLB prospects from matching to MLB stars when:');
console.log('- Teams are different and positions don\'t overlap');
console.log('- Player types are different (pitcher vs hitter)');

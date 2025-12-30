/**
 * Analyze Room 1363 Auction Results
 * Compare projected auction values vs actual winning bids
 * to understand why dynasty integration may have caused inflation issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetchSteamerProjections } from '../services/projectionsService';
import { calculateAuctionValues } from '../services/valueCalculator';
import { getDynastyRankings, matchDynastyRankingsToProjections } from '../services/dynastyRankingsScraper';
import type { LeagueSettings } from '../../src/lib/types';

interface AuctionPlayer {
  couchManagersId: number;
  fullName: string;
  normalizedName: string;
  positions: string[];
  mlbTeam: string;
  status: 'drafted' | 'available';
  winningBid?: number;
  winningTeam?: string;
  stats?: Record<string, string | number>;
}

interface AuctionData {
  roomId: string;
  status: string;
  players: AuctionPlayer[];
}

async function analyzeRoom1363() {
  console.log('='.repeat(80));
  console.log('ROOM 1363 AUCTION ANALYSIS');
  console.log('='.repeat(80));

  // Load room data
  const roomDataPath = path.join(process.cwd(), 'room_1363_data.json');
  const roomData: AuctionData = JSON.parse(fs.readFileSync(roomDataPath, 'utf-8'));

  const draftedPlayers = roomData.players.filter(p => p.status === 'drafted' && p.winningBid);
  console.log(`\nTotal players in room: ${roomData.players.length}`);
  console.log(`Drafted players: ${draftedPlayers.length}`);

  // Calculate total money spent
  const totalSpent = draftedPlayers.reduce((sum, p) => sum + (p.winningBid || 0), 0);
  console.log(`Total money spent: $${totalSpent}`);

  // Get Steamer projections
  console.log('\nFetching Steamer projections...');
  const projections = await fetchSteamerProjections();
  console.log(`Loaded ${projections.length} projections`);

  // Get Dynasty rankings
  console.log('\nFetching Dynasty rankings...');
  const dynastyRankings = await getDynastyRankings();
  console.log(`Loaded ${dynastyRankings.length} dynasty rankings`);

  // Default league settings (typical 12-team auction)
  const leagueSettings: LeagueSettings = {
    leagueName: 'Analysis League',
    couchManagerRoomId: '',
    numTeams: 12,
    budgetPerTeam: 260,
    rosterSpots: {
      C: 1,
      '1B': 1,
      '2B': 1,
      '3B': 1,
      SS: 1,
      OF: 3,
      CI: 1,
      MI: 1,
      UTIL: 1,
      SP: 2,
      RP: 2,
      P: 3,
      Bench: 3,
    },
    scoringType: 'rotisserie',
    hittingCategories: { R: true, HR: true, RBI: true, SB: true, AVG: true },
    pitchingCategories: { W: true, K: true, ERA: true, WHIP: true, SV: true },
    projectionSystem: 'steamer',
    leagueType: 'redraft',
  };

  // Calculate REDRAFT values (Steamer only)
  console.log('\n--- REDRAFT VALUES (Steamer Only) ---');
  const redraftResult = calculateAuctionValues(projections, leagueSettings);

  // Calculate DYNASTY values (blended)
  const dynastySettings: LeagueSettings = {
    ...leagueSettings,
    leagueType: 'dynasty',
    dynastySettings: {
      dynastyWeight: 0.5,
      includeMinors: true,
      rankingsSource: 'harryknowsball',
    },
  };

  console.log('\n--- DYNASTY VALUES (Blended) ---');
  const dynastyResult = calculateAuctionValues(projections, dynastySettings, dynastyRankings);

  // Match auction players to projections
  console.log('\n\n' + '='.repeat(80));
  console.log('PLAYER-BY-PLAYER COMPARISON');
  console.log('='.repeat(80));

  const comparisons: Array<{
    name: string;
    positions: string[];
    actualBid: number;
    redraftValue: number;
    dynastyValue: number;
    dynastyRank?: number;
    redraftDiff: number;
    dynastyDiff: number;
  }> = [];

  // Helper to normalize names (strip accents, lowercase)
  const normalizeName = (name: string): string => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  for (const auctionPlayer of draftedPlayers) {
    const name = normalizeName(auctionPlayer.fullName);

    // Find in redraft values (with proper normalization)
    const redraftPlayer = redraftResult.players.find(p => {
      const pName = normalizeName(p.name);
      return pName === name || pName.includes(name) || name.includes(pName);
    });

    // Find in dynasty values (with proper normalization)
    const dynastyPlayer = dynastyResult.players.find(p => {
      const pName = normalizeName(p.name);
      return pName === name || pName.includes(name) || name.includes(pName);
    });

    const actualBid = auctionPlayer.winningBid || 0;
    const redraftValue = redraftPlayer?.auctionValue || 0;
    const dynastyValue = dynastyPlayer?.auctionValue || 0;

    comparisons.push({
      name: auctionPlayer.fullName,
      positions: auctionPlayer.positions,
      actualBid,
      redraftValue,
      dynastyValue,
      dynastyRank: (dynastyPlayer as any)?.dynastyRank,
      redraftDiff: actualBid - redraftValue,
      dynastyDiff: actualBid - dynastyValue,
    });
  }

  // Sort by actual bid (highest first)
  comparisons.sort((a, b) => b.actualBid - a.actualBid);

  // Print comparison table
  console.log('\n%-25s | %5s | %7s | %7s | %7s | %7s | %8s'.replace(/%(\d+)s/g, (_, n) => `%${n}s`));
  console.log('Player'.padEnd(25) + ' | ' + 'Pos'.padEnd(5) + ' | ' + 'Actual'.padEnd(7) + ' | ' + 'Redraft'.padEnd(7) + ' | ' + 'Dynasty'.padEnd(7) + ' | ' + 'R-Diff'.padEnd(7) + ' | ' + 'D-Diff'.padEnd(8));
  console.log('-'.repeat(80));

  for (const c of comparisons) {
    const posStr = c.positions.slice(0, 2).join('/');
    const rDiff = c.redraftDiff >= 0 ? `+${c.redraftDiff}` : `${c.redraftDiff}`;
    const dDiff = c.dynastyDiff >= 0 ? `+${c.dynastyDiff}` : `${c.dynastyDiff}`;

    console.log(
      c.name.padEnd(25).slice(0, 25) + ' | ' +
      posStr.padEnd(5) + ' | ' +
      `$${c.actualBid}`.padEnd(7) + ' | ' +
      `$${c.redraftValue}`.padEnd(7) + ' | ' +
      `$${c.dynastyValue}`.padEnd(7) + ' | ' +
      rDiff.padEnd(7) + ' | ' +
      dDiff.padEnd(8)
    );
  }

  // Calculate summary statistics
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));

  const totalActual = comparisons.reduce((s, c) => s + c.actualBid, 0);
  const totalRedraft = comparisons.reduce((s, c) => s + c.redraftValue, 0);
  const totalDynasty = comparisons.reduce((s, c) => s + c.dynastyValue, 0);

  console.log(`\nTotal Actual Spending:    $${totalActual}`);
  console.log(`Total Redraft Projected:  $${totalRedraft}`);
  console.log(`Total Dynasty Projected:  $${totalDynasty}`);

  const avgRedraftDiff = comparisons.reduce((s, c) => s + c.redraftDiff, 0) / comparisons.length;
  const avgDynastyDiff = comparisons.reduce((s, c) => s + c.dynastyDiff, 0) / comparisons.length;

  console.log(`\nAvg Redraft Difference:   ${avgRedraftDiff >= 0 ? '+' : ''}${avgRedraftDiff.toFixed(2)}`);
  console.log(`Avg Dynasty Difference:   ${avgDynastyDiff >= 0 ? '+' : ''}${avgDynastyDiff.toFixed(2)}`);

  // Find biggest misses
  console.log('\n\n' + '='.repeat(80));
  console.log('BIGGEST REDRAFT MISSES (Actual >> Projected)');
  console.log('='.repeat(80));

  const biggestMisses = [...comparisons].sort((a, b) => b.redraftDiff - a.redraftDiff).slice(0, 10);
  for (const c of biggestMisses) {
    console.log(`${c.name}: Actual $${c.actualBid}, Projected $${c.redraftValue}, Diff +$${c.redraftDiff}`);
  }

  // Analyze inflation by position
  console.log('\n\n' + '='.repeat(80));
  console.log('INFLATION BY POSITION');
  console.log('='.repeat(80));

  const positionGroups: Record<string, typeof comparisons> = {};
  for (const c of comparisons) {
    const primaryPos = c.positions[0] || 'UTIL';
    if (!positionGroups[primaryPos]) {
      positionGroups[primaryPos] = [];
    }
    positionGroups[primaryPos].push(c);
  }

  for (const [pos, players] of Object.entries(positionGroups)) {
    const avgActual = players.reduce((s, p) => s + p.actualBid, 0) / players.length;
    const avgProjected = players.reduce((s, p) => s + p.redraftValue, 0) / players.length;
    const inflationPct = avgProjected > 0 ? ((avgActual - avgProjected) / avgProjected * 100) : 0;

    console.log(`${pos.padEnd(5)}: ${players.length} players, Avg Actual $${avgActual.toFixed(0)}, Avg Proj $${avgProjected.toFixed(0)}, Inflation ${inflationPct >= 0 ? '+' : ''}${inflationPct.toFixed(1)}%`);
  }

  // Overall inflation analysis
  console.log('\n\n' + '='.repeat(80));
  console.log('KEY INSIGHTS');
  console.log('='.repeat(80));

  const overallInflation = totalRedraft > 0 ? ((totalActual - totalRedraft) / totalRedraft * 100) : 0;
  console.log(`\n1. Overall Inflation: ${overallInflation >= 0 ? '+' : ''}${overallInflation.toFixed(1)}%`);

  const playersAboveProjected = comparisons.filter(c => c.redraftDiff > 0).length;
  const playersBelowProjected = comparisons.filter(c => c.redraftDiff < 0).length;
  console.log(`2. Players above projected: ${playersAboveProjected}/${comparisons.length}`);
  console.log(`3. Players below projected: ${playersBelowProjected}/${comparisons.length}`);

  // Check if this is actually a redraft or dynasty league
  console.log('\n\n' + '='.repeat(80));
  console.log('RECOMMENDATION');
  console.log('='.repeat(80));

  console.log(`
Based on the analysis:

1. If room 1363 is a REDRAFT league, the redraft projections should be used.
   - Current average inflation suggests league members are paying ${overallInflation.toFixed(1)}% above
     single-season projected value.
   - This is normal in real auctions due to scarcity, positional needs, and personal preference.

2. If room 1363 is a DYNASTY league:
   - The dynasty adjustments add ~${((totalDynasty - totalRedraft) / totalRedraft * 100).toFixed(1)}% to total value.
   - Young stars (Julio Rodriguez, Elly De La Cruz, etc.) should command dynasty premiums.
   - Older players should see discounts.

3. The VALUE CALCULATOR may need adjustments:
   - The blendedScore calculation mixes normalized values incorrectly
   - SGP/points values are on different scales than dynasty normalized values (0-100)
   - Age adjustments may be too aggressive

SUGGESTED FIX: Review the blending formula in calculateDynastyAdjustedValues()
  `);
}

analyzeRoom1363().catch(console.error);

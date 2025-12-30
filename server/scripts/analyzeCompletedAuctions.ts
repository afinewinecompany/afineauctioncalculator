/**
 * Comprehensive Auction Inflation Analysis Script
 *
 * Analyzes completed fantasy baseball auctions from CouchManagers to identify inflation patterns:
 * - Overall inflation rates
 * - Inflation by player tier (1-10)
 * - Inflation by position
 * - Inflation by dollar value range ($1-5, $6-15, $16-30, $31+)
 * - Statistical analysis with confidence intervals and effect sizes
 */

import { scrapeAuction, closeBrowser } from '../services/couchManagersScraper';
import { getCachedProjections } from '../services/projectionsCacheService';
import { calculateAuctionValues } from '../services/valueCalculator';
import { matchAllPlayers } from '../services/playerMatcher';
import { calculateInflationStats } from '../services/inflationCalculator';
import type { ScrapedAuctionData, MatchedPlayer, TierInflationData } from '../types/auction';
import type { NormalizedProjection, PlayerWithValue } from '../types/projections';
import type { LeagueSettings } from '../../src/lib/types';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Auction IDs to analyze
const AUCTION_IDS = ['1358', '1351', '1200', '1201', '34', '968'];

// Standard league configuration assumptions (can be overridden per auction)
const DEFAULT_LEAGUE_SETTINGS: LeagueSettings = {
  leagueName: 'Analysis League',
  couchManagerRoomId: '',
  numTeams: 12,
  budgetPerTeam: 260,
  rosterSpots: {
    C: 2,
    '1B': 1,
    '2B': 1,
    '3B': 1,
    SS: 1,
    OF: 5,
    CI: 1,
    MI: 1,
    UTIL: 1,
    SP: 6,
    RP: 3,
    P: 0,
    Bench: 3,
  },
  leagueType: 'redraft',
  scoringType: 'rotisserie',
  projectionSystem: 'steamer',
  hittingCategories: {
    R: true,
    HR: true,
    RBI: true,
    SB: true,
    AVG: true,
  },
  pitchingCategories: {
    W: true,
    K: true,
    ERA: true,
    WHIP: true,
    SV: true,
  },
};

interface PriceRangeInflation {
  range: string;
  minPrice: number;
  maxPrice: number;
  count: number;
  avgProjectedValue: number;
  avgActualSpent: number;
  inflationRate: number;
  totalProjectedValue: number;
  totalActualSpent: number;
}

interface PositionInflation {
  position: string;
  count: number;
  avgProjectedValue: number;
  avgActualSpent: number;
  inflationRate: number;
  totalProjectedValue: number;
  totalActualSpent: number;
}

interface AuctionAnalysis {
  auctionId: string;
  scrapedAt: string;
  numTeams: number;
  budgetPerTeam: number;
  totalRosterSpots: number;
  totalPlayersDrafted: number;
  totalMoneySpent: number;
  matchedPlayersCount: number;
  unmatchedPlayersCount: number;

  // Overall inflation
  overallInflationRate: number;
  weightedInflationRate: number;
  totalProjectedValue: number;
  totalActualSpent: number;

  // Tier-based inflation
  tierInflation: TierInflationData[];

  // Position-based inflation
  positionInflation: PositionInflation[];

  // Price range inflation
  priceRangeInflation: PriceRangeInflation[];

  // Top overvalued and undervalued players
  topOvervalued: Array<{
    name: string;
    positions: string[];
    projectedValue: number;
    actualBid: number;
    inflationAmount: number;
    inflationPercent: number;
  }>;
  topUndervalued: Array<{
    name: string;
    positions: string[];
    projectedValue: number;
    actualBid: number;
    inflationAmount: number;
    inflationPercent: number;
  }>;
}

interface AggregateAnalysis {
  totalAuctions: number;
  successfulAuctions: number;

  // Aggregate statistics
  avgOverallInflationRate: number;
  stdDevInflationRate: number;
  minInflationRate: number;
  maxInflationRate: number;

  // Tier analysis across all auctions
  aggregateTierInflation: Array<{
    tier: number;
    avgInflationRate: number;
    stdDevInflationRate: number;
    totalCount: number;
  }>;

  // Position analysis across all auctions
  aggregatePositionInflation: Array<{
    position: string;
    avgInflationRate: number;
    stdDevInflationRate: number;
    totalCount: number;
  }>;

  // Price range analysis across all auctions
  aggregatePriceRangeInflation: Array<{
    range: string;
    avgInflationRate: number;
    stdDevInflationRate: number;
    totalCount: number;
  }>;

  // Key findings
  findings: string[];
}

/**
 * Main analysis function
 */
async function analyzeAuctions(): Promise<void> {
  console.log('Starting comprehensive auction inflation analysis...\n');

  // Load cached projections
  console.log('Loading cached projections...');
  const cachedProjections = await getCachedProjections('steamer');

  if (!cachedProjections) {
    throw new Error('No cached projections found. Please fetch projections first.');
  }

  const projections = cachedProjections.projections;
  console.log(`Loaded ${projections.length} projections (${cachedProjections.metadata.hitterCount} hitters, ${cachedProjections.metadata.pitcherCount} pitchers)\n`);

  // Calculate values for all projections
  console.log('Calculating auction values...');
  const calculatedValues = calculateAuctionValues(projections, DEFAULT_LEAGUE_SETTINGS);
  const playersWithValues = calculatedValues.players;
  console.log(`Calculated values for ${playersWithValues.length} players\n`);

  // Analyze each auction
  const analyses: AuctionAnalysis[] = [];

  for (const auctionId of AUCTION_IDS) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Analyzing Auction ${auctionId}...`);
      console.log('='.repeat(60));

      const analysis = await analyzeAuction(auctionId, playersWithValues);
      analyses.push(analysis);

      console.log(`✓ Successfully analyzed Auction ${auctionId}`);
      console.log(`  - ${analysis.matchedPlayersCount} players matched`);
      console.log(`  - Overall inflation: ${analysis.overallInflationRate.toFixed(2)}%`);

    } catch (error) {
      console.error(`✗ Failed to analyze Auction ${auctionId}:`, error);
    }
  }

  // Close browser
  await closeBrowser();

  if (analyses.length === 0) {
    throw new Error('No auctions were successfully analyzed');
  }

  // Aggregate analysis across all auctions
  console.log('\n\nComputing aggregate statistics...');
  const aggregateAnalysis = computeAggregateAnalysis(analyses);

  // Save results
  const outputDir = path.join(process.cwd(), 'server/analysis');

  const jsonOutput = {
    metadata: {
      analyzedAt: new Date().toISOString(),
      projectionSystem: 'steamer',
      totalAuctions: analyses.length,
    },
    auctions: analyses,
    aggregate: aggregateAnalysis,
  };

  const jsonPath = path.join(outputDir, 'auction-inflation-analysis.json');
  await fs.writeFile(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`\n✓ Saved JSON results to: ${jsonPath}`);

  // Generate markdown summary
  const markdown = generateMarkdownSummary(jsonOutput);
  const markdownPath = path.join(outputDir, 'INFLATION_FINDINGS.md');
  await fs.writeFile(markdownPath, markdown);
  console.log(`✓ Saved markdown summary to: ${markdownPath}`);

  console.log('\n\nAnalysis complete!');
}

/**
 * Analyze a single auction
 */
async function analyzeAuction(
  auctionId: string,
  playersWithValues: PlayerWithValue[]
): Promise<AuctionAnalysis> {
  // Scrape auction data
  console.log(`  Scraping auction data...`);
  const scrapedData = await scrapeAuction(auctionId);

  if (scrapedData.status === 'not_found') {
    throw new Error(`Auction ${auctionId} not found`);
  }

  // Infer league settings from scraped data
  const leagueSettings = inferLeagueSettings(scrapedData);
  console.log(`  Detected ${leagueSettings.numTeams} teams, $${leagueSettings.budgetPerTeam} budget`);

  // Match players against projections
  console.log(`  Matching players...`);
  const projectionsForMatching = playersWithValues.map(p => ({
    id: p.externalId,
    name: p.name,
    team: p.team,
    positions: p.positions,
    projectedValue: p.auctionValue,
  }));

  const { matched, unmatched } = matchAllPlayers(
    scrapedData.players.filter(p => p.status === 'drafted'),
    projectionsForMatching
  );

  console.log(`  Matched ${matched.length}/${scrapedData.players.filter(p => p.status === 'drafted').length} drafted players`);

  // Calculate inflation stats
  const inflationStats = calculateInflationStats(
    matched,
    {
      numTeams: leagueSettings.numTeams,
      budgetPerTeam: leagueSettings.budgetPerTeam,
      totalRosterSpots: calculateTotalRosterSpots(leagueSettings),
      rosterSpots: leagueSettings.rosterSpots,
    },
    scrapedData.teams
  );

  // Analyze by position
  const positionInflation = analyzeByPosition(matched);

  // Analyze by price range
  const priceRangeInflation = analyzeByPriceRange(matched);

  // Find top overvalued/undervalued players
  const sortedByInflationAmount = [...matched]
    .filter(p => p.inflationAmount !== null && p.projectedValue !== null)
    .sort((a, b) => (b.inflationAmount || 0) - (a.inflationAmount || 0));

  const topOvervalued = sortedByInflationAmount.slice(0, 10).map(p => ({
    name: p.scrapedPlayer.fullName,
    positions: p.scrapedPlayer.positions,
    projectedValue: p.projectedValue || 0,
    actualBid: p.actualBid || 0,
    inflationAmount: p.inflationAmount || 0,
    inflationPercent: p.inflationPercent || 0,
  }));

  const topUndervalued = sortedByInflationAmount.slice(-10).reverse().map(p => ({
    name: p.scrapedPlayer.fullName,
    positions: p.scrapedPlayer.positions,
    projectedValue: p.projectedValue || 0,
    actualBid: p.actualBid || 0,
    inflationAmount: p.inflationAmount || 0,
    inflationPercent: p.inflationPercent || 0,
  }));

  return {
    auctionId,
    scrapedAt: scrapedData.scrapedAt,
    numTeams: leagueSettings.numTeams,
    budgetPerTeam: leagueSettings.budgetPerTeam,
    totalRosterSpots: calculateTotalRosterSpots(leagueSettings),
    totalPlayersDrafted: scrapedData.totalPlayersDrafted,
    totalMoneySpent: scrapedData.totalMoneySpent,
    matchedPlayersCount: matched.length,
    unmatchedPlayersCount: unmatched.length,
    overallInflationRate: inflationStats.overallInflationRate,
    weightedInflationRate: inflationStats.weightedInflationRate || inflationStats.overallInflationRate,
    totalProjectedValue: inflationStats.totalProjectedValue,
    totalActualSpent: inflationStats.totalActualSpent,
    tierInflation: inflationStats.tierInflation || [],
    positionInflation,
    priceRangeInflation,
    topOvervalued,
    topUndervalued,
  };
}

/**
 * Analyze inflation by position
 */
function analyzeByPosition(matched: MatchedPlayer[]): PositionInflation[] {
  const positionMap = new Map<string, MatchedPlayer[]>();

  // Group players by position (multi-position players counted for each position)
  matched.forEach(player => {
    if (player.projectedValue !== null && player.actualBid !== null) {
      player.scrapedPlayer.positions.forEach(pos => {
        if (!positionMap.has(pos)) {
          positionMap.set(pos, []);
        }
        positionMap.get(pos)!.push(player);
      });
    }
  });

  const results: PositionInflation[] = [];

  positionMap.forEach((players, position) => {
    const totalProjectedValue = players.reduce((sum, p) => sum + (p.projectedValue || 0), 0);
    const totalActualSpent = players.reduce((sum, p) => sum + (p.actualBid || 0), 0);
    const count = players.length;

    const inflationRate = totalProjectedValue > 0
      ? ((totalActualSpent - totalProjectedValue) / totalProjectedValue) * 100
      : 0;

    results.push({
      position,
      count,
      avgProjectedValue: totalProjectedValue / count,
      avgActualSpent: totalActualSpent / count,
      inflationRate,
      totalProjectedValue,
      totalActualSpent,
    });
  });

  return results.sort((a, b) => b.inflationRate - a.inflationRate);
}

/**
 * Analyze inflation by price range
 */
function analyzeByPriceRange(matched: MatchedPlayer[]): PriceRangeInflation[] {
  const ranges = [
    { range: '$1-$5', minPrice: 1, maxPrice: 5 },
    { range: '$6-$15', minPrice: 6, maxPrice: 15 },
    { range: '$16-$30', minPrice: 16, maxPrice: 30 },
    { range: '$31+', minPrice: 31, maxPrice: Infinity },
  ];

  return ranges.map(({ range, minPrice, maxPrice }) => {
    const playersInRange = matched.filter(
      p =>
        p.projectedValue !== null &&
        p.actualBid !== null &&
        p.projectedValue >= minPrice &&
        p.projectedValue <= maxPrice
    );

    const totalProjectedValue = playersInRange.reduce((sum, p) => sum + (p.projectedValue || 0), 0);
    const totalActualSpent = playersInRange.reduce((sum, p) => sum + (p.actualBid || 0), 0);
    const count = playersInRange.length;

    const inflationRate = totalProjectedValue > 0
      ? ((totalActualSpent - totalProjectedValue) / totalProjectedValue) * 100
      : 0;

    return {
      range,
      minPrice,
      maxPrice,
      count,
      avgProjectedValue: count > 0 ? totalProjectedValue / count : 0,
      avgActualSpent: count > 0 ? totalActualSpent / count : 0,
      inflationRate,
      totalProjectedValue,
      totalActualSpent,
    };
  });
}

/**
 * Compute aggregate statistics across all auctions
 */
function computeAggregateAnalysis(analyses: AuctionAnalysis[]): AggregateAnalysis {
  const inflationRates = analyses.map(a => a.overallInflationRate);
  const avgOverallInflationRate = mean(inflationRates);
  const stdDevInflationRate = standardDeviation(inflationRates);

  // Aggregate tier inflation
  const tierMap = new Map<number, number[]>();
  analyses.forEach(auction => {
    auction.tierInflation.forEach(tier => {
      if (!tierMap.has(tier.tier)) {
        tierMap.set(tier.tier, []);
      }
      tierMap.get(tier.tier)!.push(tier.inflationRate);
    });
  });

  const aggregateTierInflation = Array.from(tierMap.entries())
    .map(([tier, rates]) => ({
      tier,
      avgInflationRate: mean(rates),
      stdDevInflationRate: standardDeviation(rates),
      totalCount: rates.length,
    }))
    .sort((a, b) => a.tier - b.tier);

  // Aggregate position inflation
  const positionMap = new Map<string, number[]>();
  analyses.forEach(auction => {
    auction.positionInflation.forEach(pos => {
      if (!positionMap.has(pos.position)) {
        positionMap.set(pos.position, []);
      }
      positionMap.get(pos.position)!.push(pos.inflationRate);
    });
  });

  const aggregatePositionInflation = Array.from(positionMap.entries())
    .map(([position, rates]) => ({
      position,
      avgInflationRate: mean(rates),
      stdDevInflationRate: standardDeviation(rates),
      totalCount: rates.length,
    }))
    .sort((a, b) => b.avgInflationRate - a.avgInflationRate);

  // Aggregate price range inflation
  const rangeMap = new Map<string, number[]>();
  analyses.forEach(auction => {
    auction.priceRangeInflation.forEach(range => {
      if (!rangeMap.has(range.range)) {
        rangeMap.set(range.range, []);
      }
      rangeMap.get(range.range)!.push(range.inflationRate);
    });
  });

  const aggregatePriceRangeInflation = Array.from(rangeMap.entries())
    .map(([range, rates]) => ({
      range,
      avgInflationRate: mean(rates),
      stdDevInflationRate: standardDeviation(rates),
      totalCount: rates.length,
    }));

  // Generate key findings
  const findings = generateFindings(analyses, {
    avgOverallInflationRate,
    aggregateTierInflation,
    aggregatePositionInflation,
    aggregatePriceRangeInflation,
  });

  return {
    totalAuctions: analyses.length,
    successfulAuctions: analyses.length,
    avgOverallInflationRate,
    stdDevInflationRate,
    minInflationRate: Math.min(...inflationRates),
    maxInflationRate: Math.max(...inflationRates),
    aggregateTierInflation,
    aggregatePositionInflation,
    aggregatePriceRangeInflation,
    findings,
  };
}

/**
 * Generate key findings from the analysis
 */
function generateFindings(
  analyses: AuctionAnalysis[],
  aggregate: {
    avgOverallInflationRate: number;
    aggregateTierInflation: Array<{ tier: number; avgInflationRate: number }>;
    aggregatePositionInflation: Array<{ position: string; avgInflationRate: number }>;
    aggregatePriceRangeInflation: Array<{ range: string; avgInflationRate: number }>;
  }
): string[] {
  const findings: string[] = [];

  // Overall inflation finding
  findings.push(
    `Average overall inflation across ${analyses.length} auctions: ${aggregate.avgOverallInflationRate.toFixed(1)}%`
  );

  // Tier with highest inflation
  const highestTier = aggregate.aggregateTierInflation.reduce((max, curr) =>
    curr.avgInflationRate > max.avgInflationRate ? curr : max
  );
  findings.push(
    `Tier ${highestTier.tier} players show highest inflation at ${highestTier.avgInflationRate.toFixed(1)}%`
  );

  // Tier with lowest inflation
  const lowestTier = aggregate.aggregateTierInflation.reduce((min, curr) =>
    curr.avgInflationRate < min.avgInflationRate ? curr : min
  );
  findings.push(
    `Tier ${lowestTier.tier} players show lowest inflation at ${lowestTier.avgInflationRate.toFixed(1)}%`
  );

  // Position with highest inflation
  if (aggregate.aggregatePositionInflation.length > 0) {
    const topPosition = aggregate.aggregatePositionInflation[0];
    findings.push(
      `${topPosition.position} position shows highest inflation at ${topPosition.avgInflationRate.toFixed(1)}%`
    );
  }

  // Price range with highest inflation
  const topPriceRange = aggregate.aggregatePriceRangeInflation.reduce((max, curr) =>
    curr.avgInflationRate > max.avgInflationRate ? curr : max
  );
  findings.push(
    `${topPriceRange.range} price range shows highest inflation at ${topPriceRange.avgInflationRate.toFixed(1)}%`
  );

  // Variability finding
  const inflationRates = analyses.map(a => a.overallInflationRate);
  const stdDev = standardDeviation(inflationRates);
  if (stdDev > 10) {
    findings.push(
      `High variability in inflation across auctions (σ = ${stdDev.toFixed(1)}%) suggests league-specific factors are important`
    );
  } else {
    findings.push(
      `Low variability in inflation across auctions (σ = ${stdDev.toFixed(1)}%) suggests consistent market behavior`
    );
  }

  return findings;
}

/**
 * Infer league settings from scraped auction data
 */
function inferLeagueSettings(scrapedData: ScrapedAuctionData): LeagueSettings {
  const numTeams = scrapedData.teams.length || DEFAULT_LEAGUE_SETTINGS.numTeams;
  const budgetPerTeam = scrapedData.teams.length > 0
    ? scrapedData.teams[0].budget
    : DEFAULT_LEAGUE_SETTINGS.budgetPerTeam;

  // For now, use default roster spots (could be enhanced to infer from data)
  return {
    ...DEFAULT_LEAGUE_SETTINGS,
    couchManagerRoomId: scrapedData.roomId,
    numTeams,
    budgetPerTeam,
  };
}

/**
 * Calculate total roster spots
 */
function calculateTotalRosterSpots(settings: LeagueSettings): number {
  const rs = settings.rosterSpots;
  return (
    rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
    rs.OF + rs.CI + rs.MI + rs.UTIL +
    rs.SP + rs.RP + rs.P + rs.Bench
  );
}

/**
 * Calculate mean of an array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
  const variance = mean(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * Generate markdown summary report
 */
function generateMarkdownSummary(data: any): string {
  const { metadata, auctions, aggregate } = data;

  let md = `# Fantasy Baseball Auction Inflation Analysis\n\n`;
  md += `**Generated:** ${new Date(metadata.analyzedAt).toLocaleString()}\n`;
  md += `**Projection System:** ${metadata.projectionSystem}\n`;
  md += `**Auctions Analyzed:** ${metadata.totalAuctions}\n\n`;

  md += `---\n\n`;

  md += `## Executive Summary\n\n`;
  md += `### Key Findings\n\n`;
  aggregate.findings.forEach((finding: string, i: number) => {
    md += `${i + 1}. ${finding}\n`;
  });
  md += `\n`;

  md += `### Overall Statistics\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Average Inflation Rate | ${aggregate.avgOverallInflationRate.toFixed(2)}% |\n`;
  md += `| Standard Deviation | ${aggregate.stdDevInflationRate.toFixed(2)}% |\n`;
  md += `| Min Inflation | ${aggregate.minInflationRate.toFixed(2)}% |\n`;
  md += `| Max Inflation | ${aggregate.maxInflationRate.toFixed(2)}% |\n`;
  md += `| 95% Confidence Interval | ${(aggregate.avgOverallInflationRate - 1.96 * aggregate.stdDevInflationRate / Math.sqrt(aggregate.totalAuctions)).toFixed(2)}% to ${(aggregate.avgOverallInflationRate + 1.96 * aggregate.stdDevInflationRate / Math.sqrt(aggregate.totalAuctions)).toFixed(2)}% |\n`;
  md += `\n`;

  md += `---\n\n`;

  md += `## Inflation by Player Tier\n\n`;
  md += `Tiers are based on projected value rankings (Tier 1 = top 10%, Tier 10 = bottom 10%)\n\n`;
  md += `| Tier | Avg Inflation | Std Dev | Sample Size |\n`;
  md += `|------|---------------|---------|-------------|\n`;
  aggregate.aggregateTierInflation.forEach((tier: any) => {
    md += `| ${tier.tier} | ${tier.avgInflationRate.toFixed(2)}% | ${tier.stdDevInflationRate.toFixed(2)}% | ${tier.totalCount} |\n`;
  });
  md += `\n`;

  md += `### Tier Insights\n\n`;
  const tiersByInflation = [...aggregate.aggregateTierInflation].sort((a: any, b: any) =>
    b.avgInflationRate - a.avgInflationRate
  );
  md += `- **Highest Inflation:** Tier ${tiersByInflation[0].tier} at ${tiersByInflation[0].avgInflationRate.toFixed(1)}%\n`;
  md += `- **Lowest Inflation:** Tier ${tiersByInflation[tiersByInflation.length - 1].tier} at ${tiersByInflation[tiersByInflation.length - 1].avgInflationRate.toFixed(1)}%\n`;
  md += `- **Inflation Range:** ${(tiersByInflation[0].avgInflationRate - tiersByInflation[tiersByInflation.length - 1].avgInflationRate).toFixed(1)} percentage points\n\n`;

  md += `---\n\n`;

  md += `## Inflation by Position\n\n`;
  md += `| Position | Avg Inflation | Std Dev | Sample Size |\n`;
  md += `|----------|---------------|---------|-------------|\n`;
  aggregate.aggregatePositionInflation.forEach((pos: any) => {
    md += `| ${pos.position} | ${pos.avgInflationRate.toFixed(2)}% | ${pos.stdDevInflationRate.toFixed(2)}% | ${pos.totalCount} |\n`;
  });
  md += `\n`;

  md += `### Position Scarcity Analysis\n\n`;
  const topPositions = aggregate.aggregatePositionInflation.slice(0, 3);
  md += `**Most Inflated Positions:**\n\n`;
  topPositions.forEach((pos: any, i: number) => {
    md += `${i + 1}. **${pos.position}**: ${pos.avgInflationRate.toFixed(1)}% (n=${pos.totalCount})\n`;
  });
  md += `\n`;

  md += `---\n\n`;

  md += `## Inflation by Dollar Value Range\n\n`;
  md += `| Price Range | Avg Inflation | Std Dev | Sample Size |\n`;
  md += `|-------------|---------------|---------|-------------|\n`;
  aggregate.aggregatePriceRangeInflation.forEach((range: any) => {
    md += `| ${range.range} | ${range.avgInflationRate.toFixed(2)}% | ${range.stdDevInflationRate.toFixed(2)}% | ${range.totalCount} |\n`;
  });
  md += `\n`;

  md += `### Value Range Insights\n\n`;
  const rangesByInflation = [...aggregate.aggregatePriceRangeInflation].sort((a: any, b: any) =>
    b.avgInflationRate - a.avgInflationRate
  );
  md += `- **Highest Inflation Range:** ${rangesByInflation[0].range} at ${rangesByInflation[0].avgInflationRate.toFixed(1)}%\n`;
  md += `- **Lowest Inflation Range:** ${rangesByInflation[rangesByInflation.length - 1].range} at ${rangesByInflation[rangesByInflation.length - 1].avgInflationRate.toFixed(1)}%\n\n`;

  md += `---\n\n`;

  md += `## Individual Auction Details\n\n`;
  auctions.forEach((auction: AuctionAnalysis) => {
    md += `### Auction ${auction.auctionId}\n\n`;
    md += `**Configuration:**\n`;
    md += `- Teams: ${auction.numTeams}\n`;
    md += `- Budget: $${auction.budgetPerTeam}\n`;
    md += `- Total Players Drafted: ${auction.totalPlayersDrafted}\n`;
    md += `- Matched Players: ${auction.matchedPlayersCount}\n`;
    md += `- Total Money Spent: $${auction.totalMoneySpent}\n\n`;

    md += `**Inflation Metrics:**\n`;
    md += `- Overall Inflation: ${auction.overallInflationRate.toFixed(2)}%\n`;
    md += `- Weighted Inflation: ${auction.weightedInflationRate.toFixed(2)}%\n`;
    md += `- Total Projected Value: $${auction.totalProjectedValue.toFixed(0)}\n`;
    md += `- Total Actual Spent: $${auction.totalActualSpent.toFixed(0)}\n\n`;

    md += `**Top 5 Overvalued Players:**\n\n`;
    md += `| Player | Position | Projected | Actual | Inflation |\n`;
    md += `|--------|----------|-----------|--------|----------|\n`;
    auction.topOvervalued.slice(0, 5).forEach((player: any) => {
      md += `| ${player.name} | ${player.positions.join('/')} | $${player.projectedValue} | $${player.actualBid} | +$${player.inflationAmount} (${player.inflationPercent.toFixed(0)}%) |\n`;
    });
    md += `\n`;

    md += `**Top 5 Undervalued Players:**\n\n`;
    md += `| Player | Position | Projected | Actual | Discount |\n`;
    md += `|--------|----------|-----------|--------|----------|\n`;
    auction.topUndervalued.slice(0, 5).forEach((player: any) => {
      md += `| ${player.name} | ${player.positions.join('/')} | $${player.projectedValue} | $${player.actualBid} | $${player.inflationAmount} (${player.inflationPercent.toFixed(0)}%) |\n`;
    });
    md += `\n\n`;
  });

  md += `---\n\n`;

  md += `## Statistical Methods\n\n`;
  md += `### Inflation Calculation\n\n`;
  md += `Inflation rate is calculated using weighted averaging to reduce the distorting effect of low-value players:\n\n`;
  md += `- **Players $1-$2**: Weight reduced by 75% (weight = value × 0.25)\n`;
  md += `- **Players $3-$5**: Weight reduced by 50% (weight = value × 0.5)\n`;
  md += `- **Players $6+**: Full weight (weight = value)\n\n`;
  md += `This approach ensures that a $1 player selling for $3 (200% inflation) doesn't disproportionately skew results.\n\n`;

  md += `### Tier Assignment\n\n`;
  md += `Players are grouped into 10 tiers based on their projected value rankings within each auction:\n`;
  md += `- **Tier 1**: Top 10% of players by projected value\n`;
  md += `- **Tier 2**: 10-20% percentile\n`;
  md += `- **Tier 10**: Bottom 10%\n\n`;

  md += `### Confidence Intervals\n\n`;
  md += `95% confidence intervals are calculated using the standard error of the mean across auctions.\n\n`;

  md += `---\n\n`;

  md += `## Recommendations\n\n`;
  md += `Based on this analysis:\n\n`;

  // Generate specific recommendations
  if (aggregate.avgOverallInflationRate > 15) {
    md += `1. **High Inflation Environment**: Average inflation of ${aggregate.avgOverallInflationRate.toFixed(1)}% suggests aggressive bidding. Consider targeting undervalued tiers and positions.\n`;
  } else if (aggregate.avgOverallInflationRate < 5) {
    md += `1. **Low Inflation Environment**: Average inflation of ${aggregate.avgOverallInflationRate.toFixed(1)}% suggests conservative bidding. Top-tier players may offer good value.\n`;
  } else {
    md += `1. **Moderate Inflation**: Average inflation of ${aggregate.avgOverallInflationRate.toFixed(1)}% is within normal range. Standard valuation strategies should work well.\n`;
  }

  const topInflatedTier = tiersByInflation[0];
  md += `2. **Tier Strategy**: Tier ${topInflatedTier.tier} shows ${topInflatedTier.avgInflationRate.toFixed(1)}% inflation - consider fading this tier or budgeting accordingly.\n`;

  const topInflatedPosition = aggregate.aggregatePositionInflation[0];
  md += `3. **Position Strategy**: ${topInflatedPosition.position} shows ${topInflatedPosition.avgInflationRate.toFixed(1)}% inflation - prioritize early or target depth later.\n`;

  const topInflatedRange = rangesByInflation[0];
  md += `4. **Value Range**: ${topInflatedRange.range} players show highest inflation at ${topInflatedRange.avgInflationRate.toFixed(1)}% - adjust bids accordingly in this range.\n`;

  md += `\n---\n\n`;
  md += `*Analysis generated by afineauctioncalculator - Auction Inflation Analysis Script*\n`;

  return md;
}

// Run the analysis
analyzeAuctions()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });

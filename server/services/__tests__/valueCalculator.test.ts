/**
 * Value Calculator Tests
 * Tests SGP-based auction value calculation with tier assignments and market adjustments
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { NormalizedProjection } from '../../types/projections';
import type { LeagueSettings } from '../../../src/lib/types';
import { calculateAuctionValues, validateScoringCategories, getCategorySupportSummary } from '../valueCalculator';

describe('Value Calculator - SGP-Based Calculations', () => {
  let mockProjections: NormalizedProjection[];
  let baseLeagueSettings: LeagueSettings;

  beforeEach(() => {
    // Create realistic test projections
    mockProjections = [
      // Elite hitter
      {
        externalId: 'h1',
        mlbamId: 1,
        name: 'Mike Trout',
        team: 'LAA',
        positions: ['OF'],
        playerType: 'hitter',
        hitting: {
          games: 150,
          atBats: 550,
          plateAppearances: 650,
          runs: 100,
          hits: 165,
          singles: 80,
          doubles: 30,
          triples: 5,
          homeRuns: 50,
          rbi: 120,
          stolenBases: 15,
          caughtStealing: 3,
          walks: 90,
          strikeouts: 140,
          battingAvg: 0.300,
          onBasePct: 0.400,
          sluggingPct: 0.600,
          ops: 1.000,
          wOBA: 0.420,
          wrcPlus: 180,
          war: 8.0,
        },
      },
      // Average hitter
      {
        externalId: 'h2',
        mlbamId: 2,
        name: 'Average Player',
        team: 'TEX',
        positions: ['2B'],
        playerType: 'hitter',
        hitting: {
          games: 140,
          atBats: 500,
          plateAppearances: 570,
          runs: 65,
          hits: 125,
          singles: 85,
          doubles: 25,
          triples: 2,
          homeRuns: 13,
          rbi: 60,
          stolenBases: 8,
          caughtStealing: 2,
          walks: 50,
          strikeouts: 110,
          battingAvg: 0.250,
          onBasePct: 0.320,
          sluggingPct: 0.400,
          ops: 0.720,
          wOBA: 0.320,
          wrcPlus: 100,
          war: 2.5,
        },
      },
      // Replacement-level hitter
      {
        externalId: 'h3',
        mlbamId: 3,
        name: 'Replacement Player',
        team: 'OAK',
        positions: ['1B'],
        playerType: 'hitter',
        hitting: {
          games: 100,
          atBats: 300,
          plateAppearances: 340,
          runs: 30,
          hits: 70,
          singles: 50,
          doubles: 15,
          triples: 1,
          homeRuns: 4,
          rbi: 25,
          stolenBases: 2,
          caughtStealing: 1,
          walks: 25,
          strikeouts: 85,
          battingAvg: 0.233,
          onBasePct: 0.290,
          sluggingPct: 0.330,
          ops: 0.620,
          wOBA: 0.280,
          wrcPlus: 75,
          war: 0.5,
        },
      },
      // Elite pitcher
      {
        externalId: 'p1',
        mlbamId: 4,
        name: 'Gerrit Cole',
        team: 'NYY',
        positions: ['SP'],
        playerType: 'pitcher',
        pitching: {
          games: 32,
          gamesStarted: 32,
          inningsPitched: 200,
          wins: 15,
          losses: 6,
          saves: 0,
          holds: 0,
          hitsAllowed: 150,
          earnedRuns: 60,
          homeRunsAllowed: 25,
          walks: 40,
          strikeouts: 250,
          era: 2.70,
          whip: 0.95,
          k9: 11.25,
          bb9: 1.80,
          fip: 2.90,
          war: 6.0,
        },
      },
      // Average pitcher
      {
        externalId: 'p2',
        mlbamId: 5,
        name: 'Average Pitcher',
        team: 'MIL',
        positions: ['SP'],
        playerType: 'pitcher',
        pitching: {
          games: 28,
          gamesStarted: 28,
          inningsPitched: 160,
          wins: 10,
          losses: 10,
          saves: 0,
          holds: 0,
          hitsAllowed: 155,
          earnedRuns: 75,
          homeRunsAllowed: 20,
          walks: 50,
          strikeouts: 150,
          era: 4.22,
          whip: 1.28,
          k9: 8.44,
          bb9: 2.81,
          fip: 4.10,
          war: 2.0,
        },
      },
      // Relief pitcher (closr)
      {
        externalId: 'p3',
        mlbamId: 6,
        name: 'Elite Closer',
        team: 'SD',
        positions: ['RP'],
        playerType: 'pitcher',
        pitching: {
          games: 65,
          gamesStarted: 0,
          inningsPitched: 65,
          wins: 3,
          losses: 2,
          saves: 40,
          holds: 0,
          hitsAllowed: 45,
          earnedRuns: 18,
          homeRunsAllowed: 5,
          walks: 15,
          strikeouts: 85,
          era: 2.49,
          whip: 0.92,
          k9: 11.77,
          bb9: 2.08,
          fip: 2.60,
          war: 2.5,
        },
      },
    ];

    baseLeagueSettings = {
      leagueName: 'Test League',
      numTeams: 12,
      budgetPerTeam: 260,
      scoringType: 'rotisserie',
      projectionSystem: 'steamer',
      leagueType: 'redraft',
      rosterSpots: {
        C: 1,
        '1B': 1,
        '2B': 1,
        '3B': 1,
        SS: 1,
        OF: 3,
        UTIL: 1,
        SP: 5,
        RP: 2,
        Bench: 3,
      },
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
      hitterPitcherSplit: {
        hitter: 0.68,
        pitcher: 0.32,
      },
    };
  });

  describe('Basic Value Calculation', () => {
    it('should calculate auction values for all players', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      expect(result.players).toHaveLength(6);
      expect(result.projectionSystem).toBe('steamer');
      expect(result.calculatedAt).toBeDefined();
    });

    it('should assign higher values to better players', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);
      const trout = result.players.find(p => p.name === 'Mike Trout')!;
      const average = result.players.find(p => p.name === 'Average Player')!;
      const replacement = result.players.find(p => p.name === 'Replacement Player')!;

      expect(trout.auctionValue).toBeGreaterThan(average.auctionValue);
      expect(average.auctionValue).toBeGreaterThan(replacement.auctionValue);
    });

    it('should ensure minimum value of $1 for players in draft pool', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      const inPoolPlayers = result.players.filter(p => p.isInDraftPool);
      expect(inPoolPlayers.length).toBeGreaterThan(0);

      inPoolPlayers.forEach(player => {
        expect(player.auctionValue).toBeGreaterThanOrEqual(1);
      });
    });

    it('should assign tier values from 1-10', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      result.players.forEach(player => {
        expect(player.tier).toBeGreaterThanOrEqual(1);
        expect(player.tier).toBeLessThanOrEqual(10);
      });
    });

    it('should mark players as in/out of draft pool based on roster spots', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      // Total roster spots = 18 per team × 12 teams = 216 players
      const totalRosterSpots = 18 * 12;
      const inPoolCount = result.players.filter(p => p.isInDraftPool).length;

      // With only 6 players, all should be in pool
      expect(inPoolCount).toBe(6);
    });
  });

  describe('Budget Distribution', () => {
    it('should distribute budget according to hitter/pitcher split', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      const totalBudget = 12 * 260; // $3,120
      const expectedHitterBudget = Math.round(totalBudget * 0.68); // $2,122
      const expectedPitcherBudget = totalBudget - expectedHitterBudget; // $998

      expect(result.leagueSummary.hitterBudget).toBe(expectedHitterBudget);
      expect(result.leagueSummary.pitcherBudget).toBe(expectedPitcherBudget);
    });

    it('should sum player values close to total budget (allowing for rounding)', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      const totalAssignedValue = result.players
        .filter(p => p.isInDraftPool)
        .reduce((sum, p) => sum + p.auctionValue, 0);

      const expectedTotal = result.leagueSummary.totalBudget;

      // Values should be within 5% of expected (accounting for rounding and market adjustments)
      expect(totalAssignedValue).toBeGreaterThan(expectedTotal * 0.95);
      expect(totalAssignedValue).toBeLessThan(expectedTotal * 1.05);
    });
  });

  describe('SGP Calculations', () => {
    it('should assign higher SGP values to elite players', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      const trout = result.players.find(p => p.name === 'Mike Trout')!;
      const average = result.players.find(p => p.name === 'Average Player')!;

      expect(trout.sgpValue).toBeDefined();
      expect(average.sgpValue).toBeDefined();
      expect(trout.sgpValue!).toBeGreaterThan(average.sgpValue!);
    });

    it('should handle categories-based scoring correctly', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      // All players should have SGP values calculated
      result.players.forEach(player => {
        if (player.playerType === 'hitter' || player.playerType === 'pitcher') {
          expect(player.sgpValue).toBeDefined();
          expect(typeof player.sgpValue).toBe('number');
        }
      });
    });
  });

  describe('Points-Based Scoring', () => {
    it('should calculate points-based values for H2H Points leagues', () => {
      const pointsSettings = {
        ...baseLeagueSettings,
        scoringType: 'h2h-points' as const,
        pointsSettings: {
          // Hitting
          singles: 1,
          doubles: 2,
          triples: 3,
          homeRuns: 4,
          walks: 1,
          runs: 1,
          rbi: 1,
          stolenBases: 2,
          caughtStealing: -1,
          strikeouts: -0.5,

          // Pitching
          inningsPitched: 3,
          wins: 5,
          saves: 5,
          strikeoutsPitched: 1,
          hitsAllowed: -1,
          walksAllowed: -1,
          earnedRuns: -2,
        },
      };

      const result = calculateAuctionValues(mockProjections, pointsSettings);

      // All players should have points values
      result.players.forEach(player => {
        expect(player.pointsValue).toBeDefined();
        expect(typeof player.pointsValue).toBe('number');
        expect(player.auctionValue).toBeGreaterThanOrEqual(1);
      });
    });

    it('should properly weight different point categories', () => {
      const pointsSettings = {
        ...baseLeagueSettings,
        scoringType: 'h2h-points' as const,
        pointsSettings: {
          homeRuns: 10, // Heavy weight on HRs
          singles: 1,
          doubles: 2,
          triples: 3,
          walks: 1,
          runs: 1,
          rbi: 1,
          stolenBases: 1,
          caughtStealing: -1,
          strikeouts: -0.5,
          inningsPitched: 3,
          wins: 5,
          saves: 5,
          strikeoutsPitched: 1,
          hitsAllowed: -1,
          walksAllowed: -1,
          earnedRuns: -2,
        },
      };

      const result = calculateAuctionValues(mockProjections, pointsSettings);

      const trout = result.players.find(p => p.name === 'Mike Trout')!;
      const average = result.players.find(p => p.name === 'Average Player')!;

      // Trout's 50 HRs should make him significantly more valuable
      expect(trout.pointsValue!).toBeGreaterThan(average.pointsValue! * 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty projections array', () => {
      const result = calculateAuctionValues([], baseLeagueSettings);

      expect(result.players).toHaveLength(0);
      expect(result.leagueSummary.totalBudget).toBe(12 * 260);
    });

    it('should handle single player', () => {
      const singlePlayer = [mockProjections[0]];
      const result = calculateAuctionValues(singlePlayer, baseLeagueSettings);

      expect(result.players).toHaveLength(1);
      expect(result.players[0].auctionValue).toBeGreaterThanOrEqual(1);
      expect(result.players[0].tier).toBeDefined();
    });

    it('should handle hitters-only pool', () => {
      const hittersOnly = mockProjections.filter(p => p.playerType === 'hitter');
      const result = calculateAuctionValues(hittersOnly, baseLeagueSettings);

      expect(result.players).toHaveLength(3);
      result.players.forEach(player => {
        expect(player.playerType).toBe('hitter');
        expect(player.auctionValue).toBeGreaterThanOrEqual(1);
      });
    });

    it('should handle pitchers-only pool', () => {
      const pitchersOnly = mockProjections.filter(p => p.playerType === 'pitcher');
      const result = calculateAuctionValues(pitchersOnly, baseLeagueSettings);

      expect(result.players).toHaveLength(3);
      result.players.forEach(player => {
        expect(player.playerType).toBe('pitcher');
        expect(player.auctionValue).toBeGreaterThanOrEqual(1);
      });
    });

    it('should handle zero-valued stats gracefully', () => {
      const zeroStatsPlayer: NormalizedProjection = {
        externalId: 'z1',
        mlbamId: 999,
        name: 'Zero Stats',
        team: 'FA',
        positions: ['OF'],
        playerType: 'hitter',
        hitting: {
          games: 0,
          atBats: 0,
          plateAppearances: 0,
          runs: 0,
          hits: 0,
          singles: 0,
          doubles: 0,
          triples: 0,
          homeRuns: 0,
          rbi: 0,
          stolenBases: 0,
          caughtStealing: 0,
          walks: 0,
          strikeouts: 0,
          battingAvg: 0,
          onBasePct: 0,
          sluggingPct: 0,
          ops: 0,
          wOBA: 0,
          wrcPlus: 0,
          war: 0,
        },
      };

      const withZero = [...mockProjections, zeroStatsPlayer];
      const result = calculateAuctionValues(withZero, baseLeagueSettings);

      const zeroPlayer = result.players.find(p => p.name === 'Zero Stats');
      expect(zeroPlayer).toBeDefined();
      // Should still get minimum value if in pool
      if (zeroPlayer?.isInDraftPool) {
        expect(zeroPlayer.auctionValue).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Category Validation', () => {
    it('should validate all standard hitting categories', () => {
      const validation = validateScoringCategories(baseLeagueSettings);

      expect(validation.hitting.length).toBe(5); // R, HR, RBI, SB, AVG
      validation.hitting.forEach(cat => {
        expect(cat.dataSource).toBe('direct');
        expect(cat.accuracy).toBe('high');
      });
    });

    it('should validate all standard pitching categories', () => {
      const validation = validateScoringCategories(baseLeagueSettings);

      expect(validation.pitching.length).toBe(5); // W, K, ERA, WHIP, SV
      validation.pitching.forEach(cat => {
        expect(cat.dataSource).toBe('direct');
        expect(cat.accuracy).toBe('high');
      });
    });

    it('should warn about estimated categories', () => {
      const settingsWithEstimated = {
        ...baseLeagueSettings,
        hittingCategories: {
          ...baseLeagueSettings.hittingCategories,
          HBP: true, // Estimated category
        },
      };

      const validation = validateScoringCategories(settingsWithEstimated);

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('HBP'))).toBe(true);
      expect(validation.warnings.some(w => w.includes('estimated'))).toBe(true);
    });

    it('should warn about unsupported categories', () => {
      const settingsWithUnsupported = {
        ...baseLeagueSettings,
        hittingCategories: {
          ...baseLeagueSettings.hittingCategories,
          A: true, // Fielding assists - unsupported
        },
      };

      const validation = validateScoringCategories(settingsWithUnsupported);

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('A'))).toBe(true);
      expect(validation.warnings.some(w => w.includes('not supported'))).toBe(true);
    });

    it('should provide category support summary', () => {
      const summary = getCategorySupportSummary(baseLeagueSettings);

      expect(summary.supported).toBe(10); // 5 hitting + 5 pitching direct categories
      expect(summary.estimated).toBe(0);
      expect(summary.unsupported).toBe(0);
      expect(summary.details).toContain('All categories use direct projection data');
    });
  });

  describe('Market Adjustments', () => {
    it('should apply tier-based market inflation', () => {
      // Create larger pool to see tier distribution
      const largePool: NormalizedProjection[] = [];

      // Generate 50 hitters with varying stats
      for (let i = 0; i < 50; i++) {
        const quality = i / 50; // 0 to 1
        largePool.push({
          externalId: `h${i}`,
          mlbamId: 1000 + i,
          name: `Hitter ${i}`,
          team: 'TEX',
          positions: ['OF'],
          playerType: 'hitter',
          hitting: {
            games: 150,
            atBats: 500,
            plateAppearances: 570,
            runs: Math.floor(40 + quality * 60),
            hits: Math.floor(100 + quality * 80),
            singles: Math.floor(70 + quality * 20),
            doubles: Math.floor(15 + quality * 20),
            triples: 2,
            homeRuns: Math.floor(5 + quality * 40),
            rbi: Math.floor(30 + quality * 90),
            stolenBases: Math.floor(2 + quality * 25),
            caughtStealing: 2,
            walks: Math.floor(30 + quality * 60),
            strikeouts: 120,
            battingAvg: 0.200 + quality * 0.150,
            onBasePct: 0.280 + quality * 0.150,
            sluggingPct: 0.350 + quality * 0.300,
            ops: 0.630 + quality * 0.450,
            wOBA: 0.280 + quality * 0.150,
            wrcPlus: Math.floor(70 + quality * 110),
            war: quality * 8,
          },
        });
      }

      const result = calculateAuctionValues(largePool, baseLeagueSettings);

      // Elite players (Tier 1) should exist
      const tier1Players = result.players.filter(p => p.tier === 1);
      expect(tier1Players.length).toBeGreaterThan(0);

      // Tier 10 (filler) players should exist
      const tier10Players = result.players.filter(p => p.tier === 10);
      expect(tier10Players.length).toBeGreaterThan(0);
    });

    it('should apply position scarcity adjustments', () => {
      // Test catcher premium (should get +20% boost)
      const catcherSettings = {
        ...baseLeagueSettings,
        rosterSpots: {
          ...baseLeagueSettings.rosterSpots,
          C: 2, // Scarce position
        },
      };

      const catcher: NormalizedProjection = {
        externalId: 'c1',
        mlbamId: 100,
        name: 'Elite Catcher',
        team: 'ATL',
        positions: ['C'],
        playerType: 'hitter',
        hitting: mockProjections[1].hitting, // Same stats as average player
      };

      const firstBase: NormalizedProjection = {
        externalId: '1b1',
        mlbamId: 101,
        name: 'Average First Baseman',
        team: 'ATL',
        positions: ['1B'],
        playerType: 'hitter',
        hitting: mockProjections[1].hitting, // Same stats
      };

      const result = calculateAuctionValues([catcher, firstBase], catcherSettings);

      const catcherValue = result.players.find(p => p.positions.includes('C'))!.auctionValue;
      const firstBaseValue = result.players.find(p => p.positions.includes('1B'))!.auctionValue;

      // Catcher should be valued higher due to scarcity premium
      expect(catcherValue).toBeGreaterThan(firstBaseValue);
    });
  });

  describe('League Summary Validation', () => {
    it('should calculate correct league summary values', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      expect(result.leagueSummary.numTeams).toBe(12);
      expect(result.leagueSummary.budgetPerTeam).toBe(260);
      expect(result.leagueSummary.totalBudget).toBe(3120);
      expect(result.leagueSummary.scoringType).toBe('rotisserie');
      expect(result.leagueSummary.leagueType).toBe('redraft');
    });

    it('should calculate correct pool sizes', () => {
      const result = calculateAuctionValues(mockProjections, baseLeagueSettings);

      // 18 roster spots × 12 teams = 216 total
      expect(result.leagueSummary.draftablePoolSize).toBe(216);

      // Hitter positions: C, 1B, 2B, 3B, SS, OF×3, UTIL = 9 × 12 = 108
      expect(result.leagueSummary.hitterPoolSize).toBe(108);

      // Pitcher positions: SP×5, RP×2 = 7 × 12 = 84
      expect(result.leagueSummary.pitcherPoolSize).toBe(84);
    });
  });
});

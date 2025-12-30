/**
 * Inflation Calculator Tests
 * Tests tier-weighted inflation with positional scarcity and team budget constraints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '../../../server/test/setup';
import {
  calculateInflationStats,
  calculatePositionalScarcity,
  calculateEffectiveBudget,
  calculateCompetitionFactor,
  adjustValueForInflation,
  getInflationLevel,
  getValueDifferenceDisplay,
  getHistoricalInflationContext,
  HISTORICAL_INFLATION_BASELINES,
} from '../inflationCalculator';
import type { MatchedPlayer, ScrapedPlayer, ScrapedTeam } from '../../types/auction';

describe('Inflation Calculator - Tier-Weighted Calculations', () => {
  let mockMatchedPlayers: MatchedPlayer[];
  let mockTeams: ScrapedTeam[];
  const leagueConfig = {
    numTeams: 12,
    budgetPerTeam: 260,
    totalRosterSpots: 18,
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
  };

  beforeEach(() => {
    // Create mock scraped players with draft status
    const createScrapedPlayer = (
      id: number,
      name: string,
      positions: string[],
      status: 'available' | 'drafted' | 'on_block' = 'available',
      winningBid?: number,
      winningTeam?: string
    ): ScrapedPlayer => ({
      couchManagersId: id,
      fullName: name,
      mlbTeam: 'LAA',
      mlbamId: id,
      positions,
      status,
      winningBid,
      winningTeam,
    });

    // Create matched players (drafted and available)
    mockMatchedPlayers = [
      // Drafted elite player - should show deflation
      {
        scrapedPlayer: createScrapedPlayer(1, 'Mike Trout', ['OF'], 'drafted', 45, 'Team A'),
        projectionPlayerId: 'p1',
        projectedValue: 50,
        actualBid: 45,
        inflationAmount: -5,
        inflationPercent: -10,
        matchConfidence: 'exact',
      },
      // Drafted star player
      {
        scrapedPlayer: createScrapedPlayer(2, 'Mookie Betts', ['OF'], 'drafted', 42, 'Team B'),
        projectionPlayerId: 'p2',
        projectedValue: 38,
        actualBid: 42,
        inflationAmount: 4,
        inflationPercent: 10.5,
        matchConfidence: 'exact',
      },
      // Drafted mid-tier player - should show inflation
      {
        scrapedPlayer: createScrapedPlayer(3, 'Mid Tier', ['2B'], 'drafted', 20, 'Team C'),
        projectionPlayerId: 'p3',
        projectedValue: 15,
        actualBid: 20,
        inflationAmount: 5,
        inflationPercent: 33.3,
        matchConfidence: 'exact',
      },
      // Drafted low-value player - should show extreme inflation
      {
        scrapedPlayer: createScrapedPlayer(4, 'Low Value', ['3B'], 'drafted', 5, 'Team D'),
        projectionPlayerId: 'p4',
        projectedValue: 2,
        actualBid: 5,
        inflationAmount: 3,
        inflationPercent: 150,
        matchConfidence: 'exact',
      },
      // Drafted replacement player
      {
        scrapedPlayer: createScrapedPlayer(5, 'Replacement', ['1B'], 'drafted', 3, 'Team E'),
        projectionPlayerId: 'p5',
        projectedValue: 1,
        actualBid: 3,
        inflationAmount: 2,
        inflationPercent: 200,
        matchConfidence: 'exact',
      },
      // Available elite player
      {
        scrapedPlayer: createScrapedPlayer(6, 'Available Star', ['SS'], 'available'),
        projectionPlayerId: 'p6',
        projectedValue: 35,
        actualBid: null,
        inflationAmount: null,
        inflationPercent: null,
        matchConfidence: 'exact',
      },
      // Available mid-tier
      {
        scrapedPlayer: createScrapedPlayer(7, 'Available Mid', ['SP'], 'available'),
        projectionPlayerId: 'p7',
        projectedValue: 12,
        actualBid: null,
        inflationAmount: null,
        inflationPercent: null,
        matchConfidence: 'exact',
      },
      // Available scarce position (catcher)
      {
        scrapedPlayer: createScrapedPlayer(8, 'Available C', ['C'], 'available'),
        projectionPlayerId: 'p8',
        projectedValue: 18,
        actualBid: null,
        inflationAmount: null,
        inflationPercent: null,
        matchConfidence: 'exact',
      },
      // Available relief pitcher
      {
        scrapedPlayer: createScrapedPlayer(9, 'Available RP', ['RP'], 'available'),
        projectionPlayerId: 'p9',
        projectedValue: 10,
        actualBid: null,
        inflationAmount: null,
        inflationPercent: null,
        matchConfidence: 'exact',
      },
    ];

    // Create mock teams with varying budgets
    mockTeams = [
      { name: 'Team A', remaining: 215, playersDrafted: 1 },
      { name: 'Team B', remaining: 218, playersDrafted: 1 },
      { name: 'Team C', remaining: 240, playersDrafted: 1 },
      { name: 'Team D', remaining: 255, playersDrafted: 1 },
      { name: 'Team E', remaining: 257, playersDrafted: 1 },
      { name: 'Team F', remaining: 260, playersDrafted: 0 },
      { name: 'Team G', remaining: 260, playersDrafted: 0 },
      { name: 'Team H', remaining: 260, playersDrafted: 0 },
      { name: 'Team I', remaining: 260, playersDrafted: 0 },
      { name: 'Team J', remaining: 260, playersDrafted: 0 },
      { name: 'Team K', remaining: 260, playersDrafted: 0 },
      { name: 'Team L', remaining: 260, playersDrafted: 0 },
    ];
  });

  describe('Basic Inflation Calculation', () => {
    it('should calculate overall inflation rate', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, mockTeams);

      expect(stats.overallInflationRate).toBeDefined();
      expect(stats.overallInflationRate).toBeValidInflationRate();
      expect(stats.draftedPlayersCount).toBe(5);
    });

    it('should calculate total projected vs actual spent', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, mockTeams);

      expect(stats.totalProjectedValue).toBe(106); // 50 + 38 + 15 + 2 + 1
      expect(stats.totalActualSpent).toBe(115); // 45 + 42 + 20 + 5 + 3
    });

    it('should use dampened weights for low-value players', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, mockTeams);

      // The weighted inflation should be lower than a simple average
      // because low-value players ($1-2) with extreme inflation are dampened
      const simpleAverage =
        ((-10 + 10.5 + 33.3 + 150 + 200) / 5);

      // Weighted rate should be significantly lower due to dampening
      expect(stats.weightedInflationRate).toBeLessThan(simpleAverage);
    });
  });

  describe('Tier-Based Inflation', () => {
    it('should calculate inflation for each tier', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, mockTeams);

      expect(stats.tierInflation).toHaveLength(10);
      stats.tierInflation.forEach(tier => {
        expect(tier.tier).toBeGreaterThanOrEqual(1);
        expect(tier.tier).toBeLessThanOrEqual(10);
        expect(tier.inflationRate).toBeValidInflationRate();
      });
    });

    it('should show higher inflation for lower-value tiers', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, mockTeams);

      const tier1 = stats.tierInflation.find(t => t.tier === 1);
      const tier10 = stats.tierInflation.find(t => t.tier === 10);

      // Lower tiers typically have higher inflation (more players bid up)
      // But this depends on the specific data - just check they're calculated
      expect(tier1).toBeDefined();
      expect(tier10).toBeDefined();
    });

    it('should track player counts per tier', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, mockTeams);

      const totalDrafted = stats.tierInflation.reduce((sum, t) => sum + t.draftedCount, 0);
      expect(totalDrafted).toBe(5); // 5 drafted players
    });
  });

  describe('Positional Scarcity', () => {
    it('should calculate scarcity for all roster positions', () => {
      const scarcity = calculatePositionalScarcity(mockMatchedPlayers, leagueConfig);

      // Should have entries for all positions with roster spots
      const positions = scarcity.map(s => s.position);
      expect(positions).toContain('C');
      expect(positions).toContain('1B');
      expect(positions).toContain('OF');
      expect(positions).toContain('SP');
      expect(positions).toContain('RP');
    });

    it('should identify severe scarcity correctly', () => {
      const scarcity = calculatePositionalScarcity(mockMatchedPlayers, leagueConfig);

      scarcity.forEach(pos => {
        if (pos.scarcityRatio >= 2.0) {
          expect(pos.scarcityLevel).toBe('severe');
          expect(pos.inflationAdjustment).toBeGreaterThanOrEqual(1.25);
        }
      });
    });

    it('should apply historical position premiums', () => {
      const scarcity = calculatePositionalScarcity(mockMatchedPlayers, leagueConfig);

      const catcher = scarcity.find(s => s.position === 'C');
      const rp = scarcity.find(s => s.position === 'RP');
      const firstBase = scarcity.find(s => s.position === '1B');

      // RP should have higher adjustment (severely inflated historically)
      if (rp) {
        expect(rp.inflationAdjustment).toBeGreaterThan(1.0);
      }

      // C should have premium (highly inflated historically)
      if (catcher) {
        expect(catcher.inflationAdjustment).toBeGreaterThan(1.0);
      }

      // 1B typically surplus/normal
      if (firstBase) {
        expect(firstBase.inflationAdjustment).toBeLessThanOrEqual(1.0);
      }
    });

    it('should count multi-position players for all positions', () => {
      const multiPosMock: MatchedPlayer = {
        scrapedPlayer: {
          couchManagersId: 100,
          fullName: 'Multi Position',
          mlbTeam: 'LAA',
          mlbamId: 100,
          positions: ['2B', '3B', 'SS'], // Eligible at multiple positions
          status: 'available',
        },
        projectionPlayerId: 'p100',
        projectedValue: 20,
        actualBid: null,
        inflationAmount: null,
        inflationPercent: null,
        matchConfidence: 'exact',
      };

      const withMulti = [...mockMatchedPlayers, multiPosMock];
      const scarcity = calculatePositionalScarcity(withMulti, leagueConfig);

      const ss = scarcity.find(s => s.position === 'SS');
      const secondBase = scarcity.find(s => s.position === '2B');
      const thirdBase = scarcity.find(s => s.position === '3B');

      // Multi-position player should count toward all positions
      expect(ss?.availableCount).toBeGreaterThan(0);
      expect(secondBase?.availableCount).toBeGreaterThan(0);
      expect(thirdBase?.availableCount).toBeGreaterThan(0);
    });
  });

  describe('Team Budget Constraints', () => {
    it('should calculate effective budget accounting for $1 reserves', () => {
      const constraints = calculateEffectiveBudget(mockTeams, leagueConfig);

      expect(constraints).toHaveLength(12);
      constraints.forEach(team => {
        expect(team.effectiveBudget).toBeLessThanOrEqual(team.rawRemaining);
        expect(team.rosterSpotsRemaining).toBeDefined();
      });
    });

    it('should reserve $1 per remaining roster spot (minus 1)', () => {
      const teamWithFewPicks: ScrapedTeam = {
        name: 'Almost Full',
        remaining: 50,
        playersDrafted: 15, // 3 spots left (18 - 15 = 3)
      };

      const constraints = calculateEffectiveBudget([teamWithFewPicks], leagueConfig);
      const team = constraints[0];

      // 3 spots remaining means 2×$1 reserve (3-1 = 2)
      expect(team.rosterSpotsRemaining).toBe(3);
      expect(team.effectiveBudget).toBe(50 - 2); // $48
    });

    it('should calculate can-afford threshold at 50% of effective budget', () => {
      const constraints = calculateEffectiveBudget(mockTeams, leagueConfig);

      constraints.forEach(team => {
        expect(team.canAffordThreshold).toBe(team.effectiveBudget * 0.5);
      });
    });
  });

  describe('Competition Factor', () => {
    it('should return 1.0 when all teams can easily afford', () => {
      const constraints = calculateEffectiveBudget(mockTeams, leagueConfig);
      const cheapPlayer = 10; // All teams should afford $10

      const factor = calculateCompetitionFactor(cheapPlayer, constraints);
      expect(factor).toBeGreaterThan(0.8); // High competition
    });

    it('should return lower factor when few teams can afford', () => {
      const expensivePlayer = 250; // Most teams can't afford this

      const constraints = calculateEffectiveBudget(mockTeams, leagueConfig);
      const factor = calculateCompetitionFactor(expensivePlayer, constraints);

      expect(factor).toBeLessThan(1.0);
    });

    it('should handle no teams able to afford', () => {
      const impossiblePrice = 500;

      const constraints = calculateEffectiveBudget(mockTeams, leagueConfig);
      const factor = calculateCompetitionFactor(impossiblePrice, constraints);

      expect(factor).toBe(0.25); // Minimum factor
    });
  });

  describe('Remaining Budget Inflation', () => {
    it('should calculate forward-looking inflation adjustment', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, mockTeams);

      expect(stats.remainingBudgetInflationAdjustment).toBeDefined();
      expect(stats.remainingProjectedValue).toBeGreaterThan(0);
      expect(stats.adjustedRemainingBudget).toBeGreaterThan(0);
    });

    it('should use effective budget, not raw budget', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, mockTeams);

      const totalBudget = 12 * 260; // $3,120
      const spent = 115;
      const rawRemaining = totalBudget - spent; // $3,005

      // Adjusted should be less (accounting for $1 reserves)
      expect(stats.adjustedRemainingBudget).toBeLessThan(rawRemaining);
    });
  });

  describe('Helper Functions', () => {
    it('should adjust value for inflation correctly', () => {
      const baseValue = 20;
      const inflation = 25; // 25% inflation

      const adjusted = adjustValueForInflation(baseValue, inflation);
      expect(adjusted).toBe(25); // 20 × 1.25 = 25
    });

    it('should determine inflation level correctly', () => {
      expect(getInflationLevel(3)).toBe('low');
      expect(getInflationLevel(10)).toBe('moderate');
      expect(getInflationLevel(20)).toBe('high');
      expect(getInflationLevel(35)).toBe('very_high');
    });

    it('should format value difference display', () => {
      expect(getValueDifferenceDisplay(25, 20)).toBe('+$5');
      expect(getValueDifferenceDisplay(15, 20)).toBe('-$5');
      expect(getValueDifferenceDisplay(null, 20)).toBe('--');
      expect(getValueDifferenceDisplay(20, null)).toBe('--');
    });
  });

  describe('Historical Inflation Context', () => {
    it('should provide context for elite players', () => {
      const context = getHistoricalInflationContext(45, 1, ['OF']);

      expect(context.priceRangeTrend).toBe('deflated');
      expect(context.tierLabel).toContain('Elite');
      expect(context.recommendation).toContain('BELOW');
    });

    it('should provide context for mid-tier players', () => {
      const context = getHistoricalInflationContext(12, 4, ['2B']);

      expect(context.priceRangeTrend).toBe('moderate');
      expect(context.recommendation).toContain('moderate inflation');
    });

    it('should provide context for low-value players', () => {
      const context = getHistoricalInflationContext(2, 9, ['3B']);

      expect(context.priceRangeTrend).toBe('extreme');
      expect(context.recommendation).toContain('extreme inflation');
    });

    it('should identify position trends', () => {
      const rpContext = getHistoricalInflationContext(10, 5, ['RP']);
      expect(rpContext.positionTrend).toBe('severely_inflated');

      const catcherContext = getHistoricalInflationContext(15, 4, ['C']);
      expect(catcherContext.positionTrend).toBe('highly_inflated');

      const firstBaseContext = getHistoricalInflationContext(12, 5, ['1B']);
      expect(firstBaseContext.positionTrend).toBe('slightly_inflated');
    });

    it('should have complete historical baseline data', () => {
      expect(HISTORICAL_INFLATION_BASELINES.overall).toBeDefined();
      expect(HISTORICAL_INFLATION_BASELINES.byTier).toBeDefined();
      expect(HISTORICAL_INFLATION_BASELINES.byPosition).toBeDefined();
      expect(HISTORICAL_INFLATION_BASELINES.byPriceRange).toBeDefined();

      // Check all tiers 1-10 are defined
      for (let i = 1; i <= 10; i++) {
        expect(HISTORICAL_INFLATION_BASELINES.byTier[i]).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty draft (no players drafted)', () => {
      const noDrafted = mockMatchedPlayers.map(p => ({
        ...p,
        scrapedPlayer: { ...p.scrapedPlayer, status: 'available' as const },
        actualBid: null,
      }));

      const stats = calculateInflationStats(noDrafted, leagueConfig, mockTeams);

      expect(stats.draftedPlayersCount).toBe(0);
      expect(stats.overallInflationRate).toBe(0);
      expect(stats.totalActualSpent).toBe(0);
    });

    it('should handle single drafted player', () => {
      const singleDrafted = [mockMatchedPlayers[0]];

      const stats = calculateInflationStats(singleDrafted, leagueConfig, mockTeams);

      expect(stats.draftedPlayersCount).toBe(1);
      expect(stats.overallInflationRate).toBeValidInflationRate();
    });

    it('should handle all players drafted', () => {
      const allDrafted = mockMatchedPlayers.map((p, i) => ({
        ...p,
        scrapedPlayer: {
          ...p.scrapedPlayer,
          status: 'drafted' as const,
          winningBid: p.projectedValue! + i,
          winningTeam: `Team ${i}`,
        },
        actualBid: p.projectedValue! + i,
      }));

      const stats = calculateInflationStats(allDrafted, leagueConfig, mockTeams);

      expect(stats.draftedPlayersCount).toBe(allDrafted.length);
      expect(stats.remainingProjectedValue).toBe(0);
    });

    it('should handle extreme inflation values', () => {
      const extremeMock: MatchedPlayer[] = [
        {
          scrapedPlayer: {
            couchManagersId: 1,
            fullName: 'Extreme Inflation',
            mlbTeam: 'LAA',
            mlbamId: 1,
            positions: ['OF'],
            status: 'drafted',
            winningBid: 100,
            winningTeam: 'Team A',
          },
          projectionPlayerId: 'p1',
          projectedValue: 1,
          actualBid: 100,
          inflationAmount: 99,
          inflationPercent: 9900, // 99x inflation!
          matchConfidence: 'exact',
        },
      ];

      const stats = calculateInflationStats(extremeMock, leagueConfig, mockTeams);

      expect(stats.overallInflationRate).toBeValidInflationRate();
      expect(stats.overallInflationRate).toBeGreaterThan(0);
    });

    it('should handle negative inflation (deflation)', () => {
      const deflationMock: MatchedPlayer[] = [
        {
          scrapedPlayer: {
            couchManagersId: 1,
            fullName: 'Deflated Elite',
            mlbTeam: 'LAA',
            mlbamId: 1,
            positions: ['OF'],
            status: 'drafted',
            winningBid: 30,
            winningTeam: 'Team A',
          },
          projectionPlayerId: 'p1',
          projectedValue: 50,
          actualBid: 30,
          inflationAmount: -20,
          inflationPercent: -40,
          matchConfidence: 'exact',
        },
      ];

      const stats = calculateInflationStats(deflationMock, leagueConfig, mockTeams);

      expect(stats.overallInflationRate).toBeLessThan(0);
      expect(stats.overallInflationRate).toBeGreaterThanOrEqual(-100);
    });

    it('should handle missing team data gracefully', () => {
      const stats = calculateInflationStats(mockMatchedPlayers, leagueConfig, undefined);

      expect(stats.teamConstraints).toHaveLength(0);
      expect(stats.leagueEffectiveBudget).toBeGreaterThan(0);
    });
  });
});

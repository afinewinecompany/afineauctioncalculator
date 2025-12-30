/**
 * Player Matcher Tests
 * Tests name matching algorithm with fuzzy matching, diacritics, and disambiguation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '../../../server/test/setup';
import {
  matchPlayer,
  matchAllPlayers,
  normalizeName,
  normalizeTeam,
} from '../playerMatcher';
import type { ScrapedPlayer } from '../../types/auction';

describe('Player Matcher - Name Matching Algorithm', () => {
  // Test data representing projection players
  const mockProjections = [
    {
      id: 'p1',
      mlbamId: 545361,
      name: 'Mike Trout',
      team: 'LAA',
      positions: ['OF'],
      projectedValue: 50,
    },
    {
      id: 'p2',
      mlbamId: 660271,
      name: 'Ronald Acuña Jr.',
      team: 'ATL',
      positions: ['OF'],
      projectedValue: 45,
    },
    {
      id: 'p3',
      mlbamId: 592450,
      name: 'Félix Bautista',
      team: 'BAL',
      positions: ['RP'],
      projectedValue: 15,
    },
    {
      id: 'p4',
      mlbamId: 592663,
      name: 'J.T. Realmuto',
      team: 'PHI',
      positions: ['C'],
      projectedValue: 25,
    },
    {
      id: 'p5',
      mlbamId: 665742,
      name: 'Bobby Witt Jr.',
      team: 'KC',
      positions: ['SS'],
      projectedValue: 38,
    },
    {
      id: 'p6',
      mlbamId: 672780,
      name: 'Adley Rutschman',
      team: 'BAL',
      positions: ['C'],
      projectedValue: 22,
    },
    {
      id: 'p7',
      mlbamId: 543037,
      name: 'Juan Soto',
      team: 'NYY',
      positions: ['OF'],
      projectedValue: 42,
    },
    // Minor leaguer with same name (different mlbamId, very low value)
    {
      id: 'p8',
      mlbamId: 999999,
      name: 'Juan Soto',
      team: 'FA',
      positions: ['RP'],
      projectedValue: 1,
    },
    {
      id: 'p9',
      mlbamId: 641154,
      name: 'Vladimir Guerrero Jr.',
      team: 'TOR',
      positions: ['1B'],
      projectedValue: 40,
    },
    // Two-way player (Ohtani)
    {
      id: 'p10',
      mlbamId: 660271,
      name: 'Shohei Ohtani',
      team: 'LAD',
      positions: ['DH'],
      projectedValue: 48,
    },
  ];

  describe('Name Normalization', () => {
    it('should remove diacritics (accents)', () => {
      expect(normalizeName('Félix Bautista')).toBe('felix bautista');
      expect(normalizeName('Ronald Acuña Jr.')).toBe('ronald acuna jr');
      expect(normalizeName('José Ramírez')).toBe('jose ramirez');
    });

    it('should remove periods from initials', () => {
      expect(normalizeName('J.T. Realmuto')).toBe('jt realmuto');
      expect(normalizeName('A.J. Pollock')).toBe('aj pollock');
    });

    it('should convert to lowercase', () => {
      expect(normalizeName('MIKE TROUT')).toBe('mike trout');
      expect(normalizeName('Mike Trout')).toBe('mike trout');
    });

    it('should handle suffixes', () => {
      expect(normalizeName('Ronald Acuña Jr.')).toBe('ronald acuna jr');
      expect(normalizeName('Vladimir Guerrero Jr.')).toBe('vladimir guerrero jr');
      expect(normalizeName('Fernando Tatis III')).toBe('fernando tatis iii');
    });

    it('should normalize whitespace', () => {
      expect(normalizeName('  Mike   Trout  ')).toBe('mike trout');
      expect(normalizeName('Mike\tTrout')).toBe('mike trout');
    });
  });

  describe('Team Normalization', () => {
    it('should normalize common team abbreviations', () => {
      expect(normalizeTeam('CWS')).toBe('CHW');
      expect(normalizeTeam('CHA')).toBe('CHW');
      expect(normalizeTeam('CHN')).toBe('CHC');
      expect(normalizeTeam('AZ')).toBe('ARI');
      expect(normalizeTeam('ARZ')).toBe('ARI');
    });

    it('should handle free agents', () => {
      expect(normalizeTeam('FA')).toBe('FA');
      expect(normalizeTeam('Free Agent')).toBe('FREE AGENT');
    });

    it('should be case-insensitive', () => {
      expect(normalizeTeam('laa')).toBe('LAA');
      expect(normalizeTeam('LaA')).toBe('LAA');
    });
  });

  describe('Exact Matching', () => {
    it('should match by mlbamId when available', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 1,
        fullName: 'Mike Trout', // Name matches
        mlbTeam: 'LAA',
        mlbamId: 545361, // Matches projection
        positions: ['OF'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).not.toBeNull();
      expect(result.player?.id).toBe('p1');
      expect(result.confidence).toBe('exact');
    });

    it('should match by exact name when mlbamId not available', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 2,
        fullName: 'Mike Trout',
        mlbTeam: 'LAA',
        mlbamId: 0, // No mlbamId
        positions: ['OF'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).not.toBeNull();
      expect(result.player?.name).toBe('Mike Trout');
      expect(result.confidence).toBe('exact');
    });

    it('should match when name and team both match', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 3,
        fullName: 'J.T. Realmuto',
        mlbTeam: 'PHI',
        mlbamId: 0,
        positions: ['C'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).not.toBeNull();
      expect(result.player?.name).toBe('J.T. Realmuto');
      expect(result.confidence).toBe('exact');
    });
  });

  describe('Fuzzy Matching', () => {
    it('should match names with different diacritics', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 4,
        fullName: 'Felix Bautista', // No accent
        mlbTeam: 'BAL',
        mlbamId: 0,
        positions: ['RP'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).not.toBeNull();
      expect(result.player?.name).toBe('Félix Bautista');
      expect(result.confidence).toBe('exact'); // Exact after normalization
    });

    it('should match names without periods', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 5,
        fullName: 'JT Realmuto', // No periods
        mlbTeam: 'PHI',
        mlbamId: 0,
        positions: ['C'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).not.toBeNull();
      expect(result.player?.name).toBe('J.T. Realmuto');
    });

    it('should match names with/without suffixes', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 6,
        fullName: 'Ronald Acuna', // No "Jr."
        mlbTeam: 'ATL',
        mlbamId: 0,
        positions: ['OF'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).not.toBeNull();
      expect(result.player?.name).toBe('Ronald Acuña Jr.');
    });

    it('should match with different suffix formats', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 7,
        fullName: 'Vladimir Guerrero', // No "Jr."
        mlbTeam: 'TOR',
        mlbamId: 0,
        positions: ['1B'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).not.toBeNull();
      expect(result.player?.name).toBe('Vladimir Guerrero Jr.');
    });
  });

  describe('Team Disambiguation', () => {
    it('should use team to disambiguate players with same name', () => {
      // Juan Soto (star OF on NYY) should match, not the minor leaguer
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 8,
        fullName: 'Juan Soto',
        mlbTeam: 'NYY',
        mlbamId: 0,
        positions: ['OF'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).not.toBeNull();
      expect(result.player?.team).toBe('NYY');
      expect(result.player?.projectedValue).toBe(42); // Star, not $1 minor leaguer
    });

    it('should not match when team is very different', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 9,
        fullName: 'Mike Trout',
        mlbTeam: 'NYY', // Wrong team
        mlbamId: 0,
        positions: ['OF'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      // Should still match based on name, but with lower confidence
      // or might not match if team mismatch penalty is too high
      if (result.player) {
        expect(result.confidence).not.toBe('exact');
      }
    });
  });

  describe('Position Disambiguation', () => {
    it('should use position type (hitter vs pitcher) for disambiguation', () => {
      // If two players named "Juan Soto" - one OF, one RP - should match by position
      const scrapedOF: ScrapedPlayer = {
        couchManagersId: 10,
        fullName: 'Juan Soto',
        mlbTeam: 'FA', // Team uncertain
        mlbamId: 0,
        positions: ['OF'],
        status: 'available',
      };

      const resultOF = matchPlayer(scrapedOF, mockProjections);

      expect(resultOF.player).not.toBeNull();
      expect(resultOF.player?.positions).toContain('OF');
      expect(resultOF.player?.projectedValue).toBeGreaterThan(10); // Star OF, not RP
    });

    it('should not match hitter to pitcher with same name', () => {
      const scrapedRP: ScrapedPlayer = {
        couchManagersId: 11,
        fullName: 'Juan Soto',
        mlbTeam: 'FA',
        mlbamId: 0,
        positions: ['RP'], // Pitcher
        status: 'available',
      };

      const resultRP = matchPlayer(scrapedRP, mockProjections);

      // Should match to the RP version if it exists, or return null/low confidence
      if (resultRP.player) {
        expect(resultRP.player.positions).toContain('RP');
        expect(resultRP.player.projectedValue).toBeLessThan(10); // Minor leaguer RP
      }
    });
  });

  describe('Value Sanity Checks', () => {
    it('should penalize matching high-bid player to $1 projection', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 12,
        fullName: 'Juan Soto',
        mlbTeam: 'FA',
        mlbamId: 0,
        positions: ['OF'],
        status: 'drafted',
        winningBid: 40, // High bid
        winningTeam: 'Team A',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      // Should match to the star ($42) not the minor leaguer ($1)
      expect(result.player).not.toBeNull();
      expect(result.player?.projectedValue).toBeGreaterThan(20);
    });

    it('should prefer higher-value players for ambiguous matches', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 13,
        fullName: 'Juan Soto',
        mlbTeam: 'FA', // Ambiguous team
        mlbamId: 0,
        positions: ['OF'], // Both are OF (hypothetically)
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      // Should match to higher-value player
      if (result.player) {
        expect(result.player.projectedValue).toBeGreaterThan(10);
      }
    });
  });

  describe('Confidence Levels', () => {
    it('should return exact confidence for mlbamId match', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 14,
        fullName: 'Mike Trout',
        mlbTeam: 'LAA',
        mlbamId: 545361,
        positions: ['OF'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.confidence).toBe('exact');
    });

    it('should return exact confidence for perfect name + team match', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 15,
        fullName: 'Adley Rutschman',
        mlbTeam: 'BAL',
        mlbamId: 0,
        positions: ['C'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.confidence).toBe('exact');
    });

    it('should return partial confidence for name match without team', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 16,
        fullName: 'Bobby Witt',
        mlbTeam: 'FA', // Team doesn't match
        mlbamId: 0,
        positions: ['SS'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      if (result.player) {
        expect(result.confidence).not.toBe('exact');
      }
    });

    it('should return unmatched when name does not match', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 17,
        fullName: 'Nonexistent Player',
        mlbTeam: 'LAA',
        mlbamId: 0,
        positions: ['OF'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      expect(result.player).toBeNull();
      expect(result.confidence).toBe('unmatched');
    });
  });

  describe('Batch Matching', () => {
    it('should match all players in a list', () => {
      const scrapedPlayers: ScrapedPlayer[] = [
        {
          couchManagersId: 1,
          fullName: 'Mike Trout',
          mlbTeam: 'LAA',
          mlbamId: 545361,
          positions: ['OF'],
          status: 'available',
        },
        {
          couchManagersId: 2,
          fullName: 'Ronald Acuna Jr.',
          mlbTeam: 'ATL',
          mlbamId: 0,
          positions: ['OF'],
          status: 'available',
        },
        {
          couchManagersId: 3,
          fullName: 'Unknown Player',
          mlbTeam: 'LAA',
          mlbamId: 0,
          positions: ['OF'],
          status: 'available',
        },
      ];

      const result = matchAllPlayers(scrapedPlayers, mockProjections);

      expect(result.matched.length).toBe(2);
      expect(result.unmatched.length).toBe(1);
      expect(result.unmatched[0].fullName).toBe('Unknown Player');
    });

    it('should prevent double-matching to same projection', () => {
      const scrapedPlayers: ScrapedPlayer[] = [
        {
          couchManagersId: 1,
          fullName: 'Mike Trout',
          mlbTeam: 'LAA',
          mlbamId: 545361,
          positions: ['OF'],
          status: 'available',
        },
        {
          couchManagersId: 2,
          fullName: 'Mike Trout', // Duplicate
          mlbTeam: 'LAA',
          mlbamId: 545361,
          positions: ['OF'],
          status: 'available',
        },
      ];

      const result = matchAllPlayers(scrapedPlayers, mockProjections);

      // Only one should match, the other should be unmatched
      expect(result.matched.length).toBe(1);
      expect(result.unmatched.length).toBe(1);
    });

    it('should deduplicate scraped players before matching', () => {
      const scrapedPlayers: ScrapedPlayer[] = [
        {
          couchManagersId: 1,
          fullName: 'Mike Trout',
          mlbTeam: 'LAA',
          mlbamId: 545361,
          positions: ['OF'],
          status: 'drafted',
          winningBid: 45,
          winningTeam: 'Team A',
        },
        {
          couchManagersId: 2,
          fullName: 'Mike Trout', // Duplicate without draft info
          mlbTeam: 'LAA',
          mlbamId: 545361,
          positions: ['OF'],
          status: 'available', // Missing draft info
        },
      ];

      const result = matchAllPlayers(scrapedPlayers, mockProjections);

      // Should deduplicate and keep the one with complete draft info
      expect(result.matched.length).toBe(1);
      expect(result.matched[0].actualBid).toBe(45); // Has draft info
    });

    it('should calculate inflation for matched players', () => {
      const scrapedPlayers: ScrapedPlayer[] = [
        {
          couchManagersId: 1,
          fullName: 'Mike Trout',
          mlbTeam: 'LAA',
          mlbamId: 545361,
          positions: ['OF'],
          status: 'drafted',
          winningBid: 45,
          winningTeam: 'Team A',
        },
      ];

      const result = matchAllPlayers(scrapedPlayers, mockProjections);

      expect(result.matched.length).toBe(1);
      const matched = result.matched[0];

      expect(matched.projectedValue).toBe(50);
      expect(matched.actualBid).toBe(45);
      expect(matched.inflationAmount).toBe(-5);
      expect(matched.inflationPercent).toBe(-10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty scraped players list', () => {
      const result = matchAllPlayers([], mockProjections);

      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(0);
    });

    it('should handle empty projections list', () => {
      const scrapedPlayers: ScrapedPlayer[] = [
        {
          couchManagersId: 1,
          fullName: 'Mike Trout',
          mlbTeam: 'LAA',
          mlbamId: 0,
          positions: ['OF'],
          status: 'available',
        },
      ];

      const result = matchAllPlayers(scrapedPlayers, []);

      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(1);
    });

    it('should handle players with no positions', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 1,
        fullName: 'Mike Trout',
        mlbTeam: 'LAA',
        mlbamId: 0,
        positions: [],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      // Should still match based on name and team
      expect(result.player).not.toBeNull();
    });

    it('should handle players with special characters in name', () => {
      const specialNames = [
        "Ha-Seong Kim",
        "Hyun-Jin Ryu",
        "Shohei Ohtani",
        "José Ramírez",
      ];

      specialNames.forEach(name => {
        const normalized = normalizeName(name);
        expect(normalized).toBeDefined();
        expect(normalized).not.toContain('undefined');
      });
    });

    it('should handle very long player names', () => {
      const longName = 'Francisco Antonio Lindor Serrano Jr.';
      const normalized = normalizeName(longName);

      expect(normalized).toBeDefined();
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should handle null/undefined mlbamId', () => {
      const scrapedPlayer: ScrapedPlayer = {
        couchManagersId: 1,
        fullName: 'Mike Trout',
        mlbTeam: 'LAA',
        mlbamId: undefined as any,
        positions: ['OF'],
        status: 'available',
      };

      const result = matchPlayer(scrapedPlayer, mockProjections);

      // Should fall back to name matching
      expect(result.player).not.toBeNull();
    });
  });
});

import { Player, LeagueSettings, DraftedPlayer } from './types';

export function calculateInflation(
  leagueSettings: LeagueSettings,
  allDrafted: DraftedPlayer[]
): number {
  const totalBudget = leagueSettings.numTeams * leagueSettings.budgetPerTeam;
  const totalRosterSpots = leagueSettings.numTeams * Object.values(leagueSettings.rosterSpots).reduce((a, b) => a + b, 0);
  
  // Calculate money spent so far
  const moneySpent = allDrafted.reduce((sum, p) => sum + p.draftedPrice, 0);
  const moneyRemaining = totalBudget - moneySpent;
  
  // Calculate players drafted
  const playersDrafted = allDrafted.length;
  const playersRemaining = totalRosterSpots - playersDrafted;
  
  if (playersRemaining === 0) return 0;
  
  // Calculate expected remaining value (sum of projected values for remaining players)
  // For simplicity, we'll estimate based on average per-player value
  const avgProjectedValue = (totalBudget * 0.95) / totalRosterSpots; // 95% of budget goes to non-$1 players
  const expectedRemainingValue = playersRemaining * avgProjectedValue;
  
  // Inflation rate = (money remaining / expected remaining value) - 1
  if (expectedRemainingValue === 0) return 0;
  
  const inflationRate = (moneyRemaining / expectedRemainingValue) - 1;
  
  return Math.round(inflationRate * 100) / 100; // Round to 2 decimal places
}

export function adjustPlayerValues(
  players: Player[],
  inflationRate: number
): Player[] {
  return players.map(player => ({
    ...player,
    adjustedValue: Math.round(player.projectedValue * (1 + inflationRate))
  }));
}

export function getValueIndicator(bid: number, adjustedValue: number): {
  color: string;
  label: string;
  percentage: number;
} {
  if (adjustedValue === 0) {
    return { color: 'text-gray-500', label: 'N/A', percentage: 0 };
  }
  
  const percentage = ((bid - adjustedValue) / adjustedValue) * 100;
  
  if (percentage <= 20) {
    return { color: 'text-green-600', label: 'Great Deal', percentage };
  } else if (percentage <= 40) {
    return { color: 'text-yellow-600', label: 'Fair Value', percentage };
  } else if (percentage <= 60) {
    return { color: 'text-orange-600', label: 'Slightly Expensive', percentage };
  } else {
    return { color: 'text-red-600', label: 'Overpay', percentage };
  }
}

export function getInflationIndicator(inflationRate: number): {
  color: string;
  bgColor: string;
  label: string;
} {
  const percentage = inflationRate * 100;
  
  if (percentage < 5) {
    return { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Low' };
  } else if (percentage < 15) {
    return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Moderate' };
  } else if (percentage < 25) {
    return { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'High' };
  } else {
    return { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Very High' };
  }
}

export function calculateRosterNeeds(
  leagueSettings: LeagueSettings,
  myRoster: DraftedPlayer[]
): LeagueSettings['rosterSpots'] {
  const needs = { ...leagueSettings.rosterSpots };
  
  // Count filled positions (simplified - using primary position only)
  myRoster.forEach(player => {
    const primaryPosition = player.positions[0];
    if (primaryPosition in needs && needs[primaryPosition as keyof typeof needs] > 0) {
      needs[primaryPosition as keyof typeof needs]--;
    } else if (needs.Bench > 0) {
      needs.Bench--;
    }
  });
  
  return needs;
}

export function getPositionScarcity(
  position: string,
  players: Player[],
  threshold: number = 20
): 'high' | 'medium' | 'low' {
  const availableAtPosition = players.filter(
    p => p.status === 'available' && p.positions.includes(position)
  ).length;
  
  if (availableAtPosition < threshold * 0.3) return 'high';
  if (availableAtPosition < threshold * 0.6) return 'medium';
  return 'low';
}

export function calculateTeamProjectedStats(roster: DraftedPlayer[]): {
  totalSpent: number;
  projectedHR: number;
  projectedRBI: number;
  projectedSB: number;
  projectedW: number;
  projectedK: number;
  projectedSV: number;
} {
  return roster.reduce((acc, player) => ({
    totalSpent: acc.totalSpent + player.draftedPrice,
    projectedHR: acc.projectedHR + (player.projectedStats.HR || 0),
    projectedRBI: acc.projectedRBI + (player.projectedStats.RBI || 0),
    projectedSB: acc.projectedSB + (player.projectedStats.SB || 0),
    projectedW: acc.projectedW + (player.projectedStats.W || 0),
    projectedK: acc.projectedK + (player.projectedStats.K || 0),
    projectedSV: acc.projectedSV + (player.projectedStats.SV || 0),
  }), {
    totalSpent: 0,
    projectedHR: 0,
    projectedRBI: 0,
    projectedSB: 0,
    projectedW: 0,
    projectedK: 0,
    projectedSV: 0,
  });
}

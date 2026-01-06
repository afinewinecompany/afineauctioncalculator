import { useMemo, useState } from 'react';
import { LeagueSettings, Player, ScrapedAuctionData } from '../lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  ChevronDown,
  ChevronUp,
  Medal,
  Zap,
  Users,
  BarChart3,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface TeamRankingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: LeagueSettings;
  auctionData: ScrapedAuctionData | null;
  allDrafted: Player[];
  selectedTeam: string | null;
  isMobile?: boolean;
}

interface TeamRankingData {
  name: string;
  // Core metrics
  totalZScore: number;
  dollarsPerZScore: number;
  moneySpent: number;
  moneyRemaining: number;
  playersDrafted: number;
  rosterSpotsTotal: number;
  // Position breakdown
  hitterZScore: number;
  pitcherZScore: number;
  hitterSpent: number;
  pitcherSpent: number;
  // Value analysis
  totalProjectedValue: number;
  totalActualSpent: number;
  valueGained: number; // Positive = got bargains
  bargainCount: number;
  overpayCount: number;
  // Best/Worst picks
  bestPick: { name: string; value: number; price: number } | null;
  worstPick: { name: string; value: number; price: number } | null;
  // Rankings (filled in after sorting)
  zScoreRank: number;
  efficiencyRank: number;
  valueRank: number;
  overallRank: number;
}

type SortColumn = 'overallRank' | 'zScoreRank' | 'efficiencyRank' | 'valueRank' | 'moneyRemaining';

export function TeamRankings({
  isOpen,
  onClose,
  settings,
  auctionData,
  allDrafted,
  selectedTeam,
  isMobile,
}: TeamRankingsProps) {
  const [sortBy, setSortBy] = useState<SortColumn>('overallRank');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const totalRosterSpots = useMemo(() => {
    const rs = settings.rosterSpots;
    return rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
      rs.OF + rs.CI + rs.MI + rs.UTIL +
      rs.SP + rs.RP + rs.P + rs.Bench;
  }, [settings.rosterSpots]);

  // Calculate team rankings
  const teamRankings = useMemo((): TeamRankingData[] => {
    if (!auctionData?.teams || auctionData.teams.length === 0) {
      return [];
    }

    // Build a map of drafted players by team
    const draftedByTeam = new Map<string, Player[]>();
    allDrafted.forEach(p => {
      const team = p.draftedBy || 'Unknown';
      if (!draftedByTeam.has(team)) {
        draftedByTeam.set(team, []);
      }
      draftedByTeam.get(team)!.push(p);
    });

    // Pitcher positions for categorization
    const pitcherPositions = new Set(['SP', 'RP', 'P']);
    const isPitcher = (player: Player) =>
      player.positions.some(pos => pitcherPositions.has(pos));

    // Calculate stats for each team
    const teamsData: TeamRankingData[] = auctionData.teams.map(team => {
      const teamPlayers = draftedByTeam.get(team.name) || [];

      // Core metrics
      const totalZScore = teamPlayers.reduce((sum, p) => sum + (p.sgpValue || 0), 0);
      const moneySpent = teamPlayers.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
      const moneyRemaining = settings.budgetPerTeam - moneySpent;
      const dollarsPerZScore = totalZScore > 0 ? moneySpent / totalZScore : Infinity;

      // Position breakdown
      const hitters = teamPlayers.filter(p => !isPitcher(p));
      const pitchers = teamPlayers.filter(p => isPitcher(p));
      const hitterZScore = hitters.reduce((sum, p) => sum + (p.sgpValue || 0), 0);
      const pitcherZScore = pitchers.reduce((sum, p) => sum + (p.sgpValue || 0), 0);
      const hitterSpent = hitters.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
      const pitcherSpent = pitchers.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);

      // Value analysis - compare actual price to projected value
      const totalProjectedValue = teamPlayers.reduce((sum, p) => sum + (p.projectedValue || 0), 0);
      const totalActualSpent = moneySpent;
      const valueGained = totalProjectedValue - totalActualSpent; // Positive = bargains

      // Count bargains and overpays (10% threshold)
      let bargainCount = 0;
      let overpayCount = 0;
      teamPlayers.forEach(p => {
        const projVal = p.projectedValue || 0;
        const price = p.draftedPrice || 0;
        if (price < projVal * 0.9) bargainCount++;
        else if (price > projVal * 1.1) overpayCount++;
      });

      // Find best and worst picks
      let bestPick: { name: string; value: number; price: number } | null = null;
      let worstPick: { name: string; value: number; price: number } | null = null;
      let bestSavings = -Infinity;
      let worstOverpay = -Infinity;

      teamPlayers.forEach(p => {
        const projVal = p.projectedValue || 0;
        const price = p.draftedPrice || 0;
        const savings = projVal - price;

        if (savings > bestSavings && projVal > 0) {
          bestSavings = savings;
          bestPick = { name: p.name, value: projVal, price };
        }
        if (-savings > worstOverpay && projVal > 0) {
          worstOverpay = -savings;
          worstPick = { name: p.name, value: projVal, price };
        }
      });

      return {
        name: team.name,
        totalZScore,
        dollarsPerZScore,
        moneySpent,
        moneyRemaining,
        playersDrafted: teamPlayers.length,
        rosterSpotsTotal: totalRosterSpots,
        hitterZScore,
        pitcherZScore,
        hitterSpent,
        pitcherSpent,
        totalProjectedValue,
        totalActualSpent,
        valueGained,
        bargainCount,
        overpayCount,
        bestPick,
        worstPick,
        // Placeholders - will be filled in after sorting
        zScoreRank: 0,
        efficiencyRank: 0,
        valueRank: 0,
        overallRank: 0,
      };
    });

    // Calculate rankings for each metric
    // Z-Score rank (higher is better)
    const byZScore = [...teamsData].sort((a, b) => b.totalZScore - a.totalZScore);
    byZScore.forEach((team, idx) => {
      const original = teamsData.find(t => t.name === team.name);
      if (original) original.zScoreRank = idx + 1;
    });

    // Efficiency rank (lower $/Z is better, but handle teams with 0 Z-Score)
    const byEfficiency = [...teamsData].sort((a, b) => {
      // Teams with no Z-score go to the bottom
      if (a.totalZScore === 0 && b.totalZScore === 0) return 0;
      if (a.totalZScore === 0) return 1;
      if (b.totalZScore === 0) return -1;
      return a.dollarsPerZScore - b.dollarsPerZScore;
    });
    byEfficiency.forEach((team, idx) => {
      const original = teamsData.find(t => t.name === team.name);
      if (original) original.efficiencyRank = idx + 1;
    });

    // Value rank (higher value gained is better)
    const byValue = [...teamsData].sort((a, b) => b.valueGained - a.valueGained);
    byValue.forEach((team, idx) => {
      const original = teamsData.find(t => t.name === team.name);
      if (original) original.valueRank = idx + 1;
    });

    // Overall rank (weighted average of ranks - lower is better)
    // Weight: Z-Score 50%, Efficiency 30%, Value 20%
    teamsData.forEach(team => {
      team.overallRank = Math.round(
        team.zScoreRank * 0.5 +
        team.efficiencyRank * 0.3 +
        team.valueRank * 0.2
      );
    });

    // Re-rank overall by the calculated score
    const byOverall = [...teamsData].sort((a, b) => a.overallRank - b.overallRank);
    byOverall.forEach((team, idx) => {
      const original = teamsData.find(t => t.name === team.name);
      if (original) original.overallRank = idx + 1;
    });

    return teamsData;
  }, [auctionData, allDrafted, settings.budgetPerTeam, totalRosterSpots]);

  // Sort teams
  const sortedTeams = useMemo(() => {
    const sorted = [...teamRankings];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'overallRank':
          comparison = a.overallRank - b.overallRank;
          break;
        case 'zScoreRank':
          comparison = a.zScoreRank - b.zScoreRank;
          break;
        case 'efficiencyRank':
          comparison = a.efficiencyRank - b.efficiencyRank;
          break;
        case 'valueRank':
          comparison = a.valueRank - b.valueRank;
          break;
        case 'moneyRemaining':
          comparison = b.moneyRemaining - a.moneyRemaining;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
    return sorted;
  }, [teamRankings, sortBy, sortAsc]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(true);
    }
  };

  // League-wide stats for context
  const leagueStats = useMemo(() => {
    if (teamRankings.length === 0) return null;

    const avgZScore = teamRankings.reduce((sum, t) => sum + t.totalZScore, 0) / teamRankings.length;
    const avgEfficiency = teamRankings
      .filter(t => t.totalZScore > 0)
      .reduce((sum, t) => sum + t.dollarsPerZScore, 0) /
      teamRankings.filter(t => t.totalZScore > 0).length || 0;
    const totalSpent = teamRankings.reduce((sum, t) => sum + t.moneySpent, 0);
    const totalDrafted = teamRankings.reduce((sum, t) => sum + t.playersDrafted, 0);

    return { avgZScore, avgEfficiency, totalSpent, totalDrafted };
  }, [teamRankings]);

  const RankBadge = ({ rank }: { rank: number }) => {
    if (rank === 1) return <span className="text-lg">🥇</span>;
    if (rank === 2) return <span className="text-lg">🥈</span>;
    if (rank === 3) return <span className="text-lg">🥉</span>;
    return <span className="text-slate-400 text-sm font-medium">#{rank}</span>;
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  if (teamRankings.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Team Rankings
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">No auction data available yet.</p>
            <p className="text-slate-500 text-sm mt-1">Rankings will appear once the draft begins.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className={`bg-slate-900 border-slate-700 text-white ${isMobile ? 'max-w-full h-[90vh]' : 'max-w-5xl max-h-[85vh]'} overflow-hidden flex flex-col`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Team Rankings
          </DialogTitle>
        </DialogHeader>

        {/* League Summary */}
        {leagueStats && (
          <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-2 mb-4 flex-shrink-0`}>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <BarChart3 className="w-3 h-3" />
                Avg Z-Score
              </div>
              <div className="text-emerald-400 font-semibold">{leagueStats.avgZScore.toFixed(1)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Zap className="w-3 h-3" />
                Avg $/Z
              </div>
              <div className="text-blue-400 font-semibold">${leagueStats.avgEfficiency.toFixed(2)}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <DollarSign className="w-3 h-3" />
                Total Spent
              </div>
              <div className="text-white font-semibold">${leagueStats.totalSpent}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Users className="w-3 h-3" />
                Players Drafted
              </div>
              <div className="text-white font-semibold">{leagueStats.totalDrafted}</div>
            </div>
          </div>
        )}

        {/* Rankings Table/Cards */}
        <div className="flex-1 overflow-y-auto">
          {isMobile ? (
            /* Mobile: Card layout */
            <div className="space-y-2">
              {sortedTeams.map((team) => (
                <div
                  key={team.name}
                  className={`rounded-lg border transition-all ${
                    team.name === selectedTeam
                      ? 'bg-emerald-900/30 border-emerald-500/50'
                      : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  {/* Main row - always visible */}
                  <button
                    onClick={() => setExpandedTeam(expandedTeam === team.name ? null : team.name)}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <RankBadge rank={team.overallRank} />
                        <span className={`font-medium ${team.name === selectedTeam ? 'text-emerald-300' : 'text-white'}`}>
                          {team.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">{team.totalZScore.toFixed(1)} Z</span>
                        {expandedTeam === team.name ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">$/Z</span>
                        <div className={team.totalZScore > 0 ? 'text-blue-400' : 'text-slate-500'}>
                          {team.totalZScore > 0 ? `$${team.dollarsPerZScore.toFixed(2)}` : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Spent</span>
                        <div className="text-slate-300">${team.moneySpent}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Value</span>
                        <div className={team.valueGained >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {team.valueGained >= 0 ? '+' : ''}{team.valueGained.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {expandedTeam === team.name && (
                    <div className="px-3 pb-3 pt-0 border-t border-slate-700/50 mt-2">
                      <div className="grid grid-cols-2 gap-3 text-xs mt-3">
                        <div>
                          <span className="text-slate-500">Hitter Z / $</span>
                          <div className="text-slate-300">{team.hitterZScore.toFixed(1)} / ${team.hitterSpent}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Pitcher Z / $</span>
                          <div className="text-slate-300">{team.pitcherZScore.toFixed(1)} / ${team.pitcherSpent}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Bargains</span>
                          <div className="text-emerald-400">{team.bargainCount}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Overpays</span>
                          <div className="text-red-400">{team.overpayCount}</div>
                        </div>
                      </div>
                      {team.bestPick && (
                        <div className="mt-3 p-2 bg-emerald-900/20 rounded border border-emerald-500/30">
                          <div className="flex items-center gap-1 text-emerald-400 text-xs mb-1">
                            <Sparkles className="w-3 h-3" /> Best Pick
                          </div>
                          <div className="text-white text-sm">{team.bestPick.name}</div>
                          <div className="text-emerald-300 text-xs">
                            ${team.bestPick.price} (value: ${team.bestPick.value.toFixed(0)})
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Desktop: Table layout */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="border-b border-slate-700/50">
                    <th
                      className="text-left py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('overallRank')}
                    >
                      <div className="flex items-center gap-1">
                        <Medal className="w-4 h-4" /> Overall <SortIcon column="overallRank" />
                      </div>
                    </th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Team</th>
                    <th
                      className="text-center py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('zScoreRank')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <BarChart3 className="w-4 h-4" /> Z-Score <SortIcon column="zScoreRank" />
                      </div>
                    </th>
                    <th
                      className="text-center py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('efficiencyRank')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Zap className="w-4 h-4" /> $/Z <SortIcon column="efficiencyRank" />
                      </div>
                    </th>
                    <th
                      className="text-center py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('valueRank')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Target className="w-4 h-4" /> Value <SortIcon column="valueRank" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Hitters</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Pitchers</th>
                    <th
                      className="text-right py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('moneyRemaining')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="w-4 h-4" /> Left <SortIcon column="moneyRemaining" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Best Pick</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.map((team) => (
                    <tr
                      key={team.name}
                      className={`border-b border-slate-700/30 transition-colors ${
                        team.name === selectedTeam
                          ? 'bg-emerald-900/20'
                          : 'hover:bg-slate-700/30'
                      }`}
                    >
                      {/* Overall Rank */}
                      <td className="py-3 px-2 text-center">
                        <RankBadge rank={team.overallRank} />
                      </td>

                      {/* Team Name */}
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${team.name === selectedTeam ? 'text-emerald-300' : 'text-white'}`}>
                            {team.name}
                          </span>
                          <span className="text-slate-500 text-xs">
                            {team.playersDrafted}/{team.rosterSpotsTotal}
                          </span>
                        </div>
                      </td>

                      {/* Z-Score */}
                      <td className="py-3 px-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-emerald-400 font-bold">{team.totalZScore.toFixed(1)}</span>
                          <span className="text-slate-500 text-xs">#{team.zScoreRank}</span>
                        </div>
                      </td>

                      {/* Efficiency ($/Z) */}
                      <td className="py-3 px-2 text-center">
                        <div className="flex flex-col items-center">
                          {team.totalZScore > 0 ? (
                            <>
                              <span className={`font-bold ${
                                team.efficiencyRank <= 3 ? 'text-emerald-400' :
                                team.efficiencyRank <= 6 ? 'text-blue-400' : 'text-slate-300'
                              }`}>
                                ${team.dollarsPerZScore.toFixed(2)}
                              </span>
                              <span className="text-slate-500 text-xs">#{team.efficiencyRank}</span>
                            </>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </div>
                      </td>

                      {/* Value Gained */}
                      <td className="py-3 px-2 text-center">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1">
                            {team.valueGained >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-400" />
                            )}
                            <span className={`font-bold ${team.valueGained >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {team.valueGained >= 0 ? '+' : ''}{team.valueGained.toFixed(0)}
                            </span>
                          </div>
                          <span className="text-slate-500 text-xs">
                            {team.bargainCount}↑ {team.overpayCount}↓
                          </span>
                        </div>
                      </td>

                      {/* Hitters */}
                      <td className="py-3 px-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-amber-400 font-medium">{team.hitterZScore.toFixed(1)}</span>
                          <span className="text-slate-500 text-xs">${team.hitterSpent}</span>
                        </div>
                      </td>

                      {/* Pitchers */}
                      <td className="py-3 px-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-purple-400 font-medium">{team.pitcherZScore.toFixed(1)}</span>
                          <span className="text-slate-500 text-xs">${team.pitcherSpent}</span>
                        </div>
                      </td>

                      {/* Money Remaining */}
                      <td className="py-3 px-2 text-right">
                        <span className={`font-bold ${
                          team.moneyRemaining > 50 ? 'text-emerald-400' :
                          team.moneyRemaining > 20 ? 'text-blue-400' : 'text-amber-400'
                        }`}>
                          ${team.moneyRemaining}
                        </span>
                      </td>

                      {/* Best Pick */}
                      <td className="py-3 px-2">
                        {team.bestPick ? (
                          <div className="flex flex-col items-center">
                            <span className="text-white text-xs truncate max-w-[100px]" title={team.bestPick.name}>
                              {team.bestPick.name.split(' ').slice(-1)[0]}
                            </span>
                            <span className="text-emerald-400 text-xs">
                              ${team.bestPick.price} (${team.bestPick.value.toFixed(0)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className={`flex flex-wrap items-center gap-4 ${isMobile ? 'text-xs' : 'text-sm'} border-t border-slate-700/50 pt-3 mt-3 flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Z-Score = Total player value (SGP)</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400">$/Z = Dollars spent per Z-Score point</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400">Value = Projected - Actual price</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

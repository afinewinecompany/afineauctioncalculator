import { useMemo, useState } from 'react';
import { LeagueSettings, ScrapedAuctionData, Player } from '../lib/types';
import { Users, DollarSign, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Wifi, WifiOff, AlertTriangle, Crown } from 'lucide-react';

interface TeamOverviewGridProps {
  settings: LeagueSettings;
  auctionData: ScrapedAuctionData | null;
  allDrafted: Player[];
  selectedTeam: string | null;
  isMobile?: boolean;
}

interface TeamStats {
  name: string;
  playersDrafted: number;
  playersOnBlock: number;
  totalPlayers: number;
  moneySpent: number;
  moneyOnBlock: number;
  totalCommitted: number;
  moneyRemaining: number;
  effectiveRemaining: number;
  avgPerRemainingPlayer: number;
  rosterSpotsRemaining: number;
  isOnline: boolean;
  budgetHealth: 'healthy' | 'tight' | 'critical';
}

export function TeamOverviewGrid({
  settings,
  auctionData,
  allDrafted,
  selectedTeam,
  isMobile,
}: TeamOverviewGridProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'remaining' | 'avgLeft'>('remaining');
  const [sortAsc, setSortAsc] = useState(false);

  const totalRosterSpots = useMemo(() => {
    const rs = settings.rosterSpots;
    return rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
      rs.OF + rs.CI + rs.MI + rs.UTIL +
      rs.SP + rs.RP + rs.P + rs.Bench;
  }, [settings.rosterSpots]);

  // Calculate team stats from auction data and drafted players
  const teamStats = useMemo((): TeamStats[] => {
    if (!auctionData?.teams || auctionData.teams.length === 0) {
      // No sync data - can't show team grid
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

    // Count on_block players by current bidder (team they'd go to if auction ends)
    const onBlockByTeam = new Map<string, number>();
    const onBlockValueByTeam = new Map<string, number>();
    auctionData.activeAuctions?.forEach(auction => {
      const bidder = auction.currentBidder || 'Unknown';
      onBlockByTeam.set(bidder, (onBlockByTeam.get(bidder) || 0) + 1);
      onBlockValueByTeam.set(bidder, (onBlockValueByTeam.get(bidder) || 0) + auction.currentBid);
    });

    return auctionData.teams.map(team => {
      const teamDrafted = draftedByTeam.get(team.name) || [];
      const draftedCount = teamDrafted.length;
      const onBlockCount = onBlockByTeam.get(team.name) || 0;
      const onBlockValue = onBlockValueByTeam.get(team.name) || 0;

      // Use sync data for spending, which is more accurate
      const moneySpent = team.spent || teamDrafted.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
      const moneyRemaining = team.remaining || (settings.budgetPerTeam - moneySpent);

      // Effective remaining = remaining - on block bids
      const effectiveRemaining = moneyRemaining - onBlockValue;

      const rosterSpotsRemaining = totalRosterSpots - draftedCount - onBlockCount;

      // Average $ left per remaining player (must reserve $1 per remaining spot)
      const reservedForMinBids = Math.max(0, rosterSpotsRemaining - 1); // -1 because last player gets all
      const spendableBudget = Math.max(0, effectiveRemaining - reservedForMinBids);
      const avgPerRemainingPlayer = rosterSpotsRemaining > 0
        ? Math.round(effectiveRemaining / rosterSpotsRemaining)
        : 0;

      // Budget health indicator
      let budgetHealth: 'healthy' | 'tight' | 'critical' = 'healthy';
      if (avgPerRemainingPlayer <= 1) {
        budgetHealth = 'critical';
      } else if (avgPerRemainingPlayer <= 3) {
        budgetHealth = 'tight';
      }

      return {
        name: team.name,
        playersDrafted: draftedCount,
        playersOnBlock: onBlockCount,
        totalPlayers: draftedCount + onBlockCount,
        moneySpent,
        moneyOnBlock: onBlockValue,
        totalCommitted: moneySpent + onBlockValue,
        moneyRemaining,
        effectiveRemaining,
        avgPerRemainingPlayer,
        rosterSpotsRemaining,
        isOnline: team.isOnline,
        budgetHealth,
      };
    });
  }, [auctionData, allDrafted, settings.budgetPerTeam, totalRosterSpots]);

  // Sort teams
  const sortedTeams = useMemo(() => {
    const sorted = [...teamStats];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'remaining':
          comparison = a.effectiveRemaining - b.effectiveRemaining;
          break;
        case 'avgLeft':
          comparison = a.avgPerRemainingPlayer - b.avgPerRemainingPlayer;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
    return sorted;
  }, [teamStats, sortBy, sortAsc]);

  const handleSort = (column: 'name' | 'remaining' | 'avgLeft') => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(column === 'name'); // Default ascending for name, descending for numbers
    }
  };

  // Calculate league-wide stats
  // NOTE: This useMemo must be BEFORE any early returns to comply with React Rules of Hooks
  // (React error #310: "Rendered more hooks than during the previous render")
  const leagueStats = useMemo(() => {
    if (teamStats.length === 0) {
      return {
        totalSpent: 0,
        totalRemaining: 0,
        totalDrafted: 0,
        teamsWithTightBudget: 0,
      };
    }
    const totalSpent = teamStats.reduce((sum, t) => sum + t.moneySpent, 0);
    const totalRemaining = teamStats.reduce((sum, t) => sum + t.moneyRemaining, 0);
    const totalDrafted = teamStats.reduce((sum, t) => sum + t.playersDrafted, 0);
    const teamsWithTightBudget = teamStats.filter(t => t.budgetHealth !== 'healthy').length;

    return {
      totalSpent,
      totalRemaining,
      totalDrafted,
      teamsWithTightBudget,
    };
  }, [teamStats]);

  // If no team data, don't render - must be AFTER all hooks
  if (teamStats.length === 0) {
    return null;
  }

  const SortIcon = ({ column }: { column: 'name' | 'remaining' | 'avgLeft' }) => {
    if (sortBy !== column) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl backdrop-blur-sm shadow-xl">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} hover:bg-slate-700/30 transition-colors rounded-t-xl`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="text-white font-semibold">Team Overview</h3>
            <p className="text-slate-400 text-sm">
              {teamStats.length} teams • ${leagueStats.totalRemaining.toLocaleString()} remaining
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {leagueStats.teamsWithTightBudget > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">{leagueStats.teamsWithTightBudget} tight</span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className={`${isMobile ? 'p-3 pt-0' : 'p-4 pt-0'}`}>
          {/* Mobile: Card layout */}
          {isMobile ? (
            <div className="space-y-2">
              {sortedTeams.map((team) => (
                <div
                  key={team.name}
                  className={`p-3 rounded-lg border transition-all ${
                    team.name === selectedTeam
                      ? 'bg-emerald-900/30 border-emerald-500/50'
                      : team.budgetHealth === 'critical'
                        ? 'bg-red-900/20 border-red-500/30'
                        : team.budgetHealth === 'tight'
                          ? 'bg-amber-900/20 border-amber-500/30'
                          : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {team.name === selectedTeam && (
                        <Crown className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className={`font-medium ${team.name === selectedTeam ? 'text-emerald-300' : 'text-white'}`}>
                        {team.name}
                      </span>
                      {team.isOnline ? (
                        <Wifi className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                    <span className={`font-bold ${
                      team.budgetHealth === 'critical' ? 'text-red-400' :
                      team.budgetHealth === 'tight' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      ${team.effectiveRemaining}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Players</span>
                      <div className="text-slate-300">{team.playersDrafted}/{totalRosterSpots}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Spent</span>
                      <div className="text-slate-300">${team.moneySpent}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Avg/Player</span>
                      <div className={`${
                        team.avgPerRemainingPlayer <= 1 ? 'text-red-400' :
                        team.avgPerRemainingPlayer <= 3 ? 'text-amber-400' : 'text-slate-300'
                      }`}>${team.avgPerRemainingPlayer}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop: Table layout */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th
                      className="text-left py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Team <SortIcon column="name" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Status</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">
                      <div className="flex items-center justify-center gap-1" title="Players Drafted / On Block">
                        <Users className="w-4 h-4" /> Players
                      </div>
                    </th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="w-4 h-4" /> Spent
                      </div>
                    </th>
                    <th className="text-right py-3 px-2 text-slate-400 font-medium">On Block</th>
                    <th
                      className="text-right py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('remaining')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Remaining <SortIcon column="remaining" />
                      </div>
                    </th>
                    <th
                      className="text-right py-3 px-2 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('avgLeft')}
                      title="Average $ per remaining roster spot"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Avg/Player <SortIcon column="avgLeft" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-slate-400 font-medium">Spots Left</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.map((team) => (
                    <tr
                      key={team.name}
                      className={`border-b border-slate-700/30 transition-colors ${
                        team.name === selectedTeam
                          ? 'bg-emerald-900/20'
                          : team.budgetHealth === 'critical'
                            ? 'bg-red-900/10'
                            : team.budgetHealth === 'tight'
                              ? 'bg-amber-900/10'
                              : 'hover:bg-slate-700/30'
                      }`}
                    >
                      {/* Team Name */}
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {team.name === selectedTeam && (
                            <Crown className="w-4 h-4 text-emerald-400" />
                          )}
                          <span className={`font-medium ${team.name === selectedTeam ? 'text-emerald-300' : 'text-white'}`}>
                            {team.name}
                          </span>
                        </div>
                      </td>

                      {/* Online Status */}
                      <td className="py-3 px-2 text-center">
                        {team.isOnline ? (
                          <div className="flex items-center justify-center gap-1">
                            <Wifi className="w-4 h-4 text-emerald-400" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <WifiOff className="w-4 h-4 text-slate-500" />
                          </div>
                        )}
                      </td>

                      {/* Players Drafted / On Block */}
                      <td className="py-3 px-2 text-center">
                        <span className="text-white font-medium">{team.playersDrafted}</span>
                        {team.playersOnBlock > 0 && (
                          <span className="text-amber-400 ml-1">(+{team.playersOnBlock})</span>
                        )}
                        <span className="text-slate-500">/{totalRosterSpots}</span>
                      </td>

                      {/* Money Spent */}
                      <td className="py-3 px-2 text-right">
                        <span className="text-white font-medium">${team.moneySpent}</span>
                      </td>

                      {/* On Block Value */}
                      <td className="py-3 px-2 text-right">
                        {team.moneyOnBlock > 0 ? (
                          <span className="text-amber-400 font-medium">${team.moneyOnBlock}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* Remaining Budget */}
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {team.budgetHealth === 'critical' ? (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          ) : team.budgetHealth === 'tight' ? (
                            <TrendingDown className="w-4 h-4 text-amber-400" />
                          ) : (
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          )}
                          <span className={`font-bold ${
                            team.budgetHealth === 'critical' ? 'text-red-400' :
                            team.budgetHealth === 'tight' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            ${team.effectiveRemaining}
                          </span>
                        </div>
                      </td>

                      {/* Avg Per Remaining Player */}
                      <td className="py-3 px-2 text-right">
                        <span className={`font-medium ${
                          team.avgPerRemainingPlayer <= 1 ? 'text-red-400' :
                          team.avgPerRemainingPlayer <= 3 ? 'text-amber-400' :
                          team.avgPerRemainingPlayer <= 5 ? 'text-slate-300' : 'text-emerald-400'
                        }`}>
                          ${team.avgPerRemainingPlayer}
                        </span>
                      </td>

                      {/* Roster Spots Remaining */}
                      <td className="py-3 px-2 text-center">
                        <span className={`font-medium ${
                          team.rosterSpotsRemaining <= 3 ? 'text-amber-400' : 'text-slate-300'
                        }`}>
                          {team.rosterSpotsRemaining}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className={`flex flex-wrap items-center gap-4 ${isMobile ? 'mt-3 text-xs' : 'mt-4 text-sm'} border-t border-slate-700/50 pt-3`}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500/50 border border-emerald-500"></div>
              <span className="text-slate-400">Healthy Budget</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500/50 border border-amber-500"></div>
              <span className="text-slate-400">Tight ($3/player or less)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500/50 border border-red-500"></div>
              <span className="text-slate-400">Critical ($1/player or less)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

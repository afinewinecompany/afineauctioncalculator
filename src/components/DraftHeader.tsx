import { LeagueSettings } from '../lib/types';
import { getInflationIndicator } from '../lib/calculations';
import { DollarSign, Users, TrendingUp, Trophy } from 'lucide-react';

interface DraftHeaderProps {
  settings: LeagueSettings;
  moneyRemaining: number;
  rosterNeedsRemaining: LeagueSettings['rosterSpots'];
  totalDrafted: number;
  inflationRate: number;
  isMobile?: boolean;
  onOpenTeamRankings?: () => void;
}

export function DraftHeader({
  settings,
  moneyRemaining,
  rosterNeedsRemaining,
  totalDrafted,
  inflationRate,
  isMobile,
  onOpenTeamRankings,
}: DraftHeaderProps) {
  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const totalPlayersNeeded = totalRosterSpots * settings.numTeams;
  const spotsRemaining = Object.values(rosterNeedsRemaining).reduce((a, b) => a + b, 0);

  // Use client-side inflationRate (which includes on_block players) as primary source
  // This matches InflationTracker's calculation for consistency
  // inflationRate from DraftRoom is already a decimal (0.15 = 15%), so multiply by 100 for display
  const displayInflationRate = inflationRate * 100;

  // getInflationIndicator expects decimal format
  const inflationIndicator = getInflationIndicator(inflationRate);

  // Get inflation color classes
  const inflationGradient = inflationIndicator.color === 'text-blue-600' ? 'from-blue-600 to-blue-700' :
    inflationIndicator.color === 'text-yellow-600' ? 'from-yellow-600 to-yellow-700' :
    inflationIndicator.color === 'text-orange-600' ? 'from-orange-600 to-orange-700' :
    'from-red-600 to-red-700';

  const inflationTextColor = inflationIndicator.color === 'text-blue-600' ? 'text-blue-400' :
    inflationIndicator.color === 'text-yellow-600' ? 'text-yellow-400' :
    inflationIndicator.color === 'text-orange-600' ? 'text-orange-400' :
    'text-red-400';

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 shadow-lg">
      <div className="px-3 py-2 md:px-6 md:py-4">
        {isMobile ? (
          /* MOBILE: Stacked 2x2 grid layout - no position breakdown */
          <div className="grid grid-cols-2 gap-2">
            {/* Budget */}
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50">
              <div className="p-1.5 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-slate-500 text-[10px]">Budget</span>
                <span className="text-emerald-400 text-sm font-semibold">${moneyRemaining}</span>
              </div>
            </div>

            {/* Roster Spots */}
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50">
              <div className="p-1.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-slate-500 text-[10px]">Spots</span>
                <span className="text-blue-400 text-sm font-semibold">{spotsRemaining}/{totalRosterSpots}</span>
              </div>
            </div>

            {/* Draft Progress */}
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50">
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-slate-500 text-[10px]">Drafted</span>
                <span className="text-white text-sm font-semibold">{totalDrafted}/{totalPlayersNeeded}</span>
              </div>
              <div className="w-12 bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-gradient-to-r from-blue-600 to-emerald-600 h-1.5 rounded-full"
                  style={{ width: `${(totalDrafted / totalPlayersNeeded) * 100}%` }}
                />
              </div>
            </div>

            {/* Inflation Rate */}
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700/50">
              <div className={`p-1.5 rounded bg-gradient-to-br ${inflationGradient}`}>
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-slate-500 text-[10px]">Inflation</span>
                <span className={`text-sm font-semibold ${inflationTextColor}`}>
                  {displayInflationRate >= 0 ? '+' : ''}{displayInflationRate.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* DESKTOP: Original layout */
          <div className="flex items-center justify-between gap-6 flex-wrap">
            {/* Budget */}
            <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="p-2 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Budget Remaining</span>
                <span className="text-emerald-400">${moneyRemaining}</span>
              </div>
            </div>

            {/* Roster Spots */}
            <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Roster Spots Left</span>
                <span className="text-blue-400">{spotsRemaining} / {totalRosterSpots}</span>
              </div>
            </div>

            {/* Position Breakdown */}
            <div className="flex items-center gap-2">
              {Object.entries(rosterNeedsRemaining).map(([pos, count]) => (
                count > 0 && (
                  <div key={pos} className="px-3 py-1.5 bg-slate-800/70 border border-slate-600 rounded-lg text-slate-300 backdrop-blur-sm">
                    {pos}: <span className="text-white">{count}</span>
                  </div>
                )
              ))}
            </div>

            {/* Draft Progress */}
            <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="flex flex-col">
                <span className="text-slate-400">Total Players Drafted</span>
                <span className="text-white">{totalDrafted} / {totalPlayersNeeded}</span>
              </div>
              <div className="w-24 bg-slate-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-600 to-emerald-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(totalDrafted / totalPlayersNeeded) * 100}%` }}
                />
              </div>
            </div>

            {/* Inflation Rate */}
            <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${inflationGradient}`}>
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-slate-400">Inflation Rate</span>
                <div className={inflationTextColor}>
                  {displayInflationRate >= 0 ? '+' : ''}{displayInflationRate.toFixed(1)}% ({inflationIndicator.label})
                </div>
              </div>
            </div>

            {/* Team Rankings Button */}
            {onOpenTeamRankings && (
              <button
                onClick={onOpenTeamRankings}
                className="flex items-center gap-3 bg-gradient-to-br from-amber-600/20 to-amber-700/20 hover:from-amber-600/30 hover:to-amber-700/30 px-4 py-3 rounded-xl border border-amber-500/30 hover:border-amber-500/50 backdrop-blur-sm transition-all group"
              >
                <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg group-hover:scale-105 transition-transform">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-amber-300 font-medium">Team Rankings</span>
                  <span className="text-amber-400/70 text-xs">View standings</span>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { LeagueSettings } from '../lib/types';
import { getInflationIndicator } from '../lib/calculations';
import { DollarSign, Users, TrendingUp } from 'lucide-react';

interface DraftHeaderProps {
  settings: LeagueSettings;
  moneyRemaining: number;
  rosterNeedsRemaining: LeagueSettings['rosterSpots'];
  totalDrafted: number;
  inflationRate: number;
}

export function DraftHeader({ 
  settings, 
  moneyRemaining, 
  rosterNeedsRemaining,
  totalDrafted,
  inflationRate 
}: DraftHeaderProps) {
  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const totalPlayersNeeded = totalRosterSpots * settings.numTeams;
  const spotsRemaining = Object.values(rosterNeedsRemaining).reduce((a, b) => a + b, 0);
  
  const inflationIndicator = getInflationIndicator(inflationRate);

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 shadow-lg">
      <div className="px-6 py-4">
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
            <div className={`p-2 rounded-lg bg-gradient-to-br ${
              inflationIndicator.color === 'text-blue-600' ? 'from-blue-600 to-blue-700' :
              inflationIndicator.color === 'text-yellow-600' ? 'from-yellow-600 to-yellow-700' :
              inflationIndicator.color === 'text-orange-600' ? 'from-orange-600 to-orange-700' :
              'from-red-600 to-red-700'
            }`}>
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Inflation Rate</span>
              <div className={`${
                inflationIndicator.color === 'text-blue-600' ? 'text-blue-400' :
                inflationIndicator.color === 'text-yellow-600' ? 'text-yellow-400' :
                inflationIndicator.color === 'text-orange-600' ? 'text-orange-400' :
                'text-red-400'
              }`}>
                {inflationRate >= 0 ? '+' : ''}{(inflationRate * 100).toFixed(1)}% ({inflationIndicator.label})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

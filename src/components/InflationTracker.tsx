import { LeagueSettings, DraftedPlayer } from '../lib/types';
import { TrendingUp, DollarSign, Users, Target } from 'lucide-react';
import { getInflationIndicator } from '../lib/calculations';

interface InflationTrackerProps {
  settings: LeagueSettings;
  allDrafted: DraftedPlayer[];
  inflationRate: number;
}

export function InflationTracker({ settings, allDrafted, inflationRate }: InflationTrackerProps) {
  const totalBudget = settings.numTeams * settings.budgetPerTeam;
  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const totalPlayersNeeded = settings.numTeams * totalRosterSpots;
  
  const moneySpent = allDrafted.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
  const avgPrice = allDrafted.length > 0 ? Math.round(moneySpent / allDrafted.length) : 0;
  const draftProgress = totalPlayersNeeded > 0 ? Math.round((allDrafted.length / totalPlayersNeeded) * 100) : 0;
  
  const inflationIndicator = getInflationIndicator(inflationRate);
  
  // Calculate projected final inflation (rough estimate)
  const projectedFinalInflation = inflationRate * 1.2; // Typically increases as draft progresses

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 space-y-4 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Inflation Analysis
        </h3>
        <div className={`px-3 py-1 rounded-lg ${
          inflationIndicator.color === 'text-blue-600' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' :
          inflationIndicator.color === 'text-yellow-600' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
          inflationIndicator.color === 'text-orange-600' ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' :
          'bg-red-900/30 text-red-400 border border-red-500/30'
        }`}>
          {inflationRate >= 0 ? '+' : ''}{(inflationRate * 100).toFixed(1)}%
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Total Budget</div>
          <div className="text-white">${totalBudget.toLocaleString()}</div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Money Spent</div>
          <div className="text-white">${moneySpent.toLocaleString()}</div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Players Drafted</div>
          <div className="text-white">{allDrafted.length} / {totalPlayersNeeded}</div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Avg $ Spent</div>
          <div className="text-white">${avgPrice}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400">Draft Progress</span>
          <span className="text-slate-300">{draftProgress}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 transition-all duration-500"
            style={{ width: `${draftProgress}%` }}
          />
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-3">
        <div className="text-blue-300">
          <div className="mb-1">{inflationIndicator.label}</div>
          <div className="text-slate-400">
            As players are drafted, remaining player values adjust based on the money left in the pool.
          </div>
        </div>
      </div>
    </div>
  );
}
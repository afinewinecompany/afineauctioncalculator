import { LeagueSettings, Player, SyncState, InflationStats, CurrentAuction } from '../lib/types';
import { TrendingUp, RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { getInflationIndicator } from '../lib/calculations';
import { formatLastSync } from '../lib/auctionApi';

interface InflationTrackerProps {
  settings: LeagueSettings;
  allDrafted: Player[];
  inflationRate: number;
  // Couch Managers sync props
  syncState?: SyncState;
  liveInflationStats?: InflationStats | null;
  currentAuction?: CurrentAuction | null;
  onManualSync?: () => void;
}

export function InflationTracker({
  settings,
  allDrafted,
  inflationRate,
  syncState,
  liveInflationStats,
  currentAuction,
  onManualSync,
}: InflationTrackerProps) {
  const totalBudget = settings.numTeams * settings.budgetPerTeam;
  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const totalPlayersNeeded = settings.numTeams * totalRosterSpots;
  
  const moneySpent = allDrafted.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
  const avgPrice = allDrafted.length > 0 ? Math.round(moneySpent / allDrafted.length) : 0;
  const draftProgress = totalPlayersNeeded > 0 ? Math.round((allDrafted.length / totalPlayersNeeded) * 100) : 0;
  
  const inflationIndicator = getInflationIndicator(inflationRate);
  
  // Calculate projected final inflation (rough estimate)
  const projectedFinalInflation = inflationRate * 1.2; // Typically increases as draft progresses

  // Use live inflation stats if available, otherwise use calculated rate
  const displayInflationRate = liveInflationStats?.overallInflationRate ?? (inflationRate * 100);
  const displayMoneySpent = liveInflationStats?.totalActualSpent ?? moneySpent;
  const displayDraftedCount = liveInflationStats?.draftedPlayersCount ?? allDrafted.length;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-4 space-y-4 backdrop-blur-sm shadow-xl">
      {/* Sync Status Header */}
      {settings.couchManagerRoomId && syncState && (
        <div className="flex items-center justify-between text-sm border-b border-slate-700/50 pb-3 mb-1">
          <div className="flex items-center gap-2">
            {syncState.isConnected ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : syncState.syncError ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-slate-500" />
            )}
            <span className={syncState.isConnected ? 'text-emerald-400' : 'text-slate-400'}>
              {syncState.isSyncing ? 'Syncing...' : syncState.isConnected ? 'Live Sync' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">
              {formatLastSync(syncState.lastSyncAt)}
            </span>
            {onManualSync && (
              <button
                onClick={onManualSync}
                disabled={syncState.isSyncing}
                className="p-1 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                title="Manual sync"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync Error */}
      {syncState?.syncError && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-2 text-red-400 text-sm">
          {syncState.syncError}
        </div>
      )}

      {/* Current Auction Display */}
      {currentAuction && (
        <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/40 rounded-lg p-3 animate-pulse">
          <div className="text-amber-300 text-sm font-medium mb-1">On The Block</div>
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold">{currentAuction.playerName}</span>
            <div className="text-right">
              <div className="text-amber-400 font-bold">${currentAuction.currentBid}</div>
              <div className="text-slate-400 text-xs">{currentAuction.currentBidder}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Inflation Analysis
        </h3>
        <div className={`px-3 py-1 rounded-lg ${
          displayInflationRate < 5 ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' :
          displayInflationRate < 15 ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
          displayInflationRate < 30 ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' :
          'bg-red-900/30 text-red-400 border border-red-500/30'
        }`}>
          {displayInflationRate >= 0 ? '+' : ''}{displayInflationRate.toFixed(1)}%
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
          <div className="text-white">${displayMoneySpent.toLocaleString()}</div>
          {liveInflationStats && (
            <div className="text-emerald-400 text-xs">Live</div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Players Drafted</div>
          <div className="text-white">{displayDraftedCount} / {totalPlayersNeeded}</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <div className="text-slate-400">Avg $ Spent</div>
          <div className="text-white">
            ${displayDraftedCount > 0 ? Math.round(displayMoneySpent / displayDraftedCount) : 0}
          </div>
        </div>
      </div>

      {/* Live Inflation Details */}
      {liveInflationStats && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 space-y-2">
          <div className="text-slate-400 text-sm">Projected vs Actual</div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Projected Value:</span>
            <span className="text-slate-300">${liveInflationStats.totalProjectedValue.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Actual Spent:</span>
            <span className="text-slate-300">${liveInflationStats.totalActualSpent.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-slate-700/50 pt-2">
            <span className="text-slate-500">Difference:</span>
            <span className={liveInflationStats.totalActualSpent > liveInflationStats.totalProjectedValue ? 'text-red-400' : 'text-emerald-400'}>
              {liveInflationStats.totalActualSpent > liveInflationStats.totalProjectedValue ? '+' : '-'}
              ${Math.abs(liveInflationStats.totalActualSpent - liveInflationStats.totalProjectedValue).toFixed(0)}
            </span>
          </div>
        </div>
      )}

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
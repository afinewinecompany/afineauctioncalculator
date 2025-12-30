import { LeagueSettings, Player, SyncState, InflationStats, CurrentAuction } from '../lib/types';
import { TrendingUp, RefreshCw, Wifi, WifiOff, AlertCircle, ChevronDown, ChevronUp, Users, Zap, History, BarChart3, AlertTriangle, DollarSign, PieChart, Target } from 'lucide-react';
import { getInflationIndicator, InflationResult, HISTORICAL_INFLATION_BASELINES } from '../lib/calculations';
import { formatLastSync } from '../lib/auctionApi';
import { useState, useMemo } from 'react';

interface InflationTrackerProps {
  settings: LeagueSettings;
  allDrafted: Player[];
  inflationRate: number;
  inflationResult?: InflationResult;
  syncState?: SyncState;
  liveInflationStats?: InflationStats | null;
  currentAuction?: CurrentAuction | null;
  onManualSync?: () => void;
  isMobile?: boolean;
}

export function InflationTracker({
  settings,
  allDrafted,
  inflationRate,
  inflationResult,
  syncState,
  liveInflationStats,
  currentAuction,
  onManualSync,
  isMobile,
}: InflationTrackerProps) {
  const [showTierBreakdown, setShowTierBreakdown] = useState(false);
  const [showScarcity, setShowScarcity] = useState(false);
  const [showHistoricalInsights, setShowHistoricalInsights] = useState(false);
  const [showPriceRangeGuide, setShowPriceRangeGuide] = useState(false);

  const totalBudget = settings.numTeams * settings.budgetPerTeam;
  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const totalPlayersNeeded = settings.numTeams * totalRosterSpots;

  const moneySpent = allDrafted.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
  const draftProgress = totalPlayersNeeded > 0 ? Math.round((allDrafted.length / totalPlayersNeeded) * 100) : 0;

  const inflationIndicator = getInflationIndicator(inflationRate);

  const displayInflationRate = liveInflationStats?.overallInflationRate ?? (inflationRate * 100);
  const displayMoneySpent = liveInflationStats?.totalActualSpent ?? moneySpent;
  const displayDraftedCount = liveInflationStats?.draftedPlayersCount ?? allDrafted.length;

  const inflationMultiplier = inflationResult && inflationResult.remainingProjectedValue > 0
    ? ((inflationResult.adjustedRemainingBudget ?? inflationResult.remainingBudget) / inflationResult.remainingProjectedValue)
    : 1 + (displayInflationRate / 100);

  // Memoized calculations
  const budgetPercentage = useMemo(
    () => totalBudget > 0 ? (displayMoneySpent / totalBudget) * 100 : 0,
    [displayMoneySpent, totalBudget]
  );

  const avgPrice = useMemo(
    () => displayDraftedCount > 0 ? Math.round(displayMoneySpent / displayDraftedCount) : 0,
    [displayMoneySpent, displayDraftedCount]
  );

  const getInflationSeverity = (rate: number) => {
    if (rate < 5) return { level: 'low', color: 'emerald', label: 'Low Inflation' };
    if (rate < 15) return { level: 'moderate', color: 'yellow', label: 'Moderate Inflation' };
    if (rate < 30) return { level: 'high', color: 'orange', label: 'High Inflation' };
    return { level: 'extreme', color: 'red', label: 'Extreme Inflation' };
  };

  const severity = getInflationSeverity(displayInflationRate);

  const getSeverityClasses = (type: 'border' | 'bg' | 'text' | 'bgLight') => {
    const classes = {
      emerald: { border: 'border-emerald-500/50', bg: 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/60', text: 'text-emerald-400', bgLight: 'bg-emerald-500/20' },
      yellow: { border: 'border-yellow-500/50', bg: 'bg-gradient-to-br from-yellow-900/40 to-yellow-950/60', text: 'text-yellow-400', bgLight: 'bg-yellow-500/20' },
      orange: { border: 'border-orange-500/50', bg: 'bg-gradient-to-br from-orange-900/40 to-orange-950/60', text: 'text-orange-400', bgLight: 'bg-orange-500/20' },
      red: { border: 'border-red-500/50', bg: 'bg-gradient-to-br from-red-900/40 to-red-950/60', text: 'text-red-400', bgLight: 'bg-red-500/20' },
    };
    return classes[severity.color as keyof typeof classes][type];
  };

  return (
    <div className={`bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl backdrop-blur-sm shadow-xl ${isMobile ? 'p-3' : 'p-5'}`}>
      {/* ROW 1: Header Bar - Sync Status & Current Auction */}
      <div className={`flex items-center justify-between ${isMobile ? 'mb-3 flex-wrap gap-2' : 'mb-5'}`}>
        {/* Sync Status */}
        {settings.couchManagerRoomId && syncState && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {syncState.isConnected ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : syncState.syncError ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-slate-500" />
              )}
              <span className={`text-sm font-medium ${syncState.isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
                {syncState.isSyncing ? 'Syncing...' : syncState.isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            <span className="text-slate-500 text-xs">{formatLastSync(syncState.lastSyncAt)}</span>
            {onManualSync && (
              <button
                onClick={onManualSync}
                disabled={syncState.isSyncing}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}

        {/* Current Auction - Compact Badge */}
        {currentAuction && (
          <div className="flex items-center gap-3 bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/40 rounded-lg px-4 py-2 animate-pulse">
            <span className="text-amber-300 text-xs font-semibold uppercase tracking-wide">On Block:</span>
            <span className="text-white font-bold">{currentAuction.playerName}</span>
            <span className="text-amber-400 font-bold text-lg">${currentAuction.currentBid}</span>
            <span className="text-slate-400 text-sm">({currentAuction.currentBidder})</span>
          </div>
        )}

        {/* Sync Error */}
        {syncState?.syncError && (
          <div className="text-red-400 text-sm">{syncState.syncError}</div>
        )}
      </div>

      {/* ROW 2: Main Metrics - 6 Equal Columns */}
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-2 mb-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-5'}`}>
        {/* Column 1: Hero Inflation */}
        <div className={`relative overflow-hidden rounded-xl border-2 ${getSeverityClasses('border')} ${getSeverityClasses('bg')}`}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${getSeverityClasses('bgLight')}`}>
                <TrendingUp className={`w-4 h-4 ${getSeverityClasses('text')}`} />
              </div>
              <div>
                <div className="text-slate-400 text-xs">Live Inflation</div>
                <div className={`text-xs ${getSeverityClasses('text')}`}>{severity.label}</div>
              </div>
            </div>
            <div className={`text-3xl font-bold ${getSeverityClasses('text')}`}>
              {displayInflationRate >= 0 ? '+' : ''}{displayInflationRate.toFixed(1)}%
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-slate-500 text-xs">Multiplier:</span>
              <span className={`text-sm font-bold ${inflationMultiplier > 1.2 ? 'text-red-400' : inflationMultiplier > 1.1 ? 'text-orange-400' : getSeverityClasses('text')}`}>
                {inflationMultiplier.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Total Budget */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400 text-sm">Total Budget</span>
          </div>
          <div className="text-white text-2xl font-bold">${totalBudget.toLocaleString()}</div>
          <div className="text-slate-500 text-xs mt-1">League Pool</div>
        </div>

        {/* Column 3: Money Spent */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400 text-sm">Money Spent</span>
          </div>
          <div className="text-white text-2xl font-bold">${displayMoneySpent.toLocaleString()}</div>
          <div className={`text-xs mt-1 ${budgetPercentage > 50 ? 'text-orange-400' : 'text-emerald-400'}`}>
            {budgetPercentage.toFixed(1)}% of pool
          </div>
        </div>

        {/* Column 4: Players Drafted */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 text-sm">Drafted</span>
          </div>
          <div className="text-white text-2xl font-bold">
            {displayDraftedCount}
            <span className="text-slate-500 text-lg font-normal">/{totalPlayersNeeded}</span>
          </div>
          <div className="text-blue-400 text-xs mt-1">{draftProgress}% complete</div>
        </div>

        {/* Column 5: Average Price */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400 text-sm">Avg Price</span>
          </div>
          <div className="text-white text-2xl font-bold">${avgPrice}</div>
          <div className="text-slate-500 text-xs mt-1">Per player</div>
        </div>

        {/* Column 6: Draft Progress Bar */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="text-slate-400 text-sm mb-2">Draft Progress</div>
            <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${draftProgress}%` }}
              />
            </div>
          </div>
          <div className="text-white text-2xl font-bold text-center mt-2">{draftProgress}%</div>
        </div>
      </div>

      {/* ROW 3: Secondary Metrics & Insights - 3 Columns (hide on mobile to save space) */}
      {!isMobile && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Budget Analysis - Always Visible */}
        <div className="space-y-3">
          {/* Remaining Budget Card */}
          {inflationResult && inflationResult.remainingProjectedValue > 0 && (
            <div className="bg-gradient-to-br from-emerald-900/20 to-blue-900/20 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-emerald-400 text-sm font-semibold">Remaining Budget</h4>
                <div className={`text-lg font-bold ${getSeverityClasses('text')}`}>
                  {inflationMultiplier.toFixed(2)}x
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Money Left</span>
                  <span className="text-white text-lg font-semibold">
                    ${inflationResult.remainingBudget.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Value Left</span>
                  <span className="text-white text-lg font-semibold">
                    ${Math.round(inflationResult.remainingProjectedValue).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Projected vs Actual Card */}
          {liveInflationStats && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
              <h4 className="text-slate-300 text-sm font-semibold mb-3">Projected vs Actual</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Projected Value</span>
                  <span className="text-slate-300 text-lg font-medium">
                    ${Math.round(liveInflationStats.totalProjectedValue).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Actual Spent</span>
                  <span className="text-white text-lg font-semibold">
                    ${liveInflationStats.totalActualSpent.toLocaleString()}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-700/50">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Overspend</span>
                    <span className={`text-lg font-bold ${
                      liveInflationStats.totalActualSpent > liveInflationStats.totalProjectedValue
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}>
                      {liveInflationStats.totalActualSpent > liveInflationStats.totalProjectedValue ? '+' : ''}
                      ${Math.round(liveInflationStats.totalActualSpent - liveInflationStats.totalProjectedValue).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Strategy Tip */}
          <div className={`p-3 rounded-xl ${getSeverityClasses('bgLight')} border border-white/5`}>
            <div className="flex items-start gap-2">
              <Zap className={`w-4 h-4 mt-0.5 flex-shrink-0 ${getSeverityClasses('text')}`} />
              <p className="text-slate-300 text-sm leading-relaxed">
                {displayInflationRate < 5 ? 'Stick close to base prices. Market is balanced.' :
                 displayInflationRate < 15 ? 'Budget 10-15% extra for your targets.' :
                 displayInflationRate < 30 ? 'High demand - consider value picks and patience.' :
                 'Wait for market correction. Avoid bidding wars.'}
              </p>
            </div>
          </div>
        </div>

        {/* Column 2: Position Scarcity & Tier Breakdown */}
        <div className="space-y-3">
          {/* Position Scarcity - Collapsible */}
          {inflationResult?.positionalScarcity && inflationResult.positionalScarcity.some(ps => ps.leagueNeed > 0) && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowScarcity(!showScarcity)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span className="text-slate-200 text-base font-semibold">Position Scarcity</span>
                </div>
                {showScarcity ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              {showScarcity && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-4 gap-2">
                    {inflationResult.positionalScarcity
                      .filter(ps => ps.leagueNeed > 0)
                      .sort((a, b) => b.scarcityRatio - a.scarcityRatio)
                      .slice(0, 8)
                      .map(ps => (
                        <div
                          key={ps.position}
                          className={`p-2 rounded-lg text-center ${
                            ps.scarcityLevel === 'severe' ? 'bg-red-900/30 border border-red-500/30' :
                            ps.scarcityLevel === 'moderate' ? 'bg-orange-900/30 border border-orange-500/30' :
                            ps.scarcityLevel === 'surplus' ? 'bg-emerald-900/30 border border-emerald-500/30' :
                            'bg-slate-700/30 border border-slate-600/30'
                          }`}
                        >
                          <div className={`text-sm font-bold ${
                            ps.scarcityLevel === 'severe' ? 'text-red-400' :
                            ps.scarcityLevel === 'moderate' ? 'text-orange-400' :
                            ps.scarcityLevel === 'surplus' ? 'text-emerald-400' : 'text-slate-300'
                          }`}>{ps.position}</div>
                          <div className="text-slate-500 text-xs">{ps.qualityCount}Q/{ps.leagueNeed}N</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tier Breakdown - Collapsible */}
          {inflationResult && inflationResult.tierInflation.some(t => t.draftedCount > 0) && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTierBreakdown(!showTierBreakdown)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  <span className="text-slate-200 text-base font-semibold">Inflation by Tier</span>
                </div>
                {showTierBreakdown ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              {showTierBreakdown && (
                <div className="px-4 pb-4 space-y-2">
                  {inflationResult.tierInflation
                    .filter(t => t.draftedCount > 0)
                    .sort((a, b) => a.tier - b.tier)
                    .slice(0, 8)
                    .map(tierData => {
                      const inflationPct = tierData.inflationRate * 100;
                      return (
                        <div key={tierData.tier} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                              tierData.tier <= 3 ? 'bg-emerald-900/50 text-emerald-400' :
                              tierData.tier <= 6 ? 'bg-blue-900/50 text-blue-400' : 'bg-slate-700/50 text-slate-400'
                            }`}>{tierData.tier}</span>
                            <span className="text-slate-400 text-sm">{tierData.draftedCount} players</span>
                          </div>
                          <span className={`text-base font-bold ${
                            inflationPct > 20 ? 'text-red-400' :
                            inflationPct > 10 ? 'text-orange-400' :
                            inflationPct > 0 ? 'text-yellow-400' : 'text-emerald-400'
                          }`}>{inflationPct >= 0 ? '+' : ''}{inflationPct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 3: Historical Insights & Price Range Guide */}
        <div className="space-y-3">
          {/* Historical Insights - Collapsible */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowHistoricalInsights(!showHistoricalInsights)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <span className="text-slate-200 text-base font-semibold">Historical Insights</span>
              </div>
              {showHistoricalInsights ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            {showHistoricalInsights && (
              <div className="px-4 pb-4 space-y-3">
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">
                      Elite players ($31+) go <span className="text-emerald-400 font-semibold">17% below</span> value;
                      $1-$5 players see <span className="text-red-400 font-semibold">990%+ inflation</span>.
                    </span>
                  </div>
                </div>
                <p className="text-slate-500 text-sm">
                  Strategy: Target elite players patiently. Avoid low-value bidding wars.
                </p>
              </div>
            )}
          </div>

          {/* Price Range Guide - Collapsible */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowPriceRangeGuide(!showPriceRangeGuide)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <span className="text-slate-200 text-base font-semibold">Price Range Guide</span>
              </div>
              {showPriceRangeGuide ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            {showPriceRangeGuide && (
              <div className="px-4 pb-4 space-y-2">
                {HISTORICAL_INFLATION_BASELINES.byPriceRange.map((range) => (
                  <div
                    key={range.range}
                    className={`flex items-center justify-between p-2.5 rounded-lg ${
                      range.trend === 'deflated' ? 'bg-emerald-900/20 border border-emerald-500/30' :
                      range.trend === 'normal' ? 'bg-blue-900/20 border border-blue-500/30' :
                      range.trend === 'moderate' ? 'bg-yellow-900/20 border border-yellow-500/30' :
                      'bg-red-900/20 border border-red-500/30'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      range.trend === 'deflated' ? 'text-emerald-400' :
                      range.trend === 'normal' ? 'text-blue-400' :
                      range.trend === 'moderate' ? 'text-yellow-400' : 'text-red-400'
                    }`}>{range.range}</span>
                    <span className={`text-sm font-bold ${
                      range.avgInflation < 0 ? 'text-emerald-400' :
                      range.avgInflation < 50 ? 'text-blue-400' :
                      range.avgInflation < 200 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{range.avgInflation >= 0 ? '+' : ''}{range.avgInflation.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Footer - Explanation */}
      <div className={`border-t border-slate-700/50 ${isMobile ? 'mt-3 pt-2' : 'mt-5 pt-4'}`}>
        <div className={`flex items-center justify-between ${isMobile ? 'text-xs flex-wrap gap-1' : 'text-sm'}`}>
          <span className="text-blue-400 font-medium">{inflationIndicator.label}</span>
          {!isMobile && (
          <span className="text-slate-500">
            Values use remaining budget method: Money Left ÷ Value Left
          </span>
          )}
        </div>
      </div>
    </div>
  );
}

import { DraftedPlayer, LeagueSettings } from '../lib/types';
import { calculateTeamProjectedStats } from '../lib/calculations';
import { Trophy, DollarSign, TrendingUp, Download } from 'lucide-react';

interface PostDraftAnalysisProps {
  roster: DraftedPlayer[];
  settings: LeagueSettings;
  onRestart: () => void;
}

export function PostDraftAnalysis({ roster, settings, onRestart }: PostDraftAnalysisProps) {
  const stats = calculateTeamProjectedStats(roster);
  const moneyRemaining = settings.budgetPerTeam - stats.totalSpent;
  
  // Calculate value metrics
  const totalValue = roster.reduce((sum, p) => sum + p.adjustedValue, 0);
  const totalCost = roster.reduce((sum, p) => sum + p.draftedPrice, 0);
  const valueGained = totalValue - totalCost;
  
  // Sort roster by price (highest first)
  const sortedByPrice = [...roster].sort((a, b) => b.draftedPrice - a.draftedPrice);
  
  // Best values (biggest positive difference)
  const bestValues = [...roster]
    .map(p => ({ ...p, value: p.adjustedValue - p.draftedPrice }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  
  // Calculate position breakdown
  const positionCounts = roster.reduce((acc, p) => {
    const pos = p.positions[0];
    acc[pos] = (acc[pos] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-8" style={{ minHeight: 'calc(100vh - 57px)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <h1 className="text-white">Draft Complete!</h1>
            </div>
            <p className="text-slate-400">Here's how your draft went</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6">
            <div className="p-6 bg-gradient-to-br from-emerald-900/30 to-green-900/30 rounded-lg border border-emerald-500/30">
              <div className="text-slate-400 mb-2">Total Spent</div>
              <div className="text-emerald-400">${stats.totalSpent}</div>
              <div className="text-slate-500 mt-1">of ${settings.budgetPerTeam}</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-lg border border-blue-500/30">
              <div className="text-slate-400 mb-2">Money Remaining</div>
              <div className="text-blue-400">${moneyRemaining}</div>
              <div className="text-slate-500 mt-1">
                {((moneyRemaining / settings.budgetPerTeam) * 100).toFixed(1)}% of budget
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/30">
              <div className="text-slate-400 mb-2">Total Value</div>
              <div className="text-purple-400">${totalValue}</div>
              <div className="text-slate-500 mt-1">Adjusted value sum</div>
            </div>

            <div className={`p-6 rounded-lg border ${
              valueGained > 0 
                ? 'bg-gradient-to-br from-emerald-900/30 to-green-900/30 border-emerald-500/30' 
                : 'bg-gradient-to-br from-red-900/30 to-rose-900/30 border-red-500/30'
            }`}>
              <div className="text-slate-400 mb-2">Value Gained</div>
              <div className={valueGained > 0 ? 'text-emerald-400' : 'text-red-400'}>
                {valueGained > 0 ? '+' : ''}${valueGained}
              </div>
              <div className="text-slate-500 mt-1">vs. adjusted values</div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Roster */}
            <div className="space-y-6">
              <div>
                <h2 className="text-white mb-4">Your Roster ({roster.length} players)</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sortedByPrice.map((player, index) => {
                    const valueGained = player.adjustedValue - player.draftedPrice;
                    const isPitcher = player.positions.some(p => ['SP', 'RP'].includes(p));
                    
                    return (
                      <div key={player.id} className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-white">
                              {index + 1}. {player.name}
                            </div>
                            <div className="text-slate-400">
                              {player.positions.join(', ')} • {player.team}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white">${player.draftedPrice}</div>
                            {valueGained !== 0 && (
                              <div className={valueGained > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {valueGained > 0 ? '+' : ''}{valueGained}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3 text-slate-400">
                          {isPitcher ? (
                            <>
                              <span>{player.projectedStats.W}W</span>
                              <span>{player.projectedStats.K}K</span>
                              <span>{player.projectedStats.ERA?.toFixed(2)} ERA</span>
                            </>
                          ) : (
                            <>
                              <span>{player.projectedStats.HR} HR</span>
                              <span>{player.projectedStats.RBI} RBI</span>
                              <span>{player.projectedStats.SB} SB</span>
                              <span>{player.projectedStats.AVG?.toFixed(3)} AVG</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Position Breakdown */}
              <div>
                <h3 className="text-white mb-3">Position Breakdown</h3>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(positionCounts).map(([pos, count]) => (
                    <div key={pos} className="p-2 bg-blue-900/30 border border-blue-500/30 rounded text-center">
                      <div className="text-blue-400">{pos}</div>
                      <div className="text-slate-400">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Analytics */}
            <div className="space-y-6">
              <div>
                <h2 className="text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Best Values
                </h2>
                <div className="space-y-2">
                  {bestValues.map((player, index) => (
                    <div key={player.id} className="p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-white">
                            {index + 1}. {player.name}
                          </div>
                          <div className="text-slate-400">
                            ${player.draftedPrice} (Value: ${player.adjustedValue})
                          </div>
                        </div>
                        <div className="text-emerald-400">
                          +${player.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projected Team Stats */}
              <div>
                <h3 className="text-white mb-3">Projected Team Statistics</h3>
                <div className="p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-slate-400">Home Runs</div>
                      <div className="text-blue-400">{stats.projectedHR}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">RBI</div>
                      <div className="text-blue-400">{stats.projectedRBI}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Stolen Bases</div>
                      <div className="text-blue-400">{stats.projectedSB}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Wins</div>
                      <div className="text-blue-400">{stats.projectedW}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Strikeouts</div>
                      <div className="text-blue-400">{stats.projectedK}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Saves</div>
                      <div className="text-blue-400">{stats.projectedSV}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Draft Grade */}
              <div>
                <h3 className="text-white mb-3">Draft Grade</h3>
                <div className={`p-6 rounded-lg text-center border-2 ${
                  valueGained > 20 ? 'bg-emerald-900/30 border-emerald-500/50' :
                  valueGained > 0 ? 'bg-blue-900/30 border-blue-500/50' :
                  valueGained > -20 ? 'bg-yellow-900/30 border-yellow-500/50' :
                  'bg-red-900/30 border-red-500/50'
                }`}>
                  <div className={`text-6xl mb-2 ${
                    valueGained > 20 ? 'text-emerald-400' :
                    valueGained > 0 ? 'text-blue-400' :
                    valueGained > -20 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {valueGained > 20 ? 'A' :
                     valueGained > 0 ? 'B' :
                     valueGained > -20 ? 'C' : 'D'}
                  </div>
                  <div className="text-slate-300">
                    {valueGained > 20 ? 'Excellent draft! Great value across the board.' :
                     valueGained > 0 ? 'Good draft with solid value.' :
                     valueGained > -20 ? 'Decent draft, some overpays but competitive.' :
                     'Challenging draft with multiple overpays.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-700">
            <button
              onClick={() => window.print()}
              className="px-6 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Print/Export
            </button>
            
            <button
              onClick={onRestart}
              className="px-8 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white border border-red-500 rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { Player } from '../lib/types';
import { getValueIndicator } from '../lib/calculations';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface NominationPanelProps {
  player: Player | null;
  onDraft: (price: number, draftedBy: 'me' | 'other') => void;
  moneyRemaining: number;
}

export function NominationPanel({ player, onDraft, moneyRemaining }: NominationPanelProps) {
  const [currentBid, setCurrentBid] = useState(1);

  useEffect(() => {
    if (player) {
      setCurrentBid(Math.max(1, Math.floor(player.adjustedValue * 0.7)));
    }
  }, [player]);

  if (!player) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-8 flex items-center justify-center h-full backdrop-blur-sm">
        <div className="text-center text-slate-500">
          <DollarSign className="w-16 h-16 mx-auto mb-4 text-slate-700" />
          <p>Select a player to nominate</p>
        </div>
      </div>
    );
  }

  const valueIndicator = getValueIndicator(currentBid, player.adjustedValue);
  const isPitcher = player.positions.some(p => ['SP', 'RP'].includes(p));
  const suggestedMaxBid = Math.min(player.adjustedValue + 5, moneyRemaining);

  // Calculate gauge percentage (0-100)
  const maxGaugeValue = Math.max(player.adjustedValue * 1.5, currentBid * 1.2);
  const gaugePercentage = (currentBid / maxGaugeValue) * 100;
  const targetPercentage = (player.adjustedValue / maxGaugeValue) * 100;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6 space-y-6 backdrop-blur-sm shadow-2xl">
      {/* Player Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white">{player.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-slate-400">{player.team}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{player.positions.join(', ')}</span>
            {player.tier && (
              <>
                <span className="text-slate-600">•</span>
                <span className="px-2 py-0.5 bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-blue-400 rounded border border-blue-500/30">Tier {player.tier}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-4 gap-4">
        {isPitcher ? (
          <>
            <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="text-slate-400">Wins</div>
              <div className="text-white">{player.projectedStats.W}</div>
            </div>
            <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="text-slate-400">Strikeouts</div>
              <div className="text-white">{player.projectedStats.K}</div>
            </div>
            <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="text-slate-400">ERA</div>
              <div className="text-white">{player.projectedStats.ERA?.toFixed(2)}</div>
            </div>
            <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="text-slate-400">WHIP</div>
              <div className="text-white">{player.projectedStats.WHIP?.toFixed(2)}</div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="text-slate-400">HR</div>
              <div className="text-white">{player.projectedStats.HR}</div>
            </div>
            <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="text-slate-400">RBI</div>
              <div className="text-white">{player.projectedStats.RBI}</div>
            </div>
            <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="text-slate-400">SB</div>
              <div className="text-white">{player.projectedStats.SB}</div>
            </div>
            <div className="text-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="text-slate-400">AVG</div>
              <div className="text-white">{player.projectedStats.AVG?.toFixed(3)}</div>
            </div>
          </>
        )}
      </div>

      {/* Current Bid */}
      <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-500/30 rounded-xl p-6 space-y-4 animate-glow">
        <div className="text-center">
          <div className="text-slate-400 mb-2">Current Bid</div>
          <div className="text-white text-5xl">${currentBid}</div>
        </div>

        {/* Value Gauge */}
        <div className="space-y-2">
          <div className="relative h-10 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            {/* Target marker */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-blue-400 z-10 shadow-lg shadow-blue-500/50"
              style={{ left: `${targetPercentage}%` }}
            />
            
            {/* Current bid fill */}
            <div 
              className={`h-full transition-all duration-500 ${
                valueIndicator.color === 'text-green-600' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                valueIndicator.color === 'text-yellow-600' ? 'bg-gradient-to-r from-yellow-500 to-amber-600' :
                valueIndicator.color === 'text-orange-600' ? 'bg-gradient-to-r from-orange-500 to-red-600' :
                'bg-gradient-to-r from-red-500 to-rose-600'
              }`}
              style={{ width: `${gaugePercentage}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-slate-500">$0</span>
            <div className="text-center">
              <div className="text-blue-400">Target: ${player.adjustedValue}</div>
              <div className={`${
                valueIndicator.color === 'text-green-600' ? 'text-green-400' :
                valueIndicator.color === 'text-yellow-600' ? 'text-yellow-400' :
                valueIndicator.color === 'text-orange-600' ? 'text-orange-400' :
                'text-red-400'
              }`}>{valueIndicator.label}</div>
            </div>
            <span className="text-slate-500">${Math.round(maxGaugeValue)}</span>
          </div>
        </div>

        {/* Bid Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentBid(Math.max(1, currentBid - 1))}
            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white hover:bg-slate-700 transition-all"
          >
            -1
          </button>
          
          <input
            type="number"
            value={currentBid}
            onChange={(e) => setCurrentBid(Math.max(1, Number(e.target.value)))}
            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-center text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
          
          <button
            onClick={() => setCurrentBid(currentBid + 1)}
            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white hover:bg-slate-700 transition-all"
          >
            +1
          </button>
        </div>
      </div>

      {/* Value Analysis */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="text-slate-400 mb-1">Original Value</div>
          <div className="text-white">${player.projectedValue}</div>
        </div>
        
        <div className="p-3 bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-500/30 rounded-lg">
          <div className="text-slate-400 mb-1">Adjusted Value</div>
          <div className="flex items-center gap-2">
            <span className="text-blue-400">${player.adjustedValue}</span>
            {player.adjustedValue > player.projectedValue ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : player.adjustedValue < player.projectedValue ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : null}
          </div>
        </div>
      </div>

      {/* Suggested Max Bid */}
      <div className="p-3 bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border border-yellow-500/30 rounded-lg">
        <div className="text-yellow-400">
          💡 Suggested max bid: <span className="text-white">${suggestedMaxBid}</span> (based on remaining budget)
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onDraft(currentBid, 'me')}
          className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-xl hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/30"
        >
          Add to My Team (${currentBid})
        </button>
        
        <button
          onClick={() => onDraft(currentBid, 'other')}
          className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl hover:from-slate-600 hover:to-slate-700 transition-all border border-slate-600"
        >
          Drafted by Another Team
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setCurrentBid(player.adjustedValue)}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
        >
          Set to Adjusted Value
        </button>
        <button
          onClick={() => setCurrentBid(player.projectedValue)}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
        >
          Set to Original Value
        </button>
      </div>
    </div>
  );
}
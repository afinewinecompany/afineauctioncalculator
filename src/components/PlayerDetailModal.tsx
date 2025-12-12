import { Player } from '../lib/types';
import { X, TrendingUp, AlertCircle } from 'lucide-react';

interface PlayerDetailModalProps {
  player: Player | null;
  onClose: () => void;
}

export function PlayerDetailModal({ player, onClose }: PlayerDetailModalProps) {
  if (!player) return null;

  const isPitcher = player.positions.some(p => ['SP', 'RP'].includes(p));
  const valueChange = player.adjustedValue - player.projectedValue;
  const valueChangePercent = ((valueChange / player.projectedValue) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between">
          <div>
            <h2 className="text-gray-900">{player.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-600">{player.team}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{player.positions.join(', ')}</span>
              {player.tier && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Tier {player.tier}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Value Analysis */}
          <div>
            <h3 className="text-gray-900 mb-3">Value Analysis</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-gray-600 mb-1">Original Value</div>
                <div className="text-gray-900">${player.projectedValue}</div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-gray-600 mb-1">Adjusted Value</div>
                <div className="text-blue-700">${player.adjustedValue}</div>
              </div>
              
              <div className={`p-4 rounded-lg ${
                valueChange > 0 ? 'bg-green-50' : valueChange < 0 ? 'bg-red-50' : 'bg-gray-50'
              }`}>
                <div className="text-gray-600 mb-1">Change</div>
                <div className={`flex items-center gap-1 ${
                  valueChange > 0 ? 'text-green-700' : valueChange < 0 ? 'text-red-700' : 'text-gray-700'
                }`}>
                  {valueChange > 0 ? '+' : ''}{valueChange} ({valueChangePercent}%)
                  {valueChange > 0 && <TrendingUp className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {player.status === 'drafted' && player.draftedPrice && (
              <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="w-4 h-4" />
                  <span>Drafted for ${player.draftedPrice} by {player.draftedBy}</span>
                </div>
              </div>
            )}
          </div>

          {/* Projected Stats */}
          <div>
            <h3 className="text-gray-900 mb-3">Projected Statistics</h3>
            <div className="grid grid-cols-4 gap-4">
              {isPitcher ? (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-gray-600">Wins</div>
                    <div className="text-gray-900">{player.projectedStats.W}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-gray-600">Strikeouts</div>
                    <div className="text-gray-900">{player.projectedStats.K}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-gray-600">ERA</div>
                    <div className="text-gray-900">{player.projectedStats.ERA?.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-gray-600">WHIP</div>
                    <div className="text-gray-900">{player.projectedStats.WHIP?.toFixed(2)}</div>
                  </div>
                  {player.projectedStats.SV !== undefined && player.projectedStats.SV > 0 && (
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <div className="text-gray-600">Saves</div>
                      <div className="text-gray-900">{player.projectedStats.SV}</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-gray-600">Home Runs</div>
                    <div className="text-gray-900">{player.projectedStats.HR}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-gray-600">RBI</div>
                    <div className="text-gray-900">{player.projectedStats.RBI}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-gray-600">Stolen Bases</div>
                    <div className="text-gray-900">{player.projectedStats.SB}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-gray-600">Batting Avg</div>
                    <div className="text-gray-900">{player.projectedStats.AVG?.toFixed(3)}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Draft Strategy Notes */}
          <div>
            <h3 className="text-gray-900 mb-3">Draft Notes</h3>
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-blue-800">
                  <strong>Position Eligibility:</strong> {player.positions.join(', ')}
                </div>
              </div>
              
              {player.tier && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-purple-800">
                    <strong>Tier {player.tier} Player:</strong> {
                      player.tier === 1 ? 'Elite tier - prioritize in early rounds' :
                      player.tier === 2 ? 'High-quality starter - solid value' :
                      player.tier === 3 ? 'Reliable contributor - good depth piece' :
                      'Value play or bench depth'
                    }
                  </div>
                </div>
              )}

              {valueChange > 5 && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-green-800">
                    <strong>Value Alert:</strong> This player's value has increased by ${valueChange} due to inflation. 
                    Consider adjusting your bidding strategy accordingly.
                  </div>
                </div>
              )}

              {valueChange < -5 && (
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-orange-800">
                    <strong>Note:</strong> This player's adjusted value has decreased. 
                    This may indicate deflation or position scarcity issues.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Historical Pricing (Placeholder) */}
          <div>
            <h3 className="text-gray-900 mb-3">Historical Context</h3>
            <div className="p-4 bg-gray-50 rounded-lg text-gray-600">
              <p>Historical auction data would appear here in a production environment, showing:</p>
              <ul className="mt-2 ml-4 space-y-1">
                <li>• Previous year auction prices</li>
                <li>• League average for this player tier</li>
                <li>• Position scarcity trends</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4">
          <button
            onClick={onClose}
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

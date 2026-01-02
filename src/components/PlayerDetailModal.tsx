import { useState, useMemo } from 'react';
import { Player, LeagueSettings, PositionalScarcity } from '../lib/types';
import { InflationResult, calculateStrategicMaxBid, HISTORICAL_INFLATION_BASELINES } from '../lib/calculations';
import { X, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Calculator, Target, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface PlayerDetailModalProps {
  player: Player | null;
  onClose: () => void;
  inflationResult?: InflationResult;
  leagueSettings?: LeagueSettings;
  myMoneyRemaining?: number;
  myRosterSpotsRemaining?: number;
}

export function PlayerDetailModal({
  player,
  onClose,
  inflationResult,
  leagueSettings,
  myMoneyRemaining,
  myRosterSpotsRemaining,
}: PlayerDetailModalProps) {
  const [showInflationBreakdown, setShowInflationBreakdown] = useState(true);

  if (!player) return null;

  const isPitcher = player.positions.some(p => ['SP', 'RP'].includes(p));
  const valueChange = player.adjustedValue - player.projectedValue;
  const valueChangePercent = player.projectedValue > 0
    ? ((valueChange / player.projectedValue) * 100).toFixed(1)
    : '0';

  // Calculate inflation breakdown components
  const inflationBreakdown = useMemo(() => {
    if (!inflationResult) return null;

    const effectiveBudget = inflationResult.adjustedRemainingBudget ?? inflationResult.remainingBudget;
    const remainingValue = inflationResult.remainingProjectedValue;

    // Base inflation multiplier from remaining budget method
    const baseMultiplier = remainingValue > 0
      ? effectiveBudget / remainingValue
      : 1 + inflationResult.overallInflationRate;

    // Find position scarcity for this player's positions
    let highestScarcity: PositionalScarcity | null = null;
    let scarcityMultiplier = 1.0;

    if (inflationResult.positionalScarcity) {
      player.positions.forEach(pos => {
        const scarcity = inflationResult.positionalScarcity?.find(ps => ps.position === pos);
        if (scarcity && scarcity.inflationAdjustment > scarcityMultiplier) {
          scarcityMultiplier = scarcity.inflationAdjustment;
          highestScarcity = scarcity;
        }
      });
    }

    const finalMultiplier = baseMultiplier * scarcityMultiplier;
    const calculatedValue = Math.round(player.projectedValue * finalMultiplier);

    return {
      remainingBudget: effectiveBudget,
      remainingValue,
      baseMultiplier,
      scarcityMultiplier,
      highestScarcity,
      finalMultiplier,
      calculatedValue,
    };
  }, [player, inflationResult]);

  // Calculate strategic bid analysis
  const strategicAnalysis = useMemo(() => {
    if (myMoneyRemaining === undefined || myRosterSpotsRemaining === undefined) {
      return null;
    }
    return calculateStrategicMaxBid(
      myMoneyRemaining,
      myRosterSpotsRemaining,
      player.adjustedValue,
      player.projectedValue
    );
  }, [myMoneyRemaining, myRosterSpotsRemaining, player.adjustedValue, player.projectedValue]);

  // Get historical context for this player's tier/price range
  const historicalContext = useMemo(() => {
    const tierData = player.tier ? HISTORICAL_INFLATION_BASELINES.byTier[player.tier] : null;

    let priceRange: string;
    if (player.projectedValue <= 5) priceRange = '$1-$5';
    else if (player.projectedValue <= 15) priceRange = '$6-$15';
    else if (player.projectedValue <= 30) priceRange = '$16-$30';
    else priceRange = '$31+';

    const priceRangeData = HISTORICAL_INFLATION_BASELINES.byPriceRange.find(pr => pr.range === priceRange);

    // Get position data for highest-inflated position
    let positionData = null;
    let highestPositionInflation = 0;
    player.positions.forEach(pos => {
      const posData = HISTORICAL_INFLATION_BASELINES.byPosition[pos];
      if (posData && posData.avgInflation > highestPositionInflation) {
        highestPositionInflation = posData.avgInflation;
        positionData = { position: pos, ...posData };
      }
    });

    return { tierData, priceRangeData, positionData, priceRange };
  }, [player]);

  const getRiskColor = (risk: 'safe' | 'aggressive' | 'dangerous') => {
    switch (risk) {
      case 'safe': return 'text-green-600 bg-green-50 border-green-200';
      case 'aggressive': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'dangerous': return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getRiskIcon = (risk: 'safe' | 'aggressive' | 'dangerous') => {
    switch (risk) {
      case 'safe': return <CheckCircle className="w-5 h-5" />;
      case 'aggressive': return <AlertTriangle className="w-5 h-5" />;
      case 'dangerous': return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{player.name}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-gray-600">{player.team}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{player.positions.join(', ')}</span>
              {player.tier && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                    Tier {player.tier}
                  </span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Value Analysis</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Base Projection</div>
                <div className="text-2xl font-bold text-gray-900">${player.projectedValue}</div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Adjusted Value</div>
                <div className="text-2xl font-bold text-blue-700">${player.adjustedValue}</div>
              </div>

              <div className={`p-4 rounded-lg ${
                valueChange > 0 ? 'bg-green-50' : valueChange < 0 ? 'bg-red-50' : 'bg-gray-50'
              }`}>
                <div className="text-sm text-gray-600 mb-1">Change</div>
                <div className={`text-2xl font-bold flex items-center gap-1 ${
                  valueChange > 0 ? 'text-green-700' : valueChange < 0 ? 'text-red-700' : 'text-gray-700'
                }`}>
                  {valueChange > 0 ? '+' : ''}{valueChange}
                  <span className="text-base font-normal">({valueChangePercent}%)</span>
                  {valueChange > 0 && <TrendingUp className="w-5 h-5" />}
                </div>
              </div>
            </div>

            {player.status === 'drafted' && player.draftedPrice !== undefined && (
              <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>Drafted for ${player.draftedPrice}</strong> by {player.draftedBy}
                    {player.draftedPrice !== undefined && (
                      <span className={player.draftedPrice < player.projectedValue ? 'text-green-700' : 'text-red-700'}>
                        {' '}({player.draftedPrice < player.projectedValue ? 'Value!' : 'Overpay'}:
                        {player.draftedPrice < player.projectedValue ? ' -' : ' +'}
                        ${Math.abs(player.draftedPrice - player.projectedValue)} vs projection)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Inflation Calculation Breakdown - Collapsible */}
          {inflationBreakdown && player.status !== 'drafted' && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowInflationBreakdown(!showInflationBreakdown)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">How Adjusted Value is Calculated</span>
                </div>
                {showInflationBreakdown ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {showInflationBreakdown && (
                <div className="p-4 space-y-4 bg-white">
                  {/* Step 1: Base Projection */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-900">Step 1: Base Projection</div>
                      <div className="text-sm text-gray-500">From projection system</div>
                    </div>
                    <div className="text-lg font-bold text-gray-900">${player.projectedValue}</div>
                  </div>

                  {/* Step 2: Remaining Budget Multiplier */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <div className="font-medium text-gray-900">Step 2: Remaining Budget Multiplier</div>
                      <div className="text-sm text-gray-500">
                        ${Math.round(inflationBreakdown.remainingBudget).toLocaleString()} left /
                        ${Math.round(inflationBreakdown.remainingValue).toLocaleString()} value
                      </div>
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      x {inflationBreakdown.baseMultiplier.toFixed(2)}
                    </div>
                  </div>

                  {/* Step 3: Position Scarcity */}
                  {inflationBreakdown.scarcityMultiplier > 1 && inflationBreakdown.highestScarcity && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div>
                        <div className="font-medium text-gray-900">
                          Step 3: Position Scarcity ({inflationBreakdown.highestScarcity.position})
                        </div>
                        <div className="text-sm text-gray-500">
                          {inflationBreakdown.highestScarcity.scarcityLevel === 'severe' && 'Severe scarcity - high demand'}
                          {inflationBreakdown.highestScarcity.scarcityLevel === 'moderate' && 'Moderate scarcity'}
                          {inflationBreakdown.highestScarcity.scarcityLevel === 'normal' && 'Normal supply'}
                          {inflationBreakdown.highestScarcity.scarcityLevel === 'surplus' && 'Surplus - many available'}
                          {' '}({inflationBreakdown.highestScarcity.qualityCount} quality / {inflationBreakdown.highestScarcity.leagueNeed} needed)
                        </div>
                      </div>
                      <div className="text-lg font-bold text-purple-600">
                        x {inflationBreakdown.scarcityMultiplier.toFixed(2)}
                        <span className="text-sm font-normal text-gray-500 ml-1">
                          (+{((inflationBreakdown.scarcityMultiplier - 1) * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Final Calculation */}
                  <div className="pt-2 mt-2 border-t-2 border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">Final Calculation</div>
                        <div className="text-sm text-gray-500">
                          ${player.projectedValue} x {inflationBreakdown.finalMultiplier.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        = ${inflationBreakdown.calculatedValue}
                      </div>
                    </div>
                    {inflationBreakdown.calculatedValue !== player.adjustedValue && (
                      <div className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                        <Info className="w-4 h-4" />
                        Displayed as ${player.adjustedValue} after rounding/market adjustments
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Strategic Analysis - Only show if user has selected a team */}
          {strategicAnalysis && myMoneyRemaining !== undefined && myRosterSpotsRemaining !== undefined && player.status !== 'drafted' && (
            <div className={`border rounded-lg overflow-hidden ${getRiskColor(strategicAnalysis.riskLevel)}`}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5" />
                  <span className="font-semibold">Strategic Analysis</span>
                  {getRiskIcon(strategicAnalysis.riskLevel)}
                </div>

                {/* Your Budget Status */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-sm opacity-80">Your Remaining Budget</div>
                    <div className="text-xl font-bold">${myMoneyRemaining}</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-sm opacity-80">Roster Spots Left</div>
                    <div className="text-xl font-bold">{myRosterSpotsRemaining}</div>
                  </div>
                </div>

                {/* Budget Breakdown */}
                <div className="bg-white/60 rounded-lg p-3 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Mandatory Reserve (${myRosterSpotsRemaining - 1} x $1)</span>
                    <span className="font-medium">-${strategicAnalysis.mandatoryReserve}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Effective Budget</span>
                    <span>${strategicAnalysis.effectiveBudget}</span>
                  </div>
                </div>

                {/* Value vs Limits Comparison */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Adjusted Value</span>
                    <span className={`font-bold ${
                      strategicAnalysis.riskLevel === 'safe' ? 'text-green-700' :
                      strategicAnalysis.riskLevel === 'aggressive' ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      ${player.adjustedValue}
                      <span className="font-normal text-sm ml-1">
                        ({strategicAnalysis.adjustedValuePercent}% of effective)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Recommended Max Bid</span>
                    <span className="font-medium">${strategicAnalysis.recommendedMax}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm opacity-75">
                    <span>Absolute Max (50% rule)</span>
                    <span>${strategicAnalysis.absoluteMax}</span>
                  </div>
                </div>

                {/* Strategic Advice */}
                <div className="bg-white/80 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{strategicAnalysis.advice}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Projected Stats */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Projected Statistics</h3>
            <div className="grid grid-cols-4 gap-4">
              {isPitcher ? (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-sm text-gray-600">Wins</div>
                    <div className="text-lg font-bold text-gray-900">{player.projectedStats.W ?? '-'}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-sm text-gray-600">Strikeouts</div>
                    <div className="text-lg font-bold text-gray-900">{player.projectedStats.K ?? '-'}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-sm text-gray-600">ERA</div>
                    <div className="text-lg font-bold text-gray-900">{player.projectedStats.ERA?.toFixed(2) ?? '-'}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-sm text-gray-600">WHIP</div>
                    <div className="text-lg font-bold text-gray-900">{player.projectedStats.WHIP?.toFixed(2) ?? '-'}</div>
                  </div>
                  {player.projectedStats.SV !== undefined && player.projectedStats.SV > 0 && (
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <div className="text-sm text-gray-600">Saves</div>
                      <div className="text-lg font-bold text-gray-900">{player.projectedStats.SV}</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-sm text-gray-600">Home Runs</div>
                    <div className="text-lg font-bold text-gray-900">{player.projectedStats.HR ?? '-'}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-sm text-gray-600">RBI</div>
                    <div className="text-lg font-bold text-gray-900">{player.projectedStats.RBI ?? '-'}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-sm text-gray-600">Stolen Bases</div>
                    <div className="text-lg font-bold text-gray-900">{player.projectedStats.SB ?? '-'}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-sm text-gray-600">Batting Avg</div>
                    <div className="text-lg font-bold text-gray-900">{player.projectedStats.AVG?.toFixed(3) ?? '-'}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Historical Context */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Historical Auction Insights</h3>
            <div className="space-y-3">
              {/* Price Range Insight */}
              {historicalContext.priceRangeData && (
                <div className={`p-3 rounded-lg ${
                  historicalContext.priceRangeData.trend === 'deflated' ? 'bg-green-50 border border-green-200' :
                  historicalContext.priceRangeData.trend === 'normal' ? 'bg-blue-50 border border-blue-200' :
                  historicalContext.priceRangeData.trend === 'moderate' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <div className={`font-medium ${
                    historicalContext.priceRangeData.trend === 'deflated' ? 'text-green-800' :
                    historicalContext.priceRangeData.trend === 'normal' ? 'text-blue-800' :
                    historicalContext.priceRangeData.trend === 'moderate' ? 'text-yellow-800' :
                    'text-red-800'
                  }`}>
                    {historicalContext.priceRange} Players: {historicalContext.priceRangeData.advice}
                  </div>
                  <div className="text-sm mt-1 opacity-75">
                    Historical avg inflation: {historicalContext.priceRangeData.avgInflation >= 0 ? '+' : ''}
                    {historicalContext.priceRangeData.avgInflation.toFixed(0)}%
                  </div>
                </div>
              )}

              {/* Tier Insight */}
              {historicalContext.tierData && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-purple-800 font-medium">
                    Tier {player.tier} ({historicalContext.tierData.label}): {historicalContext.tierData.insight}
                  </div>
                  <div className="text-sm text-purple-700 mt-1">
                    Historical avg inflation: {historicalContext.tierData.avgInflation >= 0 ? '+' : ''}
                    {historicalContext.tierData.avgInflation.toFixed(0)}%
                  </div>
                </div>
              )}

              {/* Position Insight */}
              {historicalContext.positionData && (
                <div className={`p-3 rounded-lg ${
                  historicalContext.positionData.trend === 'severely_inflated' ? 'bg-red-50 border border-red-200' :
                  historicalContext.positionData.trend === 'highly_inflated' ? 'bg-orange-50 border border-orange-200' :
                  historicalContext.positionData.trend === 'moderately_inflated' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  <div className={`font-medium ${
                    historicalContext.positionData.trend === 'severely_inflated' ? 'text-red-800' :
                    historicalContext.positionData.trend === 'highly_inflated' ? 'text-orange-800' :
                    historicalContext.positionData.trend === 'moderately_inflated' ? 'text-yellow-800' :
                    'text-gray-800'
                  }`}>
                    {historicalContext.positionData.position} Position: {historicalContext.positionData.advice}
                  </div>
                  <div className="text-sm mt-1 opacity-75">
                    Historical avg inflation: +{historicalContext.positionData.avgInflation.toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4">
          <button
            onClick={onClose}
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

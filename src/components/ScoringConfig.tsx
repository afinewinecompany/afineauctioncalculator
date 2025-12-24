import { LeagueSettings } from '../lib/types';
import { Trophy, Target } from 'lucide-react';

interface ScoringConfigProps {
  settings: LeagueSettings;
  onUpdateSettings: (settings: LeagueSettings) => void;
}

export function ScoringConfig({ settings, onUpdateSettings }: ScoringConfigProps) {
  const isCategories = settings.scoringType === 'rotisserie' || settings.scoringType === 'h2h-categories';
  const isPoints = settings.scoringType === 'h2h-points';

  const hittingCategoryOptions = [
    { key: 'R', label: 'Runs (R)', description: 'Runs scored' },
    { key: 'HR', label: 'Home Runs (HR)', description: 'Home runs hit' },
    { key: 'RBI', label: 'RBI', description: 'Runs batted in' },
    { key: 'SB', label: 'Stolen Bases (SB)', description: 'Bases stolen' },
    { key: 'AVG', label: 'Batting Average (AVG)', description: 'Hits divided by at-bats' },
    { key: 'OBP', label: 'On-Base % (OBP)', description: 'On-base percentage' },
    { key: 'SLG', label: 'Slugging % (SLG)', description: 'Slugging percentage' },
    { key: 'OPS', label: 'OPS', description: 'On-base plus slugging' },
    { key: 'H', label: 'Hits (H)', description: 'Total hits' },
    { key: 'XBH', label: 'Extra Base Hits (XBH)', description: '2B + 3B + HR' }
  ];

  const pitchingCategoryOptions = [
    { key: 'W', label: 'Wins (W)', description: 'Pitching wins' },
    { key: 'K', label: 'Strikeouts (K)', description: 'Strikeouts pitched' },
    { key: 'ERA', label: 'ERA', description: 'Earned run average' },
    { key: 'WHIP', label: 'WHIP', description: 'Walks + hits per inning' },
    { key: 'SV', label: 'Saves (SV)', description: 'Games saved' },
    { key: 'QS', label: 'Quality Starts (QS)', description: '6+ IP, 3 or fewer ER' },
    { key: 'K_BB', label: 'K/BB Ratio', description: 'Strikeout to walk ratio' },
    { key: 'K9', label: 'K/9', description: 'Strikeouts per 9 innings' },
    { key: 'IP', label: 'Innings Pitched (IP)', description: 'Total innings pitched' },
    { key: 'SV_HD', label: 'SV+HD', description: 'Saves plus holds' }
  ];

  const hittingPointOptions = [
    { key: 'H', label: 'Single (1B)', defaultValue: 1 },
    { key: '2B', label: 'Double (2B)', defaultValue: 2 },
    { key: '3B', label: 'Triple (3B)', defaultValue: 3 },
    { key: 'HR', label: 'Home Run (HR)', defaultValue: 4 },
    { key: 'RBI', label: 'RBI', defaultValue: 1 },
    { key: 'R', label: 'Run (R)', defaultValue: 1 },
    { key: 'SB', label: 'Stolen Base (SB)', defaultValue: 2 },
    { key: 'BB', label: 'Walk (BB)', defaultValue: 1 },
    { key: 'K_hitter', label: 'Strikeout (K)', defaultValue: -1 }
  ];

  const pitchingPointOptions = [
    { key: 'IP', label: 'Inning Pitched (IP)', defaultValue: 3 },
    { key: 'W', label: 'Win (W)', defaultValue: 5 },
    { key: 'K_pitcher', label: 'Strikeout (K)', defaultValue: 1 },
    { key: 'QS', label: 'Quality Start (QS)', defaultValue: 3 },
    { key: 'SV', label: 'Save (SV)', defaultValue: 5 },
    { key: 'HD', label: 'Hold (HD)', defaultValue: 3 },
    { key: 'ER', label: 'Earned Run (ER)', defaultValue: -2 },
    { key: 'H_allowed', label: 'Hit Allowed (H)', defaultValue: -1 },
    { key: 'BB_allowed', label: 'Walk Allowed (BB)', defaultValue: -1 }
  ];

  const toggleCategory = (type: 'hitting' | 'pitching', key: string) => {
    if (type === 'hitting') {
      onUpdateSettings({
        ...settings,
        hittingCategories: {
          ...settings.hittingCategories,
          [key]: !settings.hittingCategories?.[key as keyof typeof settings.hittingCategories]
        }
      });
    } else {
      onUpdateSettings({
        ...settings,
        pitchingCategories: {
          ...settings.pitchingCategories,
          [key]: !settings.pitchingCategories?.[key as keyof typeof settings.pitchingCategories]
        }
      });
    }
  };

  const updatePointValue = (key: string, value: number) => {
    onUpdateSettings({
      ...settings,
      pointsSettings: {
        ...settings.pointsSettings,
        [key]: value
      }
    });
  };

  // Initialize points settings with defaults if switching to points
  if (isPoints && !settings.pointsSettings) {
    const defaultPoints: LeagueSettings['pointsSettings'] = {};
    [...hittingPointOptions, ...pitchingPointOptions].forEach(option => {
      defaultPoints[option.key as keyof typeof defaultPoints] = option.defaultValue;
    });
    onUpdateSettings({
      ...settings,
      pointsSettings: defaultPoints
    });
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <h2 className="text-white flex items-center gap-2">
        <Trophy className="w-6 h-6 text-red-500" />
        Scoring Configuration
      </h2>

      <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-4">
        <p className="text-blue-300">
          💡 {isCategories 
            ? 'Select the statistical categories that will be used to determine standings in your league.'
            : 'Set the point values for each statistical event. Positive values award points, negative values deduct points.'}
        </p>
      </div>

      {/* Category Selection for Roto/H2H Categories */}
      {isCategories && (
        <div className="grid grid-cols-2 gap-6">
          {/* Hitting Categories */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-emerald-400 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Hitting Categories
            </h3>
            <div className="space-y-2">
              {hittingCategoryOptions.map(option => (
                <label
                  key={option.key}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={settings.hittingCategories?.[option.key as keyof typeof settings.hittingCategories] || false}
                    onChange={() => toggleCategory('hitting', option.key)}
                    className="mt-1 w-5 h-5 rounded border-slate-600 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="text-white group-hover:text-emerald-400 transition-colors">
                      {option.label}
                    </div>
                    <div className="text-sm text-slate-500">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Pitching Categories */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-blue-400 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Pitching Categories
            </h3>
            <div className="space-y-2">
              {pitchingCategoryOptions.map(option => (
                <label
                  key={option.key}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={settings.pitchingCategories?.[option.key as keyof typeof settings.pitchingCategories] || false}
                    onChange={() => toggleCategory('pitching', option.key)}
                    className="mt-1 w-5 h-5 rounded border-slate-600 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="text-white group-hover:text-blue-400 transition-colors">
                      {option.label}
                    </div>
                    <div className="text-sm text-slate-500">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Points Settings for H2H Points */}
      {isPoints && (
        <div className="grid grid-cols-2 gap-6">
          {/* Hitting Points */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-emerald-400 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Hitting Point Values
            </h3>
            <div className="space-y-3">
              {hittingPointOptions.map(option => (
                <div key={option.key} className="flex items-center justify-between group">
                  <label className="text-slate-300 group-hover:text-white transition-colors">
                    {option.label}
                  </label>
                  <input
                    type="number"
                    value={settings.pointsSettings?.[option.key as keyof typeof settings.pointsSettings] ?? option.defaultValue}
                    onChange={(e) => updatePointValue(option.key, Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-center focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    step="0.5"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pitching Points */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-blue-400 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Pitching Point Values
            </h3>
            <div className="space-y-3">
              {pitchingPointOptions.map(option => (
                <div key={option.key} className="flex items-center justify-between group">
                  <label className="text-slate-300 group-hover:text-white transition-colors">
                    {option.label}
                  </label>
                  <input
                    type="number"
                    value={settings.pointsSettings?.[option.key as keyof typeof settings.pointsSettings] ?? option.defaultValue}
                    onChange={(e) => updatePointValue(option.key, Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-center focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    step="0.5"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white mb-3">Summary</h3>
        {isCategories && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-slate-400 mb-2">Hitting Categories:</div>
              <div className="text-emerald-400">
                {Object.entries(settings.hittingCategories || {})
                  .filter(([_, enabled]) => enabled)
                  .map(([key]) => key)
                  .join(', ') || 'None selected'}
              </div>
            </div>
            <div>
              <div className="text-slate-400 mb-2">Pitching Categories:</div>
              <div className="text-blue-400">
                {Object.entries(settings.pitchingCategories || {})
                  .filter(([_, enabled]) => enabled)
                  .map(([key]) => key)
                  .join(', ') || 'None selected'}
              </div>
            </div>
          </div>
        )}
        {isPoints && (
          <div className="text-slate-400 text-sm">
            Point values configured for {Object.keys(settings.pointsSettings || {}).length} statistics
          </div>
        )}
      </div>
    </div>
  );
}

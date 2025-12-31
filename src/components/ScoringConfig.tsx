import { useState } from 'react';
import { LeagueSettings } from '../lib/types';
import { Trophy, Target, ChevronDown, ChevronRight } from 'lucide-react';
import {
  hittingCategorySections,
  pitchingCategorySections,
  hittingPointSections,
  pitchingPointSections,
  hittingPointOptions,
  pitchingPointOptions,
} from '../lib/scoringCategories';
import { useIsMobile } from './ui/use-mobile';

interface ScoringConfigProps {
  settings: LeagueSettings;
  onUpdateSettings: (settings: LeagueSettings) => void;
}

export function ScoringConfig({ settings, onUpdateSettings }: ScoringConfigProps) {
  const isCategories = settings.scoringType === 'rotisserie' || settings.scoringType === 'h2h-categories';
  const isPoints = settings.scoringType === 'h2h-points';
  const isMobile = useIsMobile();

  // Collapsed sections state for categories
  const [expandedHitting, setExpandedHitting] = useState<Record<string, boolean>>({
    'Core Stats': true,
    'Rate Stats': true,
  });
  const [expandedPitching, setExpandedPitching] = useState<Record<string, boolean>>({
    'Core Stats': true,
    'Rate Stats': true,
  });
  // Collapsed sections state for points
  const [expandedHittingPoints, setExpandedHittingPoints] = useState<Record<string, boolean>>({
    'Core Stats': true,
    'Negative Stats': true,
  });
  const [expandedPitchingPoints, setExpandedPitchingPoints] = useState<Record<string, boolean>>({
    'Core Stats': true,
    'Negative Stats': true,
  });

  // Note: All category and point sections are now imported from '../lib/scoringCategories'

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
    <div className={`space-y-${isMobile ? '4' : '6'} animate-fadeIn`}>
      <h2 className={`text-white flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
        <Trophy className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-red-500`} />
        Scoring Configuration
      </h2>

      <div className={`bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-xl ${isMobile ? 'p-3' : 'p-4'}`}>
        <p className={`text-blue-300 ${isMobile ? 'text-sm' : ''}`}>
          💡 {isCategories
            ? (isMobile ? 'Select categories for standings.' : 'Select the statistical categories that will be used to determine standings in your league.')
            : (isMobile ? 'Set point values for each stat.' : 'Set the point values for each statistical event. Positive values award points, negative values deduct points.')}
        </p>
      </div>

      {/* Category Selection for Roto/H2H Categories */}
      {isCategories && (
        <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-6'}`}>
          {/* Hitting Categories */}
          <div className={`bg-slate-800/50 border border-slate-700 rounded-xl ${isMobile ? 'p-3' : 'p-6'} max-h-[400px] md:max-h-[600px] overflow-y-auto`}>
            <h3 className={`text-emerald-400 ${isMobile ? 'mb-2 text-sm' : 'mb-4'} flex items-center gap-2 sticky top-0 bg-slate-800/90 py-2 -mt-2 backdrop-blur-sm`}>
              <Target className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
              {isMobile ? 'Hitting' : 'Hitting Categories'}
              <span className={`ml-auto ${isMobile ? 'text-xs' : 'text-sm'} text-slate-400`}>
                {Object.values(settings.hittingCategories || {}).filter(Boolean).length}
              </span>
            </h3>
            <div className="space-y-4">
              {hittingCategorySections.map(section => (
                <div key={section.name} className="border border-slate-700/50 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedHitting(prev => ({ ...prev, [section.name]: !prev[section.name] }))}
                    className="w-full flex items-center gap-2 p-3 bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    {expandedHitting[section.name] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-slate-300 font-medium">{section.name}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {section.options.filter(o => settings.hittingCategories?.[o.key as keyof typeof settings.hittingCategories]).length}/{section.options.length}
                    </span>
                  </button>
                  {expandedHitting[section.name] && (
                    <div className="p-2 space-y-1">
                      {section.options.map(option => (
                        <label
                          key={option.key}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={settings.hittingCategories?.[option.key as keyof typeof settings.hittingCategories] || false}
                            onChange={() => toggleCategory('hitting', option.key)}
                            className="mt-0.5 w-4 h-4 rounded border-slate-600 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm group-hover:text-emerald-400 transition-colors">
                                {option.label}
                              </span>
                              {option.isRatio && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">RATIO</span>
                              )}
                              {option.isNegative && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">NEG</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 truncate">{option.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pitching Categories */}
          <div className={`bg-slate-800/50 border border-slate-700 rounded-xl ${isMobile ? 'p-3' : 'p-6'} max-h-[400px] md:max-h-[600px] overflow-y-auto`}>
            <h3 className={`text-blue-400 ${isMobile ? 'mb-2 text-sm' : 'mb-4'} flex items-center gap-2 sticky top-0 bg-slate-800/90 py-2 -mt-2 backdrop-blur-sm`}>
              <Target className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
              {isMobile ? 'Pitching' : 'Pitching Categories'}
              <span className={`ml-auto ${isMobile ? 'text-xs' : 'text-sm'} text-slate-400`}>
                {Object.values(settings.pitchingCategories || {}).filter(Boolean).length}
              </span>
            </h3>
            <div className="space-y-4">
              {pitchingCategorySections.map(section => (
                <div key={section.name} className="border border-slate-700/50 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedPitching(prev => ({ ...prev, [section.name]: !prev[section.name] }))}
                    className="w-full flex items-center gap-2 p-3 bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    {expandedPitching[section.name] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-slate-300 font-medium">{section.name}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {section.options.filter(o => settings.pitchingCategories?.[o.key as keyof typeof settings.pitchingCategories]).length}/{section.options.length}
                    </span>
                  </button>
                  {expandedPitching[section.name] && (
                    <div className="p-2 space-y-1">
                      {section.options.map(option => (
                        <label
                          key={option.key}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={settings.pitchingCategories?.[option.key as keyof typeof settings.pitchingCategories] || false}
                            onChange={() => toggleCategory('pitching', option.key)}
                            className="mt-0.5 w-4 h-4 rounded border-slate-600 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm group-hover:text-blue-400 transition-colors">
                                {option.label}
                              </span>
                              {option.isRatio && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">RATIO</span>
                              )}
                              {option.isNegative && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">NEG</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 truncate">{option.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Points Settings for H2H Points */}
      {isPoints && (
        <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-6'}`}>
          {/* Hitting Points */}
          <div className={`bg-slate-800/50 border border-slate-700 rounded-xl ${isMobile ? 'p-3' : 'p-6'} max-h-[400px] md:max-h-[600px] overflow-y-auto`}>
            <h3 className={`text-emerald-400 ${isMobile ? 'mb-2 text-sm' : 'mb-4'} flex items-center gap-2 sticky top-0 bg-slate-800/90 py-2 -mt-2 backdrop-blur-sm`}>
              <Target className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
              {isMobile ? 'Hitting Pts' : 'Hitting Point Values'}
              <span className={`ml-auto ${isMobile ? 'text-xs' : 'text-sm'} text-slate-400`}>
                {hittingPointOptions.filter(o => (settings.pointsSettings?.[o.key as keyof typeof settings.pointsSettings] ?? o.defaultValue) !== 0).length}
              </span>
            </h3>
            <div className="space-y-4">
              {hittingPointSections.map(section => (
                <div key={section.name} className="border border-slate-700/50 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedHittingPoints(prev => ({ ...prev, [section.name]: !prev[section.name] }))}
                    className="w-full flex items-center gap-2 p-3 bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    {expandedHittingPoints[section.name] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-slate-300 font-medium">{section.name}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {section.options.filter(o => (settings.pointsSettings?.[o.key as keyof typeof settings.pointsSettings] ?? o.defaultValue) !== 0).length}/{section.options.length}
                    </span>
                  </button>
                  {expandedHittingPoints[section.name] && (
                    <div className="p-2 space-y-1">
                      {section.options.map(option => (
                        <div key={option.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/50 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <span className="text-slate-300 text-sm group-hover:text-emerald-400 transition-colors">
                              {option.label}
                            </span>
                            {option.description && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-slate-600/50 text-slate-400 rounded">{option.description}</span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={settings.pointsSettings?.[option.key as keyof typeof settings.pointsSettings] ?? option.defaultValue}
                            onChange={(e) => updatePointValue(option.key, Number(e.target.value))}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-center text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                            step="0.5"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pitching Points */}
          <div className={`bg-slate-800/50 border border-slate-700 rounded-xl ${isMobile ? 'p-3' : 'p-6'} max-h-[400px] md:max-h-[600px] overflow-y-auto`}>
            <h3 className={`text-blue-400 ${isMobile ? 'mb-2 text-sm' : 'mb-4'} flex items-center gap-2 sticky top-0 bg-slate-800/90 py-2 -mt-2 backdrop-blur-sm`}>
              <Target className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
              {isMobile ? 'Pitching Pts' : 'Pitching Point Values'}
              <span className={`ml-auto ${isMobile ? 'text-xs' : 'text-sm'} text-slate-400`}>
                {pitchingPointOptions.filter(o => (settings.pointsSettings?.[o.key as keyof typeof settings.pointsSettings] ?? o.defaultValue) !== 0).length}
              </span>
            </h3>
            <div className="space-y-4">
              {pitchingPointSections.map(section => (
                <div key={section.name} className="border border-slate-700/50 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedPitchingPoints(prev => ({ ...prev, [section.name]: !prev[section.name] }))}
                    className="w-full flex items-center gap-2 p-3 bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
                  >
                    {expandedPitchingPoints[section.name] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-slate-300 font-medium">{section.name}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {section.options.filter(o => (settings.pointsSettings?.[o.key as keyof typeof settings.pointsSettings] ?? o.defaultValue) !== 0).length}/{section.options.length}
                    </span>
                  </button>
                  {expandedPitchingPoints[section.name] && (
                    <div className="p-2 space-y-1">
                      {section.options.map(option => (
                        <div key={option.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/50 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <span className="text-slate-300 text-sm group-hover:text-blue-400 transition-colors">
                              {option.label}
                            </span>
                            {option.description && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-slate-600/50 text-slate-400 rounded">{option.description}</span>
                            )}
                          </div>
                          <input
                            type="number"
                            value={settings.pointsSettings?.[option.key as keyof typeof settings.pointsSettings] ?? option.defaultValue}
                            onChange={(e) => updatePointValue(option.key, Number(e.target.value))}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-center text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                            step="0.5"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className={`bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl ${isMobile ? 'p-4' : 'p-6'}`}>
        <h3 className={`text-white ${isMobile ? 'mb-2 text-sm' : 'mb-3'}`}>Summary</h3>
        {isCategories && (
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-4'} text-sm`}>
            <div>
              <div className={`text-slate-400 ${isMobile ? 'mb-1' : 'mb-2'}`}>{isMobile ? 'Hitting:' : 'Hitting Categories:'}</div>
              <div className={`text-emerald-400 ${isMobile ? 'text-xs' : ''}`}>
                {Object.entries(settings.hittingCategories || {})
                  .filter(([_, enabled]) => enabled)
                  .map(([key]) => key)
                  .join(', ') || 'None selected'}
              </div>
            </div>
            <div>
              <div className={`text-slate-400 ${isMobile ? 'mb-1' : 'mb-2'}`}>{isMobile ? 'Pitching:' : 'Pitching Categories:'}</div>
              <div className={`text-blue-400 ${isMobile ? 'text-xs' : ''}`}>
                {Object.entries(settings.pitchingCategories || {})
                  .filter(([_, enabled]) => enabled)
                  .map(([key]) => key)
                  .join(', ') || 'None selected'}
              </div>
            </div>
          </div>
        )}
        {isPoints && (
          <div className={`text-slate-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Point values configured for {Object.keys(settings.pointsSettings || {}).length} statistics
          </div>
        )}
      </div>
    </div>
  );
}

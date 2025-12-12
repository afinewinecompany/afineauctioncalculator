import { useState } from 'react';
import { LeagueSettings } from '../lib/types';
import { defaultLeagueSettings } from '../lib/mockData';
import { ChevronRight, ChevronLeft, Zap, Database } from 'lucide-react';

interface SetupScreenProps {
  onComplete: (settings: LeagueSettings) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [settings, setSettings] = useState<LeagueSettings>(defaultLeagueSettings);
  const [currentStep, setCurrentStep] = useState(1);

  const updateRosterSpot = (position: keyof LeagueSettings['rosterSpots'], value: number) => {
    setSettings({
      ...settings,
      rosterSpots: {
        ...settings.rosterSpots,
        [position]: value
      }
    });
  };

  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const totalBudget = settings.numTeams * settings.budgetPerTeam;

  const scoringTypes: Array<{ value: LeagueSettings['scoringType']; label: string; description: string }> = [
    { value: 'rotisserie', label: 'Rotisserie', description: 'Cumulative stats ranked across categories' },
    { value: 'h2h-categories', label: 'H2H Categories', description: 'Weekly matchups with category wins' },
    { value: 'h2h-points', label: 'H2H Points', description: 'Weekly matchups with point totals' },
  ];

  const projectionSystems: Array<{ value: LeagueSettings['projectionSystem']; label: string; description: string }> = [
    { value: 'steamer', label: 'Steamer', description: 'Popular projection system with conservative estimates' },
    { value: 'batx', label: 'BatX', description: 'Advanced metrics-based projections' },
    { value: 'ja', label: 'JA', description: 'Custom projection algorithm' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-8 relative overflow-hidden">
      {/* Baseball field pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border-4 border-white"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border-4 border-white"></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-red-600 via-red-700 to-slate-800 p-8 border-b border-slate-700/50">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiIC8+PC9zdmc+')] opacity-20"></div>
            <div className="relative">
              <h1 className="text-white mb-2 drop-shadow-lg">⚾ Fantasy Baseball Auction Setup</h1>
              <p className="text-slate-200">Configure your league parameters for the perfect draft</p>
            </div>
          </div>

          <div className="p-8">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-12">
              {[
                { num: 1, label: 'League Format' },
                { num: 2, label: 'Roster Config' },
                { num: 3, label: 'Projections' },
                { num: 4, label: 'Review' }
              ].map((step, idx) => (
                <div key={step.num} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
                      currentStep >= step.num 
                        ? 'bg-gradient-to-br from-red-600 to-red-700 text-white shadow-lg shadow-red-500/50 scale-110' 
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                      {step.num}
                    </div>
                    <span className={`mt-2 transition-colors ${currentStep >= step.num ? 'text-white' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className={`flex-1 h-1 mx-4 rounded-full transition-all duration-300 ${
                      currentStep > step.num ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-slate-800'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: League Format */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-white flex items-center gap-2">
                  <Zap className="w-6 h-6 text-red-500" />
                  League Format
                </h2>
                
                <div>
                  <label className="block text-slate-300 mb-3">League Name</label>
                  <input
                    type="text"
                    value={settings.leagueName}
                    onChange={(e) => setSettings({ ...settings, leagueName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="Enter your league name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-3">Couch Manager Room ID</label>
                  <input
                    type="text"
                    value={settings.couchManagerRoomId}
                    onChange={(e) => setSettings({ ...settings, couchManagerRoomId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    placeholder="Enter Couch Manager auction room ID (optional)"
                  />
                  <p className="text-slate-500 mt-2">Used for API integration with projection systems</p>
                </div>
                
                <div>
                  <label className="block text-slate-300 mb-3">Number of Teams</label>
                  <input
                    type="number"
                    value={settings.numTeams}
                    onChange={(e) => setSettings({ ...settings, numTeams: Math.min(30, Math.max(2, Number(e.target.value))) })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    min={2}
                    max={30}
                    placeholder="Enter 2-30 teams"
                  />
                  <p className="text-slate-500 mt-2">Total league budget: <span className="text-emerald-400">${totalBudget.toLocaleString()}</span></p>
                </div>

                <div>
                  <label className="block text-slate-300 mb-3">Budget Per Team</label>
                  <input
                    type="number"
                    value={settings.budgetPerTeam}
                    onChange={(e) => setSettings({ ...settings, budgetPerTeam: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    min={100}
                    max={500}
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-3">Scoring Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    {scoringTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setSettings({ ...settings, scoringType: type.value })}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                          settings.scoringType === type.value
                            ? 'border-red-500 bg-gradient-to-br from-red-600/20 to-red-700/20 shadow-lg shadow-red-500/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <div className={`mb-1 ${settings.scoringType === type.value ? 'text-red-400' : 'text-slate-300'}`}>
                          {type.label}
                        </div>
                        <div className="text-slate-500">{type.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Roster Positions */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <h2 className="text-white">Roster Configuration</h2>
                  <div className="text-slate-300">
                    Total roster spots: <span className="text-emerald-400 text-2xl ml-2">{totalRosterSpots}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-emerald-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      Hitters
                    </h3>
                    {(['C', '1B', '2B', '3B', 'SS', 'OF', 'CI', 'MI', 'UTIL'] as const).map((pos) => (
                      <div key={pos} className="flex items-center justify-between group">
                        <label className="text-slate-300 group-hover:text-white transition-colors">{pos}</label>
                        <input
                          type="number"
                          value={settings.rosterSpots[pos]}
                          onChange={(e) => updateRosterSpot(pos, Number(e.target.value))}
                          className="w-20 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                          min={0}
                          max={10}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-blue-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      Pitchers
                    </h3>
                    {(['SP', 'RP', 'P'] as const).map((pos) => (
                      <div key={pos} className="flex items-center justify-between group">
                        <label className="text-slate-300 group-hover:text-white transition-colors">{pos}</label>
                        <input
                          type="number"
                          value={settings.rosterSpots[pos]}
                          onChange={(e) => updateRosterSpot(pos, Number(e.target.value))}
                          className="w-20 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                          min={0}
                          max={15}
                        />
                      </div>
                    ))}
                    
                    <div className="pt-4 border-t border-slate-700">
                      <div className="flex items-center justify-between group">
                        <label className="text-slate-300 group-hover:text-white transition-colors">Bench</label>
                        <input
                          type="number"
                          value={settings.rosterSpots.Bench}
                          onChange={(e) => updateRosterSpot('Bench', Number(e.target.value))}
                          className="w-20 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                          min={0}
                          max={10}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Projections */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-white flex items-center gap-2">
                  <Database className="w-6 h-6 text-red-500" />
                  Projection System
                </h2>

                <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                  <p className="text-blue-300">
                    💡 Choose the projection system that will be used to calculate player values. 
                    This determines the baseline for auction price calculations and inflation adjustments.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {projectionSystems.map((system) => (
                    <button
                      key={system.value}
                      onClick={() => setSettings({ ...settings, projectionSystem: system.value })}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                        settings.projectionSystem === system.value
                          ? 'border-red-500 bg-gradient-to-br from-red-600/20 to-red-700/20 shadow-lg shadow-red-500/20 scale-105'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:scale-102'
                      }`}
                    >
                      <div className={`mb-2 ${settings.projectionSystem === system.value ? 'text-red-400' : 'text-slate-300'}`}>
                        {system.label}
                      </div>
                      <div className="text-slate-500">{system.description}</div>
                      {settings.projectionSystem === system.value && (
                        <div className="mt-3 text-emerald-400">✓ Selected</div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mt-6">
                  <h3 className="text-slate-300 mb-4">Projection Details</h3>
                  <div className="space-y-2 text-slate-400">
                    <p>• Projections will be imported via API for all available players</p>
                    <p>• Auction values are calculated based on projected statistics</p>
                    <p>• Values adjust dynamically during the draft based on inflation</p>
                    <p>• System: <span className="text-white">{settings.projectionSystem.toUpperCase()}</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="text-white">Review Settings</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
                    <h3 className="text-emerald-400 mb-4">League Configuration</h3>
                    <div className="flex justify-between">
                      <span className="text-slate-400">League Size:</span>
                      <span className="text-white">{settings.numTeams} teams</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Budget Per Team:</span>
                      <span className="text-white">${settings.budgetPerTeam}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Budget Pool:</span>
                      <span className="text-emerald-400">${totalBudget.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Scoring Type:</span>
                      <span className="text-white capitalize">{settings.scoringType.replace('-', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Projection System:</span>
                      <span className="text-white uppercase">{settings.projectionSystem}</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
                    <h3 className="text-blue-400 mb-4">Roster Details</h3>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Roster Spots:</span>
                      <span className="text-white">{totalRosterSpots}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Players Needed:</span>
                      <span className="text-white">{totalRosterSpots * settings.numTeams}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-700">
                      <div className="text-slate-400 mb-2">Position Breakdown:</div>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(settings.rosterSpots).map(([pos, count]) => (
                          count > 0 && (
                            <div key={pos} className="text-slate-300">
                              {pos}: <span className="text-emerald-400">{count}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-600/20 to-green-600/20 border border-emerald-500/50 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                      <span className="text-white text-2xl">✓</span>
                    </div>
                    <div>
                      <p className="text-emerald-300">Settings validated and ready to start draft</p>
                      <p className="text-emerald-500">All configurations look good!</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-12">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2 group"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  Back
                </button>
              )}
              
              <div className="ml-auto">
                {currentStep < 4 ? (
                  <button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 flex items-center gap-2 group"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={() => onComplete(settings)}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-xl hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 group"
                  >
                    Start Draft
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
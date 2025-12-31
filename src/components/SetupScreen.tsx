import { useState, useRef, useEffect } from 'react';
import { LeagueSettings, SavedLeague } from '../lib/types';
import { defaultLeagueSettings } from '../lib/mockData';
import { ChevronRight, ChevronLeft, Zap, Database, Crown, RefreshCw, Upload, X, FileSpreadsheet, Save, LogOut, Check, Loader2, AlertTriangle, Link } from 'lucide-react';
import { ScoringConfig } from './ScoringConfig';
import { parseCSV } from '../lib/csvParser';
import { useSetupAutoSave, clearDraftSetup } from '../hooks/useSetupAutoSave';
import { useIsMobile } from './ui/use-mobile';

interface SetupScreenProps {
  onComplete: (settings: LeagueSettings) => void;
  onSaveAndExit?: () => void;
  existingLeague?: SavedLeague;
  onLeagueCreated?: (league: SavedLeague) => void;
  onLeagueUpdated?: (league: SavedLeague) => void;
}

export function SetupScreen({
  onComplete,
  onSaveAndExit,
  existingLeague,
  onLeagueCreated,
  onLeagueUpdated,
}: SetupScreenProps) {
  // Initialize state from existing league if resuming
  const [settings, setSettings] = useState<LeagueSettings>(
    existingLeague?.settings || defaultLeagueSettings
  );
  const [currentStep, setCurrentStep] = useState(existingLeague?.setupStep || 1);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save hook
  const { isSaving, lastSaved, error: saveError, saveNow, clearDraft } = useSetupAutoSave(
    existingLeague?.id || null,
    settings,
    currentStep,
    onLeagueCreated,
    onLeagueUpdated
  );

  // Track if save indicator should be visible
  const [showSaved, setShowSaved] = useState(false);
  const isMobile = useIsMobile();

  // Show "Saved" indicator briefly after save completes
  useEffect(() => {
    if (lastSaved && !isSaving) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved, isSaving]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsParsingFile(true);

    try {
      const text = await file.text();
      const rankings = parseCSV(text);

      setSettings({
        ...settings,
        dynastySettings: {
          ...settings.dynastySettings!,
          rankingsSource: 'custom',
          customRankings: rankings
        }
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearCustomRankings = () => {
    setSettings({
      ...settings,
      dynastySettings: {
        ...settings.dynastySettings!,
        rankingsSource: 'harryknowsball',
        customRankings: undefined
      }
    });
    setUploadError(null);
  };

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

  const projectionSystems: Array<{ value: LeagueSettings['projectionSystem']; label: string; description: string; disabled?: boolean; disabledReason?: string }> = [
    { value: 'steamer', label: 'Steamer', description: 'Popular projection system with conservative estimates' },
    { value: 'batx', label: 'BatX', description: 'Advanced metrics-based projections', disabled: true, disabledReason: 'Currently unavailable' },
    { value: 'ja', label: 'JA Projections', description: 'Jon Anderson (MLB Data Warehouse)' },
  ];

  const leagueTypes: Array<{ value: LeagueSettings['leagueType']; label: string; description: string; icon: React.ReactNode }> = [
    {
      value: 'redraft',
      label: 'Redraft',
      description: 'Single season league - values based purely on projected stats',
      icon: <RefreshCw className="w-6 h-6" />
    },
    {
      value: 'dynasty',
      label: 'Dynasty',
      description: 'Multi-year league - values blend projections with long-term rankings',
      icon: <Crown className="w-6 h-6" />
    },
  ];

  return (
    <div className={`${isMobile ? 'p-4' : 'p-8'} relative overflow-hidden`} style={{ minHeight: 'calc(100vh - 57px)', backgroundColor: '#0d0d0d' }}>
      {/* Animated background orbs - retro colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-96 h-96 rounded-full" style={{ background: 'linear-gradient(135deg, #f59e0b25, #ea580c18, transparent)', filter: 'blur(60px)' }}></div>
        <div className="absolute top-1/3 right-10 w-80 h-80 rounded-full" style={{ background: 'linear-gradient(225deg, #d946ef18, #9333ea12, transparent)', filter: 'blur(60px)' }}></div>
        <div className="absolute bottom-10 left-1/4 w-72 h-72 rounded-full" style={{ background: 'linear-gradient(45deg, #f43f5e18, transparent)', filter: 'blur(60px)' }}></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Header */}
          <div className={`relative ${isMobile ? 'p-4' : 'p-8'}`} style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316, #f43f5e)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {!isMobile && (
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            )}
            <div className={`relative ${isMobile ? 'flex flex-col gap-2' : 'flex items-start justify-between'}`}>
              <div>
                <h1 className={`text-white ${isMobile ? 'text-lg' : ''} mb-1 drop-shadow-lg`}>
                  {isMobile ? '⚾ League Setup' : '⚾ Auction Setup'}
                </h1>
                <p className={`text-slate-200 ${isMobile ? 'text-sm' : ''}`}>
                  {isMobile ? 'Configure your league' : 'Configure your league parameters for the perfect draft'}
                </p>
              </div>
              {/* Save indicator */}
              <div className={`flex items-center gap-2 text-sm ${isMobile ? 'self-end' : ''}`}>
                {isSaving && (
                  <span className="flex items-center gap-1.5 text-slate-300 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {!isMobile && 'Saving...'}
                  </span>
                )}
                {showSaved && !isSaving && (
                  <span className="flex items-center gap-1.5 text-emerald-400 transition-opacity">
                    <Check className="w-4 h-4" />
                    {!isMobile && 'Saved'}
                  </span>
                )}
                {saveError && !isSaving && (
                  <span className="text-red-400 text-xs">
                    {isMobile ? '!' : 'Save failed'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={isMobile ? 'p-4' : 'p-8'}>
            {/* Progress Steps */}
            {isMobile ? (
              /* Mobile: Compact step indicator */
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div
                      key={num}
                      className={`w-2 h-2 rounded-full transition-all ${
                        currentStep >= num
                          ? 'bg-red-500'
                          : 'bg-slate-700'
                      } ${currentStep === num ? 'w-4' : ''}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-slate-400">
                  Step {currentStep}/5: {['Format', 'Scoring', 'Roster', 'Projections', 'Review'][currentStep - 1]}
                </span>
              </div>
            ) : (
              /* Desktop: Full progress steps */
              <div className="flex items-center justify-between mb-12">
                {[
                  { num: 1, label: 'League Format' },
                  { num: 2, label: 'Scoring' },
                  { num: 3, label: 'Roster Config' },
                  { num: 4, label: 'Projections' },
                  { num: 5, label: 'Review' }
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
                      <span className={`mt-2 text-sm transition-colors ${currentStep >= step.num ? 'text-white' : 'text-slate-500'}`}>
                        {step.label}
                      </span>
                    </div>
                    {idx < 4 && (
                      <div className={`flex-1 h-1 mx-4 rounded-full transition-all duration-300 ${
                        currentStep > step.num ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-slate-800'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Step 1: League Format */}
            {currentStep === 1 && (
              <div className={`space-y-${isMobile ? '5' : '8'} animate-fadeIn`}>
                <h2 className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'}`} style={{ color: 'white', fontWeight: 600 }}>
                  <Zap className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} style={{ color: '#f97316' }} />
                  League Format
                </h2>

                {/* IMPORTANT: League Type Selection - First and Most Prominent */}
                <div className="rounded-xl" style={{ backgroundColor: 'rgba(249, 115, 22, 0.08)', border: '2px solid rgba(249, 115, 22, 0.3)', padding: isMobile ? '16px' : '24px' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} style={{ color: '#fbbf24' }} />
                    <label className={`${isMobile ? 'text-base' : 'text-lg'}`} style={{ color: 'white', fontWeight: 600 }}>
                      League Type
                    </label>
                    <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(249, 115, 22, 0.3)', color: '#fbbf24' }}>Required</span>
                  </div>
                  <p className={`${isMobile ? 'text-sm mb-3' : 'mb-4'}`} style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Choose whether this is a single-season redraft or a multi-year dynasty league.
                  </p>
                  <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'}`}>
                    {leagueTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setSettings({ ...settings, leagueType: type.value })}
                        className={`${isMobile ? 'p-4' : 'p-5'} rounded-xl transition-all duration-200 text-left`}
                        style={{
                          border: settings.leagueType === type.value
                            ? '2px solid #f97316'
                            : '2px solid rgba(255,255,255,0.1)',
                          backgroundColor: settings.leagueType === type.value
                            ? 'rgba(249, 115, 22, 0.15)'
                            : 'rgba(255,255,255,0.03)',
                          boxShadow: settings.leagueType === type.value
                            ? '0 10px 30px rgba(249, 115, 22, 0.2)'
                            : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div style={{ color: settings.leagueType === type.value ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
                            {isMobile ? <type.icon.type className="w-5 h-5" /> : type.icon}
                          </div>
                          <div className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold`} style={{ color: settings.leagueType === type.value ? '#fbbf24' : 'white' }}>
                            {type.label}
                          </div>
                          {settings.leagueType === type.value && (
                            <span className="ml-auto" style={{ color: '#22c55e' }}>✓</span>
                          )}
                        </div>
                        <div className={`${isMobile ? 'text-xs' : 'text-sm'}`} style={{ color: 'rgba(255,255,255,0.6)' }}>{type.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* League Name */}
                <div>
                  <label className={`block ${isMobile ? 'mb-2 text-sm' : 'mb-3'}`} style={{ color: 'white', fontWeight: 500 }}>League Name</label>
                  <input
                    type="text"
                    value={settings.leagueName}
                    onChange={(e) => setSettings({ ...settings, leagueName: e.target.value })}
                    className={`w-full ${isMobile ? 'px-3 py-2.5 text-sm' : 'px-4 py-3'} rounded-xl transition-all`}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'white',
                      outline: 'none',
                    }}
                    placeholder="Enter your league name"
                    required
                  />
                </div>

                {/* Dynasty Settings (shown when dynasty is selected) */}
                {settings.leagueType === 'dynasty' && (
                  <div className={`bg-gradient-to-br from-purple-900/30 to-slate-800/80 border-2 border-purple-500/60 rounded-xl ${isMobile ? 'p-4 space-y-4' : 'p-6 space-y-5'} shadow-lg shadow-purple-500/10`}>
                    <div className={`flex items-center gap-3 ${isMobile ? 'pb-2' : 'pb-3'} border-b border-purple-500/30`}>
                      <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg bg-purple-500/20 flex items-center justify-center`}>
                        <Crown className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-purple-400`} />
                      </div>
                      <div>
                        <h3 className={`text-white font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>Dynasty Settings</h3>
                        <p className={`text-purple-300/70 ${isMobile ? 'text-xs' : 'text-sm'}`}>Configure long-term league options</p>
                      </div>
                    </div>

                    {/* Rankings Source Selection */}
                    <div>
                      <label className={`block text-white font-medium ${isMobile ? 'mb-1.5 text-sm' : 'mb-2'}`}>Dynasty Rankings Source</label>
                      {/* Prompt message when nothing selected */}
                      {!settings.dynastySettings?.rankingsSource && (
                        <p className={`text-amber-400 ${isMobile ? 'text-xs mb-2' : 'text-sm mb-3'} animate-pulse`}>
                          Please select a rankings source below
                        </p>
                      )}
                      <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-4'}`}>
                        {/* Harry Knows Ball Option */}
                        <button
                          type="button"
                          onClick={() => setSettings({
                            ...settings,
                            dynastySettings: {
                              ...settings.dynastySettings!,
                              rankingsSource: 'harryknowsball',
                              customRankings: undefined
                            }
                          })}
                          className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                            settings.dynastySettings?.rankingsSource === 'harryknowsball'
                              ? 'border-purple-400 bg-purple-600/30 scale-[1.02]'
                              : !settings.dynastySettings?.rankingsSource
                                ? 'border-amber-500/60 bg-slate-700/50 hover:border-purple-400 hover:bg-purple-600/20 animate-pulse'
                                : 'border-slate-500 bg-slate-700/50 hover:border-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <div className="font-semibold text-base text-white">
                            Harry Knows Ball
                          </div>
                          <div className="text-sm mt-1 text-slate-300">
                            Crowd-sourced dynasty rankings
                          </div>
                          {settings.dynastySettings?.rankingsSource === 'harryknowsball' && (
                            <div className="mt-2 text-green-400 text-sm font-medium">✓ Selected</div>
                          )}
                        </button>

                        {/* Upload Custom Option */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                            settings.dynastySettings?.rankingsSource === 'custom'
                              ? 'border-purple-400 bg-purple-600/30 scale-[1.02]'
                              : !settings.dynastySettings?.rankingsSource
                                ? 'border-amber-500/60 bg-slate-700/50 hover:border-purple-400 hover:bg-purple-600/20 animate-pulse'
                                : 'border-slate-500 bg-slate-700/50 hover:border-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <div className="font-semibold text-base flex items-center gap-2 text-white">
                            <Upload className="w-4 h-4" />
                            Upload Custom
                          </div>
                          <div className="text-sm mt-1 text-slate-300">
                            CSV file with rankings
                          </div>
                          {settings.dynastySettings?.rankingsSource === 'custom' && (
                            <div className="mt-2 text-green-400 text-sm font-medium">✓ Selected</div>
                          )}
                        </button>
                      </div>

                      {/* Hidden file input - using inline style to guarantee it's hidden */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
                        tabIndex={-1}
                      />

                      {/* File Format Help */}
                      <p className="text-slate-300 text-sm mt-3">
                        CSV format: name column (name, player, fullname, or first+last) and rank column (rank, ranking, overall, etc.). Any column with "id" in the name is used for matching.
                      </p>
                    </div>

                    {/* Custom Rankings Status */}
                    {settings.dynastySettings?.rankingsSource === 'custom' && settings.dynastySettings?.customRankings && (
                      <div className="bg-green-900/40 border border-green-500/60 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-green-300">
                            <FileSpreadsheet className="w-5 h-5" />
                            <span className="font-semibold">
                              {settings.dynastySettings.customRankings.length} players loaded
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={clearCustomRankings}
                            className="text-slate-300 hover:text-red-400 transition-colors p-1"
                            title="Remove custom rankings"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="mt-2 text-slate-200 text-sm">
                          Top 3: {settings.dynastySettings.customRankings.slice(0, 3).map(r => r.name).join(', ')}
                        </div>
                      </div>
                    )}

                    {/* Upload Error */}
                    {uploadError && (
                      <div className="bg-red-900/40 border border-red-500/60 rounded-lg p-4 text-red-200">
                        {uploadError}
                      </div>
                    )}

                    {/* Parsing Indicator */}
                    {isParsingFile && (
                      <div className="text-white flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        Parsing file...
                      </div>
                    )}

                    <div>
                      <label className="block text-white font-medium mb-2">Dynasty Weight</label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={(settings.dynastySettings?.dynastyWeight ?? 0.5) * 100}
                          onChange={(e) => setSettings({
                            ...settings,
                            dynastySettings: {
                              ...settings.dynastySettings!,
                              dynastyWeight: Number(e.target.value) / 100
                            }
                          })}
                          className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-400"
                        />
                        <span className="text-white font-semibold w-16 text-center text-lg">
                          {Math.round((settings.dynastySettings?.dynastyWeight ?? 0.5) * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-300 mt-2">
                        <span>More Projections</span>
                        <span>More Dynasty Rank</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <label className="text-white font-medium">Include Minor Leaguers</label>
                        <p className="text-slate-300 text-sm">Include prospects in dynasty rankings</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium transition-colors ${
                          settings.dynastySettings?.includeMinors === true ? 'text-slate-500' : 'text-slate-300'
                        }`}>Off</span>
                        <button
                          type="button"
                          onClick={() => setSettings({
                            ...settings,
                            dynastySettings: {
                              ...settings.dynastySettings!,
                              includeMinors: settings.dynastySettings?.includeMinors === true ? false : true
                            }
                          })}
                          className={`relative w-14 h-7 rounded-full transition-colors duration-300 ease-in-out ${
                            settings.dynastySettings?.includeMinors === true
                              ? 'bg-purple-500'
                              : 'bg-slate-600'
                          }`}
                          role="switch"
                          aria-checked={settings.dynastySettings?.includeMinors === true}
                        >
                          <span
                            className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ease-in-out"
                            style={{
                              left: settings.dynastySettings?.includeMinors === true ? 'calc(100% - 26px)' : '2px'
                            }}
                          />
                        </button>
                        <span className={`text-sm font-medium transition-colors ${
                          settings.dynastySettings?.includeMinors === true ? 'text-purple-400' : 'text-slate-500'
                        }`}>On</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* IMPORTANT: Couch Managers Room ID - Second Most Important */}
                <div className="rounded-xl" style={{
                  backgroundColor: settings.couchManagerRoomId ? 'rgba(34, 197, 94, 0.08)' : 'rgba(251, 191, 36, 0.08)',
                  border: settings.couchManagerRoomId ? '2px solid rgba(34, 197, 94, 0.3)' : '2px solid rgba(251, 191, 36, 0.3)',
                  padding: isMobile ? '16px' : '24px'
                }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Link className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} style={{ color: settings.couchManagerRoomId ? '#22c55e' : '#fbbf24' }} />
                    <label className={`${isMobile ? 'text-base' : 'text-lg'}`} style={{ color: 'white', fontWeight: 600 }}>
                      Couch Managers Room ID
                    </label>
                    <span className="px-2 py-0.5 rounded text-xs" style={{
                      backgroundColor: settings.couchManagerRoomId ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 191, 36, 0.3)',
                      color: settings.couchManagerRoomId ? '#22c55e' : '#fbbf24'
                    }}>
                      {settings.couchManagerRoomId ? 'Connected' : 'Recommended'}
                    </span>
                  </div>

                  <p className={`${isMobile ? 'text-sm mb-3' : 'mb-4'}`} style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Connect to your Couch Managers auction room for live draft syncing and real-time inflation updates.
                  </p>

                  <input
                    type="text"
                    value={settings.couchManagerRoomId}
                    onChange={(e) => setSettings({ ...settings, couchManagerRoomId: e.target.value })}
                    className={`w-full ${isMobile ? 'px-3 py-2.5 text-sm' : 'px-4 py-3'} rounded-xl transition-all`}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      border: settings.couchManagerRoomId
                        ? '2px solid rgba(34, 197, 94, 0.5)'
                        : '2px solid rgba(255,255,255,0.15)',
                      color: 'white',
                      outline: 'none',
                    }}
                    placeholder={isMobile ? "Enter Room ID" : "Enter your Couch Managers auction room ID"}
                  />

                  <p className={`mt-3 ${isMobile ? 'text-xs' : 'text-sm'}`} style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {isMobile ? (
                      <>Find in URL: couchmanagers.com/auction/<span style={{ color: '#22c55e', fontFamily: 'monospace' }}>[ROOM_ID]</span></>
                    ) : (
                      <>Find this in your Couch Managers URL: <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>couchmanagers.com/auction/<span style={{ color: '#22c55e' }}>[ROOM_ID]</span></span></>
                    )}
                  </p>

                  {/* Warning when no Room ID is entered */}
                  {!settings.couchManagerRoomId && (
                    <div className={`flex items-start gap-3 ${isMobile ? 'mt-3 p-3' : 'mt-4 p-4'} rounded-lg`} style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                      <AlertTriangle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} flex-shrink-0 mt-0.5`} style={{ color: '#fbbf24' }} />
                      <div>
                        <p className={`${isMobile ? 'text-sm' : ''} font-medium`} style={{ color: '#fbbf24' }}>
                          No Room ID entered
                        </p>
                        <p className={`${isMobile ? 'text-xs mt-1' : 'text-sm mt-1'}`} style={{ color: 'rgba(255,255,255,0.6)' }}>
                          Without a Room ID, you won't have automatic draft syncing. You'll need to manually track picks and the calculator won't update in real-time.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Success message when Room ID is entered */}
                  {settings.couchManagerRoomId && (
                    <div className={`flex items-center gap-2 ${isMobile ? 'mt-3' : 'mt-4'}`}>
                      <Check className="w-4 h-4" style={{ color: '#22c55e' }} />
                      <span className={`${isMobile ? 'text-sm' : ''}`} style={{ color: '#22c55e' }}>Room ID configured - live syncing enabled</span>
                    </div>
                  )}
                </div>

                {/* Teams and Budget - side by side on mobile */}
                <div className={isMobile ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-6'}>
                  <div>
                    <label className={`block ${isMobile ? 'mb-2 text-sm' : 'mb-3'}`} style={{ color: 'white', fontWeight: 500 }}>{isMobile ? 'Teams' : 'Number of Teams'}</label>
                    <input
                      type="number"
                      value={settings.numTeams}
                      onChange={(e) => setSettings({ ...settings, numTeams: Math.min(30, Math.max(2, Number(e.target.value))) })}
                      className={`w-full ${isMobile ? 'px-3 py-2.5 text-sm' : 'px-4 py-3'} rounded-xl transition-all`}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'white',
                        outline: 'none',
                      }}
                      min={2}
                      max={30}
                      placeholder="2-30"
                    />
                  </div>

                  <div>
                    <label className={`block ${isMobile ? 'mb-2 text-sm' : 'mb-3'}`} style={{ color: 'white', fontWeight: 500 }}>{isMobile ? 'Budget' : 'Budget Per Team'}</label>
                    <input
                      type="number"
                      value={settings.budgetPerTeam}
                      onChange={(e) => setSettings({ ...settings, budgetPerTeam: Number(e.target.value) })}
                      className={`w-full ${isMobile ? 'px-3 py-2.5 text-sm' : 'px-4 py-3'} rounded-xl transition-all`}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'white',
                        outline: 'none',
                      }}
                      min={100}
                      max={500}
                    />
                  </div>
                </div>

                {/* Total budget summary */}
                <div className={`rounded-lg ${isMobile ? 'p-3' : 'p-4'}`} style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                  <p className={`${isMobile ? 'text-sm' : ''}`} style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Total league budget: <span style={{ color: '#22c55e', fontWeight: 600, fontSize: isMobile ? '1rem' : '1.125rem' }}>${totalBudget.toLocaleString()}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}> ({settings.numTeams} teams × ${settings.budgetPerTeam})</span>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Scoring */}
            {currentStep === 2 && (
              <div className={`space-y-${isMobile ? '4' : '6'} animate-fadeIn`}>
                <h2 className={`text-white flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
                  <Database className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-red-500`} />
                  Scoring Type
                </h2>

                <div className={`bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-xl ${isMobile ? 'p-3' : 'p-4'} mb-4`}>
                  <p className={`text-blue-300 ${isMobile ? 'text-sm' : ''}`}>
                    {isMobile ? (
                      '💡 Choose the scoring type for player rankings.'
                    ) : (
                      '💡 Choose the scoring type that will be used to rank players. This determines the baseline for auction price calculations and inflation adjustments.'
                    )}
                  </p>
                </div>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-3 gap-4'} mb-4`}>
                  {scoringTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSettings({ ...settings, scoringType: type.value })}
                      className={`${isMobile ? 'p-3' : 'p-6'} rounded-xl border-2 transition-all duration-200 ${
                        settings.scoringType === type.value
                          ? 'border-red-500 bg-gradient-to-br from-red-600/20 to-red-700/20 shadow-lg shadow-red-500/20'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className={`flex items-center ${isMobile ? 'justify-between' : 'flex-col'}`}>
                        <div className={`${isMobile ? '' : 'mb-2'} ${settings.scoringType === type.value ? 'text-red-400' : 'text-slate-300'}`}>
                          {type.label}
                        </div>
                        {settings.scoringType === type.value && (
                          <span className="text-emerald-400 text-sm">✓</span>
                        )}
                      </div>
                      {!isMobile && (
                        <div className="text-slate-500 text-sm">{type.description}</div>
                      )}
                    </button>
                  ))}
                </div>

                <ScoringConfig settings={settings} onUpdateSettings={setSettings} />
              </div>
            )}

            {/* Step 3: Roster Positions */}
            {currentStep === 3 && (
              <div className={`space-y-${isMobile ? '4' : '6'} animate-fadeIn`}>
                <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'}`}>
                  <h2 className={`text-white ${isMobile ? 'text-lg' : ''}`}>Roster Configuration</h2>
                  <div className={`text-slate-300 ${isMobile ? 'text-sm' : ''}`}>
                    Total: <span className={`text-emerald-400 ${isMobile ? 'text-lg' : 'text-2xl'} ml-1`}>{totalRosterSpots}</span> spots
                  </div>
                </div>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-8'}`}>
                  <div className={`space-y-${isMobile ? '2' : '4'} bg-slate-800/50 ${isMobile ? 'p-3' : 'p-6'} rounded-xl border border-slate-700`}>
                    <h3 className={`text-emerald-400 flex items-center gap-2 ${isMobile ? 'text-sm' : ''}`}>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      Hitters
                    </h3>
                    <div className={isMobile ? 'grid grid-cols-3 gap-2' : 'space-y-4'}>
                      {(['C', '1B', '2B', '3B', 'SS', 'OF', 'CI', 'MI', 'UTIL'] as const).map((pos) => (
                        <div key={pos} className={`flex ${isMobile ? 'flex-col gap-1' : 'items-center justify-between'} group`}>
                          <label className={`text-slate-300 group-hover:text-white transition-colors ${isMobile ? 'text-xs' : ''}`}>{pos}</label>
                          <input
                            type="number"
                            value={settings.rosterSpots[pos]}
                            onChange={(e) => updateRosterSpot(pos, Number(e.target.value))}
                            className={`${isMobile ? 'w-full px-2 py-1.5 text-sm' : 'w-20 px-3 py-2'} bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all`}
                            min={0}
                            max={10}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`space-y-${isMobile ? '2' : '4'} bg-slate-800/50 ${isMobile ? 'p-3' : 'p-6'} rounded-xl border border-slate-700`}>
                    <h3 className={`text-blue-400 flex items-center gap-2 ${isMobile ? 'text-sm' : ''}`}>
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      Pitchers
                    </h3>
                    <div className={isMobile ? 'grid grid-cols-3 gap-2' : 'space-y-4'}>
                      {(['SP', 'RP', 'P'] as const).map((pos) => (
                        <div key={pos} className={`flex ${isMobile ? 'flex-col gap-1' : 'items-center justify-between'} group`}>
                          <label className={`text-slate-300 group-hover:text-white transition-colors ${isMobile ? 'text-xs' : ''}`}>{pos}</label>
                          <input
                            type="number"
                            value={settings.rosterSpots[pos]}
                            onChange={(e) => updateRosterSpot(pos, Number(e.target.value))}
                            className={`${isMobile ? 'w-full px-2 py-1.5 text-sm' : 'w-20 px-3 py-2'} bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all`}
                            min={0}
                            max={15}
                          />
                        </div>
                      ))}
                    </div>

                    <div className={`${isMobile ? 'pt-2' : 'pt-4'} border-t border-slate-700`}>
                      <div className={`flex ${isMobile ? 'items-center justify-between' : 'items-center justify-between'} group`}>
                        <label className={`text-slate-300 group-hover:text-white transition-colors ${isMobile ? 'text-sm' : ''}`}>Bench</label>
                        <input
                          type="number"
                          value={settings.rosterSpots.Bench}
                          onChange={(e) => updateRosterSpot('Bench', Number(e.target.value))}
                          className={`${isMobile ? 'w-16 px-2 py-1.5 text-sm' : 'w-20 px-3 py-2'} bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all`}
                          min={0}
                          max={50}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Projections */}
            {currentStep === 4 && (
              <div className={`space-y-${isMobile ? '4' : '6'} animate-fadeIn`}>
                <h2 className={`text-white flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
                  <Database className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-red-500`} />
                  Projection System
                </h2>

                <div className={`bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/30 rounded-xl ${isMobile ? 'p-3' : 'p-4'} mb-4`}>
                  <p className={`text-blue-300 ${isMobile ? 'text-sm' : ''}`}>
                    {isMobile ? (
                      '💡 Choose projections for player values.'
                    ) : (
                      '💡 Choose the projection system that will be used to calculate player values. This determines the baseline for auction price calculations and inflation adjustments.'
                    )}
                  </p>
                </div>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-3 gap-4'}`}>
                  {projectionSystems.map((system) => (
                    <button
                      key={system.value}
                      onClick={() => !system.disabled && setSettings({ ...settings, projectionSystem: system.value })}
                      disabled={system.disabled}
                      className={`${isMobile ? 'p-3' : 'p-6'} rounded-xl border-2 transition-all duration-200 ${
                        system.disabled
                          ? 'border-slate-700/50 bg-slate-800/30 cursor-not-allowed opacity-50'
                          : settings.projectionSystem === system.value
                          ? 'border-red-500 bg-gradient-to-br from-red-600/20 to-red-700/20 shadow-lg shadow-red-500/20'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className={`flex items-center ${isMobile ? 'justify-between' : 'flex-col'}`}>
                        <div className={`${isMobile ? '' : 'mb-2'} ${
                          system.disabled
                            ? 'text-slate-500'
                            : settings.projectionSystem === system.value
                            ? 'text-red-400'
                            : 'text-slate-300'
                        }`}>
                          {system.label}
                        </div>
                        {!system.disabled && settings.projectionSystem === system.value && (
                          <span className="text-emerald-400 text-sm">✓</span>
                        )}
                      </div>
                      {!isMobile && (
                        <div className={system.disabled ? 'text-slate-600' : 'text-slate-500'}>
                          {system.disabled ? system.disabledReason : system.description}
                        </div>
                      )}
                      {isMobile && system.disabled && (
                        <div className="text-slate-600 text-xs mt-1">{system.disabledReason}</div>
                      )}
                    </button>
                  ))}
                </div>

                {!isMobile && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mt-6">
                    <h3 className="text-slate-300 mb-4">Projection Details</h3>
                    <div className="space-y-2 text-slate-400">
                      <p>• Projections will be imported via API for all available players</p>
                      <p>• Auction values are calculated based on projected statistics</p>
                      <p>• Values adjust dynamically during the draft based on inflation</p>
                      <p>• System: <span className="text-white">{settings.projectionSystem.toUpperCase()}</span></p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className={`space-y-${isMobile ? '4' : '6'} animate-fadeIn`}>
                <h2 className={`text-white ${isMobile ? 'text-lg' : ''}`}>Review Settings</h2>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'}`}>
                  <div className={`bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl ${isMobile ? 'p-4 space-y-3' : 'p-6 space-y-4'}`}>
                    <h3 className={`text-emerald-400 ${isMobile ? 'text-sm mb-2' : 'mb-4'}`}>League Configuration</h3>
                    <div className="flex justify-between">
                      <span className="text-slate-400">League Type:</span>
                      <span className={`capitalize flex items-center gap-2 ${settings.leagueType === 'dynasty' ? 'text-purple-400' : 'text-white'}`}>
                        {settings.leagueType === 'dynasty' && <Crown className="w-4 h-4" />}
                        {settings.leagueType === 'redraft' && <RefreshCw className="w-4 h-4" />}
                        {settings.leagueType}
                      </span>
                    </div>
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
                    {settings.leagueType === 'dynasty' && settings.dynastySettings && (
                      <>
                        <div className="pt-3 border-t border-slate-700">
                          <div className="text-purple-400 mb-2 flex items-center gap-2">
                            <Crown className="w-4 h-4" />
                            Dynasty Settings
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Rankings Source:</span>
                              <span className="text-white">
                                {settings.dynastySettings.rankingsSource === 'custom'
                                  ? `Custom (${settings.dynastySettings.customRankings?.length ?? 0} players)`
                                  : 'Harry Knows Ball'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Dynasty Weight:</span>
                              <span className="text-white">{Math.round(settings.dynastySettings.dynastyWeight * 100)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Include Minors:</span>
                              <span className={settings.dynastySettings.includeMinors ? 'text-emerald-400' : 'text-slate-500'}>
                                {settings.dynastySettings.includeMinors ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
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

                {settings.leagueType === 'dynasty' && (
                  <div className="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/50 rounded-xl p-4">
                    <p className="text-purple-300 text-sm">
                      Dynasty mode enabled - player values will blend Steamer projections ({Math.round((1 - (settings.dynastySettings?.dynastyWeight ?? 0.5)) * 100)}%)
                      with {settings.dynastySettings?.rankingsSource === 'custom' ? 'custom uploaded' : 'Harry Knows Ball'} dynasty rankings ({Math.round((settings.dynastySettings?.dynastyWeight ?? 0.5) * 100)}%)
                    </p>
                  </div>
                )}

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
            <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between'} mt-${isMobile ? '6' : '12'}`}>
              {isMobile ? (
                /* Mobile: Stacked buttons */
                <>
                  {currentStep < 5 ? (
                    <button
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        clearDraft();
                        onComplete(settings);
                      }}
                      className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-xl hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                    >
                      Start Draft
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  <div className="flex gap-2">
                    {currentStep > 1 && (
                      <button
                        onClick={() => setCurrentStep(currentStep - 1)}
                        className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                      </button>
                    )}
                    {onSaveAndExit && (
                      <button
                        onClick={async () => {
                          await saveNow();
                          onSaveAndExit();
                        }}
                        disabled={isSaving}
                        className={`${currentStep > 1 ? 'flex-1' : 'w-full'} px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                      >
                        <LogOut className="w-4 h-4" />
                        Save & Exit
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* Desktop: Side by side */
                <>
                  <div className="flex items-center gap-3">
                    {currentStep > 1 && (
                      <button
                        onClick={() => setCurrentStep(currentStep - 1)}
                        className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2 group"
                      >
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back
                      </button>
                    )}

                    {/* Save & Exit button */}
                    {onSaveAndExit && (
                      <button
                        onClick={async () => {
                          await saveNow();
                          onSaveAndExit();
                        }}
                        disabled={isSaving}
                        className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2 group disabled:opacity-50"
                      >
                        <LogOut className="w-4 h-4" />
                        Save & Exit
                      </button>
                    )}
                  </div>

                  <div className="ml-auto">
                    {currentStep < 5 ? (
                      <button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 flex items-center gap-2 group"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          // Clear draft from localStorage since we're starting the actual draft
                          clearDraft();
                          onComplete(settings);
                        }}
                        className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-xl hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 group"
                      >
                        Start Draft
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
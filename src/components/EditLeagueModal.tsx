import { useState, useRef } from 'react';
import { SavedLeague, LeagueSettings } from '../lib/types';
import {
  X, Save, RefreshCw, Database, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, Users, Trophy,
  Crown, Upload, FileSpreadsheet, Target
} from 'lucide-react';
import { parseCSV } from '../lib/csvParser';
import { hittingCategorySections, pitchingCategorySections } from '../lib/scoringCategories';

interface EditLeagueModalProps {
  league: SavedLeague;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedLeague: SavedLeague) => void;
  onReloadProjections: (league: SavedLeague, newProjectionSystem?: LeagueSettings['projectionSystem']) => Promise<void>;
}

export function EditLeagueModal({
  league,
  isOpen,
  onClose,
  onSave,
  onReloadProjections
}: EditLeagueModalProps) {
  const [editedSettings, setEditedSettings] = useState<LeagueSettings>(league.settings);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    leagueFormat: false,
    scoring: false,
    roster: false,
    projections: true
  });

  const projectionSystems: Array<{ value: LeagueSettings['projectionSystem']; label: string; description: string; disabled?: boolean; disabledReason?: string }> = [
    { value: 'steamer', label: 'Steamer', description: 'Popular, conservative' },
    { value: 'batx', label: 'BatX', description: 'Advanced metrics', disabled: true, disabledReason: 'Currently unavailable' },
    { value: 'ja', label: 'JA Projections', description: 'Jon Anderson (MLB Data Warehouse)' },
  ];

  const scoringTypes: Array<{ value: LeagueSettings['scoringType']; label: string }> = [
    { value: 'rotisserie', label: 'Rotisserie' },
    { value: 'h2h-categories', label: 'H2H Categories' },
    { value: 'h2h-points', label: 'H2H Points' },
  ];

  // Collapsed sections state for category selection
  const [expandedHitting, setExpandedHitting] = useState<Record<string, boolean>>({
    'Core Stats': true,
    'Rate Stats': true,
  });
  const [expandedPitching, setExpandedPitching] = useState<Record<string, boolean>>({
    'Core Stats': true,
    'Rate Stats': true,
  });

  if (!isOpen) return null;

  const handleSettingChange = <K extends keyof LeagueSettings>(key: K, value: LeagueSettings[K]) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const updateRosterSpot = (position: keyof LeagueSettings['rosterSpots'], value: number) => {
    setEditedSettings(prev => ({
      ...prev,
      rosterSpots: { ...prev.rosterSpots, [position]: value }
    }));
    setHasUnsavedChanges(true);
  };

  const toggleCategory = (type: 'hitting' | 'pitching', key: string) => {
    if (type === 'hitting') {
      setEditedSettings(prev => ({
        ...prev,
        hittingCategories: {
          ...prev.hittingCategories,
          [key]: !prev.hittingCategories?.[key as keyof typeof prev.hittingCategories]
        }
      }));
    } else {
      setEditedSettings(prev => ({
        ...prev,
        pitchingCategories: {
          ...prev.pitchingCategories,
          [key]: !prev.pitchingCategories?.[key as keyof typeof prev.pitchingCategories]
        }
      }));
    }
    setHasUnsavedChanges(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsParsingFile(true);

    try {
      const text = await file.text();
      const rankings = parseCSV(text);

      setEditedSettings(prev => ({
        ...prev,
        dynastySettings: {
          ...prev.dynastySettings!,
          rankingsSource: 'custom',
          customRankings: rankings
        }
      }));
      setHasUnsavedChanges(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    const updatedLeague: SavedLeague = {
      ...league,
      leagueName: editedSettings.leagueName,
      settings: editedSettings,
      lastModified: new Date().toISOString()
    };
    onSave(updatedLeague);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleReloadProjections = async () => {
    setIsReloading(true);
    setReloadError(null);

    try {
      const updatedLeague: SavedLeague = {
        ...league,
        leagueName: editedSettings.leagueName,
        settings: editedSettings,
        lastModified: new Date().toISOString()
      };

      await onReloadProjections(updatedLeague, editedSettings.projectionSystem);
      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      setReloadError(error instanceof Error ? error.message : 'Failed to reload projections');
    } finally {
      setIsReloading(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const settingsChanged = JSON.stringify(editedSettings) !== JSON.stringify(league.settings);
  const requiresReload =
    editedSettings.projectionSystem !== league.settings.projectionSystem ||
    editedSettings.numTeams !== league.settings.numTeams ||
    editedSettings.budgetPerTeam !== league.settings.budgetPerTeam ||
    editedSettings.leagueType !== league.settings.leagueType ||
    editedSettings.scoringType !== league.settings.scoringType ||
    JSON.stringify(editedSettings.rosterSpots) !== JSON.stringify(league.settings.rosterSpots) ||
    JSON.stringify(editedSettings.hittingCategories) !== JSON.stringify(league.settings.hittingCategories) ||
    JSON.stringify(editedSettings.pitchingCategories) !== JSON.stringify(league.settings.pitchingCategories) ||
    JSON.stringify(editedSettings.dynastySettings) !== JSON.stringify(league.settings.dynastySettings);

  const totalRosterSpots = Object.values(editedSettings.rosterSpots).reduce((a, b) => a + b, 0);
  const totalBudget = editedSettings.numTeams * editedSettings.budgetPerTeam;
  const isCategories = editedSettings.scoringType === 'rotisserie' || editedSettings.scoringType === 'h2h-categories';

  const SectionHeader = ({
    title,
    icon: Icon,
    section,
    iconColor = 'text-red-500'
  }: {
    title: string;
    icon: React.ElementType;
    section: keyof typeof expandedSections;
    iconColor?: string;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700 transition-all"
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <span className="text-white font-medium">{title}</span>
      </div>
      {expandedSections[section] ? (
        <ChevronDown className="w-5 h-5 text-slate-400" />
      ) : (
        <ChevronRight className="w-5 h-5 text-slate-400" />
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !isReloading && onClose()}
      />

      <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl text-white">Edit League Settings</h2>
          <button
            onClick={onClose}
            disabled={isReloading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Basic Settings Section */}
          <SectionHeader title="Basic Settings" icon={Target} section="basic" />
          {expandedSections.basic && (
            <div className="space-y-4 pl-4 border-l-2 border-slate-700 ml-2">
              <div>
                <label className="block text-slate-300 mb-2 text-sm">League Name</label>
                <input
                  type="text"
                  value={editedSettings.leagueName}
                  onChange={(e) => handleSettingChange('leagueName', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter your league name"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-2 text-sm">
                  Couch Managers Room ID <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editedSettings.couchManagerRoomId || ''}
                  onChange={(e) => handleSettingChange('couchManagerRoomId', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter room ID for live sync"
                />
              </div>
            </div>
          )}

          {/* League Format Section */}
          <SectionHeader title="League Format" icon={Users} section="leagueFormat" iconColor="text-emerald-500" />
          {expandedSections.leagueFormat && (
            <div className="space-y-4 pl-4 border-l-2 border-slate-700 ml-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 mb-2 text-sm">Number of Teams</label>
                  <input
                    type="number"
                    value={editedSettings.numTeams}
                    onChange={(e) => handleSettingChange('numTeams', Math.min(30, Math.max(2, Number(e.target.value))))}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-red-500"
                    min={2}
                    max={30}
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2 text-sm">Budget Per Team</label>
                  <input
                    type="number"
                    value={editedSettings.budgetPerTeam}
                    onChange={(e) => handleSettingChange('budgetPerTeam', Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-red-500"
                    min={100}
                    max={500}
                  />
                </div>
              </div>
              <p className="text-slate-500 text-sm">
                Total league budget: <span className="text-emerald-400">${totalBudget.toLocaleString()}</span>
              </p>

              {/* League Type */}
              <div>
                <label className="block text-slate-300 mb-2 text-sm">League Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['redraft', 'dynasty'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        handleSettingChange('leagueType', type);
                        if (type === 'dynasty' && !editedSettings.dynastySettings) {
                          setEditedSettings(prev => ({
                            ...prev,
                            leagueType: type,
                            dynastySettings: {
                              dynastyWeight: 0.5,
                              includeMinors: false,
                              rankingsSource: 'harryknowsball'
                            }
                          }));
                          setHasUnsavedChanges(true);
                        }
                      }}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        editedSettings.leagueType === type
                          ? 'border-red-500 bg-red-900/20'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {type === 'dynasty' ? <Crown className="w-4 h-4 text-purple-400" /> : null}
                        <span className={editedSettings.leagueType === type ? 'text-red-400' : 'text-slate-300'}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {type === 'redraft' ? 'Single season values' : 'Blend projections with dynasty rankings'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynasty Settings */}
              {editedSettings.leagueType === 'dynasty' && (
                <div className="bg-gradient-to-br from-purple-900/30 to-slate-800/80 border-2 border-purple-500/60 rounded-xl p-6 space-y-5 shadow-lg shadow-purple-500/10">
                  <div className="flex items-center gap-3 pb-3 border-b border-purple-500/30">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Crown className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">Dynasty Settings</h3>
                      <p className="text-purple-300/70 text-sm">Configure long-term league options</p>
                    </div>
                  </div>

                  {/* Rankings Source Selection */}
                  <div>
                    <label className="block text-white font-medium mb-2">Dynasty Rankings Source</label>
                    {/* Prompt message when nothing selected */}
                    {!editedSettings.dynastySettings?.rankingsSource && (
                      <p className="text-amber-400 text-sm mb-3 animate-pulse">
                        Please select a rankings source below
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Harry Knows Ball Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditedSettings(prev => ({
                            ...prev,
                            dynastySettings: { ...prev.dynastySettings!, rankingsSource: 'harryknowsball', customRankings: undefined }
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                          editedSettings.dynastySettings?.rankingsSource === 'harryknowsball'
                            ? 'border-purple-400 bg-purple-600/30 scale-[1.02]'
                            : !editedSettings.dynastySettings?.rankingsSource
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
                        {editedSettings.dynastySettings?.rankingsSource === 'harryknowsball' && (
                          <div className="mt-2 text-green-400 text-sm font-medium">✓ Selected</div>
                        )}
                      </button>

                      {/* Upload Custom Option */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                          editedSettings.dynastySettings?.rankingsSource === 'custom'
                            ? 'border-purple-400 bg-purple-600/30 scale-[1.02]'
                            : !editedSettings.dynastySettings?.rankingsSource
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
                        {editedSettings.dynastySettings?.rankingsSource === 'custom' && (
                          <div className="mt-2 text-green-400 text-sm font-medium">✓ Selected</div>
                        )}
                      </button>
                    </div>

                    {/* Hidden file input */}
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
                  {editedSettings.dynastySettings?.rankingsSource === 'custom' && editedSettings.dynastySettings?.customRankings && (
                    <div className="bg-green-900/40 border border-green-500/60 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-300">
                          <FileSpreadsheet className="w-5 h-5" />
                          <span className="font-semibold">
                            {editedSettings.dynastySettings.customRankings.length} players loaded
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditedSettings(prev => ({
                              ...prev,
                              dynastySettings: { ...prev.dynastySettings!, rankingsSource: 'harryknowsball', customRankings: undefined }
                            }));
                            setHasUnsavedChanges(true);
                          }}
                          className="text-slate-300 hover:text-red-400 transition-colors p-1"
                          title="Remove custom rankings"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="mt-2 text-slate-200 text-sm">
                        Top 3: {editedSettings.dynastySettings.customRankings.slice(0, 3).map(r => r.name).join(', ')}
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

                  {/* Dynasty Weight */}
                  <div>
                    <label className="block text-white font-medium mb-2">Dynasty Weight</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={(editedSettings.dynastySettings?.dynastyWeight ?? 0.5) * 100}
                        onChange={(e) => {
                          setEditedSettings(prev => ({
                            ...prev,
                            dynastySettings: { ...prev.dynastySettings!, dynastyWeight: Number(e.target.value) / 100 }
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-400"
                      />
                      <span className="text-white font-semibold w-16 text-center text-lg">
                        {Math.round((editedSettings.dynastySettings?.dynastyWeight ?? 0.5) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-300 mt-2">
                      <span>More Projections</span>
                      <span>More Dynasty Rank</span>
                    </div>
                  </div>

                  {/* Include Minors Toggle */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="text-white font-medium">Include Minor Leaguers</label>
                      <p className="text-slate-300 text-sm">Include prospects in dynasty rankings</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium transition-colors ${
                        editedSettings.dynastySettings?.includeMinors === true ? 'text-slate-500' : 'text-slate-300'
                      }`}>Off</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditedSettings(prev => ({
                            ...prev,
                            dynastySettings: { ...prev.dynastySettings!, includeMinors: prev.dynastySettings?.includeMinors === true ? false : true }
                          }));
                          setHasUnsavedChanges(true);
                        }}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 ease-in-out ${
                          editedSettings.dynastySettings?.includeMinors === true
                            ? 'bg-purple-500'
                            : 'bg-slate-600'
                        }`}
                        role="switch"
                        aria-checked={editedSettings.dynastySettings?.includeMinors === true}
                      >
                        <span
                          className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ease-in-out"
                          style={{
                            left: editedSettings.dynastySettings?.includeMinors === true ? 'calc(100% - 26px)' : '2px'
                          }}
                        />
                      </button>
                      <span className={`text-sm font-medium transition-colors ${
                        editedSettings.dynastySettings?.includeMinors === true ? 'text-purple-400' : 'text-slate-500'
                      }`}>On</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scoring Section */}
          <SectionHeader title="Scoring Settings" icon={Trophy} section="scoring" iconColor="text-yellow-500" />
          {expandedSections.scoring && (
            <div className="space-y-4 pl-4 border-l-2 border-slate-700 ml-2">
              <div>
                <label className="block text-slate-300 mb-2 text-sm">Scoring Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {scoringTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleSettingChange('scoringType', type.value)}
                      className={`p-3 rounded-lg border transition-all text-sm ${
                        editedSettings.scoringType === type.value
                          ? 'border-red-500 bg-red-900/20 text-red-400'
                          : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categories Selection */}
              {isCategories && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Hitting Categories */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                    <h4 className="text-emerald-400 mb-3 flex items-center gap-2 sticky top-0 bg-slate-800/90 py-2 -mt-2 backdrop-blur-sm text-sm">
                      <Target className="w-4 h-4" />
                      Hitting Categories
                      <span className="ml-auto text-xs text-slate-400">
                        {Object.values(editedSettings.hittingCategories || {}).filter(Boolean).length} selected
                      </span>
                    </h4>
                    <div className="space-y-3">
                      {hittingCategorySections.map(section => (
                        <div key={section.name} className="border border-slate-700/50 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedHitting(prev => ({ ...prev, [section.name]: !prev[section.name] }))}
                            className="w-full flex items-center gap-2 p-2 bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
                          >
                            {expandedHitting[section.name] ? (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                            )}
                            <span className="text-slate-300 text-xs font-medium">{section.name}</span>
                            <span className="ml-auto text-[10px] text-slate-500">
                              {section.options.filter(o => editedSettings.hittingCategories?.[o.key as keyof typeof editedSettings.hittingCategories]).length}/{section.options.length}
                            </span>
                          </button>
                          {expandedHitting[section.name] && (
                            <div className="p-2 space-y-1">
                              {section.options.map(option => (
                                <label
                                  key={option.key}
                                  className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                >
                                  <input
                                    type="checkbox"
                                    checked={editedSettings.hittingCategories?.[option.key as keyof typeof editedSettings.hittingCategories] || false}
                                    onChange={() => toggleCategory('hitting', option.key)}
                                    className="mt-0.5 w-3.5 h-3.5 rounded border-slate-600 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-white text-xs group-hover:text-emerald-400 transition-colors">
                                        {option.label}
                                      </span>
                                      {option.isRatio && (
                                        <span className="text-[9px] px-1 py-0.5 bg-purple-500/20 text-purple-300 rounded">RATIO</span>
                                      )}
                                      {option.isNegative && (
                                        <span className="text-[9px] px-1 py-0.5 bg-red-500/20 text-red-300 rounded">NEG</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">{option.description}</div>
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
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                    <h4 className="text-blue-400 mb-3 flex items-center gap-2 sticky top-0 bg-slate-800/90 py-2 -mt-2 backdrop-blur-sm text-sm">
                      <Target className="w-4 h-4" />
                      Pitching Categories
                      <span className="ml-auto text-xs text-slate-400">
                        {Object.values(editedSettings.pitchingCategories || {}).filter(Boolean).length} selected
                      </span>
                    </h4>
                    <div className="space-y-3">
                      {pitchingCategorySections.map(section => (
                        <div key={section.name} className="border border-slate-700/50 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedPitching(prev => ({ ...prev, [section.name]: !prev[section.name] }))}
                            className="w-full flex items-center gap-2 p-2 bg-slate-700/30 hover:bg-slate-700/50 transition-colors text-left"
                          >
                            {expandedPitching[section.name] ? (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                            )}
                            <span className="text-slate-300 text-xs font-medium">{section.name}</span>
                            <span className="ml-auto text-[10px] text-slate-500">
                              {section.options.filter(o => editedSettings.pitchingCategories?.[o.key as keyof typeof editedSettings.pitchingCategories]).length}/{section.options.length}
                            </span>
                          </button>
                          {expandedPitching[section.name] && (
                            <div className="p-2 space-y-1">
                              {section.options.map(option => (
                                <label
                                  key={option.key}
                                  className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                >
                                  <input
                                    type="checkbox"
                                    checked={editedSettings.pitchingCategories?.[option.key as keyof typeof editedSettings.pitchingCategories] || false}
                                    onChange={() => toggleCategory('pitching', option.key)}
                                    className="mt-0.5 w-3.5 h-3.5 rounded border-slate-600 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-white text-xs group-hover:text-blue-400 transition-colors">
                                        {option.label}
                                      </span>
                                      {option.isRatio && (
                                        <span className="text-[9px] px-1 py-0.5 bg-purple-500/20 text-purple-300 rounded">RATIO</span>
                                      )}
                                      {option.isNegative && (
                                        <span className="text-[9px] px-1 py-0.5 bg-red-500/20 text-red-300 rounded">NEG</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">{option.description}</div>
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
            </div>
          )}

          {/* Roster Section */}
          <SectionHeader title="Roster Configuration" icon={Users} section="roster" iconColor="text-blue-500" />
          {expandedSections.roster && (
            <div className="space-y-4 pl-4 border-l-2 border-slate-700 ml-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Total roster spots:</span>
                <span className="text-emerald-400 font-medium">{totalRosterSpots}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="text-emerald-400 text-sm mb-3">Hitters</h4>
                  <div className="space-y-2">
                    {(['C', '1B', '2B', '3B', 'SS', 'OF', 'CI', 'MI', 'UTIL'] as const).map((pos) => (
                      <div key={pos} className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">{pos}</span>
                        <input
                          type="number"
                          value={editedSettings.rosterSpots[pos]}
                          onChange={(e) => updateRosterSpot(pos, Math.max(0, Number(e.target.value)))}
                          className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-center text-sm"
                          min={0}
                          max={10}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="text-blue-400 text-sm mb-3">Pitchers</h4>
                  <div className="space-y-2">
                    {(['SP', 'RP', 'P'] as const).map((pos) => (
                      <div key={pos} className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">{pos}</span>
                        <input
                          type="number"
                          value={editedSettings.rosterSpots[pos]}
                          onChange={(e) => updateRosterSpot(pos, Math.max(0, Number(e.target.value)))}
                          className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-center text-sm"
                          min={0}
                          max={15}
                        />
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">Bench</span>
                        <input
                          type="number"
                          value={editedSettings.rosterSpots.Bench}
                          onChange={(e) => updateRosterSpot('Bench', Math.max(0, Number(e.target.value)))}
                          className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-center text-sm"
                          min={0}
                          max={10}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Projection System Section */}
          <SectionHeader title="Projection System" icon={Database} section="projections" />
          {expandedSections.projections && (
            <div className="space-y-4 pl-4 border-l-2 border-slate-700 ml-2">
              <div className="grid grid-cols-3 gap-3">
                {projectionSystems.map((system) => (
                  <button
                    key={system.value}
                    onClick={() => !system.disabled && handleSettingChange('projectionSystem', system.value)}
                    disabled={system.disabled}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      system.disabled
                        ? 'bg-slate-800/30 border-slate-700/50 cursor-not-allowed opacity-50'
                        : editedSettings.projectionSystem === system.value
                        ? 'bg-red-900/30 border-red-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className={`font-medium mb-1 ${system.disabled ? 'text-slate-500' : ''}`}>{system.label}</div>
                    <div className={`text-xs ${system.disabled ? 'text-slate-600' : 'text-slate-400'}`}>
                      {system.disabled ? system.disabledReason : system.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Warning about reload needed */}
          {requiresReload && settingsChanged && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-400">
                <strong>Settings changed that affect player values.</strong> You'll need to reload projections to apply these changes.
                This will recalculate all player values based on the new settings.
              </div>
            </div>
          )}

          {/* Error Message */}
          {reloadError && (
            <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl text-red-200">
              {reloadError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-t border-slate-700 flex items-center justify-between gap-4">
          <button
            onClick={handleReloadProjections}
            disabled={isReloading}
            className="px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isReloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reloading...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Reload Projections
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isReloading}
              className="px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isReloading || !hasUnsavedChanges}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-lg hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

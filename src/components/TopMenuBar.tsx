import { LayoutDashboard, ChevronDown, Settings } from 'lucide-react';
import { SavedLeague } from '../lib/types';

interface TopMenuBarProps {
  currentLeague: SavedLeague | null;
  allLeagues: SavedLeague[];
  onGoToDashboard: () => void;
  onSwitchLeague: (league: SavedLeague) => void;
  showLeagueSelector?: boolean;
}

export function TopMenuBar({ 
  currentLeague, 
  allLeagues, 
  onGoToDashboard,
  onSwitchLeague,
  showLeagueSelector = true
}: TopMenuBarProps) {
  const otherLeagues = allLeagues.filter(l => l.id !== currentLeague?.id);

  return (
    <div className="bg-slate-900 border-b border-slate-700/50 shadow-lg">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Left Side - Current League Info */}
          <div className="flex items-center gap-4">
            {currentLeague && (
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-emerald-900/30 border border-emerald-500/30 rounded-lg">
                  <span className="text-emerald-400">{currentLeague.leagueName}</span>
                </div>
                <div className="text-slate-500 text-sm">
                  {currentLeague.settings.numTeams} Teams • ${currentLeague.settings.budgetPerTeam} Budget
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center gap-2">
            {/* League Selector Dropdown */}
            {showLeagueSelector && otherLeagues.length > 0 && (
              <div className="relative group">
                <button className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 hover:border-slate-600 transition-all flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Switch League
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700 mb-2">
                      Your Other Leagues
                    </div>
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {otherLeagues.map((league) => (
                        <button
                          key={league.id}
                          onClick={() => onSwitchLeague(league)}
                          className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-700 transition-all group/item"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate group-hover/item:text-emerald-400 transition-colors">
                                {league.leagueName}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {league.settings.numTeams} Teams • ${league.settings.budgetPerTeam}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {league.status === 'drafting' && (
                                <span className="px-2 py-0.5 bg-yellow-900/30 text-yellow-400 border border-yellow-500/30 rounded text-xs">
                                  In Progress
                                </span>
                              )}
                              {league.status === 'complete' && (
                                <span className="px-2 py-0.5 bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 rounded text-xs">
                                  Complete
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard Button */}
            <button
              onClick={onGoToDashboard}
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white border border-red-500 rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40 flex items-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

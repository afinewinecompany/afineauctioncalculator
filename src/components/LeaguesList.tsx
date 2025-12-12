import { SavedLeague } from '../lib/types';
import { Plus, Calendar, Users, DollarSign, Trash2, Play, CheckCircle } from 'lucide-react';

interface LeaguesListProps {
  username: string;
  leagues: SavedLeague[];
  onCreateNew: () => void;
  onContinueDraft: (league: SavedLeague) => void;
  onDeleteLeague: (leagueId: string) => void;
  onLogout: () => void;
  profilePicture?: string;
}

export function LeaguesList({ 
  username, 
  leagues, 
  onCreateNew, 
  onContinueDraft,
  onDeleteLeague,
  onLogout,
  profilePicture
}: LeaguesListProps) {
  const getStatusBadge = (status: SavedLeague['status']) => {
    switch (status) {
      case 'setup':
        return (
          <span className="px-3 py-1 bg-blue-900/30 text-blue-400 border border-blue-500/30 rounded-lg text-sm">
            Setup
          </span>
        );
      case 'drafting':
        return (
          <span className="px-3 py-1 bg-yellow-900/30 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm flex items-center gap-1">
            <Play className="w-3 h-3" />
            In Progress
          </span>
        );
      case 'complete':
        return (
          <span className="px-3 py-1 bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Complete
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-red-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fadeIn">
          <div className="flex items-center gap-4">
            {profilePicture && (
              <img 
                src={profilePicture} 
                alt={username} 
                className="w-16 h-16 rounded-full border-2 border-red-500 shadow-lg shadow-red-500/30"
              />
            )}
            <div>
              <h1 className="text-4xl text-white mb-2">Welcome back, {username}!</h1>
              <p className="text-slate-400">Manage your fantasy baseball auction drafts</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all"
          >
            Logout
          </button>
        </div>

        {/* Create New League Button */}
        <button
          onClick={onCreateNew}
          className="w-full mb-8 p-6 bg-gradient-to-r from-red-600 to-red-700 border border-red-500 rounded-2xl hover:from-red-700 hover:to-red-800 transition-all shadow-2xl shadow-red-500/30 hover:shadow-red-500/50 group animate-slideInLeft"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="text-xl text-white">Create New League</div>
              <div className="text-red-200">Start a new auction draft</div>
            </div>
          </div>
        </button>

        {/* Leagues List */}
        {leagues.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-2xl text-white mb-4">Your Leagues</h2>
            {leagues.map((league, index) => (
              <div
                key={league.id}
                className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all shadow-xl backdrop-blur-sm animate-slideInLeft"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-2xl text-white">{league.leagueName}</h3>
                      {getStatusBadge(league.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Users className="w-4 h-4" />
                        <span>{league.settings.numTeams} Teams</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <DollarSign className="w-4 h-4" />
                        <span>${league.settings.budgetPerTeam} Budget</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(league.lastModified).toLocaleDateString()}</span>
                      </div>
                      <div className="text-slate-400">
                        <span className="capitalize">{league.settings.scoringType.replace(/-/g, ' ')}</span>
                      </div>
                    </div>

                    {league.settings.couchManagerRoomId && (
                      <div className="text-sm text-slate-500">
                        Room ID: {league.settings.couchManagerRoomId}
                      </div>
                    )}

                    {league.status === 'drafting' && (
                      <div className="mt-2 text-sm text-yellow-400">
                        Draft in progress - {league.players.filter(p => p.status !== 'available').length} players drafted
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => onContinueDraft(league)}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-lg hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2"
                    >
                      {league.status === 'complete' ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          View Results
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          {league.status === 'drafting' ? 'Continue Draft' : 'Start Draft'}
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${league.leagueName}"?`)) {
                          onDeleteLeague(league.id);
                        }
                      }}
                      className="px-4 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/30 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-xl text-slate-300 mb-2">No leagues yet</h3>
            <p className="text-slate-500 mb-6">Create your first league to get started</p>
            <button
              onClick={onCreateNew}
              className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New League
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
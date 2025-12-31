import { useState, useEffect } from 'react';
import { SavedLeague, LeagueSettings, SubscriptionInfo, ScrapedAuctionData } from '../lib/types';
import { Plus, Calendar, Users, DollarSign, Trash2, Play, CheckCircle, Settings, User, Crown, Loader2, Pencil } from 'lucide-react';
import { EditLeagueModal } from './EditLeagueModal';
import { fetchAuctionData } from '../lib/auctionApi';
import { useIsMobile } from './ui/use-mobile';

interface LeaguesListProps {
  username: string;
  leagues: SavedLeague[];
  onCreateNew: () => void;
  onContinueDraft: (league: SavedLeague) => void;
  onResumeSetup?: (league: SavedLeague) => void;
  onDeleteLeague: (leagueId: string) => void;
  onEditLeague: (league: SavedLeague) => void;
  onReloadProjections: (league: SavedLeague, newProjectionSystem?: LeagueSettings['projectionSystem']) => Promise<void>;
  onLogout: () => void;
  onAccount: () => void;
  profilePicture?: string;
  subscription?: SubscriptionInfo;
}

// Cache type for room data
interface RoomDataCache {
  [roomId: string]: {
    data: ScrapedAuctionData | null;
    loading: boolean;
    error: string | null;
  };
}

export function LeaguesList({
  username,
  leagues,
  onCreateNew,
  onContinueDraft,
  onResumeSetup,
  onDeleteLeague,
  onEditLeague,
  onReloadProjections,
  onLogout,
  onAccount,
  profilePicture,
  subscription
}: LeaguesListProps) {
  const [editingLeague, setEditingLeague] = useState<SavedLeague | null>(null);
  const [roomDataCache, setRoomDataCache] = useState<RoomDataCache>({});
  const isMobile = useIsMobile();

  // Fetch room data for leagues with Couch Managers room IDs
  useEffect(() => {
    const roomIds = leagues
      .filter(l => l.settings.couchManagerRoomId && l.status === 'drafting')
      .map(l => l.settings.couchManagerRoomId)
      .filter((id, index, arr) => arr.indexOf(id) === index); // unique room IDs

    roomIds.forEach(roomId => {
      // Skip if already cached or loading
      if (roomDataCache[roomId]?.data || roomDataCache[roomId]?.loading) return;

      // Mark as loading
      setRoomDataCache(prev => ({
        ...prev,
        [roomId]: { data: null, loading: true, error: null }
      }));

      // Fetch room data
      fetchAuctionData(roomId)
        .then(data => {
          setRoomDataCache(prev => ({
            ...prev,
            [roomId]: { data, loading: false, error: null }
          }));
        })
        .catch(error => {
          if (import.meta.env.DEV) {
            console.warn(`Failed to fetch room ${roomId} data:`, error);
          }
          setRoomDataCache(prev => ({
            ...prev,
            [roomId]: { data: null, loading: false, error: error.message }
          }));
        });
    });
  }, [leagues]);

  // Helper to get drafted count for a league
  const getDraftedCount = (league: SavedLeague): { count: number; loading: boolean; fromRoom: boolean } => {
    const roomId = league.settings.couchManagerRoomId;

    // If league has a room ID, try to get data from cache
    if (roomId && roomDataCache[roomId]) {
      const cached = roomDataCache[roomId];
      if (cached.loading) {
        return { count: 0, loading: true, fromRoom: true };
      }
      if (cached.data) {
        return { count: cached.data.totalPlayersDrafted, loading: false, fromRoom: true };
      }
    }

    // Fall back to local player data
    const localCount = league.players.filter(p => p.status === 'drafted' || p.status === 'onMyTeam').length;
    return { count: localCount, loading: false, fromRoom: false };
  };

  const getStatusBadge = (status: SavedLeague['status'], compact = false) => {
    const baseClasses = compact
      ? "px-2 py-0.5 rounded text-xs flex items-center gap-1"
      : "px-3 py-1 rounded-lg text-sm flex items-center gap-1";

    switch (status) {
      case 'setup':
        return (
          <span className={`${baseClasses} bg-blue-900/30 text-blue-400 border border-blue-500/30`}>
            Setup
          </span>
        );
      case 'drafting':
        return (
          <span className={`${baseClasses} bg-yellow-900/30 text-yellow-400 border border-yellow-500/30`}>
            <Play className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
            {compact ? 'Active' : 'In Progress'}
          </span>
        );
      case 'complete':
        return (
          <span className={`${baseClasses} bg-emerald-900/30 text-emerald-400 border border-emerald-500/30`}>
            <CheckCircle className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
            Complete
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0d0d0d' }}>
      {/* Animated background orbs - retro colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 rounded-full" style={{ background: 'linear-gradient(135deg, #f59e0b30, #ea580c20, transparent)', filter: 'blur(60px)' }}></div>
        <div className="absolute top-40 right-10 w-80 h-80 rounded-full" style={{ background: 'linear-gradient(225deg, #d946ef20, #9333ea15, transparent)', filter: 'blur(60px)' }}></div>
        <div className="absolute bottom-20 left-1/3 w-72 h-72 rounded-full" style={{ background: 'linear-gradient(45deg, #f43f5e20, transparent)', filter: 'blur(60px)' }}></div>
      </div>

      <div className={`relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${isMobile ? 'py-6' : 'py-12'}`}>
        {/* Header */}
        <div className={`${isMobile ? 'flex flex-col gap-4' : 'flex items-center justify-between'} mb-6 md:mb-8 animate-fadeIn`}>
          <div className="flex items-center gap-3 md:gap-4">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={username}
                className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full border-2`} style={{ borderColor: '#f97316', boxShadow: '0 10px 25px rgba(249, 115, 22, 0.3)' }}
              />
            ) : (
              <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full flex items-center justify-center`} style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316, #f43f5e)', boxShadow: '0 10px 25px rgba(249, 115, 22, 0.3)' }}>
                <User className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-white`} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className={`${isMobile ? 'text-xl' : 'text-4xl'} text-white truncate`}>
                  {isMobile ? `Hi, ${username}!` : `Welcome back, ${username}!`}
                </h1>
                {subscription?.tier === 'premium' && (
                  <span title="Premium Member">
                    <Crown className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-amber-400 flex-shrink-0`} />
                  </span>
                )}
              </div>
              <p className={`text-slate-400 ${isMobile ? 'text-sm' : ''}`}>
                {isMobile ? 'Manage your drafts' : 'Manage your auction drafts'}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'self-end' : 'gap-3'}`}>
            <button
              onClick={onAccount}
              className={`${isMobile ? 'p-2' : 'px-4 py-2'} bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all flex items-center gap-2`}
              title="Account"
            >
              <Settings className="w-4 h-4" />
              {!isMobile && 'Account'}
            </button>
            <button
              onClick={onLogout}
              className={`${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'} bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all`}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Create New League Button */}
        <button
          onClick={onCreateNew}
          className={`w-full ${isMobile ? 'mb-4 p-4' : 'mb-8 p-6'} rounded-2xl transition-all group animate-slideInLeft`} style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316, #f43f5e)', border: '1px solid rgba(249, 115, 22, 0.5)', boxShadow: '0 25px 50px rgba(249, 115, 22, 0.3)' }}
        >
          <div className="flex items-center justify-center gap-3">
            <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-white/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <Plus className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
            </div>
            <div className="text-left">
              <div className={`${isMobile ? 'text-lg' : 'text-xl'} text-white`}>Create New League</div>
              <div className={`text-red-200 ${isMobile ? 'text-sm' : ''}`}>Start a new auction draft</div>
            </div>
          </div>
        </button>

        {/* Leagues List */}
        {leagues.length > 0 ? (
          <div className={`space-y-${isMobile ? '3' : '4'}`}>
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} text-white mb-4`}>Your Leagues</h2>
            {leagues.map((league, index) => (
              <div
                key={league.id}
                className={`rounded-2xl ${isMobile ? 'p-4' : 'p-6'} transition-all shadow-xl backdrop-blur-sm animate-slideInLeft`} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', animationDelay: `${index * 0.1}s` }}
              >
                {isMobile ? (
                  /* MOBILE LAYOUT */
                  <div className="space-y-3">
                    {/* Header row with name and status */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg text-white font-medium leading-tight flex-1 min-w-0 truncate">{league.leagueName}</h3>
                      {getStatusBadge(league.status, true)}
                    </div>

                    {/* Stats row - compact grid */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {league.settings.numTeams} Teams
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${league.settings.budgetPerTeam}
                      </span>
                      <span className="capitalize">{league.settings.scoringType.replace(/-/g, ' ')}</span>
                    </div>

                    {/* Draft status info */}
                    {league.status === 'setup' && league.setupStep && (
                      <div className="text-xs text-blue-400">
                        Step {league.setupStep}/5
                      </div>
                    )}

                    {league.status === 'drafting' && (() => {
                      const { count, loading, fromRoom } = getDraftedCount(league);
                      return (
                        <div className="text-xs text-yellow-400 flex items-center gap-1">
                          {loading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Checking...</span>
                            </>
                          ) : (
                            <>
                              <span>{count} drafted</span>
                              {fromRoom && count > 0 && (
                                <span className="text-emerald-400">(live)</span>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* Action buttons - full width on mobile */}
                    <div className="flex items-center gap-2 pt-2">
                      {league.status === 'setup' && onResumeSetup ? (
                        <button
                          onClick={() => onResumeSetup(league)}
                          className="flex-1 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Resume Setup
                        </button>
                      ) : (
                        <button
                          onClick={() => onContinueDraft(league)}
                          className="flex-1 px-3 py-2.5 bg-gradient-to-r from-emerald-600 to-green-700 text-white text-sm rounded-lg hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                        >
                          {league.status === 'complete' ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              View Results
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Continue
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => setEditingLeague(league)}
                        className="p-2.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:bg-blue-900/30 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                        title="Edit"
                      >
                        <Settings className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${league.leagueName}"?`)) {
                            onDeleteLeague(league.id);
                          }
                        }}
                        className="p-2.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/30 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* DESKTOP LAYOUT */
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

                      {league.status === 'setup' && league.setupStep && (
                        <div className="mt-2 text-sm text-blue-400">
                          Setup in progress - Step {league.setupStep} of 5
                        </div>
                      )}

                      {league.status === 'drafting' && (() => {
                        const { count, loading, fromRoom } = getDraftedCount(league);
                        return (
                          <div className="mt-2 text-sm text-yellow-400 flex items-center gap-2">
                            {loading ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Checking draft status...</span>
                              </>
                            ) : (
                              <>
                                <span>Draft in progress - {count} players drafted</span>
                                {fromRoom && count > 0 && (
                                  <span className="text-emerald-400 text-xs">(live from room)</span>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {league.status === 'setup' && onResumeSetup ? (
                        <button
                          onClick={() => onResumeSetup(league)}
                          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Resume Setup
                        </button>
                      ) : (
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
                              Continue Draft
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => setEditingLeague(league)}
                        className="px-4 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:bg-blue-900/30 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                        title="Edit league settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${league.leagueName}"?`)) {
                            onDeleteLeague(league.id);
                          }
                        }}
                        className="px-4 py-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/30 transition-all"
                        title="Delete league"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-xl text-slate-300 mb-2">No leagues yet</h3>
            <p className="text-slate-500 mb-6">Create your first league to get started</p>
            <button
              onClick={onCreateNew}
              className="px-6 py-3 text-white rounded-lg transition-all inline-flex items-center gap-2" style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316, #f43f5e)', boxShadow: '0 15px 35px rgba(249, 115, 22, 0.3)' }}
            >
              <Plus className="w-4 h-4" />
              Create New League
            </button>
          </div>
        )}
      </div>

      {/* Edit League Modal */}
      {editingLeague && (
        <EditLeagueModal
          league={editingLeague}
          isOpen={!!editingLeague}
          onClose={() => setEditingLeague(null)}
          onSave={(updatedLeague) => {
            onEditLeague(updatedLeague);
            setEditingLeague(null);
          }}
          onReloadProjections={async (league, newProjectionSystem) => {
            await onReloadProjections(league, newProjectionSystem);
            setEditingLeague(null);
          }}
        />
      )}
    </div>
  );
}
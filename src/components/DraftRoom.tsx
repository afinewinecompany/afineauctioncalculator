import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LeagueSettings, Player, SyncState, AuctionSyncResult, MatchedPlayer, PositionalScarcity, EnhancedInflationStats } from '../lib/types';
import { calculateTierWeightedInflation, adjustPlayerValuesWithTiers, InflationResult } from '../lib/calculations';
import { syncAuctionLite } from '../lib/auctionApi';
import { DraftHeader } from './DraftHeader';
import { PlayerQueue } from './PlayerQueue';
import { RosterPanel } from './RosterPanel';
import { InflationTracker } from './InflationTracker';
import { PlayerDetailModal } from './PlayerDetailModal';
import { Loader2 } from 'lucide-react';

// Sync interval: 2 minutes
const SYNC_INTERVAL_MS = 2 * 60 * 1000;

interface DraftRoomProps {
  settings: LeagueSettings;
  players: Player[];
  onComplete: () => void;
}

// Loading overlay component - renders on top of heavily blurred draft room
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl">
      {/* Animated background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-400/10 rounded-full blur-2xl animate-ping" style={{ animationDuration: '3s' }} />
      </div>

      {/* Main loading content card */}
      <div className="relative flex flex-col items-center px-16 py-12 rounded-3xl bg-slate-900/95 border border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
        {/* Large animated circular spinner */}
        <div className="relative w-40 h-40 mb-8">
          {/* Outer glow ring */}
          <div className="absolute -inset-2 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />

          {/* Outer static ring */}
          <div className="absolute inset-0 rounded-full border-4 border-slate-600/50" />

          {/* Primary spinning ring - thick and visible */}
          <div className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-emerald-500 border-r-emerald-400/50 animate-spin" style={{ animationDuration: '1.2s' }} />

          {/* Secondary spinning ring */}
          <div className="absolute inset-3 rounded-full border-4 border-transparent border-b-emerald-400 border-l-emerald-300/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />

          {/* Middle pulsing ring */}
          <div className="absolute inset-6 rounded-full border-2 border-emerald-500/30 animate-ping" style={{ animationDuration: '1.5s' }} />

          {/* Inner spinning ring */}
          <div className="absolute inset-8 rounded-full border-2 border-transparent border-t-emerald-300 animate-spin" style={{ animationDuration: '0.6s' }} />

          {/* Orbiting dots - larger and more visible */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute inset-0 animate-spin"
              style={{ animationDuration: '3s', animationDelay: `${i * 0.3}s` }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/60"
                style={{ opacity: 1 - (i * 0.15) }}
              />
            </div>
          ))}

          {/* Center icon - larger */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-md animate-pulse" />
              <Loader2 className="relative w-12 h-12 text-emerald-400 animate-spin" style={{ animationDuration: '1s' }} />
            </div>
          </div>
        </div>

        {/* Loading text - larger and more prominent */}
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-400 mb-3 animate-pulse">
          Connecting to Draft Room
        </h2>

        {/* Status message - larger */}
        <p className="text-emerald-400 text-lg mb-2 font-medium">{message}</p>

        {/* Detailed status hint */}
        <p className="text-slate-400 text-sm mb-6">Please wait while we sync your auction data...</p>

        {/* Progress bar animation */}
        <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 rounded-full animate-loading-progress" />
        </div>

        {/* Wave animation dots - larger */}
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-emerald-500 rounded-full animate-loading-wave"
              style={{
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Don't leave message */}
        <p className="text-slate-500 text-xs mt-6 animate-pulse">
          Do not leave this page
        </p>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes loading-wave {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-12px) scale(1.3);
            opacity: 1;
          }
        }
        .animate-loading-wave {
          animation: loading-wave 1s ease-in-out infinite;
        }
        @keyframes loading-progress {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 60%;
            margin-left: 20%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
        .animate-loading-progress {
          animation: loading-progress 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export function DraftRoom({ settings, players: initialPlayers, onComplete }: DraftRoomProps) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [myRoster, setMyRoster] = useState<Player[]>([]);
  const [allDrafted, setAllDrafted] = useState<Player[]>([]);
  const [inflationRate, setInflationRate] = useState(0);
  const [rosterNeedsRemaining, setRosterNeedsRemaining] = useState(settings.rosterSpots);
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<Player | null>(null);

  // Team selection for "My Team"
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Initial loading state - show loading screen until first sync completes
  const [isInitialLoading, setIsInitialLoading] = useState(!!settings.couchManagerRoomId);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');

  // Couch Managers sync state
  const [syncState, setSyncState] = useState<SyncState>({
    isConnected: false,
    lastSyncAt: null,
    syncError: null,
    isSyncing: false,
  });
  const [syncResult, setSyncResult] = useState<AuctionSyncResult | null>(null);
  const [liveInflationStats, setLiveInflationStats] = useState<EnhancedInflationStats | null>(null);
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);
  const isFirstSyncRef = useRef(true);

  const moneySpent = myRoster.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
  const moneyRemaining = settings.budgetPerTeam - moneySpent;

  // Sync with Couch Managers - stable callback that doesn't depend on players state
  const performSync = useCallback(async () => {
    if (!settings.couchManagerRoomId) return;

    // Prevent concurrent syncs
    if (isSyncingRef.current) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    const isFirstSync = isFirstSyncRef.current;
    isFirstSyncRef.current = false;

    isSyncingRef.current = true;
    setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

    if (isFirstSync) {
      setLoadingMessage('Connecting to Couch Managers...');
    }

    try {
      if (isFirstSync) {
        setLoadingMessage('Scraping auction data...');
      }

      // Use lightweight sync that uses server-cached projections
      // This sends only ~200 bytes instead of ~800KB
      const result = await syncAuctionLite(settings.couchManagerRoomId, settings);
      setSyncResult(result);
      // Cast to EnhancedInflationStats since the server now returns enhanced data
      setLiveInflationStats(result.inflationStats as EnhancedInflationStats);

      if (isFirstSync) {
        setLoadingMessage('Processing player data...');
      }

      // Extract team names - try from teams array first, then fallback to drafted players
      let teamNames = result.auctionData.teams.map(t => t.name).filter(n => n && n.trim());

      // Fallback: extract unique team names from drafted players' winningTeam
      if (teamNames.length === 0) {
        const teamsFromDrafted = new Set<string>();
        result.auctionData.players.forEach(p => {
          if (p.status === 'drafted' && p.winningTeam) {
            teamsFromDrafted.add(p.winningTeam);
          }
        });
        // Also check matched players
        result.matchedPlayers.forEach(mp => {
          if (mp.scrapedPlayer.status === 'drafted' && mp.scrapedPlayer.winningTeam) {
            teamsFromDrafted.add(mp.scrapedPlayer.winningTeam);
          }
        });
        teamNames = Array.from(teamsFromDrafted).sort();
      }

      // DEBUG: Log team names and drafted players to diagnose team selection issue
      console.log('[DraftRoom] Available teams:', teamNames);
      console.log('[DraftRoom] Drafted players sample:', result.matchedPlayers
        .filter(mp => mp.scrapedPlayer.status === 'drafted')
        .slice(0, 5)
        .map(mp => ({
          name: mp.scrapedPlayer.fullName,
          winningTeam: mp.scrapedPlayer.winningTeam,
          draftedBy: mp.scrapedPlayer.winningTeam || 'Unknown'
        }))
      );

      setAvailableTeams(teamNames);

      // Build lookup map for matched players (by projection ID)
      const matchedByProjectionId = new Map<string, MatchedPlayer>();
      result.matchedPlayers.forEach(mp => {
        if (mp.projectionPlayerId) {
          matchedByProjectionId.set(mp.projectionPlayerId, mp);
        }
      });

      // Update players state with drafted info and build drafted list
      // IMPORTANT: Reset ALL players to their correct status based on current scrape data
      setPlayers(prevPlayers => {
        const updatedPlayers = prevPlayers.map(p => {
          const matched = matchedByProjectionId.get(p.id);
          if (matched) {
            if (matched.scrapedPlayer.status === 'drafted') {
              return {
                ...p,
                status: 'drafted' as const,
                draftedPrice: matched.scrapedPlayer.winningBid,
                draftedBy: matched.scrapedPlayer.winningTeam || 'Unknown',
                // Clear on_block fields
                currentBid: undefined,
                currentBidder: undefined,
              };
            } else if (matched.scrapedPlayer.status === 'on_block') {
              // Player is currently being auctioned - mark as on_block with current bid info
              return {
                ...p,
                status: 'on_block' as const,
                currentBid: result.auctionData.currentAuction?.currentBid,
                currentBidder: result.auctionData.currentAuction?.currentBidder,
                // Clear drafted fields
                draftedPrice: undefined,
                draftedBy: undefined,
              };
            } else {
              // Player is available (not drafted, not on_block) - reset to available
              // This handles players who were previously on_block but are now available again
              return {
                ...p,
                status: 'available' as const,
                // Clear all auction-related fields
                draftedPrice: undefined,
                draftedBy: undefined,
                currentBid: undefined,
                currentBidder: undefined,
              };
            }
          }
          // No match found - if player was on_block, reset to available
          // (the player might have been on_block but is no longer in the scraped data)
          if (p.status === 'on_block') {
            return {
              ...p,
              status: 'available' as const,
              currentBid: undefined,
              currentBidder: undefined,
            };
          }
          return p;
        });
        return updatedPlayers;
      });

      // Build the allDrafted list from matched players who are drafted
      const draftedPlayers: Player[] = [];
      result.matchedPlayers.forEach(mp => {
        if (mp.scrapedPlayer.status === 'drafted' && mp.projectionPlayerId) {
          // Find the player from initialPlayers to get full player data
          const basePlayer = initialPlayers.find(p => p.id === mp.projectionPlayerId);
          if (basePlayer) {
            draftedPlayers.push({
              ...basePlayer,
              status: 'drafted' as const,
              draftedPrice: mp.scrapedPlayer.winningBid,
              draftedBy: mp.scrapedPlayer.winningTeam || 'Unknown',
            });
          }
        }
      });
      setAllDrafted(draftedPlayers);

      setSyncState(prev => ({
        ...prev,
        isConnected: true,
        lastSyncAt: new Date().toISOString(),
        isSyncing: false,
      }));

      // Clear initial loading after first successful sync
      if (isFirstSync) {
        setLoadingMessage('Ready!');
        // Small delay for smooth transition
        setTimeout(() => setIsInitialLoading(false), 300);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncState(prev => ({
        ...prev,
        syncError: error instanceof Error ? error.message : 'Sync failed',
        isSyncing: false,
      }));
      // On first sync failure, still dismiss loading but show error state
      if (isFirstSync) {
        setIsInitialLoading(false);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [settings, initialPlayers]); // Depends on settings and initialPlayers

  // Auto-sync on mount and every 2 minutes if roomId is set
  useEffect(() => {
    if (!settings.couchManagerRoomId) {
      setIsInitialLoading(false);
      return;
    }

    // Initial sync with small delay to let component mount
    const initialSyncTimeout = setTimeout(performSync, 300);

    // Set up interval
    syncIntervalRef.current = window.setInterval(performSync, SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(initialSyncTimeout);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [settings.couchManagerRoomId, performSync]);

  // Recalculate tier-weighted inflation whenever players are drafted
  // Use initialPlayers (not players) to avoid circular dependency
  // We only need the original projected values and tier info for inflation calculation
  // Merge server-side enhanced data (positional scarcity, team constraints) when available
  const inflationResult: InflationResult = useMemo(() => {
    // Create a view of players with updated status based on allDrafted
    const draftedIds = new Set(allDrafted.map(p => p.id));
    const playersWithStatus = initialPlayers.map(p => ({
      ...p,
      status: draftedIds.has(p.id) ? ('drafted' as const) : ('available' as const),
    }));
    const baseResult = calculateTierWeightedInflation(settings, allDrafted, playersWithStatus);

    // Merge in server-side enhanced data if available
    if (liveInflationStats) {
      return {
        ...baseResult,
        positionalScarcity: liveInflationStats.positionalScarcity,
        teamConstraints: liveInflationStats.teamConstraints,
        leagueEffectiveBudget: liveInflationStats.leagueEffectiveBudget,
        adjustedRemainingBudget: liveInflationStats.adjustedRemainingBudget,
      };
    }

    return baseResult;
  }, [allDrafted, initialPlayers, settings, liveInflationStats]);

  // Update inflation rate state only when it changes
  useEffect(() => {
    setInflationRate(inflationResult.overallInflationRate);
  }, [inflationResult.overallInflationRate]);

  // Adjust player values based on inflation and status
  // Key change: drafted players get their actual price, available players get inflation-adjusted values
  // This only runs when inflationResult changes (which depends on allDrafted, not players)
  useEffect(() => {
    setPlayers(prevPlayers => adjustPlayerValuesWithTiers(prevPlayers, inflationResult));
  }, [inflationResult]);

  // Update roster needs
  useEffect(() => {
    const needs = { ...settings.rosterSpots };
    myRoster.forEach(player => {
      player.positions.forEach(pos => {
        if (pos in needs && needs[pos as keyof typeof needs] > 0) {
          needs[pos as keyof typeof needs]--;
        }
      });
    });
    setRosterNeedsRemaining(needs);
  }, [myRoster, settings.rosterSpots]);

  // Update myRoster when selectedTeam changes
  useEffect(() => {
    if (!selectedTeam) {
      setMyRoster([]);
      return;
    }
    // Filter allDrafted to get players drafted by the selected team
    const teamPlayers = allDrafted.filter(p => p.draftedBy === selectedTeam);

    // DEBUG: Log team selection and filtering
    console.log('[DraftRoom] Selected team:', selectedTeam);
    console.log('[DraftRoom] All drafted players:', allDrafted.map(p => ({
      name: p.name,
      draftedBy: p.draftedBy,
      matchesSelected: p.draftedBy === selectedTeam
    })));
    console.log('[DraftRoom] Filtered team players:', teamPlayers.length, 'players');

    setMyRoster(teamPlayers);
  }, [selectedTeam, allDrafted]);

  // Handler for team selection
  const handleTeamSelect = useCallback((teamName: string) => {
    setSelectedTeam(teamName);
    // Save to localStorage for persistence
    localStorage.setItem(`selectedTeam-${settings.couchManagerRoomId}`, teamName);
  }, [settings.couchManagerRoomId]);

  // Load saved team selection on mount
  useEffect(() => {
    if (settings.couchManagerRoomId) {
      const savedTeam = localStorage.getItem(`selectedTeam-${settings.couchManagerRoomId}`);
      if (savedTeam) {
        setSelectedTeam(savedTeam);
      }
    }
  }, [settings.couchManagerRoomId]);

  const handleDraftPlayer = (player: Player, price: number, draftedBy: 'me' | 'other') => {
    const draftedPlayer: Player = {
      ...player,
      status: draftedBy === 'me' ? 'onMyTeam' : 'drafted',
      draftedPrice: price,
      draftedBy: draftedBy === 'me' ? 'My Team' : 'Opponent'
    };

    // Update players list
    setPlayers(prevPlayers =>
      prevPlayers.map(p =>
        p.id === player.id
          ? draftedPlayer
          : p
      )
    );

    // Update rosters
    if (draftedBy === 'me') {
      setMyRoster(prev => [...prev, draftedPlayer]);
    }
    setAllDrafted(prev => [...prev, draftedPlayer]);
  };

  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const isDraftComplete = myRoster.length >= totalRosterSpots;

  return (
    <div className="relative flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 h-screen overflow-hidden">
      {/* Loading overlay - appears on top of blurred draft room */}
      {isInitialLoading && <LoadingOverlay message={loadingMessage} />}
      {/* Header */}
      <DraftHeader
        settings={settings}
        moneyRemaining={moneyRemaining}
        rosterNeedsRemaining={rosterNeedsRemaining}
        totalDrafted={allDrafted.length}
        inflationRate={inflationRate}
      />

      {/* Main Content - scrollable container */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-4 p-4 pb-6">
          {/* Top Section - Player Queue & Roster Panel */}
          <div className="grid grid-cols-12 gap-4" style={{ minHeight: '55vh' }}>
            {/* Left Panel - Player Queue (primary focus area) */}
            <div className="col-span-8 bg-slate-900/95 rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col">
              <PlayerQueue
                players={players}
                onPlayerClick={setSelectedPlayerForDetail}
                positionalScarcity={inflationResult.positionalScarcity}
              />
            </div>

            {/* Right Panel - My Roster */}
            <div className="col-span-4 flex flex-col">
              <RosterPanel
                roster={myRoster}
                settings={settings}
                rosterNeedsRemaining={rosterNeedsRemaining}
                availableTeams={availableTeams}
                selectedTeam={selectedTeam}
                onTeamSelect={handleTeamSelect}
              />
            </div>
          </div>

          {/* Bottom Section - Full Width Inflation Tracker */}
          <div className="w-full">
            <InflationTracker
              settings={settings}
              allDrafted={allDrafted}
              inflationRate={inflationRate}
              inflationResult={inflationResult}
              syncState={syncState}
              liveInflationStats={liveInflationStats}
              currentAuction={syncResult?.auctionData.currentAuction}
              onManualSync={performSync}
            />
          </div>
        </div>
      </div>

      {/* Complete Draft Button */}
      {isDraftComplete && (
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700/50">
          <div className="max-w-4xl mx-auto">
            <div className="p-4 bg-gradient-to-r from-emerald-900/50 to-green-900/50 border border-emerald-500/50 rounded-xl flex items-center justify-between backdrop-blur-sm animate-pulse-slow">
              <div>
                <div className="text-emerald-300">
                  Your roster is complete! You've drafted all {totalRosterSpots} players.
                </div>
                <div className="text-emerald-400">
                  Total spent: ${moneySpent} of ${settings.budgetPerTeam}
                </div>
              </div>
              <button
                onClick={onComplete}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-lg hover:from-emerald-700 hover:to-green-800 transition-all shadow-lg shadow-emerald-500/30"
              >
                View Draft Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Detail Modal */}
      <PlayerDetailModal
        player={selectedPlayerForDetail}
        onClose={() => setSelectedPlayerForDetail(null)}
      />
    </div>
  );
}

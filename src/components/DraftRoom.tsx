import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LeagueSettings, Player, SyncState, AuctionSyncResult, MatchedPlayer } from '../lib/types';
import { calculateInflation } from '../lib/calculations';
import { syncAuctionLite } from '../lib/auctionApi';
import { DraftHeader } from './DraftHeader';
import { PlayerQueue } from './PlayerQueue';
import { RosterPanel } from './RosterPanel';
import { InflationTracker } from './InflationTracker';
import { PlayerDetailModal } from './PlayerDetailModal';

// Sync interval: 2 minutes
const SYNC_INTERVAL_MS = 2 * 60 * 1000;

interface DraftRoomProps {
  settings: LeagueSettings;
  players: Player[];
  onComplete: () => void;
}

export function DraftRoom({ settings, players: initialPlayers, onComplete }: DraftRoomProps) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [myRoster, setMyRoster] = useState<Player[]>([]);
  const [allDrafted, setAllDrafted] = useState<Player[]>([]);
  const [inflationRate, setInflationRate] = useState(0);
  const [rosterNeedsRemaining, setRosterNeedsRemaining] = useState(settings.rosterSpots);
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<Player | null>(null);

  // Couch Managers sync state
  const [syncState, setSyncState] = useState<SyncState>({
    isConnected: false,
    lastSyncAt: null,
    syncError: null,
    isSyncing: false,
  });
  const [syncResult, setSyncResult] = useState<AuctionSyncResult | null>(null);
  const [liveInflationStats, setLiveInflationStats] = useState<AuctionSyncResult['inflationStats'] | null>(null);
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

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

    isSyncingRef.current = true;
    setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      // Use lightweight sync that uses server-cached projections
      // This sends only ~200 bytes instead of ~800KB
      const result = await syncAuctionLite(settings.couchManagerRoomId, settings);
      setSyncResult(result);
      setLiveInflationStats(result.inflationStats);

      // Build lookup map for matched players
      const matchedByProjectionId = new Map<string, MatchedPlayer>();
      result.matchedPlayers.forEach(mp => {
        if (mp.projectionPlayerId) {
          matchedByProjectionId.set(mp.projectionPlayerId, mp);
        }
      });

      // Batch update: update player statuses and build drafted list in one pass
      const draftedFromSync: Player[] = [];

      setPlayers(prevPlayers => {
        return prevPlayers.map(p => {
          const matched = matchedByProjectionId.get(p.id);
          if (matched && matched.scrapedPlayer.status === 'drafted') {
            const updatedPlayer: Player = {
              ...p,
              status: 'drafted' as const,
              draftedPrice: matched.scrapedPlayer.winningBid,
              draftedBy: matched.scrapedPlayer.winningTeam || 'Unknown',
            };
            draftedFromSync.push(updatedPlayer);
            return updatedPlayer;
          }
          return p;
        });
      });

      // Only update allDrafted if there are changes
      if (draftedFromSync.length > 0) {
        setAllDrafted(draftedFromSync);
      }

      setSyncState(prev => ({
        ...prev,
        isConnected: true,
        lastSyncAt: new Date().toISOString(),
        isSyncing: false,
      }));
    } catch (error) {
      console.error('Sync error:', error);
      setSyncState(prev => ({
        ...prev,
        syncError: error instanceof Error ? error.message : 'Sync failed',
        isSyncing: false,
      }));
    } finally {
      isSyncingRef.current = false;
    }
  }, [settings]); // Only depends on settings, not players

  // Auto-sync on mount and every 2 minutes if roomId is set
  useEffect(() => {
    if (!settings.couchManagerRoomId) return;

    // Initial sync with small delay to let component mount
    const initialSyncTimeout = setTimeout(performSync, 500);

    // Set up interval
    syncIntervalRef.current = window.setInterval(performSync, SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(initialSyncTimeout);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [settings.couchManagerRoomId, performSync]);

  // Recalculate inflation whenever players are drafted - separate from player value updates
  const calculatedInflationRate = useMemo(() => {
    return calculateInflation(settings, allDrafted);
  }, [allDrafted, settings]);

  // Update inflation rate state only when it changes
  useEffect(() => {
    setInflationRate(calculatedInflationRate);
  }, [calculatedInflationRate]);

  // Adjust player values based on inflation - debounced to prevent rapid updates
  useEffect(() => {
    if (calculatedInflationRate === 0) return;

    const timeoutId = setTimeout(() => {
      setPlayers(prevPlayers =>
        prevPlayers.map(p => ({
          ...p,
          adjustedValue: Math.round(p.projectedValue * (1 + calculatedInflationRate))
        }))
      );
    }, 100); // Small debounce to batch rapid changes

    return () => clearTimeout(timeoutId);
  }, [calculatedInflationRate]);

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
    <div className="flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950" style={{ height: 'calc(100vh - 57px)' }}>
      {/* Header */}
      <DraftHeader
        settings={settings}
        moneyRemaining={moneyRemaining}
        rosterNeedsRemaining={rosterNeedsRemaining}
        totalDrafted={allDrafted.length}
        inflationRate={inflationRate}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4 p-4">
          {/* Left Panel - Player Queue */}
          <div className="col-span-8 bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 animate-fadeIn">
            <PlayerQueue
              players={players}
              onDraftPlayer={handleDraftPlayer}
              onPlayerClick={setSelectedPlayerForDetail}
            />
          </div>

          {/* Right Panel - My Roster & Inflation */}
          <div className="col-span-4 space-y-4 animate-slideInLeft">
            <RosterPanel
              roster={myRoster}
              settings={settings}
              rosterNeedsRemaining={rosterNeedsRemaining}
            />
            
            <InflationTracker
              settings={settings}
              allDrafted={allDrafted}
              inflationRate={inflationRate}
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
                  ✓ Your roster is complete! You've drafted all {totalRosterSpots} players.
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
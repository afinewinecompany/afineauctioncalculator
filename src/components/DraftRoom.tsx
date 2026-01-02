import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LeagueSettings, Player, SyncState, AuctionSyncResult, MatchedPlayer, PositionalScarcity, EnhancedInflationStats, ScrapedPlayer } from '../lib/types';
import { calculateTierWeightedInflation, adjustPlayerValuesWithTiers, InflationResult, normalizeName } from '../lib/calculations';
import { syncAuctionLite } from '../lib/auctionApi';
import { selectTeam as apiSelectTeam, getNotificationSettings } from '../lib/notificationsApi';
import { DraftHeader } from './DraftHeader';
import { PlayerQueue } from './PlayerQueue';
import { RosterPanel } from './RosterPanel';
import { InflationTracker } from './InflationTracker';
import { PlayerDetailModal } from './PlayerDetailModal';
import { DraftRoomLoadingScreen } from './DraftRoomLoadingScreen';
import { useIsMobile } from './ui/use-mobile';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Users, ListFilter } from 'lucide-react';

// Timing constants
const SYNC_INTERVAL_MS = 2 * 60 * 1000; // Sync interval: 2 minutes
const INITIAL_SYNC_DELAY_MS = 300; // Delay before first sync to let component mount
const LOADING_TRANSITION_DELAY_MS = 300; // Delay for smooth loading transition

// Buffer for draft pool size (extra players beyond roster needs for variance)
const DRAFT_POOL_BUFFER = 150;

interface DraftRoomProps {
  settings: LeagueSettings;
  players: Player[];
  onComplete: () => void;
}


export function DraftRoom({ settings, players: initialPlayers, onComplete }: DraftRoomProps) {
  const { isAuthenticated } = useAuth();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [myRoster, setMyRoster] = useState<Player[]>([]);
  const [allDrafted, setAllDrafted] = useState<Player[]>([]);
  const [inflationRate, setInflationRate] = useState(0);
  const [rosterNeedsRemaining, setRosterNeedsRemaining] = useState(settings.rosterSpots);
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<Player | null>(null);

  // Mobile detection and tab state
  const isMobile = useIsMobile();
  const [mobileActiveTab, setMobileActiveTab] = useState<'players' | 'roster'>('players');

  // Calculate max players to show in queue (draft pool size + buffer)
  // This prevents MiLB prospects from appearing - they won't be in top projections
  const maxPlayersInQueue = useMemo(() => {
    const rs = settings.rosterSpots;
    const totalRosterSpots = rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
      rs.OF + rs.CI + rs.MI + rs.UTIL +
      rs.SP + rs.RP + rs.P + rs.Bench;
    return settings.numTeams * totalRosterSpots + DRAFT_POOL_BUFFER;
  }, [settings]);

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
  const isMountedRef = useRef(true);

  const moneySpent = myRoster.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
  const moneyRemaining = settings.budgetPerTeam - moneySpent;

  // Sync with Couch Managers - stable callback that doesn't depend on players state
  const performSync = useCallback(async () => {
    if (!settings.couchManagerRoomId) {
      if (import.meta.env.DEV) {
        console.log('[DraftRoom] No couchManagerRoomId set, skipping sync');
      }
      return;
    }
    if (import.meta.env.DEV) {
      console.log(`[DraftRoom] Starting sync for room ${settings.couchManagerRoomId}`);
    }

    // Prevent concurrent syncs
    if (isSyncingRef.current) {
      if (import.meta.env.DEV) {
        console.log('Sync already in progress, skipping...');
      }
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
      if (import.meta.env.DEV) {
        console.log(`[DraftRoom] Calling syncAuctionLite for room ${settings.couchManagerRoomId}`);
      }
      const result = await syncAuctionLite(settings.couchManagerRoomId, settings);

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        if (import.meta.env.DEV) {
          console.log('[DraftRoom] Component unmounted during sync, discarding results');
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.log(`[DraftRoom] Sync successful! Matched ${result.matchedPlayers.length} players, ${result.auctionData.players.filter(p => p.status === 'drafted').length} drafted`);
      }
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
      if (import.meta.env.DEV) {
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
      }

      setAvailableTeams(teamNames);

      // Build lookup map for matched players (by projection ID)
      const matchedByProjectionId = new Map<string, MatchedPlayer>();
      result.matchedPlayers.forEach(mp => {
        if (mp.projectionPlayerId) {
          matchedByProjectionId.set(mp.projectionPlayerId, mp);
        }
      });

      // Build lookup map by normalized name+team for two-way player matching
      // Two-way players like Ohtani may have different projection IDs for hitter/pitcher
      // but we need to match them to the combined frontend player
      // Use normalizeName to handle diacritics (e.g., "Félix" → "felix")
      const matchedByNameTeam = new Map<string, MatchedPlayer>();
      result.matchedPlayers.forEach(mp => {
        if (mp.scrapedPlayer.status === 'drafted' || mp.scrapedPlayer.status === 'on_block') {
          const key = `${normalizeName(mp.scrapedPlayer.fullName)}|${mp.scrapedPlayer.mlbTeam.toLowerCase().trim()}`;
          // Only add if not already present (prefer first match which has higher priority from sorting)
          if (!matchedByNameTeam.has(key)) {
            matchedByNameTeam.set(key, mp);
          }
        }
      });

      // Also build a lookup from unmatchedPlayers - these are players the server couldn't match
      // to projections, but we might still be able to match them on the frontend by name
      const unmatchedByNameTeam = new Map<string, ScrapedPlayer>();
      if (result.unmatchedPlayers) {
        result.unmatchedPlayers.forEach(up => {
          if (up.status === 'drafted' || up.status === 'on_block') {
            const key = `${normalizeName(up.fullName)}|${up.mlbTeam.toLowerCase().trim()}`;
            if (!unmatchedByNameTeam.has(key)) {
              unmatchedByNameTeam.set(key, up);
            }
          }
        });
      }

      // OHTANI SPECIAL HANDLING: Find Ohtani specifically in the scraped players
      // This is needed because Ohtani has separate hitter/pitcher projections with different IDs,
      // but the frontend combines them into a single player. The server may return a different
      // projectionPlayerId than what we use on the frontend.
      // Also check unmatchedPlayers - Ohtani might fail normal matching due to position type issues.
      let ohtaniMatch: MatchedPlayer | null = null;
      let ohtaniScrapedData: ScrapedPlayer | null = null;

      // First check matchedPlayers
      result.matchedPlayers.forEach(mp => {
        const name = mp.scrapedPlayer.fullName.toLowerCase();
        if ((name.includes('ohtani') || name.includes('shohei')) &&
            (mp.scrapedPlayer.status === 'drafted' || mp.scrapedPlayer.status === 'on_block')) {
          ohtaniMatch = mp;
          ohtaniScrapedData = mp.scrapedPlayer;
          if (import.meta.env.DEV) {
            console.log('[DraftRoom] Found Ohtani in matchedPlayers:', {
              name: mp.scrapedPlayer.fullName,
              status: mp.scrapedPlayer.status,
              winningBid: mp.scrapedPlayer.winningBid,
              projectionPlayerId: mp.projectionPlayerId,
            });
          }
        }
      });

      // If not found in matchedPlayers, check unmatchedPlayers (scraped but couldn't match to projection)
      if (!ohtaniScrapedData && result.unmatchedPlayers) {
        result.unmatchedPlayers.forEach(up => {
          const name = up.fullName.toLowerCase();
          if ((name.includes('ohtani') || name.includes('shohei')) &&
              (up.status === 'drafted' || up.status === 'on_block')) {
            ohtaniScrapedData = up;
            // Create a synthetic MatchedPlayer for Ohtani
            ohtaniMatch = {
              scrapedPlayer: up,
              projectionPlayerId: null, // We'll match by name on frontend
              projectedValue: 0, // Will be filled from frontend player
              actualBid: up.winningBid ?? null,
              inflationAmount: null,
              inflationPercent: null,
              matchConfidence: 'partial' as const,
            };
            if (import.meta.env.DEV) {
              console.log('[DraftRoom] Found Ohtani in unmatchedPlayers (creating synthetic match):', {
                name: up.fullName,
                status: up.status,
                winningBid: up.winningBid,
                positions: up.positions,
              });
            }
          }
        });
      }

      // Also check the raw auctionData.players in case Ohtani wasn't even in matchedPlayers or unmatchedPlayers
      if (!ohtaniScrapedData) {
        result.auctionData.players.forEach(p => {
          const name = p.fullName.toLowerCase();
          if ((name.includes('ohtani') || name.includes('shohei')) &&
              (p.status === 'drafted' || p.status === 'on_block')) {
            ohtaniScrapedData = p;
            ohtaniMatch = {
              scrapedPlayer: p,
              projectionPlayerId: null,
              projectedValue: 0,
              actualBid: p.winningBid ?? null,
              inflationAmount: null,
              inflationPercent: null,
              matchConfidence: 'partial' as const,
            };
            if (import.meta.env.DEV) {
              console.log('[DraftRoom] Found Ohtani in raw auctionData.players (creating synthetic match):', {
                name: p.fullName,
                status: p.status,
                winningBid: p.winningBid,
                positions: p.positions,
              });
            }
          }
        });
      }

      // DEBUG: Log unmatched drafted players to diagnose sync issues
      if (import.meta.env.DEV) {
        const unmatchedDrafted = result.auctionData.players
          .filter(p => p.status === 'drafted')
          .filter(p => !result.matchedPlayers.some(mp => mp.scrapedPlayer.couchManagersId === p.couchManagersId && mp.projectionPlayerId));
        if (unmatchedDrafted.length > 0) {
          console.warn('[DraftRoom] WARNING: Drafted players not matched to projections:',
            unmatchedDrafted.map(p => ({ name: p.fullName, team: p.mlbTeam, cmId: p.couchManagersId })));
        }

        // DEBUG: Log on_block players from scrape
        const onBlockScraped = result.auctionData.players.filter(p => p.status === 'on_block');
        const onBlockMatched = result.matchedPlayers.filter(mp => mp.scrapedPlayer.status === 'on_block');

        // Find on_block players that were scraped but NOT matched to projections
        const matchedCmIds = new Set(onBlockMatched.map(mp => mp.scrapedPlayer.couchManagersId));
        const unmatchedOnBlock = onBlockScraped.filter(p => !matchedCmIds.has(p.couchManagersId));

        console.log('[DraftRoom] ON_BLOCK DEBUG from sync:', {
          scrapedOnBlockCount: onBlockScraped.length,
          matchedOnBlockCount: onBlockMatched.length,
          unmatchedOnBlockCount: unmatchedOnBlock.length,
          unmatchedOnBlock: unmatchedOnBlock.map(p => ({
            name: p.fullName,
            team: p.mlbTeam,
            positions: p.positions,
            cmId: p.couchManagersId,
            normalizedName: normalizeName(p.fullName),
          })),
          matchedOnBlock: onBlockMatched.map(mp => ({
            scrapedName: mp.scrapedPlayer.fullName,
            projectionId: mp.projectionPlayerId,
            currentBid: mp.scrapedPlayer.winningBid
          })),
        });

        // If there are unmatched on_block players, they won't show up correctly!
        if (unmatchedOnBlock.length > 0) {
          console.warn('[DraftRoom] WARNING: These on_block players have NO projection match and may not display correctly:',
            unmatchedOnBlock.map(p => `${p.fullName} (${p.mlbTeam}) - positions: ${p.positions.join(', ')}`));
        }
      }

      // Update players state with drafted info and build drafted list
      // IMPORTANT: Reset ALL players to their correct status based on current scrape data
      // Also inject out-of-pool players that are drafted or on_block
      setPlayers(prevPlayers => {
        // Build set of existing player IDs for quick lookup
        const existingPlayerIds = new Set(prevPlayers.map(p => p.id));

        // DEBUG: Check for players in frontend that should match drafted scraped players
        if (import.meta.env.DEV) {
          const draftedScrapedNames = new Set(
            result.auctionData.players
              .filter(p => p.status === 'drafted')
              .map(p => p.fullName.toLowerCase())
          );
          const unmatchedFrontendPlayers = prevPlayers.filter(p => {
            const normalizedName = p.name.toLowerCase();
            return draftedScrapedNames.has(normalizedName) && !matchedByProjectionId.has(p.id);
          });
          if (unmatchedFrontendPlayers.length > 0) {
            console.warn('[DraftRoom] WARNING: Frontend players that match drafted names but have no projectionId match:',
              unmatchedFrontendPlayers.map(p => ({ name: p.name, id: p.id })));
          }
        }

        const updatedPlayers = prevPlayers.map(p => {
          // First try to match by projection ID
          let matched = matchedByProjectionId.get(p.id);

          // OHTANI SPECIAL HANDLING: If this is Ohtani (two-way player), use the Ohtani match
          // regardless of projection ID. This handles the case where the server matched
          // a different projection ID (hitter vs pitcher) than the frontend's combined ID.
          const isOhtani = p.name.toLowerCase().includes('ohtani') || p.name.toLowerCase().includes('shohei');
          if (!matched && isOhtani && ohtaniMatch) {
            matched = ohtaniMatch;
            if (import.meta.env.DEV) {
              console.log('[DraftRoom] OHTANI SPECIAL MATCH applied:', {
                frontendPlayer: { name: p.name, id: p.id, isTwoWayPlayer: p.isTwoWayPlayer },
                scrapedPlayer: { name: ohtaniMatch.scrapedPlayer.fullName, status: ohtaniMatch.scrapedPlayer.status },
              });
            }
          }

          // Fallback: for other two-way players, match by name+team if no projection ID match
          // This handles cases where a player's combined ID doesn't match the server's projection ID
          // Use normalizeName to handle diacritics (e.g., "Félix" → "felix")
          if (!matched && p.isTwoWayPlayer && !isOhtani) {
            const nameTeamKey = `${normalizeName(p.name)}|${p.team.toLowerCase().trim()}`;
            matched = matchedByNameTeam.get(nameTeamKey);
            if (matched && import.meta.env.DEV) {
              console.log('[DraftRoom] Two-way player matched by name+team fallback:', {
                name: p.name,
                id: p.id,
                matchedProjectionId: matched.projectionPlayerId,
                status: matched.scrapedPlayer.status,
              });
            }
          }

          // Final fallback: match ANY player by normalized name+team if projection ID matching failed
          // This handles cases where the server couldn't match due to diacritics, team changes, etc.
          // But the player exists in both the frontend projections and the scraped data
          if (!matched) {
            const nameTeamKey = `${normalizeName(p.name)}|${p.team.toLowerCase().trim()}`;
            matched = matchedByNameTeam.get(nameTeamKey);
            if (matched && import.meta.env.DEV) {
              console.log('[DraftRoom] Player matched by name+team fallback (diacritics/team mismatch):', {
                name: p.name,
                id: p.id,
                scrapedName: matched.scrapedPlayer.fullName,
                status: matched.scrapedPlayer.status,
              });
            }
          }

          // FINAL FALLBACK: Check unmatchedPlayers - these are players the server scraped but
          // couldn't match to projections. If we find a match by name+team, create a synthetic MatchedPlayer.
          // This handles cases where the server's projections don't include the player but our frontend does.
          if (!matched) {
            const nameTeamKey = `${normalizeName(p.name)}|${p.team.toLowerCase().trim()}`;
            const unmatchedPlayer = unmatchedByNameTeam.get(nameTeamKey);
            if (unmatchedPlayer) {
              // Create a synthetic MatchedPlayer from the unmatched scraped player
              matched = {
                scrapedPlayer: unmatchedPlayer,
                projectionPlayerId: p.id, // Use the frontend player's ID
                projectedValue: p.projectedValue ?? 0,
                actualBid: unmatchedPlayer.winningBid ?? null,
                inflationAmount: null,
                inflationPercent: null,
                matchConfidence: 'partial' as const,
              };
              if (import.meta.env.DEV) {
                console.log('[DraftRoom] Player matched via unmatchedPlayers fallback:', {
                  name: p.name,
                  id: p.id,
                  scrapedName: unmatchedPlayer.fullName,
                  status: unmatchedPlayer.status,
                  winningBid: unmatchedPlayer.winningBid,
                });
              }
            }
          }

          if (matched) {
            if (matched.scrapedPlayer.status === 'drafted') {
              // DEBUG: Log specific player updates
              if (import.meta.env.DEV) {
                if (p.name.toLowerCase().includes('yordan') || p.name.toLowerCase().includes('alvarez') || p.name.toLowerCase().includes('ohtani')) {
                  console.log('[DraftRoom] UPDATING player to drafted:', { name: p.name, id: p.id, matchedName: matched.scrapedPlayer.fullName });
                }
              }
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
              // Find the correct auction data for THIS specific player by matching couchManagersId
              const playerAuction = result.auctionData.activeAuctions?.find(
                auction => auction.playerId === matched.scrapedPlayer.couchManagersId
              );
              return {
                ...p,
                status: 'on_block' as const,
                currentBid: playerAuction?.currentBid ?? result.auctionData.currentAuction?.currentBid,
                currentBidder: playerAuction?.currentBidder ?? result.auctionData.currentAuction?.currentBidder,
                timeRemaining: playerAuction?.timeRemaining ?? result.auctionData.currentAuction?.timeRemaining,
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
                timeRemaining: undefined,
              };
            }
          }
          // No match found - reset to available if player was previously on_block or drafted
          // This handles:
          // 1. Players who were on_block but are no longer in the scraped data
          // 2. Players who were drafted from saved state but the room was reset/cleared
          // DEBUG: Log when Yordan/Alvarez is NOT matched
          if (import.meta.env.DEV) {
            if (p.name.toLowerCase().includes('yordan') || p.name.toLowerCase().includes('alvarez')) {
              console.warn('[DraftRoom] NOT MATCHED:', { name: p.name, id: p.id, currentStatus: p.status });
            }
          }
          if (p.status === 'on_block' || p.status === 'drafted') {
            // Player was on_block or drafted but no longer appears in Couch Managers data
            // Reset to available - the room may have been cleared/reset
            if (import.meta.env.DEV && p.status === 'drafted') {
              console.log('[DraftRoom] Resetting phantom drafted player to available:', { name: p.name, id: p.id });
            }
            return {
              ...p,
              status: 'available' as const,
              draftedPrice: undefined,
              draftedBy: undefined,
              currentBid: undefined,
              currentBidder: undefined,
              timeRemaining: undefined,
            };
          }
          return p;
        });

        // Inject out-of-pool players that are drafted or on_block but not in our players list
        // This ensures we track ALL auction activity, not just players in the projection pool
        const outOfPoolPlayers: Player[] = [];
        const addedOutOfPoolIds = new Set<string>();

        // First, add from matchedPlayers
        result.matchedPlayers.forEach(mp => {
          const playerId = mp.projectionPlayerId || `cm-${mp.scrapedPlayer.couchManagersId}`;
          if (!existingPlayerIds.has(playerId) && !addedOutOfPoolIds.has(playerId) &&
              (mp.scrapedPlayer.status === 'drafted' || mp.scrapedPlayer.status === 'on_block')) {
            const playerAuction = result.auctionData.activeAuctions?.find(
              auction => auction.playerId === mp.scrapedPlayer.couchManagersId
            );
            addedOutOfPoolIds.add(playerId);
            outOfPoolPlayers.push({
              id: playerId,
              name: mp.scrapedPlayer.fullName,
              team: mp.scrapedPlayer.mlbTeam,
              positions: mp.scrapedPlayer.positions,
              projectedValue: mp.projectedValue || 0,
              adjustedValue: mp.projectedValue || 0,
              projectedStats: {},
              status: mp.scrapedPlayer.status as 'drafted' | 'on_block',
              draftedPrice: mp.scrapedPlayer.winningBid,
              draftedBy: mp.scrapedPlayer.winningTeam || 'Unknown',
              currentBid: mp.scrapedPlayer.status === 'on_block' ? playerAuction?.currentBid : undefined,
              currentBidder: mp.scrapedPlayer.status === 'on_block' ? playerAuction?.currentBidder : undefined,
              timeRemaining: mp.scrapedPlayer.status === 'on_block' ? playerAuction?.timeRemaining : undefined,
              tier: 10,
              isInDraftPool: false,
            });
          }
        });

        // ALSO add from unmatchedPlayers - these are players the server scraped but couldn't match to projections
        // They still need to be tracked for inflation and auction display
        // BUT: Skip players that were already matched to a frontend player via unmatchedByNameTeam lookup
        // This prevents duplicates like Ohtani appearing twice (once matched, once as out-of-pool)
        if (result.unmatchedPlayers) {
          // Build a set of normalized name+team keys for players already in the list
          // This includes both existing players AND updated players that matched via unmatchedByNameTeam
          const alreadyMatchedByNameTeam = new Set<string>();
          updatedPlayers.forEach(p => {
            if (p.status === 'drafted' || p.status === 'on_block') {
              const key = `${normalizeName(p.name)}|${p.team.toLowerCase().trim()}`;
              alreadyMatchedByNameTeam.add(key);
            }
          });

          result.unmatchedPlayers.forEach(up => {
            const playerId = `cm-${up.couchManagersId}`;
            const nameTeamKey = `${normalizeName(up.fullName)}|${up.mlbTeam.toLowerCase().trim()}`;

            // Skip if this player was already matched to a frontend player by name+team
            if (alreadyMatchedByNameTeam.has(nameTeamKey)) {
              if (import.meta.env.DEV) {
                console.log('[DraftRoom] Skipping unmatched player (already matched by name+team):', {
                  name: up.fullName,
                  team: up.mlbTeam,
                });
              }
              return;
            }

            if (!existingPlayerIds.has(playerId) && !addedOutOfPoolIds.has(playerId) &&
                (up.status === 'drafted' || up.status === 'on_block')) {
              const playerAuction = result.auctionData.activeAuctions?.find(
                auction => auction.playerId === up.couchManagersId
              );
              addedOutOfPoolIds.add(playerId);
              outOfPoolPlayers.push({
                id: playerId,
                name: up.fullName,
                team: up.mlbTeam,
                positions: up.positions,
                projectedValue: 0, // No projection available
                adjustedValue: 0,
                projectedStats: {},
                status: up.status as 'drafted' | 'on_block',
                draftedPrice: up.winningBid,
                draftedBy: up.winningTeam || 'Unknown',
                currentBid: up.status === 'on_block' ? playerAuction?.currentBid : undefined,
                currentBidder: up.status === 'on_block' ? playerAuction?.currentBidder : undefined,
                timeRemaining: up.status === 'on_block' ? playerAuction?.timeRemaining : undefined,
                tier: 10,
                isInDraftPool: false,
              });
              if (import.meta.env.DEV) {
                console.log('[DraftRoom] Adding unmatched player to out-of-pool:', {
                  name: up.fullName,
                  team: up.mlbTeam,
                  status: up.status,
                  bid: up.winningBid,
                });
              }
            }
          });
        }

        if (outOfPoolPlayers.length > 0) {
          if (import.meta.env.DEV) {
            console.log('[DraftRoom] Injecting out-of-pool players into player list:', outOfPoolPlayers.map(p => p.name));
          }
          return [...updatedPlayers, ...outOfPoolPlayers];
        }

        return updatedPlayers;
      });

      // Build the allDrafted list from matched players who are drafted
      // Include ALL drafted players, even those not in initialPlayers (out-of-pool players)
      const draftedPlayers: Player[] = [];
      const missingFromPool: string[] = [];
      const addedPlayerIds = new Set<string>(); // Track added players to avoid duplicates (especially for Ohtani)

      result.matchedPlayers.forEach(mp => {
        if (mp.scrapedPlayer.status === 'drafted') {
          // OHTANI SPECIAL HANDLING: Check if this is Ohtani and find the combined frontend player by name
          const scrapedName = mp.scrapedPlayer.fullName.toLowerCase();
          const isOhtaniScraped = scrapedName.includes('ohtani') || scrapedName.includes('shohei');

          // Try to find the player from initialPlayers to get full player data
          let basePlayer = mp.projectionPlayerId
            ? initialPlayers.find(p => p.id === mp.projectionPlayerId)
            : null;

          // For Ohtani: if not found by projectionPlayerId, find by name (combined two-way player)
          if (!basePlayer && isOhtaniScraped) {
            basePlayer = initialPlayers.find(p =>
              p.name.toLowerCase().includes('ohtani') || p.name.toLowerCase().includes('shohei')
            );
            if (basePlayer && import.meta.env.DEV) {
              console.log('[DraftRoom] OHTANI found in allDrafted via name lookup:', {
                basePlayerId: basePlayer.id,
                basePlayerName: basePlayer.name,
                scrapedName: mp.scrapedPlayer.fullName,
              });
            }
          }

          if (basePlayer) {
            // Avoid duplicates (Ohtani may appear twice - once for hitter, once for pitcher match)
            if (addedPlayerIds.has(basePlayer.id)) {
              if (import.meta.env.DEV) {
                console.log('[DraftRoom] Skipping duplicate player in allDrafted:', basePlayer.name);
              }
              return;
            }
            addedPlayerIds.add(basePlayer.id);

            draftedPlayers.push({
              ...basePlayer,
              status: 'drafted' as const,
              draftedPrice: mp.scrapedPlayer.winningBid,
              draftedBy: mp.scrapedPlayer.winningTeam || 'Unknown',
            });
          } else {
            // Player was drafted but not in our projection pool - create a minimal player entry
            // This ensures we don't lose track of drafted players for inflation calculations
            const playerId = mp.projectionPlayerId || `cm-${mp.scrapedPlayer.couchManagersId}`;
            if (addedPlayerIds.has(playerId)) {
              return; // Skip duplicate
            }
            addedPlayerIds.add(playerId);

            missingFromPool.push(`${mp.scrapedPlayer.fullName} ($${mp.scrapedPlayer.winningBid})`);
            draftedPlayers.push({
              id: playerId,
              name: mp.scrapedPlayer.fullName,
              team: mp.scrapedPlayer.mlbTeam,
              positions: mp.scrapedPlayer.positions,
              projectedValue: mp.projectedValue || 0,
              adjustedValue: mp.projectedValue || 0,
              projectedStats: {},
              status: 'drafted' as const,
              draftedPrice: mp.scrapedPlayer.winningBid,
              draftedBy: mp.scrapedPlayer.winningTeam || 'Unknown',
              tier: 10, // Assign to lowest tier for out-of-pool players
              isInDraftPool: false,
            });
          }
        }
      });

      // Also handle unmatched drafted players (no projection match at all)
      result.unmatchedPlayers?.forEach(up => {
        if (up.status === 'drafted') {
          const playerId = `cm-${up.couchManagersId}`;
          // Skip if already added (may have been matched via frontend name lookup)
          if (addedPlayerIds.has(playerId)) {
            return;
          }
          addedPlayerIds.add(playerId);

          missingFromPool.push(`${up.fullName} ($${up.winningBid}) [unmatched]`);
          draftedPlayers.push({
            id: playerId,
            name: up.fullName,
            team: up.mlbTeam,
            positions: up.positions,
            projectedValue: 0,
            adjustedValue: 0,
            projectedStats: {},
            status: 'drafted' as const,
            draftedPrice: up.winningBid,
            draftedBy: up.winningTeam || 'Unknown',
            tier: 10,
            isInDraftPool: false,
          });
        }
      });

      if (import.meta.env.DEV && missingFromPool.length > 0) {
        console.warn('[DraftRoom] Drafted players not in projection pool (included with $0 value):', missingFromPool);
      }

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
        setTimeout(() => setIsInitialLoading(false), LOADING_TRANSITION_DELAY_MS);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Sync error:', error);
      }
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
    // Mark component as mounted
    isMountedRef.current = true;

    if (!settings.couchManagerRoomId) {
      setIsInitialLoading(false);
      return;
    }

    // Initial sync with small delay to let component mount
    const initialSyncTimeout = setTimeout(performSync, INITIAL_SYNC_DELAY_MS);

    // Set up interval
    syncIntervalRef.current = window.setInterval(performSync, SYNC_INTERVAL_MS);

    return () => {
      // Mark component as unmounted to prevent state updates after cleanup
      isMountedRef.current = false;
      clearTimeout(initialSyncTimeout);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [settings.couchManagerRoomId, performSync]);

  // Extract on_block players with their current bids for inflation calculation
  // This avoids circular dependency: inflationResult -> setPlayers -> players -> inflationResult
  // Only recalculate when on_block statuses or bids change, not when adjustedValue changes
  const onBlockPlayersData = useMemo(() => {
    // Return on_block players with their IDs and current bids for inflation calculation
    // Use a default bid of 1 if currentBid is undefined (player just went on block)
    return players
      .filter(p => p.status === 'on_block')
      .map(p => ({ id: p.id, currentBid: p.currentBid ?? 1, isOnBlock: true }));
  }, [players]);

  // Recalculate tier-weighted inflation whenever players are drafted or go on_block
  // We use initialPlayers with status/bid overlay to include on_block players
  // on_block players are treated as "virtually drafted" at their current bid for inflation calc
  // Merge server-side enhanced data (positional scarcity, team constraints) when available
  const inflationResult: InflationResult = useMemo(() => {
    // Build a map of on_block player IDs to their data (bid + isOnBlock flag)
    const onBlockMap = new Map(onBlockPlayersData.map(p => [p.id, p]));
    const draftedIds = new Set(allDrafted.map(p => p.id));

    // Create a view of players with current status and currentBid from sync
    // This includes on_block status and bid info for inflation calculation
    const playersWithStatus = initialPlayers.map(p => {
      const onBlockData = onBlockMap.get(p.id);
      return {
        ...p,
        status: draftedIds.has(p.id)
          ? ('drafted' as const)
          : onBlockData?.isOnBlock
            ? ('on_block' as const)
            : ('available' as const),
        currentBid: onBlockData?.currentBid,
      };
    });

    // DEBUG: Log inflation calculation inputs
    if (import.meta.env.DEV) {
      const onBlockPlayers = playersWithStatus.filter(p => p.status === 'on_block');
      console.log('[DraftRoom] INFLATION DEBUG:', {
        onBlockPlayersCount: onBlockPlayers.length,
        onBlockPlayers: onBlockPlayers.map(p => ({ name: (p as any).name, id: p.id, currentBid: p.currentBid, projectedValue: p.projectedValue, tier: p.tier })),
        allDraftedCount: allDrafted.length,
        initialPlayersCount: initialPlayers.length,
      });
    }

    const baseResult = calculateTierWeightedInflation(settings, allDrafted, playersWithStatus);

    // DEBUG: Log inflation result
    if (import.meta.env.DEV) {
      console.log('[DraftRoom] INFLATION RESULT:', {
        overallInflationRate: baseResult.overallInflationRate,
        remainingBudget: baseResult.remainingBudget,
        remainingProjectedValue: baseResult.remainingProjectedValue,
        tierInflation: baseResult.tierInflation.filter(t => t.draftedCount > 0),
      });
    }

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
  }, [allDrafted, initialPlayers, onBlockPlayersData, settings, liveInflationStats]);

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
    if (import.meta.env.DEV) {
      console.log('[DraftRoom] Selected team:', selectedTeam);
      console.log('[DraftRoom] All drafted players:', allDrafted.map(p => ({
        name: p.name,
        draftedBy: p.draftedBy,
        matchesSelected: p.draftedBy === selectedTeam
      })));
      console.log('[DraftRoom] Filtered team players:', teamPlayers.length, 'players');
    }

    setMyRoster(teamPlayers);
  }, [selectedTeam, allDrafted]);

  // Handler for team selection
  const handleTeamSelect = useCallback(async (teamName: string) => {
    setSelectedTeam(teamName);
    // Save to localStorage for persistence (immediate feedback)
    localStorage.setItem(`selectedTeam-${settings.couchManagerRoomId}`, teamName);

    // Also save to user account for SMS notifications (if authenticated)
    if (isAuthenticated && settings.couchManagerRoomId) {
      try {
        await apiSelectTeam(teamName, settings.couchManagerRoomId);
        if (import.meta.env.DEV) {
          console.log('[DraftRoom] Team selection saved to account:', teamName);
        }
      } catch (error) {
        // Non-blocking - localStorage still has the selection
        console.warn('[DraftRoom] Failed to save team selection to account:', error);
      }
    }
  }, [settings.couchManagerRoomId, isAuthenticated]);

  // Load saved team selection on mount
  // Priority: 1. User account (if authenticated), 2. localStorage
  useEffect(() => {
    async function loadSavedTeam() {
      if (!settings.couchManagerRoomId) return;

      // If authenticated, try to load from account first
      if (isAuthenticated) {
        try {
          const notificationSettings = await getNotificationSettings();
          // Only use account setting if it matches current room
          if (notificationSettings.selectedRoomId === settings.couchManagerRoomId &&
              notificationSettings.selectedTeamName) {
            setSelectedTeam(notificationSettings.selectedTeamName);
            // Also sync to localStorage
            localStorage.setItem(`selectedTeam-${settings.couchManagerRoomId}`, notificationSettings.selectedTeamName);
            if (import.meta.env.DEV) {
              console.log('[DraftRoom] Loaded team from account:', notificationSettings.selectedTeamName);
            }
            return;
          }
        } catch (error) {
          // Fall through to localStorage
          console.warn('[DraftRoom] Failed to load team from account:', error);
        }
      }

      // Fallback to localStorage
      const savedTeam = localStorage.getItem(`selectedTeam-${settings.couchManagerRoomId}`);
      if (savedTeam) {
        setSelectedTeam(savedTeam);
      }
    }

    loadSavedTeam();
  }, [settings.couchManagerRoomId, isAuthenticated]);

  // Handler for toggling player target status (watchlist)
  const handleToggleTarget = useCallback((playerId: string) => {
    setPlayers(prevPlayers =>
      prevPlayers.map(p =>
        p.id === playerId
          ? { ...p, isTargeted: !p.isTargeted }
          : p
      )
    );
  }, []);

  // Memoized handler for drafting a player
  const handleDraftPlayer = useCallback((player: Player, price: number, draftedBy: 'me' | 'other') => {
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
  }, []);

  // Handler for manual draft mode (when no room ID)
  const handleManualDraft = useCallback((player: Player, price: number, toMyTeam: boolean) => {
    handleDraftPlayer(player, price, toMyTeam ? 'me' : 'other');
  }, [handleDraftPlayer]);

  // Determine if we're in manual mode (no Couch Managers room ID)
  const isManualMode = !settings.couchManagerRoomId;

  // Memoized callback for player detail modal
  const handlePlayerClick = useCallback((player: Player) => {
    setSelectedPlayerForDetail(player);
  }, []);

  // Memoized callback for closing player detail modal
  const handleClosePlayerDetail = useCallback(() => {
    setSelectedPlayerForDetail(null);
  }, []);

  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const isDraftComplete = myRoster.length >= totalRosterSpots;

  return (
    <div className="relative flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 h-screen overflow-hidden">
      {/* Loading overlay - appears on top of blurred draft room */}
      <DraftRoomLoadingScreen
        isVisible={isInitialLoading}
        message={loadingMessage}
      />
      {/* Header */}
      <DraftHeader
        settings={settings}
        moneyRemaining={moneyRemaining}
        rosterNeedsRemaining={rosterNeedsRemaining}
        totalDrafted={allDrafted.length}
        inflationRate={inflationRate}
        isMobile={isMobile}
      />

      {/* Main Content - scrollable container */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-2 md:gap-4 p-2 md:p-4 pb-4 md:pb-6">
          {/* Top Section - Player Queue & Roster Panel */}
          {isMobile ? (
            /* MOBILE: Tab-based layout */
            <Tabs
              value={mobileActiveTab}
              onValueChange={(v: string) => setMobileActiveTab(v as 'players' | 'roster')}
              className="flex flex-col flex-1"
            >
              <TabsList className="w-full grid grid-cols-2 bg-slate-900 border-2 border-slate-600 rounded-xl p-1.5 shadow-lg">
                <TabsTrigger
                  value="players"
                  className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all text-slate-300 bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30"
                >
                  <ListFilter className="w-4 h-4" />
                  <span>Players</span>
                </TabsTrigger>
                <TabsTrigger
                  value="roster"
                  className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all text-slate-300 bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/30"
                >
                  <Users className="w-4 h-4" />
                  <span>Roster ({myRoster.length})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="players" className="flex-1 mt-2" style={{ minHeight: '55vh' }}>
                <div className="h-full bg-slate-900/95 rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col">
                  <PlayerQueue
                    players={players}
                    onPlayerClick={handlePlayerClick}
                    positionalScarcity={inflationResult.positionalScarcity}
                    isManualMode={isManualMode}
                    onManualDraft={handleManualDraft}
                    onToggleTarget={handleToggleTarget}
                    isMobile={true}
                    maxPlayers={maxPlayersInQueue}
                  />
                </div>
              </TabsContent>

              <TabsContent value="roster" className="flex-1 mt-2" style={{ minHeight: '55vh' }}>
                <RosterPanel
                  roster={myRoster}
                  settings={settings}
                  rosterNeedsRemaining={rosterNeedsRemaining}
                  availableTeams={availableTeams}
                  selectedTeam={selectedTeam}
                  onTeamSelect={handleTeamSelect}
                  isManualMode={isManualMode}
                  isMobile={true}
                />
              </TabsContent>
            </Tabs>
          ) : (
            /* DESKTOP: Original grid layout */
            <div className="grid grid-cols-12 gap-4" style={{ minHeight: '55vh' }}>
              {/* Left Panel - Player Queue (primary focus area) */}
              <div className="col-span-8 bg-slate-900/95 rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col">
                <PlayerQueue
                  players={players}
                  onPlayerClick={handlePlayerClick}
                  positionalScarcity={inflationResult.positionalScarcity}
                  isManualMode={isManualMode}
                  onManualDraft={handleManualDraft}
                  onToggleTarget={handleToggleTarget}
                  maxPlayers={maxPlayersInQueue}
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
                  isManualMode={isManualMode}
                />
              </div>
            </div>
          )}

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
              isMobile={isMobile}
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
        onClose={handleClosePlayerDetail}
        inflationResult={inflationResult}
        leagueSettings={settings}
        myMoneyRemaining={moneyRemaining}
        myRosterSpotsRemaining={Object.values(rosterNeedsRemaining).reduce((a, b) => a + b, 0)}
      />
    </div>
  );
}

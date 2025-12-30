import { useState, useMemo, useCallback, memo } from 'react';
import { Player, PositionalScarcity } from '../lib/types';
import { getDraftSurplus } from '../lib/calculations';
import { getPlayerPhotoUrl } from '../lib/auctionApi';
import { ArrowUpDown, Filter, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, User, Check, X, UserPlus, Info } from 'lucide-react';

// Players per page for pagination
const PLAYERS_PER_PAGE = 50;

interface PlayerQueueProps {
  players: Player[];
  onPlayerClick: (player: Player) => void;
  positionalScarcity?: PositionalScarcity[];
  isManualMode?: boolean; // When true, allow manual entry of actual $ values
  onManualDraft?: (player: Player, price: number, toMyTeam: boolean) => void;
}

export const PlayerQueue = memo(function PlayerQueue({ players, onPlayerClick, positionalScarcity, isManualMode, onManualDraft }: PlayerQueueProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  // Track which player has manual entry input open, and the current input value
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [manualPriceInput, setManualPriceInput] = useState<string>('');

  // Build scarcity lookup map for quick access
  const scarcityByPosition = useMemo(() => {
    const map = new Map<string, PositionalScarcity>();
    positionalScarcity?.forEach(ps => map.set(ps.position, ps));
    return map;
  }, [positionalScarcity]);

  // Get the highest scarcity level for a player's positions
  const getPlayerScarcity = useCallback((positions: string[]): PositionalScarcity | null => {
    let highestScarcity: PositionalScarcity | null = null;
    positions.forEach(pos => {
      const scarcity = scarcityByPosition.get(pos);
      if (scarcity && (!highestScarcity || scarcity.inflationAdjustment > highestScarcity.inflationAdjustment)) {
        highestScarcity = scarcity;
      }
    });
    return highestScarcity;
  }, [scarcityByPosition]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'on_block' | 'drafted'>('available');
  const [sortBy, setSortBy] = useState<'name' | 'projectedValue' | 'adjustedValue'>('adjustedValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Memoize filtered and sorted players to avoid recalculating on every render
  const filteredPlayers = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();

    const filtered = (players || []).filter(p => {
      // Status filtering:
      // - 'available' filter: show only available players (NOT on_block, NOT drafted)
      // - 'on_block' filter: show only players currently being auctioned
      // - 'drafted' filter: show only drafted players (drafted or onMyTeam)
      // - 'all' filter: show everything
      if (filterStatus === 'available') {
        if (p.status !== 'available') return false;
      } else if (filterStatus === 'on_block') {
        if (p.status !== 'on_block') return false;
      } else if (filterStatus === 'drafted') {
        if (p.status !== 'drafted' && p.status !== 'onMyTeam') return false;
      }
      // 'all' filter shows everything - no status filtering

      // Position filtering - special handling for UTIL, MI, CI
      if (filterPosition !== 'all') {
        if (filterPosition === 'UTIL') {
          // UTIL filter: only show players whose ONLY position is UTIL (like Ohtani DH)
          // This prevents UTIL-only players from showing up in other position filters
          if (p.positions.length !== 1 || (p.positions[0] !== 'UTIL' && p.positions[0] !== 'DH')) return false;
        } else if (filterPosition === 'MI') {
          // MI (Middle Infield) filter: show 2B and SS
          const hasMI = p.positions.some(pos => pos === '2B' || pos === 'SS' || pos === 'MI');
          if (!hasMI) return false;
          // Exclude UTIL-only players
          if (p.positions.length === 1 && (p.positions[0] === 'UTIL' || p.positions[0] === 'DH')) return false;
        } else if (filterPosition === 'CI') {
          // CI (Corner Infield) filter: show 1B and 3B
          const hasCI = p.positions.some(pos => pos === '1B' || pos === '3B' || pos === 'CI');
          if (!hasCI) return false;
          // Exclude UTIL-only players
          if (p.positions.length === 1 && (p.positions[0] === 'UTIL' || p.positions[0] === 'DH')) return false;
        } else {
          // Other positions: show if player has that position
          if (!p.positions.includes(filterPosition)) return false;
          // Exclude UTIL-only or DH-only players from specific position filters
          // (they should only show up in UTIL filter)
          if (p.positions.length === 1 && (p.positions[0] === 'UTIL' || p.positions[0] === 'DH')) return false;
        }
      }

      if (searchQuery && !p.name.toLowerCase().includes(searchLower)) return false;
      return true;
    });

    // Sort the filtered list:
    // 1. on_block players always at top
    // 2. Then sort by the selected field
    filtered.sort((a, b) => {
      // On block players always come first
      const aOnBlock = a.status === 'on_block' ? 1 : 0;
      const bOnBlock = b.status === 'on_block' ? 1 : 0;
      if (aOnBlock !== bOnBlock) {
        return bOnBlock - aOnBlock; // on_block first
      }

      // Then apply normal sorting
      let aVal: string | number = a[sortBy];
      let bVal: string | number = b[sortBy];

      if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }

      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [players, filterStatus, filterPosition, searchQuery, sortBy, sortOrder]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredPlayers.length / PLAYERS_PER_PAGE);

  // Reset to page 1 when filters change
  const effectiveCurrentPage = useMemo(() => {
    if (currentPage > totalPages) {
      return 1;
    }
    return currentPage;
  }, [currentPage, totalPages]);

  // Get players for current page
  const visiblePlayers = useMemo(() => {
    const startIndex = (effectiveCurrentPage - 1) * PLAYERS_PER_PAGE;
    const endIndex = startIndex + PLAYERS_PER_PAGE;
    return filteredPlayers.slice(startIndex, endIndex);
  }, [filteredPlayers, effectiveCurrentPage]);

  // Reset page when filters change
  const handleFilterChange = useCallback((newFilter: string) => {
    setFilterPosition(newFilter);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((status: 'all' | 'available' | 'on_block' | 'drafted') => {
    setFilterStatus(status);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  // Handler for manual draft entry
  const handleManualDraftSubmit = useCallback((player: Player, toMyTeam: boolean) => {
    const price = parseInt(manualPriceInput, 10);
    if (!isNaN(price) && price >= 0 && onManualDraft) {
      onManualDraft(player, price, toMyTeam);
      setEditingPlayerId(null);
      setManualPriceInput('');
    }
  }, [manualPriceInput, onManualDraft]);

  // Cancel manual entry
  const handleManualDraftCancel = useCallback(() => {
    setEditingPlayerId(null);
    setManualPriceInput('');
  }, []);

  const positions = ['all', 'C', '1B', '2B', '3B', 'SS', 'OF', 'CI', 'MI', 'UTIL', 'SP', 'RP', 'P'];

  if (!players || players.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-900">
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <p className="text-xl mb-2">No players available</p>
            <p>Please check your league settings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Filters */}
      <div className="p-4 border-b border-slate-700 space-y-3 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />

          <div className="flex items-center gap-1">
            {(['all', 'available', 'on_block', 'drafted'] as const).map(status => (
              <button
                key={status}
                onClick={() => handleStatusFilterChange(status)}
                className={`px-3 py-2 rounded-lg transition-all text-sm ${
                  filterStatus === status
                    ? status === 'on_block'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/30'
                      : status === 'drafted'
                      ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/30'
                      : 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {status === 'all' ? 'All' : status === 'available' ? 'Available' : status === 'on_block' ? 'On Block' : 'Drafted'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500" />
          {positions.map(pos => (
            <button
              key={pos}
              onClick={() => handleFilterChange(pos)}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterPosition === pos
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {pos === 'all' ? 'All' : pos}
            </button>
          ))}
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 sticky top-0 z-10">
        <button
          onClick={() => handleSort('name')}
          className="col-span-3 flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
        >
          Player <ArrowUpDown className="w-3 h-3" />
        </button>
        <div className="col-span-2 text-slate-300">Position</div>
        <button
          onClick={() => handleSort('projectedValue')}
          className="col-span-2 flex items-center gap-1 text-slate-300 hover:text-white transition-colors group relative"
        >
          Proj $ <ArrowUpDown className="w-3 h-3" />
          <span className="ml-1 text-slate-500 group-hover:text-slate-400">
            <Info className="w-3 h-3" />
          </span>
          <span className="absolute left-0 top-full mt-2 w-48 p-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-300 font-normal opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
            Original Projected Auction Value based on projections and league settings
          </span>
        </button>
        <button
          onClick={() => handleSort('adjustedValue')}
          className="col-span-2 flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors group relative"
        >
          Adj $ <ArrowUpDown className="w-3 h-3" />
          <span className="ml-1 text-emerald-500/50 group-hover:text-emerald-400/70">
            <Info className="w-3 h-3" />
          </span>
          <span className="absolute left-0 top-full mt-2 w-52 p-2 bg-slate-800 border border-emerald-600/50 rounded-lg text-xs text-slate-300 font-normal opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
            Adjusted Projected Value inclusive of current inflation rate based on draft results
          </span>
        </button>
        <div className="col-span-1 text-slate-300 flex items-center gap-1 group relative">
          Actual $
          <span className="text-slate-500 group-hover:text-slate-400">
            <Info className="w-3 h-3" />
          </span>
          <span className="absolute left-0 top-full mt-2 w-44 p-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-300 font-normal opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
            Player's actual cost from Couch Managers auction
          </span>
        </div>
        <div className="col-span-2 text-slate-300">Key Stats</div>
      </div>

      {/* Player List */}
      <div className="flex-1 overflow-y-auto">
        {visiblePlayers.map((player) => {
          const isPitcher = player.positions.some(p => ['SP', 'RP', 'P'].includes(p));
          const isHitter = player.positions.some(p => !['SP', 'RP', 'P'].includes(p));
          const isTwoWay = player.isTwoWayPlayer || (isPitcher && isHitter);

          // For two-way players, show both hitting and pitching stats
          let keyStats: string;
          if (isTwoWay) {
            const hitStats = `${player.projectedStats.HR}HR ${player.projectedStats.SB}SB`;
            const pitchStats = `${player.projectedStats.W}W ${player.projectedStats.ERA?.toFixed(2)}ERA`;
            keyStats = `${hitStats} | ${pitchStats}`;
          } else if (isPitcher) {
            keyStats = `${player.projectedStats.W}W ${player.projectedStats.K}K ${player.projectedStats.ERA?.toFixed(2)}ERA`;
          } else {
            keyStats = `${player.projectedStats.HR}HR ${player.projectedStats.RBI}RBI ${player.projectedStats.AVG?.toFixed(3)}AVG`;
          }

          // For available players: show inflation-adjusted value change
          // For drafted players: show surplus/deficit (how much over/under projection)
          const isDrafted = player.status === 'drafted' || player.status === 'onMyTeam';
          const isOnBlock = player.status === 'on_block';
          const draftSurplus = isDrafted ? getDraftSurplus(player) : null;
          const valueChange = isDrafted ? draftSurplus : (player.adjustedValue - player.projectedValue);

          // Get scarcity data for this player's positions (for available and on_block players)
          const playerScarcity = (player.status === 'available' || isOnBlock) ? getPlayerScarcity(player.positions) : null;

          // Actual cost: drafted price for drafted players, current bid for on_block players
          const actualCost = isDrafted ? player.draftedPrice : (isOnBlock ? player.currentBid : null);

          return (
            <div
              key={player.id}
              onClick={() => onPlayerClick(player)}
              className={`grid grid-cols-12 gap-3 px-4 py-3 border-b border-slate-800 hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-emerald-900/20 transition-all cursor-pointer ${
                player.status === 'onMyTeam' ? 'bg-gradient-to-r from-emerald-900/30 to-green-900/30 border-emerald-700/50' : ''
              } ${isOnBlock ? 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-amber-500/50 animate-pulse' : ''} ${player.status === 'drafted' ? 'opacity-50' : ''}`}
            >
              <div className="col-span-3">
                <div className="flex items-center gap-2">
                  {/* Player Photo */}
                  <div
                    className="flex-shrink-0 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center"
                    style={{ width: '32px', height: '32px' }}
                  >
                    {player.mlbamId ? (
                      <img
                        src={getPlayerPhotoUrl(player.mlbamId) || ''}
                        alt={player.name}
                        style={{ width: '32px', height: '32px', objectFit: 'cover', objectPosition: 'center 20%' }}
                        onError={(e) => {
                          // Replace with fallback icon on error
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.innerHTML = '<svg class="w-4 h-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                          }
                        }}
                      />
                    ) : (
                      <User className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white hover:text-emerald-400 transition-colors truncate">{player.name}</span>
                      {isTwoWay && (
                        <span className="px-1.5 py-0.5 text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-full">
                          2-WAY
                        </span>
                      )}
                      {isOnBlock && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-red-600 text-white border border-red-500 rounded-full animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>
                    {player.tier && (
                      <div className={`text-sm ${isOnBlock ? 'text-slate-200' : 'text-slate-500'}`}>Tier {player.tier}</div>
                    )}
                    {isOnBlock && (
                      <div className="text-white text-xs flex items-center gap-2 font-medium">
                        {player.currentBidder && <span>High: {player.currentBidder}</span>}
                        {player.timeRemaining !== undefined && player.timeRemaining > 0 && (
                          <span className="text-yellow-400 font-bold">{player.timeRemaining}s</span>
                        )}
                      </div>
                    )}
                    {isDrafted && player.draftedBy && (
                      <div className="text-slate-500 text-xs">{player.draftedBy}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <span className={isOnBlock ? 'text-white' : 'text-slate-400'}>{player.positions.join(', ')}</span>
                {/* Scarcity Badge */}
                {playerScarcity && playerScarcity.scarcityLevel !== 'normal' && playerScarcity.scarcityLevel !== 'surplus' && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                      playerScarcity.scarcityLevel === 'severe'
                        ? 'bg-red-900/50 text-red-400 border border-red-500/30'
                        : 'bg-orange-900/50 text-orange-400 border border-orange-500/30'
                    }`}
                    title={`${playerScarcity.position}: ${playerScarcity.qualityCount} quality players for ${playerScarcity.leagueNeed} league need`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {playerScarcity.scarcityLevel === 'severe' ? '+25%' : '+12%'}
                  </span>
                )}
              </div>

              <div className="col-span-2 text-white">
                ${player.projectedValue}
              </div>

              <div className="col-span-2">
                {isDrafted ? (
                  // For drafted players: show the surplus/deficit from projection
                  <>
                    <div className={`font-medium ${
                      draftSurplus !== null && draftSurplus > 0 ? 'text-red-400' :
                      draftSurplus !== null && draftSurplus < 0 ? 'text-emerald-400' :
                      'text-slate-400'
                    }`}>
                      {draftSurplus !== null ? (
                        draftSurplus === 0 ? 'Even' :
                        draftSurplus > 0 ? `+$${draftSurplus}` : `-$${Math.abs(draftSurplus)}`
                      ) : '--'}
                    </div>
                    <div className="text-slate-500 text-xs">
                      {draftSurplus !== null && draftSurplus > 0 ? 'Overpay' :
                       draftSurplus !== null && draftSurplus < 0 ? 'Value' : ''}
                    </div>
                  </>
                ) : (
                  // For available/on_block players: show inflation-adjusted value with comparison indicator
                  <div className="flex items-center gap-1">
                    <span className="text-white">${player.adjustedValue}</span>
                    {/* Value comparison indicator: Adj $ vs Proj $ */}
                    {valueChange !== null && valueChange !== 0 && (
                      (() => {
                        if (valueChange > 0) {
                          // Adjusted value is HIGHER than projected = inflation (red down arrow)
                          return (
                            <span
                              className="inline-flex items-center text-red-400"
                              title={`$${valueChange} above projected value due to inflation`}
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span className="text-xs ml-0.5">+{valueChange}</span>
                            </span>
                          );
                        } else {
                          // Adjusted value is LOWER than projected = deflation (green down arrow)
                          return (
                            <span
                              className="inline-flex items-center text-emerald-400"
                              title={`$${Math.abs(valueChange)} below projected value`}
                            >
                              <TrendingDown className="w-3.5 h-3.5" />
                              <span className="text-xs ml-0.5">{valueChange}</span>
                            </span>
                          );
                        }
                      })()
                    )}
                  </div>
                )}
              </div>

              {/* Actual Cost Column */}
              <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                {/* Manual mode: show input for available players */}
                {isManualMode && !isDrafted && editingPlayerId === player.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      value={manualPriceInput}
                      onChange={(e) => setManualPriceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualDraftSubmit(player, true);
                        if (e.key === 'Escape') handleManualDraftCancel();
                      }}
                      autoFocus
                      className="w-12 px-1 py-0.5 bg-slate-700 border border-emerald-500 rounded text-white text-sm focus:outline-none"
                      placeholder="0"
                    />
                    <button
                      onClick={() => handleManualDraftSubmit(player, true)}
                      className="p-0.5 text-emerald-400 hover:text-emerald-300 transition-colors"
                      title="Add to My Team"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleManualDraftSubmit(player, false)}
                      className="p-0.5 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Mark as Drafted (Other Team)"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleManualDraftCancel}
                      className="p-0.5 text-slate-400 hover:text-slate-300 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : isManualMode && !isDrafted ? (
                  <button
                    onClick={() => {
                      setEditingPlayerId(player.id);
                      setManualPriceInput(String(player.adjustedValue));
                    }}
                    className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded border border-slate-600 hover:border-emerald-500 transition-all"
                  >
                    Enter $
                  </button>
                ) : actualCost !== null && actualCost !== undefined ? (
                  <div className="flex items-center gap-1">
                    <span className="text-white font-medium">
                      ${actualCost}
                    </span>
                    {/* Value comparison indicator for on_block players */}
                    {isOnBlock && player.currentBid !== undefined && (
                      (() => {
                        const bidDiff = player.adjustedValue - player.currentBid;
                        if (bidDiff > 0) {
                          // Current bid is LESS than adjusted value = good deal (green up arrow)
                          return (
                            <span
                              className="inline-flex items-center text-emerald-400"
                              title={`$${bidDiff} below adjusted value - good deal!`}
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span className="text-xs ml-0.5">+{bidDiff}</span>
                            </span>
                          );
                        } else if (bidDiff < 0) {
                          // Current bid is MORE than adjusted value = overpaying (red down arrow)
                          return (
                            <span
                              className="inline-flex items-center text-red-400"
                              title={`$${Math.abs(bidDiff)} above adjusted value - overpaying!`}
                            >
                              <TrendingDown className="w-3.5 h-3.5" />
                              <span className="text-xs ml-0.5">{bidDiff}</span>
                            </span>
                          );
                        }
                        // Even - no indicator needed
                        return null;
                      })()
                    )}
                  </div>
                ) : (
                  <span className={isOnBlock ? 'text-slate-300' : 'text-slate-600'}>—</span>
                )}
              </div>

              <div className={`col-span-2 ${isOnBlock ? 'text-white' : 'text-slate-400'}`}>
                {keyStats}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with Pagination */}
      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          {/* Player count info */}
          <div className="text-slate-400 text-sm">
            Showing {((effectiveCurrentPage - 1) * PLAYERS_PER_PAGE) + 1}-{Math.min(effectiveCurrentPage * PLAYERS_PER_PAGE, filteredPlayers.length)} of {filteredPlayers.length} players
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              {/* First page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={effectiveCurrentPage === 1}
                className={`p-1.5 rounded-lg transition-all ${
                  effectiveCurrentPage === 1
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Previous page */}
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={effectiveCurrentPage === 1}
                className={`p-1.5 rounded-lg transition-all ${
                  effectiveCurrentPage === 1
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page indicator */}
              <div className="flex items-center gap-1 px-3">
                <span className="text-white font-medium">{effectiveCurrentPage}</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-400">{totalPages}</span>
              </div>

              {/* Next page */}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={effectiveCurrentPage === totalPages}
                className={`p-1.5 rounded-lg transition-all ${
                  effectiveCurrentPage === totalPages
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={effectiveCurrentPage === totalPages}
                className={`p-1.5 rounded-lg transition-all ${
                  effectiveCurrentPage === totalPages
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
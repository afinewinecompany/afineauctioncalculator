import { useState, useMemo, useCallback, memo } from 'react';
import { Player, PositionalScarcity } from '../lib/types';
import { getDraftSurplus } from '../lib/calculations';
import { getPlayerPhotoUrl } from '../lib/auctionApi';
import { ArrowUpDown, Filter, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, User } from 'lucide-react';

// Players per page for pagination
const PLAYERS_PER_PAGE = 50;

interface PlayerQueueProps {
  players: Player[];
  onPlayerClick: (player: Player) => void;
  positionalScarcity?: PositionalScarcity[];
}

export const PlayerQueue = memo(function PlayerQueue({ players, onPlayerClick, positionalScarcity }: PlayerQueueProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPosition, setFilterPosition] = useState<string>('all');

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'available'>('available');
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
      // - 'available' filter: show available and on_block players (NOT drafted)
      // - 'all' filter: show everything
      if (filterStatus === 'available') {
        // Only show available and on_block - drafted players are excluded
        if (p.status !== 'available' && p.status !== 'on_block') return false;
      }

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

  const handleStatusFilterChange = useCallback(() => {
    setFilterStatus(prev => prev === 'all' ? 'available' : 'all');
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
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

          <button
            onClick={handleStatusFilterChange}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterStatus === 'available'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {filterStatus === 'available' ? 'Available Only' : 'Show All'}
          </button>
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
          className="col-span-2 flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
        >
          Proj $ <ArrowUpDown className="w-3 h-3" />
        </button>
        <button
          onClick={() => handleSort('adjustedValue')}
          className="col-span-2 flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Adj $ <ArrowUpDown className="w-3 h-3" />
        </button>
        <div className="col-span-1 text-slate-300">Actual $</div>
        <div className="col-span-2 text-slate-300">Key Stats</div>
      </div>

      {/* Player List */}
      <div className="flex-1 overflow-y-auto">
        {visiblePlayers.map((player) => {
          const isPitcher = player.positions.some(p => ['SP', 'RP'].includes(p));
          const keyStats = isPitcher
            ? `${player.projectedStats.W}W ${player.projectedStats.K}K ${player.projectedStats.ERA?.toFixed(2)}ERA`
            : `${player.projectedStats.HR}HR ${player.projectedStats.RBI}RBI ${player.projectedStats.AVG?.toFixed(3)}AVG`;

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
                      {isOnBlock && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full">
                          LIVE
                        </span>
                      )}
                    </div>
                    {player.tier && (
                      <div className="text-slate-500 text-sm">Tier {player.tier}</div>
                    )}
                    {isOnBlock && player.currentBidder && (
                      <div className="text-amber-300/70 text-xs">High: {player.currentBidder}</div>
                    )}
                    {isDrafted && player.draftedBy && (
                      <div className="text-slate-500 text-xs">{player.draftedBy}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <span className="text-slate-400">{player.positions.join(', ')}</span>
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

              <div className="col-span-2 text-slate-400">
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
                  // For available/on_block players: show inflation-adjusted value
                  <>
                    <div className={isOnBlock ? 'text-amber-400' : 'text-emerald-400'}>${player.adjustedValue}</div>
                    {valueChange !== null && valueChange !== 0 && (
                      <div className={`text-xs ${valueChange > 0 ? 'text-amber-500' : 'text-blue-400'}`}>
                        {valueChange > 0 ? '+' : ''}{valueChange}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Actual Cost Column */}
              <div className="col-span-1">
                {actualCost !== null && actualCost !== undefined ? (
                  <div className={`font-medium ${
                    isOnBlock ? 'text-amber-400' :
                    isDrafted ? 'text-slate-300' :
                    'text-slate-500'
                  }`}>
                    ${actualCost}
                  </div>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </div>

              <div className="col-span-2 text-slate-400">
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
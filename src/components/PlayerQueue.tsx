import { useState } from 'react';
import { Player } from '../lib/types';
import { getValueIndicator } from '../lib/calculations';
import { ArrowUpDown, Filter, Check } from 'lucide-react';

interface PlayerQueueProps {
  players: Player[];
  onDraftPlayer: (player: Player, price: number, draftedBy: 'me' | 'other') => void;
  onPlayerClick: (player: Player) => void;
}

export function PlayerQueue({ players, onDraftPlayer, onPlayerClick }: PlayerQueueProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available'>('available');
  const [sortBy, setSortBy] = useState<'name' | 'projectedValue' | 'adjustedValue'>('adjustedValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Track bid values and my team checkboxes for each player
  const [bidValues, setBidValues] = useState<Record<string, number>>({});
  const [myTeamChecks, setMyTeamChecks] = useState<Record<string, boolean>>({});

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleDraft = (player: Player) => {
    const bidValue = bidValues[player.id] || 1;
    const isMyTeam = myTeamChecks[player.id] || false;
    onDraftPlayer(player, bidValue, isMyTeam ? 'me' : 'other');
    
    // Clear the bid value and checkbox for this player
    setBidValues(prev => {
      const next = { ...prev };
      delete next[player.id];
      return next;
    });
    setMyTeamChecks(prev => {
      const next = { ...prev };
      delete next[player.id];
      return next;
    });
  };

  const handleBidKeyPress = (e: React.KeyboardEvent, player: Player) => {
    if (e.key === 'Enter') {
      handleDraft(player);
    }
  };

  const filteredPlayers = (players || [])
    .filter(p => {
      if (filterStatus === 'available' && p.status !== 'available') return false;
      if (filterPosition !== 'all' && !p.positions.includes(filterPosition)) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
          
          <button
            onClick={() => setFilterStatus(filterStatus === 'all' ? 'available' : 'all')}
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
              onClick={() => setFilterPosition(pos)}
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
          className="col-span-1 flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
        >
          Orig $ <ArrowUpDown className="w-3 h-3" />
        </button>
        <button
          onClick={() => handleSort('adjustedValue')}
          className="col-span-1 flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Adj $ <ArrowUpDown className="w-3 h-3" />
        </button>
        <div className="col-span-2 text-slate-300">Key Stats</div>
        <div className="col-span-1 text-slate-300 text-center">Bid $</div>
        <div className="col-span-1 text-slate-300 text-center flex items-center justify-center gap-1">
          <Check className="w-3 h-3" />
          My Team
        </div>
        <div className="col-span-1 text-slate-300 text-center">Action</div>
      </div>

      {/* Player List */}
      <div className="flex-1 overflow-y-auto">
        {filteredPlayers.map((player) => {
          const isPitcher = player.positions.some(p => ['SP', 'RP'].includes(p));
          const keyStats = isPitcher
            ? `${player.projectedStats.W}W ${player.projectedStats.K}K ${player.projectedStats.ERA?.toFixed(2)}ERA`
            : `${player.projectedStats.HR}HR ${player.projectedStats.RBI}RBI ${player.projectedStats.AVG?.toFixed(3)}AVG`;

          const valueChange = player.adjustedValue - player.projectedValue;
          const valueIndicator = player.draftedPrice 
            ? getValueIndicator(player.draftedPrice, player.adjustedValue)
            : null;

          const currentBidValue = bidValues[player.id] !== undefined ? bidValues[player.id] : '';
          const isMyTeamChecked = myTeamChecks[player.id] || false;

          return (
            <div
              key={player.id}
              className={`grid grid-cols-12 gap-3 px-4 py-3 border-b border-slate-800 hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-emerald-900/20 transition-all ${
                player.status === 'onMyTeam' ? 'bg-gradient-to-r from-emerald-900/30 to-green-900/30 border-emerald-700/50' : ''
              } ${player.status === 'drafted' ? 'opacity-50' : ''}`}
            >
              <div 
                className="col-span-3 cursor-pointer"
                onClick={() => onPlayerClick(player)}
              >
                <div className="text-white hover:text-emerald-400 transition-colors">{player.name}</div>
                {player.tier && (
                  <div className="text-slate-500">Tier {player.tier}</div>
                )}
              </div>
              
              <div className="col-span-2 text-slate-400">
                {player.positions.join(', ')}
              </div>
              
              <div className="col-span-1 text-slate-400">
                ${player.projectedValue}
              </div>
              
              <div className="col-span-1">
                <div className="text-emerald-400">${player.adjustedValue}</div>
                {valueChange !== 0 && (
                  <div className={`${valueChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {valueChange > 0 ? '+' : ''}{valueChange}
                  </div>
                )}
              </div>
              
              <div className="col-span-2 text-slate-400">
                {keyStats}
              </div>
              
              {/* Bid Value Input */}
              <div className="col-span-1 flex items-center justify-center">
                {player.status === 'available' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={currentBidValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string or numbers only
                      if (value === '' || /^\d+$/.test(value)) {
                        if (value === '') {
                          setBidValues(prev => {
                            const next = { ...prev };
                            delete next[player.id];
                            return next;
                          });
                        } else {
                          setBidValues(prev => ({
                            ...prev,
                            [player.id]: Math.max(1, Number(value))
                          }));
                        }
                      }
                    }}
                    onKeyPress={(e) => handleBidKeyPress(e, player)}
                    className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-center focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={`${
                    valueIndicator 
                      ? valueIndicator.color === 'text-green-600' ? 'text-green-400' :
                        valueIndicator.color === 'text-yellow-600' ? 'text-yellow-400' :
                        valueIndicator.color === 'text-orange-600' ? 'text-orange-400' :
                        'text-red-400'
                      : 'text-slate-500'
                  }`}>
                    ${player.draftedPrice}
                  </span>
                )}
              </div>

              {/* My Team Checkbox */}
              <div className="col-span-1 flex items-center justify-center">
                {player.status === 'available' ? (
                  <input
                    type="checkbox"
                    checked={isMyTeamChecked}
                    onChange={(e) => {
                      e.stopPropagation();
                      setMyTeamChecks(prev => ({
                        ...prev,
                        [player.id]: e.target.checked
                      }));
                    }}
                    className="w-4 h-4 bg-slate-800 border-slate-600 rounded text-red-600 focus:ring-2 focus:ring-red-500 cursor-pointer"
                  />
                ) : player.status === 'onMyTeam' ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </div>

              {/* Action Button */}
              <div className="col-span-1 flex items-center justify-center">
                {player.status === 'available' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDraft(player);
                    }}
                    className="px-3 py-1 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 text-sm"
                  >
                    Draft
                  </button>
                ) : player.status === 'onMyTeam' ? (
                  <span className="text-emerald-400 text-sm">Mine</span>
                ) : (
                  <span className="text-slate-500 text-sm">Taken</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="text-slate-400">
          Showing {filteredPlayers.length} of {players.length} players
        </div>
      </div>
    </div>
  );
}
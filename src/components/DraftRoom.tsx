import { useState, useEffect } from 'react';
import { LeagueSettings, Player } from '../lib/types';
import { calculateInflation } from '../lib/calculations';
import { DraftHeader } from './DraftHeader';
import { PlayerQueue } from './PlayerQueue';
import { RosterPanel } from './RosterPanel';
import { InflationTracker } from './InflationTracker';
import { PlayerDetailModal } from './PlayerDetailModal';

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
  
  const moneySpent = myRoster.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
  const moneyRemaining = settings.budgetPerTeam - moneySpent;

  // Recalculate inflation whenever players are drafted
  useEffect(() => {
    const newInflationRate = calculateInflation(settings, allDrafted);
    setInflationRate(newInflationRate);
    
    // Adjust all player values based on new inflation
    setPlayers(prevPlayers =>
      prevPlayers.map(p => ({
        ...p,
        adjustedValue: Math.round(p.projectedValue * (1 + newInflationRate))
      }))
    );
  }, [allDrafted.length, settings]);

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
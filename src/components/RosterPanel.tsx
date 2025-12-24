import { Player, LeagueSettings } from '../lib/types';
import { calculateTeamProjectedStats } from '../lib/calculations';
import { Users, TrendingUp } from 'lucide-react';

interface RosterPanelProps {
  roster: Player[];
  settings: LeagueSettings;
  rosterNeedsRemaining: LeagueSettings['rosterSpots'];
}

export function RosterPanel({ roster, settings, rosterNeedsRemaining }: RosterPanelProps) {
  const stats = calculateTeamProjectedStats(roster);
  const moneyRemaining = settings.budgetPerTeam - stats.totalSpent;
  const spotsRemaining = Object.values(rosterNeedsRemaining).reduce((a, b) => a + b, 0);
  const totalRosterSpots = Object.values(settings.rosterSpots).reduce((a, b) => a + b, 0);
  const moneySpent = stats.totalSpent;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-emerald-900/30 to-green-900/30">
        <h3 className="text-white flex items-center justify-between">
          <span>My Roster</span>
          <span className="text-emerald-400">{roster.length}/{totalRosterSpots}</span>
        </h3>
        <div className="text-slate-400 mt-1">
          ${moneySpent} spent / ${settings.budgetPerTeam - moneySpent} left
        </div>
      </div>

      {/* Position Groups */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Hitters */}
        <div className="space-y-2">
          <div className="text-emerald-400 flex items-center gap-2 mb-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
            Hitters
          </div>
          {(['C', '1B', '2B', '3B', 'SS', 'OF', 'CI', 'MI', 'UTIL'] as const).map(pos => {
            const playersAtPosition = roster.filter(p => p.positions.includes(pos));
            const needed = settings.rosterSpots[pos];
            
            return (
              <div key={pos} className="bg-slate-800/50 border border-slate-700 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">{pos}</span>
                  <span className="text-slate-500">
                    {playersAtPosition.length}/{needed}
                  </span>
                </div>
                {playersAtPosition.length === 0 ? (
                  <div className="text-slate-600 italic">Empty</div>
                ) : (
                  playersAtPosition.map(player => (
                    <div key={player.id} className="text-white mt-1">
                      {player.name} - <span className="text-emerald-400">${player.draftedPrice}</span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>

        {/* Pitchers */}
        <div className="space-y-2">
          <div className="text-blue-400 flex items-center gap-2 mb-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            Pitchers
          </div>
          {(['SP', 'RP', 'P'] as const).map(pos => {
            const playersAtPosition = roster.filter(p => p.positions.includes(pos));
            const needed = settings.rosterSpots[pos];
            
            if (needed === 0) return null;
            
            return (
              <div key={pos} className="bg-slate-800/50 border border-slate-700 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">{pos}</span>
                  <span className="text-slate-500">
                    {playersAtPosition.length}/{needed}
                  </span>
                </div>
                {playersAtPosition.length === 0 ? (
                  <div className="text-slate-600 italic">Empty</div>
                ) : (
                  playersAtPosition.map(player => (
                    <div key={player.id} className="text-white mt-1">
                      {player.name} - <span className="text-emerald-400">${player.draftedPrice}</span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>

        {/* Bench */}
        {settings.rosterSpots.Bench > 0 && (
          <div className="space-y-2">
            <div className="text-slate-400 mb-2">Bench</div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">BN</span>
                <span className="text-slate-500">
                  {roster.length - totalRosterSpots + settings.rosterSpots.Bench}/{settings.rosterSpots.Bench}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Roster Needs Summary */}
      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="text-slate-400 mb-2">Still Needed:</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(rosterNeedsRemaining).map(([pos, count]) => (
            count > 0 && (
              <div key={pos} className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-300">
                {pos}: {count}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
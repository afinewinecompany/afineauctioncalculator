import { useMemo, useState, useRef, useCallback } from 'react';
import { LeagueSettings, Player, ScrapedAuctionData } from '../lib/types';
import {
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  Download,
} from 'lucide-react';
import {
  calculateProjectedStandings,
  getEnabledCategories,
  formatStatValue,
  getCategoryDisplayName,
  isLowerBetterCategory,
  type TeamProjectedStats,
} from '../lib/teamProjections';

interface ProjectedStandingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: LeagueSettings;
  auctionData: ScrapedAuctionData | null;
  allPlayers: Player[];
  allDrafted: Player[];
  selectedTeam?: string | null;
  isMobile?: boolean;
}

type SortColumn = 'rank' | 'team' | 'total' | string; // string for category columns

export function ProjectedStandings({
  isOpen,
  onClose,
  settings,
  auctionData,
  allPlayers,
  allDrafted,
  selectedTeam,
  isMobile,
}: ProjectedStandingsProps) {
  const [sortBy, setSortBy] = useState<SortColumn>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [showPrintView, setShowPrintView] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Get enabled categories
  const enabledCategories = useMemo(() => getEnabledCategories(settings), [settings]);

  // Calculate projected standings
  const projectedStandings = useMemo((): TeamProjectedStats[] => {
    return calculateProjectedStandings(allPlayers, allDrafted, settings, auctionData);
  }, [allPlayers, allDrafted, settings, auctionData]);

  // Sort teams
  const sortedTeams = useMemo(() => {
    const sorted = [...projectedStandings];
    sorted.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'rank') {
        comparison = a.overallRank - b.overallRank;
      } else if (sortBy === 'team') {
        comparison = a.teamName.localeCompare(b.teamName);
      } else if (sortBy === 'total') {
        comparison = b.totalRotoPoints - a.totalRotoPoints;
      } else {
        // Sort by category
        const aVal = a.categories[sortBy]?.value || 0;
        const bVal = b.categories[sortBy]?.value || 0;
        const isLower = isLowerBetterCategory(sortBy);
        comparison = isLower ? aVal - bVal : bVal - aVal;
      }

      return sortAsc ? comparison : -comparison;
    });
    return sorted;
  }, [projectedStandings, sortBy, sortAsc]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(column === 'rank' || column === 'team');
    }
  };

  // Save as image functionality
  const handleSaveAsImage = useCallback(async () => {
    setShowPrintView(true);
    await new Promise(resolve => setTimeout(resolve, 150));

    if (printRef.current) {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(printRef.current, {
          backgroundColor: '#1e293b',
          scale: 2,
          logging: false,
          useCORS: true,
        });

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create blob'));
          }, 'image/png');
        });

        const fileName = `projected-standings-${new Date().toISOString().split('T')[0]}.png`;

        if (navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: 'image/png' });
          const shareData = { files: [file] };

          if (navigator.canShare(shareData)) {
            try {
              await navigator.share(shareData);
              setShowPrintView(false);
              return;
            } catch (shareError) {
              if ((shareError as Error).name === 'AbortError') {
                setShowPrintView(false);
                return;
              }
            }
          }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;

        if (isMobile) {
          window.open(url, '_blank');
        } else {
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error('Failed to save image:', error);
        alert('Failed to save image. Please try taking a screenshot instead.');
      }
    }
    setShowPrintView(false);
  }, [isMobile]);

  const RankBadge = ({ rank, size = 'normal' }: { rank: number; size?: 'normal' | 'small' }) => {
    const textSize = size === 'small' ? 'text-xs' : 'text-lg';
    if (rank === 1) return <span className={textSize}>🥇</span>;
    if (rank === 2) return <span className={textSize}>🥈</span>;
    if (rank === 3) return <span className={textSize}>🥉</span>;
    return <span className={`text-slate-400 ${size === 'small' ? 'text-[10px]' : 'text-sm'} font-medium`}>{rank}</span>;
  };

  const CategoryRankBadge = ({ rank, numTeams }: { rank: number; numTeams: number }) => {
    const getRankColor = () => {
      if (rank === 1) return 'text-amber-400';
      if (rank === 2) return 'text-slate-300';
      if (rank === 3) return 'text-amber-600';
      if (rank <= numTeams / 3) return 'text-emerald-400';
      if (rank <= (numTeams * 2) / 3) return 'text-slate-400';
      return 'text-red-400';
    };
    return <span className={`text-xs ${getRankColor()}`}>({rank})</span>;
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  if (!isOpen) return null;

  if (projectedStandings.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="bg-slate-900 border border-slate-700 text-white max-w-md w-full rounded-lg p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">Projected Standings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">No draft data available yet.</p>
            <p className="text-slate-500 text-sm mt-1">Projected standings will appear once teams draft players.</p>
          </div>
        </div>
      </div>
    );
  }

  const numTeams = projectedStandings.length;

  // Print view
  if (showPrintView) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <div
          ref={printRef}
          className="bg-slate-800 p-6 rounded-lg max-w-4xl w-full overflow-x-auto"
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-600">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Projected Standings</h1>
            <span className="text-slate-400 text-sm ml-auto">
              {new Date().toLocaleDateString()}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-slate-400">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Team</th>
                {enabledCategories.slice(0, 10).map(cat => (
                  <th key={cat} className="text-center py-2 px-1">{getCategoryDisplayName(cat)}</th>
                ))}
                <th className="text-center py-2 px-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr key={team.teamName} className="border-b border-slate-700/50">
                  <td className="py-2 px-2">
                    <RankBadge rank={team.overallRank} size="small" />
                  </td>
                  <td className="py-2 px-2 text-white font-medium">{team.teamName}</td>
                  {enabledCategories.slice(0, 10).map(cat => {
                    const catData = team.categories[cat];
                    return (
                      <td key={cat} className="py-2 px-1 text-center text-xs">
                        <div className="text-white">{catData ? formatStatValue(catData.value, cat) : '-'}</div>
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center text-emerald-400 font-semibold">
                    {team.totalRotoPoints.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-slate-600 text-xs text-slate-500">
            Rotisserie scoring: Teams earn points equal to their rank position (1st = {numTeams} pts, last = 1 pt)
          </div>
        </div>
      </div>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Projected Standings</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAsImage}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title="Save as Image"
            >
              <Download className="w-5 h-5 text-slate-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {sortedTeams.map((team) => (
            <div
              key={team.teamName}
              className={`border-b border-slate-700/30 p-4 ${
                team.teamName === selectedTeam ? 'bg-emerald-900/30' : ''
              }`}
            >
              {/* Team header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RankBadge rank={team.overallRank} />
                  <span className={`font-semibold ${team.teamName === selectedTeam ? 'text-emerald-300' : 'text-white'}`}>
                    {team.teamName}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-bold">{team.totalRotoPoints.toFixed(1)} pts</div>
                  <div className="text-xs text-slate-500">{team.playerCount} players</div>
                </div>
              </div>

              {/* Category grid */}
              <div className="grid grid-cols-5 gap-2 text-xs">
                {enabledCategories.slice(0, 10).map(cat => {
                  const catData = team.categories[cat];
                  return (
                    <div key={cat} className="text-center">
                      <div className="text-slate-500 mb-0.5">{getCategoryDisplayName(cat)}</div>
                      <div className="text-white font-medium">
                        {catData ? formatStatValue(catData.value, cat) : '-'}
                      </div>
                      {catData && <CategoryRankBadge rank={catData.rank} numTeams={numTeams} />}
                    </div>
                  );
                })}
              </div>

              {/* Show more categories if needed */}
              {enabledCategories.length > 10 && (
                <div className="grid grid-cols-5 gap-2 text-xs mt-2 pt-2 border-t border-slate-700/30">
                  {enabledCategories.slice(10).map(cat => {
                    const catData = team.categories[cat];
                    return (
                      <div key={cat} className="text-center">
                        <div className="text-slate-500 mb-0.5">{getCategoryDisplayName(cat)}</div>
                        <div className="text-white font-medium">
                          {catData ? formatStatValue(catData.value, cat) : '-'}
                        </div>
                        {catData && <CategoryRankBadge rank={catData.rank} numTeams={numTeams} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="border-t border-slate-700 px-4 py-2 bg-slate-800 text-xs text-slate-500 text-center">
          Roto points: 1st = {numTeams} pts per category, last = 1 pt
        </div>
      </div>
    );
  }

  // Desktop view
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 text-white rounded-lg max-w-7xl w-full max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Projected Standings</h2>
            <span className="text-xs text-slate-500">
              ({settings.scoringType === 'rotisserie' ? 'Rotisserie' : settings.scoringType})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAsImage}
              className="flex items-center gap-1.5 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              title="Save as Image"
            >
              <Download className="w-3.5 h-3.5" />
              Save
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Scrollable table */}
        <div className="flex-1 overflow-auto px-1" style={{ minHeight: 0 }}>
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="border-b border-slate-700/50">
                <th
                  className="text-left py-1 px-1 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors sticky left-0 bg-slate-900"
                  onClick={() => handleSort('rank')}
                >
                  <div className="flex items-center gap-0.5">
                    # <SortIcon column="rank" />
                  </div>
                </th>
                <th
                  className="text-left py-1 px-1 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors sticky left-6 bg-slate-900"
                  onClick={() => handleSort('team')}
                >
                  <div className="flex items-center gap-0.5">
                    Team <SortIcon column="team" />
                  </div>
                </th>
                {enabledCategories.map(cat => (
                  <th
                    key={cat}
                    className={`text-center py-1 px-0.5 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors whitespace-nowrap ${
                      isLowerBetterCategory(cat) ? 'text-red-400/70' : ''
                    }`}
                    onClick={() => handleSort(cat)}
                    title={isLowerBetterCategory(cat) ? `${getCategoryDisplayName(cat)} (lower is better)` : getCategoryDisplayName(cat)}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      {getCategoryDisplayName(cat)}
                      <SortIcon column={cat} />
                    </div>
                  </th>
                ))}
                <th
                  className="text-center py-1 px-1 text-emerald-400 font-medium cursor-pointer hover:text-emerald-300 transition-colors"
                  onClick={() => handleSort('total')}
                  title="Total Roto Points"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    Pts <SortIcon column="total" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr
                  key={team.teamName}
                  className={`border-b border-slate-700/20 transition-colors ${
                    team.teamName === selectedTeam
                      ? 'bg-emerald-900/20'
                      : 'hover:bg-slate-700/30'
                  }`}
                >
                  {/* Rank */}
                  <td className="py-0.5 px-1 text-center sticky left-0 bg-slate-900">
                    <RankBadge rank={team.overallRank} size="small" />
                  </td>

                  {/* Team Name */}
                  <td className="py-0.5 px-1 sticky left-6 bg-slate-900 max-w-[120px] truncate">
                    <span className={`font-medium ${team.teamName === selectedTeam ? 'text-emerald-300' : 'text-white'}`} title={team.teamName}>
                      {team.teamName}
                    </span>
                    <span className="text-slate-500 ml-0.5">({team.playerCount})</span>
                  </td>

                  {/* Category values */}
                  {enabledCategories.map(cat => {
                    const catData = team.categories[cat];
                    return (
                      <td key={cat} className="py-0.5 px-0.5 text-center">
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-white">
                            {catData ? formatStatValue(catData.value, cat) : '-'}
                          </span>
                          {catData && (
                            <span className={`text-[9px] ${
                              catData.rank === 1 ? 'text-amber-400' :
                              catData.rank === 2 ? 'text-slate-300' :
                              catData.rank === 3 ? 'text-amber-600' :
                              catData.rank <= numTeams / 3 ? 'text-emerald-400' :
                              catData.rank <= (numTeams * 2) / 3 ? 'text-slate-500' :
                              'text-red-400'
                            }`}>({catData.rank})</span>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Total Points */}
                  <td className="py-0.5 px-1 text-center">
                    <span className="text-emerald-400 font-bold">{team.totalRotoPoints.toFixed(1)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend - more compact */}
        <div className="flex items-center gap-2 text-[10px] border-t border-slate-700 px-3 py-1 shrink-0 bg-slate-900">
          <span className="text-slate-500">Roto: 1st={numTeams}pts</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400">●</span>
          <span className="text-slate-500">Top 1/3</span>
          <span className="text-red-400">●</span>
          <span className="text-slate-500">Bottom 1/3</span>
        </div>
      </div>
    </div>
  );
}

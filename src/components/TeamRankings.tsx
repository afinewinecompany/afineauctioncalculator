import { useMemo, useState, useRef, useCallback } from 'react';
import { LeagueSettings, Player, ScrapedAuctionData } from '../lib/types';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Medal,
  Zap,
  Users,
  BarChart3,
  AlertCircle,
  X,
  Download,
  DollarSign,
} from 'lucide-react';

interface TeamRankingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: LeagueSettings;
  auctionData: ScrapedAuctionData | null;
  allDrafted: Player[];
  selectedTeam: string | null;
  isMobile?: boolean;
}

interface TeamRankingData {
  name: string;
  // Core metrics
  totalZScore: number;
  dollarsPerZScore: number;
  moneySpent: number;
  moneyRemaining: number;
  playersDrafted: number;
  rosterSpotsTotal: number;
  // Position breakdown
  hitterZScore: number;
  pitcherZScore: number;
  hitterSpent: number;
  pitcherSpent: number;
  // Value analysis
  totalProjectedValue: number;
  totalActualSpent: number;
  valueGained: number; // Positive = got bargains
  bargainCount: number;
  overpayCount: number;
  // Best/Worst picks
  bestPick: { name: string; value: number; price: number } | null;
  worstPick: { name: string; value: number; price: number } | null;
  // Rankings (filled in after sorting)
  zScoreRank: number;
  efficiencyRank: number;
  valueRank: number;
  overallRank: number;
}

type SortColumn = 'overallRank' | 'zScoreRank' | 'efficiencyRank' | 'valueRank' | 'moneyRemaining';

export function TeamRankings({
  isOpen,
  onClose,
  settings,
  auctionData,
  allDrafted,
  selectedTeam,
  isMobile,
}: TeamRankingsProps) {
  const [sortBy, setSortBy] = useState<SortColumn>('overallRank');
  const [sortAsc, setSortAsc] = useState(true);
  const [showPrintView, setShowPrintView] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const totalRosterSpots = useMemo(() => {
    const rs = settings.rosterSpots;
    return rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
      rs.OF + rs.CI + rs.MI + rs.UTIL +
      rs.SP + rs.RP + rs.P + rs.Bench;
  }, [settings.rosterSpots]);

  // Calculate team rankings
  const teamRankings = useMemo((): TeamRankingData[] => {
    if (!auctionData?.teams || auctionData.teams.length === 0) {
      return [];
    }

    // DEBUG: Log input data for debugging discrepancies
    if (import.meta.env.DEV) {
      console.log('[TeamRankings] Calculating rankings:', {
        isMobile,
        totalDraftedPlayers: allDrafted.length,
        teamsCount: auctionData.teams.length,
      });
    }

    // Build a map of drafted players by team
    const draftedByTeam = new Map<string, Player[]>();
    allDrafted.forEach(p => {
      const team = p.draftedBy || 'Unknown';
      if (!draftedByTeam.has(team)) {
        draftedByTeam.set(team, []);
      }
      draftedByTeam.get(team)!.push(p);
    });

    // Pitcher positions for categorization
    const pitcherPositions = new Set(['SP', 'RP', 'P']);
    const isPitcher = (player: Player) =>
      player.positions.some(pos => pitcherPositions.has(pos));

    // Calculate stats for each team
    const teamsData: TeamRankingData[] = auctionData.teams.map(team => {
      const teamPlayers = draftedByTeam.get(team.name) || [];

      // Core metrics
      const totalZScore = teamPlayers.reduce((sum, p) => sum + (p.sgpValue || 0), 0);
      const moneySpent = teamPlayers.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
      const moneyRemaining = settings.budgetPerTeam - moneySpent;
      const dollarsPerZScore = totalZScore > 0 ? moneySpent / totalZScore : Infinity;

      // Position breakdown
      const hitters = teamPlayers.filter(p => !isPitcher(p));
      const pitchers = teamPlayers.filter(p => isPitcher(p));
      const hitterZScore = hitters.reduce((sum, p) => sum + (p.sgpValue || 0), 0);
      const pitcherZScore = pitchers.reduce((sum, p) => sum + (p.sgpValue || 0), 0);
      const hitterSpent = hitters.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
      const pitcherSpent = pitchers.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);

      // Value analysis - compare actual price to projected value
      const totalProjectedValue = teamPlayers.reduce((sum, p) => sum + (p.projectedValue || 0), 0);
      const totalActualSpent = moneySpent;
      const valueGained = totalProjectedValue - totalActualSpent; // Positive = bargains

      // DEBUG: Log detailed breakdown for specific teams
      if (import.meta.env.DEV && (team.name.toLowerCase().includes('marlin') || team.name === 'Marlins')) {
        console.log(`[TeamRankings] ${team.name} breakdown:`, {
          playerCount: teamPlayers.length,
          players: teamPlayers.map(p => ({
            name: p.name,
            projectedValue: p.projectedValue,
            draftedPrice: p.draftedPrice,
            sgpValue: p.sgpValue,
          })),
          totalProjectedValue,
          totalActualSpent,
          valueGained,
          isMobile,
        });
      }

      // Count bargains and overpays (10% threshold)
      let bargainCount = 0;
      let overpayCount = 0;
      teamPlayers.forEach(p => {
        const projVal = p.projectedValue || 0;
        const price = p.draftedPrice || 0;
        if (price < projVal * 0.9) bargainCount++;
        else if (price > projVal * 1.1) overpayCount++;
      });

      // Find best and worst picks
      let bestPick: { name: string; value: number; price: number } | null = null;
      let worstPick: { name: string; value: number; price: number } | null = null;
      let bestSavings = -Infinity;
      let worstOverpay = -Infinity;

      teamPlayers.forEach(p => {
        const projVal = p.projectedValue || 0;
        const price = p.draftedPrice || 0;
        const savings = projVal - price;

        if (savings > bestSavings && projVal > 0) {
          bestSavings = savings;
          bestPick = { name: p.name, value: projVal, price };
        }
        if (-savings > worstOverpay && projVal > 0) {
          worstOverpay = -savings;
          worstPick = { name: p.name, value: projVal, price };
        }
      });

      return {
        name: team.name,
        totalZScore,
        dollarsPerZScore,
        moneySpent,
        moneyRemaining,
        playersDrafted: teamPlayers.length,
        rosterSpotsTotal: totalRosterSpots,
        hitterZScore,
        pitcherZScore,
        hitterSpent,
        pitcherSpent,
        totalProjectedValue,
        totalActualSpent,
        valueGained,
        bargainCount,
        overpayCount,
        bestPick,
        worstPick,
        // Placeholders - will be filled in after sorting
        zScoreRank: 0,
        efficiencyRank: 0,
        valueRank: 0,
        overallRank: 0,
      };
    });

    // Calculate rankings for each metric
    // Z-Score rank (higher is better)
    const byZScore = [...teamsData].sort((a, b) => b.totalZScore - a.totalZScore);
    byZScore.forEach((team, idx) => {
      const original = teamsData.find(t => t.name === team.name);
      if (original) original.zScoreRank = idx + 1;
    });

    // Efficiency rank (lower $/Z is better, but handle teams with 0 Z-Score)
    const byEfficiency = [...teamsData].sort((a, b) => {
      // Teams with no Z-score go to the bottom
      if (a.totalZScore === 0 && b.totalZScore === 0) return 0;
      if (a.totalZScore === 0) return 1;
      if (b.totalZScore === 0) return -1;
      return a.dollarsPerZScore - b.dollarsPerZScore;
    });
    byEfficiency.forEach((team, idx) => {
      const original = teamsData.find(t => t.name === team.name);
      if (original) original.efficiencyRank = idx + 1;
    });

    // Value rank (higher value gained is better)
    const byValue = [...teamsData].sort((a, b) => b.valueGained - a.valueGained);
    byValue.forEach((team, idx) => {
      const original = teamsData.find(t => t.name === team.name);
      if (original) original.valueRank = idx + 1;
    });

    // Overall rank (weighted average of ranks - lower is better)
    // Weight: Z-Score 50%, Efficiency 30%, Value 20%
    teamsData.forEach(team => {
      team.overallRank = Math.round(
        team.zScoreRank * 0.5 +
        team.efficiencyRank * 0.3 +
        team.valueRank * 0.2
      );
    });

    // Re-rank overall by the calculated score
    const byOverall = [...teamsData].sort((a, b) => a.overallRank - b.overallRank);
    byOverall.forEach((team, idx) => {
      const original = teamsData.find(t => t.name === team.name);
      if (original) original.overallRank = idx + 1;
    });

    return teamsData;
  }, [auctionData, allDrafted, settings.budgetPerTeam, totalRosterSpots, isMobile]);

  // Sort teams
  const sortedTeams = useMemo(() => {
    const sorted = [...teamRankings];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'overallRank':
          comparison = a.overallRank - b.overallRank;
          break;
        case 'zScoreRank':
          comparison = a.zScoreRank - b.zScoreRank;
          break;
        case 'efficiencyRank':
          comparison = a.efficiencyRank - b.efficiencyRank;
          break;
        case 'valueRank':
          comparison = a.valueRank - b.valueRank;
          break;
        case 'moneyRemaining':
          comparison = b.moneyRemaining - a.moneyRemaining;
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
    return sorted;
  }, [teamRankings, sortBy, sortAsc]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(true);
    }
  };

  // League-wide stats for context
  const leagueStats = useMemo(() => {
    if (teamRankings.length === 0) return null;

    const avgZScore = teamRankings.reduce((sum, t) => sum + t.totalZScore, 0) / teamRankings.length;
    const avgEfficiency = teamRankings
      .filter(t => t.totalZScore > 0)
      .reduce((sum, t) => sum + t.dollarsPerZScore, 0) /
      teamRankings.filter(t => t.totalZScore > 0).length || 0;
    const totalSpent = teamRankings.reduce((sum, t) => sum + t.moneySpent, 0);
    const totalDrafted = teamRankings.reduce((sum, t) => sum + t.playersDrafted, 0);

    return { avgZScore, avgEfficiency, totalSpent, totalDrafted };
  }, [teamRankings]);

  // Save as image functionality
  const handleSaveAsImage = useCallback(async () => {
    setShowPrintView(true);
    // Wait for print view to render
    await new Promise(resolve => setTimeout(resolve, 150));

    if (printRef.current) {
      try {
        // Dynamic import html2canvas
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(printRef.current, {
          backgroundColor: '#1e293b',
          scale: 2,
          logging: false,
          useCORS: true,
        });

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create blob'));
          }, 'image/png');
        });

        const fileName = `team-rankings-${new Date().toISOString().split('T')[0]}.png`;

        // Try Web Share API first (works best on mobile)
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: 'image/png' });
          const shareData = { files: [file] };

          if (navigator.canShare(shareData)) {
            try {
              await navigator.share(shareData);
              setShowPrintView(false);
              return;
            } catch (shareError) {
              // User cancelled or share failed, fall through to download
              if ((shareError as Error).name === 'AbortError') {
                setShowPrintView(false);
                return;
              }
            }
          }
        }

        // Fallback: Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;

        // For mobile, we need to handle this differently
        if (isMobile) {
          // Open in new tab so user can long-press to save
          window.open(url, '_blank');
        } else {
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        // Clean up the URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error('Failed to save image:', error);
        alert('Failed to save image. Please try taking a screenshot instead.');
      }
    }
    setShowPrintView(false);
  }, [isMobile]);

  const RankBadge = ({ rank, size = 'normal' }: { rank: number; size?: 'normal' | 'small' }) => {
    const textSize = size === 'small' ? 'text-sm' : 'text-lg';
    if (rank === 1) return <span className={textSize}>🥇</span>;
    if (rank === 2) return <span className={textSize}>🥈</span>;
    if (rank === 3) return <span className={textSize}>🥉</span>;
    return <span className={`text-slate-400 ${size === 'small' ? 'text-xs' : 'text-sm'} font-medium`}>#{rank}</span>;
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // Don't render if not open
  if (!isOpen) return null;

  if (teamRankings.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="bg-slate-900 border border-slate-700 text-white max-w-md w-full rounded-lg p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold">Team Rankings</h2>
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
            <p className="text-slate-400">No auction data available yet.</p>
            <p className="text-slate-500 text-sm mt-1">Rankings will appear once the draft begins.</p>
          </div>
        </div>
      </div>
    );
  }

  // Print view - clean, simple layout for saving
  if (showPrintView) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <div
          ref={printRef}
          className="bg-slate-800 p-6 rounded-lg max-w-2xl w-full"
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-600">
            <Trophy className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl font-bold text-white">Team Rankings</h1>
            <span className="text-slate-400 text-sm ml-auto">
              {new Date().toLocaleDateString()}
            </span>
          </div>

          {leagueStats && (
            <div className="flex gap-6 mb-4 text-sm text-slate-300">
              <span>Avg Z: <strong className="text-emerald-400">{leagueStats.avgZScore.toFixed(1)}</strong></span>
              <span>Total Spent: <strong className="text-white">${leagueStats.totalSpent}</strong></span>
              <span>Drafted: <strong className="text-white">{leagueStats.totalDrafted}</strong></span>
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-slate-400">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Team</th>
                <th className="text-center py-2 px-2">Z</th>
                <th className="text-center py-2 px-2">$/Z</th>
                <th className="text-center py-2 px-2">Value</th>
                <th className="text-right py-2 px-2">$ Left</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr key={team.name} className="border-b border-slate-700/50">
                  <td className="py-2 px-2">
                    <RankBadge rank={team.overallRank} size="small" />
                  </td>
                  <td className="py-2 px-2 text-white font-medium">{team.name}</td>
                  <td className="py-2 px-2 text-center text-emerald-400">{team.totalZScore.toFixed(1)}</td>
                  <td className="py-2 px-2 text-center text-blue-400">
                    {team.totalZScore > 0 ? `$${team.dollarsPerZScore.toFixed(1)}` : '-'}
                  </td>
                  <td className={`py-2 px-2 text-center ${team.valueGained >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {team.valueGained >= 0 ? '+' : ''}{team.valueGained.toFixed(0)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-300">${team.moneyRemaining}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-slate-600 text-xs text-slate-500 flex gap-4">
            <span>Z = Total Value</span>
            <span>$/Z = Cost Efficiency</span>
            <span>Value = Savings vs Projected</span>
          </div>
        </div>
      </div>
    );
  }

  // Mobile view - full screen with simple scrolling list
  if (isMobile) {
    // Find Marlins data for debug display
    const marlinsTeam = teamRankings.find(t =>
      t.name.toLowerCase().includes('marlin') || t.name === 'Marlins'
    );
    const marlinsPlayers = allDrafted.filter(p =>
      p.draftedBy?.toLowerCase().includes('marlin') || p.draftedBy === 'Marlins'
    );

    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">Team Rankings</h2>
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

        {/* DEBUG: Data verification panel - shows raw data for comparison */}
        {/* Temporarily enabled in production for debugging */}
        {(
          <div className="px-3 py-2 bg-purple-900/30 border-b border-purple-500/30 text-xs">
            <div className="text-purple-300 font-semibold mb-1">DEBUG INFO (Mobile)</div>
            <div className="text-purple-200">
              Total Drafted: {allDrafted.length} | Teams: {auctionData?.teams?.length || 0}
            </div>
            <div className="text-purple-200/70 mt-0.5">
              Settings: {settings.numTeams}T, ${settings.budgetPerTeam}budget, {settings.projectionSystem}
            </div>
            <div className="text-purple-200/70">
              Cats: {settings.scoringCategories?.hitter?.length || 0}H/{settings.scoringCategories?.pitcher?.length || 0}P, HitSplit: {settings.hitterPitcherSplit || 'default'}
            </div>
            {marlinsTeam && (
              <div className="mt-1 text-purple-200">
                <div>Marlins: Val={marlinsTeam.valueGained.toFixed(0)}, Z={marlinsTeam.totalZScore.toFixed(1)}, $/Z=${marlinsTeam.dollarsPerZScore.toFixed(1)}</div>
                <div className="text-purple-300/70 mt-0.5">
                  ProjVal=${marlinsTeam.totalProjectedValue.toFixed(0)}, Spent=${marlinsTeam.totalActualSpent}
                </div>
              </div>
            )}
            {marlinsPlayers.length > 0 && (
              <details className="mt-1">
                <summary className="text-purple-300 cursor-pointer">Marlins Players ({marlinsPlayers.length})</summary>
                <div className="mt-1 pl-2 text-purple-200/80 max-h-32 overflow-y-auto">
                  {marlinsPlayers.map((p, i) => (
                    <div key={i} className="truncate">
                      {p.name}: proj=${p.projectedValue?.toFixed(0) || 0}, paid=${p.draftedPrice || 0}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* League Summary */}
        {leagueStats && (
          <div className="grid grid-cols-4 gap-1 px-3 py-2 border-b border-slate-700/50 bg-slate-800/50 text-xs">
            <div className="text-center">
              <div className="text-slate-500">Avg Z</div>
              <div className="text-emerald-400 font-semibold">{leagueStats.avgZScore.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-500">Avg $/Z</div>
              <div className="text-blue-400 font-semibold">${leagueStats.avgEfficiency.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-500">Spent</div>
              <div className="text-white font-semibold">${leagueStats.totalSpent}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-500">Drafted</div>
              <div className="text-white font-semibold">{leagueStats.totalDrafted}</div>
            </div>
          </div>
        )}

        {/* Column Headers - Fixed */}
        <div className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-slate-700 bg-slate-800 text-xs text-slate-400 font-medium">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-4">Team</div>
          <div className="col-span-2 text-center">Z</div>
          <div className="col-span-2 text-center">$/Z</div>
          <div className="col-span-2 text-center">Val</div>
          <div className="col-span-1 text-right">$</div>
        </div>

        {/* Scrollable Team List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {sortedTeams.map((team) => (
            <div
              key={team.name}
              className={`grid grid-cols-12 gap-1 px-3 py-3 border-b border-slate-700/30 items-center ${
                team.name === selectedTeam ? 'bg-emerald-900/30' : ''
              }`}
            >
              {/* Rank */}
              <div className="col-span-1 text-center">
                <RankBadge rank={team.overallRank} size="small" />
              </div>

              {/* Team Name */}
              <div className="col-span-4">
                <div className={`font-medium text-sm truncate ${team.name === selectedTeam ? 'text-emerald-300' : 'text-white'}`}>
                  {team.name}
                </div>
                <div className="text-xs text-slate-500">
                  {team.playersDrafted}/{team.rosterSpotsTotal}
                </div>
              </div>

              {/* Z-Score */}
              <div className="col-span-2 text-center">
                <div className="text-emerald-400 font-semibold text-sm">
                  {team.totalZScore.toFixed(1)}
                </div>
              </div>

              {/* $/Z */}
              <div className="col-span-2 text-center">
                <div className={`text-sm font-medium ${
                  team.totalZScore > 0
                    ? team.efficiencyRank <= 3 ? 'text-emerald-400' : 'text-blue-400'
                    : 'text-slate-500'
                }`}>
                  {team.totalZScore > 0 ? `$${team.dollarsPerZScore.toFixed(1)}` : '-'}
                </div>
              </div>

              {/* Value */}
              <div className="col-span-2 text-center">
                <div className={`text-sm font-semibold ${team.valueGained >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {team.valueGained >= 0 ? '+' : ''}{team.valueGained.toFixed(0)}
                </div>
              </div>

              {/* Money Remaining */}
              <div className="col-span-1 text-right">
                <div className={`text-sm font-medium ${
                  team.moneyRemaining > 50 ? 'text-emerald-400' :
                  team.moneyRemaining > 20 ? 'text-blue-400' : 'text-amber-400'
                }`}>
                  ${team.moneyRemaining}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend Footer */}
        <div className="flex justify-center gap-4 text-xs border-t border-slate-700 px-4 py-2 bg-slate-800">
          <span className="text-slate-500">Z=Value</span>
          <span className="text-slate-500">$/Z=Efficiency</span>
          <span className="text-slate-500">Val=Savings</span>
        </div>
      </div>
    );
  }

  // Desktop view
  // Find Marlins data for debug display (desktop)
  const marlinsTeamDesktop = teamRankings.find(t =>
    t.name.toLowerCase().includes('marlin') || t.name === 'Marlins'
  );
  const marlinsPlayersDesktop = allDrafted.filter(p =>
    p.draftedBy?.toLowerCase().includes('marlin') || p.draftedBy === 'Marlins'
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 text-white rounded-lg max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - compact */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold">Team Rankings</h2>
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

        {/* DEBUG: Data verification panel - shows raw data for comparison */}
        {/* Temporarily enabled in production for debugging */}
        {(
          <div className="px-4 py-2 bg-purple-900/30 border-b border-purple-500/30 text-xs shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-purple-300 font-semibold">DEBUG INFO (Desktop)</span>
              <span className="text-purple-200">Total Drafted: {allDrafted.length}</span>
              <span className="text-purple-200">Teams: {auctionData?.teams?.length || 0}</span>
              <span className="text-purple-200/70">Settings: {settings.numTeams}T, ${settings.budgetPerTeam}, {settings.projectionSystem}</span>
              <span className="text-purple-200/70">Cats: {settings.scoringCategories?.hitter?.length || 0}H/{settings.scoringCategories?.pitcher?.length || 0}P, Split: {settings.hitterPitcherSplit || 'def'}</span>
              {marlinsTeamDesktop && (
                <>
                  <span className="text-purple-200">Marlins Val={marlinsTeamDesktop.valueGained.toFixed(0)}</span>
                  <span className="text-purple-200">ProjVal=${marlinsTeamDesktop.totalProjectedValue.toFixed(0)}</span>
                  <span className="text-purple-200">Spent=${marlinsTeamDesktop.totalActualSpent}</span>
                </>
              )}
            </div>
            {marlinsPlayersDesktop.length > 0 && (
              <details className="mt-1">
                <summary className="text-purple-300 cursor-pointer">Marlins Players ({marlinsPlayersDesktop.length})</summary>
                <div className="mt-1 flex flex-wrap gap-2 text-purple-200/80">
                  {marlinsPlayersDesktop.map((p, i) => (
                    <span key={i} className="bg-purple-900/50 px-1 rounded">
                      {p.name.split(' ').pop()}: ${p.projectedValue?.toFixed(0) || 0}/${p.draftedPrice || 0}
                    </span>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* League Summary - compact */}
        {leagueStats && (
          <div className="flex gap-4 px-4 py-2 border-b border-slate-700/50 shrink-0 text-xs">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Avg Z:</span>
              <span className="text-emerald-400 font-semibold">{leagueStats.avgZScore.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Avg $/Z:</span>
              <span className="text-blue-400 font-semibold">${leagueStats.avgEfficiency.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Spent:</span>
              <span className="text-white font-semibold">${leagueStats.totalSpent}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400">Drafted:</span>
              <span className="text-white font-semibold">{leagueStats.totalDrafted}</span>
            </div>
          </div>
        )}

        {/* Scrollable Rankings Table */}
        <div className="flex-1 overflow-y-auto px-2 py-1" style={{ minHeight: 0 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="border-b border-slate-700/50">
                  <th
                    className="text-left py-1.5 px-1.5 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('overallRank')}
                    title="Overall Rank - Combined ranking based on Z-Score, efficiency, and value gained"
                  >
                    <div className="flex items-center gap-0.5">
                      <Medal className="w-3 h-3" /> # <SortIcon column="overallRank" />
                    </div>
                  </th>
                  <th className="text-left py-1.5 px-1.5 text-slate-400 font-medium" title="Team name and roster progress (drafted/total spots)">Team</th>
                  <th
                    className="text-center py-1.5 px-1.5 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('zScoreRank')}
                    title="Total Z-Score - Sum of all drafted players' projected value. Higher = better team"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      Z <SortIcon column="zScoreRank" />
                    </div>
                  </th>
                  <th
                    className="text-center py-1.5 px-1.5 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('efficiencyRank')}
                    title="Cost Efficiency - Dollars spent per Z-Score point. Lower = more efficient spending"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      $/Z <SortIcon column="efficiencyRank" />
                    </div>
                  </th>
                  <th
                    className="text-center py-1.5 px-1.5 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('valueRank')}
                    title="Value Gained - Difference between projected value and actual cost. Positive = got bargains"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      Val <SortIcon column="valueRank" />
                    </div>
                  </th>
                  <th className="text-center py-1.5 px-1.5 text-slate-400 font-medium" title="Hitter Z-Score - Total projected value from position players">Hit</th>
                  <th className="text-center py-1.5 px-1.5 text-slate-400 font-medium" title="Pitcher Z-Score - Total projected value from pitchers">Pitch</th>
                  <th
                    className="text-right py-1.5 px-1.5 text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('moneyRemaining')}
                    title="Budget Remaining - Money left to spend on remaining roster spots"
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      $ <SortIcon column="moneyRemaining" />
                    </div>
                  </th>
                  <th className="text-center py-1.5 px-1.5 text-slate-400 font-medium" title="Best Pick - The player with the best value relative to their cost">Best</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team) => (
                  <tr
                    key={team.name}
                    className={`border-b border-slate-700/30 transition-colors ${
                      team.name === selectedTeam
                        ? 'bg-emerald-900/20'
                        : 'hover:bg-slate-700/30'
                    }`}
                  >
                    {/* Overall Rank */}
                    <td className="py-1 px-1.5 text-center">
                      <RankBadge rank={team.overallRank} />
                    </td>

                    {/* Team Name */}
                    <td className="py-1 px-1.5">
                      <span className={`font-medium ${team.name === selectedTeam ? 'text-emerald-300' : 'text-white'}`}>
                        {team.name}
                      </span>
                      <span className="text-slate-500 ml-1">{team.playersDrafted}/{team.rosterSpotsTotal}</span>
                    </td>

                    {/* Z-Score */}
                    <td className="py-1 px-1.5 text-center">
                      <span className="text-emerald-400 font-semibold">{team.totalZScore.toFixed(1)}</span>
                    </td>

                    {/* Efficiency ($/Z) */}
                    <td className="py-1 px-1.5 text-center">
                      {team.totalZScore > 0 ? (
                        <span className={`font-semibold ${
                          team.efficiencyRank <= 3 ? 'text-emerald-400' :
                          team.efficiencyRank <= 6 ? 'text-blue-400' : 'text-slate-300'
                        }`}>
                          ${team.dollarsPerZScore.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* Value Gained */}
                    <td className="py-1 px-1.5 text-center">
                      <span className={`font-semibold ${team.valueGained >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {team.valueGained >= 0 ? '+' : ''}{team.valueGained.toFixed(0)}
                      </span>
                    </td>

                    {/* Hitters */}
                    <td className="py-1 px-1.5 text-center">
                      <span className="text-amber-400">{team.hitterZScore.toFixed(1)}</span>
                    </td>

                    {/* Pitchers */}
                    <td className="py-1 px-1.5 text-center">
                      <span className="text-purple-400">{team.pitcherZScore.toFixed(1)}</span>
                    </td>

                    {/* Money Remaining */}
                    <td className="py-1 px-1.5 text-right">
                      <span className={`font-semibold ${
                        team.moneyRemaining > 50 ? 'text-emerald-400' :
                        team.moneyRemaining > 20 ? 'text-blue-400' : 'text-amber-400'
                      }`}>
                        ${team.moneyRemaining}
                      </span>
                    </td>

                    {/* Best Pick */}
                    <td className="py-1 px-1.5 text-center">
                      {team.bestPick ? (
                        <span className="text-slate-300" title={`${team.bestPick.name}: $${team.bestPick.price} (proj $${team.bestPick.value.toFixed(0)})`}>
                          {team.bestPick.name.split(' ').slice(-1)[0]}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend - compact */}
        <div className="flex flex-wrap items-center gap-3 text-xs border-t border-slate-700 px-4 py-2 shrink-0 bg-slate-900">
          <span className="text-slate-500">Z=Total value</span>
          <span className="text-slate-500">$/Z=Cost efficiency</span>
          <span className="text-slate-500">Val=Savings vs projected</span>
          <span className="text-amber-400">Hit</span>
          <span className="text-purple-400">Pitch</span>
        </div>
      </div>
    </div>
  );
}

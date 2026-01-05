import { useState, useMemo, useCallback } from 'react';
import { SavedLeague, Player } from '../lib/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { useIsMobile } from './ui/use-mobile';
import {
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  Users,
} from 'lucide-react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LeagueProjectionsProps {
  league: SavedLeague;
  onBack: () => void;
}

type PlayerType = 'all' | 'hitters' | 'pitchers';

type SortField =
  | 'rank'
  | 'name'
  | 'team'
  | 'positions'
  | 'projectedValue'
  | 'zScore'
  | 'tier'
  // Hitter stats
  | 'HR'
  | 'RBI'
  | 'SB'
  | 'AVG'
  | 'R'
  // Pitcher stats
  | 'W'
  | 'K'
  | 'ERA'
  | 'WHIP'
  | 'SV'
  | 'IP';

type SortDirection = 'asc' | 'desc';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Check if a player is a pitcher based on positions
 */
function isPitcher(player: Player): boolean {
  return player.positions.some((p) => ['SP', 'RP', 'P'].includes(p));
}

/**
 * Check if a player is a hitter (non-pitcher positions)
 */
function isHitter(player: Player): boolean {
  return player.positions.some((p) => !['SP', 'RP', 'P'].includes(p));
}

/**
 * Format a number for display (handles nullish values)
 */
function formatStat(value: number | undefined, decimals = 0): string {
  if (value === undefined || value === null) return '-';
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}

/**
 * Generate CSV content from player data
 */
function generateCSV(
  players: Player[],
  playerType: PlayerType
): string {
  // Define columns based on player type
  const baseColumns = ['Rank', 'Name', 'Team', 'Position(s)', 'Projected Value ($)', 'Z-Score', 'Tier'];

  const hitterStatColumns = ['HR', 'RBI', 'SB', 'AVG', 'R'];
  const pitcherStatColumns = ['W', 'K', 'ERA', 'WHIP', 'SV', 'IP'];

  let statColumns: string[];
  if (playerType === 'hitters') {
    statColumns = hitterStatColumns;
  } else if (playerType === 'pitchers') {
    statColumns = pitcherStatColumns;
  } else {
    // All players - include both stat sets
    statColumns = [...hitterStatColumns, ...pitcherStatColumns];
  }

  const columns = [...baseColumns, ...statColumns];

  // Create CSV header
  const header = columns.join(',');

  // Create CSV rows
  const rows = players.map((player, index) => {
    const baseValues = [
      index + 1, // Rank
      `"${player.name.replace(/"/g, '""')}"`, // Escape quotes in names
      player.team,
      `"${player.positions.join(', ')}"`,
      player.projectedValue.toFixed(2),
      player.sgpValue?.toFixed(2) ?? '-',
      player.tier ?? '-',
    ];

    let statValues: (string | number)[];
    if (playerType === 'hitters') {
      statValues = [
        player.projectedStats.HR ?? '-',
        player.projectedStats.RBI ?? '-',
        player.projectedStats.SB ?? '-',
        player.projectedStats.AVG?.toFixed(3) ?? '-',
        player.projectedStats.R ?? '-',
      ];
    } else if (playerType === 'pitchers') {
      statValues = [
        player.projectedStats.W ?? '-',
        player.projectedStats.K ?? '-',
        player.projectedStats.ERA?.toFixed(2) ?? '-',
        player.projectedStats.WHIP?.toFixed(2) ?? '-',
        player.projectedStats.SV ?? '-',
        player.projectedStats.IP?.toFixed(1) ?? '-',
      ];
    } else {
      // All players - include both stat sets
      statValues = [
        player.projectedStats.HR ?? '-',
        player.projectedStats.RBI ?? '-',
        player.projectedStats.SB ?? '-',
        player.projectedStats.AVG?.toFixed(3) ?? '-',
        player.projectedStats.R ?? '-',
        player.projectedStats.W ?? '-',
        player.projectedStats.K ?? '-',
        player.projectedStats.ERA?.toFixed(2) ?? '-',
        player.projectedStats.WHIP?.toFixed(2) ?? '-',
        player.projectedStats.SV ?? '-',
        player.projectedStats.IP?.toFixed(1) ?? '-',
      ];
    }

    return [...baseValues, ...statValues].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LeagueProjections({ league, onBack }: LeagueProjectionsProps) {
  const isMobile = useIsMobile();

  // State
  const [playerType, setPlayerType] = useState<PlayerType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('projectedValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter players to only include those in draft pool
  const draftPoolPlayers = useMemo(() => {
    return league.players.filter((p) => p.isInDraftPool !== false);
  }, [league.players]);

  // Apply filters and sorting
  const filteredPlayers = useMemo(() => {
    let result = [...draftPoolPlayers];

    // Filter by player type
    if (playerType === 'hitters') {
      result = result.filter((p) => isHitter(p) && !isPitcher(p));
    } else if (playerType === 'pitchers') {
      result = result.filter(isPitcher);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        p.team.toLowerCase().includes(query) ||
        p.positions.some((pos) => pos.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      switch (sortField) {
        case 'rank':
          // Rank is derived from projected value
          aVal = a.projectedValue;
          bVal = b.projectedValue;
          // Reverse for rank since higher value = lower rank
          return sortDirection === 'asc'
            ? (bVal ?? 0) - (aVal ?? 0)
            : (aVal ?? 0) - (bVal ?? 0);
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        case 'team':
          aVal = a.team.toLowerCase();
          bVal = b.team.toLowerCase();
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        case 'positions':
          aVal = a.positions.join(',').toLowerCase();
          bVal = b.positions.join(',').toLowerCase();
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        case 'projectedValue':
          aVal = a.projectedValue;
          bVal = b.projectedValue;
          break;
        case 'zScore':
          aVal = a.sgpValue ?? 0;
          bVal = b.sgpValue ?? 0;
          break;
        case 'tier':
          aVal = a.tier ?? 999;
          bVal = b.tier ?? 999;
          break;
        // Hitter stats
        case 'HR':
          aVal = a.projectedStats.HR ?? 0;
          bVal = b.projectedStats.HR ?? 0;
          break;
        case 'RBI':
          aVal = a.projectedStats.RBI ?? 0;
          bVal = b.projectedStats.RBI ?? 0;
          break;
        case 'SB':
          aVal = a.projectedStats.SB ?? 0;
          bVal = b.projectedStats.SB ?? 0;
          break;
        case 'AVG':
          aVal = a.projectedStats.AVG ?? 0;
          bVal = b.projectedStats.AVG ?? 0;
          break;
        case 'R':
          aVal = a.projectedStats.R ?? 0;
          bVal = b.projectedStats.R ?? 0;
          break;
        // Pitcher stats
        case 'W':
          aVal = a.projectedStats.W ?? 0;
          bVal = b.projectedStats.W ?? 0;
          break;
        case 'K':
          aVal = a.projectedStats.K ?? 0;
          bVal = b.projectedStats.K ?? 0;
          break;
        case 'ERA':
          aVal = a.projectedStats.ERA ?? 999;
          bVal = b.projectedStats.ERA ?? 999;
          // ERA: lower is better, so reverse default sort
          return sortDirection === 'asc'
            ? (aVal ?? 999) - (bVal ?? 999)
            : (bVal ?? 999) - (aVal ?? 999);
        case 'WHIP':
          aVal = a.projectedStats.WHIP ?? 999;
          bVal = b.projectedStats.WHIP ?? 999;
          // WHIP: lower is better, so reverse default sort
          return sortDirection === 'asc'
            ? (aVal ?? 999) - (bVal ?? 999)
            : (bVal ?? 999) - (aVal ?? 999);
        case 'SV':
          aVal = a.projectedStats.SV ?? 0;
          bVal = b.projectedStats.SV ?? 0;
          break;
        case 'IP':
          aVal = a.projectedStats.IP ?? 0;
          bVal = b.projectedStats.IP ?? 0;
          break;
        default:
          return 0;
      }

      // Default numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return result;
  }, [draftPoolPlayers, playerType, searchQuery, sortField, sortDirection]);

  // Handle column header click for sorting
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // Set new field with default direction
      setSortField(field);
      // Default to desc for most fields, asc for ERA/WHIP (lower is better)
      setSortDirection(field === 'ERA' || field === 'WHIP' ? 'asc' : 'desc');
    }
  }, [sortField]);

  // Handle CSV export
  const handleExport = useCallback(() => {
    const csv = generateCSV(filteredPlayers, playerType);
    const date = new Date().toISOString().split('T')[0];
    const sanitizedLeagueName = league.leagueName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const filename = `${sanitizedLeagueName}_projections_${date}.csv`;
    downloadCSV(csv, filename);
  }, [filteredPlayers, playerType, league.leagueName]);

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 text-orange-400" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-orange-400" />
    );
  };

  // Sortable header component
  const SortableHeader = ({
    field,
    children,
    className = '',
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={`cursor-pointer hover:bg-slate-700/50 transition-colors select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        <SortIndicator field={field} />
      </div>
    </TableHead>
  );

  // Determine which stat columns to show based on player type
  const showHitterStats = playerType === 'all' || playerType === 'hitters';
  const showPitcherStats = playerType === 'all' || playerType === 'pitchers';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0d0d0d' }}>
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-20 left-10 w-96 h-96 rounded-full"
          style={{
            background:
              'linear-gradient(135deg, #f59e0b30, #ea580c20, transparent)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute top-40 right-10 w-80 h-80 rounded-full"
          style={{
            background:
              'linear-gradient(225deg, #d946ef20, #9333ea15, transparent)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute bottom-20 left-1/3 w-72 h-72 rounded-full"
          style={{
            background: 'linear-gradient(45deg, #f43f5e20, transparent)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      <div
        className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${
          isMobile ? 'py-4' : 'py-8'
        }`}
      >
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-4 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div
            className={`flex ${
              isMobile ? 'flex-col gap-4' : 'items-center justify-between'
            }`}
          >
            <div>
              <h1
                className={`${
                  isMobile ? 'text-2xl' : 'text-3xl'
                } font-bold text-white`}
              >
                {league.leagueName} - Projections
              </h1>
              <p className="text-slate-400 mt-1 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {draftPoolPlayers.length} players in draft pool
              </p>
            </div>

            <Button
              onClick={handleExport}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/30"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <div
          className={`rounded-xl p-4 mb-6 backdrop-blur-sm ${
            isMobile ? 'space-y-4' : 'flex items-center gap-4'
          }`}
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Search */}
          <div className={`relative ${isMobile ? 'w-full' : 'w-80'}`}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Search by name, team, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-orange-500 focus-visible:border-orange-500"
            />
          </div>

          {/* Player Type Tabs */}
          <Tabs
            value={playerType}
            onValueChange={(v: string) => setPlayerType(v as PlayerType)}
            className={isMobile ? 'w-full' : ''}
          >
            <TabsList className="bg-slate-800 border border-slate-700">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white text-slate-400"
              >
                All Players
              </TabsTrigger>
              <TabsTrigger
                value="hitters"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white text-slate-400"
              >
                Hitters
              </TabsTrigger>
              <TabsTrigger
                value="pitchers"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white text-slate-400"
              >
                Pitchers
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Results count */}
          <div className={`text-slate-400 text-sm ${isMobile ? '' : 'ml-auto'}`}>
            Showing {filteredPlayers.length} of {draftPoolPlayers.length} players
          </div>
        </div>

        {/* Table Section */}
        <div
          className="rounded-xl overflow-hidden backdrop-blur-sm"
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {isMobile ? (
            // Mobile Card Layout
            <div className="divide-y divide-slate-800">
              {filteredPlayers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No players match your search criteria
                </div>
              ) : (
                filteredPlayers.map((player, index) => {
                  const playerIsPitcher = isPitcher(player);
                  return (
                    <div
                      key={player.id}
                      className="p-4 hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-sm">
                              #{index + 1}
                            </span>
                            <span className="text-white font-medium truncate">
                              {player.name}
                            </span>
                            {player.tier && (
                              <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                                T{player.tier}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-sm mt-0.5">
                            {player.team} - {player.positions.join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold text-lg">
                            ${player.projectedValue.toFixed(2)}
                          </div>
                          {player.sgpValue !== undefined && (
                            <div className="text-blue-400 text-xs">
                              Z: {player.sgpValue.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {playerIsPitcher ? (
                          <>
                            <span className="text-slate-400">
                              W:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.W)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              K:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.K)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              ERA:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.ERA, 2)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              WHIP:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.WHIP, 2)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              SV:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.SV)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              IP:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.IP, 1)}
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-400">
                              HR:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.HR)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              RBI:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.RBI)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              SB:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.SB)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              AVG:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.AVG, 3)}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              R:{' '}
                              <span className="text-white">
                                {formatStat(player.projectedStats.R)}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // Desktop Table Layout
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 bg-slate-800/80 hover:bg-slate-800/80">
                  <SortableHeader field="rank" className="w-16 text-slate-300">
                    Rank
                  </SortableHeader>
                  <SortableHeader field="name" className="min-w-[180px] text-slate-300">
                    Name
                  </SortableHeader>
                  <SortableHeader field="team" className="w-20 text-slate-300">
                    Team
                  </SortableHeader>
                  <SortableHeader field="positions" className="w-24 text-slate-300">
                    Pos
                  </SortableHeader>
                  <SortableHeader
                    field="projectedValue"
                    className="w-24 text-emerald-400"
                  >
                    Value $
                  </SortableHeader>
                  <SortableHeader
                    field="zScore"
                    className="w-20 text-blue-400"
                  >
                    Z-Score
                  </SortableHeader>
                  <SortableHeader field="tier" className="w-16 text-slate-300">
                    Tier
                  </SortableHeader>

                  {/* Hitter Stats */}
                  {showHitterStats && (
                    <>
                      <SortableHeader field="HR" className="w-14 text-slate-300">
                        HR
                      </SortableHeader>
                      <SortableHeader field="RBI" className="w-14 text-slate-300">
                        RBI
                      </SortableHeader>
                      <SortableHeader field="SB" className="w-14 text-slate-300">
                        SB
                      </SortableHeader>
                      <SortableHeader field="AVG" className="w-16 text-slate-300">
                        AVG
                      </SortableHeader>
                      <SortableHeader field="R" className="w-14 text-slate-300">
                        R
                      </SortableHeader>
                    </>
                  )}

                  {/* Pitcher Stats */}
                  {showPitcherStats && (
                    <>
                      <SortableHeader field="W" className="w-14 text-slate-300">
                        W
                      </SortableHeader>
                      <SortableHeader field="K" className="w-14 text-slate-300">
                        K
                      </SortableHeader>
                      <SortableHeader field="ERA" className="w-16 text-slate-300">
                        ERA
                      </SortableHeader>
                      <SortableHeader field="WHIP" className="w-16 text-slate-300">
                        WHIP
                      </SortableHeader>
                      <SortableHeader field="SV" className="w-14 text-slate-300">
                        SV
                      </SortableHeader>
                      <SortableHeader field="IP" className="w-14 text-slate-300">
                        IP
                      </SortableHeader>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={
                        7 +
                        (showHitterStats ? 5 : 0) +
                        (showPitcherStats ? 6 : 0)
                      }
                      className="h-24 text-center text-slate-500"
                    >
                      No players match your search criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlayers.map((player, index) => {
                    const playerIsPitcher = isPitcher(player);
                    const playerIsHitter = isHitter(player);

                    return (
                      <TableRow
                        key={player.id}
                        className="border-slate-800 hover:bg-slate-800/50 transition-colors"
                      >
                        <TableCell className="text-slate-400 font-mono">
                          {index + 1}
                        </TableCell>
                        <TableCell className="text-white font-medium">
                          {player.name}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {player.team}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {player.positions.join(', ')}
                        </TableCell>
                        <TableCell className="text-emerald-400 font-bold">
                          ${player.projectedValue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-blue-400 font-medium">
                          {player.sgpValue?.toFixed(2) ?? '-'}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {player.tier ?? '-'}
                        </TableCell>

                        {/* Hitter Stats */}
                        {showHitterStats && (
                          <>
                            <TableCell
                              className={
                                playerIsHitter ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.HR)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsHitter ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.RBI)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsHitter ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.SB)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsHitter ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.AVG, 3)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsHitter ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.R)}
                            </TableCell>
                          </>
                        )}

                        {/* Pitcher Stats */}
                        {showPitcherStats && (
                          <>
                            <TableCell
                              className={
                                playerIsPitcher ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.W)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsPitcher ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.K)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsPitcher ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.ERA, 2)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsPitcher ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.WHIP, 2)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsPitcher ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.SV)}
                            </TableCell>
                            <TableCell
                              className={
                                playerIsPitcher ? 'text-white' : 'text-slate-600'
                              }
                            >
                              {formatStat(player.projectedStats.IP, 1)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-slate-500 text-sm">
          <p>
            Projections based on {league.settings.projectionSystem.toUpperCase()} system
            {' | '}
            {league.settings.scoringType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
        </div>
      </div>
    </div>
  );
}

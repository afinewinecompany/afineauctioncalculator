import { useState, useMemo, useCallback } from 'react';
import { SavedLeague, Player } from '../lib/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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

// Player status types for filtering (matches Couch Managers data)
type PlayerStatus = 'available' | 'on_block' | 'drafted';

// Status filter configuration with styling for toggle buttons
const STATUS_OPTIONS: {
  value: PlayerStatus;
  label: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    value: 'available',
    label: 'Available',
    activeClass: 'bg-emerald-600 text-white border-emerald-500',
    inactiveClass: 'bg-slate-800 text-slate-400 border-slate-600 hover:border-emerald-500/50',
  },
  {
    value: 'on_block',
    label: 'On Block',
    activeClass: 'bg-amber-600 text-white border-amber-500',
    inactiveClass: 'bg-slate-800 text-slate-400 border-slate-600 hover:border-amber-500/50',
  },
  {
    value: 'drafted',
    label: 'Drafted',
    activeClass: 'bg-slate-600 text-white border-slate-500',
    inactiveClass: 'bg-slate-800 text-slate-500 border-slate-600 hover:border-slate-400/50',
  },
];

type SortField =
  | 'rank'
  | 'name'
  | 'team'
  | 'positions'
  | 'projectedValue'
  | 'zScore'
  | 'tier'
  // Hitter stats (any stat from hittingCategories)
  | 'HR'
  | 'RBI'
  | 'SB'
  | 'AVG'
  | 'R'
  | 'H'
  | 'OBP'
  | 'SLG'
  | 'OPS'
  | 'BB'
  // Pitcher stats (any stat from pitchingCategories)
  | 'W'
  | 'K'
  | 'ERA'
  | 'WHIP'
  | 'SV'
  | 'IP'
  | 'QS'
  | 'HLD'
  | 'K/BF%'
  | 'BB%';

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
function formatStat(value: number | undefined, decimals = 0, isPercentage = false): string {
  if (value === undefined || value === null) return '-';
  // For percentage stats (K/BF%, BB%), the value is stored as a decimal (0.30 for 30%)
  // Multiply by 100 for display
  const displayValue = isPercentage ? value * 100 : value;
  return decimals > 0 ? displayValue.toFixed(decimals) : String(Math.round(displayValue));
}

/**
 * Category configuration for display formatting
 */
interface StatConfig {
  key: string;
  label: string;
  decimals: number;
  isLowerBetter?: boolean; // For stats like ERA, WHIP where lower is better
  isPercentage?: boolean;  // For stats stored as decimals that display as percentages
}

/**
 * Get enabled hitting categories from league settings
 */
function getEnabledHittingCategories(settings: SavedLeague['settings']): StatConfig[] {
  const categories: StatConfig[] = [];
  const hc = settings.hittingCategories;

  if (!hc) {
    // Default categories if none configured
    return [
      { key: 'HR', label: 'HR', decimals: 0 },
      { key: 'RBI', label: 'RBI', decimals: 0 },
      { key: 'SB', label: 'SB', decimals: 0 },
      { key: 'AVG', label: 'AVG', decimals: 3 },
      { key: 'R', label: 'R', decimals: 0 },
    ];
  }

  // Core counting stats
  if (hc.R) categories.push({ key: 'R', label: 'R', decimals: 0 });
  if (hc.HR) categories.push({ key: 'HR', label: 'HR', decimals: 0 });
  if (hc.RBI) categories.push({ key: 'RBI', label: 'RBI', decimals: 0 });
  if (hc.SB) categories.push({ key: 'SB', label: 'SB', decimals: 0 });
  if (hc.H) categories.push({ key: 'H', label: 'H', decimals: 0 });
  if (hc.BB) categories.push({ key: 'BB', label: 'BB', decimals: 0 });

  // Rate stats
  if (hc.AVG) categories.push({ key: 'AVG', label: 'AVG', decimals: 3 });
  if (hc.OBP) categories.push({ key: 'OBP', label: 'OBP', decimals: 3 });
  if (hc.SLG) categories.push({ key: 'SLG', label: 'SLG', decimals: 3 });
  if (hc.OPS) categories.push({ key: 'OPS', label: 'OPS', decimals: 3 });

  return categories;
}

/**
 * Get enabled pitching categories from league settings
 */
function getEnabledPitchingCategories(settings: SavedLeague['settings']): StatConfig[] {
  const categories: StatConfig[] = [];
  const pc = settings.pitchingCategories;

  if (!pc) {
    // Default categories if none configured
    return [
      { key: 'W', label: 'W', decimals: 0 },
      { key: 'K', label: 'K', decimals: 0 },
      { key: 'ERA', label: 'ERA', decimals: 2, isLowerBetter: true },
      { key: 'WHIP', label: 'WHIP', decimals: 2, isLowerBetter: true },
      { key: 'SV', label: 'SV', decimals: 0 },
      { key: 'IP', label: 'IP', decimals: 1 },
    ];
  }

  // Core stats
  if (pc.W) categories.push({ key: 'W', label: 'W', decimals: 0 });
  if (pc.K) categories.push({ key: 'K', label: 'K', decimals: 0 });
  if (pc.ERA) categories.push({ key: 'ERA', label: 'ERA', decimals: 2, isLowerBetter: true });
  if (pc.WHIP) categories.push({ key: 'WHIP', label: 'WHIP', decimals: 2, isLowerBetter: true });
  if (pc.SV) categories.push({ key: 'SV', label: 'SV', decimals: 0 });
  if (pc.QS) categories.push({ key: 'QS', label: 'QS', decimals: 0 });
  if (pc.HLD) categories.push({ key: 'HLD', label: 'HLD', decimals: 0 });
  if (pc.IP) categories.push({ key: 'IP', label: 'IP', decimals: 1 });

  // Rate stats - K/BF% (same as K%) and BB%
  // Check for both K/BF% and K% settings since they mean the same thing
  if (pc['K/BF%'] || pc['K%']) {
    categories.push({ key: 'K/BF%', label: 'K%', decimals: 1, isPercentage: true });
  }
  if (pc['BB%']) {
    categories.push({ key: 'BB%', label: 'BB%', decimals: 1, isLowerBetter: true, isPercentage: true });
  }

  return categories;
}

/**
 * Generate CSV content from player data
 */
function generateCSV(
  players: Player[],
  playerType: PlayerType,
  hittingCategories: StatConfig[],
  pitchingCategories: StatConfig[]
): string {
  // Define columns based on player type
  const baseColumns = ['Rank', 'Name', 'Team', 'Position(s)', 'Projected Value ($)', 'Z-Score', 'Tier'];

  let statColumns: string[];
  if (playerType === 'hitters') {
    statColumns = hittingCategories.map(c => c.label);
  } else if (playerType === 'pitchers') {
    statColumns = pitchingCategories.map(c => c.label);
  } else {
    // All players - include both stat sets
    statColumns = [...hittingCategories.map(c => c.label), ...pitchingCategories.map(c => c.label)];
  }

  const columns = [...baseColumns, ...statColumns];

  // Create CSV header
  const header = columns.join(',');

  // Helper to get stat value from player
  const getStatValue = (player: Player, config: StatConfig): string => {
    const value = player.projectedStats[config.key as keyof typeof player.projectedStats];
    if (value === undefined || value === null) return '-';
    // For percentage stats, multiply by 100 for display
    const displayValue = config.isPercentage ? value * 100 : value;
    return config.decimals > 0 ? displayValue.toFixed(config.decimals) : String(Math.round(displayValue));
  };

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

    let statValues: string[];
    if (playerType === 'hitters') {
      statValues = hittingCategories.map(c => getStatValue(player, c));
    } else if (playerType === 'pitchers') {
      statValues = pitchingCategories.map(c => getStatValue(player, c));
    } else {
      // All players - include both stat sets
      statValues = [
        ...hittingCategories.map(c => getStatValue(player, c)),
        ...pitchingCategories.map(c => getStatValue(player, c)),
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
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [statusFilters, setStatusFilters] = useState<Set<PlayerStatus>>(
    new Set<PlayerStatus>(['available', 'on_block', 'drafted']) // All selected by default
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('projectedValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Toggle a status filter
  // Behavior:
  // - If clicking on an already-selected status when multiple are selected: select ONLY that status
  // - If clicking on a not-selected status: add it to selection
  // - If clicking on the only selected status: no change (keep at least one selected)
  const toggleStatusFilter = useCallback((status: PlayerStatus) => {
    setStatusFilters((prev) => {
      const isCurrentlySelected = prev.has(status);

      if (isCurrentlySelected && prev.size > 1) {
        // Clicking on an already-selected status when multiple are selected:
        // Select ONLY this status (exclusive selection)
        return new Set<PlayerStatus>([status]);
      } else if (!isCurrentlySelected) {
        // Clicking on a not-selected status: add it
        const next = new Set(prev);
        next.add(status);
        return next;
      }
      // Clicking on the only selected status: no change
      return prev;
    });
  }, []);

  // Get enabled scoring categories from league settings
  const enabledHittingCategories = useMemo(
    () => getEnabledHittingCategories(league.settings),
    [league.settings]
  );
  const enabledPitchingCategories = useMemo(
    () => getEnabledPitchingCategories(league.settings),
    [league.settings]
  );

  // Filter players to only include those in draft pool
  const draftPoolPlayers = useMemo(() => {
    return league.players.filter((p) => p.isInDraftPool !== false);
  }, [league.players]);

  // Get available positions from all players
  const availablePositions = useMemo(() => {
    const positionSet = new Set<string>();
    draftPoolPlayers.forEach((p) => {
      p.positions.forEach((pos) => positionSet.add(pos));
    });
    // Sort positions: C, 1B, 2B, 3B, SS, OF, DH, then pitchers SP, RP, P
    const hitterOrder = ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'UTIL'];
    const pitcherOrder = ['SP', 'RP', 'P'];
    const sorted = Array.from(positionSet).sort((a, b) => {
      const aHitterIdx = hitterOrder.indexOf(a);
      const bHitterIdx = hitterOrder.indexOf(b);
      const aPitcherIdx = pitcherOrder.indexOf(a);
      const bPitcherIdx = pitcherOrder.indexOf(b);

      // Both are hitters
      if (aHitterIdx !== -1 && bHitterIdx !== -1) return aHitterIdx - bHitterIdx;
      // Both are pitchers
      if (aPitcherIdx !== -1 && bPitcherIdx !== -1) return aPitcherIdx - bPitcherIdx;
      // a is hitter, b is pitcher - hitters first
      if (aHitterIdx !== -1 && bPitcherIdx !== -1) return -1;
      // a is pitcher, b is hitter - hitters first
      if (aPitcherIdx !== -1 && bHitterIdx !== -1) return 1;
      // Unknown positions - alphabetical
      return a.localeCompare(b);
    });
    return sorted;
  }, [draftPoolPlayers]);

  // Apply filters and sorting
  const filteredPlayers = useMemo(() => {
    let result = [...draftPoolPlayers];

    // Filter by player type
    if (playerType === 'hitters') {
      result = result.filter((p) => isHitter(p) && !isPitcher(p));
    } else if (playerType === 'pitchers') {
      result = result.filter(isPitcher);
    }

    // Filter by position
    if (positionFilter !== 'all') {
      result = result.filter((p) => p.positions.includes(positionFilter));
    }

    // Filter by player status (available, on_block, drafted/gone)
    // Map player status to our filter categories
    result = result.filter((p) => {
      // Map 'onMyTeam' to 'drafted' for filtering purposes
      // Players without a status (not synced with Couch Managers) are treated as 'available'
      let filterStatus: PlayerStatus;
      if (!p.status || p.status === 'available') {
        filterStatus = 'available';
      } else if (p.status === 'onMyTeam' || p.status === 'drafted') {
        filterStatus = 'drafted';
      } else if (p.status === 'on_block') {
        filterStatus = 'on_block';
      } else {
        filterStatus = 'available'; // fallback
      }
      return statusFilters.has(filterStatus);
    });

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

      // Check if it's a stat category (check both hitting and pitching categories)
      const allCategories = [...enabledHittingCategories, ...enabledPitchingCategories];
      const categoryConfig = allCategories.find(c => c.key === sortField);

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
        default:
          // Handle dynamic stat categories
          if (categoryConfig) {
            const key = sortField as keyof typeof a.projectedStats;
            const defaultVal = categoryConfig.isLowerBetter ? 999 : 0;
            aVal = a.projectedStats[key] ?? defaultVal;
            bVal = b.projectedStats[key] ?? defaultVal;

            // For stats where lower is better (ERA, WHIP), reverse the sort
            if (categoryConfig.isLowerBetter) {
              return sortDirection === 'asc'
                ? (aVal ?? 999) - (bVal ?? 999)
                : (bVal ?? 999) - (aVal ?? 999);
            }
          } else {
            return 0;
          }
      }

      // Default numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return result;
  }, [draftPoolPlayers, playerType, positionFilter, statusFilters, searchQuery, sortField, sortDirection, enabledHittingCategories, enabledPitchingCategories]);

  // Handle column header click for sorting
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // Set new field with default direction
      setSortField(field);
      // Check if this field is a "lower is better" stat
      const allCategories = [...enabledHittingCategories, ...enabledPitchingCategories];
      const categoryConfig = allCategories.find(c => c.key === field);
      setSortDirection(categoryConfig?.isLowerBetter ? 'asc' : 'desc');
    }
  }, [sortField, enabledHittingCategories, enabledPitchingCategories]);

  // Handle CSV export
  const handleExport = useCallback(() => {
    const csv = generateCSV(filteredPlayers, playerType, enabledHittingCategories, enabledPitchingCategories);
    const date = new Date().toISOString().split('T')[0];
    const sanitizedLeagueName = league.leagueName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const filename = `${sanitizedLeagueName}_projections_${date}.csv`;
    downloadCSV(csv, filename);
  }, [filteredPlayers, playerType, league.leagueName, enabledHittingCategories, enabledPitchingCategories]);

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

          {/* Position Filter */}
          <Select
            value={positionFilter}
            onValueChange={setPositionFilter}
          >
            <SelectTrigger className={`${isMobile ? 'w-full' : 'w-32'} bg-slate-900 border-slate-700 text-white`}>
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              <SelectItem value="all" className="text-white hover:bg-slate-800">
                All Positions
              </SelectItem>
              {availablePositions.map((pos) => (
                <SelectItem
                  key={pos}
                  value={pos}
                  className="text-white hover:bg-slate-800"
                >
                  {pos}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter (toggle buttons) */}
          <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
            <span className="text-slate-400 text-sm mr-1">Status:</span>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => toggleStatusFilter(option.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${
                  statusFilters.has(option.value)
                    ? option.activeClass
                    : option.inactiveClass
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

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

                      {/* Stats row - Dynamic based on league settings */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {playerIsPitcher ? (
                          enabledPitchingCategories.map((cat) => (
                            <span key={cat.key} className="text-slate-400">
                              {cat.label}:{' '}
                              <span className="text-white">
                                {formatStat(
                                  player.projectedStats[cat.key as keyof typeof player.projectedStats],
                                  cat.decimals,
                                  cat.isPercentage
                                )}
                              </span>
                            </span>
                          ))
                        ) : (
                          enabledHittingCategories.map((cat) => (
                            <span key={cat.key} className="text-slate-400">
                              {cat.label}:{' '}
                              <span className="text-white">
                                {formatStat(
                                  player.projectedStats[cat.key as keyof typeof player.projectedStats],
                                  cat.decimals,
                                  cat.isPercentage
                                )}
                              </span>
                            </span>
                          ))
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

                  {/* Hitter Stats - Dynamic based on league settings */}
                  {showHitterStats && enabledHittingCategories.map((cat) => (
                    <SortableHeader
                      key={cat.key}
                      field={cat.key as SortField}
                      className="w-14 text-slate-300"
                    >
                      {cat.label}
                    </SortableHeader>
                  ))}

                  {/* Pitcher Stats - Dynamic based on league settings */}
                  {showPitcherStats && enabledPitchingCategories.map((cat) => (
                    <SortableHeader
                      key={cat.key}
                      field={cat.key as SortField}
                      className="w-14 text-slate-300"
                    >
                      {cat.label}
                    </SortableHeader>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={
                        7 +
                        (showHitterStats ? enabledHittingCategories.length : 0) +
                        (showPitcherStats ? enabledPitchingCategories.length : 0)
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

                        {/* Hitter Stats - Dynamic based on league settings */}
                        {showHitterStats && enabledHittingCategories.map((cat) => (
                          <TableCell
                            key={cat.key}
                            className={
                              playerIsHitter ? 'text-white' : 'text-slate-600'
                            }
                          >
                            {formatStat(
                              player.projectedStats[cat.key as keyof typeof player.projectedStats],
                              cat.decimals,
                              cat.isPercentage
                            )}
                          </TableCell>
                        ))}

                        {/* Pitcher Stats - Dynamic based on league settings */}
                        {showPitcherStats && enabledPitchingCategories.map((cat) => (
                          <TableCell
                            key={cat.key}
                            className={
                              playerIsPitcher ? 'text-white' : 'text-slate-600'
                            }
                          >
                            {formatStat(
                              player.projectedStats[cat.key as keyof typeof player.projectedStats],
                              cat.decimals,
                              cat.isPercentage
                            )}
                          </TableCell>
                        ))}
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

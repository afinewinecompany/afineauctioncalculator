# Frontend Architecture

## Overview

This document describes the React frontend architecture, component hierarchy, state management patterns, and data flow for the Fantasy Baseball Auction Tool.

**Key Features:**

- Live auction sync with Couch Managers
- Tier-weighted inflation tracking
- Positional scarcity analysis
- Historical inflation baselines

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 6.3.5 | Build tool & dev server |
| Tailwind CSS | 3.x | Utility-first styling |
| Radix UI | Various | Accessible component primitives |
| react-hook-form | 7.55.0 | Form management |
| Recharts | 2.15.2 | Data visualization |
| Lucide React | 0.487.0 | Icon library |

---

## Application Structure

```text
src/
├── App.tsx                 # Root component & global state
├── main.tsx                # Entry point
├── components/
│   ├── ui/                 # shadcn/ui components (60+)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── LandingPage.tsx     # Marketing/welcome page
│   ├── LoginPage.tsx       # Authentication UI
│   ├── LeaguesList.tsx     # League dashboard
│   ├── SetupScreen.tsx     # League configuration
│   ├── DraftRoom.tsx       # Main draft interface with live sync
│   ├── DraftHeader.tsx     # Draft stats header
│   ├── PlayerQueue.tsx     # Available players with scarcity indicators
│   ├── RosterPanel.tsx     # User's roster with team selector
│   ├── InflationTracker.tsx # Tier/position inflation & historical insights
│   ├── PlayerDetailModal.tsx # Player stats modal
│   ├── PostDraftAnalysis.tsx # Post-draft review
│   ├── ScoringConfig.tsx   # Scoring settings
│   └── TopMenuBar.tsx      # Navigation bar
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── calculations.ts     # Inflation & value calculation
│   ├── auctionApi.ts       # Backend API client
│   ├── mockData.ts         # Sample data
│   └── utils.ts            # Utility functions
└── assets/                 # Static images
```

---

## Component Hierarchy

```
App.tsx (Root State Manager)
│
├── LandingPage
│   └── [Marketing content]
│
├── LoginPage
│   └── [Email/Google auth forms]
│
├── LeaguesList
│   └── [League cards with actions]
│
├── TopMenuBar (shared header)
│   └── [Navigation, league switcher]
│
├── SetupScreen
│   └── ScoringConfig
│       └── [Category/points configuration]
│
├── DraftRoom (main orchestrator)
│   ├── DraftHeader
│   │   └── [Budget, roster needs, inflation display]
│   ├── PlayerQueue
│   │   └── [Available/drafted player tables]
│   ├── RosterPanel
│   │   └── [My team roster by position]
│   ├── InflationTracker
│   │   └── [Inflation chart & analytics]
│   └── PlayerDetailModal
│       └── [Player stats & projections]
│
└── PostDraftAnalysis
    └── [Team summary with charts]
```

---

## State Management

### Global State (App.tsx)

The root `App.tsx` component manages all global application state:

```typescript
// Screen Navigation
const [currentScreen, setCurrentScreen] = useState<AppScreen>('landing');
type AppScreen = 'landing' | 'login' | 'leagues' | 'setup' | 'draft' | 'analysis';

// User Data
const [userData, setUserData] = useState<UserData | null>(null);

// Current League
const [currentLeague, setCurrentLeague] = useState<SavedLeague | null>(null);

// Player Data
const [players, setPlayers] = useState<Player[]>([]);

// Analysis Data
const [finalRoster, setFinalRoster] = useState<Player[]>([]);
```

### Persistence Pattern

```typescript
// Load from localStorage on mount
useEffect(() => {
  const savedUser = localStorage.getItem('fantasyBaseballUser');
  if (savedUser) {
    setUserData(JSON.parse(savedUser));
    setCurrentScreen('leagues');
  }
}, []);

// Save to localStorage on change
useEffect(() => {
  if (userData) {
    localStorage.setItem('fantasyBaseballUser', JSON.stringify(userData));
  }
}, [userData]);
```

### Draft State (DraftRoom.tsx)

```typescript
// Player lists
const [players, setPlayers] = useState<Player[]>(initialPlayers);
const [myRoster, setMyRoster] = useState<Player[]>([]);
const [allDrafted, setAllDrafted] = useState<Player[]>([]);

// Couch Managers sync state
const [syncState, setSyncState] = useState<SyncState>({
  isConnected: false,
  lastSyncAt: null,
  syncError: null,
  isSyncing: false,
});
const [syncResult, setSyncResult] = useState<AuctionSyncResult | null>(null);
const [liveInflationStats, setLiveInflationStats] = useState<EnhancedInflationStats | null>(null);

// Team selection for "My Team"
const [availableTeams, setAvailableTeams] = useState<string[]>([]);
const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

// Calculations (memoized)
const inflationResult: InflationResult = useMemo(() => {
  const baseResult = calculateTierWeightedInflation(settings, allDrafted, playersWithStatus);
  // Merge server-side enhanced data (positional scarcity, team constraints)
  if (liveInflationStats) {
    return { ...baseResult, ...liveInflationStats };
  }
  return baseResult;
}, [allDrafted, initialPlayers, settings, liveInflationStats]);

// Derived values
const moneySpent = myRoster.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
const moneyRemaining = settings.budgetPerTeam - moneySpent;
```

---

## Data Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│              External Services (Backend API)                     │
├─────────────────────────────────────────────────────────────────┤
│  GET  /api/projections/:system     → Cached projections         │
│  POST /api/auction/:roomId/sync-lite → Live auction state       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                        localStorage                              │
│            (draft progress, team selection)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │  userData  │  │currentLeague│ │  players   │  │finalRoster│ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘ │
└────────┼───────────────┼───────────────┼───────────────┼────────┘
         │               │               │               │
         ▼               ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │LoginPage│    │SetupScreen│   │DraftRoom │    │PostDraft │
    └─────────┘    └──────────┘    └────┬─────┘    │ Analysis │
                                        │          └──────────┘
                            ┌───────────┴───────────┐
                            │    performSync()      │
                            │  (every 2 minutes)    │
                            └───────────┬───────────┘
                                        ▼
                   ┌────────────────────────────────────┐
                   │          DraftRoom State           │
                   │  ┌──────────┐  ┌──────────────┐   │
                   │  │ myRoster │  │ syncResult   │   │
                   │  │allDrafted│  │liveInflation │   │
                   │  └────┬─────┘  └──────┬───────┘   │
                   └───────┼───────────────┼───────────┘
                           │               │
         ┌─────────────────┼───────────────┼─────────────────┐
         │                 │               │                 │
         ▼                 ▼               ▼                 ▼
    ┌─────────┐      ┌──────────┐  ┌──────────┐   ┌────────────────┐
    │DraftHead│      │PlayerQueue│ │RosterPanel│  │InflationTracker│
    └─────────┘      │(scarcity) │ │(team sel) │  │(tiers/history) │
                     └──────────┘  └──────────┘   └────────────────┘
```

---

## Key Components Reference

### App.tsx

**Purpose**: Root component, global state management, screen routing

**State Managed**:
- `currentScreen` - Current view
- `userData` - User account & leagues
- `currentLeague` - Active league
- `players` - Player data for current league
- `finalRoster` - Completed draft roster

**Key Handlers**:
- `handleLogin()` - Process authentication
- `handleLogout()` - Clear session
- `handleSetupComplete()` - Create new league
- `handleDraftComplete()` - Finalize draft
- `handleContinueDraft()` - Resume existing draft

---

### DraftRoom.tsx

**Purpose**: Main draft interface orchestrator

**Props**:
```typescript
interface DraftRoomProps {
  settings: LeagueSettings;
  players: Player[];
  onComplete: () => void;
}
```

**State Managed**:
- `players` - All players with current status
- `myRoster` - My drafted players
- `allDrafted` - All drafted players (league-wide)
- `inflationRate` - Current inflation percentage
- `rosterNeedsRemaining` - Unfilled roster positions
- `selectedPlayerForDetail` - Player for modal view

**Key Effects**:
```typescript
// Recalculate inflation when players drafted
useEffect(() => {
  const newInflationRate = calculateInflation(settings, allDrafted);
  setInflationRate(newInflationRate);

  // Adjust player values
  setPlayers(prevPlayers =>
    prevPlayers.map(p => ({
      ...p,
      adjustedValue: Math.round(p.projectedValue * (1 + newInflationRate))
    }))
  );
}, [allDrafted.length]);
```

---

### PlayerQueue.tsx

**Purpose**: Display available and drafted players

**Props**:
```typescript
interface PlayerQueueProps {
  players: Player[];
  onDraftPlayer: (player: Player, price: number, draftedBy: 'me' | 'other') => void;
  onPlayerClick: (player: Player) => void;
}
```

**Features**:
- Filterable by position, tier, status
- Sortable by value, name, team
- Quick-draft buttons
- Search functionality

---

### InflationTracker.tsx

**Purpose**: Comprehensive inflation visualization with tier breakdowns, positional scarcity, and historical insights

**Props**:
```typescript
interface InflationTrackerProps {
  settings: LeagueSettings;
  allDrafted: Player[];
  inflationRate: number;
  inflationResult?: InflationResult;
  syncState?: SyncState;
  liveInflationStats?: InflationStats | null;
  currentAuction?: CurrentAuction | null;
  onManualSync?: () => void;
}
```

**Display Sections**:

- **Sync Status**: Connection status, last sync time, manual refresh button
- **Current Auction**: Player on block with current bid (when active)
- **Hero Inflation Section**: Large inflation rate with severity indicator and multiplier
- **Remaining Budget Analysis**: Money remaining, effective budget, inflation multiplier
- **Tier Breakdown**: Inflation by tier (1-10) with historical comparisons
- **Positional Scarcity**: Grid showing scarcity level per position (severe/moderate/normal/surplus)
- **Historical Insights**: Key findings from 6 analyzed auctions (elite players deflated, filler inflated)
- **Price Range Guide**: Bidding advice by projected value range ($1-$5, $6-$15, etc.)

---

## Business Logic (lib/calculations.ts)

### Tier-Weighted Inflation Calculation

```typescript
export function calculateTierWeightedInflation(
  leagueSettings: LeagueSettings,
  allDrafted: Player[],
  allPlayers: Player[]
): InflationResult {
  // Calculate tier-based inflation with dampened low-value player weights
  // Tier 1 (elite) = top 10%, Tier 10 (filler) = bottom 10%

  // Per-tier calculation
  const tierInflation = getTierBreakdown(allDrafted);

  // Weighted average with dampening for $1-$5 players
  // Low-value players see 500-1500% inflation, which distorts averages
  const weightedRate = calculateDampenedWeightedAverage(tierInflation);

  // Remaining budget method (primary adjustment)
  const remainingBudget = totalBudget - moneySpent;
  const remainingProjectedValue = availablePlayers.reduce(
    (sum, p) => sum + p.projectedValue, 0
  );
  const inflationMultiplier = remainingBudget / remainingProjectedValue;

  return {
    overallInflationRate: weightedRate,
    tierInflation,
    remainingBudget,
    remainingProjectedValue,
    // Additional enhanced data from server...
  };
}
```

### Historical Inflation Baselines

```typescript
// Based on analysis of 6 Couch Managers auctions
export const HISTORICAL_INFLATION_BASELINES = {
  overall: { avgInflationRate: 20.33, stdDeviation: 44.83 },
  byTier: {
    1: { avgInflation: -19.84, label: 'Elite (top 10%)' },     // DEFLATED
    7: { avgInflation: 1580.36, label: 'Roster filler' },      // Highest
  },
  byPosition: {
    MiLB: { avgInflation: 1347.40, trend: 'severely_inflated' },
    RP: { avgInflation: 974.62, trend: 'severely_inflated' },
    SP: { avgInflation: 870.42, trend: 'severely_inflated' },
    C: { avgInflation: 268.48, trend: 'highly_inflated' },
  },
  byPriceRange: {
    '$31+': { avgInflation: -17.54, trend: 'deflated' },
    '$1-$5': { avgInflation: 991.64, trend: 'extreme' },
  },
};
```

### Value Adjustment

```typescript
export function adjustPlayerValuesWithTiers(
  players: Player[],
  inflationResult: InflationResult
): Player[] {
  return players.map(p => {
    if (p.status === 'drafted') {
      // Drafted players show actual price
      return { ...p, adjustedValue: p.draftedPrice };
    }

    // Available players: multiply by inflation and apply scarcity
    const inflationMultiplier = inflationResult.adjustedRemainingBudget
      / inflationResult.remainingProjectedValue;

    // Apply positional scarcity adjustment
    const scarcityAdjustment = getPositionalScarcityAdjustment(
      p.positions,
      inflationResult.positionalScarcity
    );

    const adjustedValue = p.projectedValue * inflationMultiplier * scarcityAdjustment;
    return { ...p, adjustedValue: Math.round(adjustedValue) };
  });
}
```

---

## UI Component Library (shadcn/ui)

The `/src/components/ui/` directory contains 60+ pre-built components from shadcn/ui:

### Commonly Used Components

| Component | File | Usage |
|-----------|------|-------|
| Button | `button.tsx` | Primary actions |
| Card | `card.tsx` | Content containers |
| Dialog | `dialog.tsx` | Modals |
| Input | `input.tsx` | Text inputs |
| Select | `select.tsx` | Dropdowns |
| Table | `table.tsx` | Data tables |
| Tabs | `tabs.tsx` | Tab navigation |
| Toast | `sonner.tsx` | Notifications |

### Usage Pattern

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

function MyComponent() {
  return (
    <Card>
      <CardHeader>Title</CardHeader>
      <CardContent>
        <Button variant="default" size="lg">
          Action
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## Styling Patterns

### Tailwind CSS Classes

```tsx
// Dark theme gradient background
<div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">

// Card with border and shadow
<div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700/50">

// Accent button
<button className="bg-gradient-to-r from-emerald-600 to-green-700
  hover:from-emerald-700 hover:to-green-800
  text-white rounded-lg shadow-lg shadow-emerald-500/30">
```

### Animation Classes

```css
.animate-fadeIn { animation: fadeIn 0.3s ease-out; }
.animate-slideInLeft { animation: slideInLeft 0.3s ease-out; }
.animate-pulse-slow { animation: pulse 2s infinite; }
```

---

## Form Handling

Forms use `react-hook-form` for validation and state management:

```tsx
import { useForm } from 'react-hook-form';

function SetupScreen() {
  const { register, handleSubmit, formState: { errors } } = useForm<LeagueSettings>();

  const onSubmit = (data: LeagueSettings) => {
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('leagueName', { required: true })} />
      {errors.leagueName && <span>Required</span>}
    </form>
  );
}
```

---

## API Integration (lib/auctionApi.ts)

### Sync Functions

```typescript
// Lightweight sync using server-cached projections (~200 bytes)
export async function syncAuctionLite(
  roomId: string,
  settings: LeagueSettings
): Promise<AuctionSyncResult> {
  const response = await fetch(`/api/auction/${roomId}/sync-lite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectionSystem: settings.projectionSystem,
      leagueConfig: {
        numTeams: settings.numTeams,
        budgetPerTeam: settings.budgetPerTeam,
        totalRosterSpots: calculateTotalRosterSpots(settings),
        rosterSpots: settings.rosterSpots,
        scoringType: settings.scoringType,
        hittingCategories: settings.hittingCategories,
        pitchingCategories: settings.pitchingCategories,
      },
    }),
  });
  return response.json();
}

// Format last sync time for display
export function formatLastSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'Never synced';
  const seconds = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
```

---

## Future Considerations

### WebSocket Integration

For real-time draft rooms (replace 2-minute polling):

1. Add WebSocket connection in DraftRoom
2. Sync draft picks across clients instantly
3. Handle connection drops gracefully

### Performance Optimization

Recommended improvements:

1. ~~Memoize expensive calculations with `useMemo`~~ - Done (inflationResult)
2. Virtualize long player lists (react-window)
3. Code-split by route
4. Lazy load modals

---

*Document Version: 2.0*
*Last Updated: December 2024*

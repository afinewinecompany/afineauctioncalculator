# Frontend Architecture

## Overview

This document describes the React frontend architecture, component hierarchy, state management patterns, and data flow for the Fantasy Baseball Auction Tool.

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

```
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
│   ├── DraftRoom.tsx       # Main draft interface
│   ├── DraftHeader.tsx     # Draft stats header
│   ├── PlayerQueue.tsx     # Available players list
│   ├── RosterPanel.tsx     # User's roster display
│   ├── NominationPanel.tsx # Active bid panel
│   ├── InflationTracker.tsx # Inflation visualization
│   ├── PlayerDetailModal.tsx # Player stats modal
│   ├── PostDraftAnalysis.tsx # Post-draft review
│   ├── ScoringConfig.tsx   # Scoring settings
│   └── TopMenuBar.tsx      # Navigation bar
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── calculations.ts     # Business logic
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

// Calculations
const [inflationRate, setInflationRate] = useState(0);
const [rosterNeedsRemaining, setRosterNeedsRemaining] = useState(settings.rosterSpots);

// Derived values
const moneySpent = myRoster.reduce((sum, p) => sum + (p.draftedPrice || 0), 0);
const moneyRemaining = settings.budgetPerTeam - moneySpent;
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        localStorage                              │
│                    'fantasyBaseballUser'                        │
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
                                        ▼
                   ┌────────────────────────────────────┐
                   │          DraftRoom State           │
                   │  ┌──────────┐  ┌──────────┐       │
                   │  │ myRoster │  │allDrafted│       │
                   │  └────┬─────┘  └────┬─────┘       │
                   └───────┼─────────────┼─────────────┘
                           │             │
         ┌─────────────────┼─────────────┼─────────────────┐
         │                 │             │                 │
         ▼                 ▼             ▼                 ▼
    ┌─────────┐      ┌──────────┐  ┌──────────┐   ┌────────────┐
    │DraftHead│      │PlayerQueue│ │RosterPanel│  │InflationTracker│
    └─────────┘      └──────────┘  └──────────┘   └────────────┘
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

**Purpose**: Visualize inflation trends and provide analytics

**Props**:
```typescript
interface InflationTrackerProps {
  settings: LeagueSettings;
  allDrafted: DraftedPlayer[];
  inflationRate: number;
}
```

**Display**:
- Current inflation rate (percentage)
- Inflation trend chart
- Money remaining in league
- Value adjustment indicator

---

## Business Logic (lib/calculations.ts)

### Inflation Calculation

```typescript
export function calculateInflation(
  leagueSettings: LeagueSettings,
  allDrafted: DraftedPlayer[]
): number {
  const totalBudget = leagueSettings.numTeams * leagueSettings.budgetPerTeam;
  const totalRosterSpots = leagueSettings.numTeams *
    Object.values(leagueSettings.rosterSpots).reduce((a, b) => a + b, 0);

  const moneySpent = allDrafted.reduce((sum, p) => sum + p.draftedPrice, 0);
  const moneyRemaining = totalBudget - moneySpent;

  const playersDrafted = allDrafted.length;
  const playersRemaining = totalRosterSpots - playersDrafted;

  if (playersRemaining === 0) return 0;

  const avgProjectedValue = (totalBudget * 0.95) / totalRosterSpots;
  const expectedRemainingValue = playersRemaining * avgProjectedValue;

  const inflationRate = (moneyRemaining / expectedRemainingValue) - 1;

  return Math.round(inflationRate * 100) / 100;
}
```

### Value Indicators

```typescript
export function getValueIndicator(bid: number, adjustedValue: number): {
  color: string;
  label: string;
  percentage: number;
} {
  const percentage = ((bid - adjustedValue) / adjustedValue) * 100;

  if (percentage <= 20) return { color: 'text-green-600', label: 'Great Deal' };
  if (percentage <= 40) return { color: 'text-yellow-600', label: 'Fair Value' };
  if (percentage <= 60) return { color: 'text-orange-600', label: 'Slightly Expensive' };
  return { color: 'text-red-600', label: 'Overpay' };
}
```

### Position Scarcity

```typescript
export function getPositionScarcity(
  position: string,
  players: Player[],
  threshold: number = 20
): 'high' | 'medium' | 'low' {
  const availableAtPosition = players.filter(
    p => p.status === 'available' && p.positions.includes(position)
  ).length;

  if (availableAtPosition < threshold * 0.3) return 'high';
  if (availableAtPosition < threshold * 0.6) return 'medium';
  return 'low';
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

## Future Considerations

### API Integration

When migrating to backend:
1. Replace `localStorage` calls with API service
2. Add loading states to components
3. Implement error boundaries
4. Add optimistic updates

### WebSocket Integration

For real-time draft rooms:
1. Add WebSocket connection in DraftRoom
2. Sync draft picks across clients
3. Handle connection drops gracefully

### Performance Optimization

Recommended improvements:
1. Memoize expensive calculations with `useMemo`
2. Virtualize long player lists
3. Code-split by route
4. Lazy load modals

---

*Document Version: 1.0*
*Last Updated: December 2024*
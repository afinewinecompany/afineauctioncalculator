# Component Reference

## Overview

This document provides a complete inventory of all React components in the Fantasy Baseball Auction Tool, their props, purposes, and relationships.

---

## Component Categories

| Category | Count | Location |
|----------|-------|----------|
| Business Components | 14 | `src/components/*.tsx` |
| UI Library (shadcn/ui) | 46 | `src/components/ui/*.tsx` |
| **Total** | **60** | |

---

## Business Components

### Screen Components

These components represent full screens/pages in the application.

#### LandingPage.tsx

**Purpose**: Marketing/welcome page for unauthenticated users

**Props**:
```typescript
interface LandingPageProps {
  onGetStarted: () => void;
}
```

**Used by**: App.tsx

---

#### LoginPage.tsx

**Purpose**: User authentication (email and Google OAuth)

**Props**:
```typescript
interface LoginPageProps {
  onLogin: (
    email: string,
    authProvider: 'email' | 'google',
    googleData?: { name: string; picture: string }
  ) => void;
  onBack: () => void;
}
```

**Used by**: App.tsx

---

#### LeaguesList.tsx

**Purpose**: Dashboard showing all user's leagues with management actions

**Props**:
```typescript
interface LeaguesListProps {
  username: string;
  leagues: SavedLeague[];
  onCreateNew: () => void;
  onContinueDraft: (league: SavedLeague) => void;
  onDeleteLeague: (leagueId: string) => void;
  onLogout: () => void;
  profilePicture?: string;
}
```

**Used by**: App.tsx

---

#### SetupScreen.tsx

**Purpose**: League configuration form for creating new leagues

**Props**:
```typescript
interface SetupScreenProps {
  onComplete: (settings: LeagueSettings) => void;
}
```

**Used by**: App.tsx

**Child Components**: ScoringConfig

---

#### DraftRoom.tsx

**Purpose**: Main draft interface with live Couch Managers sync and inflation tracking

**Props**:
```typescript
interface DraftRoomProps {
  settings: LeagueSettings;
  players: Player[];
  onComplete: () => void;
}
```

**State**:
```typescript
// Player data
players: Player[]
myRoster: Player[]
allDrafted: Player[]

// Couch Managers sync
syncState: SyncState
syncResult: AuctionSyncResult | null
liveInflationStats: EnhancedInflationStats | null

// Team selection
availableTeams: string[]
selectedTeam: string | null

// Calculations (memoized)
inflationResult: InflationResult  // Includes tier inflation, scarcity

// UI state
isInitialLoading: boolean
loadingMessage: string
selectedPlayerForDetail: Player | null
```

**Key Features**:

- Auto-sync with Couch Managers every 2 minutes
- Loading overlay on initial sync
- Team selector for "My Team" roster view
- Memoized inflation calculation
- Player status sync (drafted/available/on_block)

**Used by**: App.tsx

**Child Components**: LoadingOverlay, DraftHeader, PlayerQueue, RosterPanel, InflationTracker, PlayerDetailModal

---

#### PostDraftAnalysis.tsx

**Purpose**: Post-draft summary with team analytics and charts

**Props**:
```typescript
interface PostDraftAnalysisProps {
  roster: DraftedPlayer[];
  settings: LeagueSettings;
  onRestart: () => void;
}
```

**Used by**: App.tsx

---

### Draft Components

These components are used within the draft workflow.

#### DraftHeader.tsx

**Purpose**: Display draft statistics in header bar

**Props**:
```typescript
interface DraftHeaderProps {
  settings: LeagueSettings;
  moneyRemaining: number;
  rosterNeedsRemaining: RosterSpots;
  totalDrafted: number;
  inflationRate: number;
}
```

**Used by**: DraftRoom.tsx

---

#### PlayerQueue.tsx

**Purpose**: Display available/drafted player lists with scarcity indicators

**Props**:
```typescript
interface PlayerQueueProps {
  players: Player[];
  onPlayerClick: (player: Player) => void;
  positionalScarcity?: PositionalScarcity[];
}
```

**Features**:

- Filter by position, tier, status
- Sort by various columns
- Search by player name
- Positional scarcity badges (severe/moderate/normal/surplus)
- Color-coded value indicators
- On-block player highlighting

**Used by**: DraftRoom.tsx

---

#### RosterPanel.tsx

**Purpose**: Display drafted roster with team selector dropdown

**Props**:
```typescript
interface RosterPanelProps {
  roster: Player[];
  settings: LeagueSettings;
  rosterNeedsRemaining: RosterSpots;
  availableTeams?: string[];
  selectedTeam: string | null;
  onTeamSelect?: (team: string) => void;
}
```

**Features**:

- Team dropdown selector (when connected to Couch Managers)
- Position-grouped roster display
- Money remaining calculation
- Roster spots remaining count

**Used by**: DraftRoom.tsx

---

#### NominationPanel.tsx

**Purpose**: Display and manage active player nomination/bid

**Props**:
```typescript
interface NominationPanelProps {
  player: Player | null;
  currentBid: number;
  onBid: (amount: number) => void;
  onPass: () => void;
}
```

**Used by**: DraftRoom.tsx (when nomination active)

---

#### InflationTracker.tsx

**Purpose**: Comprehensive inflation visualization with tier breakdowns, scarcity, and historical insights

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

**Display Sections** (collapsible):

1. **Sync Status Header** - Connection status, last sync time, manual refresh
2. **Current Auction** - Player on block with bid (animated pulse)
3. **Hero Inflation** - Large rate display with severity color and multiplier
4. **Budget Metrics** - Total budget, money spent, draft progress
5. **Remaining Budget Analysis** - Effective budget, inflation multiplier
6. **Live Inflation Details** - Projected vs actual spend
7. **Tier Breakdown** - Per-tier inflation with historical comparison
8. **Positional Scarcity** - 4-column grid with scarcity levels
9. **Historical Insights** - Key findings from 6 analyzed auctions
10. **Price Range Guide** - Bidding advice by value range

**Used by**: DraftRoom.tsx

---

#### PlayerDetailModal.tsx

**Purpose**: Modal showing detailed player stats and projections

**Props**:
```typescript
interface PlayerDetailModalProps {
  player: Player | null;
  onClose: () => void;
}
```

**Used by**: DraftRoom.tsx

---

### Configuration Components

#### ScoringConfig.tsx

**Purpose**: Configure scoring categories and point values

**Props**:
```typescript
interface ScoringConfigProps {
  scoringType: 'rotisserie' | 'h2h-categories' | 'h2h-points';
  hittingCategories: HittingCategories;
  pitchingCategories: PitchingCategories;
  pointsSettings: PointsSettings;
  onChange: (config: ScoringConfig) => void;
}
```

**Used by**: SetupScreen.tsx

---

### Navigation Components

#### TopMenuBar.tsx

**Purpose**: Top navigation bar with league switcher

**Props**:
```typescript
interface TopMenuBarProps {
  currentLeague: SavedLeague | null;
  allLeagues: SavedLeague[];
  onGoToDashboard: () => void;
  onSwitchLeague: (league: SavedLeague) => void;
  showLeagueSelector?: boolean;
}
```

**Used by**: App.tsx (on setup, draft, analysis screens)

---

## UI Library Components (shadcn/ui)

These are pre-built, accessible components from the shadcn/ui library.

### Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| Card | `card.tsx` | Content container with header/footer |
| Separator | `separator.tsx` | Visual divider |
| Scroll-area | `scroll-area.tsx` | Custom scrollable container |
| Resizable | `resizable.tsx` | Resizable panels |
| Sidebar | `sidebar.tsx` | Side navigation |
| Aspect-ratio | `aspect-ratio.tsx` | Fixed ratio container |

### Form Components

| Component | File | Purpose |
|-----------|------|---------|
| Button | `button.tsx` | Clickable button with variants |
| Input | `input.tsx` | Text input field |
| Textarea | `textarea.tsx` | Multi-line text input |
| Checkbox | `checkbox.tsx` | Boolean checkbox |
| Radio-group | `radio-group.tsx` | Radio button group |
| Select | `select.tsx` | Dropdown select |
| Switch | `switch.tsx` | Toggle switch |
| Slider | `slider.tsx` | Range slider |
| Form | `form.tsx` | Form with react-hook-form |
| Label | `label.tsx` | Form field label |
| Input-otp | `input-otp.tsx` | OTP code input |

### Display Components

| Component | File | Purpose |
|-----------|------|---------|
| Avatar | `avatar.tsx` | User avatar image |
| Badge | `badge.tsx` | Status/tag badge |
| Progress | `progress.tsx` | Progress bar |
| Skeleton | `skeleton.tsx` | Loading placeholder |
| Table | `table.tsx` | Data table |
| Chart | `chart.tsx` | Chart wrapper for Recharts |
| Calendar | `calendar.tsx` | Date picker calendar |
| Carousel | `carousel.tsx` | Image/content carousel |

### Overlay Components

| Component | File | Purpose |
|-----------|------|---------|
| Dialog | `dialog.tsx` | Modal dialog |
| Alert-dialog | `alert-dialog.tsx` | Confirmation dialog |
| Sheet | `sheet.tsx` | Slide-over panel |
| Drawer | `drawer.tsx` | Bottom drawer |
| Popover | `popover.tsx` | Floating popover |
| Tooltip | `tooltip.tsx` | Hover tooltip |
| Hover-card | `hover-card.tsx` | Rich hover content |
| Sonner | `sonner.tsx` | Toast notifications |
| Alert | `alert.tsx` | Inline alert message |

### Navigation Components

| Component | File | Purpose |
|-----------|------|---------|
| Tabs | `tabs.tsx` | Tab navigation |
| Accordion | `accordion.tsx` | Collapsible sections |
| Breadcrumb | `breadcrumb.tsx` | Breadcrumb navigation |
| Pagination | `pagination.tsx` | Page navigation |
| Navigation-menu | `navigation-menu.tsx` | Top navigation menu |
| Menubar | `menubar.tsx` | Menu bar |
| Dropdown-menu | `dropdown-menu.tsx` | Dropdown menu |
| Context-menu | `context-menu.tsx` | Right-click menu |
| Command | `command.tsx` | Command palette (cmdk) |
| Collapsible | `collapsible.tsx` | Collapsible container |

### Utility Components

| Component | File | Purpose |
|-----------|------|---------|
| Toggle | `toggle.tsx` | Toggle button |
| Toggle-group | `toggle-group.tsx` | Toggle button group |

---

## Component Relationships Diagram

```
App.tsx (Root)
│
├── LandingPage ───────────────────────────────────────┐
│                                                       │
├── LoginPage ─────────────────────────────────────────┤
│                                                       │
├── LeaguesList ───────────────────────────────────────┤
│   └── [League cards]                                  │
│                                                       │
├── TopMenuBar ◄───────────────────────────────────────┤
│                                                       │ Uses UI Components:
├── SetupScreen                                         │ - Card, Button, Input
│   └── ScoringConfig                                   │ - Select, Checkbox
│       └── [Category/points forms]                     │ - Tabs, Form, Label
│                                                       │ - Dialog, Tooltip
├── DraftRoom                                           │ - Table, Badge
│   ├── DraftHeader                                     │ - Progress, Skeleton
│   │   └── [Stats display]                             │ - ScrollArea
│   ├── PlayerQueue                                     │
│   │   └── [Player tables with actions]               │
│   ├── RosterPanel                                     │
│   │   └── [Position groups]                          │
│   ├── InflationTracker                               │
│   │   └── [Chart visualization]                      │
│   └── PlayerDetailModal                              │
│       └── [Stats tables]                             │
│                                                       │
└── PostDraftAnalysis                                   │
    └── [Summary charts & tables]                      ─┘
```

---

## Import Patterns

### Importing Business Components

```typescript
import { DraftRoom } from './components/DraftRoom';
import { PlayerQueue } from './components/PlayerQueue';
```

### Importing UI Components

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
```

### Path Alias

The `@/` alias is configured in `vite.config.ts` to point to `./src/`:

```typescript
// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

---

## Component Usage Examples

### Button Variants

```tsx
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Card Pattern

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Dialog Pattern

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    Content here
    <DialogFooter>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Table Pattern

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Value</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.value}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## Adding New Components

### Business Component Template

```typescript
// src/components/NewComponent.tsx
import { FC } from 'react';

interface NewComponentProps {
  // Define props
}

export const NewComponent: FC<NewComponentProps> = ({ ...props }) => {
  return (
    <div>
      {/* Component content */}
    </div>
  );
};
```

### Adding UI Components

Use the shadcn/ui CLI to add new components:

```bash
npx shadcn-ui@latest add [component-name]
```

---

## Testing Components

When writing tests, mock the UI components:

```typescript
// Mock example
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
```

---

*Document Version: 2.0*
*Last Updated: December 2024*

# Fantasy Baseball Auction Tool - Project Context

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Project Name** | Fantasy Baseball Auction Tool |
| **Purpose** | Optimize draft budgeting during fantasy baseball salary cap auctions |
| **Tech Stack** | React 18 + TypeScript + Vite (Frontend) + Node.js/Express (Backend) |
| **UI Framework** | Radix UI + Tailwind CSS (shadcn/ui) |
| **Data Sources** | FanGraphs Projections (Steamer/BatX/JA) + Couch Managers Live Sync |
| **Backend Status** | Implemented - Projections API, Auction Sync, Value Calculator |
| **Status** | Full-Stack MVP with Live Auction Sync |

---

## Project Overview

This is a **React single-page application** that helps fantasy baseball team managers optimize their draft budgets during salary cap auction drafts. The application tracks player values, calculates real-time inflation rates, and provides analytics to help users make informed bidding decisions.

### Core Features

1. **League Configuration** - Custom scoring systems (Roto, H2H Categories, H2H Points), roster positions, and budget settings
2. **Live Auction Sync** - Real-time integration with Couch Managers draft rooms
3. **Projections Engine** - FanGraphs projections (Steamer/BatX/JA) with SGP-based value calculation
4. **Tier-Weighted Inflation** - Sophisticated inflation tracking with historical baselines and positional scarcity
5. **Value Adjustment** - Dynamic player value adjustment based on remaining budget and positional need
6. **Team Analytics** - Post-draft team analysis with projected stats and charts

---

## Directory Structure

```text
afineauctioncalculator/
├── src/                        # Frontend React application
│   ├── components/             # React components (15+ custom + 60+ UI)
│   │   ├── ui/                 # shadcn/ui component library
│   │   └── *.tsx               # Business logic components
│   ├── lib/
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── calculations.ts     # Inflation & value calculations
│   │   ├── auctionApi.ts       # API client for backend
│   │   └── mockData.ts         # Sample player data
│   ├── App.tsx                 # Root component & state manager
│   └── main.tsx                # Entry point
├── server/                     # Backend Express server
│   ├── index.ts                # Server entry point
│   ├── routes/
│   │   ├── auction.ts          # Couch Managers sync endpoints
│   │   └── projections.ts      # Projections API endpoints
│   ├── services/
│   │   ├── couchManagersScraper.ts  # Couch Managers web scraper
│   │   ├── projectionsService.ts    # FanGraphs projections fetcher
│   │   ├── projectionsCacheService.ts # 24-hour projection cache
│   │   ├── valueCalculator.ts       # SGP-based value calculation
│   │   ├── inflationCalculator.ts   # Tier-weighted inflation
│   │   └── playerMatcher.ts         # Name matching algorithm
│   └── types/
│       ├── auction.ts          # Auction/sync types
│       └── projections.ts      # Projection types
├── docs/                       # Project documentation
├── .claude/                    # Claude agent configurations
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Key Files for Agents

### Must-Read Files

| File | Purpose | When to Read |
|------|---------|--------------|
| `src/lib/types.ts` | All TypeScript interfaces (frontend + shared) | Before any coding task |
| `server/types/auction.ts` | Backend auction/sync types | Backend development |
| `src/lib/calculations.ts` | Frontend inflation & value calculations | Modifying calculations |
| `server/services/inflationCalculator.ts` | Server-side inflation with positional scarcity | Backend inflation work |
| `server/services/valueCalculator.ts` | SGP-based auction value calculator | Value calculation changes |
| `src/lib/auctionApi.ts` | API client for backend services | API integration |

### Component Files

| Component | File | Purpose |
|-----------|------|---------|
| DraftRoom | `src/components/DraftRoom.tsx` | Main draft interface with live sync |
| PlayerQueue | `src/components/PlayerQueue.tsx` | Available/drafted player lists |
| RosterPanel | `src/components/RosterPanel.tsx` | User's team roster with team selector |
| InflationTracker | `src/components/InflationTracker.tsx` | Tier inflation, scarcity, historical insights |
| SetupScreen | `src/components/SetupScreen.tsx` | League configuration form |

### Backend Files

| Service | File | Purpose |
|---------|------|---------|
| Auction Routes | `server/routes/auction.ts` | Couch Managers sync endpoints |
| Projections Routes | `server/routes/projections.ts` | FanGraphs projection endpoints |
| Value Calculator | `server/services/valueCalculator.ts` | SGP/Points value calculation |
| Inflation Calculator | `server/services/inflationCalculator.ts` | Enhanced inflation with scarcity |
| Projections Cache | `server/services/projectionsCacheService.ts` | 24-hour projection caching |

---

## Data Model Summary

### Core Types (src/lib/types.ts)

```typescript
// League settings - includes Couch Managers integration
LeagueSettings {
  leagueName, couchManagerRoomId
  numTeams, budgetPerTeam
  scoringType: 'rotisserie' | 'h2h-categories' | 'h2h-points'
  projectionSystem: 'steamer' | 'batx' | 'ja'
  rosterSpots: { C, 1B, 2B, 3B, SS, OF, CI, MI, UTIL, SP, RP, P, Bench }
  hittingCategories, pitchingCategories, pointsSettings
  hitterPitcherSplit?: { hitter: 0.68, pitcher: 0.32 }
}

// Player data - extended with auction status
Player {
  id, externalId?, name, team, positions[]
  projectedValue, adjustedValue, tier?, isInDraftPool?
  projectedStats: { HR, RBI, SB, AVG, R, H, W, K, ERA, WHIP, SV, IP }
  status: 'available' | 'drafted' | 'onMyTeam' | 'on_block'
  draftedPrice?, draftedBy?
  currentBid?, currentBidder?  // For on_block status
}

// Enhanced Inflation Stats (from server)
EnhancedInflationStats {
  overallInflationRate, totalProjectedValue, totalActualSpent
  tierInflation: TierInflationData[]
  positionalScarcity: PositionalScarcity[]
  teamConstraints: TeamBudgetConstraint[]
  adjustedRemainingBudget, remainingProjectedValue
}

// Positional Scarcity
PositionalScarcity {
  position, availableCount, qualityCount, leagueNeed
  scarcityRatio, scarcityLevel: 'surplus' | 'normal' | 'moderate' | 'severe'
  inflationAdjustment  // Multiplier (1.25 = +25%)
}
```

### Data Flow

```text
                        ┌─────────────────────────────────┐
                        │    External Data Sources         │
                        ├─────────────────────────────────┤
                        │  FanGraphs API (Projections)    │
                        │  Couch Managers (Live Auction)  │
                        └────────────────┬────────────────┘
                                         │
                        ┌────────────────▼────────────────┐
                        │       Express Backend           │
                        ├─────────────────────────────────┤
                        │  /api/projections/:system       │
                        │  /api/projections/calculate-values │
                        │  /api/auction/:roomId/sync-lite │
                        └────────────────┬────────────────┘
                                         │
┌──────────────────┐    ┌────────────────▼────────────────┐
│   localStorage   │◄───│         App.tsx                 │
│ (draft progress) │    │    (state manager)              │
└──────────────────┘    └────────────────┬────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
    ┌─────────▼─────────┐    ┌───────────▼───────────┐    ┌────────▼────────┐
    │   SetupScreen     │    │      DraftRoom        │    │  PostDraft      │
    │   (config)        │    │   (live auction)      │    │  Analysis       │
    └───────────────────┘    └───────────┬───────────┘    └─────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
          ┌─────────▼─────────┐ ┌────────▼────────┐ ┌────────▼────────┐
          │   PlayerQueue     │ │  RosterPanel    │ │ InflationTracker│
          │ (with scarcity)   │ │ (team selector) │ │ (tier/position) │
          └───────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Current State vs Planned State

### Current (Full-Stack MVP)

**Implemented:**

- Express backend with projections and auction sync APIs
- FanGraphs projections (Steamer/BatX/JA) with 24-hour caching
- SGP-based value calculation for Roto/H2H Categories leagues
- Points-based value calculation for H2H Points leagues
- Couch Managers live sync with player matching
- Tier-weighted inflation with historical baselines
- Positional scarcity analysis with inflation adjustments
- Team budget constraint tracking (effective budget calculation)
- Lightweight sync endpoint (~200 bytes vs 800KB)

**Storage:**

- localStorage for draft progress persistence
- Server-side projection caching (24-hour TTL)
- In-memory auction data caching (30-second TTL)

### Future Enhancements

- PostgreSQL database for persistent storage
- JWT authentication with OAuth
- Multi-user league sharing
- Real-time draft rooms via WebSocket
- Historical auction data analysis

---

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start frontend dev server (Vite)
npm run server       # Start backend Express server
npm run build        # Production build
```

---

## Integration Points

### External Services (Implemented)

- **FanGraphs** - Player projections (Steamer, BatX, JA systems)
- **Couch Managers** - Live auction room synchronization (web scraping)

### Internal APIs (Implemented)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projections/:system` | GET | Fetch cached projections |
| `/api/projections/calculate-values` | POST | Calculate auction values for league |
| `/api/projections/:system/refresh` | POST | Force cache refresh |
| `/api/auction/:roomId` | GET | Fetch auction state |
| `/api/auction/:roomId/sync` | POST | Full sync with player projections |
| `/api/auction/:roomId/sync-lite` | POST | Lightweight sync using cached projections |

See [API_DESIGN.md](./API_DESIGN.md) for full endpoint documentation.

---

## Key Business Logic

### Inflation Calculation

**Tier-Weighted Inflation** (server/services/inflationCalculator.ts):

```text
Per-tier inflation = (actual_spent - projected_value) / projected_value
Weighted avg = Σ(tier_inflation × tier_value) / Σ(tier_value)
```

Key features:

- Dampened weights for low-value players ($1-$5) to avoid distortion
- Historical baselines from 6 analyzed auctions
- Tier 1 (elite) typically -20% deflated, Tier 7 (filler) +1580% inflated

**Remaining Budget Inflation** (primary adjustment method):

```text
inflation_multiplier = effective_remaining_budget / remaining_projected_value
adjusted_value = projected_value × inflation_multiplier × scarcity_adjustment
```

### Positional Scarcity

- **Severe** (ratio >= 2.0): +25% adjustment
- **Moderate** (ratio >= 1.0): +12% adjustment
- **Normal** (ratio >= 0.5): No adjustment
- **Surplus** (ratio < 0.5): -5% adjustment

Historical position premiums also applied (SP/RP +15%, C +10%, 2B/3B +5%)

### Value Calculation (SGP Method)

For Rotisserie/H2H Categories leagues:

1. Calculate category stats (avg, stddev) for top N players
2. SGP per player = Σ((stat - avg) / stddev) for each category
3. Dollar value = $1 + (SGP share × distributable budget)

---

## Agent-Specific Notes

### Frontend Developer

- Components use Radix UI primitives styled with Tailwind
- DraftRoom uses `syncAuctionLite` for efficient server sync
- InflationTracker displays tier breakdown, scarcity, and historical insights
- PlayerQueue receives positional scarcity data for display

### Backend Architect

- Express server in `server/` directory
- Projections cached for 24 hours (projectionsCacheService)
- Auction data cached for 30 seconds (in-memory)
- Value calculator supports SGP (categories) and Points scoring

### Test Engineer

- Priority: valueCalculator.ts, inflationCalculator.ts
- Test inflation edge cases (empty draft, single tier, extreme values)
- Test player matching algorithm accuracy

### Fullstack Developer

- API client in `src/lib/auctionApi.ts`
- Types shared between frontend and backend where possible
- Sync-lite endpoint reduces payload from 800KB to 200 bytes

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 2024 | shadcn/ui components | Accessible, customizable, Tailwind-native |
| Dec 2024 | Express backend | Simple, sufficient for MVP, easy TypeScript integration |
| Dec 2024 | SGP-based values | Standard fantasy baseball methodology |
| Dec 2024 | Tier-weighted inflation | More accurate than simple average |
| Dec 2024 | Sync-lite endpoint | 4000x payload reduction for better performance |
| Dec 2024 | Historical baselines | Data from 6 analyzed auctions improves predictions |

---

## Open Questions / TODOs

1. **Persistence**: Move from localStorage to PostgreSQL for multi-device
2. **Authentication**: JWT + refresh token flow
3. **Real-time**: WebSocket for live auction updates (reduce polling)
4. **Testing**: Vitest for unit tests, Playwright for E2E
5. **Deployment**: Consider Railway/Render for backend

---

*Document Version: 2.0*
*Last Updated: December 2024*
*Maintained by: context-manager agent*

# Fantasy Baseball Auction Tool - Project Context

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Project Name** | Fantasy Baseball Auction Tool |
| **Purpose** | Optimize draft budgeting during fantasy baseball salary cap auctions |
| **Tech Stack** | React 18 + TypeScript + Vite + Framer Motion (Frontend) + Node.js/Express (Backend) |
| **UI Framework** | Radix UI + Tailwind CSS (shadcn/ui) |
| **Data Sources** | FanGraphs (Steamer), JA Projections (Jon Anderson, MLB Data Warehouse), Harry Knows Ball (Dynasty), Couch Managers Live Sync |
| **Backend Status** | Implemented - Projections API, Auction Sync, Value Calculator, Dynasty Rankings |
| **Status** | Full-Stack MVP with Dynasty League Support & Market Correction |

---

## Project Overview

This is a **React single-page application** that helps fantasy baseball team managers optimize their draft budgets during salary cap auction drafts. The application tracks player values, calculates real-time inflation rates, and provides analytics to help users make informed bidding decisions.

### Core Features

1. **League Configuration** - Custom scoring systems (Roto, H2H Categories, H2H Points), roster positions, and budget settings
2. **Dynasty League Support** - Dynasty rankings integration (Harry Knows Ball or custom CSV), configurable dynasty weight
3. **Live Auction Sync** - Real-time integration with Couch Managers draft rooms
4. **Manual Draft Mode** - Offline drafting with manual price entry when not using Couch Managers
5. **Projections Engine** - FanGraphs (Steamer) and JA Projections (Jon Anderson, MLB Data Warehouse) with SGP-based value calculation
6. **Category Validation** - 100+ scoring categories with accuracy classification (direct/calculated/estimated)
7. **Market Inflation Correction** - Tier-based and position-based adjustments from historical auction analysis
8. **Tier-Weighted Inflation** - Sophisticated inflation tracking with historical baselines and positional scarcity
9. **Value Adjustment** - Dynamic player value adjustment based on remaining budget and positional need
10. **Team Analytics** - Post-draft team analysis with projected stats and charts
11. **Account Management** - User settings, subscription tiers (free/premium), email/password management
12. **Error Recovery** - Global ErrorBoundary with graceful crash recovery and retry UI

---

## Directory Structure

```text
afineauctioncalculator/
├── src/                        # Frontend React application
│   ├── components/             # React components (20+ custom + 60+ UI)
│   │   ├── ui/                 # shadcn/ui component library
│   │   ├── AccountScreen.tsx   # User account & subscription settings
│   │   ├── EditLeagueModal.tsx # Edit league settings modal
│   │   ├── ProjectionsLoadingScreen.tsx  # Animated loading for projections
│   │   ├── DraftRoomLoadingScreen.tsx    # Animated loading for draft sync
│   │   ├── LoadingTransitionManager.tsx  # Loading phase orchestrator
│   │   ├── ErrorBoundary.tsx   # Global error handling with retry
│   │   └── *.tsx               # Business logic components
│   ├── lib/
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── calculations.ts     # Inflation & value calculations
│   │   ├── auctionApi.ts       # API client for backend
│   │   ├── csvParser.ts        # CSV parser for custom dynasty rankings
│   │   ├── scoringCategories.ts # Shared category definitions
│   │   └── mockData.ts         # Sample player data
│   ├── App.tsx                 # Root component & state manager
│   └── main.tsx                # Entry point
├── server/                     # Backend Express server
│   ├── index.ts                # Server entry point
│   ├── routes/
│   │   ├── auction.ts          # Couch Managers sync endpoints
│   │   └── projections.ts      # Projections API endpoints
│   ├── services/
│   │   ├── couchManagersScraper.ts    # Couch Managers web scraper
│   │   ├── projectionsService.ts      # FanGraphs projections fetcher
│   │   ├── projectionsCacheService.ts # 24-hour projection cache
│   │   ├── auctionCacheService.ts     # File-based auction cache (5-min TTL)
│   │   ├── jaProjectionsService.ts    # JA Projections (Jon Anderson, MLB Data Warehouse) from Google Sheets
│   │   ├── dynastyRankingsScraper.ts  # Harry Knows Ball dynasty rankings
│   │   ├── valueCalculator.ts         # SGP-based value calculation
│   │   ├── inflationCalculator.ts     # Tier-weighted inflation
│   │   └── playerMatcher.ts           # Name matching algorithm
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
| AccountScreen | `src/components/AccountScreen.tsx` | User settings, subscription management |
| EditLeagueModal | `src/components/EditLeagueModal.tsx` | Edit league settings after creation |
| ProjectionsLoadingScreen | `src/components/ProjectionsLoadingScreen.tsx` | Animated loading for projections |
| DraftRoomLoadingScreen | `src/components/DraftRoomLoadingScreen.tsx` | Animated loading for draft sync |

### Backend Files

| Service | File | Purpose |
|---------|------|---------|
| Auction Routes | `server/routes/auction.ts` | Couch Managers sync endpoints |
| Projections Routes | `server/routes/projections.ts` | FanGraphs/JA projection endpoints |
| Value Calculator | `server/services/valueCalculator.ts` | SGP/Points value calculation |
| Inflation Calculator | `server/services/inflationCalculator.ts` | Enhanced inflation with scarcity |
| Projections Cache | `server/services/projectionsCacheService.ts` | 24-hour projection caching |
| Auction Cache | `server/services/auctionCacheService.ts` | File-based auction cache (5-min TTL) |
| JA Projections | `server/services/jaProjectionsService.ts` | JA Projections from Google Sheets |
| Dynasty Rankings | `server/services/dynastyRankingsScraper.ts` | Harry Knows Ball dynasty rankings |

---

## Data Model Summary

### Core Types (src/lib/types.ts)

```typescript
// League settings - includes Couch Managers integration and dynasty support
LeagueSettings {
  leagueName, couchManagerRoomId
  numTeams, budgetPerTeam
  scoringType: 'rotisserie' | 'h2h-categories' | 'h2h-points'
  projectionSystem: 'steamer' | 'batx' | 'ja'
  leagueType: 'redraft' | 'dynasty'  // NEW: Dynasty league support
  rosterSpots: { C, 1B, 2B, 3B, SS, OF, CI, MI, UTIL, SP, RP, P, Bench }
  hittingCategories, pitchingCategories, pointsSettings
  hitterPitcherSplit?: { hitter: 0.68, pitcher: 0.32 }
  dynastySettings?: {  // NEW: Dynasty-specific settings
    dynastyWeight: number  // 0.0-1.0 (weight dynasty rankings vs projections)
    includeMinors: boolean
    rankingsSource?: 'harryknowsball' | 'custom'
    customRankings?: CustomDynastyRanking[]
  }
}

// Custom dynasty ranking from CSV upload
CustomDynastyRanking {
  name: string
  rank: number
  playerId?: string
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
                        │  FanGraphs API (Steamer)        │
                        │  JA Projections (Google Sheets) │
                        │  Harry Knows Ball (Dynasty)     │
                        │  Couch Managers (Live Auction)  │
                        └────────────────┬────────────────┘
                                         │
                        ┌────────────────▼────────────────┐
                        │       Express Backend           │
                        ├─────────────────────────────────┤
                        │  /api/projections/:system       │
                        │  /api/projections/calculate-values │
                        │  /api/auction/:roomId/sync-lite │
                        │  /api/dynasty/rankings          │
                        └────────────────┬────────────────┘
                                         │
┌──────────────────┐    ┌────────────────▼────────────────┐
│   localStorage   │◄───│         App.tsx                 │
│ (draft progress) │    │    (state manager)              │
└──────────────────┘    └────────────────┬────────────────┘
                                         │
       ┌───────────────────┬─────────────┼─────────────┬────────────────────┐
       │                   │             │             │                    │
┌──────▼──────┐  ┌─────────▼─────────┐  ┌▼───────────┐ ┌▼────────────┐ ┌────▼────────┐
│ AccountScreen│  │   SetupScreen     │  │ DraftRoom  │ │ PostDraft   │ │EditLeague   │
│ (settings)  │  │   (config)        │  │ (auction)  │ │ Analysis    │ │Modal        │
└─────────────┘  └───────────────────┘  └─────┬──────┘ └─────────────┘ └─────────────┘
                                              │
                    ┌─────────────────────────┼────────────────────┐
                    │                         │                    │
          ┌─────────▼─────────┐    ┌──────────▼───────┐ ┌──────────▼──────────┐
          │   PlayerQueue     │    │   RosterPanel    │ │  InflationTracker   │
          │ (with scarcity)   │    │  (team selector) │ │  (tier/position)    │
          └───────────────────┘    └──────────────────┘ └─────────────────────┘
```

---

## Current State vs Planned State

### Current (Full-Stack MVP with Dynasty Support)

**Implemented:**

- Express backend with projections and auction sync APIs
- FanGraphs projections (Steamer) with 24-hour caching
- JA Projections from Google Sheets
- **Dynasty league support** with Harry Knows Ball rankings
- **Custom dynasty rankings upload** via CSV
- SGP-based value calculation for Roto/H2H Categories leagues
- Points-based value calculation for H2H Points leagues
- Couch Managers live sync with player matching
- Tier-weighted inflation with historical baselines
- Positional scarcity analysis with inflation adjustments
- Team budget constraint tracking (effective budget calculation)
- Lightweight sync endpoint (~200 bytes vs 800KB)
- **Account management** with subscription tiers (free/premium)
- **Edit league modal** for modifying settings after creation
- **Animated loading screens** using Framer Motion

**Storage:**

- localStorage for draft progress persistence
- Server-side projection caching (24-hour TTL)
- **File-based auction caching (5-minute TTL)**
- Dynasty rankings caching (12-hour TTL)

### Future Enhancements

- PostgreSQL database for persistent storage
- JWT authentication with OAuth (backend)
- Multi-user league sharing
- Real-time draft rooms via WebSocket
- Stripe payment integration (currently mock)
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

- **FanGraphs** - Player projections (Steamer system)
- **JA Projections** - Google Sheets-based projections
- **Harry Knows Ball** - Dynasty rankings (web scraping)
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

### Market Inflation Correction

Based on historical auction analysis (Duke Draft and others):

**Tier-Based Factors** (applied at value calculation):

- Tier 1-2 (Elite): -5% to -15% deflation (budget constraints limit bidders)
- Tier 3-4: +15% to +35% inflation (quality players in demand)
- Tier 5-6: +50% to +75% inflation (value picks bid up)
- Tier 7-10: +100% to +300% inflation (roster filler premium)

**Position Scarcity Factors**:

- Catchers: +20% (very shallow talent pool)
- Relief Pitchers: +25% (scarce, critical for roster construction)
- Starting Pitchers: +12% (high demand, limited elite options)
- First Base: -5% (deepest position)
- Utility/DH: -5% (flexible, no premium)

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
| Dec 2025 | shadcn/ui components | Accessible, customizable, Tailwind-native |
| Dec 2025 | Express backend | Simple, sufficient for MVP, easy TypeScript integration |
| Dec 2025 | SGP-based values | Standard fantasy baseball methodology |
| Dec 2025 | Tier-weighted inflation | More accurate than simple average |
| Dec 2025 | Sync-lite endpoint | 4000x payload reduction for better performance |
| Dec 2025 | Historical baselines | Data from 6 analyzed auctions improves predictions |
| Dec 2025 | Dynasty league support | Expand user base to keeper/dynasty league managers |
| Dec 2025 | Framer Motion animations | Premium feel for loading screens |
| Dec 2025 | File-based auction cache | Persist cache across server restarts, configurable TTL |

---

## Open Questions / TODOs

1. **Persistence**: Move from localStorage to PostgreSQL for multi-device
2. **Authentication**: JWT + refresh token flow (backend)
3. **Real-time**: WebSocket for live auction updates (reduce polling)
4. **Testing**: Vitest for unit tests, Playwright for E2E
5. **Deployment**: Consider Railway/Render for backend
6. **Payments**: Stripe integration (currently mock subscription system)

---

*Document Version: 3.1*
*Last Updated: December 2025*
*Maintained by: context-manager agent*

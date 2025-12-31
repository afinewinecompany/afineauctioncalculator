# Context Index for Claude Agents

## Quick Navigation

Use this index to quickly find relevant documentation for your task.

---

## By Agent Type

### Frontend Developer

| Document | When to Read |
|----------|--------------|
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | **Always** - Component structure, state management, API integration |
| [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) | Adding/modifying components |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Understanding overall project |

### Backend Architect

| Document | When to Read |
|----------|--------------|
| [API_DESIGN.md](./API_DESIGN.md) | **Always** - REST endpoints (implemented), WebSocket (planned) |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Understanding data model, value calculation |
| [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) | Future database schema |
| [PRODUCTION_ROADMAP.md](./PRODUCTION_ROADMAP.md) | Production deployment requirements |

### Fullstack Developer

| Document | When to Read |
|----------|--------------|
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | **Always** - Overall architecture, data flow |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | Frontend changes, API client |
| [API_DESIGN.md](./API_DESIGN.md) | Backend endpoints |

### Test Engineer

| Document | When to Read |
|----------|--------------|
| [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) | Understanding component interfaces |
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | Business logic location |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Key files for testing |

### Debugger

| Document | When to Read |
|----------|--------------|
| [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) | State flow, component relationships |
| [API_DESIGN.md](./API_DESIGN.md) | API request/response formats |
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Key files reference |

---

## By Task

### Understanding the Project

1. [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - Start here
2. [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - Data flow

### Modifying Components

1. [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) - Component inventory
2. [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - Patterns

### Working with Backend

1. [API_DESIGN.md](./API_DESIGN.md) - Implemented endpoints
2. [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - Backend services overview

### Understanding Inflation Calculation

1. [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - Business logic section
2. [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) - calculations.ts reference
3. `server/services/inflationCalculator.ts` - Server-side implementation

---

## Key Files Quick Reference

### Must-Read Source Files

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | All TypeScript interfaces (frontend) |
| `server/types/auction.ts` | Backend auction/sync types |
| `src/lib/calculations.ts` | Frontend inflation calculation |
| `src/lib/auctionApi.ts` | API client for backend |
| `src/lib/csvParser.ts` | CSV parser for custom dynasty rankings |
| `src/components/DraftRoom.tsx` | Main draft interface with sync |
| `server/services/inflationCalculator.ts` | Server-side inflation with scarcity |
| `server/services/valueCalculator.ts` | SGP-based value calculation |

### Backend Service Files

| File | Purpose |
|------|---------|
| `server/routes/auth.ts` | Authentication endpoints (register, login, refresh, logout, Google OAuth) |
| `server/routes/leagues.ts` | Leagues CRUD + draft state persistence |
| `server/routes/auction.ts` | Couch Managers sync endpoints |
| `server/routes/projections.ts` | FanGraphs/JA projection endpoints |
| `server/middleware/auth.ts` | JWT authentication middleware (requireAuth, optionalAuth) |
| `server/services/authService.ts` | Auth business logic (tokens, password hashing, user management) |
| `server/services/projectionsCacheService.ts` | 24-hour projection caching |
| `server/services/auctionCacheService.ts` | File-based auction caching (5-min TTL) |
| `server/services/couchManagersScraper.ts` | Auction data scraper |
| `server/services/dynastyRankingsScraper.ts` | Harry Knows Ball dynasty rankings |
| `server/services/jaProjectionsService.ts` | JA Projections (Jon Anderson, MLB Data Warehouse) from Google Sheets |
| `server/db.ts` | Prisma client singleton |
| `prisma/schema.prisma` | Database schema definition |

### New Frontend Components

| File | Purpose |
|------|---------|
| `src/components/AccountScreen.tsx` | User account & subscription settings |
| `src/components/EditLeagueModal.tsx` | Edit league settings modal (with dynasty support) |
| `src/components/ProjectionsLoadingScreen.tsx` | Animated loading screen for projections |
| `src/components/DraftRoomLoadingScreen.tsx` | Animated loading screen for draft sync |
| `src/components/LoadingTransitionManager.tsx` | Manages loading screen transitions |
| `src/components/ErrorBoundary.tsx` | Global error handling with retry UI |

### Library Files

| File                             | Purpose                                                            |
|----------------------------------|--------------------------------------------------------------------|
| `src/lib/authApi.ts`             | Authentication API client (login, register, token refresh)         |
| `src/lib/leaguesApi.ts`          | Leagues API client (CRUD, draft state sync)                        |
| `src/lib/scoringCategories.ts`   | Shared category definitions for ScoringConfig and EditLeagueModal  |
| `src/lib/csvParser.ts`           | CSV parser for custom dynasty rankings upload                      |

### Test Files

| File                             | Purpose                                                            |
|----------------------------------|--------------------------------------------------------------------|
| `tests/e2e/auth-flow-test.ts`    | E2E authentication flow tests (production endpoints)               |
| `tests/e2e/leagues-flow-test.ts` | E2E leagues CRUD tests                                             |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies |
| `vite.config.ts` | Build configuration |
| `tsconfig.json` | TypeScript settings |

---

## Project Summary

**Fantasy Baseball Auction Tool**

- **Purpose**: Optimize fantasy baseball draft budgets with live auction sync
- **Status**: Production-Ready MVP with Full Authentication & Persistence
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + Framer Motion
- **Backend**: Express + TypeScript + Prisma + PostgreSQL
- **Database**: PostgreSQL via Railway (production) / local (development)
- **Data Sources**: FanGraphs (Steamer), JA Projections (Jon Anderson, MLB Data Warehouse), Harry Knows Ball dynasty rankings, Couch Managers live sync

### Key Features (Implemented)

1. **JWT Authentication** with access/refresh token flow (NEW v3.2)
2. **PostgreSQL persistence** via Prisma ORM (NEW v3.2)
3. **Leagues CRUD API** with cross-device sync (NEW v3.2)
4. **Cross-device draft state persistence** via database (NEW v3.2)
5. League configuration (scoring, rosters, Couch Managers room ID)
6. **Dynasty league support** with dynasty rankings integration
7. Live auction sync with player matching
8. Tier-weighted inflation tracking with historical baselines
9. Positional scarcity analysis with adjustments
10. SGP-based and Points-based value calculation
11. Post-draft analytics
12. **Account management** with subscription tiers (free/premium)
13. **Edit league modal** for modifying settings after creation
14. **Animated loading screens** for projections and draft room sync
15. **JA Projections** (Jon Anderson, MLB Data Warehouse) support from Google Sheets
16. **Custom dynasty rankings upload** (CSV)
17. **Manual draft mode** for offline drafting without Couch Managers
18. **Market inflation correction** with tier/position adjustments
19. **ErrorBoundary** for graceful error recovery
20. **Google OAuth** integration (optional)
21. **E2E Authentication Tests** for production verification

### Open Work

See [PRODUCTION_ROADMAP.md](./PRODUCTION_ROADMAP.md) for detailed implementation plan:

1. ~~PostgreSQL persistence~~ - **DONE** (Prisma + PostgreSQL)
2. ~~JWT authentication~~ - **DONE** (access/refresh tokens)
3. WebSocket for real-time drafts (replace polling)
4. ~~Testing framework setup~~ - **PARTIAL** (E2E auth tests added)
5. Stripe payment integration (currently mock)

---

## Document Versions

| Document | Version | Last Updated |
|----------|---------|--------------|
| PROJECT_CONTEXT.md | 3.2 | December 2025 |
| FRONTEND_ARCHITECTURE.md | 3.2 | December 2025 |
| API_DESIGN.md | 3.2 | December 2025 |
| COMPONENT_REFERENCE.md | 3.1 | December 2025 |
| DATABASE_ARCHITECTURE.md | 2.0 | December 2025 |
| PRODUCTION_ROADMAP.md | 1.0 | December 2025 |
| CONTEXT_INDEX.md | 3.3 | December 2025 |

---

## Recent Changes (December 2025 - v3.2)

### Full Backend Authentication - IMPLEMENTED

- **JWT authentication** with access tokens (1h) and refresh tokens (7d)
- **Password hashing** with bcrypt (cost factor 12)
- **Timing attack protection** for login (prevents email enumeration)
- **Token refresh endpoint** with mutex to prevent race conditions
- **Google OAuth** integration with consent flow
- **Password reset flow** with secure token generation
- **Rate limiting** on authentication endpoints
- Files: `server/routes/auth.ts`, `server/middleware/auth.ts`, `server/services/authService.ts`

### PostgreSQL Database - IMPLEMENTED

- **Prisma ORM** with PostgreSQL backend
- Production database on **Railway**
- Schema includes: Users, RefreshTokens, Leagues, UserLeagues, Players, PlayerProjections, LeaguePlayers, DraftPicks
- **Draft state persistence** stored as JSON in League model
- Files: `prisma/schema.prisma`, `server/db.ts`

### Leagues CRUD API - IMPLEMENTED

- Full CRUD operations for leagues (`/api/leagues`)
- **Cross-device sync** - leagues persist across login/logout
- **Draft state endpoints** (`GET/PUT /api/leagues/:id/draft-state`)
- **Optimistic locking** to prevent concurrent edit conflicts
- Files: `server/routes/leagues.ts`, `src/lib/leaguesApi.ts`

### Frontend Auth Integration

- **authApi.ts** - Token management with auto-refresh
- **leaguesApi.ts** - Authenticated league API calls
- **authenticatedFetch** wrapper handles 401 → refresh → retry
- Token storage in localStorage (access + refresh)

### E2E Testing

- **auth-flow-test.ts** - Comprehensive auth flow testing
- Tests: registration, login, token refresh, logout, Google OAuth
- Security tests: timing attacks, token invalidation, rate limiting
- Run with: `npx tsx tests/e2e/auth-flow-test.ts`

---

## Previous Changes (December 2025 - v3.1)

### Error Handling & Stability

- **ErrorBoundary** component for graceful crash recovery
- Global error catching with retry UI and development stack traces
- Improved stability across all screens

### Shared Scoring Categories

- **scoringCategories.ts** - Centralized category definitions
- 100+ hitting and pitching categories organized by section
- Shared between ScoringConfig and EditLeagueModal for consistency
- Category metadata: `isRatio`, `isNegative` flags

### Manual Draft Mode

- **PlayerQueue** now supports manual mode for offline drafting
- Quick draft buttons with price input
- Draft to "My Team" or "Other Team" options

### Market Inflation Correction

- **Tier-based market factors** derived from historical auction analysis
- Elite players (Tier 1-2): 5-15% deflation (budget constraints limit bidders)
- Replacement-level (Tier 7-10): 100-300% inflation (roster filler premium)
- **Position scarcity factors** applied at value calculation time
- Catchers +20%, Relief Pitchers +25%, SP +12%

### Multiple Active Auctions Support

- `activeAuctions` array in auction data for leagues with concurrent bidding
- UI highlights all players currently on the block

---

## Previous Changes (December 2025 - v3.0)

### Dynasty League Support

- New `leagueType` setting: `'redraft'` or `'dynasty'`
- Dynasty settings: `dynastyWeight`, `includeMinors`, `rankingsSource`
- Harry Knows Ball dynasty rankings scraper
- Custom dynasty rankings upload via CSV

### New Projection Source

- JA Projections (Jon Anderson, MLB Data Warehouse) from Google Sheets (`jaProjectionsService.ts`)
- BatX projections currently disabled (unavailable)

### Account & Subscription System

- New `AccountScreen` component for user settings
- Subscription tiers (free/premium) with mock billing
- Email and password management (email users only)
- Google OAuth detection

### UI/UX Enhancements

- Animated loading screens using Framer Motion
- `ProjectionsLoadingScreen` - Baseball-themed with progress stages
- `DraftRoomLoadingScreen` - Connection hub visualization
- `LoadingTransitionManager` - Orchestrates loading phases
- `EditLeagueModal` - Edit league settings after creation

### Backend Caching Improvements

- File-based auction caching (`auctionCacheService.ts`) with 5-min TTL
- Cache status endpoints and cleanup utilities
- `?refresh=true` query param to force fresh scrape

### Value Calculator Enhancements

- **Category Validation System** - Classifies 100+ scoring categories by accuracy
  - `direct` - From projections (high accuracy)
  - `calculated` - Derived from projection data (high accuracy)
  - `estimated` - Statistical correlations (medium accuracy)
  - `unsupported` - No reliable data available
- **Statistical Estimation Functions** - Estimates missing stats:
  - HBP (Hit By Pitch) from walk rate correlation
  - SF (Sacrifice Flies) from RBI/HR ratio
  - GIDP (Double Plays) from contact rate, speed, batted ball tendency
  - QS (Quality Starts) from IP/GS and ERA
  - BS (Blown Saves), CG, SHO, and 20+ more pitcher estimations
- **Dynasty Dollar-Based Blending** - Blends values at dollar level, not score level
- **Unranked Player Exclusion** - Dynasty mode excludes players without HKB rankings from draft pool

### Previous Changes (v2.0)

- Express server with projections and auction sync APIs
- FanGraphs projections (Steamer) with 24-hour caching
- Couch Managers web scraper for live auction data
- SGP-based value calculation for Roto/H2H Categories
- Points-based value calculation for H2H Points
- Tier-weighted inflation with positional scarcity
- Sync-lite endpoint reduces payload from 800KB to 200 bytes

---

*This index is maintained by the context-manager agent*
*Last Updated: December 2025 (v3.3)*

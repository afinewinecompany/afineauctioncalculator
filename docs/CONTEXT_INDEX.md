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
| `src/components/DraftRoom.tsx` | Main draft interface with sync |
| `server/services/inflationCalculator.ts` | Server-side inflation with scarcity |
| `server/services/valueCalculator.ts` | SGP-based value calculation |

### Backend Service Files

| File | Purpose |
|------|---------|
| `server/routes/auction.ts` | Couch Managers sync endpoints |
| `server/routes/projections.ts` | FanGraphs projection endpoints |
| `server/services/projectionsCacheService.ts` | 24-hour projection caching |
| `server/services/couchManagersScraper.ts` | Auction data scraper |

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
- **Status**: Full-Stack MVP with Live Auction Sync
- **Frontend**: React 18 + TypeScript + Vite + Tailwind
- **Backend**: Express + TypeScript
- **Data Sources**: FanGraphs projections, Couch Managers live sync

### Key Features (Implemented)

1. League configuration (scoring, rosters, Couch Managers room ID)
2. Live auction sync with player matching
3. Tier-weighted inflation tracking with historical baselines
4. Positional scarcity analysis with adjustments
5. SGP-based and Points-based value calculation
6. Post-draft analytics

### Open Work

1. PostgreSQL persistence (replace localStorage)
2. JWT authentication
3. WebSocket for real-time drafts (replace polling)
4. Testing framework setup
5. Mobile optimization

---

## Document Versions

| Document | Version | Last Updated |
|----------|---------|--------------|
| PROJECT_CONTEXT.md | 2.0 | December 2024 |
| FRONTEND_ARCHITECTURE.md | 2.0 | December 2024 |
| API_DESIGN.md | 2.0 | December 2024 |
| COMPONENT_REFERENCE.md | 2.0 | December 2024 |
| DATABASE_ARCHITECTURE.md | 1.0 | December 2024 |

---

## Recent Changes (December 2024)

### Backend Implementation

- Added Express server with projections and auction sync APIs
- FanGraphs projections (Steamer/BatX/JA) with 24-hour caching
- Couch Managers web scraper for live auction data
- SGP-based value calculation for Roto/H2H Categories
- Points-based value calculation for H2H Points
- Tier-weighted inflation with positional scarcity

### Frontend Enhancements

- DraftRoom now syncs with Couch Managers every 2 minutes
- InflationTracker displays tier breakdowns, scarcity, historical insights
- RosterPanel has team selector dropdown
- PlayerQueue shows positional scarcity badges
- Sync-lite endpoint reduces payload from 800KB to 200 bytes

---

*This index is maintained by the context-manager agent*
*Last Updated: December 2024*

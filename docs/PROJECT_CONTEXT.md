# Fantasy Baseball Auction Tool - Project Context

## Quick Reference

| Attribute | Value |
|-----------|-------|
| **Project Name** | Fantasy Baseball Auction Tool |
| **Purpose** | Optimize draft budgeting during fantasy baseball salary cap auctions |
| **Tech Stack** | React 18 + TypeScript + Vite |
| **UI Framework** | Radix UI + Tailwind CSS (shadcn/ui) |
| **Current Storage** | localStorage (browser) |
| **Planned Backend** | PostgreSQL + Node.js/Express + Prisma |
| **Status** | MVP Complete - Ready for Backend Integration |

---

## Project Overview

This is a **React single-page application** that helps fantasy baseball team managers optimize their draft budgets during salary cap auction drafts. The application tracks player values, calculates real-time inflation rates, and provides analytics to help users make informed bidding decisions.

### Core Features

1. **League Configuration** - Custom scoring systems (Roto, H2H Categories, H2H Points), roster positions, and budget settings
2. **Draft Management** - Real-time player queue, bid tracking, nomination system
3. **Inflation Tracking** - Live calculation of market inflation based on draft activity
4. **Value Analysis** - Indicators for deal quality (Great Deal, Fair Value, Overpay)
5. **Team Analytics** - Post-draft team analysis with projected stats and charts

---

## Directory Structure

```
afineauctioncalculator/
├── src/
│   ├── components/          # React components (15+ custom + 60+ UI)
│   │   ├── ui/              # shadcn/ui component library
│   │   └── *.tsx            # Business logic components
│   ├── lib/
│   │   ├── types.ts         # TypeScript interfaces
│   │   ├── calculations.ts  # Draft math (inflation, values)
│   │   ├── mockData.ts      # Sample player data
│   │   └── utils.ts         # Helper utilities
│   ├── assets/              # Images from Figma design
│   ├── App.tsx              # Root component & state manager
│   └── main.tsx             # Entry point
├── database/
│   ├── migrations/          # SQL schema files
│   ├── prisma/              # Prisma ORM configuration
│   └── SETUP.md             # Database setup guide
├── docs/                    # Project documentation
│   ├── PROJECT_CONTEXT.md   # This file
│   └── DATABASE_ARCHITECTURE.md
├── .claude/
│   └── agents/              # Claude agent configurations
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Key Files for Agents

### Must-Read Files

| File | Purpose | When to Read |
|------|---------|--------------|
| `src/lib/types.ts` | All TypeScript interfaces | Before any coding task |
| `src/App.tsx` | Root state management | Understanding data flow |
| `src/lib/calculations.ts` | Business logic | Modifying draft calculations |
| `docs/DATABASE_ARCHITECTURE.md` | Database design | Backend development |

### Component Files

| Component | File | Purpose |
|-----------|------|---------|
| DraftRoom | `src/components/DraftRoom.tsx` | Main draft interface orchestrator |
| PlayerQueue | `src/components/PlayerQueue.tsx` | Available/drafted player lists |
| RosterPanel | `src/components/RosterPanel.tsx` | User's team roster display |
| SetupScreen | `src/components/SetupScreen.tsx` | League configuration form |
| InflationTracker | `src/components/InflationTracker.tsx` | Inflation visualization |

---

## Data Model Summary

### Core Types (src/lib/types.ts)

```typescript
// User session data
UserData {
  username, email, leagues[]
  authProvider: 'email' | 'google'
}

// League configuration
SavedLeague {
  id, leagueName, status
  settings: LeagueSettings
  players: Player[]
}

// League settings
LeagueSettings {
  numTeams, budgetPerTeam
  scoringType: 'rotisserie' | 'h2h-categories' | 'h2h-points'
  projectionSystem: 'steamer' | 'batx' | 'ja'
  rosterSpots: { C, 1B, 2B, 3B, SS, OF, CI, MI, UTIL, SP, RP, P, Bench }
  hittingCategories, pitchingCategories, pointsSettings
}

// Player data
Player {
  id, name, team, positions[]
  projectedValue, adjustedValue
  projectedStats: { HR, RBI, SB, AVG, W, K, ERA, WHIP, SV }
  status: 'available' | 'drafted' | 'onMyTeam'
  draftedPrice?, draftedBy?, tier?
}
```

### Data Flow

```
localStorage('fantasyBaseballUser')
    ↓
App.tsx (state manager)
    ↓
├── LoginPage → Authentication
├── LeaguesList → League selection
├── SetupScreen → League creation
└── DraftRoom → Draft execution
        ↓
    ├── DraftHeader (stats display)
    ├── PlayerQueue (player lists)
    ├── RosterPanel (my team)
    ├── NominationPanel (active bid)
    └── InflationTracker (analytics)
```

---

## Current State vs Planned State

### Current (localStorage MVP)

- All data stored in browser localStorage
- Single-user only
- No cross-device sync
- ~5MB storage limit
- No real-time collaboration

### Planned (Production Backend)

- PostgreSQL database with 14 tables
- JWT authentication with OAuth
- Multi-user league sharing
- Real-time draft rooms via WebSocket
- Redis caching layer

---

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build to /build
```

---

## Integration Points

### External Services (Planned)

- **Couch Manager** - Draft room synchronization
- **Steamer/Batx/JA** - Player projection imports
- **Google OAuth** - Authentication

### Internal APIs (To Build)

See [API_DESIGN.md](./API_DESIGN.md) for planned endpoints.

---

## Key Business Logic

### Inflation Calculation

Located in `src/lib/calculations.ts`:

```
inflation_rate = (money_remaining / expected_remaining_value) - 1
```

- Tracks total league spending vs total player value
- Adjusts player values in real-time during draft
- Critical for bidding strategy

### Value Indicators

- **Great Deal**: Bid < 80% of adjusted value
- **Fair Value**: Bid within 80-120% of adjusted value
- **Overpay**: Bid > 120% of adjusted value

---

## Agent-Specific Notes

### Frontend Developer
- Components use Radix UI primitives styled with Tailwind
- State management is React Context + hooks
- All forms use react-hook-form

### Backend Architect
- Database schema fully designed (see DATABASE_ARCHITECTURE.md)
- API endpoints planned (see API_DESIGN.md)
- Prisma ORM schema ready in `database/prisma/`

### Test Engineer
- No tests currently implemented
- Testing framework not yet chosen
- Priority: calculation functions, component rendering

### Database Architect
- PostgreSQL 15+ required
- 14 tables + 6 enums designed
- Inflation calculation as stored procedure

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 2024 | PostgreSQL over MongoDB | ACID compliance for draft transactions |
| Dec 2024 | Prisma ORM | Type-safe queries, migration support |
| Dec 2024 | shadcn/ui components | Accessible, customizable, Tailwind-native |
| Dec 2024 | localStorage for MVP | Quick iteration before backend |

---

## Open Questions / TODOs

1. **Authentication**: Implement JWT + refresh token flow
2. **Real-time**: WebSocket vs SSE for draft rooms
3. **Mobile**: Responsive design optimization needed
4. **Testing**: Choose testing framework (Vitest recommended)
5. **Deployment**: Vercel (frontend) + Railway/Supabase (backend)

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Maintained by: context-manager agent*
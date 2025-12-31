# Fantasy Baseball Auction Tool - Database Architecture

## Implementation Status: COMPLETE

**Database**: PostgreSQL via Railway (production) / local Docker (development)
**ORM**: Prisma Client
**Schema**: `prisma/schema.prisma`

## Executive Summary

This document describes the database architecture for the Fantasy Baseball Auction Tool. The migration from localStorage to PostgreSQL has been **completed** using Prisma ORM.

---

## Current State (Implemented)

### Data Model Overview

The application uses PostgreSQL with Prisma ORM. Data is persisted in the database and synchronized across devices.

```text
Prisma Models (prisma/schema.prisma)
├── User - User accounts and authentication
│   ├── id, email, passwordHash, name
│   ├── authProvider ('email' | 'google')
│   ├── subscriptionTier ('free' | 'premium')
│   └── Relations: ownedLeagues, refreshTokens
├── RefreshToken - JWT refresh tokens
│   ├── tokenHash (hashed), expiresAt
│   └── Relations: user
├── League - League configuration and state
│   ├── name, numTeams, budgetPerTeam
│   ├── scoringType, projectionSystem
│   ├── rosterSpots (JSON), categories (JSON)
│   ├── draftState (JSON) - cross-device sync
│   ├── status ('setup' | 'drafting' | 'completed')
│   └── Relations: owner, userLeagues, leaguePlayers
├── UserLeague - Many-to-many user/league
├── Player - Player master data
├── PlayerProjection - Projection stats by system
├── LeaguePlayer - Player state per league
└── DraftPick - Draft history/audit trail
```

### What's Implemented

- User authentication with JWT access/refresh tokens
- League CRUD with full settings persistence
- Draft state sync (stored as JSON in League.draftState)
- Cross-device sync via authenticated API calls
- Google OAuth integration
- Password reset flow

---

## Technology Stack (Implemented)

### Primary Database: PostgreSQL 15+

**Status**: IMPLEMENTED via Railway (production)

- Strong ACID compliance for transaction integrity during drafts
- Excellent JSON/JSONB support for flexible scoring configurations
- Rich indexing options for player search
- Mature ecosystem with proven scalability

### ORM: Prisma Client

**Status**: IMPLEMENTED

- Type-safe database queries
- Auto-generated TypeScript types
- Easy migrations with `prisma migrate`
- Connection pooling via PrismaClient singleton

### Authentication: JWT + Refresh Tokens

**Status**: IMPLEMENTED

- Access tokens (1h expiry) for API authentication
- Refresh tokens (7d expiry) stored hashed in database
- Automatic token refresh on 401 response
- Timing-attack-safe password comparison

### Future: WebSocket for Real-time

**Status**: PLANNED

- Replace 2-minute polling with live updates
- Pub/Sub for draft room synchronization

---

## Database Schema Design

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────────┐
│   users     │──────<│  user_leagues   │>──────│     leagues      │
└─────────────┘       └─────────────────┘       └──────────────────┘
                              │                         │
                              │                         │
                      ┌───────┴───────┐         ┌───────┴───────┐
                      │               │         │               │
               ┌──────┴──────┐ ┌──────┴──────┐  │        ┌──────┴──────┐
               │ draft_picks │ │   rosters   │  │        │league_settings│
               └─────────────┘ └─────────────┘  │        └─────────────┘
                      │                         │
                      └────────────┬────────────┘
                                   │
                            ┌──────┴──────┐
                            │   players   │
                            └─────────────┘
                                   │
                            ┌──────┴──────┐
                            │player_stats │
                            └─────────────┘
```

### Core Tables

```sql
-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth users
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'email',
    profile_picture_url TEXT,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,

    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_auth_provider CHECK (auth_provider IN ('email', 'google', 'yahoo', 'espn'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- OAuth tokens for platform integrations
CREATE TABLE user_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, provider)
);

-- ============================================
-- LEAGUES & SETTINGS
-- ============================================

CREATE TYPE league_status AS ENUM ('setup', 'drafting', 'complete', 'archived');
CREATE TYPE scoring_type AS ENUM ('rotisserie', 'h2h-categories', 'h2h-points');
CREATE TYPE projection_system AS ENUM ('steamer', 'batx', 'ja', 'custom');

CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    external_room_id VARCHAR(100), -- Couch Manager integration
    num_teams INTEGER NOT NULL CHECK (num_teams BETWEEN 2 AND 30),
    budget_per_team INTEGER NOT NULL CHECK (budget_per_team BETWEEN 100 AND 1000),
    scoring_type scoring_type NOT NULL DEFAULT 'rotisserie',
    projection_system projection_system NOT NULL DEFAULT 'steamer',
    status league_status NOT NULL DEFAULT 'setup',
    draft_started_at TIMESTAMP WITH TIME ZONE,
    draft_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_leagues_status ON leagues(status);
CREATE INDEX idx_leagues_created_by ON leagues(created_by);

-- Roster position configuration
CREATE TABLE league_roster_spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    position_code VARCHAR(10) NOT NULL,
    num_spots INTEGER NOT NULL DEFAULT 0 CHECK (num_spots >= 0),

    UNIQUE(league_id, position_code),
    CONSTRAINT valid_position CHECK (position_code IN (
        'C', '1B', '2B', '3B', 'SS', 'OF', 'CI', 'MI', 'UTIL',
        'SP', 'RP', 'P', 'Bench', 'IL', 'NA'
    ))
);

-- Scoring category configuration (for Roto/H2H Categories)
CREATE TABLE league_scoring_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    category_code VARCHAR(20) NOT NULL,
    category_type VARCHAR(10) NOT NULL CHECK (category_type IN ('hitting', 'pitching')),
    is_enabled BOOLEAN DEFAULT true,

    UNIQUE(league_id, category_code)
);

-- Point values (for H2H Points leagues)
CREATE TABLE league_point_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    stat_code VARCHAR(20) NOT NULL,
    stat_type VARCHAR(10) NOT NULL CHECK (stat_type IN ('hitting', 'pitching')),
    point_value DECIMAL(5,2) NOT NULL DEFAULT 0,

    UNIQUE(league_id, stat_code)
);

-- ============================================
-- USER-LEAGUE MEMBERSHIP
-- ============================================

CREATE TYPE league_role AS ENUM ('owner', 'manager', 'viewer');

CREATE TABLE user_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    role league_role NOT NULL DEFAULT 'manager',
    team_name VARCHAR(100),
    is_my_team BOOLEAN DEFAULT false, -- Designates user's primary team in draft
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, league_id)
);

CREATE INDEX idx_user_leagues_user ON user_leagues(user_id);
CREATE INDEX idx_user_leagues_league ON user_leagues(league_id);

-- ============================================
-- PLAYERS & PROJECTIONS
-- ============================================

CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(50), -- ID from projection source
    name VARCHAR(255) NOT NULL,
    team VARCHAR(10) NOT NULL,
    primary_position VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(external_id)
);

CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_players_team ON players(team);
CREATE INDEX idx_players_position ON players(primary_position);

-- Player can have multiple eligible positions
CREATE TABLE player_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    position_code VARCHAR(10) NOT NULL,

    UNIQUE(player_id, position_code)
);

-- Projected statistics (from projection systems)
CREATE TABLE player_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    projection_system projection_system NOT NULL,
    season_year INTEGER NOT NULL,

    -- Hitting stats
    games INTEGER,
    at_bats INTEGER,
    runs INTEGER,
    hits INTEGER,
    doubles INTEGER,
    triples INTEGER,
    home_runs INTEGER,
    rbi INTEGER,
    stolen_bases INTEGER,
    caught_stealing INTEGER,
    walks INTEGER,
    strikeouts INTEGER,
    batting_avg DECIMAL(4,3),
    on_base_pct DECIMAL(4,3),
    slugging_pct DECIMAL(4,3),
    ops DECIMAL(4,3),

    -- Pitching stats
    innings_pitched DECIMAL(5,1),
    wins INTEGER,
    losses INTEGER,
    saves INTEGER,
    holds INTEGER,
    earned_runs INTEGER,
    hits_allowed INTEGER,
    walks_allowed INTEGER,
    strikeouts_pitcher INTEGER,
    era DECIMAL(4,2),
    whip DECIMAL(4,2),
    quality_starts INTEGER,

    -- Calculated value
    projected_value DECIMAL(6,2),
    tier INTEGER CHECK (tier BETWEEN 1 AND 10),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(player_id, projection_system, season_year)
);

CREATE INDEX idx_projections_player ON player_projections(player_id);
CREATE INDEX idx_projections_system_year ON player_projections(projection_system, season_year);

-- ============================================
-- DRAFT STATE & PICKS
-- ============================================

CREATE TYPE draft_pick_status AS ENUM ('available', 'nominated', 'won', 'passed');

CREATE TABLE league_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id),

    -- Draft state
    status draft_pick_status NOT NULL DEFAULT 'available',
    nominated_at TIMESTAMP WITH TIME ZONE,
    drafted_at TIMESTAMP WITH TIME ZONE,

    -- Auction values
    base_value DECIMAL(6,2) NOT NULL, -- From projections
    adjusted_value DECIMAL(6,2) NOT NULL, -- Inflation-adjusted
    winning_bid DECIMAL(6,2),

    -- Ownership
    drafted_by_user_id UUID REFERENCES users(id),
    drafted_by_team_name VARCHAR(100), -- For non-user teams
    is_my_team BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(league_id, player_id)
);

CREATE INDEX idx_league_players_league ON league_players(league_id);
CREATE INDEX idx_league_players_status ON league_players(status);
CREATE INDEX idx_league_players_drafted_by ON league_players(drafted_by_user_id);

-- Draft pick history (for audit trail)
CREATE TABLE draft_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    league_player_id UUID NOT NULL REFERENCES league_players(id),
    pick_number INTEGER NOT NULL,

    -- Bid details
    winning_bid DECIMAL(6,2) NOT NULL,
    adjusted_value_at_pick DECIMAL(6,2) NOT NULL,
    inflation_rate_at_pick DECIMAL(5,4) NOT NULL,

    -- Winner
    winner_user_id UUID REFERENCES users(id),
    winner_team_name VARCHAR(100),
    is_my_team BOOLEAN DEFAULT false,

    picked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(league_id, pick_number)
);

CREATE INDEX idx_draft_picks_league ON draft_picks(league_id);

-- ============================================
-- DRAFT ANALYTICS & SNAPSHOTS
-- ============================================

-- Periodic snapshots of draft state for inflation tracking
CREATE TABLE draft_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    snapshot_number INTEGER NOT NULL,

    -- State at snapshot
    players_drafted INTEGER NOT NULL,
    total_money_spent DECIMAL(10,2) NOT NULL,
    total_money_remaining DECIMAL(10,2) NOT NULL,
    calculated_inflation_rate DECIMAL(5,4) NOT NULL,

    -- My team state
    my_team_spent DECIMAL(10,2),
    my_team_remaining DECIMAL(10,2),
    my_team_roster_count INTEGER,

    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(league_id, snapshot_number)
);

-- ============================================
-- AUDIT & ACTIVITY LOG
-- ============================================

CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    league_id UUID REFERENCES leagues(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_league ON activity_log(league_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leagues_updated_at BEFORE UPDATE ON leagues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_players_updated_at BEFORE UPDATE ON league_players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate inflation rate for a league
CREATE OR REPLACE FUNCTION calculate_inflation_rate(p_league_id UUID)
RETURNS DECIMAL(5,4) AS $$
DECLARE
    v_total_budget DECIMAL(10,2);
    v_total_roster_spots INTEGER;
    v_money_spent DECIMAL(10,2);
    v_players_drafted INTEGER;
    v_money_remaining DECIMAL(10,2);
    v_players_remaining INTEGER;
    v_avg_projected_value DECIMAL(10,2);
    v_expected_remaining_value DECIMAL(10,2);
    v_inflation_rate DECIMAL(5,4);
BEGIN
    -- Get league settings
    SELECT
        l.num_teams * l.budget_per_team,
        l.num_teams * COALESCE(SUM(lrs.num_spots), 0)
    INTO v_total_budget, v_total_roster_spots
    FROM leagues l
    LEFT JOIN league_roster_spots lrs ON l.id = lrs.league_id
    WHERE l.id = p_league_id
    GROUP BY l.id;

    -- Get draft state
    SELECT
        COALESCE(SUM(winning_bid), 0),
        COUNT(*) FILTER (WHERE status = 'won')
    INTO v_money_spent, v_players_drafted
    FROM league_players
    WHERE league_id = p_league_id;

    v_money_remaining := v_total_budget - v_money_spent;
    v_players_remaining := v_total_roster_spots - v_players_drafted;

    IF v_players_remaining = 0 THEN
        RETURN 0;
    END IF;

    -- Estimate remaining value
    v_avg_projected_value := (v_total_budget * 0.95) / v_total_roster_spots;
    v_expected_remaining_value := v_players_remaining * v_avg_projected_value;

    IF v_expected_remaining_value = 0 THEN
        RETURN 0;
    END IF;

    v_inflation_rate := (v_money_remaining / v_expected_remaining_value) - 1;

    RETURN ROUND(v_inflation_rate, 4);
END;
$$ LANGUAGE plpgsql;
```

---

## Redis Schema (Caching & Real-time)

```
# Session Management
session:{session_id} -> JSON { user_id, email, expires_at }
TTL: 24 hours

# Active Draft State (for real-time updates)
draft:{league_id}:state -> JSON {
    status: 'active' | 'paused',
    current_pick: number,
    inflation_rate: number,
    last_activity: timestamp
}
TTL: 7 days

# Draft Room Participants
draft:{league_id}:participants -> SET [ user_id, user_id, ... ]

# Rate Limiting
ratelimit:{user_id}:{endpoint} -> counter
TTL: 1 minute

# Player Search Cache
search:players:{query_hash} -> JSON [ player_ids ]
TTL: 1 hour

# League Summary Cache
league:{league_id}:summary -> JSON { ... }
TTL: 5 minutes
```

---

## API Layer Design

### Recommended: Node.js + Express + Prisma ORM

```
/api
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /refresh-token
│   └── GET  /me
│
├── /users
│   ├── GET    /:id
│   ├── PATCH  /:id
│   └── DELETE /:id
│
├── /leagues
│   ├── GET    /              # List user's leagues
│   ├── POST   /              # Create league
│   ├── GET    /:id           # Get league details
│   ├── PATCH  /:id           # Update settings
│   ├── DELETE /:id           # Delete league
│   ├── POST   /:id/start-draft
│   ├── POST   /:id/complete-draft
│   └── GET    /:id/analytics
│
├── /leagues/:leagueId/players
│   ├── GET    /              # List all players in league
│   ├── GET    /available     # Available players only
│   ├── GET    /drafted       # Drafted players only
│   ├── GET    /my-team       # My roster
│   └── POST   /:playerId/draft  # Draft a player
│
├── /players
│   ├── GET    /              # Search/list players
│   ├── GET    /:id           # Player details
│   └── GET    /:id/projections
│
└── /projections
    ├── POST   /import        # Import from projection system
    └── GET    /systems       # List available systems
```

---

## Migration Strategy

### Phase 1: Database Setup (Week 1)

1. **Provision PostgreSQL instance**
   - Development: Local Docker or Supabase free tier
   - Production: Supabase, Railway, or AWS RDS

2. **Run schema migrations**
   ```bash
   npx prisma migrate dev --name initial_schema
   ```

3. **Seed reference data**
   - Position codes
   - Scoring categories
   - Default point values

### Phase 2: API Development (Weeks 2-3)

1. **Set up Express API server**
2. **Implement authentication (JWT + refresh tokens)**
3. **Build CRUD endpoints for all entities**
4. **Add data validation with Zod**

### Phase 3: Frontend Integration (Week 4)

1. **Replace localStorage calls with API calls**
2. **Add loading states and error handling**
3. **Implement optimistic updates**
4. **Add offline support with service worker**

### Phase 4: Real-time Features (Week 5)

1. **Set up Redis for caching**
2. **Implement WebSocket for draft room**
3. **Add pub/sub for live updates**

---

## Folder Structure (Backend)

```
server/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── env.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   ├── errorHandler.ts
│   │   └── rateLimit.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── users.routes.ts
│   │   ├── leagues.routes.ts
│   │   ├── players.routes.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── league.service.ts
│   │   ├── player.service.ts
│   │   ├── draft.service.ts
│   │   └── inflation.service.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── calculations.ts
│   ├── types/
│   │   └── index.ts
│   └── app.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fantasy_baseball

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# External APIs
COUCH_MANAGER_API_KEY=
STEAMER_API_URL=

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## Security Considerations

1. **Authentication**
   - Use bcrypt with cost factor 12 for password hashing
   - Implement JWT with short expiry + refresh tokens
   - Store refresh tokens in httpOnly cookies

2. **Authorization**
   - Row-level security for league data
   - Role-based access (owner/manager/viewer)

3. **Input Validation**
   - Validate all inputs with Zod schemas
   - Sanitize user-generated content

4. **Rate Limiting**
   - 100 requests/minute for authenticated users
   - 20 requests/minute for authentication endpoints

5. **Audit Trail**
   - Log all write operations
   - Include IP address and user agent

---

## Estimated Costs (Production)

| Service | Free Tier | Paid Estimate |
|---------|-----------|---------------|
| Supabase (PostgreSQL) | 500MB, 2 projects | $25/mo for Pro |
| Upstash Redis | 10K commands/day | $10/mo |
| Vercel (API hosting) | 100GB bandwidth | $20/mo for Pro |
| **Total** | **$0** | **~$55/mo** |

---

## Next Steps

1. ~~Set up development database~~ - DONE (Railway PostgreSQL)
2. ~~Initialize Prisma and create migration files~~ - DONE
3. ~~Build authentication endpoints~~ - DONE
4. ~~Incrementally migrate frontend to use API~~ - DONE
5. Implement WebSocket for real-time draft updates
6. Add player caching layer (Redis or in-memory)
7. Implement Stripe payment integration

---

*Document Version: 2.0*
*Last Updated: December 2025*

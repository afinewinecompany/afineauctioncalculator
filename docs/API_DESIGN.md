# API Design Document

## Overview

This document defines the REST API design for the Fantasy Baseball Auction Tool backend. The API follows RESTful conventions.

**Implementation Status:**

- Projections API - **IMPLEMENTED**
- Auction Sync API - **IMPLEMENTED**
- Dynasty Rankings API - **IMPLEMENTED**
- Authentication - Planned (frontend only currently)
- Leagues CRUD - Planned
- WebSocket - Planned

---

## Base URL

```text
Development: http://localhost:3001/api
Production:  https://api.fantasybaseballauction.com/api
```

---

## Authentication

### JWT Token Flow

```
1. User logs in → receives access_token (1h) + refresh_token (7d)
2. Access token sent in Authorization header for all requests
3. When access token expires, use refresh token to get new pair
4. Logout invalidates refresh token
```

### Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## API Endpoints

### Authentication (`/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Create new account | No |
| POST | `/auth/login` | Email/password login | No |
| POST | `/auth/google` | Google OAuth login | No |
| POST | `/auth/refresh` | Refresh access token | No (refresh token) |
| POST | `/auth/logout` | Invalidate session | Yes |
| GET | `/auth/me` | Get current user | Yes |

#### POST /auth/register

```json
// Request
{
  "email": "user@example.com",
  "password": "securepassword123",
  "username": "fantasyfan"
}

// Response 201
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "fantasyfan",
    "createdAt": "2024-12-23T00:00:00Z"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### POST /auth/login

```json
// Request
{
  "email": "user@example.com",
  "password": "securepassword123"
}

// Response 200
{
  "user": { ... },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}

// Response 401
{
  "error": "Invalid credentials"
}
```

#### POST /auth/google

```json
// Request
{
  "idToken": "google_id_token_from_client"
}

// Response 200
{
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "username": "Google User",
    "profilePictureUrl": "https://...",
    "authProvider": "google"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

### Users (`/users`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/:id` | Get user profile | Yes |
| PATCH | `/users/:id` | Update profile | Yes (owner) |
| DELETE | `/users/:id` | Delete account | Yes (owner) |

#### PATCH /users/:id

```json
// Request
{
  "username": "newusername",
  "profilePictureUrl": "https://..."
}

// Response 200
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "newusername",
  "profilePictureUrl": "https://...",
  "updatedAt": "2024-12-23T00:00:00Z"
}
```

---

### Leagues (`/leagues`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/leagues` | List user's leagues | Yes |
| POST | `/leagues` | Create new league | Yes |
| GET | `/leagues/:id` | Get league details | Yes (member) |
| PATCH | `/leagues/:id` | Update league settings | Yes (owner) |
| DELETE | `/leagues/:id` | Delete league | Yes (owner) |
| POST | `/leagues/:id/start-draft` | Start draft | Yes (owner) |
| POST | `/leagues/:id/complete-draft` | Complete draft | Yes (owner) |
| GET | `/leagues/:id/analytics` | Get draft analytics | Yes (member) |

#### POST /leagues

```json
// Request
{
  "name": "My Fantasy League",
  "numTeams": 12,
  "budgetPerTeam": 260,
  "scoringType": "rotisserie",
  "projectionSystem": "steamer",
  "rosterSpots": {
    "C": 1,
    "1B": 1,
    "2B": 1,
    "3B": 1,
    "SS": 1,
    "OF": 3,
    "CI": 1,
    "MI": 1,
    "UTIL": 1,
    "SP": 5,
    "RP": 2,
    "Bench": 3
  },
  "hittingCategories": {
    "R": true,
    "HR": true,
    "RBI": true,
    "SB": true,
    "AVG": true
  },
  "pitchingCategories": {
    "W": true,
    "K": true,
    "ERA": true,
    "WHIP": true,
    "SV": true
  }
}

// Response 201
{
  "id": "uuid",
  "name": "My Fantasy League",
  "status": "setup",
  "numTeams": 12,
  "budgetPerTeam": 260,
  "createdAt": "2024-12-23T00:00:00Z",
  "createdBy": "user-uuid"
}
```

#### GET /leagues/:id

```json
// Response 200
{
  "id": "uuid",
  "name": "My Fantasy League",
  "status": "drafting",
  "numTeams": 12,
  "budgetPerTeam": 260,
  "scoringType": "rotisserie",
  "projectionSystem": "steamer",
  "rosterSpots": { ... },
  "hittingCategories": { ... },
  "pitchingCategories": { ... },
  "draftStartedAt": "2024-12-23T00:00:00Z",
  "members": [
    {
      "userId": "uuid",
      "username": "fantasyfan",
      "role": "owner",
      "teamName": "My Team"
    }
  ],
  "stats": {
    "playersDrafted": 45,
    "moneySpent": 1500,
    "inflationRate": 0.12
  }
}
```

---

### League Players (`/leagues/:leagueId/players`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/leagues/:leagueId/players` | List all players | Yes (member) |
| GET | `/leagues/:leagueId/players/available` | Available players | Yes (member) |
| GET | `/leagues/:leagueId/players/drafted` | Drafted players | Yes (member) |
| GET | `/leagues/:leagueId/players/my-team` | My roster | Yes (member) |
| POST | `/leagues/:leagueId/players/:playerId/draft` | Draft a player | Yes (member) |

#### GET /leagues/:leagueId/players

Query parameters:
- `status`: available | drafted | all
- `position`: C, 1B, 2B, 3B, SS, OF, SP, RP
- `tier`: 1-10
- `search`: player name search
- `sort`: name, projectedValue, adjustedValue, team
- `order`: asc, desc
- `limit`: number (default 50)
- `offset`: number (default 0)

```json
// Response 200
{
  "players": [
    {
      "id": "uuid",
      "name": "Aaron Judge",
      "team": "NYY",
      "positions": ["OF"],
      "projectedValue": 51,
      "adjustedValue": 57,
      "status": "available",
      "tier": 1,
      "projectedStats": {
        "HR": 58,
        "RBI": 144,
        "SB": 10,
        "AVG": 0.311
      }
    }
  ],
  "pagination": {
    "total": 250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### POST /leagues/:leagueId/players/:playerId/draft

```json
// Request
{
  "price": 45,
  "draftedBy": "me" | "other",
  "teamName": "Opponent Team" // only if draftedBy: "other"
}

// Response 200
{
  "id": "uuid",
  "name": "Aaron Judge",
  "status": "drafted",
  "draftedPrice": 45,
  "draftedBy": "My Team",
  "draftedAt": "2024-12-23T00:00:00Z",
  "pickNumber": 15,
  "inflationRateAtPick": 0.08
}

// Response 400
{
  "error": "Player already drafted"
}
```

---

### Players (`/players`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/players` | Search all players | Yes |
| GET | `/players/:id` | Get player details | Yes |
| GET | `/players/:id/projections` | Get projections | Yes |

#### GET /players

Query parameters:
- `search`: player name
- `team`: team abbreviation
- `position`: position code
- `projectionSystem`: steamer, batx, ja

```json
// Response 200
{
  "players": [
    {
      "id": "uuid",
      "name": "Aaron Judge",
      "team": "NYY",
      "positions": ["OF"],
      "projections": {
        "steamer": { "HR": 58, "RBI": 144, "value": 51 },
        "batx": { "HR": 55, "RBI": 138, "value": 48 }
      }
    }
  ]
}
```

---

### Projections (`/projections`) - IMPLEMENTED

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/projections/:system` | Get projections (steamer/ja) | No |
| GET | `/projections/:system/status` | Get cache status | No |
| POST | `/projections/:system/refresh` | Force refresh from source | No |
| POST | `/projections/calculate-values` | Calculate auction values for league | No |

**Note**: Currently supported projection systems are `steamer` (FanGraphs) and `ja` (JA Projections from Google Sheets). BatX is currently unavailable.

#### Category Validation

The value calculator validates all scoring categories against available projection data. Categories are classified by data source:

| Data Source | Accuracy | Description |
|-------------|----------|-------------|
| `direct` | High | Stat comes directly from projection data |
| `calculated` | High | Derived from projection data via formula |
| `estimated` | Medium | Estimated using statistical correlations |
| `unsupported` | None | No reliable data or estimation available |

**Supported Hitting Categories (100+):**

- Core: R, HR, RBI, SB, H, AVG, OBP, SLG, OPS, BB, 1B, 2B, 3B
- Calculated: XBH, TB, SBN, ISO, R+RBI, HR+SB, K%, BB/PA
- Estimated: HBP, SF, GIDP, BABIP
- Advanced Yahoo: wOBA, ISO, BABIP, and 60+ additional categories

**Supported Pitching Categories (80+):**

- Core: W, K, ERA, WHIP, SV, HLD, IP, L, GS, K/9, BB/9, FIP
- Calculated: K/BB, SVH, SV+HD, HR/9, W%, K-BB
- Estimated: QS, BS, CG, SHO, GF, HB, WP, BAA
- Advanced: xFIP, SIERA, LOB%, GB%, HR/FB, and more

#### GET /projections/:system

Returns player projections from the specified system. Uses 24-hour cache.

```json
// Response 200
{
  "metadata": {
    "system": "steamer",
    "fetchedAt": "2024-12-23T12:00:00Z",
    "expiresAt": "2024-12-24T12:00:00Z",
    "playerCount": 1200,
    "hitterCount": 800,
    "pitcherCount": 400
  },
  "projections": [
    {
      "externalId": "12345",
      "mlbamId": 545361,
      "name": "Aaron Judge",
      "team": "NYY",
      "positions": ["OF"],
      "playerType": "hitter",
      "hitting": {
        "games": 155,
        "atBats": 550,
        "runs": 110,
        "homeRuns": 45,
        "rbi": 100,
        "stolenBases": 10,
        "battingAvg": 0.290,
        "onBasePct": 0.390,
        "sluggingPct": 0.590,
        "ops": 0.980
      }
    }
  ],
  "fromCache": true
}
```

##### Player Photo URLs

The `mlbamId` field can be used to construct player photo URLs using MLB's official image service:

```text
https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{mlbamId}/headshot/67/current
```

Example for Aaron Judge (mlbamId: 592450):

```text
https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/592450/headshot/67/current
```

The URL includes a fallback to a generic player silhouette if the specific player's photo is unavailable.

#### POST /projections/calculate-values

Calculates auction dollar values based on league settings. Only players in the draftable pool get values; others get $0.

```json
// Request
{
  "projectionSystem": "steamer",
  "leagueSettings": {
    "numTeams": 12,
    "budgetPerTeam": 260,
    "scoringType": "rotisserie",
    "rosterSpots": {
      "C": 1, "1B": 1, "2B": 1, "3B": 1, "SS": 1,
      "OF": 3, "CI": 1, "MI": 1, "UTIL": 1,
      "SP": 5, "RP": 2, "P": 1, "Bench": 3
    },
    "hittingCategories": { "R": true, "HR": true, "RBI": true, "SB": true, "AVG": true },
    "pitchingCategories": { "W": true, "K": true, "ERA": true, "WHIP": true, "SV": true },
    "hitterPitcherSplit": { "hitter": 0.68, "pitcher": 0.32 }
  }
}

// Response 200
{
  "projectionSystem": "steamer",
  "calculatedAt": "2024-12-23T12:00:00Z",
  "leagueSummary": {
    "numTeams": 12,
    "budgetPerTeam": 260,
    "totalBudget": 3120,
    "scoringType": "rotisserie",
    "draftablePoolSize": 276,
    "hitterPoolSize": 156,
    "pitcherPoolSize": 120,
    "hitterBudget": 2122,
    "pitcherBudget": 998
  },
  "players": [
    {
      "externalId": "12345",
      "name": "Aaron Judge",
      "team": "NYY",
      "positions": ["OF"],
      "playerType": "hitter",
      "auctionValue": 52,
      "sgpValue": 8.5,
      "tier": 1,
      "isInDraftPool": true
    }
  ]
}
```

#### POST /projections/:system/refresh

Forces a cache refresh by fetching fresh data from FanGraphs.

```json
// Response 200
{
  "success": true,
  "message": "steamer projections refreshed",
  "playerCount": 1200,
  "hitterCount": 800,
  "pitcherCount": 400,
  "refreshedAt": "2024-12-23T12:00:00Z"
}
```

---

### Auction Sync (`/auction`) - IMPLEMENTED

Live integration with Couch Managers auction rooms. Uses **file-based caching** with 5-minute TTL to reduce API load and prevent rate limiting.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/auction/:roomId` | Get auction state (5min cache) | No |
| GET | `/auction/:roomId/current` | Get current player on block | No |
| GET | `/auction/:roomId/cache` | Get cache status for room | No |
| DELETE | `/auction/:roomId/cache` | Invalidate cache for room | No |
| GET | `/auction/cache/status` | List all cached rooms | No |
| POST | `/auction/cache/cleanup` | Cleanup expired caches | No |
| POST | `/auction/:roomId/sync` | Full sync with client projections | No |
| POST | `/auction/:roomId/sync-lite` | Lightweight sync using server cache | No |

#### Caching Strategy

All auction data is cached to files in `/cache/auctions/` with a **5-minute TTL**. This protects against:

- Rate limiting from Couch Managers
- Slow page loads due to repeated scraping
- Multiple users hitting the same room simultaneously

Query parameter `?refresh=true` forces a fresh scrape, bypassing cache.

#### GET /auction/:roomId

Scrapes current auction state from Couch Managers (or returns cached data).

```json
// Response 200
{
  "roomId": "12345",
  "scrapedAt": "2024-12-23T12:00:00Z",
  "status": "active",
  "players": [
    {
      "couchManagersId": 1001,
      "firstName": "Aaron",
      "lastName": "Judge",
      "fullName": "Aaron Judge",
      "normalizedName": "aaron judge",
      "positions": ["OF"],
      "mlbTeam": "NYY",
      "status": "drafted",
      "winningBid": 52,
      "winningTeam": "Team Alpha"
    }
  ],
  "teams": [
    {
      "name": "Team Alpha",
      "budget": 260,
      "spent": 145,
      "remaining": 115,
      "playersDrafted": 8,
      "isOnline": true
    }
  ],
  "currentAuction": {
    "playerId": 1002,
    "playerName": "Shohei Ohtani",
    "currentBid": 45,
    "currentBidder": "Team Beta",
    "timeRemaining": 12
  },
  "activeAuctions": [
    {
      "playerId": 1002,
      "playerName": "Shohei Ohtani",
      "currentBid": 45,
      "currentBidder": "Team Beta",
      "timeRemaining": 12
    }
  ],
  "totalPlayersDrafted": 72,
  "totalMoneySpent": 1560,
  "fromCache": true,
  "cacheInfo": {
    "ageSeconds": 45,
    "expiresInSeconds": 255,
    "ttlSeconds": 300
  }
}
```

#### POST /auction/:roomId/sync-lite (Recommended)

Lightweight sync that uses server-cached projections. Sends only ~200 bytes instead of ~800KB.

```json
// Request
{
  "projectionSystem": "steamer",
  "leagueConfig": {
    "numTeams": 12,
    "budgetPerTeam": 260,
    "totalRosterSpots": 23,
    "rosterSpots": { "C": 2, "1B": 1, "OF": 5, "SP": 4, "RP": 2 },
    "scoringType": "h2h-categories",
    "hittingCategories": { "R": true, "HR": true, "RBI": true, "SB": true, "AVG": true },
    "pitchingCategories": { "W": true, "K": true, "ERA": true, "WHIP": true, "SV": true }
  }
}

// Response 200
{
  "auctionData": { ... },  // Same as GET /auction/:roomId
  "matchedPlayers": [
    {
      "scrapedPlayer": { ... },
      "projectionPlayerId": "12345",
      "projectedValue": 45,
      "actualBid": 52,
      "inflationAmount": 7,
      "inflationPercent": 15.6,
      "matchConfidence": "exact"
    }
  ],
  "inflationStats": {
    "overallInflationRate": 12.5,
    "totalProjectedValue": 1400,
    "totalActualSpent": 1575,
    "draftedPlayersCount": 72,
    "tierInflation": [
      { "tier": 1, "draftedCount": 10, "inflationRate": -5.2 },
      { "tier": 5, "draftedCount": 15, "inflationRate": 45.3 }
    ],
    "positionalScarcity": [
      {
        "position": "SP",
        "availableCount": 45,
        "qualityCount": 22,
        "leagueNeed": 48,
        "scarcityRatio": 2.18,
        "scarcityLevel": "severe",
        "inflationAdjustment": 1.25
      }
    ],
    "teamConstraints": [
      {
        "teamName": "Team Alpha",
        "rawRemaining": 115,
        "rosterSpotsRemaining": 15,
        "effectiveBudget": 101,
        "canAffordThreshold": 50
      }
    ],
    "adjustedRemainingBudget": 1445,
    "remainingProjectedValue": 1200
  },
  "unmatchedPlayers": []
}
```

#### POST /auction/:roomId/sync

Full sync that accepts projections from the client. Use sync-lite instead for better performance.

```json
// Request
{
  "projections": [
    { "id": "12345", "name": "Aaron Judge", "projectedValue": 45 }
  ],
  "leagueConfig": { ... }
}

// Response: Same as sync-lite
```

---

### Dynasty Rankings (`/dynasty`) - IMPLEMENTED

Dynasty rankings integration for keeper/dynasty leagues.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/dynasty/rankings` | Get dynasty rankings from Harry Knows Ball | No |
| GET | `/dynasty/rankings/status` | Get cache status | No |
| POST | `/dynasty/rankings/refresh` | Force refresh from source | No |

#### GET /dynasty/rankings

Returns dynasty player rankings from Harry Knows Ball (12-hour cache).

```json
// Response 200
{
  "metadata": {
    "source": "harryknowsball",
    "fetchedAt": "2025-12-23T12:00:00Z",
    "expiresAt": "2025-12-24T00:00:00Z",
    "playerCount": 500
  },
  "rankings": [
    {
      "rank": 1,
      "name": "Gunnar Henderson",
      "team": "BAL",
      "positions": ["SS"],
      "tier": 1
    },
    {
      "rank": 2,
      "name": "Elly De La Cruz",
      "team": "CIN",
      "positions": ["SS"],
      "tier": 1
    }
  ],
  "fromCache": true
}
```

#### Custom Dynasty Rankings

For custom rankings uploaded by users (CSV), the frontend parses the CSV using `src/lib/csvParser.ts` and stores rankings in the league settings. The CSV parser supports flexible column names:

- **Name column**: name, player, fullname, first+last name columns
- **Rank column**: rank, ranking, dynasty_rank, overall
- **ID column**: any column containing 'id' (optional)

```typescript
// Parsed structure
interface CustomDynastyRanking {
  name: string;
  rank: number;
  playerId?: string;
}
```

---

### Draft Analytics (`/leagues/:leagueId/analytics`)

#### GET /leagues/:leagueId/analytics

```json
// Response 200
{
  "leagueId": "uuid",
  "status": "drafting",
  "totalBudget": 3120,
  "moneySpent": 1560,
  "moneyRemaining": 1560,
  "playersDrafted": 72,
  "playersRemaining": 168,
  "inflationRate": 0.12,
  "inflationHistory": [
    { "pickNumber": 10, "rate": 0.02 },
    { "pickNumber": 20, "rate": 0.05 },
    { "pickNumber": 40, "rate": 0.08 },
    { "pickNumber": 72, "rate": 0.12 }
  ],
  "myTeam": {
    "moneySpent": 145,
    "moneyRemaining": 115,
    "rosterSize": 8,
    "projectedStats": {
      "HR": 180,
      "RBI": 450,
      "SB": 65,
      "AVG": 0.278
    }
  },
  "topDeals": [
    { "playerId": "uuid", "name": "Player A", "savings": 12 }
  ],
  "topOverpays": [
    { "playerId": "uuid", "name": "Player B", "overpay": 8 }
  ]
}
```

---

## WebSocket API (Real-time Draft)

### Connection

```javascript
const socket = new WebSocket('wss://api.fantasybaseballauction.com/draft/:leagueId');
socket.send(JSON.stringify({ type: 'auth', token: accessToken }));
```

### Events

#### Server → Client

```json
// Player drafted
{
  "type": "player_drafted",
  "data": {
    "playerId": "uuid",
    "price": 45,
    "draftedBy": "Team Name",
    "pickNumber": 15,
    "inflationRate": 0.12
  }
}

// Draft state update
{
  "type": "draft_state",
  "data": {
    "moneyRemaining": 1560,
    "playersDrafted": 72,
    "inflationRate": 0.12
  }
}

// User joined/left
{
  "type": "user_joined",
  "data": {
    "userId": "uuid",
    "username": "fantasyfan"
  }
}
```

#### Client → Server

```json
// Draft player
{
  "type": "draft_player",
  "data": {
    "playerId": "uuid",
    "price": 45
  }
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... } // optional
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Server Error |

### Common Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | No valid token provided |
| `TOKEN_EXPIRED` | Access token expired |
| `INVALID_CREDENTIALS` | Wrong email/password |
| `USER_EXISTS` | Email already registered |
| `LEAGUE_NOT_FOUND` | League doesn't exist |
| `NOT_MEMBER` | User not a league member |
| `NOT_OWNER` | Action requires owner role |
| `PLAYER_DRAFTED` | Player already drafted |
| `INSUFFICIENT_BUDGET` | Not enough money |
| `DRAFT_NOT_STARTED` | Draft hasn't begun |
| `DRAFT_COMPLETED` | Draft already finished |
| `RATE_LIMITED` | Too many requests |

---

## Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 20/minute |
| Read operations | 100/minute |
| Write operations | 50/minute |
| WebSocket messages | 60/minute |

Response when rate limited:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "retryAfter": 30
}
```

---

## Pagination

All list endpoints support pagination:

```
GET /leagues?limit=20&offset=40
```

Response includes pagination info:

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 40,
    "hasMore": true
  }
}
```

---

## Versioning

API version is included in the URL:

```
/api/v1/leagues
```

Current version: `v1`

Breaking changes will increment the version number.

---

## Implementation Priority

### Phase 1 (MVP) - COMPLETE

1. ~~Projections API~~ - Implemented
2. ~~Auction sync endpoints~~ - Implemented
3. ~~Value calculation~~ - Implemented
4. ~~Inflation tracking~~ - Implemented

### Phase 2 (Current)

1. Authentication (register, login, me)
2. Leagues CRUD with persistent storage
3. League players list
4. Draft player endpoint

### Phase 3 (Enhanced)

1. Google OAuth
2. Analytics endpoint
3. Player search
4. Historical auction data

### Phase 4 (Real-time)

1. WebSocket draft room
2. Live updates (replace polling)
3. Multi-user sync

---

*Document Version: 3.1*
*Last Updated: December 2025*

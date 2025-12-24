# API Design Document

## Overview

This document defines the REST API design for the Fantasy Baseball Auction Tool backend. The API follows RESTful conventions and uses JWT for authentication.

---

## Base URL

```
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

### Projections (`/projections`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/projections/:system` | Get projections (steamer/batx/ja) | No |
| GET | `/projections/:system/status` | Get cache status | No |
| POST | `/projections/:system/refresh` | Force refresh from FanGraphs | No |
| POST | `/projections/calculate-values` | Calculate auction values for league | No |

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

### Phase 1 (MVP)
1. Authentication (register, login, me)
2. Leagues CRUD
3. League players list
4. Draft player endpoint

### Phase 2 (Enhanced)
1. Google OAuth
2. Analytics endpoint
3. Player search
4. Projections import

### Phase 3 (Real-time)
1. WebSocket draft room
2. Live updates
3. Multi-user sync

---

*Document Version: 1.0*
*Last Updated: December 2024*
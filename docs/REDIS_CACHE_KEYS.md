# Redis Cache Key Patterns

This document defines all Redis cache key patterns used in the Fantasy Baseball Auction Tool.

## Key Naming Convention

All keys follow the pattern: `{namespace}:{identifier}:{suffix}`

- **namespace**: Top-level category (e.g., `projections`, `auction`, `session`)
- **identifier**: Unique ID for the resource (e.g., system name, room ID, user ID)
- **suffix**: Additional context (e.g., `state`, `year`, `metadata`)

## Current Cache Keys

### Projections Cache

**Pattern**: `projections:{system}:{year}`

**Purpose**: Store normalized projection data from various projection systems

**TTL**: 24 hours (configurable via `PROJECTIONS_CACHE_TTL_HOURS`)

**Examples**:
- `projections:steamer:2025` - Steamer projections for 2025
- `projections:batx:2025` - THE BAT X projections for 2025
- `projections:ja:2025` - JustAskBen projections for 2025

**Data Structure**:
```typescript
{
  metadata: {
    system: string;
    fetchedAt: string;
    expiresAt: string;
    playerCount: number;
    hitterCount: number;
    pitcherCount: number;
  };
  projections: NormalizedProjection[];
}
```

**Usage**:
- `GET` - Retrieve cached projections
- `SET` - Store new projections with TTL
- `DEL` - Invalidate cache (force refresh)

---

### Auction State Cache

**Pattern**: `auction:{roomId}:state`

**Purpose**: Cache scraped auction data from Couch Managers to reduce scraping frequency

**TTL**: 5 minutes (configurable via `AUCTION_CACHE_TTL_MINUTES`)

**Examples**:
- `auction:1363:state` - Cached state for room 1363
- `auction:5678:state` - Cached state for room 5678

**Data Structure**:
```typescript
{
  metadata: {
    roomId: string;
    fetchedAt: string;
    expiresAt: string;
    ttlMs: number;
    playerCount: number;
    draftedCount: number;
    teamsCount: number;
  };
  data: ScrapedAuctionData;
}
```

**Usage**:
- `GET` - Retrieve cached auction data
- `SET` - Store auction snapshot with TTL
- `DEL` - Invalidate cache (force fresh scrape)

---

## Future Cache Keys (Phase 3+)

### Session/Authentication Cache

**Pattern**: `session:{userId}:{tokenId}`

**Purpose**: Store refresh tokens and session metadata

**TTL**: 7 days (matches JWT_REFRESH_EXPIRY)

**Examples**:
- `session:user123:abc456` - Session for user123 with token abc456

**Data Structure**:
```typescript
{
  userId: string;
  tokenId: string;
  refreshToken: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
}
```

---

### Scraping Distributed Lock

**Pattern**: `scrape-lock:scraping-{roomId}`

**Purpose**: Prevent concurrent scrapes of the same auction room across multiple server instances

**TTL**: 60 seconds (safety net - lock released immediately on scrape completion)

**Examples**:
- `scrape-lock:scraping-1363` - Lock for scraping room 1363
- `scrape-lock:scraping-5678` - Lock for scraping room 5678

**Data Structure**: Simple string value (timestamp when lock acquired)

**Usage**:
- `SET ... NX EX` - Atomic acquire: only sets if not exists, with 60s TTL
- `DEL` - Release lock after scrape completes
- `EXISTS` - Check if another instance holds the lock

**Implementation**:
- Uses Redis SET with NX (not exists) and EX (expiration) for atomic lock acquisition
- Falls back to in-memory Map when Redis unavailable
- Lock auto-expires after 60 seconds if process crashes or forgets to release
- Instances waiting for lock poll cache every 2 seconds (up to 30s total)

---

### Rate Limit Cache

**Pattern**: `ratelimit:{endpoint}:{ip}`

**Purpose**: Track API request counts for rate limiting across distributed instances

**TTL**: 1 minute (matches rate limit window)

**Examples**:
- `ratelimit:api:192.168.1.1` - General API rate limit for IP (100 req/min)
- `ratelimit:auth:192.168.1.1` - Auth endpoint rate limit for IP (10 req/min)
- `ratelimit:scraping:192.168.1.1` - Scraping endpoint rate limit for IP (20 req/min)
- `ratelimit:refresh:192.168.1.1` - Refresh endpoint rate limit for IP (5 req/min)

**Data Structure**: Uses Redis atomic INCR with TTL
- Key value: Integer representing hit count
- TTL: Automatically set on first hit, expires with rate limit window

**Implementation**:
- Uses custom RedisStore class implementing express-rate-limit Store interface
- Atomic INCR/PTTL operations via Redis MULTI/EXEC
- Graceful fallback to in-memory store when Redis unavailable
- Error handling allows requests through on Redis failures (fail-open)

---

### Dynasty Rankings Cache

**Pattern**: `dynasty:rankings:{year}`

**Purpose**: Cache dynasty rankings from Harry Knows Ball

**TTL**: 12 hours (configurable via `DYNASTY_CACHE_TTL_HOURS`)

**Examples**:
- `dynasty:rankings:2025` - Dynasty rankings for 2025

**Data Structure**:
```typescript
{
  metadata: {
    source: string;
    fetchedAt: string;
    playerCount: number;
  };
  rankings: DynastyRanking[];
}
```

---

### League Configuration Cache

**Pattern**: `league:{leagueId}:config`

**Purpose**: Cache league settings to reduce database queries

**TTL**: 1 hour

**Examples**:
- `league:league123:config` - Configuration for league123

**Data Structure**:
```typescript
{
  leagueId: string;
  name: string;
  settings: LeagueSettings;
  updatedAt: string;
}
```

---

### Calculated Values Cache

**Pattern**: `values:{leagueId}:{projectionSystem}`

**Purpose**: Cache calculated auction values for a league

**TTL**: 24 hours (or until projections change)

**Examples**:
- `values:league123:steamer` - Calculated values using Steamer for league123

**Data Structure**:
```typescript
{
  leagueId: string;
  projectionSystem: string;
  calculatedAt: string;
  players: PlayerWithValue[];
}
```

---

## Cache Invalidation Strategies

### Time-based Expiration (TTL)

All cache keys use Redis TTL for automatic expiration:
- Projections: 24 hours
- Auction state: 5 minutes
- Sessions: 7 days
- Rate limits: 1 minute

### Manual Invalidation

Certain events should trigger manual cache invalidation:

1. **Projections updated** → Delete `projections:{system}:{year}`
2. **League settings changed** → Delete `league:{leagueId}:*` and `values:{leagueId}:*`
3. **User logout** → Delete `session:{userId}:*`
4. **Auction completed** → Delete `auction:{roomId}:*`

### Bulk Operations

Use Redis patterns for bulk invalidation:

```typescript
// Delete all projections for 2025
redis.del(...await redis.keys('projections:*:2025'));

// Delete all sessions for a user
redis.del(...await redis.keys('session:user123:*'));

// Delete all auction caches
redis.del(...await redis.keys('auction:*:state'));
```

---

## Best Practices

### 1. Consistent Key Naming

Always use lowercase, colon-separated keys:
- ✅ `projections:steamer:2025`
- ❌ `Projections_Steamer_2025`

### 2. Include Year/Version in Keys

For data that changes annually:
- ✅ `projections:steamer:2025`
- ❌ `projections:steamer` (ambiguous)

### 3. Use Descriptive Namespaces

Group related keys under namespaces:
- `projections:*` - All projection data
- `auction:*` - All auction data
- `session:*` - All session data

### 4. Set Appropriate TTLs

Match TTL to data volatility:
- Static data (projections): 24 hours
- Live data (auction): 5 minutes
- Session data: Match token expiry

### 5. Handle Cache Misses Gracefully

Always have a fallback:
```typescript
const cached = await cacheGet(key);
if (!cached) {
  const fresh = await fetchFreshData();
  await cacheSet(key, fresh, ttl);
  return fresh;
}
return cached;
```

---

## Monitoring and Debugging

### Check Cache Size

```bash
redis-cli DBSIZE
```

### List All Keys

```bash
redis-cli KEYS "*"
```

### Check TTL

```bash
redis-cli TTL projections:steamer:2025
```

### Monitor Cache Activity

```bash
redis-cli MONITOR
```

### Clear All Caches (Development Only)

```bash
redis-cli FLUSHDB
```

---

## Migration from File-Based Cache

The system supports both Redis and file-based caching for backward compatibility:

1. **Development without Redis** → Falls back to file-based cache
2. **Production with Redis** → Uses Redis, creates file backups
3. **Migration** → Existing file caches remain functional

To migrate fully to Redis:

1. Set `REDIS_URL` in environment
2. Restart server (Redis initializes automatically)
3. Old file caches will be replaced over time
4. Optionally delete `cache/` directory after migration

---

*Last Updated: December 2025*

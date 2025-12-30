# Production API Test Report

**Target:** https://api.fantasy-auction.railway.app
**Date:** December 30, 2025
**Test Script:** `tests/production-api-test.ts`

## How to Run Tests

```bash
npx tsx tests/production-api-test.ts
```

Or manually test using curl:

```bash
# Health Check
curl -i https://api.fantasy-auction.railway.app/api/health

# Auth - Google Status
curl -i https://api.fantasy-auction.railway.app/api/auth/google/status

# Projections Status
curl -i https://api.fantasy-auction.railway.app/api/projections/steamer/status

# Auction Cache Status
curl -i https://api.fantasy-auction.railway.app/api/auction/cache/status
```

---

## Test Categories

### 1. Health Check (`GET /api/health`)

**Expected Behavior:**
- Returns 200 if database is connected
- Returns 503 if database is disconnected (degraded mode)
- Response includes:
  - `status`: "ok" or "degraded"
  - `services.database`: "connected" or "disconnected"
  - `services.redis`: "connected", "disconnected", or "not_configured"
  - `environment`: "production"
  - `uptime`: number in seconds

**Test Commands:**
```bash
curl -i https://api.fantasy-auction.railway.app/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-30T...",
  "environment": "production",
  "uptime": 12345.67,
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

### 2. Auth Endpoints

#### 2.1 `GET /api/auth/google/status`
**Expected:** 200 OK with `{ configured: boolean }`

```bash
curl -i https://api.fantasy-auction.railway.app/api/auth/google/status
```

#### 2.2 `POST /api/auth/register` (Validation Test)
**Expected:** 400 for invalid email/password

```bash
curl -X POST https://api.fantasy-auction.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","password":"123"}'
```

**Expected Response:**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {"field": "email", "message": "Invalid email address"},
    {"field": "password", "message": "Password must be at least 8 characters"}
  ]
}
```

#### 2.3 `POST /api/auth/login` (Invalid Credentials)
**Expected:** 401 Unauthorized

```bash
curl -X POST https://api.fantasy-auction.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com","password":"wrongpassword"}'
```

**Expected Response:**
```json
{
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS",
  "message": "The email or password you entered is incorrect"
}
```

#### 2.4 `GET /api/auth/me` (No Auth)
**Expected:** 401 Unauthorized

```bash
curl -i https://api.fantasy-auction.railway.app/api/auth/me
```

#### 2.5 `POST /api/auth/refresh` (Invalid Token)
**Expected:** 401 Unauthorized

```bash
curl -X POST https://api.fantasy-auction.railway.app/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"invalid-token"}'
```

---

### 3. Projections Endpoints

#### 3.1 `GET /api/projections/steamer/status`
**Expected:** 200 OK with cache status

```bash
curl -i https://api.fantasy-auction.railway.app/api/projections/steamer/status
```

**Expected Response:**
```json
{
  "system": "steamer",
  "cached": true,
  "cachedAt": "2025-12-30T...",
  "expiresAt": "2025-12-31T...",
  "playerCount": 1200
}
```

#### 3.2 `GET /api/projections/ja/status`
**Expected:** 200 OK

#### 3.3 `GET /api/projections/batx`
**Expected:** 503 Service Unavailable (BatX is disabled)

```bash
curl -i https://api.fantasy-auction.railway.app/api/projections/batx
```

**Expected Response:**
```json
{
  "error": "BatX projections are currently unavailable. Please use Steamer or JA Projections."
}
```

#### 3.4 `GET /api/projections/invalid`
**Expected:** 400 Bad Request

```bash
curl -i https://api.fantasy-auction.railway.app/api/projections/invalid
```

#### 3.5 `POST /api/projections/calculate-values` (Missing Data)
**Expected:** 400 Bad Request

```bash
curl -X POST https://api.fantasy-auction.railway.app/api/projections/calculate-values \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 3.6 `GET /api/projections/dynasty-rankings`
**Expected:** 200 or 503 (depends on external scraping)

---

### 4. Auction Endpoints

#### 4.1 `GET /api/auction/cache/status`
**Expected:** 200 OK with list of cached rooms

```bash
curl -i https://api.fantasy-auction.railway.app/api/auction/cache/status
```

**Expected Response:**
```json
{
  "cachedRoomCount": 0,
  "ttlSeconds": 300,
  "rooms": []
}
```

#### 4.2 `GET /api/auction/invalid`
**Expected:** 400 Bad Request (invalid room ID format)

```bash
curl -i https://api.fantasy-auction.railway.app/api/auction/invalid
```

#### 4.3 `GET /api/auction/99999`
**Expected:** 404 Not Found (room doesn't exist) or cached data

```bash
curl -i https://api.fantasy-auction.railway.app/api/auction/99999
```

#### 4.4 `POST /api/auction/12345/sync-lite` (Invalid Config)
**Expected:** 400 Bad Request

```bash
curl -X POST https://api.fantasy-auction.railway.app/api/auction/12345/sync-lite \
  -H "Content-Type: application/json" \
  -d '{"leagueConfig":{}}'
```

#### 4.5 `GET /api/auction/99999/cache`
**Expected:** 200 OK with cache status for room

```bash
curl -i https://api.fantasy-auction.railway.app/api/auction/99999/cache
```

---

### 5. Rate Limiting

**Configuration (from code review):**

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API (`/api/*`) | 100 req/min | 60s |
| Auth (`/api/auth/*`) | 10 req/min | 60s |
| Auction/Scraping (`/api/auction/*`) | 20 req/min | 60s |
| Projection Refresh | 5 req/min | 60s |

**Excluded Endpoints:**
- `/api/health` - excluded from rate limiting
- `/api/auth/me`, `/api/auth/refresh`, `/api/auth/google/status`, `/api/auth/logout` - excluded from strict auth rate limiting

**Rate Limit Headers:**
```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1704000000
```

**Test Rate Limiting:**
```bash
# Check headers on a rate-limited endpoint
curl -i https://api.fantasy-auction.railway.app/api/projections/steamer/status
```

**Expected 429 Response (when exceeded):**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "retryAfter": 60,
  "message": "Too many requests. Please try again in 60 seconds."
}
```

---

### 6. CORS Headers

**Expected Headers:**
```
Access-Control-Allow-Origin: https://fantasy-auction.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Expose-Headers: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, X-Request-Id
Access-Control-Max-Age: 86400
```

**Test CORS Preflight:**
```bash
curl -X OPTIONS https://api.fantasy-auction.railway.app/api/health \
  -H "Origin: https://fantasy-auction.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i
```

---

### 7. Error Handling

#### 404 Not Found
```bash
curl -i https://api.fantasy-auction.railway.app/api/nonexistent
```

**Expected Response:**
```json
{
  "error": "Not Found",
  "code": "NOT_FOUND",
  "message": "The requested resource was not found",
  "path": "/api/nonexistent"
}
```

---

## Security Features

Based on code review, the following security measures are in place:

1. **Helmet.js** - Security headers including CSP
2. **CORS** - Origin-restricted to frontend URL
3. **Rate Limiting** - Prevents brute force and DDoS
4. **Input Sanitization** - XSS protection via `xss` library
5. **Zod Validation** - Request body validation
6. **JWT Authentication** - Token-based auth with refresh tokens
7. **Password Hashing** - bcrypt with strong validation rules

---

## Known Limitations

1. **BatX Projections** - Currently unavailable (returns 503)
2. **Dynasty Rankings** - Depends on external scraping (may return 503)
3. **Auction Scraping** - Puppeteer-based, may timeout on slow connections

---

## Performance Expectations

| Endpoint | Expected Response Time |
|----------|----------------------|
| Health Check | < 100ms |
| Auth endpoints | < 500ms |
| Projections (cached) | < 200ms |
| Projections (fresh) | 2-5 seconds |
| Auction (cached) | < 200ms |
| Auction (scraping) | 5-15 seconds |

---

## Test Script Output Format

When running `npx tsx tests/production-api-test.ts`, expect output like:

```
============================================================
PRODUCTION API TEST SUITE
Target: https://api.fantasy-auction.railway.app
Started: 2025-12-30T00:00:00.000Z
============================================================

--- Testing Health Check ---
  Status: ok
  Database: connected
  Redis: connected
  Environment: production
  Response Time: 85ms

--- Testing Auth Endpoints ---
  Testing GET /api/auth/google/status
    Status: 200, Response Time: 120ms
    Data: {"configured":true,"message":"Google OAuth is available"}
  ...

============================================================
TEST SUMMARY
============================================================

Total Tests: 20
  PASSED: 18
  FAILED: 0
  WARNINGS: 2
```

---

## Troubleshooting

### Database Connection Issues
If health check shows `database: disconnected`:
- Check Railway PostgreSQL service status
- Verify `DATABASE_URL` environment variable
- Check Prisma migration status

### Redis Connection Issues
If health check shows `redis: disconnected`:
- Check Railway Redis service status
- Verify `REDIS_URL` environment variable
- Redis is optional - app will use file-based cache fallback

### Rate Limit Exceeded
If receiving 429 errors:
- Wait for the `retryAfter` duration
- Reduce request frequency
- Health check endpoint is excluded from rate limiting

### CORS Errors
If frontend cannot connect:
- Verify `FRONTEND_URL` environment variable matches actual frontend URL
- Check browser console for specific CORS error messages

# Production Roadmap: Dev to Production

## Executive Summary

This document outlines the requirements to transform the Fantasy Baseball Auction Tool from a development environment into a production-grade application. The current state is a **Full-Stack MVP** with solid business logic but significant infrastructure gaps.

**Current State**: Local development with localStorage persistence, no authentication backend, tightly coupled frontend/backend

**Target State**: Scalable, secure, multi-user production application with proper database, authentication, and deployment infrastructure

---

## Production Readiness Assessment

### What's Production-Ready Now

| Component | Status | Notes |
|-----------|--------|-------|
| Business Logic | ✅ Ready | SGP calculation, inflation tracking, player matching |
| Frontend UI/UX | ✅ Ready | React components, animations, error boundaries |
| Value Calculation | ✅ Ready | Proven algorithm from 6 historical auctions |
| API Structure | ⚠️ Partial | Routes exist, missing auth/security |
| Data Persistence | ❌ Not Ready | localStorage only, no database |
| Authentication | ❌ Not Ready | Frontend-only, no backend validation |
| Security | ❌ Not Ready | Open CORS, no rate limiting |
| Testing | ❌ Not Ready | No test suite |
| CI/CD | ❌ Not Ready | No pipeline |
| Monitoring | ❌ Not Ready | No logging/alerting |

---

## Phase 1: Foundation (Critical - Blocks Deployment)

### 1.1 Environment Configuration

**Current Issue**: Hardcoded values, no environment separation

**Required Changes**:

```
.env.example (create)
├── DATABASE_URL=postgresql://...
├── REDIS_URL=redis://...
├── JWT_SECRET=...
├── JWT_REFRESH_SECRET=...
├── NODE_ENV=development|staging|production
├── PORT=3001
├── FRONTEND_URL=http://localhost:3000
├── CORS_ORIGINS=http://localhost:3000
├── GOOGLE_CLIENT_ID=...
├── GOOGLE_CLIENT_SECRET=...
└── LOG_LEVEL=debug|info|warn|error
```

**Files to Modify**:
- `server/index.ts` - Use environment variables
- `vite.config.ts` - Environment-specific builds
- `src/lib/auctionApi.ts` - Configurable API base URL

**New Files**:
- `server/config/env.ts` - Centralized env validation with Zod
- `.env.example` - Template for required variables
- `.env.local` (gitignored) - Local development values

---

### 1.2 Database Implementation

**Current Issue**: localStorage loses data, no multi-device support

**Implementation** (see [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) for full schema):

1. **Set Up PostgreSQL (Railway)**
   - Development: Docker locally or Railway dev environment
   - Production: Railway PostgreSQL plugin (recommended for unified backend)
   - Alternative: Supabase or AWS RDS if preferred

2. **Add Prisma ORM**
   ```bash
   npm install prisma @prisma/client
   npx prisma init
   ```

3. **Core Tables** (priority order):
   - `users` - Authentication
   - `leagues` - League configuration
   - `user_leagues` - Membership/roles
   - `players` - Player master data
   - `player_projections` - Projection data
   - `league_players` - Draft state per league
   - `draft_picks` - Pick history

4. **Migration from localStorage**:
   - Create migration endpoint: `POST /api/migrate/localStorage`
   - Parse `fantasyBaseballUser` JSON
   - Insert into PostgreSQL tables
   - Return success/failure with data counts

**Estimated Effort**: 2-3 days for schema + migrations

---

### 1.3 Authentication System

**Current Issue**: Frontend-only login, no actual security

**Implementation**:

1. **Install Dependencies**
   ```bash
   npm install bcrypt jsonwebtoken passport passport-google-oauth20
   npm install @types/bcrypt @types/jsonwebtoken @types/passport -D
   ```

2. **New API Endpoints**:
   ```
   POST /api/auth/register    - Create account (email/password)
   POST /api/auth/login       - Login, return JWT + refresh token
   POST /api/auth/logout      - Invalidate refresh token
   POST /api/auth/refresh     - Get new access token
   GET  /api/auth/me          - Get current user
   POST /api/auth/google      - OAuth flow start
   GET  /api/auth/google/callback - OAuth callback
   ```

3. **Token Strategy**:
   - Access token: 15-minute expiry, sent in Authorization header
   - Refresh token: 7-day expiry, httpOnly cookie
   - Store refresh tokens in database for revocation

4. **Middleware**:
   ```typescript
   // server/middleware/auth.ts
   export const requireAuth = async (req, res, next) => {
     const token = req.headers.authorization?.split(' ')[1];
     if (!token) return res.status(401).json({ error: 'Unauthorized' });

     try {
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       req.user = await prisma.user.findUnique({ where: { id: decoded.userId } });
       next();
     } catch {
       return res.status(401).json({ error: 'Invalid token' });
     }
   };
   ```

5. **Frontend Changes**:
   - Store access token in memory (not localStorage)
   - Add token to API requests via interceptor
   - Implement silent refresh on 401 responses
   - Update `LoginPage.tsx` to call backend

**Estimated Effort**: 3-4 days

---

### 1.4 Security Hardening

**Current Issues**:
- CORS allows all origins (`*`)
- No rate limiting
- No input sanitization beyond Zod
- No security headers

**Implementation**:

1. **CORS Configuration**
   ```typescript
   // server/index.ts
   import cors from 'cors';

   app.use(cors({
     origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
   }));
   ```

2. **Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```
   ```typescript
   import rateLimit from 'express-rate-limit';

   const apiLimiter = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 100, // 100 requests per minute
     message: { error: 'Too many requests' }
   });

   const authLimiter = rateLimit({
     windowMs: 60 * 1000,
     max: 10, // 10 auth attempts per minute
   });

   app.use('/api/', apiLimiter);
   app.use('/api/auth/', authLimiter);
   ```

3. **Security Headers**
   ```bash
   npm install helmet
   ```
   ```typescript
   import helmet from 'helmet';
   app.use(helmet());
   ```

4. **Input Sanitization**
   - Already using Zod for structure validation
   - Add `xss` package for user-generated content
   - Sanitize league names, team names, custom rankings

**Estimated Effort**: 1-2 days

---

## Phase 2: Infrastructure (Required for Stability)

### 2.1 Separate Frontend and Backend

**Current Issue**: Tightly coupled in development via Vite plugin

**Production Architecture**:
```
                    ┌─────────────────┐
                    │   CDN (Vercel)  │
                    │   Static Files  │
                    └────────┬────────┘
                             │
     ┌───────────────────────┴───────────────────────┐
     │                                               │
     │  ┌─────────────────────────────────────────┐  │
     │  │              Railway                    │  │
     │  │  ┌──────────┐ ┌──────────┐ ┌─────────┐  │  │
     │  │  │ Backend  │ │PostgreSQL│ │  Redis  │  │  │
     │  │  │ (Express)│ │ (Plugin) │ │(Plugin) │  │  │
     │  │  └────┬─────┘ └────┬─────┘ └────┬────┘  │  │
     │  │       └────────────┴────────────┘       │  │
     │  │           (Private Network)             │  │
     │  └─────────────────────────────────────────┘  │
     │                      │                        │
     └──────────────────────┼────────────────────────┘
                            │
                     ┌──────▼──────┐
                     │  External   │
                     │    APIs     │
                     └─────────────┘
```

**Changes Required**:

1. **Frontend Build**
   - Add `VITE_API_URL` environment variable
   - Update `auctionApi.ts` to use configurable base URL
   - Build to static files: `npm run build`

2. **Backend Standalone**
   - Remove Vite plugin integration
   - Add production server configuration
   - Health check endpoint: `GET /api/health`
   - Graceful shutdown handling

3. **Deployment Scripts**
   ```json
   // package.json
   {
     "scripts": {
       "build:frontend": "vite build",
       "build:backend": "tsc -p tsconfig.server.json",
       "start:backend": "node dist/server/index.js",
       "deploy:frontend": "vercel --prod",
       "deploy:backend": "railway up"
     }
   }
   ```

**Estimated Effort**: 1-2 days

---

### 2.2 Caching Layer (Redis via Railway)

**Current Issue**: In-memory and file-based caching doesn't scale

**Implementation**:

1. **Add Redis Plugin in Railway**
   - Dashboard → New → Database → Redis
   - `REDIS_URL` auto-injected into backend service

2. **Install Redis Client**
   ```bash
   npm install ioredis
   ```

3. **Replace File-Based Caches**:
   - `projectionsCacheService.ts` → Redis with 24-hour TTL
   - `auctionCacheService.ts` → Redis with 5-minute TTL

4. **Session Management**:
   - Store refresh tokens in Redis
   - Enable token revocation (logout from all devices)

5. **Real-time Ready**:
   - Pub/Sub for future WebSocket implementation
   - Draft room state synchronization

**Redis Keys**:
```
projections:{system}:{year}     TTL: 24h
auction:{roomId}:state          TTL: 5m
session:{userId}:{tokenId}      TTL: 7d
ratelimit:{ip}:{endpoint}       TTL: 1m
```

**Estimated Effort**: 1-2 days

---

### 2.3 Logging and Monitoring

**Current Issue**: Console.log only, no production visibility

**Implementation**:

1. **Structured Logging**
   ```bash
   npm install pino pino-http
   ```
   ```typescript
   import pino from 'pino';
   import pinoHttp from 'pino-http';

   const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     transport: process.env.NODE_ENV === 'development'
       ? { target: 'pino-pretty' }
       : undefined,
   });

   app.use(pinoHttp({ logger }));
   ```

2. **Error Tracking**
   ```bash
   npm install @sentry/node
   ```
   - Capture uncaught exceptions
   - Track API errors with context
   - User identification for debugging

3. **Health Checks**
   ```typescript
   app.get('/api/health', async (req, res) => {
     const health = {
       status: 'ok',
       timestamp: new Date().toISOString(),
       database: await checkDatabase(),
       redis: await checkRedis(),
       uptime: process.uptime(),
     };
     res.json(health);
   });
   ```

4. **Metrics (Optional)**
   - Request latency (p50, p95, p99)
   - Error rates by endpoint
   - Active connections
   - Cache hit/miss ratios

**Estimated Effort**: 1 day

---

### 2.4 Error Handling Improvements

**Current Issue**: Generic 500 errors, no retry logic

**Implementation**:

1. **Standardized Error Responses**
   ```typescript
   interface ApiError {
     error: string;
     code: string;        // Machine-readable: 'AUTH_INVALID_TOKEN'
     message: string;     // Human-readable
     details?: unknown;   // Validation errors, etc.
     requestId: string;   // For support tickets
   }
   ```

2. **Error Codes**:
   ```
   AUTH_001  - Invalid credentials
   AUTH_002  - Token expired
   AUTH_003  - Insufficient permissions
   LEAGUE_001 - League not found
   LEAGUE_002 - Already a member
   SYNC_001  - Couch Managers unavailable
   SYNC_002  - Room ID invalid
   PROJ_001  - Projection system unavailable
   ```

3. **Circuit Breaker for External APIs**
   ```bash
   npm install opossum
   ```
   - FanGraphs API
   - Google Sheets (JA Projections)
   - Couch Managers scraper
   - Harry Knows Ball scraper

4. **Graceful Degradation**
   - Return cached data when external APIs fail
   - Disable features rather than crash
   - User-friendly error messages

**Estimated Effort**: 1-2 days

---

## Phase 3: Quality Assurance

### 3.1 Testing Framework

**Current Issue**: No tests exist

**Implementation**:

1. **Unit Tests** (Vitest)
   ```bash
   npm install vitest @testing-library/react @testing-library/jest-dom -D
   ```

   Priority files to test:
   - `server/services/valueCalculator.ts` - SGP calculation accuracy
   - `server/services/inflationCalculator.ts` - Inflation math
   - `server/services/playerMatcher.ts` - Name matching
   - `src/lib/calculations.ts` - Frontend calculations

2. **Integration Tests**
   ```bash
   npm install supertest -D
   ```
   - API endpoint tests
   - Database operations
   - Authentication flows

3. **E2E Tests** (Playwright)
   ```bash
   npm install @playwright/test -D
   ```
   - User registration/login
   - League creation
   - Draft flow
   - Couch Managers sync

**Coverage Targets**:
- Unit tests: 80% coverage on business logic
- Integration tests: All API endpoints
- E2E tests: Critical user paths

**Estimated Effort**: 3-5 days

---

### 3.2 CI/CD Pipeline

**Current Issue**: Manual deployment

**GitHub Actions Workflow**:

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Staging
        run: |
          # Deploy frontend to Vercel preview
          # Deploy backend to Railway staging

  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    environment: production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        run: |
          # Deploy with manual approval
```

**Pipeline Steps**:
1. Lint (ESLint)
2. Type check (TypeScript)
3. Unit tests (Vitest)
4. Build (Vite + tsc)
5. Integration tests
6. Deploy to staging
7. E2E tests on staging
8. Manual approval
9. Deploy to production

**Estimated Effort**: 1-2 days

---

## Phase 4: Deployment

### 4.1 Recommended Architecture

#### Unified Backend Platform: Railway

All backend services hosted on Railway for simplified management, private networking, and single billing:

| Component | Service | Notes | Cost |
|-----------|---------|-------|------|
| Frontend | Vercel | Static SPA hosting | $0-20/mo |
| Backend | Railway (Express) | Node.js service | ~$5/mo |
| Database | Railway (PostgreSQL) | Native plugin, auto `DATABASE_URL` | ~$5/mo |
| Cache | Railway (Redis) | Native plugin, auto `REDIS_URL` | ~$5/mo |
| Domain | Cloudflare | DNS + SSL | $10/yr |
| Monitoring | Sentry | Error tracking | $0-26/mo |
| **Total** | | | **~$20-60/mo** |

#### Benefits of Railway-only backend

- Single dashboard for all backend services
- Private networking between services (faster, more secure)
- Environment variables auto-injected across services
- Unified logging and monitoring
- Simple deployment: `railway up`

### 4.2 Deployment Configuration

**Vercel (Frontend)**:
```json
// vercel.json
{
  "buildCommand": "npm run build:frontend",
  "outputDirectory": "build",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Railway (Backend)**:
```toml
# railway.toml
[build]
builder = "nixpacks"
buildCommand = "npm run build:backend"

[deploy]
startCommand = "npm run start:backend"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
```

### 4.3 Domain and SSL

1. Register domain (e.g., `fantasyauctiontools.com`)
2. Configure DNS in Cloudflare
3. Point to Vercel (frontend) and Railway (backend)
4. SSL certificates auto-provisioned

**Estimated Effort**: 1 day

---

## Phase 5: Enhancements (Post-Launch)

### 5.1 Real-Time Features (WebSocket)

Replace polling with WebSocket for live draft updates:

```
Current: Polling every 10 seconds (~800KB/request with sync-lite optimization)
Target: WebSocket push updates (~500 bytes per event)
```

**Implementation**:
- Socket.io or native WebSocket
- Redis pub/sub for multi-instance support
- Events: `player_nominated`, `bid_placed`, `player_drafted`, `inflation_updated`

### 5.2 Payment Integration (Stripe)

For premium subscriptions:
- Stripe Checkout for payment
- Webhook handlers for subscription events
- Entitlement checks in API middleware

### 5.3 Mobile Optimization

- PWA support (service worker)
- Offline draft capability
- Push notifications for draft room

### 5.4 Analytics Dashboard

- Draft history analysis
- League comparison tools
- Projection accuracy tracking

---

## Implementation Order Summary

| Phase | Task | Priority | Effort | Dependencies |
|-------|------|----------|--------|--------------|
| 1.1 | Environment Configuration | Critical | 1 day | None |
| 1.2 | Database Implementation | Critical | 3 days | 1.1 |
| 1.3 | Authentication System | Critical | 4 days | 1.2 |
| 1.4 | Security Hardening | Critical | 2 days | 1.1 |
| 2.1 | Separate Frontend/Backend | High | 2 days | 1.1 |
| 2.2 | Redis Caching | High | 2 days | 2.1 |
| 2.3 | Logging & Monitoring | High | 1 day | 2.1 |
| 2.4 | Error Handling | High | 2 days | 2.1 |
| 3.1 | Testing Framework | Medium | 4 days | 1.3 |
| 3.2 | CI/CD Pipeline | Medium | 2 days | 3.1 |
| 4.1 | Production Deployment | High | 1 day | 2.x |
| 5.x | Enhancements | Low | Ongoing | 4.1 |

**Total Estimated Effort**: 3-4 weeks for production-ready deployment

---

## Pre-Launch Checklist

### Security

- [ ] HTTPS enforced on all endpoints
- [ ] CORS restricted to production domains
- [ ] Rate limiting configured
- [ ] Security headers (Helmet.js)
- [ ] JWT secrets rotated from development
- [ ] SQL injection protection (Prisma parameterized queries)
- [ ] XSS protection (input sanitization)
- [ ] Sensitive data encrypted at rest

### Infrastructure

- [ ] Database backups configured (daily)
- [ ] Redis persistence enabled
- [ ] Health check endpoints working
- [ ] Graceful shutdown implemented
- [ ] Environment variables documented
- [ ] Secrets in secure storage (not code)

### Quality

- [ ] Unit test coverage > 80% on business logic
- [ ] E2E tests for critical paths
- [ ] Error tracking configured (Sentry)
- [ ] Logging to persistent storage
- [ ] Performance baseline established

### Operations

- [ ] Deployment documentation complete
- [ ] Rollback procedure tested
- [ ] On-call rotation established (if applicable)
- [ ] Support email configured
- [ ] Legal pages (Privacy, Terms) published

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Puppeteer blocked by Couch Managers | High | Add proxy rotation, fallback to manual mode |
| FanGraphs API changes | Medium | Version API URLs, implement fallback projections |
| Database failure | Critical | Auto-backups, read replicas, connection pooling |
| Traffic spike (draft season) | High | Auto-scaling, Redis caching, CDN for static assets |
| Security breach | Critical | Regular audits, penetration testing, incident response plan |

---

## Appendix: Quick Start Commands

```bash
# Local development (current)
npm run dev

# Production build
npm run build:frontend
npm run build:backend

# Database migrations
npx prisma migrate dev
npx prisma migrate deploy

# Run tests
npm run test
npm run test:e2e

# Deploy
npm run deploy:frontend  # Vercel
npm run deploy:backend   # Railway
```

---

*Document Version: 1.0*
*Created: December 2025*
*Maintained by: context-manager agent*

# Logging & Error Handling Implementation Guide

## Overview

Phase 2.3 (Logging & Monitoring) and Phase 2.4 (Error Handling) from the production roadmap have been implemented with production-ready infrastructure for structured logging, error tracking, and centralized error handling.

---

## Phase 2.3: Logging & Monitoring

### Features Implemented

1. **Structured Logging with Pino**
   - JSON logging in production
   - Pretty-printed logs in development
   - Configurable log levels
   - Automatic PII redaction
   - Performance timing utilities

2. **Request Tracking**
   - Unique request IDs (UUID) for each request
   - Request ID in response headers (`X-Request-Id`)
   - Automatic request/response logging
   - Slow request detection

3. **Error Tracking Integration (Sentry)**
   - Optional Sentry integration
   - Environment-aware initialization
   - User context enrichment
   - Performance monitoring
   - Graceful degradation if not configured

### Installation

```bash
# Install Pino logging dependencies
npm install pino pino-http pino-pretty
npm install -D @types/pino-http

# Optional: Install Sentry for error tracking
npm install @sentry/node @sentry/profiling-node
```

### Configuration

Add to your `.env` file:

```env
# Logging level (trace|debug|info|warn|error)
LOG_LEVEL=info

# Optional: Sentry DSN for error tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### Usage Examples

#### Basic Logging

```typescript
import { logger } from './services/logger';

// Simple log
logger.info('User logged in');

// Structured log with context
logger.info({ userId: '123', email: 'user@example.com' }, 'User logged in');

// Different log levels
logger.debug('Debug information');
logger.warn('Warning message');
logger.error({ error }, 'Error occurred');
```

#### Performance Timing

```typescript
import { PerformanceTimer, LoggerHelper } from './services/logger';

const timer = new PerformanceTimer();
await someExpensiveOperation();
timer.log('Expensive operation completed');
// Logs: "Performance: Expensive operation completed took 1234ms"
```

#### Specialized Logging Helpers

```typescript
import { LoggerHelper } from './services/logger';

// Database queries
LoggerHelper.logQuery('SELECT', 'users', 45);

// External API calls
LoggerHelper.logExternalCall('Couch Managers', 'GET', '/room/1363', 200, 523);

// Cache operations
LoggerHelper.logCache('hit', 'projections:steamer:2025');

// Authentication events
LoggerHelper.logAuth('login_success', 'user-123');

// Business events
LoggerHelper.logBusiness('player_drafted', { playerId: '456', price: 25 });
```

#### Request Context

```typescript
// Request logger automatically adds:
// - requestId (UUID)
// - method, url, status
// - response time
// - user info (if authenticated)

// Access request ID in handlers
app.get('/api/users', (req, res) => {
  const requestId = (req as any).id; // UUID
  req.log.info({ userId: '123' }, 'Fetching user');
  res.json({ users, requestId });
});
```

---

## Phase 2.4: Error Handling

### Features Implemented

1. **Custom Error Classes**
   - Type-safe error hierarchy
   - HTTP status code mapping
   - Machine-readable error codes
   - Operational vs programmer error distinction

2. **Centralized Error Codes**
   - Organized by domain (AUTH, USER, LEAGUE, SYNC, PROJ, etc.)
   - Consistent error responses
   - Client-friendly error messages

3. **Error Handler Middleware**
   - Automatic error normalization
   - Prisma error handling
   - Zod validation error handling
   - Environment-aware responses (no stack traces in production)
   - Sentry integration

### Error Classes

```typescript
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  InternalError,
} from './errors';

// Usage in route handlers
throw new ValidationError('Invalid email format', { field: 'email' });
throw new NotFoundError('User');
throw new AuthenticationError('Invalid credentials', ErrorCodes.AUTH_INVALID_CREDENTIALS);
throw new ExternalServiceError('Couch Managers', 'Service unavailable');
```

### Error Codes

```typescript
import { ErrorCodes } from './errors/errorCodes';

// Authentication errors
ErrorCodes.AUTH_INVALID_CREDENTIALS  // 'AUTH_002'
ErrorCodes.AUTH_TOKEN_EXPIRED        // 'AUTH_003'

// User errors
ErrorCodes.USER_NOT_FOUND            // 'USER_001'
ErrorCodes.USER_EMAIL_TAKEN          // 'USER_003'

// League errors
ErrorCodes.LEAGUE_NOT_FOUND          // 'LEAGUE_001'
ErrorCodes.LEAGUE_FULL               // 'LEAGUE_006'

// Sync errors
ErrorCodes.SYNC_COUCH_MANAGERS_UNAVAILABLE  // 'SYNC_001'

// Projection errors
ErrorCodes.PROJ_CALCULATION_FAILED   // 'PROJ_002'

// Validation errors
ErrorCodes.VAL_INVALID_INPUT         // 'VAL_001'
```

### Error Response Format

All errors return a consistent JSON structure:

```json
{
  "error": "User not found",
  "code": "USER_001",
  "message": "User with ID 123 not found",
  "details": {},
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2025-12-29T12:00:00.000Z"
}
```

**Production mode** (no stack traces):
```json
{
  "error": "An unexpected error occurred",
  "code": "GEN_001",
  "message": "An unexpected error occurred",
  "requestId": "...",
  "timestamp": "..."
}
```

**Development mode** (includes stack trace and details):
```json
{
  "error": "Database query failed",
  "code": "DB_002",
  "message": "Failed to fetch user",
  "details": { "prismaCode": "P2025" },
  "stack": "Error: ...",
  "requestId": "...",
  "timestamp": "..."
}
```

### Usage in Route Handlers

#### Option 1: Throw errors directly

```typescript
import { asyncHandler } from './middleware/errorHandler';
import { NotFoundError, ValidationError } from './errors';
import { ErrorCodes } from './errors/errorCodes';

router.get('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new NotFoundError('User', ErrorCodes.USER_NOT_FOUND);
  }

  res.json(user);
}));
```

#### Option 2: Use asyncHandler wrapper

The `asyncHandler` wrapper automatically catches errors from async functions:

```typescript
router.post('/leagues', asyncHandler(async (req, res) => {
  const { name, settings } = req.body;

  // Validation errors are automatically caught
  const league = await prisma.league.create({
    data: { name, settings },
  });

  res.status(201).json(league);
}));
```

### Prisma Error Handling

Prisma errors are automatically converted to appropriate AppErrors:

```typescript
// Prisma P2002 (unique constraint) → ConflictError
try {
  await prisma.user.create({
    data: { email: 'existing@example.com' },
  });
} catch (error) {
  // Automatically converted to:
  // ConflictError: "A record with this email already exists"
  // Code: DB_UNIQUE_CONSTRAINT
}

// Prisma P2025 (record not found) → NotFoundError
// Prisma P2003 (foreign key) → ValidationError
// Prisma validation errors → ValidationError
```

### Zod Validation Error Handling

Zod validation errors are automatically formatted:

```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});

try {
  schema.parse({ email: 'invalid', age: 15 });
} catch (error) {
  // Automatically converted to:
  // ValidationError: "Validation failed"
  // Details: {
  //   errors: [
  //     { field: 'email', message: 'Invalid email' },
  //     { field: 'age', message: 'Number must be greater than or equal to 18' }
  //   ]
  // }
}
```

---

## Architecture

### Middleware Chain Order

```
1. Request Logger (pino-http)
2. Slow Request Detection
3. Sentry Request Handler (if configured)
4. Security Headers (helmet)
5. CORS
6. Compression
7. Body Parsing
8. Input Sanitization
9. Rate Limiting
10. Routes
11. Sentry Error Handler (if configured)
12. 404 Handler
13. Error Handler (must be last)
```

### Logging Flow

```
Request → Request Logger (add requestId) → Handler → Error?
                                             ↓        ↓
                                          Response   Error Handler
                                             ↓          ↓
                                          Logger    Logger + Sentry
                                             ↓          ↓
                                          Client    Error Response
```

---

## Best Practices

### 1. Use Appropriate Error Classes

```typescript
// ✅ Good: Specific error class
throw new NotFoundError('League', ErrorCodes.LEAGUE_NOT_FOUND);

// ❌ Bad: Generic error
throw new Error('League not found');
```

### 2. Always Use Error Codes

```typescript
// ✅ Good: Machine-readable code
throw new ValidationError('Invalid email', { email }, ErrorCodes.VAL_INVALID_FORMAT);

// ❌ Bad: No error code
throw new ValidationError('Invalid email');
```

### 3. Add Context to Logs

```typescript
// ✅ Good: Structured logging with context
logger.info({ userId, leagueId, action: 'join' }, 'User joined league');

// ❌ Bad: String concatenation
logger.info(`User ${userId} joined league ${leagueId}`);
```

### 4. Use asyncHandler for Async Routes

```typescript
// ✅ Good: Automatic error handling
router.get('/users', asyncHandler(async (req, res) => {
  const users = await getUsers();
  res.json(users);
}));

// ❌ Bad: Manual try/catch
router.get('/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});
```

### 5. Don't Log Sensitive Data

```typescript
// ✅ Good: Redacted sensitive fields
logger.info({ userId, email }, 'User logged in');

// ❌ Bad: Logging passwords
logger.info({ userId, password }, 'User logged in');
```

### 6. Use Performance Timers for Slow Operations

```typescript
// ✅ Good: Track performance
const timer = new PerformanceTimer();
const data = await fetchExternalData();
timer.log('External data fetch');

// ❌ Bad: No performance tracking
await fetchExternalData();
```

---

## Monitoring & Alerting

### Health Check Endpoint

```bash
GET /api/health

Response:
{
  "status": "ok",
  "timestamp": "2025-12-29T12:00:00.000Z",
  "environment": "production",
  "uptime": 86400,
  "database": "connected"
}
```

### Log Levels

- **trace**: Very detailed debugging (rarely used)
- **debug**: Detailed debugging (development only)
- **info**: General informational messages (default)
- **warn**: Warning messages (potential issues)
- **error**: Error messages (actionable errors)
- **fatal**: Critical errors (server crash)

### Sentry Integration

If `SENTRY_DSN` is configured:
- All non-operational errors (500+) are sent to Sentry
- User context is included (if authenticated)
- Performance metrics are tracked
- Errors can be filtered before sending

---

## Testing Error Handling

### Test Error Responses

```typescript
// Test validation error
const response = await request(app)
  .post('/api/users')
  .send({ email: 'invalid' })
  .expect(400);

expect(response.body.code).toBe(ErrorCodes.VAL_INVALID_INPUT);
expect(response.body.details.errors).toHaveLength(1);

// Test not found error
const response = await request(app)
  .get('/api/users/nonexistent')
  .expect(404);

expect(response.body.code).toBe(ErrorCodes.USER_NOT_FOUND);

// Test authentication error
const response = await request(app)
  .get('/api/protected')
  .expect(401);

expect(response.body.code).toBe(ErrorCodes.AUTH_REQUIRED);
```

---

## Migration Guide

### Updating Existing Routes

**Before:**
```typescript
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});
```

**After:**
```typescript
import { asyncHandler } from './middleware/errorHandler';
import { NotFoundError } from './errors';
import { ErrorCodes } from './errors/errorCodes';

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
  });

  if (!user) {
    throw new NotFoundError('User', ErrorCodes.USER_NOT_FOUND);
  }

  req.log.info({ userId: user.id }, 'User fetched');
  res.json(user);
}));
```

---

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` in `.env` (set to `debug` for verbose logging)
2. Ensure `NODE_ENV` is set correctly
3. In production, logs are JSON format (use log aggregation tools)

### Sentry Not Capturing Errors

1. Verify `SENTRY_DSN` is set in `.env`
2. Check Sentry is enabled in production (`NODE_ENV=production`)
3. Only non-operational errors (500+) are sent to Sentry
4. Check Sentry dashboard for filtered events

### Request ID Not in Responses

1. Ensure `requestLogger` middleware is registered early in chain
2. Check `X-Request-Id` header is exposed in CORS config

### Stack Traces in Production

1. Verify `NODE_ENV=production` in environment
2. Operational errors (400-499) don't include stack traces
3. Only development mode includes full error details

---

## Next Steps

1. **Install Dependencies** (if not already done):
   ```bash
   npm install pino pino-http pino-pretty
   npm install -D @types/pino-http
   # Optional:
   npm install @sentry/node @sentry/profiling-node
   ```

2. **Update Environment Variables**:
   - Add `LOG_LEVEL=info` to `.env`
   - Add `SENTRY_DSN=` to `.env` (optional)

3. **Update Existing Routes**:
   - Wrap async handlers with `asyncHandler`
   - Replace generic errors with specific error classes
   - Add structured logging

4. **Set Up Log Aggregation** (Production):
   - Configure Railway logs export
   - Set up log retention policies
   - Create alerts for error rates

5. **Configure Sentry** (Optional):
   - Create Sentry project
   - Add DSN to environment variables
   - Set up alert rules in Sentry

---

## Files Modified/Created

### Created Files
- `server/services/logger.ts` - Pino logger configuration and helpers
- `server/middleware/requestLogger.ts` - Request logging middleware
- `server/services/errorTracking.ts` - Sentry integration
- `server/errors/index.ts` - Custom error classes
- `server/errors/errorCodes.ts` - Centralized error codes
- `server/middleware/errorHandler.ts` - Error handler middleware
- `docs/LOGGING_AND_ERROR_HANDLING.md` - This documentation

### Modified Files
- `server/index.ts` - Integrated logging and error handling
- `.env.example` - Added SENTRY_DSN configuration

---

## References

- [Pino Documentation](https://getpino.io/)
- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [Production Roadmap](./PRODUCTION_ROADMAP.md)

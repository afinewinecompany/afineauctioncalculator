# Installation Guide: Logging & Error Handling

This guide covers installing and configuring the Phase 2.3 (Logging & Monitoring) and Phase 2.4 (Error Handling) implementations.

## Prerequisites

- Node.js 20+
- Existing Fantasy Baseball Auction Tool project
- Access to terminal/command line

---

## Step 1: Install Dependencies

Run the following commands in your project root:

```bash
# Install Pino logging dependencies
npm install pino pino-http pino-pretty

# Install Pino type definitions
npm install -D @types/pino-http

# Optional: Install Sentry for error tracking (recommended for production)
npm install @sentry/node @sentry/profiling-node
```

### Verify Installation

Check that the following packages are in your `package.json`:

```json
{
  "dependencies": {
    "pino": "^9.x.x",
    "pino-http": "^10.x.x",
    "pino-pretty": "^11.x.x",
    "@sentry/node": "^8.x.x",
    "@sentry/profiling-node": "^8.x.x"
  },
  "devDependencies": {
    "@types/pino-http": "^6.x.x"
  }
}
```

---

## Step 2: Configure Environment Variables

### Update .env file

Add the following to your `.env` file:

```env
# Logging Configuration
LOG_LEVEL=debug

# Error Tracking (Optional)
# Leave empty to disable Sentry
SENTRY_DSN=
```

For production, use:

```env
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### Log Levels

- `trace` - Very detailed debugging (rarely used)
- `debug` - Detailed debugging (development default)
- `info` - General information (production default)
- `warn` - Warnings
- `error` - Errors
- `fatal` - Critical errors

---

## Step 3: Verify File Structure

Ensure these files exist in your project:

```
server/
├── services/
│   ├── logger.ts              ✓ Created
│   └── errorTracking.ts       ✓ Created
├── middleware/
│   ├── requestLogger.ts       ✓ Created
│   └── errorHandler.ts        ✓ Created
├── errors/
│   ├── index.ts               ✓ Created
│   └── errorCodes.ts          ✓ Created
└── index.ts                   ✓ Updated
```

---

## Step 4: Test the Installation

### Start the Development Server

```bash
npm run server:dev
```

### Expected Console Output (Development Mode)

You should see pretty-printed logs:

```
📋 Server Configuration:
  Environment: development
  Port: 3001
  Frontend URL: http://localhost:3000
  CORS Origins: http://localhost:3000
  Log Level: debug
  Database: postgresql://***@localhost:5432/fantasy_auction
  Redis: Not configured (optional)
  Google OAuth: Not configured

[12:00:00.123] INFO: Server started successfully
    port: 3001
    environment: "development"
    frontendUrl: "http://localhost:3000"

🚀 Server running on http://localhost:3001
📊 Health check: http://localhost:3001/api/health
🌐 Frontend URL: http://localhost:3000
```

### Test Health Check Endpoint

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-12-29T12:00:00.000Z",
  "environment": "development",
  "uptime": 10.5,
  "services": {
    "database": "connected",
    "redis": "not_configured"
  }
}
```

### Test Request Logging

Make any API request:

```bash
curl http://localhost:3001/api/projections/systems
```

You should see logs like:

```
[12:00:01.234] INFO (123456 on hostname): GET /api/projections/systems - 200
    request: {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "method": "GET",
      "url": "/api/projections/systems"
    }
    response: {
      "statusCode": 200
    }
    duration: 45
```

### Test Error Handling

Test a 404 error:

```bash
curl http://localhost:3001/api/invalid-route
```

Expected response:

```json
{
  "error": "Route GET /api/invalid-route not found",
  "code": "GEN_002",
  "message": "Route GET /api/invalid-route not found",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2025-12-29T12:00:00.000Z"
}
```

---

## Step 5: Optional - Configure Sentry

### Create Sentry Account

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project (Node.js/Express)
3. Copy the DSN

### Add DSN to Environment

```env
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/456789
```

### Verify Sentry Integration

Restart the server and check logs:

```
[12:00:00.123] INFO: Sentry error tracking initialized
    environment: "development"
    tracesSampleRate: 1
```

### Test Error Tracking

Trigger an error and check Sentry dashboard:

```bash
# This will trigger a 500 error that gets sent to Sentry
curl -X POST http://localhost:3001/api/test-error
```

---

## Step 6: Production Configuration

### Environment Variables

```env
NODE_ENV=production
LOG_LEVEL=info
SENTRY_DSN=https://your-production-dsn@sentry.io/project-id
```

### Production Logging

In production:
- Logs are in JSON format (not pretty-printed)
- Stack traces are hidden from API responses
- Only errors (500+) are sent to Sentry
- Request IDs are included in all responses

### Log Aggregation

For production deployment (Railway):

1. **Railway Logs**:
   - View logs in Railway dashboard
   - Export to external service (e.g., Datadog, Logtail)

2. **Sentry Dashboard**:
   - View errors and performance metrics
   - Set up alerts for error rates
   - Track user-specific issues

---

## Troubleshooting

### Issue: Logs not appearing

**Solution**: Check `LOG_LEVEL` in `.env`:

```env
# Change from info to debug for verbose logging
LOG_LEVEL=debug
```

### Issue: "Cannot find module 'pino'"

**Solution**: Install dependencies:

```bash
npm install pino pino-http pino-pretty
```

### Issue: TypeScript errors with Pino

**Solution**: Install type definitions:

```bash
npm install -D @types/pino-http
```

### Issue: Sentry not capturing errors

**Solutions**:
1. Verify `SENTRY_DSN` is set
2. Only 500+ errors are sent to Sentry
3. Check Sentry project DSN is correct
4. Ensure `NODE_ENV=production` for production error tracking

### Issue: Request ID not in responses

**Solution**: Check middleware order in `server/index.ts`:
- `requestLogger` must be registered early (before routes)

---

## Next Steps

1. **Update Existing Routes** - See [LOGGING_AND_ERROR_HANDLING.md](./docs/LOGGING_AND_ERROR_HANDLING.md) for migration guide

2. **Add Structured Logging** - Replace `console.log` with `logger.info`:

   ```typescript
   // Before
   console.log('User logged in:', userId);

   // After
   logger.info({ userId }, 'User logged in');
   ```

3. **Use Custom Error Classes** - Replace generic errors:

   ```typescript
   // Before
   throw new Error('User not found');

   // After
   throw new NotFoundError('User', ErrorCodes.USER_NOT_FOUND);
   ```

4. **Wrap Async Handlers**:

   ```typescript
   import { asyncHandler } from './middleware/errorHandler';

   router.get('/users', asyncHandler(async (req, res) => {
     const users = await getUsers();
     res.json(users);
   }));
   ```

---

## Verification Checklist

- [ ] Dependencies installed (`pino`, `pino-http`, `pino-pretty`)
- [ ] Environment variables configured (`LOG_LEVEL`)
- [ ] Server starts without errors
- [ ] Health check endpoint returns 200
- [ ] Request logs include request IDs
- [ ] 404 errors return proper error format
- [ ] Sentry initialized (if configured)
- [ ] Production mode hides stack traces

---

## Support

- Documentation: [LOGGING_AND_ERROR_HANDLING.md](./docs/LOGGING_AND_ERROR_HANDLING.md)
- Pino Docs: [getpino.io](https://getpino.io/)
- Sentry Docs: [docs.sentry.io](https://docs.sentry.io/)
- Production Roadmap: [PRODUCTION_ROADMAP.md](./docs/PRODUCTION_ROADMAP.md)

# Production Environment Issues Report

**Date:** December 30, 2025
**Production URLs:**
- Frontend: https://fantasy-auction.vercel.app
- Backend: https://api.fantasy-auction.railway.app

---

## Executive Summary

A comprehensive end-to-end test and code review of the production environment identified **18 backend issues** and **18 frontend issues** across various severity levels. This document consolidates all findings and provides actionable recommendations.

---

## Issues by Priority

### CRITICAL (Must Fix Before Production)

| # | Area | Issue | Location | Impact |
|---|------|-------|----------|--------|
| 1 | Backend | Duplicate shutdown handlers cause race conditions | `server/db.ts:68-89` & `server/index.ts:300-317` | Deadlocks, incomplete shutdowns, potential data corruption |
| 2 | Backend | Unhandled rejection behavior inconsistency | `server/db.ts:85-89` vs `server/index.ts:311-317` | Unpredictable server crashes |
| 3 | Backend | Puppeteer pageCount not thread-safe | `server/services/couchManagersScraper.ts:42,153` | Browser health check failures, resource leaks |
| 4 | Frontend | Fake password change implementation | `src/components/AccountScreen.tsx:48-79` | Users believe password changed when it wasn't |
| 5 | Frontend | Subscription upgrade without payment | `src/components/AccountScreen.tsx:81-95` | Revenue loss, user confusion |
| 6 | Frontend | Email update without backend verification | `src/components/AccountScreen.tsx:26-46` | Account security risk |

---

### HIGH PRIORITY (Should Fix Soon)

| # | Area | Issue | Location | Impact |
|---|------|-------|----------|--------|
| 7 | Backend | In-memory cache can grow unbounded | `server/services/cacheService.ts:15` | Server OOM crash |
| 8 | Backend | Error details/stack traces exposed in API | `server/routes/projections.ts:297-301` | Information disclosure |
| 9 | Backend | Rate limiter uses in-memory store (not distributed) | `server/middleware/rateLimiter.ts` | Rate limits bypassed in multi-instance |
| 10 | Backend | Scraping locks not shared across instances | `server/routes/auction.ts:111` | Duplicate scrapes in scaled deployment |
| 11 | Backend | Dynasty rankings uses synchronous file I/O | `server/services/dynastyRankingsScraper.ts:44-94` | Event loop blocking |
| 12 | Frontend | Tokens stored in localStorage (XSS vulnerable) | `src/lib/authApi.ts:20-21,65-81` | Token theft via XSS |
| 13 | Frontend | Missing useEffect cleanup in DraftRoom | `src/components/DraftRoom.tsx:373-391` | Memory leaks, setState on unmounted |
| 14 | Frontend | Missing nested error boundaries | `src/App.tsx:496-611` | Entire app crashes on component error |
| 15 | Frontend | Race condition in auth state sync | `src/App.tsx:147-170` | Login/logout transition bugs |
| 16 | Frontend | Weak email validation (only checks @) | `src/components/AccountScreen.tsx:35-36` | Invalid emails accepted |

---

### MEDIUM PRIORITY (Plan for Next Release)

| # | Area | Issue | Location | Impact |
|---|------|-------|----------|--------|
| 17 | Backend | CORS allows all origins in development | `server/config/env.ts:158` | Ensure never runs in prod |
| 18 | Backend | JWT secret minimum 32 chars (recommend 64) | `server/config/env.ts:21-22` | Weaker than optimal security |
| 19 | Backend | No request body size limit per endpoint | `server/index.ts:109-110` | Auth endpoints accept 5MB bodies |
| 20 | Backend | Cache cleanup interval not cleared on shutdown | `server/routes/auction.ts:114-116` | Delayed process termination |
| 21 | Backend | TLS cert validation disabled for Redis | `server/services/redisClient.ts:58-62` | MITM vulnerability |
| 22 | Frontend | VITE_API_URL fallback to empty string | `src/lib/authApi.ts:8-14` | Confusing API errors |
| 23 | Frontend | Potential perf issue with large player lists | `src/components/PlayerQueue.tsx` | Slow rendering |
| 24 | Frontend | Demo mode notice visible | `src/components/AccountScreen.tsx:442-447` | Unprofessional appearance |
| 25 | Frontend | Missing loading states in LeaguesList | `src/components/LeaguesList.tsx:47-79` | Poor UX |
| 26 | Frontend | No React StrictMode | `src/main.tsx:1-6` | Missed development warnings |
| 27 | Frontend | Missing security headers | `vercel.json` | No CSP, HSTS, Referrer-Policy |
| 28 | Frontend | Missing meta tags in index.html | `index.html` | Poor SEO, no favicon |

---

### LOW PRIORITY (Address When Convenient)

| # | Area | Issue | Location | Impact |
|---|------|-------|----------|--------|
| 29 | Backend | console.log used instead of logger | Multiple files | Hard to aggregate logs |
| 30 | Backend | Password timing attack potential | `server/routes/auth.ts:207-234` | Email enumeration |
| 31 | Backend | Room ID no max length validation | `server/routes/auction.ts` | Potential abuse |
| 32 | Backend | XSS sanitization only on specific fields | `server/middleware/sanitize.ts:78-89` | New fields could be missed |
| 33 | Frontend | `any` type usage | `src/App.tsx:28,335,435` | Reduced type safety |
| 34 | Frontend | Inconsistent error message formatting | Multiple files | Poor UX consistency |
| 35 | Frontend | console.log in production code | Multiple files | Debug noise in prod |
| 36 | Frontend | Missing accessibility attributes | `src/components/PlayerQueue.tsx` | Accessibility issues |

---

## Missing Features Identified

| Feature | Priority | Notes |
|---------|----------|-------|
| Password reset flow | High | No endpoint for password recovery |
| Account lockout after failed attempts | Medium | No brute force protection |
| 2FA/TOTP support | Low | Consider for premium accounts |
| Multi-device session management | Low | No "logout all devices" |

---

## Recommended Fixes

### Critical Fix #1: Remove Duplicate Shutdown Handlers

**File:** `server/db.ts`

Remove lines 68-89 (the shutdown handlers) since `server/index.ts` already handles shutdown orchestration including database disconnection.

```typescript
// DELETE these lines from db.ts:
process.on('SIGINT', async () => {
  await gracefulShutdown();
  process.exit(0);
});
// ... and similar handlers
```

---

### Critical Fix #2: Fix Puppeteer Page Counter

**File:** `server/services/couchManagersScraper.ts`

```typescript
// Add decrement in finally block around line 200:
finally {
  pageCount--; // ADD THIS LINE
  await page.close();
}
```

---

### Critical Fix #3: Remove/Disable Fake Account Features

**File:** `src/components/AccountScreen.tsx`

Option A: Remove the entire AccountScreen from production
Option B: Disable non-functional features:

```typescript
// Line 71-78: Replace with actual API call or disable
const handlePasswordUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  setPasswordError('Password change is not available yet');
  return;
};

// Line 81-95: Remove upgrade button or redirect to actual payment
const handleUpgradeClick = () => {
  window.location.href = '/pricing'; // Or disable entirely
};
```

---

### High Fix #1: Add Memory Cache Size Limit

**File:** `server/services/cacheService.ts`

```typescript
const MAX_CACHE_SIZE = 1000; // Maximum entries
const memoryCache = new Map<string, { value: string; expiresAt: number | null }>();

// Add before setting new entries:
if (memoryCache.size >= MAX_CACHE_SIZE) {
  // Remove oldest entry (first key)
  const firstKey = memoryCache.keys().next().value;
  if (firstKey) memoryCache.delete(firstKey);
}
```

---

### High Fix #2: Remove Stack Traces from Production Responses

**File:** `server/routes/projections.ts` (lines 297-301)

```typescript
res.status(500).json({
  error: 'Failed to calculate auction values',
  message: process.env.NODE_ENV === 'development'
    ? (error instanceof Error ? error.message : undefined)
    : 'An unexpected error occurred',
  // Remove stack trace entirely
});
```

---

### High Fix #3: Add useEffect Cleanup Pattern

**File:** `src/components/DraftRoom.tsx`

```typescript
useEffect(() => {
  let isMounted = true;
  const abortController = new AbortController();

  const safePerformSync = async () => {
    if (!isMounted) return;
    try {
      await performSync(abortController.signal);
    } catch (e) {
      if (!isMounted) return;
      // handle error
    }
  };

  if (!settings.couchManagerRoomId) {
    setIsInitialLoading(false);
    return;
  }

  const initialSyncTimeout = setTimeout(safePerformSync, INITIAL_SYNC_DELAY_MS);
  syncIntervalRef.current = window.setInterval(safePerformSync, SYNC_INTERVAL_MS);

  return () => {
    isMounted = false;
    abortController.abort();
    clearTimeout(initialSyncTimeout);
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
  };
}, [settings.couchManagerRoomId, performSync]);
```

---

### Add Missing Security Headers

**File:** `vercel.json`

```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-XSS-Protection", "value": "1; mode=block" },
    { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
  ]
}
```

---

## Testing Commands

```bash
# Run backend API tests
npx tsx tests/production-api-test.ts

# Run auth flow E2E tests
npx tsx tests/e2e/auth-flow-test.ts

# Test health endpoint manually
curl -i https://api.fantasy-auction.railway.app/api/health

# Test frontend security headers
curl -I https://fantasy-auction.vercel.app
```

---

## Conclusion

The application has a solid foundation with good practices in many areas (structured logging, environment validation, error boundaries). However, the **6 critical issues** should be addressed immediately before production deployment, followed by the **10 high priority issues** in the near term.

**Estimated Fix Time:**
- Critical issues: 2-4 hours
- High priority issues: 4-8 hours
- Medium priority issues: 8-16 hours

---

*Report generated by automated E2E testing and code review agents*

# Error Handling Patterns - Quick Reference

Common error handling patterns and examples for the Fantasy Baseball Auction Tool.

---

## Import Statements

```typescript
// Always import these at the top of your route files
import { asyncHandler } from '../middleware/errorHandler';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
} from '../errors';
import { ErrorCodes } from '../errors/errorCodes';
import { logger } from '../services/logger';
```

---

## Pattern 1: Basic Resource Not Found

**Scenario**: User requests a resource that doesn't exist

```typescript
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
  });

  if (!user) {
    throw new NotFoundError('User', ErrorCodes.USER_NOT_FOUND);
  }

  res.json(user);
}));

// Response (404):
// {
//   "error": "User not found",
//   "code": "USER_001",
//   "message": "User not found",
//   "requestId": "...",
//   "timestamp": "..."
// }
```

---

## Pattern 2: Input Validation with Zod

**Scenario**: Validate request body before processing

```typescript
import { z } from 'zod';

const createLeagueSchema = z.object({
  name: z.string().min(3).max(50),
  maxTeams: z.number().int().min(8).max(20),
  budget: z.number().int().positive(),
});

router.post('/leagues', asyncHandler(async (req, res) => {
  // Zod errors are automatically converted to ValidationError
  const data = createLeagueSchema.parse(req.body);

  const league = await prisma.league.create({ data });

  res.status(201).json(league);
}));

// Invalid input response (400):
// {
//   "error": "Validation failed",
//   "code": "VAL_001",
//   "message": "Validation failed",
//   "details": {
//     "errors": [
//       { "field": "name", "message": "String must contain at least 3 character(s)" }
//     ]
//   },
//   "requestId": "...",
//   "timestamp": "..."
// }
```

---

## Pattern 3: Manual Validation

**Scenario**: Custom validation logic not covered by Zod

```typescript
router.post('/leagues/:id/join', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id; // Assumes auth middleware

  const league = await prisma.league.findUnique({
    where: { id },
    include: { members: true },
  });

  if (!league) {
    throw new NotFoundError('League', ErrorCodes.LEAGUE_NOT_FOUND);
  }

  // Check if user is already a member
  if (league.members.some(m => m.userId === userId)) {
    throw new ConflictError(
      'You are already a member of this league',
      ErrorCodes.LEAGUE_ALREADY_MEMBER
    );
  }

  // Check if league is full
  if (league.members.length >= league.maxTeams) {
    throw new ValidationError(
      'League is full',
      { maxTeams: league.maxTeams, currentMembers: league.members.length },
      ErrorCodes.LEAGUE_FULL
    );
  }

  // Add user to league
  await prisma.userLeague.create({
    data: { userId, leagueId: id, role: 'MEMBER' },
  });

  res.status(201).json({ message: 'Joined league successfully' });
}));
```

---

## Pattern 4: Authentication Required

**Scenario**: Endpoint requires authentication

```typescript
import { requireAuth } from '../middleware/auth';

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  // User is guaranteed to exist due to requireAuth middleware
  const user = req.user;

  res.json(user);
}));

// If no token provided (401):
// {
//   "error": "Authentication required",
//   "code": "AUTH_001",
//   "message": "Authentication required",
//   "requestId": "...",
//   "timestamp": "..."
// }
```

---

## Pattern 5: Authorization Check

**Scenario**: User authenticated but lacks permission

```typescript
router.delete('/leagues/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const league = await prisma.league.findUnique({
    where: { id },
    include: { members: { where: { userId } } },
  });

  if (!league) {
    throw new NotFoundError('League', ErrorCodes.LEAGUE_NOT_FOUND);
  }

  // Check if user is the league owner
  const userMembership = league.members[0];
  if (!userMembership || userMembership.role !== 'OWNER') {
    throw new AuthorizationError(
      'Only the league owner can delete the league',
      ErrorCodes.LEAGUE_UNAUTHORIZED
    );
  }

  await prisma.league.delete({ where: { id } });

  res.status(204).send();
}));

// Response (403):
// {
//   "error": "Only the league owner can delete the league",
//   "code": "LEAGUE_005",
//   "message": "Only the league owner can delete the league",
//   "requestId": "...",
//   "timestamp": "..."
// }
```

---

## Pattern 6: External Service Failure

**Scenario**: External API call fails

```typescript
import { LoggerHelper } from '../services/logger';

router.get('/auction/sync/:roomId', asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  try {
    const timer = new PerformanceTimer();
    const data = await scrapeCouchManagers(roomId);
    timer.log('Couch Managers scrape');

    LoggerHelper.logExternalCall(
      'Couch Managers',
      'GET',
      `/room/${roomId}`,
      200,
      timer.end()
    );

    res.json(data);
  } catch (error) {
    logger.error({ error, roomId }, 'Couch Managers scraping failed');

    throw new ExternalServiceError(
      'Couch Managers',
      'Unable to sync auction data. Please try again in a few moments.',
      ErrorCodes.SYNC_COUCH_MANAGERS_UNAVAILABLE
    );
  }
}));

// Response (503):
// {
//   "error": "External service (Couch Managers) is currently unavailable",
//   "code": "SYNC_001",
//   "message": "Unable to sync auction data. Please try again in a few moments.",
//   "details": { "service": "Couch Managers" },
//   "requestId": "...",
//   "timestamp": "..."
// }
```

---

## Pattern 7: Unique Constraint Violation (Prisma)

**Scenario**: Attempting to create a record that violates unique constraint

```typescript
router.post('/users', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  // Prisma P2002 error is automatically converted to ConflictError
  const user = await prisma.user.create({
    data: { email, password, name },
  });

  res.status(201).json(user);
}));

// If email already exists (409):
// {
//   "error": "A record with this email already exists",
//   "code": "DB_004",
//   "message": "A record with this email already exists",
//   "requestId": "...",
//   "timestamp": "..."
// }
```

---

## Pattern 8: Database Transaction with Error Handling

**Scenario**: Multiple database operations that must succeed or fail together

```typescript
router.post('/draft/:leagueId/pick', asyncHandler(async (req, res) => {
  const { leagueId } = req.params;
  const { playerId, teamId, price } = req.body;

  // Use Prisma transaction
  const result = await prisma.$transaction(async (tx) => {
    // Check team budget
    const team = await tx.team.findUnique({
      where: { id: teamId },
      include: { picks: true },
    });

    if (!team) {
      throw new NotFoundError('Team', ErrorCodes.USER_NOT_FOUND);
    }

    const budgetSpent = team.picks.reduce((sum, p) => sum + p.price, 0);
    const budgetRemaining = team.budget - budgetSpent;

    if (price > budgetRemaining) {
      throw new ValidationError(
        'Insufficient budget',
        { budgetRemaining, attemptedPrice: price },
        ErrorCodes.DRAFT_INSUFFICIENT_BUDGET
      );
    }

    // Check if player already drafted
    const existingPick = await tx.draftPick.findFirst({
      where: { leagueId, playerId },
    });

    if (existingPick) {
      throw new ConflictError(
        'Player already drafted',
        ErrorCodes.PLAYER_ALREADY_DRAFTED
      );
    }

    // Create draft pick
    const pick = await tx.draftPick.create({
      data: { leagueId, teamId, playerId, price },
    });

    return pick;
  });

  res.status(201).json(result);
}));
```

---

## Pattern 9: Conditional Error Messages

**Scenario**: Different error messages based on conditions

```typescript
router.post('/leagues/:id/draft/start', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const league = await prisma.league.findUnique({
    where: { id },
    include: { members: true, draftPicks: true },
  });

  if (!league) {
    throw new NotFoundError('League', ErrorCodes.LEAGUE_NOT_FOUND);
  }

  if (league.draftStatus === 'COMPLETED') {
    throw new ConflictError(
      'Draft has already been completed',
      ErrorCodes.LEAGUE_DRAFT_ENDED
    );
  }

  if (league.draftStatus === 'IN_PROGRESS') {
    throw new ConflictError(
      'Draft is already in progress',
      ErrorCodes.LEAGUE_DRAFT_STARTED
    );
  }

  if (league.members.length < 2) {
    throw new ValidationError(
      'Cannot start draft with fewer than 2 teams',
      { currentTeams: league.members.length, minTeams: 2 },
      ErrorCodes.LEAGUE_INVALID_SETTINGS
    );
  }

  // Start draft
  await prisma.league.update({
    where: { id },
    data: { draftStatus: 'IN_PROGRESS', draftStartedAt: new Date() },
  });

  res.json({ message: 'Draft started successfully' });
}));
```

---

## Pattern 10: Logging with Errors

**Scenario**: Log context before throwing error

```typescript
router.post('/projections/calculate', asyncHandler(async (req, res) => {
  const { leagueId, system } = req.body;

  logger.info({ leagueId, system }, 'Starting projection calculation');

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { scoringSettings: true },
  });

  if (!league) {
    logger.warn({ leagueId }, 'League not found for projection calculation');
    throw new NotFoundError('League', ErrorCodes.LEAGUE_NOT_FOUND);
  }

  try {
    const timer = new PerformanceTimer();
    const projections = await calculateProjections(league, system);
    timer.log('Projection calculation');

    logger.info({
      leagueId,
      system,
      playerCount: projections.length,
    }, 'Projection calculation completed');

    res.json(projections);
  } catch (error) {
    logger.error({
      error,
      leagueId,
      system,
    }, 'Projection calculation failed');

    throw new ExternalServiceError(
      system,
      'Unable to calculate projections. Please try again.',
      ErrorCodes.PROJ_CALCULATION_FAILED
    );
  }
}));
```

---

## Pattern 11: Graceful Degradation

**Scenario**: Provide fallback when optional service fails

```typescript
router.get('/players/:id/rankings', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const player = await prisma.player.findUnique({
    where: { id },
  });

  if (!player) {
    throw new NotFoundError('Player', ErrorCodes.PLAYER_NOT_FOUND);
  }

  let dynastyRanking = null;

  // Try to fetch dynasty ranking, but don't fail if unavailable
  try {
    dynastyRanking = await fetchDynastyRanking(player.name);
    logger.debug({ playerId: id }, 'Dynasty ranking fetched');
  } catch (error) {
    logger.warn({
      error,
      playerId: id,
    }, 'Failed to fetch dynasty ranking, continuing without it');
    // Don't throw - just return null
  }

  res.json({
    player,
    dynastyRanking,
  });
}));
```

---

## Pattern 12: Rate Limiting Error

**Scenario**: User exceeds rate limit

```typescript
// Rate limiter middleware automatically throws RateLimitError
// No additional code needed in route handler

// Response (429):
// {
//   "error": "Too many requests, please try again later",
//   "code": "RATE_001",
//   "message": "Too many requests, please try again later",
//   "requestId": "...",
//   "timestamp": "..."
// }
```

---

## Best Practices Summary

### 1. Always Use asyncHandler

```typescript
// ✅ Good
router.get('/users', asyncHandler(async (req, res) => { ... }));

// ❌ Bad
router.get('/users', async (req, res) => {
  try { ... } catch (error) { res.status(500).json({ error }) }
});
```

### 2. Use Specific Error Classes

```typescript
// ✅ Good
throw new NotFoundError('User', ErrorCodes.USER_NOT_FOUND);

// ❌ Bad
throw new Error('User not found');
```

### 3. Include Context in Errors

```typescript
// ✅ Good
throw new ValidationError(
  'Insufficient budget',
  { budgetRemaining, attemptedPrice },
  ErrorCodes.DRAFT_INSUFFICIENT_BUDGET
);

// ❌ Bad
throw new ValidationError('Insufficient budget');
```

### 4. Log Before Throwing

```typescript
// ✅ Good
logger.error({ error, context }, 'Operation failed');
throw new ExternalServiceError(...);

// ❌ Bad
throw new ExternalServiceError(...); // No logging
```

### 5. Use Appropriate HTTP Status Codes

- **400** - Validation errors (client's fault)
- **401** - Authentication required
- **403** - Insufficient permissions
- **404** - Resource not found
- **409** - Conflict (duplicate, already exists)
- **429** - Rate limit exceeded
- **500** - Internal server error (unexpected)
- **503** - External service unavailable

---

## Common Error Codes Reference

```typescript
// Authentication
ErrorCodes.AUTH_INVALID_CREDENTIALS
ErrorCodes.AUTH_TOKEN_EXPIRED
ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS

// Users
ErrorCodes.USER_NOT_FOUND
ErrorCodes.USER_EMAIL_TAKEN

// Leagues
ErrorCodes.LEAGUE_NOT_FOUND
ErrorCodes.LEAGUE_FULL
ErrorCodes.LEAGUE_ALREADY_MEMBER

// Draft
ErrorCodes.DRAFT_INSUFFICIENT_BUDGET
ErrorCodes.PLAYER_ALREADY_DRAFTED

// Sync
ErrorCodes.SYNC_COUCH_MANAGERS_UNAVAILABLE

// Validation
ErrorCodes.VAL_INVALID_INPUT
```

---

## Testing Error Responses

```bash
# Test 404
curl http://localhost:3001/api/users/nonexistent

# Test validation
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid"}'

# Test auth
curl http://localhost:3001/api/me
```

---

## Additional Resources

- [Error Classes Documentation](./LOGGING_AND_ERROR_HANDLING.md#error-classes)
- [Error Codes Reference](./LOGGING_AND_ERROR_HANDLING.md#error-codes)
- [Complete Usage Guide](./LOGGING_AND_ERROR_HANDLING.md)

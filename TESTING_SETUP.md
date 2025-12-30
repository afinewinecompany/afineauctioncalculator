# Testing Framework Setup Guide

This guide covers the testing framework implementation for Phase 3.1 of the Production Roadmap.

## Overview

The testing framework uses **Vitest** as the test runner with comprehensive coverage for:
- **Unit Tests**: Business logic (SGP calculations, inflation, player matching)
- **Integration Tests**: API endpoints (future phase)
- **E2E Tests**: User flows with Playwright (future phase)

## Installation

### Required Dependencies

Run the following command to install all testing dependencies:

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8 supertest @types/supertest
```

### Dependency Breakdown

- **vitest**: Fast test runner built on Vite
- **@vitest/ui**: Web-based UI for test visualization
- **@testing-library/react**: React component testing utilities
- **@testing-library/jest-dom**: Custom matchers for DOM assertions
- **@testing-library/user-event**: User interaction simulation
- **jsdom**: DOM implementation for Node.js (frontend tests)
- **@vitest/coverage-v8**: Code coverage using V8 provider
- **supertest**: HTTP assertion library for API testing
- **@types/supertest**: TypeScript types for supertest

## Configuration

### Vitest Configuration (`vitest.config.ts`)

The configuration is set up for both frontend (React/jsdom) and backend (Node) tests:

```typescript
{
  test: {
    globals: true,                    // Enable global test APIs
    environment: 'jsdom',             // DOM environment for React
    setupFiles: ['./src/test/setup.ts'],

    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
}
```

### Test Setup Files

**Frontend Setup** (`src/test/setup.ts`):
- Configures React Testing Library
- Mocks browser APIs (matchMedia, IntersectionObserver, localStorage)
- Custom matchers for frontend assertions

**Backend Setup** (`server/test/setup.ts`):
- Configures Node.js test environment
- Custom matchers for backend assertions (valid auction values, inflation rates)

## Test Structure

### Directory Structure

```
server/services/
├── __tests__/
│   ├── valueCalculator.test.ts      # SGP-based value calculation tests
│   ├── inflationCalculator.test.ts  # Tier-weighted inflation tests
│   └── playerMatcher.test.ts        # Name matching algorithm tests
├── valueCalculator.ts
├── inflationCalculator.ts
└── playerMatcher.ts

src/test/
└── setup.ts                         # Frontend test setup

server/test/
└── setup.ts                         # Backend test setup
```

## Running Tests

### Available Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with interactive UI
npm run test:ui

# Run specific test file
npx vitest run server/services/__tests__/valueCalculator.test.ts

# Run tests matching a pattern
npx vitest run -t "SGP Calculations"
```

### Watch Mode

Watch mode is the recommended way to develop with tests:

```bash
npm run test:watch
```

This will:
- Automatically rerun tests when files change
- Show only failed tests after first run
- Provide interactive filtering options

## Test Coverage

### Coverage Reports

Coverage reports are generated in multiple formats:

```bash
npm run test:coverage
```

Output locations:
- **Terminal**: Text summary
- **HTML**: `coverage/index.html` (open in browser)
- **LCOV**: `coverage/lcov.info` (for CI/CD integration)
- **JSON**: `coverage/coverage-final.json`

### Coverage Thresholds

The project enforces 80% coverage across all metrics:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

Tests will fail if coverage falls below these thresholds.

### Coverage Exclusions

The following are excluded from coverage requirements:
- `node_modules/`
- `dist/` and `build/`
- Type definition files (`**/*.d.ts`)
- Config files (`**/*.config.*`)
- Mock data (`mockData.ts`)
- Test files themselves
- shadcn/ui components (third-party)

## Writing Tests

### Test File Naming

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { functionToTest } from '../moduleToTest';

describe('Module Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Custom Matchers

**Backend Custom Matchers**:
```typescript
expect(value).toBeValidAuctionValue();     // 1-500, finite
expect(rate).toBeValidInflationRate();     // finite, >= -100%
```

**Frontend Custom Matchers** (from jest-dom):
```typescript
expect(element).toBeInTheDocument();
expect(element).toHaveTextContent('text');
expect(element).toBeVisible();
```

## Test Suites Overview

### 1. Value Calculator Tests

**File**: `server/services/__tests__/valueCalculator.test.ts`

**Coverage**:
- SGP-based value calculation for Roto/H2H Categories
- Points-based value calculation for H2H Points
- Tier assignment (1-10)
- Budget distribution (hitter/pitcher split)
- Market inflation adjustments (tier-based, position scarcity)
- Category validation and support
- Edge cases (empty pool, single player, zero stats)

**Key Test Groups**:
- Basic Value Calculation
- Budget Distribution
- SGP Calculations
- Points-Based Scoring
- Market Adjustments
- Edge Cases

### 2. Inflation Calculator Tests

**File**: `server/services/__tests__/inflationCalculator.test.ts`

**Coverage**:
- Tier-weighted inflation with dampened low-value players
- Positional scarcity analysis with historical premiums
- Team budget constraints (effective budget calculation)
- Competition factor based on affordability
- Forward-looking inflation adjustments
- Historical inflation context and recommendations
- Edge cases (no drafted players, extreme values, deflation)

**Key Test Groups**:
- Basic Inflation Calculation
- Tier-Based Inflation
- Positional Scarcity
- Team Budget Constraints
- Competition Factor
- Remaining Budget Inflation
- Historical Inflation Context
- Edge Cases

### 3. Player Matcher Tests

**File**: `server/services/__tests__/playerMatcher.test.ts`

**Coverage**:
- Name normalization (diacritics, periods, suffixes)
- Team normalization (abbreviations)
- Exact matching (mlbamId, name+team)
- Fuzzy matching (accents, suffixes, initials)
- Disambiguation (team, position, value)
- Confidence levels (exact, partial, unmatched)
- Batch matching and deduplication
- Edge cases (empty lists, special characters, duplicates)

**Key Test Groups**:
- Name Normalization
- Team Normalization
- Exact Matching
- Fuzzy Matching
- Team Disambiguation
- Position Disambiguation
- Value Sanity Checks
- Confidence Levels
- Batch Matching
- Edge Cases

## Best Practices

### 1. Test Organization

- Group related tests with `describe` blocks
- Use descriptive test names: "should [expected behavior] when [condition]"
- Keep tests focused on a single behavior
- Use `beforeEach` for common setup

### 2. Test Data

- Create realistic test data that mirrors production scenarios
- Use factory functions for generating test objects
- Keep test data close to the test that uses it
- Consider edge cases: empty, null, extreme values

### 3. Assertions

- Test both happy path and error cases
- Verify all important properties of results
- Use custom matchers for domain-specific validations
- Check side effects (e.g., array lengths, object properties)

### 4. Performance

- Keep unit tests fast (< 100ms each)
- Mock expensive operations (network, file I/O)
- Use `beforeEach` sparingly (adds overhead)
- Parallelize independent tests

### 5. Maintainability

- Avoid testing implementation details
- Test behavior, not internal structure
- Keep tests independent of each other
- Refactor tests alongside production code

## Debugging Tests

### VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Console Output

Uncomment console mocking in setup files to see logs:

```typescript
// src/test/setup.ts or server/test/setup.ts
global.console = {
  ...console,
  log: console.log,  // Restore console.log
  // Keep other methods mocked
};
```

### Isolate Tests

Run a single test:
```bash
npx vitest run -t "specific test name"
```

Or use `.only`:
```typescript
it.only('should run only this test', () => {
  // This test will run in isolation
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
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
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Next Steps

### Phase 3.2: Integration Tests

Add API endpoint tests using supertest:

```typescript
import request from 'supertest';
import app from '../server/app';

describe('POST /api/projections/calculate-values', () => {
  it('should return calculated values', async () => {
    const response = await request(app)
      .post('/api/projections/calculate-values')
      .send({ /* league settings */ })
      .expect(200);

    expect(response.body.players).toBeDefined();
  });
});
```

### Phase 3.3: E2E Tests

Add Playwright tests for critical user flows:

```typescript
import { test, expect } from '@playwright/test';

test('user can create league and draft players', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Create League');
  // ... test steps
});
```

## Troubleshooting

### Common Issues

**1. "Cannot find module '@testing-library/jest-dom'"**
- Ensure all dependencies are installed: `npm install`
- Check that setup file imports are correct

**2. Tests pass locally but fail in CI**
- Check for timezone/locale differences
- Verify environment variables are set
- Look for file system case sensitivity issues

**3. Coverage thresholds not met**
- Run `npm run test:coverage` to see detailed report
- Focus on critical business logic first
- Consider excluding non-critical files

**4. Slow test execution**
- Check for unintentional `setTimeout` calls
- Mock expensive operations (network, file I/O)
- Reduce test data size where possible

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
- [Playwright Documentation](https://playwright.dev/)

---

**Phase 3.1 Implementation**: Complete
**Coverage Status**: 80%+ on critical business logic
**Test Count**: 150+ unit tests
**Last Updated**: December 2025

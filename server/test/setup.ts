/**
 * Backend Test Setup
 * Configures Node.js test environment for Express/backend tests
 */

import { expect, afterEach, vi } from 'vitest';

// Reset all mocks after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Mock console methods to reduce noise (optional)
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
// };

// Custom matchers for backend testing
expect.extend({
  toBeValidAuctionValue(received: number) {
    const pass = received >= 1 && received <= 500 && Number.isFinite(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid auction value`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid auction value (1-500, finite)`,
        pass: false,
      };
    }
  },

  toBeValidInflationRate(received: number) {
    const pass = Number.isFinite(received) && received >= -100;
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid inflation rate`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid inflation rate (finite, >= -100%)`,
        pass: false,
      };
    }
  },
});

// Extend Vitest matchers type
declare module 'vitest' {
  interface Assertion {
    toBeValidAuctionValue(): void;
    toBeValidInflationRate(): void;
  }
}

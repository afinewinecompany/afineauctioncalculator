import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Environment configuration for integration tests
    environment: 'node',

    // Integration test patterns
    include: [
      'server/**/*.integration.test.ts',
      'server/**/*.integration.spec.ts',
      'tests/integration/**/*.test.ts',
    ],

    // Exclude unit tests
    exclude: [
      'node_modules',
      'dist',
      'build',
      '**/*.test.ts',
      '**/*.spec.ts',
    ],

    // Timeout configuration (longer for integration tests)
    testTimeout: 30000,
    hookTimeout: 30000,

    // Run integration tests sequentially to avoid database conflicts
    threads: false,
    isolate: true,

    // Reporter configuration
    reporters: ['verbose'],

    // Setup files for integration tests
    setupFiles: ['./server/test/integration-setup.ts'],

    // Path aliases (matching tsconfig)
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

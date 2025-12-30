/**
 * Integration Test Setup
 * Configures test database and global test environment for backend integration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Setup runs once before all tests
beforeAll(async () => {
  console.log('Setting up integration test environment...');

  // Initialize test database connection
  // Example: await prisma.$connect();

  // Run migrations
  // Example: await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  console.log('Integration test environment ready');
});

// Cleanup runs once after all tests
afterAll(async () => {
  console.log('Cleaning up integration test environment...');

  // Disconnect from database
  // Example: await prisma.$disconnect();

  console.log('Integration test environment cleaned up');
});

// Setup before each test
beforeEach(async () => {
  // Clear database tables or seed test data
  // Example: await prisma.user.deleteMany();
});

// Cleanup after each test
afterEach(async () => {
  // Additional cleanup if needed
});

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/fantasy_test';

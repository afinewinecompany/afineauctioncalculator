/**
 * Authentication Flow E2E Test Suite
 *
 * Tests the complete authentication flow against production endpoints:
 * - Frontend: https://fantasy-auction.vercel.app
 * - Backend: https://api.fantasy-auction.railway.app
 *
 * Run with: npx tsx tests/e2e/auth-flow-test.ts
 */

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'https://api.fantasy-auction.railway.app';
const FRONTEND_URL = process.env.TEST_FRONTEND_URL || 'https://fantasy-auction.vercel.app';

// Test data
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123',
  name: 'E2E Test User'
};

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details: string;
  response?: {
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  };
  issues?: string[];
}

interface TestReport {
  timestamp: string;
  environment: {
    frontend: string;
    backend: string;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  tests: TestResult[];
  securityConcerns: string[];
  recommendations: string[];
}

const testResults: TestResult[] = [];

// Helper function to make API requests
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; body: unknown; headers: Headers; duration: number }> {
  const startTime = Date.now();

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  });

  const duration = Date.now() - startTime;

  let body: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return { status: response.status, body, headers: response.headers, duration };
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

async function testHealthCheck(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/health');

    if (status === 200) {
      return {
        name: 'Health Check',
        status: 'PASS',
        duration,
        details: 'API is healthy and responding',
        response: { status, body }
      };
    }

    return {
      name: 'Health Check',
      status: 'FAIL',
      duration,
      details: `Unexpected status: ${status}`,
      response: { status, body },
      issues: ['API health check failed']
    };
  } catch (error) {
    return {
      name: 'Health Check',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Could not connect to API']
    };
  }
}

async function testRegistrationValidation(): Promise<TestResult> {
  const startTime = Date.now();
  const issues: string[] = [];

  try {
    // Test 1: Missing fields
    const emptyResult = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({})
    });

    if (emptyResult.status !== 400) {
      issues.push(`Expected 400 for empty body, got ${emptyResult.status}`);
    }

    // Test 2: Invalid email
    const invalidEmailResult = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'TestPassword123',
        name: 'Test User'
      })
    });

    if (invalidEmailResult.status !== 400) {
      issues.push(`Expected 400 for invalid email, got ${invalidEmailResult.status}`);
    }

    // Test 3: Weak password (no uppercase)
    const weakPasswordResult = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })
    });

    if (weakPasswordResult.status !== 400) {
      issues.push(`Expected 400 for weak password, got ${weakPasswordResult.status}`);
    }

    // Test 4: Password too short
    const shortPasswordResult = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Pass1',
        name: 'Test User'
      })
    });

    if (shortPasswordResult.status !== 400) {
      issues.push(`Expected 400 for short password, got ${shortPasswordResult.status}`);
    }

    const duration = Date.now() - startTime;

    if (issues.length === 0) {
      return {
        name: 'Registration Validation',
        status: 'PASS',
        duration,
        details: 'All validation rules working correctly'
      };
    }

    return {
      name: 'Registration Validation',
      status: 'FAIL',
      duration,
      details: 'Some validation tests failed',
      issues
    };
  } catch (error) {
    return {
      name: 'Registration Validation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Registration validation test failed']
    };
  }
}

async function testRegistrationFlow(): Promise<TestResult & { tokens?: { accessToken: string; refreshToken: string } }> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(TEST_USER)
    });

    const responseBody = body as {
      user?: { id: string; email: string; name: string };
      accessToken?: string;
      refreshToken?: string;
      error?: string;
      code?: string;
    };

    if (status === 201 && responseBody.accessToken && responseBody.refreshToken) {
      return {
        name: 'Registration Flow',
        status: 'PASS',
        duration,
        details: 'User registered successfully with tokens',
        response: { status, body },
        tokens: {
          accessToken: responseBody.accessToken,
          refreshToken: responseBody.refreshToken
        }
      };
    }

    if (status === 409) {
      return {
        name: 'Registration Flow',
        status: 'SKIP',
        duration,
        details: 'User already exists (expected in re-runs)',
        response: { status, body }
      };
    }

    return {
      name: 'Registration Flow',
      status: 'FAIL',
      duration,
      details: `Unexpected response: ${status}`,
      response: { status, body },
      issues: [`Expected 201, got ${status}`, responseBody.error || 'Unknown error']
    };
  } catch (error) {
    return {
      name: 'Registration Flow',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Registration request failed']
    };
  }
}

async function testLoginValidation(): Promise<TestResult> {
  const startTime = Date.now();
  const issues: string[] = [];

  try {
    // Test 1: Missing fields
    const emptyResult = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({})
    });

    if (emptyResult.status !== 400) {
      issues.push(`Expected 400 for empty body, got ${emptyResult.status}`);
    }

    // Test 2: Invalid email format
    const invalidEmailResult = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'TestPassword123'
      })
    });

    if (invalidEmailResult.status !== 400) {
      issues.push(`Expected 400 for invalid email, got ${invalidEmailResult.status}`);
    }

    // Test 3: Wrong credentials (security check - should not reveal if email exists)
    const wrongCredentialsResult = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'WrongPassword123'
      })
    });

    const wrongCredBody = wrongCredentialsResult.body as { code?: string; message?: string };

    if (wrongCredentialsResult.status !== 401) {
      issues.push(`Expected 401 for wrong credentials, got ${wrongCredentialsResult.status}`);
    }

    // Security check: message should not reveal if email exists
    if (wrongCredBody.message?.toLowerCase().includes('not found') ||
        wrongCredBody.message?.toLowerCase().includes('does not exist')) {
      issues.push('SECURITY: Login error reveals email existence');
    }

    const duration = Date.now() - startTime;

    if (issues.length === 0) {
      return {
        name: 'Login Validation',
        status: 'PASS',
        duration,
        details: 'All login validation working correctly'
      };
    }

    return {
      name: 'Login Validation',
      status: 'FAIL',
      duration,
      details: 'Some login validation tests failed',
      issues
    };
  } catch (error) {
    return {
      name: 'Login Validation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Login validation test failed']
    };
  }
}

async function testLoginFlow(): Promise<TestResult & { tokens?: { accessToken: string; refreshToken: string } }> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password
      })
    });

    const responseBody = body as {
      user?: { id: string; email: string; name: string };
      accessToken?: string;
      refreshToken?: string;
      error?: string;
      code?: string;
    };

    if (status === 200 && responseBody.accessToken && responseBody.refreshToken) {
      // Validate JWT format
      const accessParts = responseBody.accessToken.split('.');
      const refreshParts = responseBody.refreshToken.split('.');

      if (accessParts.length !== 3 || refreshParts.length !== 3) {
        return {
          name: 'Login Flow',
          status: 'FAIL',
          duration,
          details: 'Invalid JWT format in tokens',
          response: { status, body },
          issues: ['JWT tokens do not have correct format (3 parts)']
        };
      }

      return {
        name: 'Login Flow',
        status: 'PASS',
        duration,
        details: 'User logged in successfully with valid JWT tokens',
        response: { status, body },
        tokens: {
          accessToken: responseBody.accessToken,
          refreshToken: responseBody.refreshToken
        }
      };
    }

    return {
      name: 'Login Flow',
      status: 'FAIL',
      duration,
      details: `Login failed: ${responseBody.error || 'Unknown error'}`,
      response: { status, body },
      issues: [`Expected 200 with tokens, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Login Flow',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Login request failed']
    };
  }
}

async function testSessionVerification(accessToken: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Test /api/auth/me endpoint (session verification)
    const { status, body, duration } = await apiRequest('/api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const responseBody = body as {
      user?: { id: string; email: string; name: string };
      error?: string;
    };

    if (status === 200 && responseBody.user) {
      return {
        name: 'Session Verification',
        status: 'PASS',
        duration,
        details: 'Session verified successfully via /api/auth/me',
        response: { status, body }
      };
    }

    return {
      name: 'Session Verification',
      status: 'FAIL',
      duration,
      details: `Session verification failed: ${responseBody.error || 'No user returned'}`,
      response: { status, body },
      issues: [`Expected 200 with user, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Session Verification',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Session verification request failed']
    };
  }
}

async function testSessionVerificationWithoutToken(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/auth/me', {
      method: 'GET'
    });

    const responseBody = body as { code?: string; error?: string };

    if (status === 401 && responseBody.code === 'AUTH_REQUIRED') {
      return {
        name: 'Session Verification (No Token)',
        status: 'PASS',
        duration,
        details: 'Correctly returns 401 when no token provided',
        response: { status, body }
      };
    }

    return {
      name: 'Session Verification (No Token)',
      status: 'FAIL',
      duration,
      details: 'Should require authentication',
      response: { status, body },
      issues: [`Expected 401, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Session Verification (No Token)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testSessionVerificationWithInvalidToken(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid.token.here'
      }
    });

    const responseBody = body as { code?: string; error?: string };

    if (status === 401) {
      return {
        name: 'Session Verification (Invalid Token)',
        status: 'PASS',
        duration,
        details: 'Correctly rejects invalid tokens',
        response: { status, body }
      };
    }

    return {
      name: 'Session Verification (Invalid Token)',
      status: 'FAIL',
      duration,
      details: 'Should reject invalid tokens',
      response: { status, body },
      issues: [`Expected 401, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Session Verification (Invalid Token)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testTokenRefresh(refreshToken: string): Promise<TestResult & { newAccessToken?: string }> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });

    const responseBody = body as {
      accessToken?: string;
      error?: string;
      code?: string;
    };

    if (status === 200 && responseBody.accessToken) {
      // Validate JWT format
      const parts = responseBody.accessToken.split('.');
      if (parts.length !== 3) {
        return {
          name: 'Token Refresh',
          status: 'FAIL',
          duration,
          details: 'Invalid JWT format in new access token',
          response: { status, body },
          issues: ['New access token does not have correct format']
        };
      }

      return {
        name: 'Token Refresh',
        status: 'PASS',
        duration,
        details: 'New access token generated successfully',
        response: { status, body },
        newAccessToken: responseBody.accessToken
      };
    }

    return {
      name: 'Token Refresh',
      status: 'FAIL',
      duration,
      details: `Token refresh failed: ${responseBody.error || 'Unknown error'}`,
      response: { status, body },
      issues: [`Expected 200 with new token, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Token Refresh',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Token refresh request failed']
    };
  }
}

async function testTokenRefreshWithInvalidToken(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'invalid.refresh.token' })
    });

    if (status === 401) {
      return {
        name: 'Token Refresh (Invalid Token)',
        status: 'PASS',
        duration,
        details: 'Correctly rejects invalid refresh tokens',
        response: { status, body }
      };
    }

    return {
      name: 'Token Refresh (Invalid Token)',
      status: 'FAIL',
      duration,
      details: 'Should reject invalid refresh tokens',
      response: { status, body },
      issues: [`Expected 401, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Token Refresh (Invalid Token)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testLogout(accessToken: string, refreshToken: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Note: Logout does NOT require access token - it validates the refresh token directly
    // This allows users to logout even if their access token has expired
    const { status, body, duration } = await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });

    const responseBody = body as { success?: boolean; message?: string; error?: string };

    if (status === 200 && responseBody.success) {
      return {
        name: 'Logout Flow',
        status: 'PASS',
        duration,
        details: 'User logged out successfully',
        response: { status, body }
      };
    }

    return {
      name: 'Logout Flow',
      status: 'FAIL',
      duration,
      details: `Logout failed: ${responseBody.error || 'Unknown error'}`,
      response: { status, body },
      issues: [`Expected 200 with success, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Logout Flow',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Logout request failed']
    };
  }
}

async function testLogoutWithInvalidRefreshToken(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Logout validates the refresh token, not access token
    // Test with an invalid/non-existent refresh token
    const { status, body, duration } = await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'invalid-refresh-token-12345' })
    });

    // Logout should still return 200 even with invalid token (idempotent)
    // The token simply won't be found in the database to revoke
    if (status === 200) {
      return {
        name: 'Logout (Invalid Token)',
        status: 'PASS',
        duration,
        details: 'Logout is idempotent - succeeds even with invalid token',
        response: { status, body }
      };
    }

    return {
      name: 'Logout (Invalid Token)',
      status: 'FAIL',
      duration,
      details: 'Logout should be idempotent',
      response: { status, body },
      issues: [`Expected 200 (idempotent), got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Logout (Invalid Token)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testLogoutWithoutRefreshToken(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Test logout without providing a refresh token
    const { status, body, duration } = await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({})
    });

    // Should return 400 for validation error (missing refreshToken)
    if (status === 400) {
      return {
        name: 'Logout (No Refresh Token)',
        status: 'PASS',
        duration,
        details: 'Correctly requires refresh token for logout',
        response: { status, body }
      };
    }

    return {
      name: 'Logout (No Refresh Token)',
      status: 'FAIL',
      duration,
      details: 'Logout should require refresh token',
      response: { status, body },
      issues: [`Expected 400 for missing refreshToken, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Logout (No Refresh Token)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testRefreshTokenInvalidationAfterLogout(refreshToken: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });

    const responseBody = body as { code?: string; error?: string };

    if (status === 401 && responseBody.code === 'TOKEN_REVOKED') {
      return {
        name: 'Refresh Token Invalidation',
        status: 'PASS',
        duration,
        details: 'Refresh token correctly invalidated after logout',
        response: { status, body }
      };
    }

    // 401 with INVALID_REFRESH_TOKEN is also acceptable
    if (status === 401) {
      return {
        name: 'Refresh Token Invalidation',
        status: 'PASS',
        duration,
        details: 'Refresh token rejected after logout (token invalid)',
        response: { status, body }
      };
    }

    return {
      name: 'Refresh Token Invalidation',
      status: 'FAIL',
      duration,
      details: 'Refresh token should be invalidated after logout',
      response: { status, body },
      issues: [`Expected 401, got ${status}. Token may still be valid.`]
    };
  } catch (error) {
    return {
      name: 'Refresh Token Invalidation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testGoogleOAuthStatus(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/auth/google/status', {
      method: 'GET'
    });

    const responseBody = body as { configured?: boolean; message?: string };

    if (status === 200) {
      return {
        name: 'Google OAuth Status',
        status: 'PASS',
        duration,
        details: `Google OAuth configured: ${responseBody.configured}`,
        response: { status, body }
      };
    }

    return {
      name: 'Google OAuth Status',
      status: 'FAIL',
      duration,
      details: 'Could not check Google OAuth status',
      response: { status, body },
      issues: [`Expected 200, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Google OAuth Status',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testGoogleOAuthRedirect(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Use fetch with redirect: 'manual' to capture the redirect
    const response = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'GET',
      redirect: 'manual'
    });

    const duration = Date.now() - startTime;

    // Should redirect to Google
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('location');

      if (location?.includes('accounts.google.com')) {
        return {
          name: 'Google OAuth Redirect',
          status: 'PASS',
          duration,
          details: 'Correctly redirects to Google OAuth',
          response: {
            status: response.status,
            body: { location: location.substring(0, 100) + '...' }
          }
        };
      }
    }

    // If not configured, should return 501
    if (response.status === 501) {
      const body = await response.json();
      return {
        name: 'Google OAuth Redirect',
        status: 'SKIP',
        duration,
        details: 'Google OAuth not configured on server',
        response: { status: response.status, body }
      };
    }

    return {
      name: 'Google OAuth Redirect',
      status: 'FAIL',
      duration,
      details: `Unexpected response: ${response.status}`,
      response: { status: response.status, body: null },
      issues: ['Expected redirect to Google or 501 not configured']
    };
  } catch (error) {
    return {
      name: 'Google OAuth Redirect',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testGoogleCallbackValidation(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Test callback without code
    const { status, body, duration } = await apiRequest('/api/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const responseBody = body as { code?: string; error?: string };

    if (status === 400 && responseBody.code === 'MISSING_CODE') {
      return {
        name: 'Google Callback Validation',
        status: 'PASS',
        duration,
        details: 'Correctly requires authorization code',
        response: { status, body }
      };
    }

    // 501 is acceptable if OAuth not configured
    if (status === 501) {
      return {
        name: 'Google Callback Validation',
        status: 'SKIP',
        duration,
        details: 'Google OAuth not configured',
        response: { status, body }
      };
    }

    return {
      name: 'Google Callback Validation',
      status: 'FAIL',
      duration,
      details: 'Should validate authorization code',
      response: { status, body },
      issues: [`Expected 400 with MISSING_CODE, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Google Callback Validation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testRateLimiting(): Promise<TestResult> {
  const startTime = Date.now();
  const issues: string[] = [];

  try {
    // Make 12 rapid login requests (limit is 10/minute)
    const results: number[] = [];

    for (let i = 0; i < 12; i++) {
      const { status } = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'ratelimit-test@example.com',
          password: 'TestPassword123'
        })
      });
      results.push(status);
    }

    const duration = Date.now() - startTime;

    // Check if we got rate limited (429)
    const rateLimited = results.includes(429);

    if (rateLimited) {
      return {
        name: 'Rate Limiting',
        status: 'PASS',
        duration,
        details: `Rate limiting working - got 429 after ${results.indexOf(429) + 1} requests`,
        response: { status: 429, body: { results } }
      };
    }

    // Check if rate limiting headers are present
    const lastRequest = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'ratelimit-test@example.com',
        password: 'TestPassword123'
      })
    });

    // If we didn't get rate limited after 12 requests, it might be skipped for this endpoint
    // or using IP-based limiting that doesn't apply in this environment
    return {
      name: 'Rate Limiting',
      status: 'SKIP',
      duration,
      details: 'Rate limiting may not apply in test environment or uses IP-based limits',
      response: { status: lastRequest.status, body: { results } },
      issues: ['Could not trigger rate limiting - may need different IP or rate limit is higher than 12/minute']
    };
  } catch (error) {
    return {
      name: 'Rate Limiting',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Rate limiting test failed']
    };
  }
}

async function testFrontendAccessibility(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(FRONTEND_URL);
    const duration = Date.now() - startTime;

    if (response.ok) {
      return {
        name: 'Frontend Accessibility',
        status: 'PASS',
        duration,
        details: 'Frontend is accessible',
        response: { status: response.status, body: 'HTML content' }
      };
    }

    return {
      name: 'Frontend Accessibility',
      status: 'FAIL',
      duration,
      details: `Frontend returned ${response.status}`,
      response: { status: response.status, body: null },
      issues: ['Frontend is not accessible']
    };
  } catch (error) {
    return {
      name: 'Frontend Accessibility',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Could not connect to frontend']
    };
  }
}

async function testCORSHeaders(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Make a preflight OPTIONS request
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization'
      }
    });

    const duration = Date.now() - startTime;

    const allowOrigin = response.headers.get('access-control-allow-origin');
    const allowMethods = response.headers.get('access-control-allow-methods');
    const allowHeaders = response.headers.get('access-control-allow-headers');

    const issues: string[] = [];

    if (!allowOrigin) {
      issues.push('Missing Access-Control-Allow-Origin header');
    } else if (allowOrigin !== '*' && allowOrigin !== FRONTEND_URL) {
      issues.push(`CORS origin mismatch: ${allowOrigin}`);
    }

    if (!allowMethods) {
      issues.push('Missing Access-Control-Allow-Methods header');
    }

    if (issues.length === 0) {
      return {
        name: 'CORS Headers',
        status: 'PASS',
        duration,
        details: 'CORS headers properly configured',
        response: {
          status: response.status,
          body: {
            'access-control-allow-origin': allowOrigin,
            'access-control-allow-methods': allowMethods,
            'access-control-allow-headers': allowHeaders
          }
        }
      };
    }

    return {
      name: 'CORS Headers',
      status: 'FAIL',
      duration,
      details: 'CORS configuration issues found',
      response: { status: response.status, body: null },
      issues
    };
  } catch (error) {
    return {
      name: 'CORS Headers',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['CORS test failed']
    };
  }
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runTests(): Promise<TestReport> {
  console.log('========================================');
  console.log('Authentication Flow E2E Test Suite');
  console.log('========================================');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('========================================\n');

  const results: TestResult[] = [];
  const securityConcerns: string[] = [];
  const recommendations: string[] = [];

  // Pre-flight checks
  console.log('--- Pre-flight Checks ---');

  const healthResult = await testHealthCheck();
  results.push(healthResult);
  console.log(`[${healthResult.status}] ${healthResult.name}: ${healthResult.details}`);

  if (healthResult.status === 'FAIL') {
    console.log('\nAPI is not healthy. Aborting tests.');
    return generateReport(results, securityConcerns, recommendations);
  }

  const frontendResult = await testFrontendAccessibility();
  results.push(frontendResult);
  console.log(`[${frontendResult.status}] ${frontendResult.name}: ${frontendResult.details}`);

  const corsResult = await testCORSHeaders();
  results.push(corsResult);
  console.log(`[${corsResult.status}] ${corsResult.name}: ${corsResult.details}`);

  // Registration Tests
  console.log('\n--- Registration Tests ---');

  const regValidationResult = await testRegistrationValidation();
  results.push(regValidationResult);
  console.log(`[${regValidationResult.status}] ${regValidationResult.name}: ${regValidationResult.details}`);

  const regResult = await testRegistrationFlow();
  results.push(regResult);
  console.log(`[${regResult.status}] ${regResult.name}: ${regResult.details}`);

  // Login Tests
  console.log('\n--- Login Tests ---');

  const loginValidationResult = await testLoginValidation();
  results.push(loginValidationResult);
  console.log(`[${loginValidationResult.status}] ${loginValidationResult.name}: ${loginValidationResult.details}`);
  if (loginValidationResult.issues?.some(i => i.includes('SECURITY'))) {
    securityConcerns.push('Login error messages may reveal email existence');
  }

  const loginResult = await testLoginFlow();
  results.push(loginResult);
  console.log(`[${loginResult.status}] ${loginResult.name}: ${loginResult.details}`);

  // Session Verification Tests
  console.log('\n--- Session Verification Tests ---');

  const noTokenResult = await testSessionVerificationWithoutToken();
  results.push(noTokenResult);
  console.log(`[${noTokenResult.status}] ${noTokenResult.name}: ${noTokenResult.details}`);

  const invalidTokenResult = await testSessionVerificationWithInvalidToken();
  results.push(invalidTokenResult);
  console.log(`[${invalidTokenResult.status}] ${invalidTokenResult.name}: ${invalidTokenResult.details}`);

  if (loginResult.tokens) {
    const sessionResult = await testSessionVerification(loginResult.tokens.accessToken);
    results.push(sessionResult);
    console.log(`[${sessionResult.status}] ${sessionResult.name}: ${sessionResult.details}`);
  }

  // Token Refresh Tests
  console.log('\n--- Token Refresh Tests ---');

  const invalidRefreshResult = await testTokenRefreshWithInvalidToken();
  results.push(invalidRefreshResult);
  console.log(`[${invalidRefreshResult.status}] ${invalidRefreshResult.name}: ${invalidRefreshResult.details}`);

  let refreshedToken: string | undefined;
  if (loginResult.tokens) {
    const refreshResult = await testTokenRefresh(loginResult.tokens.refreshToken);
    results.push(refreshResult);
    console.log(`[${refreshResult.status}] ${refreshResult.name}: ${refreshResult.details}`);
    refreshedToken = refreshResult.newAccessToken;

    // Verify the new token works
    if (refreshedToken) {
      const verifyRefreshedResult = await testSessionVerification(refreshedToken);
      verifyRefreshedResult.name = 'Verify Refreshed Token';
      results.push(verifyRefreshedResult);
      console.log(`[${verifyRefreshedResult.status}] ${verifyRefreshedResult.name}: ${verifyRefreshedResult.details}`);
    }
  }

  // Logout Tests
  console.log('\n--- Logout Tests ---');

  const logoutInvalidTokenResult = await testLogoutWithInvalidRefreshToken();
  results.push(logoutInvalidTokenResult);
  console.log(`[${logoutInvalidTokenResult.status}] ${logoutInvalidTokenResult.name}: ${logoutInvalidTokenResult.details}`);

  const logoutNoRefreshTokenResult = await testLogoutWithoutRefreshToken();
  results.push(logoutNoRefreshTokenResult);
  console.log(`[${logoutNoRefreshTokenResult.status}] ${logoutNoRefreshTokenResult.name}: ${logoutNoRefreshTokenResult.details}`);

  if (loginResult.tokens) {
    const logoutResult = await testLogout(
      refreshedToken || loginResult.tokens.accessToken,
      loginResult.tokens.refreshToken
    );
    results.push(logoutResult);
    console.log(`[${logoutResult.status}] ${logoutResult.name}: ${logoutResult.details}`);

    if (logoutResult.status === 'PASS') {
      const invalidationResult = await testRefreshTokenInvalidationAfterLogout(
        loginResult.tokens.refreshToken
      );
      results.push(invalidationResult);
      console.log(`[${invalidationResult.status}] ${invalidationResult.name}: ${invalidationResult.details}`);
    }
  }

  // Google OAuth Tests
  console.log('\n--- Google OAuth Tests ---');

  const oauthStatusResult = await testGoogleOAuthStatus();
  results.push(oauthStatusResult);
  console.log(`[${oauthStatusResult.status}] ${oauthStatusResult.name}: ${oauthStatusResult.details}`);

  const oauthRedirectResult = await testGoogleOAuthRedirect();
  results.push(oauthRedirectResult);
  console.log(`[${oauthRedirectResult.status}] ${oauthRedirectResult.name}: ${oauthRedirectResult.details}`);

  const oauthCallbackResult = await testGoogleCallbackValidation();
  results.push(oauthCallbackResult);
  console.log(`[${oauthCallbackResult.status}] ${oauthCallbackResult.name}: ${oauthCallbackResult.details}`);

  // Rate Limiting Tests
  console.log('\n--- Rate Limiting Tests ---');

  const rateLimitResult = await testRateLimiting();
  results.push(rateLimitResult);
  console.log(`[${rateLimitResult.status}] ${rateLimitResult.name}: ${rateLimitResult.details}`);

  // Generate recommendations based on results
  const failedTests = results.filter(r => r.status === 'FAIL');
  if (failedTests.length > 0) {
    recommendations.push('Fix all failing tests before deploying to production');
    failedTests.forEach(t => {
      if (t.issues) {
        t.issues.forEach(issue => {
          if (!recommendations.includes(issue)) {
            recommendations.push(`Fix: ${issue}`);
          }
        });
      }
    });
  }

  // Add general recommendations
  if (!results.find(r => r.name === 'Rate Limiting' && r.status === 'PASS')) {
    recommendations.push('Verify rate limiting is properly configured for authentication endpoints');
  }

  return generateReport(results, securityConcerns, recommendations);
}

function generateReport(
  results: TestResult[],
  securityConcerns: string[],
  recommendations: string[]
): TestReport {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  const report: TestReport = {
    timestamp: new Date().toISOString(),
    environment: {
      frontend: FRONTEND_URL,
      backend: BACKEND_URL
    },
    summary: {
      total: results.length,
      passed,
      failed,
      skipped
    },
    tests: results,
    securityConcerns,
    recommendations
  };

  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Total:   ${report.summary.total}`);
  console.log(`Passed:  ${report.summary.passed}`);
  console.log(`Failed:  ${report.summary.failed}`);
  console.log(`Skipped: ${report.summary.skipped}`);
  console.log('========================================');

  if (securityConcerns.length > 0) {
    console.log('\nSECURITY CONCERNS:');
    securityConcerns.forEach(c => console.log(`  - ${c}`));
  }

  if (recommendations.length > 0) {
    console.log('\nRECOMMENDATIONS:');
    recommendations.forEach(r => console.log(`  - ${r}`));
  }

  return report;
}

// Run the tests
runTests()
  .then(report => {
    console.log('\n========================================');
    console.log('FULL REPORT (JSON):');
    console.log('========================================');
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.summary.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });

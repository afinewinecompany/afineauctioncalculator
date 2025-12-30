/**
 * Production API Test Suite
 *
 * Tests the production backend API at https://api.fantasy-auction.railway.app
 *
 * Run with: npx tsx tests/production-api-test.ts
 */

const BASE_URL = 'https://api.fantasy-auction.railway.app';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  statusCode?: number;
  responseTime?: number;
  details: string;
  headers?: Record<string, string>;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Helper to make HTTP requests and measure response time
 */
async function makeRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
  headers: Headers;
  responseTime: number;
}> {
  const start = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    const responseTime = Date.now() - start;
    let data: unknown;

    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: response.headers,
      responseTime,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      headers: new Headers(),
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Extract relevant headers for logging
 */
function extractHeaders(headers: Headers): Record<string, string> {
  const relevant: Record<string, string> = {};
  const headerNames = [
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'ratelimit-limit',
    'ratelimit-remaining',
    'ratelimit-reset',
    'x-request-id',
    'content-type',
  ];

  for (const name of headerNames) {
    const value = headers.get(name);
    if (value) {
      relevant[name] = value;
    }
  }

  return relevant;
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

async function testHealthCheck(): Promise<void> {
  console.log('\n--- Testing Health Check ---');

  const { ok, status, data, headers, responseTime } = await makeRequest('/api/health');

  const result: TestResult = {
    endpoint: '/api/health',
    method: 'GET',
    status: 'FAIL',
    statusCode: status,
    responseTime,
    details: '',
    headers: extractHeaders(headers),
  };

  if (ok && status === 200) {
    const healthData = data as {
      status: string;
      services: {
        database: string;
        redis: string;
      };
      environment: string;
      uptime: number;
    };

    result.status = 'PASS';
    result.details = `Database: ${healthData.services?.database}, Redis: ${healthData.services?.redis}, Uptime: ${Math.round(healthData.uptime || 0)}s`;

    if (healthData.services?.database !== 'connected') {
      result.status = 'WARN';
      result.details += ' [WARNING: Database not connected]';
    }

    console.log(`  Status: ${healthData.status}`);
    console.log(`  Database: ${healthData.services?.database}`);
    console.log(`  Redis: ${healthData.services?.redis}`);
    console.log(`  Environment: ${healthData.environment}`);
    console.log(`  Response Time: ${responseTime}ms`);
  } else {
    result.status = 'FAIL';
    result.details = `HTTP ${status} - ${JSON.stringify(data)}`;
    result.error = `Unexpected status code: ${status}`;
    console.log(`  FAILED: HTTP ${status}`);
    console.log(`  Response: ${JSON.stringify(data)}`);
  }

  results.push(result);
}

async function testAuthEndpoints(): Promise<void> {
  console.log('\n--- Testing Auth Endpoints ---');

  // Test Google OAuth status
  console.log('\n  Testing GET /api/auth/google/status');
  const googleStatus = await makeRequest('/api/auth/google/status');

  results.push({
    endpoint: '/api/auth/google/status',
    method: 'GET',
    status: googleStatus.ok ? 'PASS' : 'FAIL',
    statusCode: googleStatus.status,
    responseTime: googleStatus.responseTime,
    details: googleStatus.ok
      ? `Google OAuth configured: ${(googleStatus.data as { configured: boolean })?.configured}`
      : `Error: ${JSON.stringify(googleStatus.data)}`,
    headers: extractHeaders(googleStatus.headers),
  });

  console.log(`    Status: ${googleStatus.status}, Response Time: ${googleStatus.responseTime}ms`);
  console.log(`    Data: ${JSON.stringify(googleStatus.data)}`);

  // Test registration with invalid data (should return 400)
  console.log('\n  Testing POST /api/auth/register (invalid data)');
  const registerInvalid = await makeRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'invalid-email', password: '123' }),
  });

  results.push({
    endpoint: '/api/auth/register',
    method: 'POST',
    status: registerInvalid.status === 400 ? 'PASS' : 'FAIL',
    statusCode: registerInvalid.status,
    responseTime: registerInvalid.responseTime,
    details: registerInvalid.status === 400
      ? 'Correctly returned 400 for invalid data'
      : `Expected 400, got ${registerInvalid.status}`,
    headers: extractHeaders(registerInvalid.headers),
  });

  console.log(`    Status: ${registerInvalid.status}, Response Time: ${registerInvalid.responseTime}ms`);
  console.log(`    Validation errors returned: ${registerInvalid.status === 400 ? 'Yes' : 'No'}`);

  // Test login with invalid credentials (should return 401)
  console.log('\n  Testing POST /api/auth/login (invalid credentials)');
  const loginInvalid = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrongpassword' }),
  });

  results.push({
    endpoint: '/api/auth/login',
    method: 'POST',
    status: loginInvalid.status === 401 ? 'PASS' : 'FAIL',
    statusCode: loginInvalid.status,
    responseTime: loginInvalid.responseTime,
    details: loginInvalid.status === 401
      ? 'Correctly returned 401 for invalid credentials'
      : `Expected 401, got ${loginInvalid.status}`,
    headers: extractHeaders(loginInvalid.headers),
  });

  console.log(`    Status: ${loginInvalid.status}, Response Time: ${loginInvalid.responseTime}ms`);

  // Test /me without auth (should return 401)
  console.log('\n  Testing GET /api/auth/me (no auth)');
  const meNoAuth = await makeRequest('/api/auth/me');

  results.push({
    endpoint: '/api/auth/me',
    method: 'GET',
    status: meNoAuth.status === 401 ? 'PASS' : 'FAIL',
    statusCode: meNoAuth.status,
    responseTime: meNoAuth.responseTime,
    details: meNoAuth.status === 401
      ? 'Correctly returned 401 when not authenticated'
      : `Expected 401, got ${meNoAuth.status}`,
    headers: extractHeaders(meNoAuth.headers),
  });

  console.log(`    Status: ${meNoAuth.status}, Response Time: ${meNoAuth.responseTime}ms`);

  // Test token refresh with invalid token (should return 400 or 401)
  console.log('\n  Testing POST /api/auth/refresh (invalid token)');
  const refreshInvalid = await makeRequest('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: 'invalid-token' }),
  });

  results.push({
    endpoint: '/api/auth/refresh',
    method: 'POST',
    status: [400, 401].includes(refreshInvalid.status) ? 'PASS' : 'FAIL',
    statusCode: refreshInvalid.status,
    responseTime: refreshInvalid.responseTime,
    details: [400, 401].includes(refreshInvalid.status)
      ? 'Correctly rejected invalid refresh token'
      : `Expected 400/401, got ${refreshInvalid.status}`,
    headers: extractHeaders(refreshInvalid.headers),
  });

  console.log(`    Status: ${refreshInvalid.status}, Response Time: ${refreshInvalid.responseTime}ms`);
}

async function testProjectionsEndpoints(): Promise<void> {
  console.log('\n--- Testing Projections Endpoints ---');

  // Test Steamer projections status
  console.log('\n  Testing GET /api/projections/steamer/status');
  const steamerStatus = await makeRequest('/api/projections/steamer/status');

  results.push({
    endpoint: '/api/projections/steamer/status',
    method: 'GET',
    status: steamerStatus.ok ? 'PASS' : 'FAIL',
    statusCode: steamerStatus.status,
    responseTime: steamerStatus.responseTime,
    details: steamerStatus.ok
      ? `Cache status retrieved`
      : `Error: ${JSON.stringify(steamerStatus.data)}`,
    headers: extractHeaders(steamerStatus.headers),
  });

  console.log(`    Status: ${steamerStatus.status}, Response Time: ${steamerStatus.responseTime}ms`);
  console.log(`    Data: ${JSON.stringify(steamerStatus.data)}`);

  // Test JA projections status
  console.log('\n  Testing GET /api/projections/ja/status');
  const jaStatus = await makeRequest('/api/projections/ja/status');

  results.push({
    endpoint: '/api/projections/ja/status',
    method: 'GET',
    status: jaStatus.ok ? 'PASS' : 'FAIL',
    statusCode: jaStatus.status,
    responseTime: jaStatus.responseTime,
    details: jaStatus.ok
      ? `Cache status retrieved`
      : `Error: ${JSON.stringify(jaStatus.data)}`,
    headers: extractHeaders(jaStatus.headers),
  });

  console.log(`    Status: ${jaStatus.status}, Response Time: ${jaStatus.responseTime}ms`);

  // Test invalid projection system
  console.log('\n  Testing GET /api/projections/invalid (should return 400)');
  const invalidSystem = await makeRequest('/api/projections/invalid');

  results.push({
    endpoint: '/api/projections/invalid',
    method: 'GET',
    status: invalidSystem.status === 400 ? 'PASS' : 'FAIL',
    statusCode: invalidSystem.status,
    responseTime: invalidSystem.responseTime,
    details: invalidSystem.status === 400
      ? 'Correctly returned 400 for invalid system'
      : `Expected 400, got ${invalidSystem.status}`,
    headers: extractHeaders(invalidSystem.headers),
  });

  console.log(`    Status: ${invalidSystem.status}, Response Time: ${invalidSystem.responseTime}ms`);

  // Test BatX (should return 503 - unavailable)
  console.log('\n  Testing GET /api/projections/batx (should return 503)');
  const batxStatus = await makeRequest('/api/projections/batx');

  results.push({
    endpoint: '/api/projections/batx',
    method: 'GET',
    status: batxStatus.status === 503 ? 'PASS' : 'WARN',
    statusCode: batxStatus.status,
    responseTime: batxStatus.responseTime,
    details: batxStatus.status === 503
      ? 'Correctly returned 503 (BatX unavailable)'
      : `Got status ${batxStatus.status}`,
    headers: extractHeaders(batxStatus.headers),
  });

  console.log(`    Status: ${batxStatus.status}, Response Time: ${batxStatus.responseTime}ms`);

  // Test calculate-values with invalid data
  console.log('\n  Testing POST /api/projections/calculate-values (invalid data)');
  const calcInvalid = await makeRequest('/api/projections/calculate-values', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  results.push({
    endpoint: '/api/projections/calculate-values',
    method: 'POST',
    status: calcInvalid.status === 400 ? 'PASS' : 'FAIL',
    statusCode: calcInvalid.status,
    responseTime: calcInvalid.responseTime,
    details: calcInvalid.status === 400
      ? 'Correctly returned 400 for missing data'
      : `Expected 400, got ${calcInvalid.status}`,
    headers: extractHeaders(calcInvalid.headers),
  });

  console.log(`    Status: ${calcInvalid.status}, Response Time: ${calcInvalid.responseTime}ms`);

  // Test dynasty rankings endpoint
  console.log('\n  Testing GET /api/projections/dynasty-rankings');
  const dynastyRankings = await makeRequest('/api/projections/dynasty-rankings');

  // This may return 503 if scraping fails, so we accept 200 or 503
  results.push({
    endpoint: '/api/projections/dynasty-rankings',
    method: 'GET',
    status: [200, 503].includes(dynastyRankings.status) ? 'PASS' : 'FAIL',
    statusCode: dynastyRankings.status,
    responseTime: dynastyRankings.responseTime,
    details: dynastyRankings.status === 200
      ? `Retrieved dynasty rankings`
      : dynastyRankings.status === 503
        ? 'Dynasty rankings unavailable (scraping may have failed)'
        : `Unexpected status: ${dynastyRankings.status}`,
    headers: extractHeaders(dynastyRankings.headers),
  });

  console.log(`    Status: ${dynastyRankings.status}, Response Time: ${dynastyRankings.responseTime}ms`);
}

async function testAuctionEndpoints(): Promise<void> {
  console.log('\n--- Testing Auction Endpoints ---');

  // Test cache status endpoint
  console.log('\n  Testing GET /api/auction/cache/status');
  const cacheStatus = await makeRequest('/api/auction/cache/status');

  results.push({
    endpoint: '/api/auction/cache/status',
    method: 'GET',
    status: cacheStatus.ok ? 'PASS' : 'FAIL',
    statusCode: cacheStatus.status,
    responseTime: cacheStatus.responseTime,
    details: cacheStatus.ok
      ? `Cache status: ${(cacheStatus.data as { cachedRoomCount?: number })?.cachedRoomCount || 0} rooms cached`
      : `Error: ${JSON.stringify(cacheStatus.data)}`,
    headers: extractHeaders(cacheStatus.headers),
  });

  console.log(`    Status: ${cacheStatus.status}, Response Time: ${cacheStatus.responseTime}ms`);
  console.log(`    Data: ${JSON.stringify(cacheStatus.data)}`);

  // Test invalid room ID
  console.log('\n  Testing GET /api/auction/invalid (should return 400)');
  const invalidRoom = await makeRequest('/api/auction/invalid');

  results.push({
    endpoint: '/api/auction/invalid',
    method: 'GET',
    status: invalidRoom.status === 400 ? 'PASS' : 'FAIL',
    statusCode: invalidRoom.status,
    responseTime: invalidRoom.responseTime,
    details: invalidRoom.status === 400
      ? 'Correctly returned 400 for invalid room ID'
      : `Expected 400, got ${invalidRoom.status}`,
    headers: extractHeaders(invalidRoom.headers),
  });

  console.log(`    Status: ${invalidRoom.status}, Response Time: ${invalidRoom.responseTime}ms`);

  // Test sync-lite with missing data
  console.log('\n  Testing POST /api/auction/12345/sync-lite (invalid config)');
  const syncInvalid = await makeRequest('/api/auction/12345/sync-lite', {
    method: 'POST',
    body: JSON.stringify({ leagueConfig: {} }),
  });

  results.push({
    endpoint: '/api/auction/:roomId/sync-lite',
    method: 'POST',
    status: syncInvalid.status === 400 ? 'PASS' : 'FAIL',
    statusCode: syncInvalid.status,
    responseTime: syncInvalid.responseTime,
    details: syncInvalid.status === 400
      ? 'Correctly returned 400 for invalid config'
      : `Expected 400, got ${syncInvalid.status}`,
    headers: extractHeaders(syncInvalid.headers),
  });

  console.log(`    Status: ${syncInvalid.status}, Response Time: ${syncInvalid.responseTime}ms`);

  // Test room cache status
  console.log('\n  Testing GET /api/auction/99999/cache');
  const roomCache = await makeRequest('/api/auction/99999/cache');

  results.push({
    endpoint: '/api/auction/:roomId/cache',
    method: 'GET',
    status: roomCache.ok ? 'PASS' : 'FAIL',
    statusCode: roomCache.status,
    responseTime: roomCache.responseTime,
    details: roomCache.ok
      ? `Room cache status retrieved`
      : `Error: ${JSON.stringify(roomCache.data)}`,
    headers: extractHeaders(roomCache.headers),
  });

  console.log(`    Status: ${roomCache.status}, Response Time: ${roomCache.responseTime}ms`);
}

async function testCORSHeaders(): Promise<void> {
  console.log('\n--- Testing CORS Headers ---');

  // Test preflight request (OPTIONS)
  console.log('\n  Testing OPTIONS /api/health (CORS preflight)');
  const preflight = await fetch(`${BASE_URL}/api/health`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://fantasy-auction.vercel.app',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  });

  const corsHeaders = {
    'access-control-allow-origin': preflight.headers.get('access-control-allow-origin'),
    'access-control-allow-methods': preflight.headers.get('access-control-allow-methods'),
    'access-control-allow-headers': preflight.headers.get('access-control-allow-headers'),
    'access-control-allow-credentials': preflight.headers.get('access-control-allow-credentials'),
  };

  const hasValidCORS = corsHeaders['access-control-allow-origin'] !== null;

  results.push({
    endpoint: '/api/health (OPTIONS)',
    method: 'OPTIONS',
    status: hasValidCORS ? 'PASS' : 'WARN',
    statusCode: preflight.status,
    responseTime: 0,
    details: hasValidCORS
      ? `CORS configured: Origin=${corsHeaders['access-control-allow-origin']}`
      : 'CORS headers not present',
    headers: corsHeaders as Record<string, string>,
  });

  console.log(`    Status: ${preflight.status}`);
  console.log(`    Access-Control-Allow-Origin: ${corsHeaders['access-control-allow-origin']}`);
  console.log(`    Access-Control-Allow-Methods: ${corsHeaders['access-control-allow-methods']}`);
  console.log(`    Access-Control-Allow-Credentials: ${corsHeaders['access-control-allow-credentials']}`);
}

async function testRateLimiting(): Promise<void> {
  console.log('\n--- Testing Rate Limiting ---');

  // Make a request and check for rate limit headers
  console.log('\n  Checking rate limit headers on /api/health');
  const response = await makeRequest('/api/health');

  const rateLimitHeaders = {
    'ratelimit-limit': response.headers.get('ratelimit-limit'),
    'ratelimit-remaining': response.headers.get('ratelimit-remaining'),
    'ratelimit-reset': response.headers.get('ratelimit-reset'),
  };

  // Health check is excluded from rate limiting, so headers may not be present
  const hasRateLimitHeaders = rateLimitHeaders['ratelimit-limit'] !== null;

  results.push({
    endpoint: '/api/health (rate limit check)',
    method: 'GET',
    status: 'PASS', // Health check is excluded from rate limiting
    statusCode: response.status,
    responseTime: response.responseTime,
    details: hasRateLimitHeaders
      ? `Rate limit: ${rateLimitHeaders['ratelimit-remaining']}/${rateLimitHeaders['ratelimit-limit']} remaining`
      : 'Rate limit headers not present (health check excluded)',
    headers: rateLimitHeaders as Record<string, string>,
  });

  console.log(`    RateLimit-Limit: ${rateLimitHeaders['ratelimit-limit'] || 'N/A'}`);
  console.log(`    RateLimit-Remaining: ${rateLimitHeaders['ratelimit-remaining'] || 'N/A'}`);
  console.log(`    RateLimit-Reset: ${rateLimitHeaders['ratelimit-reset'] || 'N/A'}`);

  // Check rate limit headers on a regular API endpoint
  console.log('\n  Checking rate limit headers on /api/projections/steamer/status');
  const apiResponse = await makeRequest('/api/projections/steamer/status');

  const apiRateLimitHeaders = {
    'ratelimit-limit': apiResponse.headers.get('ratelimit-limit'),
    'ratelimit-remaining': apiResponse.headers.get('ratelimit-remaining'),
    'ratelimit-reset': apiResponse.headers.get('ratelimit-reset'),
  };

  const hasApiRateLimitHeaders = apiRateLimitHeaders['ratelimit-limit'] !== null;

  results.push({
    endpoint: '/api/projections/steamer/status (rate limit)',
    method: 'GET',
    status: hasApiRateLimitHeaders ? 'PASS' : 'WARN',
    statusCode: apiResponse.status,
    responseTime: apiResponse.responseTime,
    details: hasApiRateLimitHeaders
      ? `Rate limit: ${apiRateLimitHeaders['ratelimit-remaining']}/${apiRateLimitHeaders['ratelimit-limit']} remaining`
      : 'Rate limit headers not present',
    headers: apiRateLimitHeaders as Record<string, string>,
  });

  console.log(`    RateLimit-Limit: ${apiRateLimitHeaders['ratelimit-limit'] || 'N/A'}`);
  console.log(`    RateLimit-Remaining: ${apiRateLimitHeaders['ratelimit-remaining'] || 'N/A'}`);
}

async function test404Handling(): Promise<void> {
  console.log('\n--- Testing 404 Handling ---');

  console.log('\n  Testing GET /api/nonexistent');
  const notFound = await makeRequest('/api/nonexistent');

  results.push({
    endpoint: '/api/nonexistent',
    method: 'GET',
    status: notFound.status === 404 ? 'PASS' : 'FAIL',
    statusCode: notFound.status,
    responseTime: notFound.responseTime,
    details: notFound.status === 404
      ? 'Correctly returned 404 for unknown endpoint'
      : `Expected 404, got ${notFound.status}`,
    headers: extractHeaders(notFound.headers),
  });

  console.log(`    Status: ${notFound.status}, Response Time: ${notFound.responseTime}ms`);
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runAllTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('PRODUCTION API TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    await testHealthCheck();
    await testAuthEndpoints();
    await testProjectionsEndpoints();
    await testAuctionEndpoints();
    await testCORSHeaders();
    await testRateLimiting();
    await test404Handling();
  } catch (error) {
    console.error('\nFATAL ERROR during tests:', error);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  WARNINGS: ${warned}`);

  console.log('\n--- Detailed Results ---\n');

  for (const result of results) {
    const statusIcon = result.status === 'PASS' ? '[OK]' : result.status === 'FAIL' ? '[FAIL]' : '[WARN]';
    console.log(`${statusIcon} ${result.method} ${result.endpoint}`);
    console.log(`    Status: ${result.statusCode}, Time: ${result.responseTime}ms`);
    console.log(`    ${result.details}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  // Print issues found
  const issues = results.filter(r => r.status !== 'PASS');
  if (issues.length > 0) {
    console.log('\n--- Issues Found ---\n');
    for (const issue of issues) {
      console.log(`${issue.status === 'FAIL' ? 'ERROR' : 'WARNING'}: ${issue.method} ${issue.endpoint}`);
      console.log(`  ${issue.details}`);
      if (issue.error) {
        console.log(`  ${issue.error}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);

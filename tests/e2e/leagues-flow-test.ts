/**
 * Leagues Flow E2E Test Suite
 *
 * Tests the complete leagues CRUD flow against production endpoints:
 * - Backend: https://api.fantasy-auction.railway.app
 *
 * Run with: npx tsx tests/e2e/leagues-flow-test.ts
 */

const BACKEND_URL = process.env.TEST_BACKEND_URL || 'https://api.fantasy-auction.railway.app';

// Test data
const TEST_USER = {
  email: `league-test-${Date.now()}@example.com`,
  password: 'TestPassword123',
  name: 'League Test User'
};

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details: string;
  response?: {
    status: number;
    body: unknown;
  };
  issues?: string[];
}

interface TestReport {
  timestamp: string;
  environment: {
    backend: string;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  tests: TestResult[];
  recommendations: string[];
}

const testResults: TestResult[] = [];

// Test state
let accessToken: string | null = null;
let refreshToken: string | null = null;
let createdLeagueId: string | null = null;

// =============================================================================
// Helper Functions
// =============================================================================

async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; body: unknown; headers: Headers; duration: number }> {
  const startTime = Date.now();

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    defaultHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers as Record<string, string>,
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
// Setup: Register/Login Test User
// =============================================================================

async function setupTestUser(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Try to register a new user
    const registerResult = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(TEST_USER)
    });

    if (registerResult.status === 201) {
      const response = registerResult.body as {
        accessToken?: string;
        refreshToken?: string;
      };
      accessToken = response.accessToken || null;
      refreshToken = response.refreshToken || null;

      return {
        name: 'Setup Test User (Register)',
        status: 'PASS',
        duration: Date.now() - startTime,
        details: 'New test user registered',
        response: { status: registerResult.status, body: registerResult.body }
      };
    }

    // User may already exist, try to login
    if (registerResult.status === 409) {
      const loginResult = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: TEST_USER.email,
          password: TEST_USER.password
        })
      });

      if (loginResult.status === 200) {
        const response = loginResult.body as {
          accessToken?: string;
          refreshToken?: string;
        };
        accessToken = response.accessToken || null;
        refreshToken = response.refreshToken || null;

        return {
          name: 'Setup Test User (Login)',
          status: 'PASS',
          duration: Date.now() - startTime,
          details: 'Logged in with existing test user',
          response: { status: loginResult.status, body: loginResult.body }
        };
      }
    }

    return {
      name: 'Setup Test User',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Could not register or login test user',
      response: { status: registerResult.status, body: registerResult.body },
      issues: ['Authentication setup failed']
    };
  } catch (error) {
    return {
      name: 'Setup Test User',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Setup failed']
    };
  }
}

// =============================================================================
// Leagues List Tests
// =============================================================================

async function testGetLeaguesWithoutAuth(): Promise<TestResult> {
  const startTime = Date.now();
  const savedToken = accessToken;
  accessToken = null; // Clear token to test unauthenticated request

  try {
    const { status, body, duration } = await apiRequest('/api/leagues', {
      method: 'GET'
    });

    accessToken = savedToken; // Restore token

    if (status === 401) {
      return {
        name: 'Get Leagues (No Auth)',
        status: 'PASS',
        duration,
        details: 'Correctly returns 401 when not authenticated',
        response: { status, body }
      };
    }

    return {
      name: 'Get Leagues (No Auth)',
      status: 'FAIL',
      duration,
      details: 'Should require authentication',
      response: { status, body },
      issues: [`Expected 401, got ${status}`]
    };
  } catch (error) {
    accessToken = savedToken;
    return {
      name: 'Get Leagues (No Auth)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testGetLeaguesEmpty(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/leagues', {
      method: 'GET'
    });

    const responseBody = body as { leagues?: unknown[] };

    if (status === 200 && Array.isArray(responseBody.leagues)) {
      return {
        name: 'Get Leagues (Empty)',
        status: 'PASS',
        duration,
        details: `Retrieved ${responseBody.leagues.length} leagues for new user`,
        response: { status, body }
      };
    }

    return {
      name: 'Get Leagues (Empty)',
      status: 'FAIL',
      duration,
      details: 'Unexpected response format',
      response: { status, body },
      issues: [`Expected 200 with leagues array, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Get Leagues (Empty)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

// =============================================================================
// League Creation Tests
// =============================================================================

async function testCreateLeagueValidation(): Promise<TestResult> {
  const startTime = Date.now();
  const issues: string[] = [];

  try {
    // Test 1: Empty body
    const emptyResult = await apiRequest('/api/leagues', {
      method: 'POST',
      body: JSON.stringify({})
    });

    if (emptyResult.status !== 400) {
      issues.push(`Expected 400 for empty body, got ${emptyResult.status}`);
    }

    // Test 2: Missing required fields
    const missingFieldsResult = await apiRequest('/api/leagues', {
      method: 'POST',
      body: JSON.stringify({
        leagueName: 'Test League'
        // Missing settings
      })
    });

    if (missingFieldsResult.status !== 400) {
      issues.push(`Expected 400 for missing fields, got ${missingFieldsResult.status}`);
    }

    // Test 3: Invalid scoring type
    const invalidScoringResult = await apiRequest('/api/leagues', {
      method: 'POST',
      body: JSON.stringify({
        leagueName: 'Test League',
        settings: {
          leagueName: 'Test League',
          numTeams: 12,
          budgetPerTeam: 260,
          scoringType: 'invalid-scoring-type',
          leagueType: 'redraft',
          projectionSystem: 'steamer',
          rosterSpots: { C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, CI: 0, MI: 0, UTIL: 1, SP: 5, RP: 2, P: 0, Bench: 3 }
        }
      })
    });

    if (invalidScoringResult.status !== 400) {
      issues.push(`Expected 400 for invalid scoring type, got ${invalidScoringResult.status}`);
    }

    // Test 4: Invalid number of teams
    const invalidTeamsResult = await apiRequest('/api/leagues', {
      method: 'POST',
      body: JSON.stringify({
        leagueName: 'Test League',
        settings: {
          leagueName: 'Test League',
          numTeams: 100, // Out of range
          budgetPerTeam: 260,
          scoringType: 'rotisserie',
          leagueType: 'redraft',
          projectionSystem: 'steamer',
          rosterSpots: { C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, CI: 0, MI: 0, UTIL: 1, SP: 5, RP: 2, P: 0, Bench: 3 }
        }
      })
    });

    if (invalidTeamsResult.status !== 400) {
      issues.push(`Expected 400 for invalid team count, got ${invalidTeamsResult.status}`);
    }

    const duration = Date.now() - startTime;

    if (issues.length === 0) {
      return {
        name: 'League Creation Validation',
        status: 'PASS',
        duration,
        details: 'All validation rules working correctly'
      };
    }

    return {
      name: 'League Creation Validation',
      status: 'FAIL',
      duration,
      details: 'Some validation tests failed',
      issues
    };
  } catch (error) {
    return {
      name: 'League Creation Validation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Validation test failed']
    };
  }
}

async function testCreateLeague(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const leagueData = {
      leagueName: `Test League ${Date.now()}`,
      settings: {
        leagueName: `Test League ${Date.now()}`,
        couchManagerRoomId: '',
        numTeams: 12,
        budgetPerTeam: 260,
        rosterSpots: {
          C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3,
          CI: 0, MI: 0, UTIL: 1, SP: 5, RP: 2, P: 0, Bench: 3
        },
        leagueType: 'redraft' as const,
        scoringType: 'rotisserie' as const,
        projectionSystem: 'steamer' as const,
        hittingCategories: { R: true, HR: true, RBI: true, SB: true, AVG: true },
        pitchingCategories: { W: true, K: true, ERA: true, WHIP: true, SV: true }
      },
      status: 'setup' as const,
      setupStep: 1
    };

    const { status, body, duration } = await apiRequest('/api/leagues', {
      method: 'POST',
      body: JSON.stringify(leagueData)
    });

    const responseBody = body as {
      league?: {
        id: string;
        leagueName: string;
        settings: object;
        status: string;
      };
      error?: string;
    };

    if (status === 201 && responseBody.league?.id) {
      createdLeagueId = responseBody.league.id;

      return {
        name: 'Create League',
        status: 'PASS',
        duration,
        details: `League created with ID: ${createdLeagueId}`,
        response: { status, body }
      };
    }

    return {
      name: 'Create League',
      status: 'FAIL',
      duration,
      details: `League creation failed: ${responseBody.error || 'Unknown error'}`,
      response: { status, body },
      issues: [`Expected 201 with league, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Create League',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['League creation failed']
    };
  }
}

async function testCreateDynastyLeague(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const leagueData = {
      leagueName: `Dynasty Test ${Date.now()}`,
      settings: {
        leagueName: `Dynasty Test ${Date.now()}`,
        couchManagerRoomId: '',
        numTeams: 12,
        budgetPerTeam: 400,
        rosterSpots: {
          C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 5,
          CI: 1, MI: 1, UTIL: 2, SP: 5, RP: 3, P: 0, Bench: 10
        },
        leagueType: 'dynasty' as const,
        scoringType: 'h2h-categories' as const,
        projectionSystem: 'steamer' as const,
        dynastySettings: {
          dynastyWeight: 0.5,
          includeMinors: true,
          rankingsSource: 'harryknowsball' as const
        },
        hittingCategories: { R: true, HR: true, RBI: true, SB: true, AVG: true, OBP: true },
        pitchingCategories: { W: true, K: true, ERA: true, WHIP: true, SV: true, HLD: true }
      },
      status: 'setup' as const,
      setupStep: 1
    };

    const { status, body, duration } = await apiRequest('/api/leagues', {
      method: 'POST',
      body: JSON.stringify(leagueData)
    });

    const responseBody = body as {
      league?: {
        id: string;
        settings: {
          leagueType: string;
          dynastySettings?: object;
        };
      };
      error?: string;
    };

    if (status === 201 && responseBody.league?.id) {
      // Clean up the dynasty league (we're just testing creation)
      await apiRequest(`/api/leagues/${responseBody.league.id}`, {
        method: 'DELETE'
      });

      return {
        name: 'Create Dynasty League',
        status: 'PASS',
        duration,
        details: 'Dynasty league created successfully with dynasty settings',
        response: { status, body }
      };
    }

    return {
      name: 'Create Dynasty League',
      status: 'FAIL',
      duration,
      details: `Dynasty league creation failed: ${responseBody.error || 'Unknown error'}`,
      response: { status, body },
      issues: [`Expected 201 with dynasty league, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Create Dynasty League',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Dynasty league creation failed']
    };
  }
}

// =============================================================================
// League Read Tests
// =============================================================================

async function testGetSingleLeague(): Promise<TestResult> {
  const startTime = Date.now();

  if (!createdLeagueId) {
    return {
      name: 'Get Single League',
      status: 'SKIP',
      duration: 0,
      details: 'No league created to fetch',
      issues: ['Depends on Create League test']
    };
  }

  try {
    const { status, body, duration } = await apiRequest(`/api/leagues/${createdLeagueId}`, {
      method: 'GET'
    });

    const responseBody = body as {
      league?: {
        id: string;
        leagueName: string;
        settings: object;
      };
      error?: string;
    };

    if (status === 200 && responseBody.league?.id === createdLeagueId) {
      return {
        name: 'Get Single League',
        status: 'PASS',
        duration,
        details: `Retrieved league: ${responseBody.league.leagueName}`,
        response: { status, body }
      };
    }

    return {
      name: 'Get Single League',
      status: 'FAIL',
      duration,
      details: 'Failed to retrieve league',
      response: { status, body },
      issues: [`Expected 200 with league, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Get Single League',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testGetNonExistentLeague(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/leagues/non-existent-id-12345', {
      method: 'GET'
    });

    if (status === 404) {
      return {
        name: 'Get Non-Existent League',
        status: 'PASS',
        duration,
        details: 'Correctly returns 404 for non-existent league',
        response: { status, body }
      };
    }

    return {
      name: 'Get Non-Existent League',
      status: 'FAIL',
      duration,
      details: 'Should return 404 for non-existent league',
      response: { status, body },
      issues: [`Expected 404, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Get Non-Existent League',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

// =============================================================================
// League Update Tests
// =============================================================================

async function testUpdateLeague(): Promise<TestResult> {
  const startTime = Date.now();

  if (!createdLeagueId) {
    return {
      name: 'Update League',
      status: 'SKIP',
      duration: 0,
      details: 'No league created to update',
      issues: ['Depends on Create League test']
    };
  }

  try {
    const updatedData = {
      leagueName: `Updated League ${Date.now()}`,
      settings: {
        leagueName: `Updated League ${Date.now()}`,
        couchManagerRoomId: '12345',
        numTeams: 10, // Changed from 12
        budgetPerTeam: 300, // Changed from 260
        rosterSpots: {
          C: 2, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 4,
          CI: 0, MI: 0, UTIL: 2, SP: 6, RP: 2, P: 0, Bench: 4
        },
        leagueType: 'redraft' as const,
        scoringType: 'h2h-categories' as const, // Changed from rotisserie
        projectionSystem: 'steamer' as const,
        hittingCategories: { R: true, HR: true, RBI: true, SB: true, AVG: true, OBP: true },
        pitchingCategories: { W: true, K: true, ERA: true, WHIP: true, SV: true, HLD: true }
      },
      status: 'drafting' as const
    };

    const { status, body, duration } = await apiRequest(`/api/leagues/${createdLeagueId}`, {
      method: 'PUT',
      body: JSON.stringify(updatedData)
    });

    const responseBody = body as {
      league?: {
        id: string;
        settings: {
          numTeams: number;
          budgetPerTeam: number;
          scoringType: string;
          couchManagerRoomId: string;
        };
        status: string;
      };
      error?: string;
    };

    if (status === 200 && responseBody.league) {
      const league = responseBody.league;
      const issues: string[] = [];

      if (league.settings.numTeams !== 10) issues.push('numTeams not updated');
      if (league.settings.budgetPerTeam !== 300) issues.push('budgetPerTeam not updated');
      if (league.settings.scoringType !== 'h2h-categories') issues.push('scoringType not updated');
      if (league.status !== 'drafting') issues.push('status not updated');
      if (league.settings.couchManagerRoomId !== '12345') issues.push('couchManagerRoomId not updated');

      if (issues.length === 0) {
        return {
          name: 'Update League',
          status: 'PASS',
          duration,
          details: 'League updated successfully with all fields',
          response: { status, body }
        };
      }

      return {
        name: 'Update League',
        status: 'FAIL',
        duration,
        details: 'Some fields not updated correctly',
        response: { status, body },
        issues
      };
    }

    return {
      name: 'Update League',
      status: 'FAIL',
      duration,
      details: `Update failed: ${responseBody.error || 'Unknown error'}`,
      response: { status, body },
      issues: [`Expected 200 with updated league, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Update League',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Update request failed']
    };
  }
}

// =============================================================================
// Draft State Persistence Tests
// =============================================================================

async function testGetDraftStateEmpty(): Promise<TestResult> {
  const startTime = Date.now();

  if (!createdLeagueId) {
    return {
      name: 'Get Draft State (Empty)',
      status: 'SKIP',
      duration: 0,
      details: 'No league created',
      issues: ['Depends on Create League test']
    };
  }

  try {
    const { status, body, duration } = await apiRequest(`/api/leagues/${createdLeagueId}/draft-state`, {
      method: 'GET'
    });

    const responseBody = body as {
      leagueId: string;
      players: unknown[];
      lastModified: string;
    };

    if (status === 200 && Array.isArray(responseBody.players) && responseBody.players.length === 0) {
      return {
        name: 'Get Draft State (Empty)',
        status: 'PASS',
        duration,
        details: 'Draft state is empty for new league',
        response: { status, body }
      };
    }

    return {
      name: 'Get Draft State (Empty)',
      status: 'FAIL',
      duration,
      details: 'Unexpected draft state format',
      response: { status, body },
      issues: [`Expected empty players array, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Get Draft State (Empty)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testSaveDraftState(): Promise<TestResult> {
  const startTime = Date.now();

  if (!createdLeagueId) {
    return {
      name: 'Save Draft State',
      status: 'SKIP',
      duration: 0,
      details: 'No league created',
      issues: ['Depends on Create League test']
    };
  }

  try {
    const draftState = {
      players: [
        { id: 'player-1', name: 'Aaron Judge', status: 'drafted', draftedPrice: 52, draftedBy: 'Team A' },
        { id: 'player-2', name: 'Shohei Ohtani', status: 'onMyTeam', draftedPrice: 65, draftedBy: 'My Team' },
        { id: 'player-3', name: 'Ronald Acuna Jr', status: 'drafted', draftedPrice: 55, draftedBy: 'Team B' }
      ]
    };

    const { status, body, duration } = await apiRequest(`/api/leagues/${createdLeagueId}/draft-state`, {
      method: 'PUT',
      body: JSON.stringify(draftState)
    });

    const responseBody = body as {
      success: boolean;
      savedCount: number;
      lastModified: string;
    };

    if (status === 200 && responseBody.success && responseBody.savedCount === 3) {
      return {
        name: 'Save Draft State',
        status: 'PASS',
        duration,
        details: `Saved ${responseBody.savedCount} drafted players`,
        response: { status, body }
      };
    }

    return {
      name: 'Save Draft State',
      status: 'FAIL',
      duration,
      details: 'Draft state save failed',
      response: { status, body },
      issues: [`Expected 200 with success, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Save Draft State',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Save request failed']
    };
  }
}

async function testGetDraftStateAfterSave(): Promise<TestResult> {
  const startTime = Date.now();

  if (!createdLeagueId) {
    return {
      name: 'Get Draft State (After Save)',
      status: 'SKIP',
      duration: 0,
      details: 'No league created',
      issues: ['Depends on Create League test']
    };
  }

  try {
    const { status, body, duration } = await apiRequest(`/api/leagues/${createdLeagueId}/draft-state`, {
      method: 'GET'
    });

    const responseBody = body as {
      leagueId: string;
      players: Array<{
        id: string;
        name: string;
        status: string;
        draftedPrice?: number;
        draftedBy?: string;
      }>;
      lastModified: string;
    };

    if (status === 200 && responseBody.players.length === 3) {
      // Verify player data
      const judge = responseBody.players.find(p => p.name === 'Aaron Judge');
      const ohtani = responseBody.players.find(p => p.name === 'Shohei Ohtani');

      if (judge && judge.draftedPrice === 52 && ohtani && ohtani.status === 'onMyTeam') {
        return {
          name: 'Get Draft State (After Save)',
          status: 'PASS',
          duration,
          details: 'Draft state persisted correctly with all player data',
          response: { status, body }
        };
      }
    }

    return {
      name: 'Get Draft State (After Save)',
      status: 'FAIL',
      duration,
      details: 'Draft state not persisted correctly',
      response: { status, body },
      issues: ['Player data mismatch']
    };
  } catch (error) {
    return {
      name: 'Get Draft State (After Save)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testDraftStateValidation(): Promise<TestResult> {
  const startTime = Date.now();

  if (!createdLeagueId) {
    return {
      name: 'Draft State Validation',
      status: 'SKIP',
      duration: 0,
      details: 'No league created',
      issues: ['Depends on Create League test']
    };
  }

  const issues: string[] = [];

  try {
    // Test invalid player status
    const invalidStatusResult = await apiRequest(`/api/leagues/${createdLeagueId}/draft-state`, {
      method: 'PUT',
      body: JSON.stringify({
        players: [
          { id: 'player-1', name: 'Test Player', status: 'invalid-status' }
        ]
      })
    });

    if (invalidStatusResult.status !== 400) {
      issues.push(`Expected 400 for invalid status, got ${invalidStatusResult.status}`);
    }

    // Test missing required fields
    const missingFieldsResult = await apiRequest(`/api/leagues/${createdLeagueId}/draft-state`, {
      method: 'PUT',
      body: JSON.stringify({
        players: [
          { id: 'player-1' } // Missing name and status
        ]
      })
    });

    if (missingFieldsResult.status !== 400) {
      issues.push(`Expected 400 for missing fields, got ${missingFieldsResult.status}`);
    }

    const duration = Date.now() - startTime;

    if (issues.length === 0) {
      return {
        name: 'Draft State Validation',
        status: 'PASS',
        duration,
        details: 'Draft state validation working correctly'
      };
    }

    return {
      name: 'Draft State Validation',
      status: 'FAIL',
      duration,
      details: 'Some validation tests failed',
      issues
    };
  } catch (error) {
    return {
      name: 'Draft State Validation',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Validation test failed']
    };
  }
}

// =============================================================================
// League Delete Tests
// =============================================================================

async function testDeleteNonExistentLeague(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { status, body, duration } = await apiRequest('/api/leagues/non-existent-id-12345', {
      method: 'DELETE'
    });

    if (status === 404) {
      return {
        name: 'Delete Non-Existent League',
        status: 'PASS',
        duration,
        details: 'Correctly returns 404 for non-existent league',
        response: { status, body }
      };
    }

    return {
      name: 'Delete Non-Existent League',
      status: 'FAIL',
      duration,
      details: 'Should return 404 for non-existent league',
      response: { status, body },
      issues: [`Expected 404, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Delete Non-Existent League',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Request failed']
    };
  }
}

async function testDeleteLeague(): Promise<TestResult> {
  const startTime = Date.now();

  if (!createdLeagueId) {
    return {
      name: 'Delete League',
      status: 'SKIP',
      duration: 0,
      details: 'No league created to delete',
      issues: ['Depends on Create League test']
    };
  }

  try {
    const { status, body, duration } = await apiRequest(`/api/leagues/${createdLeagueId}`, {
      method: 'DELETE'
    });

    const responseBody = body as { success?: boolean; error?: string };

    if (status === 200 && responseBody.success) {
      // Verify league is actually deleted
      const verifyResult = await apiRequest(`/api/leagues/${createdLeagueId}`, {
        method: 'GET'
      });

      if (verifyResult.status === 404) {
        return {
          name: 'Delete League',
          status: 'PASS',
          duration,
          details: 'League deleted successfully and verified',
          response: { status, body }
        };
      }

      return {
        name: 'Delete League',
        status: 'FAIL',
        duration,
        details: 'League still accessible after delete',
        response: { status, body },
        issues: ['League not actually deleted']
      };
    }

    return {
      name: 'Delete League',
      status: 'FAIL',
      duration,
      details: `Delete failed: ${responseBody.error || 'Unknown error'}`,
      response: { status, body },
      issues: [`Expected 200 with success, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Delete League',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Delete request failed']
    };
  }
}

// =============================================================================
// Cleanup
// =============================================================================

async function cleanupTestUser(): Promise<TestResult> {
  const startTime = Date.now();

  if (!refreshToken) {
    return {
      name: 'Cleanup (Logout)',
      status: 'SKIP',
      duration: 0,
      details: 'No active session to logout',
      issues: ['No refresh token available']
    };
  }

  try {
    const { status, body, duration } = await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });

    const responseBody = body as { success?: boolean };

    if (status === 200 && responseBody.success) {
      accessToken = null;
      refreshToken = null;

      return {
        name: 'Cleanup (Logout)',
        status: 'PASS',
        duration,
        details: 'Test user logged out successfully',
        response: { status, body }
      };
    }

    return {
      name: 'Cleanup (Logout)',
      status: 'FAIL',
      duration,
      details: 'Logout failed',
      response: { status, body },
      issues: [`Expected 200 with success, got ${status}`]
    };
  } catch (error) {
    return {
      name: 'Cleanup (Logout)',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      issues: ['Logout request failed']
    };
  }
}

// =============================================================================
// Main Test Runner
// =============================================================================

async function runTests(): Promise<TestReport> {
  console.log('========================================');
  console.log('Leagues Flow E2E Test Suite');
  console.log('========================================');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('========================================\n');

  const results: TestResult[] = [];
  const recommendations: string[] = [];

  // Setup
  console.log('--- Setup ---');
  const setupResult = await setupTestUser();
  results.push(setupResult);
  console.log(`[${setupResult.status}] ${setupResult.name}: ${setupResult.details}`);

  if (setupResult.status === 'FAIL') {
    console.log('\nSetup failed. Aborting tests.');
    return generateReport(results, recommendations);
  }

  // Authentication Tests
  console.log('\n--- Authentication Tests ---');

  const noAuthResult = await testGetLeaguesWithoutAuth();
  results.push(noAuthResult);
  console.log(`[${noAuthResult.status}] ${noAuthResult.name}: ${noAuthResult.details}`);

  // League List Tests
  console.log('\n--- League List Tests ---');

  const emptyListResult = await testGetLeaguesEmpty();
  results.push(emptyListResult);
  console.log(`[${emptyListResult.status}] ${emptyListResult.name}: ${emptyListResult.details}`);

  // League Creation Tests
  console.log('\n--- League Creation Tests ---');

  const validationResult = await testCreateLeagueValidation();
  results.push(validationResult);
  console.log(`[${validationResult.status}] ${validationResult.name}: ${validationResult.details}`);

  const createResult = await testCreateLeague();
  results.push(createResult);
  console.log(`[${createResult.status}] ${createResult.name}: ${createResult.details}`);

  const dynastyResult = await testCreateDynastyLeague();
  results.push(dynastyResult);
  console.log(`[${dynastyResult.status}] ${dynastyResult.name}: ${dynastyResult.details}`);

  // League Read Tests
  console.log('\n--- League Read Tests ---');

  const getSingleResult = await testGetSingleLeague();
  results.push(getSingleResult);
  console.log(`[${getSingleResult.status}] ${getSingleResult.name}: ${getSingleResult.details}`);

  const getNonExistentResult = await testGetNonExistentLeague();
  results.push(getNonExistentResult);
  console.log(`[${getNonExistentResult.status}] ${getNonExistentResult.name}: ${getNonExistentResult.details}`);

  // League Update Tests
  console.log('\n--- League Update Tests ---');

  const updateResult = await testUpdateLeague();
  results.push(updateResult);
  console.log(`[${updateResult.status}] ${updateResult.name}: ${updateResult.details}`);

  // Draft State Tests
  console.log('\n--- Draft State Persistence Tests ---');

  const draftStateEmptyResult = await testGetDraftStateEmpty();
  results.push(draftStateEmptyResult);
  console.log(`[${draftStateEmptyResult.status}] ${draftStateEmptyResult.name}: ${draftStateEmptyResult.details}`);

  const saveDraftStateResult = await testSaveDraftState();
  results.push(saveDraftStateResult);
  console.log(`[${saveDraftStateResult.status}] ${saveDraftStateResult.name}: ${saveDraftStateResult.details}`);

  const getDraftStateAfterSaveResult = await testGetDraftStateAfterSave();
  results.push(getDraftStateAfterSaveResult);
  console.log(`[${getDraftStateAfterSaveResult.status}] ${getDraftStateAfterSaveResult.name}: ${getDraftStateAfterSaveResult.details}`);

  const draftStateValidationResult = await testDraftStateValidation();
  results.push(draftStateValidationResult);
  console.log(`[${draftStateValidationResult.status}] ${draftStateValidationResult.name}: ${draftStateValidationResult.details}`);

  // League Delete Tests
  console.log('\n--- League Delete Tests ---');

  const deleteNonExistentResult = await testDeleteNonExistentLeague();
  results.push(deleteNonExistentResult);
  console.log(`[${deleteNonExistentResult.status}] ${deleteNonExistentResult.name}: ${deleteNonExistentResult.details}`);

  const deleteResult = await testDeleteLeague();
  results.push(deleteResult);
  console.log(`[${deleteResult.status}] ${deleteResult.name}: ${deleteResult.details}`);

  // Cleanup
  console.log('\n--- Cleanup ---');

  const cleanupResult = await cleanupTestUser();
  results.push(cleanupResult);
  console.log(`[${cleanupResult.status}] ${cleanupResult.name}: ${cleanupResult.details}`);

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

  return generateReport(results, recommendations);
}

function generateReport(results: TestResult[], recommendations: string[]): TestReport {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  const report: TestReport = {
    timestamp: new Date().toISOString(),
    environment: {
      backend: BACKEND_URL
    },
    summary: {
      total: results.length,
      passed,
      failed,
      skipped
    },
    tests: results,
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

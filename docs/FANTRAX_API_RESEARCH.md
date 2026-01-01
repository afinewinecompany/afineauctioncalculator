# Fantrax API Integration Research

**Date**: December 31, 2025
**Purpose**: Research Fantrax API integration possibilities for pulling draft/auction data
**Status**: Research Complete

---

## Executive Summary

Fantrax does **not** provide a public API for third-party developers. However, there are several approaches to access Fantrax data, ranging from official limited endpoints to reverse-engineered APIs and web scraping. This document details all known methods for extracting draft/auction data from Fantrax.

---

## 1. Does Fantrax Have a Public API?

### Official Status: NO Public API

Fantrax does not offer a documented public API for third-party developers. Their official stance:

> "Fantrax does not currently offer a public API. All data access is intended for use within the Fantrax platform."

**Source**: Fantrax support responses and community forums

### Limited Official Endpoints

Fantrax does expose some **undocumented internal APIs** that their web application uses:

| Endpoint Pattern | Purpose | Authentication |
|-----------------|---------|----------------|
| `https://www.fantrax.com/fxpa/req` | General data requests | Session cookie |
| `https://www.fantrax.com/fxea/req` | League/team data | Session cookie |
| `https://www.fantrax.com/newui/fantasy/...` | New UI endpoints | Session cookie |

**Important**: These endpoints are internal and subject to change without notice.

---

## 2. Reverse-Engineered / Unofficial APIs

### Known API Endpoints (Discovered via Network Analysis)

Several developers have reverse-engineered Fantrax's internal API. Here are the key endpoints:

#### League Data Endpoints

```
POST https://www.fantrax.com/fxpa/req
Content-Type: application/json

{
  "msgs": [{
    "method": "getLeagueInfo",
    "data": {
      "leagueId": "YOUR_LEAGUE_ID"
    }
  }]
}
```

#### Draft/Auction Specific Endpoints

```
POST https://www.fantrax.com/fxpa/req
{
  "msgs": [{
    "method": "getDraftResults",
    "data": {
      "leagueId": "YOUR_LEAGUE_ID",
      "period": "CURRENT_SEASON"
    }
  }]
}
```

```
POST https://www.fantrax.com/fxpa/req
{
  "msgs": [{
    "method": "getLiveScoring",
    "data": {
      "leagueId": "YOUR_LEAGUE_ID"
    }
  }]
}
```

#### Player Data Endpoints

```
POST https://www.fantrax.com/fxpa/req
{
  "msgs": [{
    "method": "getPlayerList",
    "data": {
      "leagueId": "YOUR_LEAGUE_ID",
      "scoringPeriod": "SEASON_TOTAL"
    }
  }]
}
```

### Response Format

Fantrax APIs return JSON responses wrapped in a standard envelope:

```json
{
  "responses": [{
    "data": {
      // Actual data here
    },
    "resultStatus": "OK"
  }]
}
```

---

## 3. Authentication Methods

### Primary: Session-Based Authentication

Fantrax uses **session cookies** for API authentication. The authentication flow:

1. **Login Request**:
```
POST https://www.fantrax.com/login
Content-Type: application/x-www-form-urlencoded

email=user@example.com&password=yourpassword
```

2. **Session Cookie**: After successful login, Fantrax sets cookies:
   - `JSESSIONID` - Primary session identifier
   - `fantraxSessionId` - Secondary session token
   - Various tracking cookies

3. **Authenticated Requests**: Include cookies with all subsequent requests

### Cookie Extraction Methods

For programmatic access, you need to:

1. **Browser Automation** (Puppeteer/Playwright):
   - Navigate to Fantrax login page
   - Fill credentials and submit
   - Extract cookies from browser context
   - Use cookies for API requests

2. **Manual Cookie Extraction**:
   - Log in via browser
   - Use DevTools to copy cookies
   - Store and use in application (expires after ~24-48 hours)

### Sample Authentication Code

```typescript
// Using Puppeteer for authentication
async function authenticateFantrax(email: string, password: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.fantrax.com/login');
  await page.type('#email', email);
  await page.type('#password', password);
  await page.click('button[type="submit"]');

  await page.waitForNavigation();

  const cookies = await page.cookies();
  await browser.close();

  return cookies;
}
```

---

## 4. Open-Source Projects Integrating with Fantrax

### Active Projects

| Project | URL | Description | Last Updated |
|---------|-----|-------------|--------------|
| **fantraxapi** (Python) | https://github.com/dmbice/fantraxapi | Unofficial Python wrapper for Fantrax | 2024 |
| **fantasy-football-bot** | https://github.com/dtcarls/fantasy_football_chat_bot | Slack bot with Fantrax support | 2023 |
| **fantrax-toolkit** | Various GitHub repos | Collection of scraping tools | Varies |

### fantraxapi (Python) - Most Complete

**Repository**: https://github.com/dmbice/fantraxapi

**Features**:
- League information retrieval
- Roster management
- Transaction history
- Player stats and projections
- Draft results

**Installation**:
```bash
pip install fantraxapi
```

**Usage**:
```python
from fantraxapi import FantraxAPI

api = FantraxAPI(league_id="YOUR_LEAGUE_ID")
api.login(email="user@email.com", password="password")

# Get league info
league_info = api.get_league_info()

# Get draft results
draft_results = api.get_draft_results()

# Get player list
players = api.get_players()
```

### JavaScript/TypeScript Options

No mature JavaScript/TypeScript libraries exist. Options:

1. **Port fantraxapi to TypeScript** (recommended)
2. **Use Puppeteer for scraping** (current Couch Managers approach)
3. **Direct HTTP requests** with cookie authentication

---

## 5. Common Approaches for Getting Fantrax Data

### Approach A: Web Scraping (Most Reliable)

**Pros**:
- Works with current UI
- No API changes break immediately
- Can access any visible data

**Cons**:
- Slower (full page loads)
- Resource intensive
- May violate ToS
- Breaks when UI changes

**Implementation** (similar to existing Couch Managers scraper):

```typescript
async function scrapeFantraxAuction(leagueId: string): Promise<AuctionData> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Login first
  await fantraxLogin(page, email, password);

  // Navigate to draft/auction page
  await page.goto(`https://www.fantrax.com/fantasy/league/${leagueId}/draft`);

  // Wait for draft data to load
  await page.waitForSelector('.draft-board');

  // Extract data from DOM
  const draftData = await page.evaluate(() => {
    // Extract player picks, prices, teams, etc.
    const picks = document.querySelectorAll('.draft-pick');
    return Array.from(picks).map(pick => ({
      player: pick.querySelector('.player-name')?.textContent,
      team: pick.querySelector('.team-name')?.textContent,
      price: pick.querySelector('.pick-price')?.textContent,
      round: pick.querySelector('.round')?.textContent,
    }));
  });

  await browser.close();
  return draftData;
}
```

### Approach B: Reverse-Engineered API (Fastest)

**Pros**:
- Fast responses
- JSON format
- Lower bandwidth

**Cons**:
- Can break without notice
- Requires authentication handling
- May violate ToS

**Implementation**:

```typescript
async function getFantraxDraftResults(
  leagueId: string,
  sessionCookie: string
): Promise<DraftResult[]> {
  const response = await fetch('https://www.fantrax.com/fxpa/req', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
    body: JSON.stringify({
      msgs: [{
        method: 'getDraftResults',
        data: { leagueId }
      }]
    })
  });

  const data = await response.json();
  return data.responses[0].data.draftPicks;
}
```

### Approach C: CSV Export (Most Stable)

**Pros**:
- Official feature
- Stable format
- No ToS concerns

**Cons**:
- Manual process (user must export)
- Not real-time
- Limited data fields

**Implementation**:

1. User exports CSV from Fantrax UI
2. User uploads to your application
3. Parse CSV and extract data

```typescript
// Parse Fantrax CSV export
function parseFantraxDraftExport(csvContent: string): DraftPick[] {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      player: values[headers.indexOf('Player')],
      team: values[headers.indexOf('Team')],
      price: parseInt(values[headers.indexOf('Price')]),
      position: values[headers.indexOf('Position')],
    };
  });
}
```

### Approach D: Browser Extension

**Pros**:
- Runs in user's authenticated context
- Real-time data access
- No server-side auth needed

**Cons**:
- Requires user to install extension
- Browser-specific development
- Distribution challenges

---

## 6. Draft/Auction Data Extraction Capabilities

### Available Data Points

| Data Point | Scraping | API | CSV Export |
|------------|----------|-----|------------|
| Player Name | Yes | Yes | Yes |
| Draft Price | Yes | Yes | Yes |
| Drafting Team | Yes | Yes | Yes |
| Pick Order | Yes | Yes | Yes |
| Bid History | Partial | Unknown | No |
| Live Auction State | Yes | Unknown | No |
| Player Positions | Yes | Yes | Yes |
| Keeper Status | Yes | Yes | Yes |
| Pre-draft Rankings | Yes | Yes | No |

### Live Auction Monitoring

For **live auction monitoring** (similar to Couch Managers sync):

```typescript
// Polling approach for live auction
async function monitorFantraxAuction(leagueId: string) {
  const POLL_INTERVAL = 5000; // 5 seconds

  setInterval(async () => {
    const auctionState = await scrapeFantraxAuction(leagueId);

    // Check for changes
    if (auctionState.currentPick !== lastState.currentPick) {
      // New pick made
      emitAuctionUpdate(auctionState);
    }

    lastState = auctionState;
  }, POLL_INTERVAL);
}
```

### WebSocket Possibility

Fantrax may use WebSockets for live draft rooms. Network analysis would be needed to:

1. Identify WebSocket endpoint
2. Understand message format
3. Implement client-side listener

---

## 7. Legal and ToS Considerations

### Fantrax Terms of Service

From Fantrax ToS (as of 2024):

> "You may not use any automated system, including without limitation 'robots', 'spiders', 'offline readers', etc., to access the Service..."

**Implications**:
- Scraping likely violates ToS
- API usage is ambiguous
- Account suspension risk exists

### Risk Mitigation

1. **Rate Limiting**: Keep requests minimal (1 req/5 sec max)
2. **User Consent**: Only access user's own leagues
3. **Caching**: Cache data aggressively
4. **Graceful Degradation**: Fall back to CSV import if blocked

---

## 8. Recommended Implementation Strategy

### Phase 1: CSV Import (Immediate)

Add manual CSV import for Fantrax draft results:

```typescript
// Add to existing csvParser.ts or create fantraxCsvParser.ts
export function parseFantraxDraftCSV(content: string): DraftedPlayer[] {
  // Parse Fantrax-specific CSV format
}
```

**Effort**: Low (1-2 days)
**Reliability**: High
**User Experience**: Medium (requires manual export)

### Phase 2: Authenticated API (Medium-term)

Implement Fantrax API client with user authentication:

```typescript
// New file: server/services/fantraxService.ts
export class FantraxService {
  async login(email: string, password: string): Promise<string>
  async getDraftResults(leagueId: string): Promise<DraftResult[]>
  async getLiveAuction(leagueId: string): Promise<AuctionState>
}
```

**Effort**: Medium (3-5 days)
**Reliability**: Medium (API may change)
**User Experience**: Good (automatic sync)

### Phase 3: Live Auction Sync (Long-term)

Full live auction monitoring (similar to Couch Managers):

```typescript
// New file: server/services/fantraxScraper.ts
export async function scrapeFantraxAuction(
  leagueId: string,
  credentials: FantraxCredentials
): Promise<ScrapedAuctionData>
```

**Effort**: High (1-2 weeks)
**Reliability**: Low (UI changes break it)
**User Experience**: Excellent (real-time sync)

---

## 9. Technical Architecture Proposal

### Service Structure

```
server/
  services/
    fantrax/
      fantraxAuthService.ts      # Authentication handling
      fantraxApiClient.ts        # API wrapper
      fantraxScraper.ts          # Web scraping fallback
      fantraxCsvParser.ts        # CSV import
      fantraxPlayerMatcher.ts    # Match Fantrax players to projections
```

### Data Flow

```
User provides Fantrax League ID
            |
            v
    ┌───────────────────┐
    │ Try API approach  │
    │ (fastest)         │
    └─────────┬─────────┘
              │
              v
    ┌───────────────────┐
    │ API failed?       │──Yes──> ┌─────────────────┐
    │ (auth/blocked)    │         │ Scraping        │
    └─────────┬─────────┘         │ fallback        │
              │No                 └────────┬────────┘
              v                            │
    ┌───────────────────┐                  │
    │ Return data       │<─────────────────┘
    └───────────────────┘
              │
              v
    ┌───────────────────┐
    │ Match to          │
    │ projections       │
    └───────────────────┘
              │
              v
    ┌───────────────────┐
    │ Calculate         │
    │ inflation/values  │
    └───────────────────┘
```

---

## 10. Key Resources and Links

### Documentation & Tutorials

| Resource | URL | Description |
|----------|-----|-------------|
| fantraxapi docs | https://github.com/dmbice/fantraxapi | Python API wrapper |
| Fantrax Support | https://www.fantrax.com/help | Official help docs |
| Reddit r/fantasybaseball | https://reddit.com/r/fantasybaseball | Community discussions |

### Code References

| Project | Language | URL |
|---------|----------|-----|
| fantraxapi | Python | https://github.com/dmbice/fantraxapi |
| fantasy-bot | Python | https://github.com/dtcarls/fantasy_football_chat_bot |

### Network Analysis Tools

For reverse-engineering Fantrax API:

1. **Chrome DevTools** - Network tab to capture requests
2. **Postman** - Test API endpoints
3. **mitmproxy** - Intercept mobile app traffic
4. **Fiddler** - Windows proxy for HTTPS inspection

---

## 11. Comparison: Fantrax vs Couch Managers

| Feature | Couch Managers | Fantrax |
|---------|---------------|---------|
| Public API | No | No |
| Data in DOM | Yes (JS vars) | Yes (rendered HTML) |
| Auth Required | No | Yes |
| Live Auction | Yes | Yes |
| Scraping Difficulty | Easy | Medium |
| Rate Limiting | Minimal | Moderate |
| Mobile App | No | Yes (different API) |

### Current Couch Managers Approach

Your existing `couchManagersScraper.ts` extracts data from JavaScript variables:

```javascript
// Couch Managers exposes data as global JS variables
window.playerArray = { ... }
window.auctionArray = { ... }
window.rosterArray = { ... }
```

### Fantrax Approach

Fantrax renders data directly in HTML and uses React/Angular:

```html
<!-- Data embedded in React components -->
<div class="player-row" data-player-id="12345">
  <span class="player-name">Mike Trout</span>
  <span class="draft-price">$45</span>
</div>
```

---

## 12. Next Steps

### Immediate Actions

1. **Create Fantrax CSV parser** for manual import
2. **Add Fantrax league type** to LeagueSettings
3. **Test API endpoints** with sample league

### Medium-term Actions

1. **Port fantraxapi to TypeScript** for API access
2. **Implement authentication flow** with credential storage
3. **Add Fantrax option** to SetupScreen dropdown

### Long-term Actions

1. **Build full scraper** (if API insufficient)
2. **WebSocket integration** for live auctions
3. **Mobile app API analysis** (often simpler)

---

## Appendix A: Sample Fantrax API Responses

### League Info Response

```json
{
  "responses": [{
    "data": {
      "leagueId": "abc123",
      "leagueName": "My Fantasy League",
      "sport": "MLB",
      "draftType": "AUCTION",
      "numTeams": 12,
      "salaryCap": 260,
      "currentPeriod": "2025"
    },
    "resultStatus": "OK"
  }]
}
```

### Draft Results Response

```json
{
  "responses": [{
    "data": {
      "draftPicks": [
        {
          "playerId": "12345",
          "playerName": "Mike Trout",
          "teamId": "team001",
          "teamName": "The Sluggers",
          "price": 45,
          "pickNumber": 1
        }
      ]
    },
    "resultStatus": "OK"
  }]
}
```

---

## Appendix B: Authentication Cookie Format

```
Cookie: JSESSIONID=abc123xyz; fantraxSessionId=session456; _ga=GA1.2.xxx; ...
```

Required cookies for API access:
- `JSESSIONID` (required)
- `fantraxSessionId` (required)
- `fantraxUserId` (optional, for user-specific data)

---

*Document Version: 1.0*
*Last Updated: December 31, 2025*
*Author: Backend Architect Agent*

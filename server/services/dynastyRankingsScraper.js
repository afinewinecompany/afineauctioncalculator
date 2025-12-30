/**
 * Dynasty Rankings Scraper Service
 * Fetches crowd-sourced dynasty rankings from Harry Knows Ball
 *
 * Data source: https://harryknowsball.com/rankings
 * The data is embedded as JSON in the page's __NEXT_DATA__ script tag
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import * as fs from 'fs';
import * as path from 'path';
var DYNASTY_RANKINGS_URL = 'https://harryknowsball.com/rankings';
var CACHE_DIR = path.join(process.cwd(), 'cache');
var CACHE_FILE = path.join(CACHE_DIR, 'dynasty-rankings.json');
var CACHE_TTL_HOURS = 12; // Rankings update daily, 12-hour cache is reasonable
/**
 * Fetch dynasty rankings with caching
 */
export function getDynastyRankings() {
    return __awaiter(this, void 0, void 0, function () {
        var cached, rankings;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cached = getCachedRankings();
                    if (cached) {
                        console.log('[Dynasty] Using cached rankings');
                        return [2 /*return*/, cached];
                    }
                    // Fetch fresh rankings
                    console.log('[Dynasty] Fetching fresh rankings from Harry Knows Ball');
                    return [4 /*yield*/, fetchDynastyRankings()];
                case 1:
                    rankings = _a.sent();
                    // Cache the results
                    cacheRankings(rankings);
                    return [2 /*return*/, rankings];
            }
        });
    });
}
/**
 * Check if we have valid cached rankings
 */
function getCachedRankings() {
    try {
        if (!fs.existsSync(CACHE_FILE)) {
            return null;
        }
        var cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
        var cache = JSON.parse(cacheContent);
        // Check if cache is expired
        var expiresAt = new Date(cache.metadata.expiresAt);
        if (expiresAt < new Date()) {
            console.log('[Dynasty] Cache expired');
            return null;
        }
        console.log("[Dynasty] Cache valid, ".concat(cache.rankings.length, " players"));
        return cache.rankings;
    }
    catch (error) {
        console.error('[Dynasty] Error reading cache:', error);
        return null;
    }
}
/**
 * Save rankings to cache
 */
function cacheRankings(rankings) {
    try {
        // Ensure cache directory exists
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        var now = new Date();
        var expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
        var cacheEntry = {
            metadata: {
                source: 'harryknowsball',
                fetchedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                playerCount: rankings.length,
            },
            rankings: rankings,
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheEntry, null, 2));
        console.log("[Dynasty] Cached ".concat(rankings.length, " rankings"));
    }
    catch (error) {
        console.error('[Dynasty] Error writing cache:', error);
    }
}
/**
 * Fetch dynasty rankings from Harry Knows Ball
 */
function fetchDynastyRankings() {
    return __awaiter(this, void 0, void 0, function () {
        var response, html, nextDataMatch, nextData, pageProps, rawPlayers, altPlayers, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch(DYNASTY_RANKINGS_URL, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            },
                        })];
                case 1:
                    response = _b.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [4 /*yield*/, response.text()];
                case 2:
                    html = _b.sent();
                    nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
                    if (!nextDataMatch || !nextDataMatch[1]) {
                        throw new Error('Could not find __NEXT_DATA__ in page');
                    }
                    nextData = JSON.parse(nextDataMatch[1]);
                    pageProps = (_a = nextData === null || nextData === void 0 ? void 0 : nextData.props) === null || _a === void 0 ? void 0 : _a.pageProps;
                    if (!pageProps) {
                        throw new Error('Could not find pageProps in __NEXT_DATA__');
                    }
                    rawPlayers = pageProps.players || pageProps.rankings || [];
                    if (!Array.isArray(rawPlayers) || rawPlayers.length === 0) {
                        console.warn('[Dynasty] No players found in page data, checking alternative paths...');
                        altPlayers = findPlayersInData(pageProps);
                        if (altPlayers.length === 0) {
                            throw new Error('Could not find players data in page');
                        }
                        return [2 /*return*/, normalizeRankings(altPlayers)];
                    }
                    return [2 /*return*/, normalizeRankings(rawPlayers)];
                case 3:
                    error_1 = _b.sent();
                    console.error('[Dynasty] Error fetching rankings:', error_1);
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Recursively search for players array in data structure
 */
function findPlayersInData(data, depth) {
    if (depth === void 0) { depth = 0; }
    if (depth > 5)
        return []; // Prevent infinite recursion
    if (Array.isArray(data) && data.length > 0) {
        // Check if this looks like a players array
        var first = data[0];
        if (first && typeof first === 'object' && ('name' in first || 'playerName' in first)) {
            return data;
        }
    }
    if (data && typeof data === 'object') {
        for (var _i = 0, _a = Object.values(data); _i < _a.length; _i++) {
            var value = _a[_i];
            var result = findPlayersInData(value, depth + 1);
            if (result.length > 0)
                return result;
        }
    }
    return [];
}
/**
 * Normalize raw player data to our DynastyRanking format
 */
function normalizeRankings(rawPlayers) {
    // Find min/max values for normalization
    var values = rawPlayers
        .map(function (p) { return p.value || p.dynastyValue || 0; })
        .filter(function (v) { return v > 0; });
    var minValue = Math.min.apply(Math, values);
    var maxValue = Math.max.apply(Math, values);
    var valueRange = maxValue - minValue || 1;
    return rawPlayers
        .map(function (player, index) {
        try {
            return normalizePlayer(player, index, minValue, valueRange);
        }
        catch (error) {
            console.warn("[Dynasty] Error normalizing player:", player === null || player === void 0 ? void 0 : player.name, error);
            return null;
        }
    })
        .filter(function (p) { return p !== null; });
}
/**
 * Normalize a single player to DynastyRanking format
 */
function normalizePlayer(player, fallbackRank, minValue, valueRange) {
    // Extract name
    var name = player.name || player.playerName || player.fullName || 'Unknown';
    // Extract team
    var team = player.team || player.mlbTeam || player.organization || '';
    // Extract positions
    var positions = [];
    if (Array.isArray(player.positions)) {
        positions = player.positions;
    }
    else if (typeof player.positions === 'string') {
        positions = player.positions.split(/[,\/]/).map(function (p) { return p.trim(); });
    }
    else if (player.position) {
        positions = [player.position];
    }
    else if (player.positionRanks && typeof player.positionRanks === 'object') {
        positions = Object.keys(player.positionRanks);
    }
    // Normalize positions to standard format
    positions = positions.map(normalizePosition).filter(Boolean);
    // Extract age
    var age = typeof player.age === 'number' ? player.age : null;
    // Determine level
    var level = determineLevel(player);
    // Extract rankings
    var overallRank = player.rank || player.overallRank || fallbackRank + 1;
    // Extract position rank (use first position's rank if available)
    var positionRank = overallRank;
    if (player.positionRanks && typeof player.positionRanks === 'object') {
        var firstPosRank = Object.values(player.positionRanks)[0];
        if (typeof firstPosRank === 'number') {
            positionRank = firstPosRank;
        }
    }
    // Extract dynasty value
    var dynastyValue = player.value || player.dynastyValue || 5000;
    // Normalize to 0-100 scale
    var normalizedValue = ((dynastyValue - minValue) / valueRange) * 100;
    // Extract trend data
    var trend = {
        rank7Day: player.rankChange7Days || player.rank7Day || 0,
        rank30Day: player.rankChange30Days || player.rank30Day || 0,
        value7Day: player.valueChange7Days || player.value7Day || 0,
        value30Day: player.valueChange30Days || player.value30Day || 0,
    };
    return {
        id: String(player.id || player.playerId || "dynasty-".concat(fallbackRank)),
        name: name,
        team: team,
        positions: positions,
        age: age,
        level: level,
        overallRank: overallRank,
        positionRank: positionRank,
        dynastyValue: dynastyValue,
        normalizedValue: normalizedValue,
        trend: trend,
    };
}
/**
 * Normalize position strings to standard format
 */
function normalizePosition(pos) {
    var normalized = pos.toUpperCase().trim();
    var positionMap = {
        'CATCHER': 'C',
        'FIRST': '1B',
        'FIRST BASE': '1B',
        'SECOND': '2B',
        'SECOND BASE': '2B',
        'THIRD': '3B',
        'THIRD BASE': '3B',
        'SHORTSTOP': 'SS',
        'SHORT': 'SS',
        'OUTFIELD': 'OF',
        'LEFT FIELD': 'OF',
        'CENTER FIELD': 'OF',
        'RIGHT FIELD': 'OF',
        'LF': 'OF',
        'CF': 'OF',
        'RF': 'OF',
        'DESIGNATED HITTER': 'UTIL',
        'DH': 'UTIL',
        'UTILITY': 'UTIL',
        'UT': 'UTIL',
        'STARTING PITCHER': 'SP',
        'STARTER': 'SP',
        'RELIEF PITCHER': 'RP',
        'RELIEVER': 'RP',
        'CLOSER': 'RP',
        'CL': 'RP',
        'PITCHER': 'P',
    };
    return positionMap[normalized] || normalized;
}
/**
 * Determine player's level (MLB, minors, etc.)
 */
function determineLevel(player) {
    var level = (player.level || player.mlbLevel || player.currentLevel || '').toUpperCase();
    if (level.includes('MLB') || level.includes('MAJORS') || level === 'ML') {
        return 'MLB';
    }
    if (level.includes('AAA') || level === 'TRIPLE-A') {
        return 'AAA';
    }
    if (level.includes('AA') || level === 'DOUBLE-A') {
        return 'AA';
    }
    if (level.includes('A+') || level === 'HIGH-A') {
        return 'A+';
    }
    if (level.includes('A') || level === 'LOW-A' || level === 'SINGLE-A') {
        return 'A';
    }
    // If no level specified but player has MLB team stats, assume MLB
    if (player.stats || player.projectedStats) {
        return 'MLB';
    }
    return 'other';
}
/**
 * Force refresh of dynasty rankings cache
 */
export function refreshDynastyRankings() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // Delete existing cache
            try {
                if (fs.existsSync(CACHE_FILE)) {
                    fs.unlinkSync(CACHE_FILE);
                }
            }
            catch (error) {
                console.error('[Dynasty] Error deleting cache:', error);
            }
            // Fetch fresh
            return [2 /*return*/, getDynastyRankings()];
        });
    });
}
/**
 * Get cache status for dynasty rankings
 */
export function getDynastyRankingsCacheStatus() {
    try {
        if (!fs.existsSync(CACHE_FILE)) {
            return { isCached: false, fetchedAt: null, expiresAt: null, playerCount: 0 };
        }
        var cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
        var cache = JSON.parse(cacheContent);
        return {
            isCached: true,
            fetchedAt: cache.metadata.fetchedAt,
            expiresAt: cache.metadata.expiresAt,
            playerCount: cache.metadata.playerCount,
        };
    }
    catch (error) {
        return { isCached: false, fetchedAt: null, expiresAt: null, playerCount: 0 };
    }
}
/**
 * Match dynasty rankings to projections by name
 * Returns a map of projection externalId -> DynastyRanking
 */
export function matchDynastyRankingsToProjections(rankings, projections) {
    var matchMap = new Map();
    // Create normalized name index for rankings
    var rankingsByNormalizedName = new Map();
    for (var _i = 0, rankings_1 = rankings; _i < rankings_1.length; _i++) {
        var ranking = rankings_1[_i];
        var normalizedName = normalizeName(ranking.name);
        rankingsByNormalizedName.set(normalizedName, ranking);
    }
    // Match projections to rankings
    for (var _a = 0, projections_1 = projections; _a < projections_1.length; _a++) {
        var projection = projections_1[_a];
        var normalizedName = normalizeName(projection.name);
        // Try exact match first
        var match = rankingsByNormalizedName.get(normalizedName);
        // Try without Jr/Sr/III suffixes
        if (!match) {
            var nameWithoutSuffix = normalizedName.replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '');
            match = rankingsByNormalizedName.get(nameWithoutSuffix);
        }
        // Try last name + first name prefix match (for name variations like "Mike" vs "Michael")
        // IMPORTANT: Require at least 3 characters of first name to match, not just initial
        // This prevents false matches like "Jesus Rodriguez" matching "Julio Rodriguez"
        if (!match) {
            var parts = normalizedName.split(' ');
            if (parts.length >= 2) {
                var lastName = parts[parts.length - 1];
                var firstName = parts[0];
                var firstNamePrefix = firstName.slice(0, 3); // At least 3 chars
                for (var _b = 0, rankingsByNormalizedName_1 = rankingsByNormalizedName; _b < rankingsByNormalizedName_1.length; _b++) {
                    var _c = rankingsByNormalizedName_1[_b], rankName = _c[0], ranking = _c[1];
                    var rankParts = rankName.split(' ');
                    if (rankParts.length >= 2) {
                        var rankLastName = rankParts[rankParts.length - 1];
                        var rankFirstName = rankParts[0];
                        // Require same last name AND first name starts with same 3+ characters
                        if (lastName === rankLastName &&
                            firstNamePrefix.length >= 3 &&
                            rankFirstName.startsWith(firstNamePrefix)) {
                            match = ranking;
                            break;
                        }
                    }
                }
            }
        }
        if (match) {
            matchMap.set(projection.externalId, match);
        }
    }
    console.log("[Dynasty] Matched ".concat(matchMap.size, "/").concat(projections.length, " projections to dynasty rankings"));
    return matchMap;
}
/**
 * Normalize player name for matching
 */
function normalizeName(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z\s]/g, '') // Remove non-alpha
        .replace(/\s+/g, ' ')
        .trim();
}

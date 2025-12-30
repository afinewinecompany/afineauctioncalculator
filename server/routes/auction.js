var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
import { Router } from 'express';
import { scrapeAuction, scrapeDraftedPlayers } from '../services/couchManagersScraper';
import { matchAllPlayers } from '../services/playerMatcher';
import { calculateInflationStats } from '../services/inflationCalculator';
import { getCachedProjections } from '../services/projectionsCacheService';
import { getDynastyRankings } from '../services/dynastyRankingsScraper';
import { calculateAuctionValues } from '../services/valueCalculator';
var router = Router();
var cache = new Map();
var CACHE_TTL = 30000; // 30 seconds for scrape cache
var SYNC_CACHE_TTL = 60000; // 60 seconds for full sync results (slightly longer)
// Lock map to prevent cache stampede (multiple concurrent scrapes for same room)
var scrapingLocks = new Map();
// Periodic cache cleanup to prevent memory leaks (runs every 5 minutes)
setInterval(function () {
    var now = Date.now();
    var cleaned = 0;
    for (var _i = 0, _a = cache.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], entry = _b[1];
        if (now - entry.timestamp > SYNC_CACHE_TTL * 2) {
            cache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log("[Cache] Cleaned up ".concat(cleaned, " expired entries"));
    }
}, 5 * 60 * 1000);
function getCached(key, ttl) {
    if (ttl === void 0) { ttl = CACHE_TTL; }
    var entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < ttl) {
        return entry.data;
    }
    return null;
}
function getCacheAge(key) {
    var entry = cache.get(key);
    if (!entry)
        return Infinity;
    return Date.now() - entry.timestamp;
}
function setCache(key, data) {
    cache.set(key, { data: data, timestamp: Date.now() });
}
/**
 * GET /api/auction/:roomId
 * Scrapes the full auction state from Couch Managers
 */
router.get('/:roomId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var roomId, cacheKey, cached, auctionData, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                roomId = req.params.roomId;
                if (!roomId || !/^\d+$/.test(roomId)) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Invalid room ID. Must be a numeric value.',
                        })];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                cacheKey = "auction-".concat(roomId);
                cached = getCached(cacheKey);
                if (cached) {
                    return [2 /*return*/, res.json(__assign(__assign({}, cached), { fromCache: true }))];
                }
                return [4 /*yield*/, scrapeAuction(roomId)];
            case 2:
                auctionData = _a.sent();
                if (auctionData.status === 'not_found') {
                    return [2 /*return*/, res.status(404).json({
                            error: "Auction room ".concat(roomId, " not found"),
                        })];
                }
                setCache(cacheKey, auctionData);
                res.json(auctionData);
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                console.error("Error fetching auction ".concat(roomId, ":"), error_1);
                res.status(503).json({
                    error: 'Failed to scrape auction data. The website may be unavailable.',
                });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/auction/:roomId/sync
 * Syncs auction data with player projections and calculates inflation.
 *
 * Body should contain:
 * - projections: Array of player projections from the client
 * - leagueConfig: { numTeams, budgetPerTeam, totalRosterSpots }
 */
router.post('/:roomId/sync', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var roomId, _a, projections, leagueConfig, auctionData, _b, matched, unmatched, inflationStats, result, error_2;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                roomId = req.params.roomId;
                _a = req.body, projections = _a.projections, leagueConfig = _a.leagueConfig;
                if (!roomId || !/^\d+$/.test(roomId)) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Invalid room ID. Must be a numeric value.',
                        })];
                }
                if (!projections || !Array.isArray(projections)) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Projections array is required in request body.',
                        })];
                }
                if (!leagueConfig || !leagueConfig.numTeams || !leagueConfig.budgetPerTeam) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'League config (numTeams, budgetPerTeam, totalRosterSpots) is required.',
                        })];
                }
                _c.label = 1;
            case 1:
                _c.trys.push([1, 3, , 4]);
                return [4 /*yield*/, scrapeAuction(roomId)];
            case 2:
                auctionData = _c.sent();
                if (auctionData.status === 'not_found') {
                    return [2 /*return*/, res.status(404).json({
                            error: "Auction room ".concat(roomId, " not found"),
                        })];
                }
                _b = matchAllPlayers(auctionData.players, projections), matched = _b.matched, unmatched = _b.unmatched;
                inflationStats = calculateInflationStats(matched, leagueConfig, auctionData.teams);
                result = {
                    auctionData: auctionData,
                    matchedPlayers: matched,
                    inflationStats: inflationStats,
                    unmatchedPlayers: unmatched,
                };
                res.json(result);
                return [3 /*break*/, 4];
            case 3:
                error_2 = _c.sent();
                console.error("Error syncing auction ".concat(roomId, ":"), error_2);
                res.status(503).json({
                    error: 'Failed to sync auction data.',
                });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/auction/:roomId/sync-lite
 * Lightweight sync that uses server-cached projections instead of client sending full player list.
 * Much smaller payload - only sends league config.
 *
 * Body should contain:
 * - projectionSystem: 'steamer' | 'batx' | 'ja'
 * - leagueConfig: { numTeams, budgetPerTeam, totalRosterSpots }
 */
router.post('/:roomId/sync-lite', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var roomId, _a, _b, projectionSystem, leagueConfig, syncCacheKey, cachedResult, cachedProjections, fetchSteamerProjections, fetchJAProjections, setCachedProjections, projections_1, _c, fetchError_1, defaultRosterSpots, rosterSpots, scoringType, leagueSettings, dynastyRankings, dynastyError_1, valuedResult, projections, scrapeCacheKey_1, auctionData, lockKey_1, scrapePromise, startTime_1, _d, matched, unmatched, inflationStats, result, error_3;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                roomId = req.params.roomId;
                _a = req.body, _b = _a.projectionSystem, projectionSystem = _b === void 0 ? 'steamer' : _b, leagueConfig = _a.leagueConfig;
                if (!roomId || !/^\d+$/.test(roomId)) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Invalid room ID. Must be a numeric value.',
                        })];
                }
                if (!leagueConfig || !leagueConfig.numTeams || !leagueConfig.budgetPerTeam) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'League config (numTeams, budgetPerTeam, totalRosterSpots) is required.',
                        })];
                }
                _e.label = 1;
            case 1:
                _e.trys.push([1, 24, , 25]);
                syncCacheKey = "sync-lite-".concat(roomId, "-").concat(projectionSystem);
                cachedResult = getCached(syncCacheKey, SYNC_CACHE_TTL);
                if (cachedResult) {
                    console.log("[sync-lite] Returning cached result for room ".concat(roomId, " (age: ").concat(Math.round(getCacheAge(syncCacheKey) / 1000), "s)"));
                    return [2 /*return*/, res.json(__assign(__assign({}, cachedResult), { fromCache: true }))];
                }
                return [4 /*yield*/, getCachedProjections(projectionSystem)];
            case 2:
                cachedProjections = _e.sent();
                if (!!cachedProjections) return [3 /*break*/, 16];
                console.log("[sync-lite] No cached projections for ".concat(projectionSystem, ", fetching fresh..."));
                _e.label = 3;
            case 3:
                _e.trys.push([3, 15, , 16]);
                return [4 /*yield*/, import('../services/projectionsService')];
            case 4:
                fetchSteamerProjections = (_e.sent()).fetchSteamerProjections;
                return [4 /*yield*/, import('../services/jaProjectionsService')];
            case 5:
                fetchJAProjections = (_e.sent()).fetchJAProjections;
                return [4 /*yield*/, import('../services/projectionsCacheService')];
            case 6:
                setCachedProjections = (_e.sent()).setCachedProjections;
                _c = projectionSystem;
                switch (_c) {
                    case 'steamer': return [3 /*break*/, 7];
                    case 'ja': return [3 /*break*/, 9];
                }
                return [3 /*break*/, 11];
            case 7: return [4 /*yield*/, fetchSteamerProjections()];
            case 8:
                projections_1 = _e.sent();
                return [3 /*break*/, 12];
            case 9: return [4 /*yield*/, fetchJAProjections()];
            case 10:
                projections_1 = _e.sent();
                return [3 /*break*/, 12];
            case 11: return [2 /*return*/, res.status(400).json({ error: "Unsupported projection system: ".concat(projectionSystem) })];
            case 12: return [4 /*yield*/, setCachedProjections(projectionSystem, projections_1)];
            case 13:
                _e.sent();
                return [4 /*yield*/, getCachedProjections(projectionSystem)];
            case 14:
                cachedProjections = _e.sent();
                console.log("[sync-lite] Successfully fetched and cached ".concat(projections_1.length, " projections"));
                return [3 /*break*/, 16];
            case 15:
                fetchError_1 = _e.sent();
                console.error("[sync-lite] Failed to fetch projections:", fetchError_1);
                return [2 /*return*/, res.status(503).json({
                        error: "Failed to fetch projections for ".concat(projectionSystem, ". Please try again."),
                    })];
            case 16:
                if (!cachedProjections) {
                    return [2 /*return*/, res.status(503).json({
                            error: "No projections available for ".concat(projectionSystem, "."),
                        })];
                }
                defaultRosterSpots = {
                    C: 2, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 5,
                    CI: 1, MI: 1, UTIL: 2, SP: 4, RP: 2, P: 1, Bench: 2
                };
                rosterSpots = leagueConfig.rosterSpots || defaultRosterSpots;
                scoringType = leagueConfig.scoringType || 'h2h-categories';
                leagueSettings = {
                    leagueName: 'Auction',
                    couchManagerRoomId: roomId,
                    numTeams: leagueConfig.numTeams,
                    budgetPerTeam: leagueConfig.budgetPerTeam,
                    rosterSpots: rosterSpots,
                    leagueType: leagueConfig.leagueType || 'redraft',
                    scoringType: scoringType,
                    projectionSystem: projectionSystem,
                    // Pass user-selected categories if provided
                    hittingCategories: leagueConfig.hittingCategories,
                    pitchingCategories: leagueConfig.pitchingCategories,
                    pointsSettings: leagueConfig.pointsSettings,
                    dynastySettings: leagueConfig.dynastySettings,
                };
                dynastyRankings = void 0;
                if (!(leagueSettings.leagueType === 'dynasty')) return [3 /*break*/, 20];
                console.log('[Auction] Dynasty mode - fetching dynasty rankings');
                _e.label = 17;
            case 17:
                _e.trys.push([17, 19, , 20]);
                return [4 /*yield*/, getDynastyRankings()];
            case 18:
                dynastyRankings = _e.sent();
                console.log("[Auction] Loaded ".concat(dynastyRankings.length, " dynasty rankings"));
                return [3 /*break*/, 20];
            case 19:
                dynastyError_1 = _e.sent();
                console.warn('[Auction] Failed to load dynasty rankings, using steamer-only:', dynastyError_1);
                return [3 /*break*/, 20];
            case 20:
                valuedResult = calculateAuctionValues(cachedProjections.projections, leagueSettings, dynastyRankings);
                projections = valuedResult.players.map(function (p) {
                    var _a;
                    return ({
                        id: p.externalId,
                        name: p.name,
                        team: p.team,
                        positions: p.positions,
                        projectedValue: (_a = p.auctionValue) !== null && _a !== void 0 ? _a : 0,
                    });
                });
                scrapeCacheKey_1 = "auction-".concat(roomId);
                auctionData = getCached(scrapeCacheKey_1);
                if (!!auctionData) return [3 /*break*/, 22];
                lockKey_1 = "scraping-".concat(roomId);
                scrapePromise = scrapingLocks.get(lockKey_1);
                if (!scrapePromise) {
                    // No scrape in progress, start one
                    console.log("[sync-lite] Scraping auction data for room ".concat(roomId, "..."));
                    startTime_1 = Date.now();
                    scrapePromise = scrapeAuction(roomId).then(function (data) {
                        console.log("[sync-lite] Scrape completed in ".concat(Date.now() - startTime_1, "ms"));
                        if (data.status !== 'not_found') {
                            setCache(scrapeCacheKey_1, data);
                        }
                        return data;
                    }).finally(function () {
                        scrapingLocks.delete(lockKey_1);
                    });
                    scrapingLocks.set(lockKey_1, scrapePromise);
                }
                else {
                    console.log("[sync-lite] Waiting for existing scrape for room ".concat(roomId, "..."));
                }
                return [4 /*yield*/, scrapePromise];
            case 21:
                auctionData = _e.sent();
                return [3 /*break*/, 23];
            case 22:
                console.log("[sync-lite] Using cached scrape data for room ".concat(roomId, " (age: ").concat(Math.round(getCacheAge(scrapeCacheKey_1) / 1000), "s)"));
                _e.label = 23;
            case 23:
                if (auctionData.status === 'not_found') {
                    return [2 /*return*/, res.status(404).json({
                            error: "Auction room ".concat(roomId, " not found"),
                        })];
                }
                _d = matchAllPlayers(auctionData.players, projections), matched = _d.matched, unmatched = _d.unmatched;
                inflationStats = calculateInflationStats(matched, leagueConfig, auctionData.teams);
                result = {
                    auctionData: auctionData,
                    matchedPlayers: matched,
                    inflationStats: inflationStats,
                    unmatchedPlayers: unmatched,
                };
                // Cache the full sync result for faster subsequent requests
                setCache(syncCacheKey, result);
                res.json(result);
                return [3 /*break*/, 25];
            case 24:
                error_3 = _e.sent();
                console.error("Error syncing auction ".concat(roomId, ":"), error_3);
                res.status(503).json({
                    error: 'Failed to sync auction data.',
                });
                return [3 /*break*/, 25];
            case 25: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/auction/:roomId/current
 * Gets only the current auction (player on block) - lightweight endpoint for frequent polling
 */
router.get('/:roomId/current', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var roomId, cacheKey, cached, data, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                roomId = req.params.roomId;
                if (!roomId || !/^\d+$/.test(roomId)) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'Invalid room ID. Must be a numeric value.',
                        })];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                cacheKey = "current-".concat(roomId);
                cached = getCached(cacheKey);
                if (cached) {
                    return [2 /*return*/, res.json(__assign(__assign({}, cached), { fromCache: true }))];
                }
                return [4 /*yield*/, scrapeDraftedPlayers(roomId)];
            case 2:
                data = _a.sent();
                setCache(cacheKey, data);
                res.json(data);
                return [3 /*break*/, 4];
            case 3:
                error_4 = _a.sent();
                console.error("Error fetching current auction ".concat(roomId, ":"), error_4);
                res.status(503).json({
                    error: 'Failed to fetch current auction.',
                });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
export default router;

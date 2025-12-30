/**
 * Projections API Routes
 * Endpoints for fetching projections and calculating auction values
 */
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
import { fetchSteamerProjections } from '../services/projectionsService';
import { fetchJAProjections } from '../services/jaProjectionsService';
import { getCachedProjections, setCachedProjections, invalidateCache, getCacheStatus, } from '../services/projectionsCacheService';
import { getDynastyRankings, refreshDynastyRankings, getDynastyRankingsCacheStatus, } from '../services/dynastyRankingsScraper';
import { calculateAuctionValues } from '../services/valueCalculator';
var router = Router();
var VALID_SYSTEMS = ['steamer', 'batx', 'ja'];
function isValidSystem(system) {
    return VALID_SYSTEMS.includes(system);
}
/**
 * GET /api/projections/:system
 * Returns projections for the specified system (steamer, batx, ja)
 * Uses cache with 24-hour TTL
 */
router.get('/:system', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var system, cached, projections, _a, hitterCount, pitcherCount, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                system = req.params.system;
                if (!isValidSystem(system)) {
                    return [2 /*return*/, res.status(400).json({
                            error: "Invalid projection system. Must be one of: ".concat(VALID_SYSTEMS.join(', ')),
                        })];
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 11, , 12]);
                return [4 /*yield*/, getCachedProjections(system)];
            case 2:
                cached = _b.sent();
                if (cached) {
                    return [2 /*return*/, res.json(__assign(__assign({}, cached), { fromCache: true }))];
                }
                projections = void 0;
                _a = system;
                switch (_a) {
                    case 'steamer': return [3 /*break*/, 3];
                    case 'ja': return [3 /*break*/, 5];
                    case 'batx': return [3 /*break*/, 7];
                }
                return [3 /*break*/, 8];
            case 3: return [4 /*yield*/, fetchSteamerProjections()];
            case 4:
                projections = _b.sent();
                return [3 /*break*/, 9];
            case 5: return [4 /*yield*/, fetchJAProjections()];
            case 6:
                projections = _b.sent();
                return [3 /*break*/, 9];
            case 7: 
            // BatX is currently unavailable
            return [2 /*return*/, res.status(503).json({
                    error: 'BatX projections are currently unavailable. Please use Steamer or JA Projections.',
                })];
            case 8: return [2 /*return*/, res.status(400).json({ error: 'Invalid projection system' })];
            case 9: 
            // Cache the results
            return [4 /*yield*/, setCachedProjections(system, projections)];
            case 10:
                // Cache the results
                _b.sent();
                hitterCount = projections.filter(function (p) { return p.playerType === 'hitter'; }).length;
                pitcherCount = projections.filter(function (p) { return p.playerType === 'pitcher'; }).length;
                res.json({
                    metadata: {
                        system: system,
                        fetchedAt: new Date().toISOString(),
                        playerCount: projections.length,
                        hitterCount: hitterCount,
                        pitcherCount: pitcherCount,
                    },
                    projections: projections,
                    fromCache: false,
                });
                return [3 /*break*/, 12];
            case 11:
                error_1 = _b.sent();
                console.error("Error fetching ".concat(system, " projections:"), error_1);
                res.status(503).json({
                    error: 'Failed to fetch projections. FanGraphs API may be unavailable.',
                    message: error_1 instanceof Error ? error_1.message : undefined,
                });
                return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/projections/:system/status
 * Returns cache status for a projection system
 */
router.get('/:system/status', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var system, status_1, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                system = req.params.system;
                if (!isValidSystem(system)) {
                    return [2 /*return*/, res.status(400).json({
                            error: "Invalid projection system. Must be one of: ".concat(VALID_SYSTEMS.join(', ')),
                        })];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, getCacheStatus(system)];
            case 2:
                status_1 = _a.sent();
                res.json(__assign({ system: system }, status_1));
                return [3 /*break*/, 4];
            case 3:
                error_2 = _a.sent();
                console.error("Error getting cache status for ".concat(system, ":"), error_2);
                res.status(500).json({
                    error: 'Failed to get cache status',
                });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/projections/:system/refresh
 * Forces a cache refresh for a projection system
 */
router.post('/:system/refresh', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var system, projections, _a, hitterCount, pitcherCount, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                system = req.params.system;
                if (!isValidSystem(system)) {
                    return [2 /*return*/, res.status(400).json({
                            error: "Invalid projection system. Must be one of: ".concat(VALID_SYSTEMS.join(', ')),
                        })];
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 11, , 12]);
                // Invalidate existing cache
                return [4 /*yield*/, invalidateCache(system)];
            case 2:
                // Invalidate existing cache
                _b.sent();
                projections = void 0;
                _a = system;
                switch (_a) {
                    case 'steamer': return [3 /*break*/, 3];
                    case 'ja': return [3 /*break*/, 5];
                    case 'batx': return [3 /*break*/, 7];
                }
                return [3 /*break*/, 8];
            case 3: return [4 /*yield*/, fetchSteamerProjections()];
            case 4:
                projections = _b.sent();
                return [3 /*break*/, 9];
            case 5: return [4 /*yield*/, fetchJAProjections()];
            case 6:
                projections = _b.sent();
                return [3 /*break*/, 9];
            case 7: return [2 /*return*/, res.status(503).json({
                    error: 'BatX projections are currently unavailable. Please use Steamer or JA Projections.',
                })];
            case 8: return [2 /*return*/, res.status(400).json({ error: 'Invalid projection system' })];
            case 9: 
            // Cache the results
            return [4 /*yield*/, setCachedProjections(system, projections)];
            case 10:
                // Cache the results
                _b.sent();
                hitterCount = projections.filter(function (p) { return p.playerType === 'hitter'; }).length;
                pitcherCount = projections.filter(function (p) { return p.playerType === 'pitcher'; }).length;
                res.json({
                    success: true,
                    message: "".concat(system, " projections refreshed"),
                    playerCount: projections.length,
                    hitterCount: hitterCount,
                    pitcherCount: pitcherCount,
                    refreshedAt: new Date().toISOString(),
                });
                return [3 /*break*/, 12];
            case 11:
                error_3 = _b.sent();
                console.error("Error refreshing ".concat(system, " projections:"), error_3);
                res.status(503).json({
                    error: 'Failed to refresh projections',
                    message: error_3 instanceof Error ? error_3.message : undefined,
                });
                return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); });
/**
 * POST /api/projections/calculate-values
 * Calculates auction values for a league configuration
 * Supports both redraft (steamer-only) and dynasty (blended) modes
 *
 * Body: {
 *   projectionSystem: 'steamer' | 'batx' | 'ja',
 *   leagueSettings: LeagueSettings
 * }
 */
router.post('/calculate-values', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, projectionSystem, leagueSettings, cached, projections, _b, dynastyRankings, dynastyError_1, result, error_4;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = req.body, projectionSystem = _a.projectionSystem, leagueSettings = _a.leagueSettings;
                // Validate required fields
                if (!projectionSystem) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'projectionSystem is required',
                        })];
                }
                if (!isValidSystem(projectionSystem)) {
                    return [2 /*return*/, res.status(400).json({
                            error: "Invalid projection system. Must be one of: ".concat(VALID_SYSTEMS.join(', ')),
                        })];
                }
                if (!leagueSettings) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'leagueSettings is required',
                        })];
                }
                if (!leagueSettings.numTeams || !leagueSettings.budgetPerTeam) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'leagueSettings must include numTeams and budgetPerTeam',
                        })];
                }
                if (!leagueSettings.rosterSpots) {
                    return [2 /*return*/, res.status(400).json({
                            error: 'leagueSettings must include rosterSpots configuration',
                        })];
                }
                _d.label = 1;
            case 1:
                _d.trys.push([1, 17, , 18]);
                return [4 /*yield*/, getCachedProjections(projectionSystem)];
            case 2:
                cached = _d.sent();
                if (!!cached) return [3 /*break*/, 12];
                console.log("No cached projections for ".concat(projectionSystem, ", fetching fresh..."));
                projections = void 0;
                _b = projectionSystem;
                switch (_b) {
                    case 'steamer': return [3 /*break*/, 3];
                    case 'ja': return [3 /*break*/, 5];
                    case 'batx': return [3 /*break*/, 7];
                }
                return [3 /*break*/, 8];
            case 3: return [4 /*yield*/, fetchSteamerProjections()];
            case 4:
                projections = _d.sent();
                return [3 /*break*/, 9];
            case 5: return [4 /*yield*/, fetchJAProjections()];
            case 6:
                projections = _d.sent();
                return [3 /*break*/, 9];
            case 7: return [2 /*return*/, res.status(503).json({
                    error: 'BatX projections are currently unavailable. Please use Steamer or JA Projections.',
                })];
            case 8: return [2 /*return*/, res.status(400).json({ error: 'Invalid projection system' })];
            case 9: return [4 /*yield*/, setCachedProjections(projectionSystem, projections)];
            case 10:
                _d.sent();
                return [4 /*yield*/, getCachedProjections(projectionSystem)];
            case 11:
                cached = _d.sent();
                _d.label = 12;
            case 12:
                if (!cached) {
                    return [2 /*return*/, res.status(503).json({
                            error: 'Failed to load projections',
                        })];
                }
                // For dynasty leagues, also fetch dynasty rankings
                console.log("[API] calculate-values called with leagueType: ".concat(leagueSettings.leagueType, ", dynastyWeight: ").concat((_c = leagueSettings.dynastySettings) === null || _c === void 0 ? void 0 : _c.dynastyWeight));
                dynastyRankings = void 0;
                if (!(leagueSettings.leagueType === 'dynasty')) return [3 /*break*/, 16];
                console.log('[API] Dynasty mode - fetching dynasty rankings');
                _d.label = 13;
            case 13:
                _d.trys.push([13, 15, , 16]);
                return [4 /*yield*/, getDynastyRankings()];
            case 14:
                dynastyRankings = _d.sent();
                console.log("[API] Loaded ".concat(dynastyRankings.length, " dynasty rankings"));
                return [3 /*break*/, 16];
            case 15:
                dynastyError_1 = _d.sent();
                console.warn('[API] Failed to load dynasty rankings, falling back to steamer-only:', dynastyError_1);
                return [3 /*break*/, 16];
            case 16:
                result = calculateAuctionValues(cached.projections, __assign(__assign({}, leagueSettings), { projectionSystem: projectionSystem }), dynastyRankings);
                res.json(result);
                return [3 /*break*/, 18];
            case 17:
                error_4 = _d.sent();
                console.error('Error calculating auction values:', error_4);
                if (error_4 instanceof Error) {
                    console.error('Stack trace:', error_4.stack);
                }
                res.status(500).json({
                    error: 'Failed to calculate auction values',
                    message: error_4 instanceof Error ? error_4.message : undefined,
                    stack: error_4 instanceof Error ? error_4.stack : undefined,
                });
                return [3 /*break*/, 18];
            case 18: return [2 /*return*/];
        }
    });
}); });
// ============================================================================
// DYNASTY RANKINGS ENDPOINTS
// ============================================================================
/**
 * GET /api/projections/dynasty-rankings
 * Returns crowd-sourced dynasty rankings from Harry Knows Ball
 * Uses cache with 12-hour TTL
 */
router.get('/dynasty-rankings', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var rankings, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, getDynastyRankings()];
            case 1:
                rankings = _a.sent();
                res.json({
                    metadata: {
                        source: 'harryknowsball',
                        fetchedAt: new Date().toISOString(),
                        playerCount: rankings.length,
                    },
                    rankings: rankings,
                });
                return [3 /*break*/, 3];
            case 2:
                error_5 = _a.sent();
                console.error('Error fetching dynasty rankings:', error_5);
                res.status(503).json({
                    error: 'Failed to fetch dynasty rankings',
                    message: error_5 instanceof Error ? error_5.message : undefined,
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * GET /api/projections/dynasty-rankings/status
 * Returns cache status for dynasty rankings
 */
router.get('/dynasty-rankings/status', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var status_2;
    return __generator(this, function (_a) {
        try {
            status_2 = getDynastyRankingsCacheStatus();
            res.json(status_2);
        }
        catch (error) {
            console.error('Error getting dynasty rankings cache status:', error);
            res.status(500).json({
                error: 'Failed to get cache status',
            });
        }
        return [2 /*return*/];
    });
}); });
/**
 * POST /api/projections/dynasty-rankings/refresh
 * Forces a cache refresh for dynasty rankings
 */
router.post('/dynasty-rankings/refresh', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var rankings, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, refreshDynastyRankings()];
            case 1:
                rankings = _a.sent();
                res.json({
                    success: true,
                    message: 'Dynasty rankings refreshed',
                    playerCount: rankings.length,
                    refreshedAt: new Date().toISOString(),
                });
                return [3 /*break*/, 3];
            case 2:
                error_6 = _a.sent();
                console.error('Error refreshing dynasty rankings:', error_6);
                res.status(503).json({
                    error: 'Failed to refresh dynasty rankings',
                    message: error_6 instanceof Error ? error_6.message : undefined,
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
export default router;

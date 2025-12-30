/**
 * Projections Cache Service
 * File-based caching for projection data with 24-hour TTL
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
import { promises as fs } from 'fs';
import * as path from 'path';
// Cache directory - use process.cwd() to find project root
var CACHE_DIR = path.join(process.cwd(), 'cache');
var CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
/**
 * Retrieves cached projections if available and not expired
 */
export function getCachedProjections(system) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheFile, content, cache, expiresAt, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cacheFile = getCacheFilePath(system);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fs.readFile(cacheFile, 'utf-8')];
                case 2:
                    content = _a.sent();
                    cache = JSON.parse(content);
                    expiresAt = new Date(cache.metadata.expiresAt);
                    if (expiresAt > new Date()) {
                        console.log("Cache hit for ".concat(system, " projections (expires ").concat(expiresAt.toISOString(), ")"));
                        return [2 /*return*/, cache];
                    }
                    console.log("Cache expired for ".concat(system, " projections"));
                    return [2 /*return*/, null];
                case 3:
                    error_1 = _a.sent();
                    // Cache doesn't exist or is invalid
                    if (error_1.code !== 'ENOENT') {
                        console.warn("Error reading cache for ".concat(system, ":"), error_1);
                    }
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Stores projections in cache
 */
export function setCachedProjections(system, projections) {
    return __awaiter(this, void 0, void 0, function () {
        var now, hitterCount, pitcherCount, metadata, entry, cacheFile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ensureCacheDir()];
                case 1:
                    _a.sent();
                    now = new Date();
                    hitterCount = projections.filter(function (p) { return p.playerType === 'hitter'; }).length;
                    pitcherCount = projections.filter(function (p) { return p.playerType === 'pitcher'; }).length;
                    metadata = {
                        system: system,
                        fetchedAt: now.toISOString(),
                        expiresAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
                        playerCount: projections.length,
                        hitterCount: hitterCount,
                        pitcherCount: pitcherCount,
                    };
                    entry = {
                        metadata: metadata,
                        projections: projections,
                    };
                    cacheFile = getCacheFilePath(system);
                    return [4 /*yield*/, fs.writeFile(cacheFile, JSON.stringify(entry, null, 2))];
                case 2:
                    _a.sent();
                    console.log("Cached ".concat(projections.length, " ").concat(system, " projections ") +
                        "(".concat(hitterCount, " hitters, ").concat(pitcherCount, " pitchers)"));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Invalidates (deletes) cached projections for a system
 */
export function invalidateCache(system) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheFile, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cacheFile = getCacheFilePath(system);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fs.unlink(cacheFile)];
                case 2:
                    _a.sent();
                    console.log("Invalidated cache for ".concat(system, " projections"));
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    if (error_2.code !== 'ENOENT') {
                        console.warn("Error invalidating cache for ".concat(system, ":"), error_2);
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Gets cache status for a projection system
 */
export function getCacheStatus(system) {
    return __awaiter(this, void 0, void 0, function () {
        var cached, expiresAt, expired;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getCachedProjections(system)];
                case 1:
                    cached = _a.sent();
                    if (!cached) {
                        return [2 /*return*/, { exists: false, expired: true, metadata: null }];
                    }
                    expiresAt = new Date(cached.metadata.expiresAt);
                    expired = expiresAt <= new Date();
                    return [2 /*return*/, {
                            exists: true,
                            expired: expired,
                            metadata: cached.metadata,
                        }];
            }
        });
    });
}
/**
 * Lists all cached projection systems
 */
export function listCachedSystems() {
    return __awaiter(this, void 0, void 0, function () {
        var files, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, ensureCacheDir()];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, fs.readdir(CACHE_DIR)];
                case 2:
                    files = _b.sent();
                    return [2 /*return*/, files
                            .filter(function (f) { return f.startsWith('projections-') && f.endsWith('.json'); })
                            .map(function (f) {
                            // Extract system name from filename: projections-{system}.json
                            var match = f.match(/^projections-(.+)\.json$/);
                            return match ? match[1] : null;
                        })
                            .filter(function (s) { return s !== null; })];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Gets the cache file path for a projection system
 */
function getCacheFilePath(system) {
    // Use simple filename without date - we check expiry via metadata
    return path.join(CACHE_DIR, "projections-".concat(system, ".json"));
}
/**
 * Ensures the cache directory exists
 */
function ensureCacheDir() {
    return __awaiter(this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs.mkdir(CACHE_DIR, { recursive: true })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    // Directory already exists or other error
                    if (error_3.code !== 'EEXIST') {
                        throw error_3;
                    }
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}

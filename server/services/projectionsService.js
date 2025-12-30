/**
 * Projections Service
 * Fetches player projections from FanGraphs and normalizes them to internal format
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var FANGRAPHS_BASE_URL = 'https://www.fangraphs.com/api/projections';
/**
 * Validates a normalized projection to catch bad data from the API
 * Returns true if the projection is valid, false if it should be filtered out
 */
function validateProjection(proj) {
    // Basic validation - must have a name and external ID
    if (!proj.name || !proj.externalId) {
        console.warn("Invalid projection: missing name or ID");
        return false;
    }
    if (proj.playerType === 'hitter') {
        if (!proj.hitting) {
            console.warn("Invalid hitter projection for ".concat(proj.name, ": missing hitting stats"));
            return false;
        }
        var h = proj.hitting;
        // Plate appearances should be reasonable (0-800 for a full season)
        if (h.plateAppearances < 0 || h.plateAppearances > 800) {
            console.warn("Invalid hitter projection for ".concat(proj.name, ": PA=").concat(h.plateAppearances, " out of range"));
            return false;
        }
        // Batting average must be between 0 and 1
        if (h.battingAvg < 0 || h.battingAvg > 1) {
            console.warn("Invalid hitter projection for ".concat(proj.name, ": AVG=").concat(h.battingAvg, " out of range"));
            return false;
        }
        // WAR should be realistic (-5 to 15)
        if (h.war < -5 || h.war > 15) {
            console.warn("Invalid hitter projection for ".concat(proj.name, ": WAR=").concat(h.war, " out of range (flagged as outlier)"));
            return false;
        }
        // OBP should be between 0 and 1
        if (h.onBasePct < 0 || h.onBasePct > 1) {
            console.warn("Invalid hitter projection for ".concat(proj.name, ": OBP=").concat(h.onBasePct, " out of range"));
            return false;
        }
    }
    else if (proj.playerType === 'pitcher') {
        if (!proj.pitching) {
            console.warn("Invalid pitcher projection for ".concat(proj.name, ": missing pitching stats"));
            return false;
        }
        var p = proj.pitching;
        // Innings pitched should be reasonable (0-300 for a full season)
        if (p.inningsPitched < 0 || p.inningsPitched > 300) {
            console.warn("Invalid pitcher projection for ".concat(proj.name, ": IP=").concat(p.inningsPitched, " out of range"));
            return false;
        }
        // ERA should be reasonable (0-15, allowing for small sample size projections)
        if (p.era < 0 || p.era > 15) {
            console.warn("Invalid pitcher projection for ".concat(proj.name, ": ERA=").concat(p.era, " out of range"));
            return false;
        }
        // WHIP should be reasonable (0-3)
        if (p.whip < 0 || p.whip > 3) {
            console.warn("Invalid pitcher projection for ".concat(proj.name, ": WHIP=").concat(p.whip, " out of range"));
            return false;
        }
        // WAR should be realistic (-5 to 15)
        if (p.war < -5 || p.war > 15) {
            console.warn("Invalid pitcher projection for ".concat(proj.name, ": WAR=").concat(p.war, " out of range (flagged as outlier)"));
            return false;
        }
    }
    return true;
}
/**
 * Fetches Steamer projections for both hitters and pitchers from FanGraphs
 */
export function fetchSteamerProjections() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, hittersResponse, pitchersResponse, hitters, pitchers, normalizedHitters, normalizedPitchers, validHitters, validPitchers, filteredHitters, filteredPitchers;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Fetching Steamer projections from FanGraphs...');
                    return [4 /*yield*/, Promise.all([
                            fetch("".concat(FANGRAPHS_BASE_URL, "?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all")),
                            fetch("".concat(FANGRAPHS_BASE_URL, "?type=steamer&stats=pit&pos=all&team=0&players=0&lg=all")),
                        ])];
                case 1:
                    _a = _b.sent(), hittersResponse = _a[0], pitchersResponse = _a[1];
                    if (!hittersResponse.ok) {
                        throw new Error("Failed to fetch hitter projections: ".concat(hittersResponse.status));
                    }
                    if (!pitchersResponse.ok) {
                        throw new Error("Failed to fetch pitcher projections: ".concat(pitchersResponse.status));
                    }
                    return [4 /*yield*/, hittersResponse.json()];
                case 2:
                    hitters = _b.sent();
                    return [4 /*yield*/, pitchersResponse.json()];
                case 3:
                    pitchers = _b.sent();
                    console.log("Fetched ".concat(hitters.length, " hitters and ").concat(pitchers.length, " pitchers"));
                    normalizedHitters = hitters.map(normalizeHitter);
                    normalizedPitchers = pitchers.map(normalizePitcher);
                    validHitters = normalizedHitters.filter(validateProjection);
                    validPitchers = normalizedPitchers.filter(validateProjection);
                    filteredHitters = normalizedHitters.length - validHitters.length;
                    filteredPitchers = normalizedPitchers.length - validPitchers.length;
                    if (filteredHitters > 0 || filteredPitchers > 0) {
                        console.log("Filtered out ".concat(filteredHitters, " invalid hitters and ").concat(filteredPitchers, " invalid pitchers"));
                    }
                    console.log("Returning ".concat(validHitters.length, " valid hitters and ").concat(validPitchers.length, " valid pitchers"));
                    return [2 /*return*/, __spreadArray(__spreadArray([], validHitters, true), validPitchers, true)];
            }
        });
    });
}
/**
 * Normalizes a FanGraphs hitter to internal format
 */
function normalizeHitter(raw) {
    return {
        externalId: raw.playerid,
        mlbamId: raw.xMLBAMID,
        name: raw.PlayerName,
        team: raw.Team || 'FA', // Free agent if no team
        positions: parsePositions(raw.minpos),
        playerType: 'hitter',
        hitting: {
            games: Math.round(raw.G || 0),
            atBats: Math.round(raw.AB || 0),
            plateAppearances: Math.round(raw.PA || 0),
            runs: Math.round(raw.R || 0),
            hits: Math.round(raw.H || 0),
            singles: Math.round(raw['1B'] || 0),
            doubles: Math.round(raw['2B'] || 0),
            triples: Math.round(raw['3B'] || 0),
            homeRuns: Math.round(raw.HR || 0),
            rbi: Math.round(raw.RBI || 0),
            stolenBases: Math.round(raw.SB || 0),
            caughtStealing: Math.round(raw.CS || 0),
            walks: Math.round(raw.BB || 0),
            strikeouts: Math.round(raw.SO || 0),
            battingAvg: raw.AVG || 0,
            onBasePct: raw.OBP || 0,
            sluggingPct: raw.SLG || 0,
            ops: raw.OPS || 0,
            wOBA: raw.wOBA || 0,
            wrcPlus: raw['wRC+'] || 0,
            war: raw.WAR || 0,
        },
    };
}
/**
 * Normalizes a FanGraphs pitcher to internal format
 */
function normalizePitcher(raw) {
    // Determine if SP or RP based on games started ratio
    var gamesStarted = raw.GS || 0;
    var totalGames = raw.G || 1;
    var starterRatio = gamesStarted / totalGames;
    // If starts more than 50% of games, classify as SP; otherwise RP
    var positions = starterRatio >= 0.5 ? ['SP'] : ['RP'];
    return {
        externalId: raw.playerid,
        mlbamId: raw.xMLBAMID,
        name: raw.PlayerName,
        team: raw.Team || 'FA',
        positions: positions,
        playerType: 'pitcher',
        pitching: {
            games: Math.round(raw.G || 0),
            gamesStarted: Math.round(raw.GS || 0),
            inningsPitched: raw.IP || 0,
            wins: Math.round(raw.W || 0),
            losses: Math.round(raw.L || 0),
            saves: Math.round(raw.SV || 0),
            holds: Math.round(raw.HLD || 0),
            hitsAllowed: Math.round(raw.H || 0),
            earnedRuns: Math.round(raw.ER || 0),
            homeRunsAllowed: Math.round(raw.HR || 0),
            walks: Math.round(raw.BB || 0),
            strikeouts: Math.round(raw.SO || 0),
            era: raw.ERA || 0,
            whip: raw.WHIP || 0,
            k9: raw['K/9'] || 0,
            bb9: raw['BB/9'] || 0,
            fip: raw.FIP || 0,
            war: raw.WAR || 0,
        },
    };
}
/**
 * Parses position string from FanGraphs into array of positions
 * FanGraphs minpos can be: "OF", "1B/DH", "SS/2B", etc.
 */
function parsePositions(minpos) {
    if (!minpos)
        return ['UTIL'];
    // Split on common delimiters
    var positions = minpos
        .split(/[\/,]/)
        .map(function (p) { return p.trim().toUpperCase(); })
        .filter(Boolean);
    // Map FanGraphs position codes to standard fantasy positions
    var mappedPositions = positions.map(function (pos) {
        switch (pos) {
            case 'C':
            case '1B':
            case '2B':
            case '3B':
            case 'SS':
                return pos;
            case 'LF':
            case 'CF':
            case 'RF':
            case 'OF':
                return 'OF';
            case 'DH':
                return 'UTIL';
            default:
                return pos;
        }
    });
    // Remove duplicates
    return Array.from(new Set(mappedPositions));
}
/**
 * Gets the primary position for a player (first position in list)
 */
export function getPrimaryPosition(player) {
    return player.positions[0] || (player.playerType === 'pitcher' ? 'P' : 'UTIL');
}
/**
 * Checks if a player is eligible for a given position
 */
export function isEligibleForPosition(player, position) {
    // UTIL can be filled by any hitter
    if (position === 'UTIL' && player.playerType === 'hitter') {
        return true;
    }
    // P can be filled by any pitcher
    if (position === 'P' && player.playerType === 'pitcher') {
        return true;
    }
    // CI = 1B or 3B
    if (position === 'CI') {
        return player.positions.includes('1B') || player.positions.includes('3B');
    }
    // MI = 2B or SS
    if (position === 'MI') {
        return player.positions.includes('2B') || player.positions.includes('SS');
    }
    // Direct position match
    return player.positions.includes(position);
}

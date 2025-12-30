/**
 * JA Projections Service
 * Fetches player projections from JA Projections Google Sheet and normalizes them to internal format
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
// Google Sheets public URL for JA Projections
var JA_SHEET_ID = '1c2aCJakeEMLXbxZ5MRPX3IfXFaIAOyntQHjSDzYRh3k';
var HITTERS_SHEET_URL = "https://docs.google.com/spreadsheets/d/".concat(JA_SHEET_ID, "/gviz/tq?tqx=out:csv&sheet=hitters");
var PITCHERS_SHEET_URL = "https://docs.google.com/spreadsheets/d/".concat(JA_SHEET_ID, "/gviz/tq?tqx=out:csv&sheet=pitchers");
/**
 * Parses CSV text into an array of objects
 */
function parseCSV(csvText) {
    var lines = csvText.trim().split('\n');
    if (lines.length < 2)
        return [];
    // Parse header row - handle quoted values
    var headers = parseCSVLine(lines[0]);
    var results = [];
    for (var i = 1; i < lines.length; i++) {
        var values = parseCSVLine(lines[i]);
        if (values.length !== headers.length)
            continue;
        var obj = {};
        for (var j = 0; j < headers.length; j++) {
            var header = headers[j];
            var value = values[j];
            // Try to parse as number if it looks numeric
            var numValue = parseFloat(value);
            obj[header] = isNaN(numValue) ? value : numValue;
        }
        results.push(obj);
    }
    return results;
}
/**
 * Parses a single CSV line, handling quoted values
 */
function parseCSVLine(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
/**
 * Fetches JA Projections for both hitters and pitchers
 */
export function fetchJAProjections() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, hittersResponse, pitchersResponse, hittersCSV, pitchersCSV, hitters, pitchers, normalizedHitters, normalizedPitchers, validHitters, validPitchers, filteredHitters, filteredPitchers;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Fetching JA Projections from Google Sheets...');
                    return [4 /*yield*/, Promise.all([
                            fetch(HITTERS_SHEET_URL),
                            fetch(PITCHERS_SHEET_URL),
                        ])];
                case 1:
                    _a = _b.sent(), hittersResponse = _a[0], pitchersResponse = _a[1];
                    if (!hittersResponse.ok) {
                        throw new Error("Failed to fetch JA hitter projections: ".concat(hittersResponse.status));
                    }
                    if (!pitchersResponse.ok) {
                        throw new Error("Failed to fetch JA pitcher projections: ".concat(pitchersResponse.status));
                    }
                    return [4 /*yield*/, hittersResponse.text()];
                case 2:
                    hittersCSV = _b.sent();
                    return [4 /*yield*/, pitchersResponse.text()];
                case 3:
                    pitchersCSV = _b.sent();
                    hitters = parseCSV(hittersCSV);
                    pitchers = parseCSV(pitchersCSV);
                    console.log("Fetched ".concat(hitters.length, " hitters and ").concat(pitchers.length, " pitchers from JA Projections"));
                    normalizedHitters = hitters
                        .filter(function (h) { return h.Player && h.Player.trim() !== ''; })
                        .map(normalizeJAHitter);
                    normalizedPitchers = pitchers
                        .filter(function (p) { return p.Pitcher && p.Pitcher.trim() !== ''; })
                        .map(normalizeJAPitcher);
                    validHitters = normalizedHitters.filter(validateJAProjection);
                    validPitchers = normalizedPitchers.filter(validateJAProjection);
                    filteredHitters = normalizedHitters.length - validHitters.length;
                    filteredPitchers = normalizedPitchers.length - validPitchers.length;
                    if (filteredHitters > 0 || filteredPitchers > 0) {
                        console.log("Filtered out ".concat(filteredHitters, " invalid hitters and ").concat(filteredPitchers, " invalid pitchers"));
                    }
                    console.log("Returning ".concat(validHitters.length, " valid hitters and ").concat(validPitchers.length, " valid pitchers from JA Projections"));
                    return [2 /*return*/, __spreadArray(__spreadArray([], validHitters, true), validPitchers, true)];
            }
        });
    });
}
/**
 * Validates a JA projection to catch bad data
 */
function validateJAProjection(proj) {
    if (!proj.name || !proj.externalId) {
        return false;
    }
    if (proj.playerType === 'hitter') {
        if (!proj.hitting)
            return false;
        var h = proj.hitting;
        // Basic sanity checks
        if (h.plateAppearances < 0 || h.plateAppearances > 800)
            return false;
        if (h.battingAvg < 0 || h.battingAvg > 1)
            return false;
    }
    else if (proj.playerType === 'pitcher') {
        if (!proj.pitching)
            return false;
        var p = proj.pitching;
        // Basic sanity checks
        if (p.inningsPitched < 0 || p.inningsPitched > 300)
            return false;
        if (p.era < 0 || p.era > 15)
            return false;
    }
    return true;
}
/**
 * Normalizes a JA hitter to internal format
 */
function normalizeJAHitter(raw) {
    // Generate a unique ID from name + team if MLBID not available
    var externalId = raw.MLBID && raw.MLBID !== ''
        ? "ja-".concat(raw.MLBID)
        : "ja-".concat(raw.Player.replace(/\s+/g, '-').toLowerCase(), "-").concat(raw.Team || 'FA');
    // Parse MLBID as number if available
    var mlbamId = raw.MLBID ? parseInt(raw.MLBID, 10) : 0;
    // Parse positions
    var positions = parsePositions(raw.Pos);
    // Calculate derived stats
    var pa = raw.PA || 0;
    var ab = raw.AB || 0;
    var h = Math.round((raw.AVG || 0) * ab);
    var bb = raw.BB || 0;
    var so = raw.SO || 0;
    return {
        externalId: externalId,
        mlbamId: isNaN(mlbamId) ? 0 : mlbamId,
        name: raw.Player,
        team: raw.Team || 'FA',
        positions: positions,
        playerType: 'hitter',
        hitting: {
            games: Math.round(pa / 4.5), // Estimate games from PA
            atBats: Math.round(ab),
            plateAppearances: Math.round(pa),
            runs: Math.round(raw.R || 0),
            hits: h,
            singles: Math.max(0, h - Math.round(raw.HR || 0)), // Simplified - just subtract HR
            doubles: 0, // Not provided in JA
            triples: 0, // Not provided in JA
            homeRuns: Math.round(raw.HR || 0),
            rbi: Math.round(raw.RBI || 0),
            stolenBases: Math.round(raw.SB || 0),
            caughtStealing: 0, // Not provided in JA
            walks: Math.round(bb),
            strikeouts: Math.round(so),
            battingAvg: raw.AVG || 0,
            onBasePct: raw.OBP || 0,
            sluggingPct: raw.SLG || 0,
            ops: raw.OPS || 0,
            wOBA: 0, // Not provided in JA
            wrcPlus: 0, // Not provided in JA
            war: 0, // Not provided in JA - will be estimated from other stats
        },
    };
}
/**
 * Normalizes a JA pitcher to internal format
 */
function normalizeJAPitcher(raw) {
    // Generate a unique ID
    var externalId = raw.SAVID && raw.SAVID !== ''
        ? "ja-".concat(raw.SAVID)
        : "ja-".concat(raw.Pitcher.replace(/\s+/g, '-').toLowerCase(), "-").concat(raw.Team || 'FA');
    // Determine if SP or RP based on games started and saves
    var gs = raw.GS || 0;
    var sv = raw.SV || 0;
    var positions = gs > 5 ? ['SP'] : sv > 0 ? ['RP'] : ['SP'];
    var ip = raw.IP || 0;
    var er = raw.ER || 0;
    return {
        externalId: externalId,
        mlbamId: 0, // SAVID is not MLBAM ID
        name: raw.Pitcher,
        team: raw.Team || 'FA',
        positions: positions,
        playerType: 'pitcher',
        pitching: {
            games: Math.round(ip / 5.5), // Estimate games from IP
            gamesStarted: Math.round(gs),
            inningsPitched: ip,
            wins: Math.round(raw.W || 0),
            losses: 0, // Not provided in JA
            saves: Math.round(sv),
            holds: 0, // Not provided in JA
            hitsAllowed: Math.round(raw.H || 0),
            earnedRuns: Math.round(er),
            homeRunsAllowed: Math.round(raw.HR || 0),
            walks: Math.round(raw.BB || 0),
            strikeouts: Math.round(raw.K || 0),
            era: raw.ERA || 0,
            whip: raw.WHIP || 0,
            k9: ip > 0 ? ((raw.K || 0) / ip) * 9 : 0,
            bb9: ip > 0 ? ((raw.BB || 0) / ip) * 9 : 0,
            fip: 0, // Not provided in JA
            war: 0, // Not provided in JA
        },
    };
}
/**
 * Parses position string from JA format into array of positions
 * JA format: "OF", "UT, P", "SS", etc.
 */
function parsePositions(posString) {
    if (posString === null || posString === undefined || posString === '')
        return ['UTIL'];
    // Convert to string if it's a number (can happen with some CSV data)
    var posStr = String(posString);
    var positions = posStr
        .split(/[\/,]/)
        .map(function (p) { return p.trim().toUpperCase(); })
        .filter(Boolean);
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
            case 'UT':
                return 'UTIL';
            case 'P':
                return 'P';
            default:
                return pos;
        }
    });
    // Remove duplicates and filter out 'P' for hitters (Ohtani case handled separately)
    return Array.from(new Set(mappedPositions.filter(function (p) { return p !== 'P' || positions.includes('P'); })));
}

/**
 * Value Calculator Service
 * Calculates auction dollar values based on league settings and projections
 *
 * Key principle: Only players in the draftable pool get auction values.
 * Players outside the pool = $0 until they appear on the auction block.
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
import { matchDynastyRankingsToProjections } from './dynastyRankingsScraper';
// Default hitter/pitcher budget split
var DEFAULT_HITTER_SPLIT = 0.68;
var DEFAULT_PITCHER_SPLIT = 0.32;
// Minimum auction value for players in the pool
var MIN_AUCTION_VALUE = 1;
/**
 * Main entry point for calculating auction values
 * Supports both redraft (single season) and dynasty (multi-year) leagues
 */
export function calculateAuctionValues(projections, settings, dynastyRankings) {
    var _a, _b, _c, _d, _e;
    // Calculate total roster spots and budget
    var totalRosterSpots = calculateTotalRosterSpots(settings);
    var totalBudget = settings.numTeams * settings.budgetPerTeam;
    var draftablePoolSize = settings.numTeams * totalRosterSpots;
    // Get budget split (use settings or defaults)
    var hitterSplit = (_b = (_a = settings.hitterPitcherSplit) === null || _a === void 0 ? void 0 : _a.hitter) !== null && _b !== void 0 ? _b : DEFAULT_HITTER_SPLIT;
    var pitcherSplit = (_d = (_c = settings.hitterPitcherSplit) === null || _c === void 0 ? void 0 : _c.pitcher) !== null && _d !== void 0 ? _d : DEFAULT_PITCHER_SPLIT;
    // Calculate hitter and pitcher roster needs
    var _f = calculatePositionNeeds(settings), hitterSpots = _f.hitterSpots, pitcherSpots = _f.pitcherSpots;
    var hitterPoolSize = settings.numTeams * hitterSpots;
    var pitcherPoolSize = settings.numTeams * pitcherSpots;
    var hitterBudget = Math.round(totalBudget * hitterSplit);
    var pitcherBudget = totalBudget - hitterBudget;
    // Separate hitters and pitchers
    var hitters = projections.filter(function (p) { return p.playerType === 'hitter'; });
    var pitchers = projections.filter(function (p) { return p.playerType === 'pitcher'; });
    // Calculate values based on scoring type
    var playersWithValues;
    switch (settings.scoringType) {
        case 'rotisserie':
        case 'h2h-categories':
            playersWithValues = calculateCategoryValues(hitters, pitchers, settings, hitterPoolSize, pitcherPoolSize, hitterBudget, pitcherBudget);
            break;
        case 'h2h-points':
            playersWithValues = calculatePointsValues(hitters, pitchers, settings, hitterPoolSize, pitcherPoolSize, hitterBudget, pitcherBudget);
            break;
        default:
            throw new Error("Unknown scoring type: ".concat(settings.scoringType));
    }
    // Apply dynasty adjustments if in dynasty mode with rankings
    if (settings.leagueType === 'dynasty' && dynastyRankings && dynastyRankings.length > 0) {
        console.log("[ValueCalc] Applying dynasty adjustments with ".concat(dynastyRankings.length, " rankings"));
        playersWithValues = applyDynastyAdjustments(playersWithValues, dynastyRankings, settings, hitterPoolSize, pitcherPoolSize, hitterBudget, pitcherBudget);
    }
    return {
        projectionSystem: settings.projectionSystem,
        calculatedAt: new Date().toISOString(),
        leagueSummary: {
            numTeams: settings.numTeams,
            budgetPerTeam: settings.budgetPerTeam,
            totalBudget: totalBudget,
            scoringType: settings.scoringType,
            draftablePoolSize: draftablePoolSize,
            hitterPoolSize: hitterPoolSize,
            pitcherPoolSize: pitcherPoolSize,
            hitterBudget: hitterBudget,
            pitcherBudget: pitcherBudget,
            leagueType: settings.leagueType,
            dynastyWeight: (_e = settings.dynastySettings) === null || _e === void 0 ? void 0 : _e.dynastyWeight,
        },
        players: playersWithValues,
    };
}
/**
 * Calculate values for Rotisserie and H2H Categories leagues using SGP
 */
function calculateCategoryValues(hitters, pitchers, settings, hitterPoolSize, pitcherPoolSize, hitterBudget, pitcherBudget) {
    var enabledHittingCats = getEnabledHittingCategories(settings);
    var enabledPitchingCats = getEnabledPitchingCategories(settings);
    // Calculate SGP for all hitters
    var hitterSGPs = calculateHitterSGPs(hitters, enabledHittingCats, hitterPoolSize);
    // Calculate SGP for all pitchers
    var pitcherSGPs = calculatePitcherSGPs(pitchers, enabledPitchingCats, pitcherPoolSize);
    // Sort by SGP and take top N for each pool
    var sortedHitters = __spreadArray([], hitterSGPs, true).sort(function (a, b) { return b.sgp - a.sgp; });
    var sortedPitchers = __spreadArray([], pitcherSGPs, true).sort(function (a, b) { return b.sgp - a.sgp; });
    // Calculate total SGP for players IN the pool
    var poolHitters = sortedHitters.slice(0, hitterPoolSize);
    var poolPitchers = sortedPitchers.slice(0, pitcherPoolSize);
    var totalHitterSGP = poolHitters.reduce(function (sum, h) { return sum + Math.max(0, h.sgp); }, 0);
    var totalPitcherSGP = poolPitchers.reduce(function (sum, p) { return sum + Math.max(0, p.sgp); }, 0);
    // Convert SGP to dollar values
    var hitterResults = convertSGPToDollars(sortedHitters, hitterPoolSize, hitterBudget, totalHitterSGP);
    var pitcherResults = convertSGPToDollars(sortedPitchers, pitcherPoolSize, pitcherBudget, totalPitcherSGP);
    return __spreadArray(__spreadArray([], hitterResults, true), pitcherResults, true);
}
/**
 * Calculate values for H2H Points leagues
 */
function calculatePointsValues(hitters, pitchers, settings, hitterPoolSize, pitcherPoolSize, hitterBudget, pitcherBudget) {
    var pointSettings = settings.pointsSettings || {};
    // Calculate total points for each hitter (filter out any without hitting stats)
    var hitterPoints = hitters
        .filter(function (h) { return h.hitting; })
        .map(function (h) { return ({
        player: h,
        points: calculateHitterPoints(h.hitting, pointSettings),
    }); });
    // Calculate total points for each pitcher (filter out any without pitching stats)
    var pitcherPoints = pitchers
        .filter(function (p) { return p.pitching; })
        .map(function (p) { return ({
        player: p,
        points: calculatePitcherPoints(p.pitching, pointSettings),
    }); });
    // Sort by points
    var sortedHitters = __spreadArray([], hitterPoints, true).sort(function (a, b) { return b.points - a.points; });
    var sortedPitchers = __spreadArray([], pitcherPoints, true).sort(function (a, b) { return b.points - a.points; });
    // Get pool and calculate total points
    var poolHitters = sortedHitters.slice(0, hitterPoolSize);
    var poolPitchers = sortedPitchers.slice(0, pitcherPoolSize);
    var totalHitterPoints = poolHitters.reduce(function (sum, h) { return sum + Math.max(0, h.points); }, 0);
    var totalPitcherPoints = poolPitchers.reduce(function (sum, p) { return sum + Math.max(0, p.points); }, 0);
    // Convert points to dollars
    var hitterResults = convertPointsToDollars(sortedHitters, hitterPoolSize, hitterBudget, totalHitterPoints);
    var pitcherResults = convertPointsToDollars(sortedPitchers, pitcherPoolSize, pitcherBudget, totalPitcherPoints);
    return __spreadArray(__spreadArray([], hitterResults, true), pitcherResults, true);
}
/**
 * Calculate SGP values for hitters
 */
function calculateHitterSGPs(hitters, enabledCategories, poolSize) {
    if (hitters.length === 0)
        return [];
    // Get stats for replacement-level calculation (top N players)
    var topHitters = __spreadArray([], hitters, true).filter(function (h) { return h.hitting; })
        .sort(function (a, b) { var _a, _b; return (((_a = b.hitting) === null || _a === void 0 ? void 0 : _a.war) || 0) - (((_b = a.hitting) === null || _b === void 0 ? void 0 : _b.war) || 0); })
        .slice(0, poolSize);
    // Calculate averages and standard deviations for each category
    var categoryStats = calculateCategoryStats(topHitters, enabledCategories, 'hitting');
    // Calculate SGP for each hitter
    return hitters.map(function (hitter) {
        var breakdown = {};
        var totalSGP = 0;
        if (hitter.hitting) {
            for (var _i = 0, enabledCategories_1 = enabledCategories; _i < enabledCategories_1.length; _i++) {
                var cat = enabledCategories_1[_i];
                var stats = categoryStats[cat];
                if (stats && stats.stdDev > 0) {
                    var value = getHittingStat(hitter.hitting, cat);
                    var sgp = (value - stats.avg) / stats.stdDev;
                    breakdown[cat] = sgp;
                    // Invert for negative categories (K for hitters is bad)
                    totalSGP += cat === 'K' ? -sgp : sgp;
                }
            }
        }
        return {
            player: hitter,
            sgp: totalSGP,
            categoryBreakdown: breakdown,
        };
    });
}
/**
 * Calculate SGP values for pitchers
 */
function calculatePitcherSGPs(pitchers, enabledCategories, poolSize) {
    if (pitchers.length === 0)
        return [];
    // Get stats for replacement-level calculation
    var topPitchers = __spreadArray([], pitchers, true).filter(function (p) { return p.pitching; })
        .sort(function (a, b) { var _a, _b; return (((_a = b.pitching) === null || _a === void 0 ? void 0 : _a.war) || 0) - (((_b = a.pitching) === null || _b === void 0 ? void 0 : _b.war) || 0); })
        .slice(0, poolSize);
    // Calculate averages and standard deviations
    var categoryStats = calculateCategoryStats(topPitchers, enabledCategories, 'pitching');
    return pitchers.map(function (pitcher) {
        var breakdown = {};
        var totalSGP = 0;
        if (pitcher.pitching) {
            for (var _i = 0, enabledCategories_2 = enabledCategories; _i < enabledCategories_2.length; _i++) {
                var cat = enabledCategories_2[_i];
                var stats = categoryStats[cat];
                if (stats && stats.stdDev > 0) {
                    var value = getPitchingStat(pitcher.pitching, cat);
                    var sgp = (value - stats.avg) / stats.stdDev;
                    breakdown[cat] = sgp;
                    // Invert for negative categories (ERA, WHIP - lower is better)
                    var isNegativeCat = ['ERA', 'WHIP', 'BB/9'].includes(cat);
                    totalSGP += isNegativeCat ? -sgp : sgp;
                }
            }
        }
        return {
            player: pitcher,
            sgp: totalSGP,
            categoryBreakdown: breakdown,
        };
    });
}
/**
 * Calculate category statistics (avg, stddev) for a group of players
 */
function calculateCategoryStats(players, categories, type) {
    var stats = {};
    var _loop_1 = function (cat) {
        var values = players
            .map(function (p) {
            if (type === 'hitting' && p.hitting) {
                return getHittingStat(p.hitting, cat);
            }
            else if (type === 'pitching' && p.pitching) {
                return getPitchingStat(p.pitching, cat);
            }
            return 0;
        })
            .filter(function (v) { return v !== 0; });
        if (values.length > 0) {
            var avg_1 = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
            // Use sample variance (Bessel's correction: N-1) instead of population variance (N)
            // This provides an unbiased estimate of variance for sample data
            var variance = values.length > 1
                ? values.reduce(function (sum, v) { return sum + Math.pow(v - avg_1, 2); }, 0) / (values.length - 1)
                : 0;
            var stdDev = Math.sqrt(variance);
            stats[cat] = { avg: avg_1, stdDev: stdDev || 1 }; // Avoid division by zero
        }
    };
    for (var _i = 0, categories_1 = categories; _i < categories_1.length; _i++) {
        var cat = categories_1[_i];
        _loop_1(cat);
    }
    return stats;
}
/**
 * Get a hitting stat value by category code
 */
function getHittingStat(stats, category) {
    switch (category) {
        case 'R': return stats.runs;
        case 'HR': return stats.homeRuns;
        case 'RBI': return stats.rbi;
        case 'SB': return stats.stolenBases;
        case 'AVG': return stats.battingAvg;
        case 'OBP': return stats.onBasePct;
        case 'SLG': return stats.sluggingPct;
        case 'OPS': return stats.ops;
        case 'H': return stats.hits;
        case 'XBH': return stats.doubles + stats.triples + stats.homeRuns;
        case 'K': return stats.strikeouts;
        case 'BB': return stats.walks;
        default: return 0;
    }
}
/**
 * Estimates Quality Starts from IP, ERA, and GS
 * QS = 6+ IP with 3 or fewer ER
 *
 * Uses historical QS/GS ratios based on ERA and average IP per start:
 * - Elite starters (6.5+ IP/start, ERA <= 3.50): ~75% QS rate
 * - Good starters (6.0+ IP/start, ERA <= 4.00): ~65% QS rate
 * - Average starters (5.5+ IP/start, ERA <= 4.50): ~50% QS rate
 * - Below average (5.0+ IP/start): ~35% QS rate
 * - Poor starters: ~20% QS rate
 */
function estimateQualityStarts(stats) {
    if (stats.gamesStarted === 0)
        return 0;
    var avgIPperStart = stats.inningsPitched / stats.gamesStarted;
    var qsRate = 0;
    if (avgIPperStart >= 6.5 && stats.era <= 3.50) {
        qsRate = 0.75; // Elite starters
    }
    else if (avgIPperStart >= 6.0 && stats.era <= 4.00) {
        qsRate = 0.65; // Good starters
    }
    else if (avgIPperStart >= 5.5 && stats.era <= 4.50) {
        qsRate = 0.50; // Average starters
    }
    else if (avgIPperStart >= 5.0) {
        qsRate = 0.35; // Below average starters
    }
    else {
        qsRate = 0.20; // Poor starters / spot starters
    }
    return Math.round(stats.gamesStarted * qsRate);
}
/**
 * Get a pitching stat value by category code
 */
function getPitchingStat(stats, category) {
    switch (category) {
        case 'W': return stats.wins;
        case 'K': return stats.strikeouts;
        case 'ERA': return stats.era;
        case 'WHIP': return stats.whip;
        case 'SV': return stats.saves;
        case 'QS': return estimateQualityStarts(stats);
        case 'K/BB': return stats.walks > 0 ? stats.strikeouts / stats.walks : 0;
        case 'K/9': return stats.k9;
        case 'IP': return stats.inningsPitched;
        case 'SV+HD': return stats.saves + stats.holds;
        case 'HD': return stats.holds;
        default: return 0;
    }
}
/**
 * Convert SGP values to dollar values
 * Includes budget normalization to ensure values sum exactly to total budget
 */
function convertSGPToDollars(players, poolSize, totalBudget, totalPoolSGP) {
    // Reserve $1 per player in pool
    var reservedDollars = poolSize * MIN_AUCTION_VALUE;
    var distributableDollars = totalBudget - reservedDollars;
    var results = players.map(function (p, index) {
        var isInPool = index < poolSize;
        var auctionValue = 0;
        if (isInPool && totalPoolSGP > 0 && p.sgp > 0) {
            // Distribute remaining dollars proportionally to SGP
            var sgpShare = p.sgp / totalPoolSGP;
            auctionValue = MIN_AUCTION_VALUE + Math.round(sgpShare * distributableDollars);
        }
        else if (isInPool) {
            // In pool but negative/zero SGP - gets minimum
            auctionValue = MIN_AUCTION_VALUE;
        }
        // Players outside pool get $0
        return __assign(__assign({}, p.player), { auctionValue: auctionValue, sgpValue: p.sgp, tier: calculateTier(index, poolSize), isInDraftPool: isInPool });
    });
    // Normalize to ensure exact budget match (handles rounding errors)
    var playersInPool = results.filter(function (p) { return p.isInDraftPool; });
    var totalAllocated = playersInPool.reduce(function (sum, p) { return sum + p.auctionValue; }, 0);
    if (totalAllocated !== totalBudget && playersInPool.length > 0) {
        var difference = totalBudget - totalAllocated;
        // Apply adjustment to the top player (most value, smallest relative impact)
        var topPlayer = playersInPool[0];
        if (topPlayer) {
            topPlayer.auctionValue = Math.max(MIN_AUCTION_VALUE, topPlayer.auctionValue + difference);
        }
    }
    return results;
}
/**
 * Calculate total points for a hitter
 */
function calculateHitterPoints(stats, pointSettings) {
    var points = 0;
    // Singles (H - 2B - 3B - HR)
    points += (stats.hits - stats.doubles - stats.triples - stats.homeRuns) * (pointSettings.H || 1);
    points += stats.doubles * (pointSettings['2B'] || 2);
    points += stats.triples * (pointSettings['3B'] || 3);
    points += stats.homeRuns * (pointSettings.HR || 4);
    points += stats.rbi * (pointSettings.RBI || 1);
    points += stats.runs * (pointSettings.R || 1);
    points += stats.stolenBases * (pointSettings.SB || 2);
    points += stats.walks * (pointSettings.BB || 1);
    points += stats.strikeouts * (pointSettings.K_hitter || -1);
    return points;
}
/**
 * Calculate total points for a pitcher
 */
function calculatePitcherPoints(stats, pointSettings) {
    var points = 0;
    points += stats.inningsPitched * (pointSettings.IP || 3);
    points += stats.wins * (pointSettings.W || 5);
    points += stats.strikeouts * (pointSettings.K_pitcher || 1);
    points += stats.saves * (pointSettings.SV || 5);
    points += stats.holds * (pointSettings.HD || 2);
    points += stats.earnedRuns * (pointSettings.ER || -2);
    points += stats.hitsAllowed * (pointSettings.H_allowed || -1);
    points += stats.walks * (pointSettings.BB_allowed || -1);
    return points;
}
/**
 * Convert points to dollar values
 * Includes budget normalization to ensure values sum exactly to total budget
 */
function convertPointsToDollars(players, poolSize, totalBudget, totalPoolPoints) {
    var reservedDollars = poolSize * MIN_AUCTION_VALUE;
    var distributableDollars = totalBudget - reservedDollars;
    var results = players.map(function (p, index) {
        var isInPool = index < poolSize;
        var auctionValue = 0;
        if (isInPool && totalPoolPoints > 0 && p.points > 0) {
            var pointsShare = p.points / totalPoolPoints;
            auctionValue = MIN_AUCTION_VALUE + Math.round(pointsShare * distributableDollars);
        }
        else if (isInPool) {
            auctionValue = MIN_AUCTION_VALUE;
        }
        return __assign(__assign({}, p.player), { auctionValue: auctionValue, pointsValue: p.points, tier: calculateTier(index, poolSize), isInDraftPool: isInPool });
    });
    // Normalize to ensure exact budget match (handles rounding errors)
    var playersInPool = results.filter(function (p) { return p.isInDraftPool; });
    var totalAllocated = playersInPool.reduce(function (sum, p) { return sum + p.auctionValue; }, 0);
    if (totalAllocated !== totalBudget && playersInPool.length > 0) {
        var difference = totalBudget - totalAllocated;
        // Apply adjustment to the top player (most value, smallest relative impact)
        var topPlayer = playersInPool[0];
        if (topPlayer) {
            topPlayer.auctionValue = Math.max(MIN_AUCTION_VALUE, topPlayer.auctionValue + difference);
        }
    }
    return results;
}
/**
 * Calculate tier (1-10) based on ranking within pool
 * Uses percentile-based assignment for consistent tier sizes regardless of pool size
 */
function calculateTier(rank, poolSize) {
    if (rank >= poolSize)
        return 10; // Outside pool
    if (poolSize === 0)
        return 10;
    // Percentile-based tier assignment: each tier gets ~10% of players
    // rank 0 = tier 1, rank poolSize-1 = tier 10
    return Math.min(10, Math.ceil(((rank + 1) / poolSize) * 10));
}
/**
 * Calculate total roster spots from settings
 */
function calculateTotalRosterSpots(settings) {
    var rs = settings.rosterSpots;
    return (rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
        rs.OF + rs.CI + rs.MI + rs.UTIL +
        rs.SP + rs.RP + rs.P + rs.Bench);
}
/**
 * Calculate hitter and pitcher spot needs
 */
function calculatePositionNeeds(settings) {
    var rs = settings.rosterSpots;
    var hitterSpots = rs.C + rs['1B'] + rs['2B'] + rs['3B'] + rs.SS +
        rs.OF + rs.CI + rs.MI + rs.UTIL;
    var pitcherSpots = rs.SP + rs.RP + rs.P;
    // Bench can be either - split proportionally
    var totalActive = hitterSpots + pitcherSpots;
    var hitterRatio = hitterSpots / totalActive;
    var benchHitters = Math.round(rs.Bench * hitterRatio);
    var benchPitchers = rs.Bench - benchHitters;
    return {
        hitterSpots: hitterSpots + benchHitters,
        pitcherSpots: pitcherSpots + benchPitchers,
    };
}
/**
 * Get enabled hitting categories from settings
 * Defaults to standard 5x5 categories if none specified
 */
function getEnabledHittingCategories(settings) {
    var cats = settings.hittingCategories || {};
    var enabled = Object.entries(cats)
        .filter(function (_a) {
        var _ = _a[0], enabled = _a[1];
        return enabled;
    })
        .map(function (_a) {
        var cat = _a[0];
        return cat;
    });
    // Default to standard 5x5 hitting categories if none specified
    if (enabled.length === 0) {
        return ['R', 'HR', 'RBI', 'SB', 'AVG'];
    }
    return enabled;
}
/**
 * Get enabled pitching categories from settings
 * Defaults to standard 5x5 categories if none specified
 */
function getEnabledPitchingCategories(settings) {
    var cats = settings.pitchingCategories || {};
    var enabled = Object.entries(cats)
        .filter(function (_a) {
        var _ = _a[0], enabled = _a[1];
        return enabled;
    })
        .map(function (_a) {
        var cat = _a[0];
        return cat;
    });
    // Default to standard 5x5 pitching categories if none specified
    if (enabled.length === 0) {
        return ['W', 'K', 'ERA', 'WHIP', 'SV'];
    }
    return enabled;
}
// ============================================================================
// DYNASTY VALUE CALCULATIONS
// ============================================================================
/**
 * Apply dynasty adjustments to calculated auction values
 *
 * Dynasty value blends:
 * 1. Steamer projections (short-term production) - uses existing auction values
 * 2. Dynasty rankings (long-term value including age, upside, contract)
 *
 * Key insight: We blend at the DOLLAR level, not the score level.
 * Dynasty adjustments ADD or SUBTRACT from base Steamer value.
 */
function applyDynastyAdjustments(players, dynastyRankings, settings, hitterPoolSize, pitcherPoolSize, hitterBudget, pitcherBudget) {
    var _a, _b;
    var dynastyWeight = (_b = (_a = settings.dynastySettings) === null || _a === void 0 ? void 0 : _a.dynastyWeight) !== null && _b !== void 0 ? _b : 0.5;
    // Match dynasty rankings to projections
    var rankingMap = matchDynastyRankingsToProjections(dynastyRankings, players.map(function (p) { return ({ externalId: p.externalId, name: p.name, team: p.team }); }));
    console.log("[Dynasty] Matched ".concat(rankingMap.size, "/").concat(players.length, " players to dynasty rankings"));
    // Debug: Check if specific players are in dynasty rankings
    var jesusPlayer = players.find(function (p) { return p.name.includes('Jesus Rodriguez'); });
    var rafaelPlayer = players.find(function (p) { return p.name.includes('Rafael Flores'); });
    if (jesusPlayer) {
        var jesusRanking = rankingMap.get(jesusPlayer.externalId);
        console.log("[Dynasty Debug] Jesus Rodriguez - externalId: ".concat(jesusPlayer.externalId, ", matched: ").concat(!!jesusRanking, ", rank: ").concat((jesusRanking === null || jesusRanking === void 0 ? void 0 : jesusRanking.overallRank) || 'N/A'));
    }
    if (rafaelPlayer) {
        var rafaelRanking = rankingMap.get(rafaelPlayer.externalId);
        console.log("[Dynasty Debug] Rafael Flores - externalId: ".concat(rafaelPlayer.externalId, ", matched: ").concat(!!rafaelRanking, ", rank: ").concat((rafaelRanking === null || rafaelRanking === void 0 ? void 0 : rafaelRanking.overallRank) || 'N/A'));
    }
    // Separate hitters and pitchers
    var hitters = players.filter(function (p) { return p.playerType === 'hitter'; });
    var pitchers = players.filter(function (p) { return p.playerType === 'pitcher'; });
    // Calculate blended values - using dollar-based approach
    var adjustedHitters = calculateDynastyAdjustedValuesDollarBased(hitters, rankingMap, dynastyWeight, hitterPoolSize, hitterBudget);
    var adjustedPitchers = calculateDynastyAdjustedValuesDollarBased(pitchers, rankingMap, dynastyWeight, pitcherPoolSize, pitcherBudget);
    return __spreadArray(__spreadArray([], adjustedHitters, true), adjustedPitchers, true);
}
/**
 * Calculate dynasty-adjusted values using BLENDED DOLLAR approach
 *
 * This approach:
 * 1. Calculates a "dynasty dollar value" based purely on dynasty rank
 * 2. Blends dynasty dollars with Steamer dollars based on dynastyWeight
 * 3. Re-normalizes to ensure budget constraints
 *
 * Key insight: Dynasty rank should ADD value for prospects, not just multiply.
 * A #15 dynasty prospect should be worth $25-40+ regardless of their 2025 Steamer projection.
 */
function calculateDynastyAdjustedValuesDollarBased(players, rankingMap, dynastyWeight, poolSize, totalBudget) {
    // Calculate what the #1 dynasty player should be worth in a pure dynasty valuation
    // The #1 overall dynasty player should be worth approximately what the #1 Steamer player would be
    // We'll find the max Steamer value in the pool and use that as our ceiling
    var maxSteamerValue = Math.max.apply(Math, __spreadArray(__spreadArray([], players.slice(0, poolSize).map(function (p) { return p.auctionValue; }), false), [40], false));
    // Dynasty #1 should be worth similar to Steamer #1, maybe slightly higher
    var maxDynastyDollars = Math.round(maxSteamerValue * 1.1);
    // Calculate dynasty adjustments for all players
    var playersWithAdjustments = players.map(function (player) {
        var dynastyRanking = rankingMap.get(player.externalId);
        var steamerValue = player.auctionValue;
        var dynastyDollarValue = 0; // Dollar value based purely on dynasty rank
        var dynastyRank;
        var hasNoDynastyData = false; // Track if player is unranked
        if (dynastyRanking) {
            dynastyRank = dynastyRanking.overallRank;
            // Convert dynasty rank to a dollar value using exponential decay
            // Top players get significantly more value, with diminishing returns
            // Rank 1: ~$55-60 (maxDynastyDollars)
            // Rank 10: ~$35-40
            // Rank 25: ~$22-28
            // Rank 50: ~$14-18
            // Rank 100: ~$8-10
            // Rank 200: ~$4-5
            // Rank 500+: ~$1-2
            // Note: Age adjustment is already baked into dynasty rankings from source
            if (dynastyRank <= 500) {
                // Use logarithmic decay: value = maxDollars * (1 - log(rank) / log(maxRank))
                // This creates a smooth curve where top ranks are worth much more
                var normalizedRank = Math.max(1, dynastyRank);
                var logDecay = Math.log(normalizedRank) / Math.log(500);
                dynastyDollarValue = Math.round(maxDynastyDollars * Math.pow(1 - logDecay, 1.5));
                dynastyDollarValue = Math.max(MIN_AUCTION_VALUE, dynastyDollarValue);
            }
            else {
                dynastyDollarValue = MIN_AUCTION_VALUE;
            }
        }
        else {
            // Player has NO dynasty ranking - they're not in the Harry Knows Ball top 500
            // In dynasty leagues, unranked players should be heavily penalized
            // They're either too old, not good enough, or unknown low-level prospects
            hasNoDynastyData = true;
            dynastyDollarValue = 0;
        }
        // Blend Steamer value with Dynasty dollar value based on dynastyWeight
        // dynastyWeight of 0.65 means: 35% Steamer value + 65% dynasty dollar value
        var adjustedValue = (1 - dynastyWeight) * steamerValue + dynastyWeight * dynastyDollarValue;
        return __assign(__assign({}, player), { dynastyRank: dynastyRank, dynastyValue: dynastyRanking === null || dynastyRanking === void 0 ? void 0 : dynastyRanking.dynastyValue, steamerValue: steamerValue, adjustedValue: adjustedValue, // Temporary field for sorting
            hasNoDynastyData: hasNoDynastyData });
    });
    // CRITICAL: In dynasty leagues, EXCLUDE unranked players from the draft pool entirely
    // Players not in Harry Knows Ball rankings are either:
    // - Low-level minor leaguers with no dynasty value
    // - Older players not worth rostering in dynasty
    // - Unknown prospects that shouldn't be in consideration
    // They should NOT compete for budget allocation with ranked players
    var rankedPlayers = playersWithAdjustments.filter(function (p) { return !p.hasNoDynastyData; });
    var unrankedPlayers = playersWithAdjustments.filter(function (p) { return p.hasNoDynastyData; });
    // Sort ranked players by adjusted value (highest first)
    rankedPlayers.sort(function (a, b) { return b.adjustedValue - a.adjustedValue; });
    // Sort unranked players by their Steamer value (they go after all ranked players)
    unrankedPlayers.sort(function (a, b) { var _a, _b; return ((_a = b.steamerValue) !== null && _a !== void 0 ? _a : 0) - ((_b = a.steamerValue) !== null && _b !== void 0 ? _b : 0); });
    // Combine: all ranked players first, then unranked players
    var sortedPlayers = __spreadArray(__spreadArray([], rankedPlayers, true), unrankedPlayers, true);
    // Now we need to normalize values to fit the budget
    // Get pool players - prioritize ranked players for the pool
    var poolPlayers = sortedPlayers.slice(0, poolSize);
    var totalAdjustedValue = poolPlayers.reduce(function (sum, p) { return sum + Math.max(0, p.adjustedValue); }, 0);
    // Reserve $1 per player in pool
    var reservedDollars = poolSize * MIN_AUCTION_VALUE;
    var distributableDollars = totalBudget - reservedDollars;
    // Assign final dollar values proportionally
    // IMPORTANT: Only RANKED players can be in the draft pool in dynasty leagues
    // Unranked players (hasNoDynastyData === true) are NEVER included in the pool
    var unrankedCount = sortedPlayers.filter(function (p) { return p.hasNoDynastyData; }).length;
    console.log("[Dynasty] Pool size: ".concat(poolSize, ", Ranked: ").concat(sortedPlayers.length - unrankedCount, ", Unranked (excluded): ").concat(unrankedCount));
    var results = sortedPlayers.map(function (player, index) {
        // In dynasty mode, ONLY ranked players can be in the draft pool
        // This prevents random prospects without HKB rankings from appearing
        var isInPool = index < poolSize && !player.hasNoDynastyData;
        var auctionValue = 0;
        // Debug: Log specific players to track why they might appear in pool
        if (player.name.includes('Jesus Rodriguez') || player.name.includes('Rafael Flores')) {
            console.log("[Dynasty Debug] ".concat(player.name, ": index=").concat(index, ", poolSize=").concat(poolSize, ", hasNoDynastyData=").concat(player.hasNoDynastyData, ", isInPool=").concat(isInPool));
        }
        if (isInPool && totalAdjustedValue > 0 && player.adjustedValue > 0) {
            var valueShare = player.adjustedValue / totalAdjustedValue;
            auctionValue = MIN_AUCTION_VALUE + Math.round(valueShare * distributableDollars);
        }
        else if (isInPool) {
            auctionValue = MIN_AUCTION_VALUE;
        }
        // Update tier based on new ranking
        var tier = calculateTierFromRank(index, poolSize);
        // Remove temporary fields (adjustedValue and hasNoDynastyData)
        var _adj = player.adjustedValue, _hasNo = player.hasNoDynastyData, playerWithoutTemp = __rest(player, ["adjustedValue", "hasNoDynastyData"]);
        return __assign(__assign({}, playerWithoutTemp), { auctionValue: auctionValue, tier: tier, isInDraftPool: isInPool });
    });
    // Normalize to ensure exact budget match
    var playersInPool = results.filter(function (p) { return p.isInDraftPool; });
    var totalAllocated = playersInPool.reduce(function (sum, p) { return sum + p.auctionValue; }, 0);
    if (totalAllocated !== totalBudget && playersInPool.length > 0) {
        var difference = totalBudget - totalAllocated;
        var topPlayer = playersInPool[0];
        if (topPlayer) {
            topPlayer.auctionValue = Math.max(MIN_AUCTION_VALUE, topPlayer.auctionValue + difference);
        }
    }
    return results;
}
/**
 * Calculate age-based value adjustment for dynasty leagues
 *
 * Young players get a premium (more peak years ahead)
 * Older players get a discount (decline curve approaching)
 */
function calculateAgeAdjustment(age) {
    if (age < 23) {
        // Very young - high upside but also more risk
        return 1.12;
    }
    else if (age < 26) {
        // Young prime - best years ahead
        return 1.15;
    }
    else if (age < 28) {
        // Early prime - peak production expected
        return 1.08;
    }
    else if (age < 30) {
        // Prime years - still valuable
        return 1.0;
    }
    else if (age < 32) {
        // Late prime - some decline expected
        return 0.92;
    }
    else if (age < 35) {
        // Decline phase
        return 0.82;
    }
    else {
        // Late career - significant decline risk
        return 0.70;
    }
}
/**
 * Calculate tier from rank position
 */
function calculateTierFromRank(rank, poolSize) {
    if (rank >= poolSize)
        return 10;
    if (poolSize === 0)
        return 10;
    return Math.min(10, Math.ceil(((rank + 1) / poolSize) * 10));
}

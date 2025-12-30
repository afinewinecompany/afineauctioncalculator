var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/**
 * Historical inflation baselines from Couch Managers auction analysis
 * Based on analysis of 6 auctions with ~500 players each
 * Generated: 2025-12-24
 */
export var HISTORICAL_INFLATION_BASELINES = {
    // Overall statistics
    overall: {
        avgInflationRate: 20.33,
        stdDeviation: 44.83,
        minInflationRate: -28.04,
        maxInflationRate: 100.62,
    },
    // Tier-based inflation (Tier 1 = top 10%, Tier 10 = bottom 10%)
    // Key insight: Elite players (Tier 1) are DEFLATED, low-value players are extremely inflated
    byTier: {
        1: { avgInflation: -19.84, stdDev: 33.26, label: 'Elite (top 10%)' },
        2: { avgInflation: 21.93, stdDev: 37.58, label: 'Star' },
        3: { avgInflation: 59.39, stdDev: 35.22, label: 'Quality starter' },
        4: { avgInflation: 548.34, stdDev: 283.55, label: 'Above average' },
        5: { avgInflation: 1000.43, stdDev: 457.18, label: 'Average' },
        6: { avgInflation: 952.83, stdDev: 639.43, label: 'Below average' },
        7: { avgInflation: 1580.36, stdDev: 594.38, label: 'Roster filler' },
        8: { avgInflation: 1090.76, stdDev: 349.72, label: 'Deep bench' },
        9: { avgInflation: 1365.35, stdDev: 604.95, label: 'Speculative' },
        10: { avgInflation: 1100.30, stdDev: 244.64, label: 'Lottery ticket' },
    },
    // Position-based inflation patterns
    // Key insight: Pitching positions (especially RP, SP) and MiLB are heavily inflated
    byPosition: {
        MiLB: { avgInflation: 1347.40, stdDev: 719.12, trend: 'severely_inflated' },
        RP: { avgInflation: 974.62, stdDev: 1506.02, trend: 'severely_inflated' },
        SP: { avgInflation: 870.42, stdDev: 464.67, trend: 'severely_inflated' },
        C: { avgInflation: 268.48, stdDev: 125.35, trend: 'highly_inflated' },
        '2B': { avgInflation: 153.76, stdDev: 109.11, trend: 'moderately_inflated' },
        '3B': { avgInflation: 128.25, stdDev: 91.11, trend: 'moderately_inflated' },
        OF: { avgInflation: 83.86, stdDev: 72.57, trend: 'slightly_inflated' },
        '1B': { avgInflation: 83.73, stdDev: 78.59, trend: 'slightly_inflated' },
        SS: { avgInflation: 76.35, stdDev: 85.37, trend: 'slightly_inflated' },
        DH: { avgInflation: 69.42, stdDev: 56.79, trend: 'slightly_inflated' },
    },
    // Price range inflation patterns
    // Key insight: Low-value players have EXTREME inflation, elite players are often discounted
    byPriceRange: {
        '$1-$5': { avgInflation: 991.64, stdDev: 374.33, trend: 'extreme' },
        '$6-$15': { avgInflation: 74.42, stdDev: 53.03, trend: 'moderate' },
        '$16-$30': { avgInflation: 18.23, stdDev: 36.55, trend: 'normal' },
        '$31+': { avgInflation: -17.54, stdDev: 36.13, trend: 'deflated' },
    },
};
/**
 * Gets historical inflation context for a player based on their tier and value
 */
export function getHistoricalInflationContext(projectedValue, tier, positions) {
    var _a, _b, _c;
    // Determine price range
    var priceRange;
    if (projectedValue <= 5)
        priceRange = '$1-$5';
    else if (projectedValue <= 15)
        priceRange = '$6-$15';
    else if (projectedValue <= 30)
        priceRange = '$16-$30';
    else
        priceRange = '$31+';
    var priceRangeData = HISTORICAL_INFLATION_BASELINES.byPriceRange[priceRange];
    var tierData = tier ? HISTORICAL_INFLATION_BASELINES.byTier[tier] : null;
    // Get position trend (use highest inflation position for multi-position players)
    var positionTrend = 'unknown';
    var maxPositionInflation = 0;
    positions === null || positions === void 0 ? void 0 : positions.forEach(function (pos) {
        var posData = HISTORICAL_INFLATION_BASELINES.byPosition[pos];
        if (posData && posData.avgInflation > maxPositionInflation) {
            maxPositionInflation = posData.avgInflation;
            positionTrend = posData.trend;
        }
    });
    // Calculate expected inflation (weighted by price range primarily)
    var expectedInflation = (_a = priceRangeData === null || priceRangeData === void 0 ? void 0 : priceRangeData.avgInflation) !== null && _a !== void 0 ? _a : HISTORICAL_INFLATION_BASELINES.overall.avgInflationRate;
    // Generate recommendation
    var recommendation;
    if (projectedValue >= 31) {
        recommendation = 'Elite players typically go BELOW projections. Be patient and wait for value.';
    }
    else if (projectedValue <= 5) {
        recommendation = 'Low-value players see extreme inflation. Only bid on must-haves or wait for late-draft steals.';
    }
    else if (projectedValue <= 15) {
        recommendation = 'Mid-tier players see moderate inflation. Budget 50-75% extra for targets.';
    }
    else {
        recommendation = 'Quality players see slight inflation. Budget 10-20% extra.';
    }
    return {
        expectedInflation: expectedInflation,
        priceRangeTrend: (_b = priceRangeData === null || priceRangeData === void 0 ? void 0 : priceRangeData.trend) !== null && _b !== void 0 ? _b : 'unknown',
        tierLabel: (_c = tierData === null || tierData === void 0 ? void 0 : tierData.label) !== null && _c !== void 0 ? _c : 'Unknown tier',
        positionTrend: positionTrend,
        recommendation: recommendation,
    };
}
/**
 * Calculates effective budget for each team, accounting for mandatory $1 reserves.
 *
 * A team with $50 remaining but 10 open roster spots only has $41 of
 * "spendable" money (50 - (10-1)*$1 reserve for remaining spots).
 */
export function calculateEffectiveBudget(teams, leagueConfig) {
    var totalRosterSpots = leagueConfig.totalRosterSpots;
    return teams.map(function (team) {
        var rosterSpotsRemaining = Math.max(0, totalRosterSpots - team.playersDrafted);
        // Reserve $1 for each remaining spot except one (the current bid slot)
        var mandatoryReserve = Math.max(0, rosterSpotsRemaining - 1) * 1;
        var effectiveBudget = Math.max(0, team.remaining - mandatoryReserve);
        return {
            teamName: team.name,
            rawRemaining: team.remaining,
            rosterSpotsRemaining: rosterSpotsRemaining,
            effectiveBudget: effectiveBudget,
            // Teams typically won't bid more than 50% of effective budget on one player
            canAffordThreshold: effectiveBudget * 0.5,
        };
    });
}
/**
 * Calculates positional scarcity based on available players vs league need.
 *
 * Multi-position players count toward ALL their eligible positions.
 * Quality threshold is top 50% by projected value at each position.
 *
 * ENHANCEMENT: Now incorporates historical position inflation data from auction analysis.
 * Positions with historically high inflation (SP, RP, MiLB) get additional adjustments.
 */
export function calculatePositionalScarcity(matchedPlayers, leagueConfig) {
    // All positions that might have roster slots
    var positions = ['C', '1B', '2B', '3B', 'SS', 'OF', 'CI', 'MI', 'UTIL', 'SP', 'RP', 'P', 'Bench'];
    // Get available players with projected values
    var available = matchedPlayers.filter(function (p) { return p.scrapedPlayer.status !== 'drafted' && p.projectedValue !== null && p.projectedValue > 0; });
    // Get drafted players for need calculation
    var drafted = matchedPlayers.filter(function (p) { return p.scrapedPlayer.status === 'drafted'; });
    return positions
        .filter(function (pos) {
        var _a, _b;
        // Only include positions that have roster slots
        var slots = (_b = (_a = leagueConfig.rosterSpots) === null || _a === void 0 ? void 0 : _a[pos]) !== null && _b !== void 0 ? _b : 0;
        return slots > 0;
    })
        .map(function (pos) {
        var _a, _b;
        // Players at this position (multi-position counts toward all)
        var atPosition = available.filter(function (p) { return p.scrapedPlayer.positions.includes(pos); });
        // Quality threshold: top 50% by projected value at this position
        var sortedByValue = __spreadArray([], atPosition, true).sort(function (a, b) { var _a, _b; return ((_a = b.projectedValue) !== null && _a !== void 0 ? _a : 0) - ((_b = a.projectedValue) !== null && _b !== void 0 ? _b : 0); });
        var qualityCount = Math.ceil(sortedByValue.length / 2);
        // League need: total slots at position minus drafted at position
        var draftedAtPosition = drafted.filter(function (p) { return p.scrapedPlayer.positions.includes(pos); }).length;
        var slotsPerTeam = (_b = (_a = leagueConfig.rosterSpots) === null || _a === void 0 ? void 0 : _a[pos]) !== null && _b !== void 0 ? _b : 0;
        var totalSlotsAtPosition = leagueConfig.numTeams * slotsPerTeam;
        var leagueNeed = Math.max(0, totalSlotsAtPosition - draftedAtPosition);
        // Scarcity ratio: how many teams need vs how many quality players available
        var scarcityRatio = qualityCount > 0 ? leagueNeed / qualityCount : leagueNeed > 0 ? 999 : 0;
        // Get historical position inflation data
        var historicalData = HISTORICAL_INFLATION_BASELINES.byPosition[pos];
        // Determine level and adjustment, incorporating historical data
        var scarcityLevel;
        var inflationAdjustment;
        // Base scarcity adjustment from current supply/demand
        if (scarcityRatio >= 2.0) {
            scarcityLevel = 'severe';
            inflationAdjustment = 1.25; // +25%
        }
        else if (scarcityRatio >= 1.0) {
            scarcityLevel = 'moderate';
            inflationAdjustment = 1.12; // +12%
        }
        else if (scarcityRatio >= 0.5) {
            scarcityLevel = 'normal';
            inflationAdjustment = 1.0; // No adjustment
        }
        else {
            scarcityLevel = 'surplus';
            inflationAdjustment = 0.95; // -5%
        }
        // Apply historical position premium for notoriously inflated positions
        // This reflects observed auction behavior (SP/RP/MiLB consistently overbid)
        if (historicalData) {
            if (historicalData.trend === 'severely_inflated') {
                // SP, RP, MiLB: Add 15% on top of scarcity adjustment (observed 800-1300% inflation historically)
                inflationAdjustment *= 1.15;
                // Bump scarcity level if not already severe
                if (scarcityLevel === 'normal')
                    scarcityLevel = 'moderate';
            }
            else if (historicalData.trend === 'highly_inflated') {
                // C: Add 10% on top (observed 268% inflation historically)
                inflationAdjustment *= 1.10;
            }
            else if (historicalData.trend === 'moderately_inflated') {
                // 2B, 3B: Add 5% on top (observed 128-153% inflation historically)
                inflationAdjustment *= 1.05;
            }
            // 'slightly_inflated' positions (OF, 1B, SS, DH) don't get additional adjustment
        }
        return {
            position: pos,
            availableCount: atPosition.length,
            qualityCount: qualityCount,
            leagueNeed: leagueNeed,
            scarcityRatio: Math.round(scarcityRatio * 100) / 100,
            scarcityLevel: scarcityLevel,
            inflationAdjustment: Math.round(inflationAdjustment * 100) / 100,
        };
    });
}
/**
 * Calculates competition factor based on how many teams can afford a player.
 *
 * Uses moderate weighting: teams with tighter budgets get reduced weight,
 * but aren't completely excluded unless they literally can't afford the player.
 */
export function calculateCompetitionFactor(playerValue, teamConstraints) {
    if (teamConstraints.length === 0)
        return 1.0;
    // Count teams that can afford this player
    var teamsCanAfford = teamConstraints.filter(function (t) { return t.effectiveBudget >= playerValue; });
    if (teamsCanAfford.length === 0)
        return 0.25; // Minimum factor if no one can afford
    // Calculate weighted bidding capacity
    var totalCapacity = 0;
    teamsCanAfford.forEach(function (t) {
        // Weight by how much of their budget they'd need
        var budgetPercentNeeded = playerValue / t.effectiveBudget;
        // Teams with more slack get higher weight (moderate approach)
        var weight = Math.max(0.1, 1 - budgetPercentNeeded * 0.5);
        totalCapacity += weight;
    });
    // Normalize: if all teams can easily afford, factor approaches 1.0
    var maxPossibleCapacity = teamConstraints.length;
    return Math.min(1.0, totalCapacity / maxPossibleCapacity);
}
/**
 * Calculates dampened weight for a player based on their projected value.
 *
 * Low-value players ($1-$2) have extreme inflation percentages that can
 * distort tier-weighted averages. This dampens their influence:
 * - $1-$2 players: 75% reduction (weight = value * 0.25)
 * - $3-$5 players: 50% reduction (weight = value * 0.5)
 * - $6+ players: full weight
 */
function getDampenedWeight(projectedValue) {
    if (projectedValue <= 2) {
        return projectedValue * 0.25; // 75% reduction
    }
    else if (projectedValue <= 5) {
        return projectedValue * 0.5; // 50% reduction
    }
    return projectedValue; // Full weight
}
/**
 * Calculates enhanced inflation statistics with positional scarcity and team constraints.
 *
 * Key features:
 * 1. Tier-weighted inflation with dampened low-value player influence
 * 2. Effective budget calculation (accounting for $1 reserves)
 * 3. Positional scarcity analysis
 * 4. Team budget constraint tracking
 *
 * For remaining budget adjustments:
 * Uses EFFECTIVE remaining budget (not raw) for forward-looking inflation.
 */
export function calculateInflationStats(matchedPlayers, leagueConfig, teams) {
    // Filter to only drafted players with both actual bid and projected value
    var draftedWithValues = matchedPlayers.filter(function (p) {
        return p.scrapedPlayer.status === 'drafted' &&
            p.actualBid !== null &&
            p.projectedValue !== null &&
            p.projectedValue > 0;
    });
    // Initialize tier data (tiers 1-10)
    var tierData = new Map();
    for (var i = 1; i <= 10; i++) {
        tierData.set(i, {
            tier: i,
            draftedCount: 0,
            totalProjectedValue: 0,
            totalActualSpent: 0,
            inflationRate: 0,
        });
    }
    // Calculate team constraints if teams data provided
    var teamConstraints = teams ? calculateEffectiveBudget(teams, leagueConfig) : [];
    var leagueEffectiveBudget = teamConstraints.reduce(function (sum, t) { return sum + t.effectiveBudget; }, 0);
    // Calculate positional scarcity
    var positionalScarcity = calculatePositionalScarcity(matchedPlayers, leagueConfig);
    // Empty state return
    if (draftedWithValues.length === 0) {
        var totalLeagueBudget_1 = leagueConfig.numTeams * leagueConfig.budgetPerTeam;
        // Calculate league-wide reserve: each team needs $1 per remaining roster spot (minus 1)
        var totalRosterSpots_1 = leagueConfig.totalRosterSpots * leagueConfig.numTeams;
        var leagueReserve_1 = Math.max(0, totalRosterSpots_1 - leagueConfig.numTeams) * 1; // Reserve for all unfilled spots
        var effectiveRemainingBudget = Math.max(0, totalLeagueBudget_1 - leagueReserve_1);
        // Calculate remaining projected value from undrafted players
        var undraftedPlayers = matchedPlayers.filter(function (p) { return p.scrapedPlayer.status !== 'drafted' && p.projectedValue !== null && p.projectedValue > 0; });
        var remainingProjectedValue_1 = undraftedPlayers.reduce(function (sum, p) { var _a; return sum + ((_a = p.projectedValue) !== null && _a !== void 0 ? _a : 0); }, 0);
        return {
            overallInflationRate: 0,
            totalProjectedValue: 0,
            totalActualSpent: 0,
            draftedPlayersCount: 0,
            averageInflationPerPlayer: 0,
            remainingBudgetInflationAdjustment: 0,
            tierInflation: Array.from(tierData.values()),
            weightedInflationRate: 0,
            positionalScarcity: positionalScarcity,
            teamConstraints: teamConstraints,
            leagueEffectiveBudget: effectiveRemainingBudget,
            adjustedRemainingBudget: effectiveRemainingBudget,
            remainingProjectedValue: remainingProjectedValue_1,
        };
    }
    // Process drafted players by tier
    // Tier 1 = top 10% by value, Tier 10 = bottom 10%
    var sortedDrafted = __spreadArray([], draftedWithValues, true).sort(function (a, b) { var _a, _b; return ((_a = b.projectedValue) !== null && _a !== void 0 ? _a : 0) - ((_b = a.projectedValue) !== null && _b !== void 0 ? _b : 0); });
    draftedWithValues.forEach(function (player) {
        var _a, _b;
        // Determine tier based on relative position in sorted list
        // Uses percentile-based assignment for consistent tier sizes regardless of pool size
        var rankIndex = sortedDrafted.findIndex(function (p) { return p === player; });
        var tier = sortedDrafted.length > 0
            ? Math.min(10, Math.ceil(((rankIndex + 1) / sortedDrafted.length) * 10))
            : 10;
        var data = tierData.get(tier);
        data.draftedCount++;
        data.totalProjectedValue += (_a = player.projectedValue) !== null && _a !== void 0 ? _a : 0;
        data.totalActualSpent += (_b = player.actualBid) !== null && _b !== void 0 ? _b : 0;
    });
    // Calculate inflation rate for each tier
    tierData.forEach(function (data) {
        if (data.totalProjectedValue > 0) {
            data.inflationRate =
                ((data.totalActualSpent - data.totalProjectedValue) / data.totalProjectedValue) * 100;
        }
    });
    // Calculate weighted average inflation with DAMPENED weights for low-value players
    var totalWeight = 0;
    var weightedInflationSum = 0;
    draftedWithValues.forEach(function (player) {
        var _a, _b;
        var projectedValue = (_a = player.projectedValue) !== null && _a !== void 0 ? _a : 0;
        var actualBid = (_b = player.actualBid) !== null && _b !== void 0 ? _b : 0;
        // Calculate individual player inflation
        var playerInflation = projectedValue > 0 ? ((actualBid - projectedValue) / projectedValue) * 100 : 0;
        // Apply dampened weight
        var weight = getDampenedWeight(projectedValue);
        totalWeight += weight;
        weightedInflationSum += playerInflation * weight;
    });
    var weightedInflationRate = totalWeight > 0 ? weightedInflationSum / totalWeight : 0;
    var totalProjectedValue = draftedWithValues.reduce(function (sum, p) { var _a; return sum + ((_a = p.projectedValue) !== null && _a !== void 0 ? _a : 0); }, 0);
    var totalActualSpent = draftedWithValues.reduce(function (sum, p) { var _a; return sum + ((_a = p.actualBid) !== null && _a !== void 0 ? _a : 0); }, 0);
    var draftedPlayersCount = draftedWithValues.length;
    // Average inflation per player (using dampened calculation)
    var averageInflationPerPlayer = draftedPlayersCount > 0 ? weightedInflationRate / draftedPlayersCount : 0;
    // Calculate remaining budget using raw remaining minus league-wide reserves
    // IMPORTANT: We use rawRemainingBudget (total budget - total spent), NOT the sum of team effective budgets
    // The sum of team effective budgets can be incorrect when team spending data is incomplete from scraping
    var totalLeagueBudget = leagueConfig.numTeams * leagueConfig.budgetPerTeam;
    var rawRemainingBudget = totalLeagueBudget - totalActualSpent;
    // Calculate league-wide reserve requirement
    // Each team needs $1 per remaining roster spot (minus 1 for current bid)
    var totalRosterSpots = leagueConfig.totalRosterSpots;
    var playersRemainingToDraft = (totalRosterSpots * leagueConfig.numTeams) - draftedPlayersCount;
    var leagueReserve = Math.max(0, playersRemainingToDraft - leagueConfig.numTeams) * 1;
    var adjustedRemainingBudget = Math.max(0, rawRemainingBudget - leagueReserve);
    // Get total projected value of undrafted matched players
    var undraftedWithValues = matchedPlayers.filter(function (p) {
        return p.scrapedPlayer.status !== 'drafted' && p.projectedValue !== null && p.projectedValue > 0;
    });
    var remainingProjectedValue = undraftedWithValues.reduce(function (sum, p) { var _a; return sum + ((_a = p.projectedValue) !== null && _a !== void 0 ? _a : 0); }, 0);
    // Remaining budget inflation adjustment using EFFECTIVE budget
    var remainingBudgetInflationAdjustment = remainingProjectedValue > 0
        ? ((adjustedRemainingBudget / remainingProjectedValue) - 1) * 100
        : 0;
    return {
        overallInflationRate: weightedInflationRate, // Dampened weighted rate as main rate
        totalProjectedValue: totalProjectedValue,
        totalActualSpent: totalActualSpent,
        draftedPlayersCount: draftedPlayersCount,
        averageInflationPerPlayer: averageInflationPerPlayer,
        remainingBudgetInflationAdjustment: remainingBudgetInflationAdjustment,
        tierInflation: Array.from(tierData.values()),
        weightedInflationRate: weightedInflationRate,
        positionalScarcity: positionalScarcity,
        teamConstraints: teamConstraints,
        leagueEffectiveBudget: adjustedRemainingBudget, // Use the correctly calculated value
        adjustedRemainingBudget: adjustedRemainingBudget,
        remainingProjectedValue: remainingProjectedValue,
    };
}
/**
 * Adjusts a player's projected value based on the current inflation rate.
 */
export function adjustValueForInflation(projectedValue, inflationRate) {
    // Inflation rate is in percentage, convert to multiplier
    var inflationMultiplier = 1 + inflationRate / 100;
    return Math.round(projectedValue * inflationMultiplier * 10) / 10;
}
/**
 * Determines the inflation severity level for UI display.
 */
export function getInflationLevel(inflationRate) {
    if (inflationRate < 5)
        return 'low';
    if (inflationRate < 15)
        return 'moderate';
    if (inflationRate < 30)
        return 'high';
    return 'very_high';
}
/**
 * Calculates the value difference indicator for a single player.
 * Returns a string like "+$5" or "-$3" for display.
 */
export function getValueDifferenceDisplay(actualBid, projectedValue) {
    if (actualBid === null || projectedValue === null) {
        return '--';
    }
    var difference = actualBid - projectedValue;
    if (difference >= 0) {
        return "+$".concat(difference.toFixed(0));
    }
    return "-$".concat(Math.abs(difference).toFixed(0));
}

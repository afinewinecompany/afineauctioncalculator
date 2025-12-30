/**
 * Normalizes a player name by removing diacritics, punctuation, and converting to lowercase.
 * Examples:
 * - "Félix Bautista" → "felix bautista"
 * - "Ronald Acuña Jr." → "ronald acuna jr"
 * - "J.T. Realmuto" → "jt realmuto"
 */
export function normalizeName(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
        .toLowerCase()
        .replace(/\./g, '') // Remove periods (J.T. → JT)
        .replace(/[^a-z\s]/g, '') // Remove other punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}
/**
 * Normalizes team abbreviations to a consistent format
 */
export function normalizeTeam(team) {
    var teamMap = {
        // Common variations
        'ARI': 'ARI', 'ARZ': 'ARI', 'AZ': 'ARI',
        'ATL': 'ATL',
        'BAL': 'BAL',
        'BOS': 'BOS',
        'CHC': 'CHC', 'CHN': 'CHC',
        'CHW': 'CHW', 'CWS': 'CHW', 'CHA': 'CHW',
        'CIN': 'CIN',
        'CLE': 'CLE',
        'COL': 'COL',
        'DET': 'DET',
        'HOU': 'HOU',
        'KC': 'KC', 'KCR': 'KC',
        'LAA': 'LAA', 'ANA': 'LAA',
        'LAD': 'LAD', 'LA': 'LAD',
        'MIA': 'MIA', 'FLA': 'MIA',
        'MIL': 'MIL',
        'MIN': 'MIN',
        'NYM': 'NYM',
        'NYY': 'NYY',
        'OAK': 'OAK',
        'PHI': 'PHI',
        'PIT': 'PIT',
        'SD': 'SD', 'SDP': 'SD',
        'SF': 'SF', 'SFG': 'SF',
        'SEA': 'SEA',
        'STL': 'STL',
        'TB': 'TB', 'TBR': 'TB', 'TAM': 'TB',
        'TEX': 'TEX',
        'TOR': 'TOR',
        'WAS': 'WAS', 'WSH': 'WAS', 'WSN': 'WAS',
    };
    var upper = team.toUpperCase();
    return teamMap[upper] || upper;
}
/**
 * Attempts to match a scraped player from Couch Managers to a projection player.
 * Uses normalized name matching with team as a tiebreaker.
 */
export function matchPlayer(scrapedPlayer, projections) {
    var normalizedScraped = normalizeName(scrapedPlayer.fullName);
    var scrapedTeam = normalizeTeam(scrapedPlayer.mlbTeam);
    // First pass: exact name match
    var exactMatches = projections.filter(function (p) { return normalizeName(p.name) === normalizedScraped; });
    if (exactMatches.length === 1) {
        return { player: exactMatches[0], confidence: 'exact' };
    }
    // If multiple exact matches, use team to disambiguate
    if (exactMatches.length > 1) {
        var teamMatch = exactMatches.find(function (p) { return normalizeTeam(p.team) === scrapedTeam; });
        if (teamMatch) {
            return { player: teamMatch, confidence: 'exact' };
        }
        // Return first match if team doesn't help
        return { player: exactMatches[0], confidence: 'partial' };
    }
    // Second pass: partial name matching (for nicknames, suffixes, etc.)
    // Try matching without common suffixes
    var withoutSuffix = normalizedScraped
        .replace(/\s+(jr|sr|ii|iii|iv)$/, '')
        .trim();
    var partialMatches = projections.filter(function (p) {
        var projName = normalizeName(p.name).replace(/\s+(jr|sr|ii|iii|iv)$/, '').trim();
        return projName === withoutSuffix;
    });
    if (partialMatches.length === 1) {
        return { player: partialMatches[0], confidence: 'partial' };
    }
    if (partialMatches.length > 1) {
        var teamMatch = partialMatches.find(function (p) { return normalizeTeam(p.team) === scrapedTeam; });
        if (teamMatch) {
            return { player: teamMatch, confidence: 'partial' };
        }
        return { player: partialMatches[0], confidence: 'partial' };
    }
    // Third pass: check if last name + team matches (for players with different first name formats)
    var lastNameParts = normalizedScraped.split(' ');
    if (lastNameParts.length >= 2) {
        var lastName_1 = lastNameParts[lastNameParts.length - 1];
        var lastNameMatches = projections.filter(function (p) {
            var projLastName = normalizeName(p.name).split(' ').pop();
            return projLastName === lastName_1 && normalizeTeam(p.team) === scrapedTeam;
        });
        if (lastNameMatches.length === 1) {
            return { player: lastNameMatches[0], confidence: 'partial' };
        }
    }
    return { player: null, confidence: 'unmatched' };
}
/**
 * Matches all scraped players against projections and returns matched results.
 */
export function matchAllPlayers(scrapedPlayers, projections) {
    var _a;
    var matched = [];
    var unmatched = [];
    for (var _i = 0, scrapedPlayers_1 = scrapedPlayers; _i < scrapedPlayers_1.length; _i++) {
        var scraped = scrapedPlayers_1[_i];
        var _b = matchPlayer(scraped, projections), player = _b.player, confidence = _b.confidence;
        if (player && confidence !== 'unmatched') {
            var actualBid = (_a = scraped.winningBid) !== null && _a !== void 0 ? _a : null;
            var projectedValue = player.projectedValue;
            var inflationAmount = null;
            var inflationPercent = null;
            if (actualBid !== null && projectedValue > 0) {
                inflationAmount = actualBid - projectedValue;
                inflationPercent = ((actualBid - projectedValue) / projectedValue) * 100;
            }
            matched.push({
                scrapedPlayer: scraped,
                projectionPlayerId: player.id,
                projectedValue: projectedValue,
                actualBid: actualBid,
                inflationAmount: inflationAmount,
                inflationPercent: inflationPercent,
                matchConfidence: confidence,
            });
        }
        else {
            unmatched.push(scraped);
        }
    }
    return { matched: matched, unmatched: unmatched };
}

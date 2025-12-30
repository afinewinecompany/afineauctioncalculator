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
import puppeteer from 'puppeteer';
import { normalizeName } from './playerMatcher';
// Browser instance for reuse
var browserInstance = null;
function getBrowser() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(!browserInstance || !browserInstance.connected)) return [3 /*break*/, 2];
                    return [4 /*yield*/, puppeteer.launch({
                            headless: true,
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-dev-shm-usage',
                                '--disable-accelerated-2d-canvas',
                                '--disable-gpu',
                            ],
                        })];
                case 1:
                    browserInstance = _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, browserInstance];
            }
        });
    });
}
export function closeBrowser() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!browserInstance) return [3 /*break*/, 2];
                    return [4 /*yield*/, browserInstance.close()];
                case 1:
                    _a.sent();
                    browserInstance = null;
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
/**
 * Pre-warms the browser instance on server startup.
 * This saves ~2-5 seconds on the first scrape request.
 */
export function prewarmBrowser() {
    return __awaiter(this, void 0, void 0, function () {
        var startTime;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('[Scraper] Pre-warming browser instance...');
                    startTime = Date.now();
                    return [4 /*yield*/, getBrowser()];
                case 1:
                    _a.sent();
                    console.log("[Scraper] Browser pre-warmed in ".concat(Date.now() - startTime, "ms"));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Scrapes auction data from Couch Managers for a given room ID.
 *
 * The page uses JavaScript arrays:
 * - playerArray[id] = new Player(id, firstname, lastname, pos1, pos2, pos3, pos4, team, stat1-5, drafted, open, queued, ...)
 * - auctionArray contains current auction info: playerid, teamname, amount, time, sold
 * - passed_array contains IDs of passed players
 */
export function scrapeAuction(roomId) {
    return __awaiter(this, void 0, void 0, function () {
        var browser, page, url, response, scrapedData, playersWithNormalizedNames, result, debugInfo, draftedSample, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBrowser()];
                case 1:
                    browser = _a.sent();
                    return [4 /*yield*/, browser.newPage()];
                case 2:
                    page = _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 8, 9, 11]);
                    // Set a reasonable viewport
                    return [4 /*yield*/, page.setViewport({ width: 1280, height: 800 })];
                case 4:
                    // Set a reasonable viewport
                    _a.sent();
                    url = "https://www.couchmanagers.com/auctions/?auction_id=".concat(roomId);
                    return [4 /*yield*/, page.goto(url, {
                            waitUntil: 'domcontentloaded',
                            timeout: 30000,
                        })];
                case 5:
                    response = _a.sent();
                    if (!response || response.status() === 404) {
                        return [2 /*return*/, {
                                roomId: roomId,
                                scrapedAt: new Date().toISOString(),
                                status: 'not_found',
                                players: [],
                                teams: [],
                                totalPlayersDrafted: 0,
                                totalMoneySpent: 0,
                            }];
                    }
                    // Wait for the playerArray to be populated
                    return [4 /*yield*/, page.waitForFunction(function () { return typeof window.playerArray !== 'undefined' && Object.keys(window.playerArray).length > 0; }, { timeout: 15000 })];
                case 6:
                    // Wait for the playerArray to be populated
                    _a.sent();
                    return [4 /*yield*/, page.evaluate(function () {
                            var _a, _b;
                            var win = window;
                            // Extract players from playerArray
                            var players = [];
                            var playerArray = win.playerArray || {};
                            var passedArray = win.passed_array || [];
                            var auctionArray = win.auctionArray || {};
                            var rosterArray = win.rosterArray || [];
                            // Clean team names - normalize whitespace and trim
                            function cleanTeamName(name) {
                                if (!name)
                                    return '';
                                return name.trim().replace(/\s+/g, ' ');
                            }
                            // DEBUG: Capture auction structure to understand data format
                            var debugInfo = {
                                auctionCount: 0,
                                rosterArrayLength: rosterArray.length,
                                sampleAuction: null,
                                playerHighestBidMapSize: 0,
                                rosterMappedPlayers: 0,
                                draftedPlayersWithTeams: 0,
                                draftedPlayersWithoutTeams: 0,
                                teamNameSources: [],
                            };
                            var auctionKeys = Object.keys(auctionArray);
                            debugInfo.auctionCount = auctionKeys.length;
                            if (auctionKeys.length > 0) {
                                debugInfo.sampleAuction = auctionArray[auctionKeys[0]];
                            }
                            // ========================================
                            // STRATEGY: Use rosterArray for player->team mapping
                            // rosterArray is indexed by team number (1-based)
                            // Each entry has rosterspot: [playerId1, playerId2, ...]
                            // ========================================
                            // Step 1: Build team index -> team name mapping from multiple sources
                            var teamIndexToName = {};
                            // Source A (BEST): Extract from <option value="N">TeamName</option> in any select dropdown
                            // The Couch Managers page has a select dropdown with team options
                            var selectOptions = document.querySelectorAll('select option');
                            selectOptions.forEach(function (option) {
                                var _a;
                                var value = option.getAttribute('value');
                                var text = (_a = option.innerText) === null || _a === void 0 ? void 0 : _a.trim();
                                if (value && text && /^\d+$/.test(value) && text.length > 1 && text.length < 50) {
                                    var teamIndex = Number(value);
                                    if (teamIndex > 0 && !teamIndexToName[teamIndex]) {
                                        teamIndexToName[teamIndex] = cleanTeamName(text);
                                    }
                                }
                            });
                            if (Object.keys(teamIndexToName).length > 0) {
                                debugInfo.teamNameSources.push('select options');
                            }
                            // Source B: Extract from players_taken_table (3rd column has team names)
                            // This catches any teams that might not be in the dropdown
                            if (Object.keys(teamIndexToName).length < 10) {
                                var playersTakenTable = document.getElementById('players_taken_table');
                                if (playersTakenTable) {
                                    var uniqueTeamNames_2 = [];
                                    var rows = playersTakenTable.querySelectorAll('tbody tr');
                                    rows.forEach(function (row) {
                                        var cells = row.querySelectorAll('td');
                                        if (cells.length >= 3) {
                                            var teamName = cleanTeamName(cells[2].innerText || '');
                                            if (teamName && !uniqueTeamNames_2.includes(teamName)) {
                                                uniqueTeamNames_2.push(teamName);
                                            }
                                        }
                                    });
                                    // Map to indices if not already in teamIndexToName
                                    var nextIndex = Object.keys(teamIndexToName).length + 1;
                                    var _loop_1 = function (name_1) {
                                        var existingIndex = Object.entries(teamIndexToName).find(function (_a) {
                                            var idx = _a[0], n = _a[1];
                                            return n === name_1;
                                        });
                                        if (!existingIndex) {
                                            teamIndexToName[nextIndex] = name_1;
                                            nextIndex++;
                                        }
                                    };
                                    for (var _i = 0, uniqueTeamNames_1 = uniqueTeamNames_2; _i < uniqueTeamNames_1.length; _i++) {
                                        var name_1 = uniqueTeamNames_1[_i];
                                        _loop_1(name_1);
                                    }
                                    if (uniqueTeamNames_2.length > 0) {
                                        debugInfo.teamNameSources.push('players_taken_table');
                                    }
                                }
                            }
                            // Source C: Extract unique team names from auctionArray as fallback
                            if (Object.keys(teamIndexToName).length < 10) {
                                var auctionTeamNames = [];
                                for (var _c = 0, _d = Object.keys(auctionArray); _c < _d.length; _c++) {
                                    var key = _d[_c];
                                    var auction = auctionArray[key];
                                    if (auction && auction.teamname) {
                                        var name_2 = cleanTeamName(auction.teamname);
                                        if (name_2 && !auctionTeamNames.includes(name_2)) {
                                            auctionTeamNames.push(name_2);
                                        }
                                    }
                                }
                                var nextIndex = Object.keys(teamIndexToName).length + 1;
                                var _loop_2 = function (name_3) {
                                    var existingIndex = Object.entries(teamIndexToName).find(function (_a) {
                                        var idx = _a[0], n = _a[1];
                                        return n === name_3;
                                    });
                                    if (!existingIndex) {
                                        teamIndexToName[nextIndex] = name_3;
                                        nextIndex++;
                                    }
                                };
                                for (var _e = 0, auctionTeamNames_1 = auctionTeamNames; _e < auctionTeamNames_1.length; _e++) {
                                    var name_3 = auctionTeamNames_1[_e];
                                    _loop_2(name_3);
                                }
                                if (auctionTeamNames.length > 0) {
                                    debugInfo.teamNameSources.push('auctionArray');
                                }
                            }
                            // Step 2: Build player -> team mapping from rosterArray
                            var playerToTeam = {};
                            for (var teamIndex = 1; teamIndex < rosterArray.length; teamIndex++) {
                                var roster = rosterArray[teamIndex];
                                if (!roster || !roster.rosterspot)
                                    continue;
                                // Get team name (fallback to generic name if not found)
                                var teamName = teamIndexToName[teamIndex] || "Team ".concat(teamIndex);
                                for (var _f = 0, _g = roster.rosterspot; _f < _g.length; _f++) {
                                    var playerId = _g[_f];
                                    if (playerId && playerId !== null && Number(playerId) > 0) {
                                        playerToTeam[Number(playerId)] = teamName;
                                    }
                                }
                            }
                            debugInfo.rosterMappedPlayers = Object.keys(playerToTeam).length;
                            // Step 3: Also build highest bid map from auctionArray (for price data)
                            var playerHighestBidMap = {};
                            var allBidsByPlayer = {};
                            for (var _h = 0, _j = Object.keys(auctionArray); _h < _j.length; _h++) {
                                var key = _j[_h];
                                var auction = auctionArray[key];
                                if (auction && auction.playerid && auction.teamname) {
                                    var playerId = Number(auction.playerid);
                                    var amount = Number(auction.amount) || 0;
                                    var teamname = cleanTeamName(auction.teamname);
                                    if (!allBidsByPlayer[playerId]) {
                                        allBidsByPlayer[playerId] = [];
                                    }
                                    allBidsByPlayer[playerId].push({ teamname: teamname, amount: amount });
                                }
                            }
                            for (var _k = 0, _l = Object.keys(allBidsByPlayer); _k < _l.length; _k++) {
                                var playerIdStr = _l[_k];
                                var playerId = Number(playerIdStr);
                                var bids = allBidsByPlayer[playerId];
                                bids.sort(function (a, b) { return b.amount - a.amount; });
                                if (bids[0]) {
                                    playerHighestBidMap[playerId] = bids[0];
                                }
                            }
                            debugInfo.playerHighestBidMapSize = Object.keys(playerHighestBidMap).length;
                            // Find currently active auctions (players on the block) - only non-sold auctions
                            var activeAuctionPlayerIds = new Set();
                            for (var _m = 0, _o = Object.keys(auctionArray); _m < _o.length; _m++) {
                                var key = _o[_m];
                                var auction = auctionArray[key];
                                // Only include auctions that are not yet sold (i.e., still active)
                                if (auction && auction.playerid && !auction.sold) {
                                    activeAuctionPlayerIds.add(Number(auction.playerid));
                                }
                            }
                            for (var _p = 0, _q = Object.keys(playerArray); _p < _q.length; _p++) {
                                var id = _q[_p];
                                var p = playerArray[id];
                                if (!p)
                                    continue;
                                // Player constructor params based on CM code:
                                // id, firstname, lastname, pos1, pos2, pos3, pos4, team, stat1, stat2, stat3, stat4, stat5, drafted, open, queued, ...
                                var firstName = p.firstname || p[1] || '';
                                var lastName = p.lastname || p[2] || '';
                                var positions = [p.position || p.position1 || p[3], p.position2 || p[4], p.position3 || p[5], p.position4 || p[6]]
                                    .filter(function (pos) { return pos && pos !== ''; });
                                var mlbTeam = p.team || p[7] || '';
                                var isDrafted = p.drafted === true || p.drafted === 1 || p.drafted === '1';
                                var isOpen = p.open === 1 || p.open === '1' || activeAuctionPlayerIds.has(Number(id));
                                var isPassed = passedArray.includes(Number(id));
                                // Determine status
                                // Priority: on_block > drafted > passed > available
                                // If a player is actively being auctioned (on_block), that takes precedence
                                // over the drafted flag (which may be set prematurely by CouchManagers)
                                var status_1 = void 0;
                                if (isOpen) {
                                    status_1 = 'on_block';
                                }
                                else if (isDrafted) {
                                    status_1 = 'drafted';
                                }
                                else if (isPassed) {
                                    status_1 = 'passed';
                                }
                                else {
                                    status_1 = 'available';
                                }
                                var fullName = "".concat(firstName, " ").concat(lastName).trim();
                                // Get winning bid - prefer price from playerArray, fallback to auction map
                                var winningBidFromPlayer = Number(p.price) || Number(p.winningBid) || 0;
                                var winningBidFromAuction = ((_a = playerHighestBidMap[Number(id)]) === null || _a === void 0 ? void 0 : _a.amount) || 0;
                                var winningBid = isDrafted ? (winningBidFromPlayer || winningBidFromAuction || undefined) : undefined;
                                // Get winning team - PRIMARY SOURCE: playerToTeam from rosterArray (most complete)
                                // FALLBACK 1: auctionArray highest bid (only has recent bids)
                                // FALLBACK 2: player object properties
                                var winningTeamFromRoster = playerToTeam[Number(id)];
                                var winningTeamFromAuction = (_b = playerHighestBidMap[Number(id)]) === null || _b === void 0 ? void 0 : _b.teamname;
                                var winningTeamFromPlayer = cleanTeamName(p.teamname || p.winningTeam || '');
                                var winningTeam = isDrafted ? (winningTeamFromRoster || winningTeamFromAuction || winningTeamFromPlayer || undefined) : undefined;
                                players.push({
                                    couchManagersId: Number(id),
                                    firstName: firstName,
                                    lastName: lastName,
                                    fullName: fullName,
                                    normalizedName: '', // Will be set server-side
                                    positions: positions,
                                    mlbTeam: mlbTeam,
                                    status: status_1,
                                    winningBid: winningBid,
                                    winningTeam: winningTeam,
                                    stats: {
                                        avg: p.avg || p.stat1 || p[8],
                                        hr: Number(p.hr || p.stat2 || p[9]) || undefined,
                                        rbi: Number(p.rbi || p.stat3 || p[10]) || undefined,
                                        sb: Number(p.sb || p.stat4 || p[11]) || undefined,
                                        runs: Number(p.r || p.stat5 || p[12]) || undefined,
                                    },
                                });
                            }
                            // Extract teams - use teamIndexToName map we already built from multiple sources
                            var teams = [];
                            // Primary: Use the teamIndexToName map we built earlier (from rosterArray + auctionArray + DOM)
                            // This ensures team names are consistent with player ownership data
                            var teamIndices = Object.keys(teamIndexToName).map(Number).sort(function (a, b) { return a - b; });
                            var _loop_3 = function (idx) {
                                var teamName = teamIndexToName[idx];
                                if (teamName) {
                                    // Count players for this team
                                    var playersOnTeam = Object.values(playerToTeam).filter(function (t) { return t === teamName; }).length;
                                    teams.push({
                                        name: teamName,
                                        budget: 260,
                                        spent: 0,
                                        remaining: 260,
                                        playersDrafted: playersOnTeam,
                                        isOnline: false,
                                    });
                                }
                            };
                            for (var _r = 0, teamIndices_1 = teamIndices; _r < teamIndices_1.length; _r++) {
                                var idx = teamIndices_1[_r];
                                _loop_3(idx);
                            }
                            // Fallback: Try teamArray object if no teams from mapping
                            if (teams.length === 0) {
                                var teamArray = win.teamArray || win.teamsArray || win.teams || {};
                                for (var _s = 0, _t = Object.keys(teamArray); _s < _t.length; _s++) {
                                    var key = _t[_s];
                                    var t = teamArray[key];
                                    if (!t)
                                        continue;
                                    var teamName = t.name || t.teamname || t.team_name || t.username || key;
                                    if (teamName) {
                                        teams.push({
                                            name: cleanTeamName(teamName),
                                            budget: Number(t.budget) || 260,
                                            spent: Number(t.spent) || 0,
                                            remaining: Number(t.remaining) || Number(t.budget) - Number(t.spent) || 260,
                                            playersDrafted: Number(t.players) || Number(t.playersDrafted) || 0,
                                            isOnline: t.online === true || t.online === 1 || t.online === '1',
                                        });
                                    }
                                }
                            }
                            // Extract current auction info
                            var currentAuction;
                            var activeAuctions = Object.values(auctionArray).filter(function (a) { return a && !a.sold; });
                            if (activeAuctions.length > 0) {
                                var active = activeAuctions[0];
                                var playerId = active.playerid || active.player_id;
                                var player = playerArray[playerId];
                                currentAuction = {
                                    playerId: Number(playerId),
                                    playerName: player ? "".concat(player.firstname, " ").concat(player.lastname).trim() : "Player ".concat(playerId),
                                    currentBid: Number(active.amount) || 0,
                                    currentBidder: active.teamname || active.team || '',
                                    timeRemaining: Number(active.time) || 0,
                                };
                            }
                            // Calculate totals
                            var draftedPlayers = players.filter(function (p) { return p.status === 'drafted'; });
                            var totalPlayersDrafted = draftedPlayers.length;
                            var totalMoneySpent = draftedPlayers.reduce(function (sum, p) { return sum + (p.winningBid || 0); }, 0);
                            // Update debug info with drafted player team stats
                            debugInfo.draftedPlayersWithTeams = draftedPlayers.filter(function (p) { return p.winningTeam; }).length;
                            debugInfo.draftedPlayersWithoutTeams = draftedPlayers.filter(function (p) { return !p.winningTeam; }).length;
                            // Determine auction status
                            var status = 'active';
                            if (win.auction_paused === true || win.auction_paused === 1) {
                                status = 'paused';
                            }
                            // Check if auction is complete (all roster spots filled or auction ended)
                            var auctionComplete = win.auction_complete === true || win.auction_complete === 1;
                            if (auctionComplete) {
                                status = 'completed';
                            }
                            return {
                                players: players,
                                teams: teams,
                                currentAuction: currentAuction,
                                totalPlayersDrafted: totalPlayersDrafted,
                                totalMoneySpent: totalMoneySpent,
                                status: status,
                                debugInfo: debugInfo,
                            };
                        })];
                case 7:
                    scrapedData = _a.sent();
                    playersWithNormalizedNames = scrapedData.players.map(function (p) { return (__assign(__assign({}, p), { normalizedName: normalizeName(p.fullName) })); });
                    result = {
                        roomId: roomId,
                        scrapedAt: new Date().toISOString(),
                        status: scrapedData.status,
                        players: playersWithNormalizedNames,
                        teams: scrapedData.teams,
                        currentAuction: scrapedData.currentAuction,
                        totalPlayersDrafted: scrapedData.totalPlayersDrafted,
                        totalMoneySpent: scrapedData.totalMoneySpent,
                    };
                    debugInfo = scrapedData.debugInfo;
                    console.log("[Scraper] Room ".concat(roomId, ": DEBUG INFO:"), JSON.stringify(debugInfo, null, 2));
                    console.log("[Scraper] Room ".concat(roomId, ": Found ").concat(result.teams.length, " teams:"), result.teams.map(function (t) { return t.name; }));
                    draftedSample = playersWithNormalizedNames
                        .filter(function (p) { return p.status === 'drafted'; })
                        .slice(0, 10)
                        .map(function (p) { return ({ name: p.fullName, winningTeam: p.winningTeam, winningBid: p.winningBid }); });
                    console.log("[Scraper] Room ".concat(roomId, ": Sample drafted players:"), JSON.stringify(draftedSample, null, 2));
                    return [2 /*return*/, result];
                case 8:
                    error_1 = _a.sent();
                    console.error("Error scraping auction ".concat(roomId, ":"), error_1);
                    throw error_1;
                case 9: return [4 /*yield*/, page.close()];
                case 10:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    });
}
/**
 * Scrapes only the drafted players and current auction info (lighter weight).
 * Useful for frequent polling.
 */
export function scrapeDraftedPlayers(roomId) {
    return __awaiter(this, void 0, void 0, function () {
        var fullData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, scrapeAuction(roomId)];
                case 1:
                    fullData = _a.sent();
                    return [2 /*return*/, {
                            draftedPlayers: fullData.players.filter(function (p) { return p.status === 'drafted'; }),
                            currentAuction: fullData.currentAuction,
                            totalMoneySpent: fullData.totalMoneySpent,
                        }];
            }
        });
    });
}

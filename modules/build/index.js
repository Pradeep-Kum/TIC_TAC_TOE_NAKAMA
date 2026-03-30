"use strict";
function matchmakerMatched(ctx, logger, nk, matches) {
    return nk.matchCreate(MATCH_NAME, {
        mode: getMatchedMode(matches)
    });
}
function rpcCreateMatch(ctx, logger, nk, payload) {
    var input = parseJsonPayload(payload);
    var mode = normalizeMode(input.mode);
    var creatorUsername = sanitizeCreatorName(input.creatorUsername);
    var matchId = nk.matchCreate(MATCH_NAME, {
        creator: ctx.userId,
        mode: mode,
        creatorUsername: creatorUsername
    });
    return JSON.stringify({
        matchId: matchId,
        mode: mode,
        creatorUsername: creatorUsername
    });
}
function rpcGetLeaderboard(ctx, logger, nk, payload) {
    var input = parseJsonPayload(payload);
    var limit = Number(input.limit);
    if (!limit || limit < 1) {
        limit = 10;
    }
    if (limit > 25) {
        limit = 25;
    }
    ensureLeaderboard(logger, nk);
    var leaderboard = nk.leaderboardRecordsList(LEADERBOARD_ID, [ctx.userId], limit, input.cursor || null, 0);
    var records = leaderboard.records || [];
    var ownerRecords = leaderboard.ownerRecords || [];
    return JSON.stringify({
        records: records.map(mapLeaderboardRecord),
        ownerRecords: ownerRecords.map(mapLeaderboardRecord),
        nextCursor: leaderboard.nextCursor || null,
        prevCursor: leaderboard.prevCursor || null
    });
}
var MATCH_NAME = "tic-tac-toe";
var STATS_COLLECTION = "ttt_stats";
var STATS_KEY = "summary";
var LEADERBOARD_ID = "ttt_global_ranking";
var DEFAULT_TURN_SECONDS = 30;
var WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];
function createInitialMatchState(mode) {
    return {
        board: new Array(9).fill(null),
        players: [],
        turn: "X",
        status: "waiting",
        winner: null,
        endedReason: null,
        mode: mode,
        turnTimeLimitSeconds: getTurnLimitSeconds(mode),
        turnDeadlineTick: null,
        lastTimerBroadcastTick: null,
        resultRecorded: false
    };
}
function getWinningSymbol(board) {
    for (var i = 0; i < WINNING_LINES.length; i++) {
        var line = WINNING_LINES[i];
        var a = line[0];
        var b = line[1];
        var c = line[2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}
function isBoardFull(board) {
    for (var i = 0; i < board.length; i++) {
        if (board[i] === null) {
            return false;
        }
    }
    return true;
}
function getTurnSecondsRemaining(state, tick) {
    if (state.turnDeadlineTick === null || state.turnDeadlineTick === undefined) {
        return null;
    }
    var remaining = state.turnDeadlineTick - tick;
    return remaining > 0 ? remaining : 0;
}
function parseJsonPayload(payload) {
    if (!payload) {
        return {};
    }
    if (typeof payload === "string") {
        try {
            var parsed = JSON.parse(payload);
            if (typeof parsed === "string") {
                try {
                    return JSON.parse(parsed);
                }
                catch (error) {
                    return {};
                }
            }
            return parsed;
        }
        catch (error) {
            return {};
        }
    }
    return payload;
}
function normalizeMode(mode) {
    return mode === "timed" ? "timed" : "classic";
}
function getTurnLimitSeconds(mode) {
    return mode === "timed" ? DEFAULT_TURN_SECONDS : null;
}
function sanitizeCreatorName(name) {
    if (!name || typeof name !== "string") {
        return null;
    }
    var trimmed = name.trim();
    return trimmed ? trimmed : null;
}
function createMatchLabel(mode, creatorUsername) {
    return JSON.stringify({
        name: MATCH_NAME,
        mode: normalizeMode(mode),
        creatorUsername: sanitizeCreatorName(creatorUsername)
    });
}
function getMatchedMode(matches) {
    if (!matches || !matches.length) {
        return "classic";
    }
    for (var i = 0; i < matches.length; i++) {
        var mode = readModeFromMatchmakerEntry(matches[i]);
        if (mode) {
            return mode;
        }
    }
    return "classic";
}
function readModeFromMatchmakerEntry(entry) {
    if (!entry) {
        return null;
    }
    var candidates = [
        entry.properties,
        entry.stringProperties,
        entry.string_properties,
        entry.presence && entry.presence.properties,
        entry.presence && entry.presence.stringProperties,
        entry.presence && entry.presence.string_properties
    ];
    for (var i = 0; i < candidates.length; i++) {
        var current = candidates[i];
        if (!current) {
            continue;
        }
        return normalizeMode(current.mode);
    }
    return null;
}
function InitModule(ctx, logger, nk, initializer) {
    initializer.registerMatch(MATCH_NAME, {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });
    initializer.registerRpc("create_ttt_match", rpcCreateMatch);
    initializer.registerRpc("get_ttt_leaderboard", rpcGetLeaderboard);
    initializer.registerMatchmakerMatched(matchmakerMatched);
    ensureLeaderboard(logger, nk);
}
function matchInit(ctx, logger, nk, params) {
    var mode = normalizeMode(params && params.mode);
    var creatorUsername = params && params.creatorUsername;
    return {
        state: createInitialMatchState(mode),
        tickRate: 1,
        label: createMatchLabel(mode, creatorUsername)
    };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    if (state.players.length >= 2) {
        return { state: state, accept: false };
    }
    return { state: state, accept: true };
}
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        var sessionId = getPresenceSessionId(presence);
        var userId = getPresenceUserId(presence);
        var exists = false;
        for (var j = 0; j < state.players.length; j++) {
            if (state.players[j].sessionId === sessionId || state.players[j].userId === userId) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            state.players.push({
                userId: userId,
                sessionId: sessionId,
                username: getPresenceUsername(presence),
                symbol: state.players.length === 0 ? "X" : "O"
            });
        }
    }
    if (state.players.length === 2 && state.status === "waiting") {
        state.status = "playing";
        if (state.turnTimeLimitSeconds) {
            state.turnDeadlineTick = tick + state.turnTimeLimitSeconds;
            state.lastTimerBroadcastTick = null;
        }
    }
    broadcastState(nk, dispatcher, state, tick);
    return { state: state };
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    var leavingPlayers = [];
    for (var i = 0; i < presences.length; i++) {
        var sessionId = getPresenceSessionId(presences[i]);
        var userId = getPresenceUserId(presences[i]);
        for (var j = 0; j < state.players.length; j++) {
            var player = state.players[j];
            if (player.sessionId === sessionId || player.userId === userId) {
                leavingPlayers.push(player);
            }
        }
    }
    for (var k = 0; k < presences.length; k++) {
        var leavingSessionId = getPresenceSessionId(presences[k]);
        var leavingUserId = getPresenceUserId(presences[k]);
        state.players = state.players.filter(function (player) {
            return player.sessionId !== leavingSessionId && player.userId !== leavingUserId;
        });
    }
    if (state.players.length === 0) {
        return null;
    }
    if (state.status === "playing" && state.players.length === 1) {
        state.status = "abandoned";
        state.winner = state.players[0].symbol;
        state.endedReason = "opponent_left";
        finalizeMatch(logger, nk, state, state.winner, leavingPlayers);
        broadcastState(nk, dispatcher, state, tick);
    }
    return { state: state };
}
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    if (state.mode === "timed" && state.status === "playing" && state.turnDeadlineTick !== null) {
        if (tick >= state.turnDeadlineTick) {
            var timedOutPlayer = findPlayerBySymbol(state, state.turn);
            var winningPlayer = findPlayerBySymbol(state, state.turn === "X" ? "O" : "X");
            state.status = "abandoned";
            state.winner = winningPlayer ? winningPlayer.symbol : null;
            state.endedReason = "timeout";
            finalizeMatch(logger, nk, state, state.winner, timedOutPlayer ? [timedOutPlayer] : []);
            broadcastState(nk, dispatcher, state, tick);
            return { state: state };
        }
        if (state.lastTimerBroadcastTick !== tick) {
            state.lastTimerBroadcastTick = tick;
            broadcastState(nk, dispatcher, state, tick);
        }
    }
    for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        var opCode = Number(message.opCode || message.op_code);
        if (opCode === 4) {
            broadcastState(nk, dispatcher, state, tick, [message.sender]);
            continue;
        }
        if (opCode !== 1) {
            continue;
        }
        try {
            if (state.status !== "playing") {
                continue;
            }
            var input = JSON.parse(nk.binaryToString(message.data));
            var index = Number(input.index);
            var senderUserId = getPresenceUserId(message.sender);
            var senderSessionId = getPresenceSessionId(message.sender);
            var currentPlayer = findPlayerBySymbol(state, state.turn);
            var isPlayersTurn = currentPlayer &&
                (currentPlayer.userId === senderUserId || currentPlayer.sessionId === senderSessionId);
            var isValidIndex = index >= 0 && index <= 8 && Math.floor(index) === index;
            if (!isPlayersTurn || !isValidIndex || state.board[index] !== null) {
                broadcastState(nk, dispatcher, state, tick, [message.sender]);
                continue;
            }
            state.board[index] = state.turn;
            var winningSymbol = getWinningSymbol(state.board);
            if (winningSymbol) {
                state.status = "won";
                state.winner = winningSymbol;
                state.endedReason = "line_complete";
                finalizeMatch(logger, nk, state, winningSymbol, []);
            }
            else if (isBoardFull(state.board)) {
                state.status = "draw";
                state.winner = null;
                state.endedReason = "board_full";
                finalizeMatch(logger, nk, state, null, []);
            }
            else {
                state.turn = state.turn === "X" ? "O" : "X";
                if (state.turnTimeLimitSeconds) {
                    state.turnDeadlineTick = tick + state.turnTimeLimitSeconds;
                    state.lastTimerBroadcastTick = null;
                }
            }
            broadcastState(nk, dispatcher, state, tick);
        }
        catch (error) {
            logger.error("Move error: %v", error);
        }
    }
    return { state: state };
}
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
}
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
    return { state: state, data: "ok" };
}
function broadcastState(nk, dispatcher, state, tick, presences) {
    var payload = JSON.stringify({
        board: state.board,
        turn: state.turn,
        players: state.players,
        status: state.status,
        winner: state.winner,
        endedReason: state.endedReason,
        mode: state.mode,
        turnTimeLimitSeconds: state.turnTimeLimitSeconds,
        turnSecondsRemaining: getTurnSecondsRemaining(state, tick)
    });
    dispatcher.broadcastMessage(1, nk.stringToBinary(payload), presences || null);
}
function getPresenceUserId(presence) {
    return presence.userId || presence.user_id || null;
}
function getPresenceSessionId(presence) {
    return presence.sessionId || presence.session_id || null;
}
function getPresenceUsername(presence) {
    return presence.username || presence.user_name || null;
}
function findPlayerBySymbol(state, symbol) {
    for (var i = 0; i < state.players.length; i++) {
        if (state.players[i].symbol === symbol) {
            return state.players[i];
        }
    }
    return null;
}
function ensureLeaderboard(logger, nk) {
    try {
        nk.leaderboardCreate(LEADERBOARD_ID, true, "desc", "set", null, { game: MATCH_NAME }, true);
    }
    catch (error) {
        logger.warn("Leaderboard init skipped: %v", error);
    }
}
function createEmptyStats(userId) {
    return {
        userId: userId,
        username: null,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        currentWinStreak: 0,
        bestWinStreak: 0
    };
}
function readPlayerStats(nk, userId) {
    var stats = createEmptyStats(userId);
    try {
        var objects = nk.storageRead([{
                collection: STATS_COLLECTION,
                key: STATS_KEY,
                userId: userId
            }]);
        if (objects && objects.length && objects[0].value) {
            var value = objects[0].value;
            stats.username = value.username || stats.username;
            stats.gamesPlayed = Number(value.gamesPlayed) || 0;
            stats.wins = Number(value.wins) || 0;
            stats.losses = Number(value.losses) || 0;
            stats.draws = Number(value.draws) || 0;
            stats.currentWinStreak = Number(value.currentWinStreak) || 0;
            stats.bestWinStreak = Number(value.bestWinStreak) || 0;
        }
    }
    catch (error) {
        return stats;
    }
    return stats;
}
function updatePlayerStats(logger, nk, player, outcome) {
    if (!player || !player.userId) {
        return;
    }
    var stats = readPlayerStats(nk, player.userId);
    if (player.username) {
        stats.username = player.username;
    }
    stats.gamesPlayed += 1;
    if (outcome === "win") {
        stats.wins += 1;
        stats.currentWinStreak += 1;
        if (stats.currentWinStreak > stats.bestWinStreak) {
            stats.bestWinStreak = stats.currentWinStreak;
        }
    }
    else if (outcome === "loss") {
        stats.losses += 1;
        stats.currentWinStreak = 0;
    }
    else {
        stats.draws += 1;
        stats.currentWinStreak = 0;
    }
    try {
        nk.storageWrite([{
                collection: STATS_COLLECTION,
                key: STATS_KEY,
                userId: player.userId,
                value: stats,
                permissionRead: 2,
                permissionWrite: 0
            }]);
    }
    catch (error) {
        logger.error("Stats storage write failed for %v: %v", player.userId, error);
    }
    try {
        nk.leaderboardRecordWrite(LEADERBOARD_ID, player.userId, stats.username || player.userId, stats.wins, stats.currentWinStreak, {
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            gamesPlayed: stats.gamesPlayed,
            currentWinStreak: stats.currentWinStreak,
            bestWinStreak: stats.bestWinStreak
        }, "set");
    }
    catch (error) {
        logger.error("Leaderboard write failed for %v: %v", player.userId, error);
    }
}
function finalizeMatch(logger, nk, state, winnerSymbol, disconnectedPlayers) {
    if (state.resultRecorded) {
        return;
    }
    state.resultRecorded = true;
    for (var i = 0; i < state.players.length; i++) {
        var player = state.players[i];
        var outcome = winnerSymbol === null ? "draw" : player.symbol === winnerSymbol ? "win" : "loss";
        updatePlayerStats(logger, nk, player, outcome);
    }
    for (var j = 0; j < disconnectedPlayers.length; j++) {
        var disconnectedPlayer = disconnectedPlayers[j];
        var alreadyUpdated = false;
        for (var k = 0; k < state.players.length; k++) {
            if (state.players[k].userId === disconnectedPlayer.userId) {
                alreadyUpdated = true;
                break;
            }
        }
        if (!alreadyUpdated) {
            updatePlayerStats(logger, nk, disconnectedPlayer, "loss");
        }
    }
}
function mapLeaderboardRecord(record) {
    var metadata = record.metadata || {};
    return {
        rank: record.rank || null,
        ownerId: record.ownerId || record.owner_id || null,
        username: record.username || record.ownerId || record.owner_id || "Player",
        wins: Number(record.score) || 0,
        streak: Number(record.subscore) || 0,
        stats: {
            wins: Number(metadata.wins) || Number(record.score) || 0,
            losses: Number(metadata.losses) || 0,
            draws: Number(metadata.draws) || 0,
            gamesPlayed: Number(metadata.gamesPlayed) || 0,
            currentWinStreak: Number(metadata.currentWinStreak) || Number(record.subscore) || 0,
            bestWinStreak: Number(metadata.bestWinStreak) || Number(record.subscore) || 0
        }
    };
}

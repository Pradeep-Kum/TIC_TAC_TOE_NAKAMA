"use strict";
function matchmakerMatched(ctx, logger, nk, matches) {
    return nk.matchCreate("tic-tac-toe", {});
}
function rpcCreateMatch(ctx, logger, nk, payload) {
    var matchId = nk.matchCreate("tic-tac-toe", { creator: ctx.userId });
    return JSON.stringify({ matchId: matchId });
}
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
function createInitialMatchState() {
    return {
        board: new Array(9).fill(null),
        players: [],
        turn: "X",
        status: "waiting",
        winner: null,
        endedReason: null
    };
}
function findWinningSymbol(board) {
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
function getNextTurn(symbol) {
    return symbol === "X" ? "O" : "X";
}
function isValidMoveIndex(index) {
    return index >= 0 && index <= 8 && Math.floor(index) === index;
}
function findCurrentPlayer(state) {
    for (var i = 0; i < state.players.length; i++) {
        if (state.players[i].symbol === state.turn) {
            return state.players[i];
        }
    }
    return null;
}
function applyMove(state, player, index) {
    if (state.status !== "playing" || !player || !isValidMoveIndex(index)) {
        return { applied: false };
    }
    if (player.symbol !== state.turn || state.board[index] !== null) {
        return { applied: false };
    }
    state.board[index] = state.turn;
    var winningSymbol = findWinningSymbol(state.board);
    if (winningSymbol) {
        state.status = "won";
        state.winner = winningSymbol;
        state.endedReason = "line_complete";
        return { applied: true, state: state };
    }
    if (isBoardFull(state.board)) {
        state.status = "draw";
        state.winner = null;
        state.endedReason = "board_full";
        return { applied: true, state: state };
    }
    state.turn = getNextTurn(state.turn);
    return { applied: true, state: state };
}
function InitModule(ctx, logger, nk, initializer) {
    initializer.registerMatch("tic-tac-toe", {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });
    initializer.registerRpc("create_ttt_match", rpcCreateMatch);
    initializer.registerMatchmakerMatched(matchmakerMatched);
}
function matchInit(ctx, logger, nk, params) {
    return {
        state: createInitialMatchState(),
        tickRate: 1,
        label: "tic-tac-toe"
    };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    if (state.players.length >= 2) {
        return { state: state, accept: false };
    }
    return { state: state, accept: true };
}
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
    addPlayersToMatch(state, presences);
    broadcastState(nk, dispatcher, state);
    return { state: state };
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    removePlayersFromMatch(state, presences);
    if (state.players.length === 0) {
        return null;
    }
    markMatchAbandoned(state);
    broadcastState(nk, dispatcher, state);
    return { state: state };
}
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        var opCode = Number(message.opCode || message.op_code);
        if (opCode === 4) {
            broadcastState(nk, dispatcher, state, [message.sender]);
            continue;
        }
        if (opCode !== 1) {
            continue;
        }
        try {
            var index = parseMoveIndex(nk, message);
            var player = findPlayerByPresence(state, message.sender);
            var moveResult = applyMove(state, player, index);
            if (moveResult.applied) {
                broadcastState(nk, dispatcher, moveResult.state);
            }
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
function addPlayersToMatch(state, presences) {
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        if (findPlayerByPresence(state, presence)) {
            continue;
        }
        state.players.push({
            userId: getPresenceUserId(presence),
            sessionId: getPresenceSessionId(presence),
            symbol: state.players.length === 0 ? "X" : "O"
        });
    }
    if (state.players.length === 2 && state.status === "waiting") {
        state.status = "playing";
    }
}
function removePlayersFromMatch(state, presences) {
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        state.players = state.players.filter(function (player) {
            return !matchesPlayerIdentity(player, presence);
        });
    }
}
function markMatchAbandoned(state) {
    if (state.status === "playing" && state.players.length === 1) {
        state.status = "abandoned";
        state.winner = state.players[0].symbol;
        state.endedReason = "opponent_left";
    }
}
function broadcastState(nk, dispatcher, state, presences) {
    var payload = JSON.stringify({
        board: state.board,
        turn: state.turn,
        players: state.players,
        status: state.status,
        winner: state.winner,
        endedReason: state.endedReason
    });
    dispatcher.broadcastMessage(1, nk.stringToBinary(payload), presences || null);
}
function parseMoveIndex(nk, message) {
    var input = JSON.parse(nk.binaryToString(message.data));
    return Number(input.index);
}
function getPresenceUserId(presence) {
    return presence.userId || presence.user_id || null;
}
function getPresenceSessionId(presence) {
    return presence.sessionId || presence.session_id || null;
}
function matchesPlayerIdentity(player, presence) {
    var sessionId = getPresenceSessionId(presence);
    var userId = getPresenceUserId(presence);
    return player.sessionId === sessionId || player.userId === userId;
}
function findPlayerByPresence(state, presence) {
    for (var i = 0; i < state.players.length; i++) {
        if (matchesPlayerIdentity(state.players[i], presence)) {
            return state.players[i];
        }
    }
    return null;
}

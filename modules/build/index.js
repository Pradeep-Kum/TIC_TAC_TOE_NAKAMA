"use strict";
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
function matchmakerMatched(ctx, logger, nk, matches) {
    // `matches` contains complex runtime objects that cannot be JSON-encoded by matchCreate params.
    // Keep params simple/serializable so authoritative match creation succeeds.
    return nk.matchCreate("tic-tac-toe", {});
}
function rpcCreateMatch(ctx, logger, nk, payload) {
    var matchId = nk.matchCreate("tic-tac-toe", { creator: ctx.userId });
    return JSON.stringify({ matchId: matchId });
}
function getPresenceUserId(presence) {
    return presence.userId || presence.user_id || null;
}
function getPresenceSessionId(presence) {
    return presence.sessionId || presence.session_id || null;
}
function getWinningSymbol(board) {
    var lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
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
        if (board[i] === null)
            return false;
    }
    return true;
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
function matchInit(ctx, logger, nk, params) {
    return {
        state: {
            board: new Array(9).fill(null),
            players: [],
            turn: "X",
            status: "waiting",
            winner: null,
            endedReason: null
        },
        tickRate: 1,
        label: "tic-tac-toe"
    };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    if (state.players.length >= 2)
        return { state: state, accept: false };
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
            var symbol = state.players.length === 0 ? "X" : "O";
            state.players.push({
                userId: userId,
                sessionId: sessionId,
                symbol: symbol
            });
        }
    }
    if (state.players.length === 2 && state.status === "waiting") {
        state.status = "playing";
    }
    broadcastState(nk, dispatcher, state);
    return { state: state };
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var i = 0; i < presences.length; i++) {
        var sessionId = getPresenceSessionId(presences[i]);
        var userId = getPresenceUserId(presences[i]);
        state.players = state.players.filter(function (player) {
            return player.sessionId !== sessionId && player.userId !== userId;
        });
    }
    if (state.players.length === 0) {
        return null;
    }
    if (state.status === "playing" && state.players.length === 1) {
        state.status = "abandoned";
        state.winner = state.players[0].symbol;
        state.endedReason = "opponent_left";
        broadcastState(nk, dispatcher, state);
    }
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
        if (opCode === 1) {
            try {
                if (state.status !== "playing")
                    continue;
                var input = JSON.parse(nk.binaryToString(message.data));
                var index = Number(input.index);
                var senderUserId = getPresenceUserId(message.sender);
                var senderSessionId = getPresenceSessionId(message.sender);
                var currentPlayer = null;
                for (var j = 0; j < state.players.length; j++) {
                    if (state.players[j].symbol === state.turn) {
                        currentPlayer = state.players[j];
                        break;
                    }
                }
                var isPlayersTurn = currentPlayer &&
                    (currentPlayer.userId === senderUserId || currentPlayer.sessionId === senderSessionId);
                var isValidIndex = index >= 0 && index <= 8 && Math.floor(index) === index;
                if (isPlayersTurn && isValidIndex && state.board[index] === null) {
                    state.board[index] = state.turn;
                    var winningSymbol = getWinningSymbol(state.board);
                    if (winningSymbol) {
                        state.status = "won";
                        state.winner = winningSymbol;
                        state.endedReason = "line_complete";
                    }
                    else if (isBoardFull(state.board)) {
                        state.status = "draw";
                        state.winner = null;
                        state.endedReason = "board_full";
                    }
                    else {
                        state.turn = state.turn === "X" ? "O" : "X";
                    }
                    broadcastState(nk, dispatcher, state);
                }
            }
            catch (e) {
                logger.error("Move error: %v", e);
            }
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

function matchInit(ctx, logger, nk, params) {
    var mode = normalizeMode(params && params.mode);
    var creatorUsername = params && params.creatorUsername;
    return {
        state: createInitialMatchState(mode),
        tickRate: 1,
        label: createMatchLabel(mode, creatorUsername)
    };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state: MatchState, presence, metadata) {
    if (state.players.length >= 2) {
        return { state: state, accept: false };
    }

    return { state: state, accept: true };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state: MatchState, presences) {
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

function matchLeave(ctx, logger, nk, dispatcher, tick, state: MatchState, presences) {
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
        state.players = state.players.filter(function(player) {
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

function matchLoop(ctx, logger, nk, dispatcher, tick, state: MatchState, messages) {
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
            } else if (isBoardFull(state.board)) {
                state.status = "draw";
                state.winner = null;
                state.endedReason = "board_full";
                finalizeMatch(logger, nk, state, null, []);
            } else {
                state.turn = state.turn === "X" ? "O" : "X";
                if (state.turnTimeLimitSeconds) {
                    state.turnDeadlineTick = tick + state.turnTimeLimitSeconds;
                    state.lastTimerBroadcastTick = null;
                }
            }

            broadcastState(nk, dispatcher, state, tick);
        } catch (error) {
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

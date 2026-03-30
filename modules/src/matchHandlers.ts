function matchInit(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: Nakama, params: {[key: string]: string}) {
    return {
        state: createInitialMatchState(),
        tickRate: 1,
        label: "tic-tac-toe"
    };
}

function matchJoinAttempt(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    presence: Presence,
    metadata: {[key: string]: any}
) {
    if (state.players.length >= 2) {
        return { state: state, accept: false };
    }

    return { state: state, accept: true };
}

function matchJoin(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    presences: Presence[]
) {
    addPlayersToMatch(state, presences);
    broadcastState(nk, dispatcher, state);

    return { state: state };
}

function matchLeave(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    presences: Presence[]
) {
    removePlayersFromMatch(state, presences);

    if (state.players.length === 0) {
        return null;
    }

    markMatchAbandoned(state);
    broadcastState(nk, dispatcher, state);

    return { state: state };
}

function matchLoop(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    messages: MatchDataMessage[]
) {
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
        } catch (error) {
            logger.error("Move error: %v", error);
        }
    }

    return { state: state };
}

function matchTerminate(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    graceSeconds: number
) {
    return { state: state };
}

function matchSignal(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: MatchState,
    data: string
) {
    return { state: state, data: "ok" };
}

function broadcastState(nk, dispatcher, state: MatchState, tick: number, presences?) {
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

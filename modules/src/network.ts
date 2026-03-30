function broadcastState(
    nk: Nakama,
    dispatcher: MatchDispatcher,
    state: MatchState,
    presences?: Presence[]
): void {
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

function parseMoveIndex(nk: Nakama, message: MatchDataMessage): number {
    var input = JSON.parse(nk.binaryToString(message.data));
    return Number(input.index);
}

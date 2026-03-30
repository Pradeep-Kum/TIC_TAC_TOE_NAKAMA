function getPresenceUserId(presence) {
    return presence.userId || presence.user_id || null;
}

function getPresenceSessionId(presence) {
    return presence.sessionId || presence.session_id || null;
}

function getPresenceUsername(presence) {
    return presence.username || presence.user_name || null;
}

function findPlayerBySymbol(state: MatchState, symbol: CellSymbol): PlayerState | null {
    for (var i = 0; i < state.players.length; i++) {
        if (state.players[i].symbol === symbol) {
            return state.players[i];
        }
    }

    return null;
}

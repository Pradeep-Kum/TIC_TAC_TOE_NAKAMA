function addPlayersToMatch(state: MatchState, presences: Presence[]): void {
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

function removePlayersFromMatch(state: MatchState, presences: Presence[]): void {
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        state.players = state.players.filter(function(player) {
            return !matchesPlayerIdentity(player, presence);
        });
    }
}

function markMatchAbandoned(state: MatchState): void {
    if (state.status === "playing" && state.players.length === 1) {
        state.status = "abandoned";
        state.winner = state.players[0].symbol;
        state.endedReason = "opponent_left";
    }
}

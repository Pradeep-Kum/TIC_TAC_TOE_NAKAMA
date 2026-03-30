function getPresenceUserId(presence: Presence | UserPresence): string | null {
    return presence.userId || presence.user_id || null;
}

function getPresenceSessionId(presence: Presence | UserPresence): string | null {
    return presence.sessionId || presence.session_id || null;
}

function matchesPlayerIdentity(player: PlayerState, presence: Presence | UserPresence): boolean {
    var sessionId = getPresenceSessionId(presence);
    var userId = getPresenceUserId(presence);

    return player.sessionId === sessionId || player.userId === userId;
}

function findPlayerByPresence(state: MatchState, presence: Presence | UserPresence): PlayerState | null {
    for (var i = 0; i < state.players.length; i++) {
        if (matchesPlayerIdentity(state.players[i], presence)) {
            return state.players[i];
        }
    }

    return null;
}

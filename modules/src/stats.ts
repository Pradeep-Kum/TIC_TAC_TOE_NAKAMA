function ensureLeaderboard(logger, nk) {
    try {
        nk.leaderboardCreate(LEADERBOARD_ID, true, "desc", "set", null, { game: MATCH_NAME }, true);
    } catch (error) {
        logger.warn("Leaderboard init skipped: %v", error);
    }
}

function createEmptyStats(userId: string): PlayerStats {
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

function readPlayerStats(nk, userId: string): PlayerStats {
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
    } catch (error) {
        return stats;
    }

    return stats;
}

function updatePlayerStats(logger, nk, player: PlayerState, outcome: string): void {
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
    } else if (outcome === "loss") {
        stats.losses += 1;
        stats.currentWinStreak = 0;
    } else {
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
    } catch (error) {
        logger.error("Stats storage write failed for %v: %v", player.userId, error);
    }

    try {
        nk.leaderboardRecordWrite(
            LEADERBOARD_ID,
            player.userId,
            stats.username || player.userId,
            stats.wins,
            stats.currentWinStreak,
            {
                wins: stats.wins,
                losses: stats.losses,
                draws: stats.draws,
                gamesPlayed: stats.gamesPlayed,
                currentWinStreak: stats.currentWinStreak,
                bestWinStreak: stats.bestWinStreak
            },
            "set"
        );
    } catch (error) {
        logger.error("Leaderboard write failed for %v: %v", player.userId, error);
    }
}

function finalizeMatch(logger, nk, state: MatchState, winnerSymbol: CellSymbol | null, disconnectedPlayers: PlayerState[]): void {
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

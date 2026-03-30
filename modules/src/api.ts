function matchmakerMatched(ctx, logger, nk, matches) {
    return nk.matchCreate(MATCH_NAME, {
        mode: getMatchedMode(matches)
    });
}

function rpcCreateMatch(ctx, logger, nk, payload) {
    var input = parseJsonPayload(payload);
    var mode = normalizeMode(input.mode);
    var creatorUsername = sanitizeCreatorName(input.creatorUsername);
    var matchId = nk.matchCreate(MATCH_NAME, {
        creator: ctx.userId,
        mode: mode,
        creatorUsername: creatorUsername
    });

    return JSON.stringify({
        matchId: matchId,
        mode: mode,
        creatorUsername: creatorUsername
    });
}

function rpcGetLeaderboard(ctx, logger, nk, payload) {
    var input = parseJsonPayload(payload);
    var limit = Number(input.limit);

    if (!limit || limit < 1) {
        limit = 10;
    }

    if (limit > 25) {
        limit = 25;
    }

    ensureLeaderboard(logger, nk);

    var leaderboard = nk.leaderboardRecordsList(LEADERBOARD_ID, [ctx.userId], limit, input.cursor || null, 0);
    var records = leaderboard.records || [];
    var ownerRecords = leaderboard.ownerRecords || [];

    return JSON.stringify({
        records: records.map(mapLeaderboardRecord),
        ownerRecords: ownerRecords.map(mapLeaderboardRecord),
        nextCursor: leaderboard.nextCursor || null,
        prevCursor: leaderboard.prevCursor || null
    });
}

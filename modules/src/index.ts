function InitModule(ctx, logger, nk, initializer) {
    initializer.registerMatch(MATCH_NAME, {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });
    initializer.registerRpc("create_ttt_match", rpcCreateMatch);
    initializer.registerRpc("get_ttt_leaderboard", rpcGetLeaderboard);
    initializer.registerMatchmakerMatched(matchmakerMatched);

    ensureLeaderboard(logger, nk);
}

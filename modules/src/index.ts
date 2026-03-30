function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: Nakama, initializer: nkruntime.Initializer) {
    initializer.registerMatch("tic-tac-toe", {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });

    initializer.registerRpc("create_ttt_match", rpcCreateMatch);
    initializer.registerMatchmakerMatched(matchmakerMatched);
}

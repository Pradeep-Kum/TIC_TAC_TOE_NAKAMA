function matchmakerMatched(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: Nakama,
    matches: nkruntime.MatchmakerResult[]
) {
    return nk.matchCreate("tic-tac-toe", {});
}

function rpcCreateMatch(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: Nakama,
    payload: string
) {
    var matchId = nk.matchCreate("tic-tac-toe", { creator: ctx.userId });
    return JSON.stringify({ matchId: matchId });
}

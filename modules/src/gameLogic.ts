var WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

function createInitialMatchState(mode: MatchMode): MatchState {
    return {
        board: new Array(9).fill(null),
        players: [],
        turn: "X",
        status: "waiting",
        winner: null,
        endedReason: null,
        mode: mode,
        turnTimeLimitSeconds: getTurnLimitSeconds(mode),
        turnDeadlineTick: null,
        lastTimerBroadcastTick: null,
        resultRecorded: false
    };
}

function getWinningSymbol(board: BoardCell[]): CellSymbol | null {
    for (var i = 0; i < WINNING_LINES.length; i++) {
        var line = WINNING_LINES[i];
        var a = line[0];
        var b = line[1];
        var c = line[2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    return null;
}

function isBoardFull(board: BoardCell[]): boolean {
    for (var i = 0; i < board.length; i++) {
        if (board[i] === null) {
            return false;
        }
    }

    return true;
}

function getTurnSecondsRemaining(state: MatchState, tick: number): number | null {
    if (state.turnDeadlineTick === null || state.turnDeadlineTick === undefined) {
        return null;
    }

    var remaining = state.turnDeadlineTick - tick;
    return remaining > 0 ? remaining : 0;
}

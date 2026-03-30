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

function createInitialMatchState(): MatchState {
    return {
        board: new Array(9).fill(null),
        players: [],
        turn: "X",
        status: "waiting",
        winner: null,
        endedReason: null
    };
}

function findWinningSymbol(board: BoardCell[]): CellSymbol | null {
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

function getNextTurn(symbol: CellSymbol): CellSymbol {
    return symbol === "X" ? "O" : "X";
}

function isValidMoveIndex(index: number): boolean {
    return index >= 0 && index <= 8 && Math.floor(index) === index;
}

function findCurrentPlayer(state: MatchState): PlayerState | null {
    for (var i = 0; i < state.players.length; i++) {
        if (state.players[i].symbol === state.turn) {
            return state.players[i];
        }
    }

    return null;
}

function applyMove(state: MatchState, player: PlayerState | null, index: number): MatchMoveResult {
    if (state.status !== "playing" || !player || !isValidMoveIndex(index)) {
        return { applied: false };
    }

    if (player.symbol !== state.turn || state.board[index] !== null) {
        return { applied: false };
    }

    state.board[index] = state.turn;

    var winningSymbol = findWinningSymbol(state.board);
    if (winningSymbol) {
        state.status = "won";
        state.winner = winningSymbol;
        state.endedReason = "line_complete";
        return { applied: true, state: state };
    }

    if (isBoardFull(state.board)) {
        state.status = "draw";
        state.winner = null;
        state.endedReason = "board_full";
        return { applied: true, state: state };
    }

    state.turn = getNextTurn(state.turn);
    return { applied: true, state: state };
}

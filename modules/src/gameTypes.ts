type CellSymbol = "X" | "O";
type BoardCell = CellSymbol | null;
type MatchStatus = "waiting" | "playing" | "won" | "draw" | "abandoned";
type EndedReason = "line_complete" | "board_full" | "opponent_left" | null;

type PlayerState = {
    userId: string | null;
    sessionId: string | null;
    symbol: CellSymbol;
};

type MatchState = {
    board: BoardCell[];
    players: PlayerState[];
    turn: CellSymbol;
    status: MatchStatus;
    winner: CellSymbol | null;
    endedReason: EndedReason;
};

type MatchMoveResult =
    | { applied: false }
    | {
        applied: true;
        state: MatchState;
    };

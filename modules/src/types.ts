type CellSymbol = "X" | "O";
type BoardCell = CellSymbol | null;
type MatchMode = "classic" | "timed";
type MatchStatus = "waiting" | "playing" | "won" | "draw" | "abandoned";
type EndedReason = "line_complete" | "board_full" | "opponent_left" | "timeout" | null;

type PlayerState = {
    userId: string | null;
    sessionId: string | null;
    username: string | null;
    symbol: CellSymbol;
};

type MatchState = {
    board: BoardCell[];
    players: PlayerState[];
    turn: CellSymbol;
    status: MatchStatus;
    winner: CellSymbol | null;
    endedReason: EndedReason;
    mode: MatchMode;
    turnTimeLimitSeconds: number | null;
    turnDeadlineTick: number | null;
    lastTimerBroadcastTick: number | null;
    resultRecorded: boolean;
};

type PlayerStats = {
    userId: string;
    username: string | null;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    currentWinStreak: number;
    bestWinStreak: number;
};

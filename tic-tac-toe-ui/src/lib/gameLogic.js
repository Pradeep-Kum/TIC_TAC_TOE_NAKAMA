const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createEmptyBoard() {
  return Array(9).fill(null);
}

export function findWinningSymbol(board) {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

export function getStatusText({ gameStatus, endedReason, finalWinner, mySymbol, isXTurn }) {
  if (gameStatus === "abandoned") {
    if (endedReason === "opponent_left") {
      return finalWinner === mySymbol
        ? "Opponent disconnected. You win by forfeit."
        : "You disconnected.";
    }

    return "Match ended.";
  }

  if (gameStatus === "won") {
    return `Winner: ${finalWinner}!`;
  }

  if (gameStatus === "draw") {
    return "It's a draw!";
  }

  if (gameStatus === "waiting") {
    return "Waiting for players...";
  }

  return `Turn: ${isXTurn ? "X" : "O"}`;
}

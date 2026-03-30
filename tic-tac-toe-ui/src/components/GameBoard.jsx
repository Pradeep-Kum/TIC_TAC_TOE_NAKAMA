export function GameBoard({ board, hasGameEnded, onSelectCell }) {
  return (
    <div className="game-board" role="grid" aria-label="Tic-tac-toe board">
      {board.map((cell, index) => (
        <button
          key={index}
          className={`board-cell ${cell ? `board-cell--${cell.toLowerCase()}` : ""}`}
          disabled={Boolean(cell) || hasGameEnded}
          onClick={() => onSelectCell(index)}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}

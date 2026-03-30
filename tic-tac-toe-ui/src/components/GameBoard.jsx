export function GameBoard({ board, disabled, onSelectCell }) {
  return (
    <div className="game-board" role="grid" aria-label="Tic-tac-toe board">
      {board.map((cell, index) => (
        <button
          key={index}
          className={`board-cell ${cell ? `board-cell--${cell.toLowerCase()}` : ""}`}
          disabled={disabled || Boolean(cell)}
          onClick={() => onSelectCell(index)}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}

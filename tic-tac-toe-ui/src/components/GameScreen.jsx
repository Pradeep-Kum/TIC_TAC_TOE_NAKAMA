import { GameBoard } from "./GameBoard";

export function GameScreen({
  mySymbol,
  statusText,
  hasGameEnded,
  board,
  onPlayAgain,
  onPlayMove,
}) {
  return (
    <section className="game-screen">
      <div className="panel player-panel">
        <p className="eyebrow">Playing As</p>
        <p className={`player-symbol player-symbol--${(mySymbol || "pending").toLowerCase()}`}>
          {mySymbol || "Assigning..."}
        </p>
      </div>

      <div className="status-panel">
        <h2>{statusText}</h2>
        {hasGameEnded ? (
          <button className="primary-button" onClick={onPlayAgain}>
            Play Again
          </button>
        ) : null}
      </div>

      <GameBoard board={board} disabled={hasGameEnded} onSelectCell={onPlayMove} />
    </section>
  );
}

import { GameBoard } from "./GameBoard";

export function MatchScreen({
  mySymbol,
  activeMode,
  isMyTurn,
  turnSecondsRemaining,
  statusText,
  hasGameEnded,
  board,
  onLeaveMatch,
  onPlayMove,
}) {
  return (
    <section className="match-screen">
      <div className="panel player-panel">
        <p className="section-label">Match</p>
        <div className="player-summary">
          <span className="player-summary__label">Playing As</span>
          <div className="player-summary__value-row">
            <strong className={`player-symbol player-symbol--${(mySymbol || "pending").toLowerCase()}`}>{mySymbol || "..."}</strong>
            <span className="player-mode-badge">{activeMode}</span>
          </div>
        </div>
        {activeMode === "timed" && Number.isFinite(turnSecondsRemaining) ? (
          <p className="timer-text">{isMyTurn ? "Your clock" : "Opponent clock"}: {turnSecondsRemaining}s</p>
        ) : null}
      </div>

      <div className="status-panel">
        <h2>{statusText}</h2>
        {hasGameEnded ? (
          <button className="primary-button" onClick={onLeaveMatch}>
            Back To Lobby
          </button>
        ) : null}
      </div>

      <GameBoard board={board} hasGameEnded={hasGameEnded} onSelectCell={onPlayMove} />
    </section>
  );
}

import { formatPlayerName } from "../lib/match";

export function LeaderboardPanel({ leaderboard, leaderboardLoading, leaderboardError, myStanding }) {
  return (
    <section className="panel leaderboard-panel">
      <h2>Leaderboard</h2>

      {leaderboardLoading ? (
        <p className="muted-text">Loading leaderboard...</p>
      ) : leaderboardError ? (
        <p className="error-text">{leaderboardError}</p>
      ) : leaderboard.length === 0 ? (
        <p className="muted-text">No ranked players yet.</p>
      ) : (
        leaderboard.map((entry) => (
          <div className="leaderboard-row" key={entry.ownerId || `${entry.rank}-${entry.username}`}>
            <strong className="leaderboard-rank">#{entry.rank || "-"}</strong>
            <div>
              <div>{formatPlayerName(entry.username, entry.ownerId)}</div>
              <div className="leaderboard-meta">
                {entry.stats?.wins || 0}W / {entry.stats?.losses || 0}L / {entry.stats?.draws || 0}D
              </div>
            </div>
            <div className="leaderboard-streak">streak {entry.stats?.currentWinStreak || 0}</div>
          </div>
        ))
      )}

      {myStanding ? (
        <div className="my-standing">
          Your rank: #{myStanding.rank || "-"} - {myStanding.stats?.wins || 0} wins - streak {myStanding.stats?.currentWinStreak || 0}
        </div>
      ) : null}
    </section>
  );
}

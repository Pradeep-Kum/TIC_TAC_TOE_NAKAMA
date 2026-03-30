import "./App.css";
import { AccountBar } from "./components/AccountBar";
import { AuthScreen } from "./components/AuthScreen";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { LobbyPanel } from "./components/LobbyPanel";
import { MatchScreen } from "./components/MatchScreen";
import { getStatusText } from "./lib/match";
import { useTicTacToeApp } from "./hooks/useTicTacToeApp";

function App() {
  const {
    authMode,
    authUsername,
    authPassword,
    authError,
    authLoading,
    isAuthenticated,
    accountUsername,
    selectedMode,
    mySymbol,
    currentMatchId,
    board,
    isXTurn,
    isSearching,
    gameStatus,
    winnerSymbol,
    endedReason,
    rooms,
    roomsLoading,
    roomError,
    activeMode,
    turnSecondsRemaining,
    leaderboard,
    leaderboardLoading,
    leaderboardError,
    myStanding,
    setAuthMode,
    setAuthUsername,
    setAuthPassword,
    setSelectedMode,
    submitAuth,
    logout,
    findMatch,
    createRoom,
    refreshRooms,
    joinRoom,
    playMove,
    leaveCompletedMatch,
  } = useTicTacToeApp();

  const hasGameEnded = gameStatus === "won" || gameStatus === "draw" || gameStatus === "abandoned";
  const currentTurnSymbol = isXTurn ? "X" : "O";
  const isMyTurn = mySymbol && mySymbol === currentTurnSymbol;
  const statusText = getStatusText({
    gameStatus,
    endedReason,
    finalWinner: winnerSymbol,
    mySymbol,
    currentTurnSymbol,
    activeMode,
    turnSecondsRemaining,
  });

  if (authLoading) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Multiplayer With Bonuses</p>
        <h1>Nakama Tic-Tac-Toe</h1>
        <p className="hero-copy">
          Server-authoritative real-time play with classic and timed modes, account login, and a persistent leaderboard.
        </p>
      </header>

      {!isAuthenticated ? (
        <AuthScreen
          authMode={authMode}
          authUsername={authUsername}
          authPassword={authPassword}
          authError={authError}
          onSwitchMode={(mode) => {
            setAuthMode(mode);
          }}
          onUsernameChange={setAuthUsername}
          onPasswordChange={setAuthPassword}
          onSubmit={submitAuth}
        />
      ) : (
        <>
          <AccountBar accountUsername={accountUsername} onLogout={logout} />

          {!currentMatchId ? (
            <div className="dashboard-grid">
              <LobbyPanel
                selectedMode={selectedMode}
                isSearching={isSearching}
                rooms={rooms}
                roomsLoading={roomsLoading}
                roomError={roomError}
                onSelectMode={setSelectedMode}
                onFindMatch={findMatch}
                onCreateRoom={createRoom}
                onRefreshRooms={refreshRooms}
                onJoinRoom={joinRoom}
              />
              <LeaderboardPanel
                leaderboard={leaderboard}
                leaderboardLoading={leaderboardLoading}
                leaderboardError={leaderboardError}
                myStanding={myStanding}
              />
            </div>
          ) : (
            <MatchScreen
              mySymbol={mySymbol}
              activeMode={activeMode}
              isMyTurn={Boolean(isMyTurn)}
              turnSecondsRemaining={turnSecondsRemaining}
              statusText={statusText}
              hasGameEnded={hasGameEnded}
              board={board}
              onLeaveMatch={leaveCompletedMatch}
              onPlayMove={playMove}
            />
          )}
        </>
      )}
    </main>
  );
}

export default App;

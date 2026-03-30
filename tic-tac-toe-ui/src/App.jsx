import "./App.css";
import { GameScreen } from "./components/GameScreen";
import { LobbyPanel } from "./components/LobbyPanel";
import { useNakamaGame } from "./hooks/useNakamaGame";
import { findWinningSymbol, getStatusText } from "./lib/gameLogic";

function App() {
  const {
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
    createRoom,
    findMatch,
    joinRoom,
    playAgain,
    playMove,
    refreshRooms,
  } = useNakamaGame();

  const fallbackWinner = findWinningSymbol(board);
  const finalWinner = winnerSymbol || fallbackWinner;
  const hasGameEnded = gameStatus === "won" || gameStatus === "draw" || gameStatus === "abandoned";
  const statusText = getStatusText({
    gameStatus,
    endedReason,
    finalWinner,
    mySymbol,
    isXTurn,
  });

  return (
    <main className="app-shell">
      <div className="app-header">
        <p className="eyebrow">Real-Time Multiplayer</p>
        <h1>Nakama Tic-Tac-Toe</h1>
        <p className="hero-copy">
          Server-authoritative matchmaking, private rooms, and synchronized live gameplay.
        </p>
      </div>

      {!currentMatchId ? (
        <LobbyPanel
          isSearching={isSearching}
          rooms={rooms}
          roomsLoading={roomsLoading}
          roomError={roomError}
          onFindMatch={findMatch}
          onCreateRoom={createRoom}
          onRefreshRooms={refreshRooms}
          onJoinRoom={joinRoom}
        />
      ) : (
        <GameScreen
          mySymbol={mySymbol}
          statusText={statusText}
          hasGameEnded={hasGameEnded}
          board={board}
          onPlayAgain={playAgain}
          onPlayMove={playMove}
        />
      )}
    </main>
  );
}

export default App;

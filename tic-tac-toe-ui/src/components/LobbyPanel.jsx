import { modeOptions } from "../lib/match";

export function LobbyPanel({
  selectedMode,
  isSearching,
  rooms,
  roomsLoading,
  roomError,
  onSelectMode,
  onFindMatch,
  onCreateRoom,
  onRefreshRooms,
  onJoinRoom,
}) {
  return (
    <section className="panel lobby-panel">
      <h2>Lobby</h2>

      <div className="mode-grid">
        {modeOptions.map((mode) => (
          <button
            key={mode.id}
            className={selectedMode === mode.id ? "mode-card is-active" : "mode-card"}
            onClick={() => onSelectMode(mode.id)}
          >
            <strong>{mode.label}</strong>
            <span>{mode.description}</span>
          </button>
        ))}
      </div>

      {isSearching ? (
        <p className="muted-text">Searching for a {selectedMode} opponent...</p>
      ) : (
        <>
          <button className="primary-button" onClick={onFindMatch}>
            Auto Match ({selectedMode.toUpperCase()})
          </button>

          <div className="action-grid">
            <button className="secondary-button" onClick={onCreateRoom}>
              Create Room
            </button>
            <button className="ghost-button" onClick={onRefreshRooms}>
              Refresh Rooms
            </button>
          </div>

          {roomError ? <p className="error-text">{roomError}</p> : null}

          <div className="room-list">
            <p className="section-label">Open {selectedMode} Rooms</p>
            {roomsLoading ? (
              <p className="muted-text">Loading rooms...</p>
            ) : rooms.length === 0 ? (
              <p className="muted-text">No open rooms found for this mode.</p>
            ) : (
              rooms.map((room) => (
                <div className="room-card" key={room.matchId}>
                  <span>
                    {room.matchId.slice(0, 8)}... ({room.size}/2) - {room.mode}
                  </span>
                  <button className="join-button" onClick={() => onJoinRoom(room.matchId)}>
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

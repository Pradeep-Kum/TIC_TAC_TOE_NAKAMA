export function LobbyPanel({
  isSearching,
  rooms,
  roomsLoading,
  roomError,
  onFindMatch,
  onCreateRoom,
  onRefreshRooms,
  onJoinRoom,
}) {
  return (
    <section className="panel lobby-panel">
      <h2>Lobby</h2>

      {isSearching ? (
        <p className="muted-text">Searching for opponent...</p>
      ) : (
        <>
          <button className="primary-button" onClick={onFindMatch}>
            Auto Match
          </button>

          <div className="lobby-actions">
            <button className="secondary-button" onClick={onCreateRoom}>
              Create Room
            </button>
            <button className="ghost-button" onClick={onRefreshRooms}>
              Refresh Rooms
            </button>
          </div>

          {roomError ? <p className="error-text">{roomError}</p> : null}

          <div className="room-list">
            <div className="room-list__header">
              <p>Open Rooms</p>
            </div>

            {roomsLoading ? (
              <p className="muted-text">Loading rooms...</p>
            ) : rooms.length === 0 ? (
              <p className="muted-text">No open rooms found.</p>
            ) : (
              rooms.map((room) => (
                <div className="room-card" key={room.matchId}>
                  <span>
                    {room.matchId.slice(0, 8)}... ({room.size}/2)
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

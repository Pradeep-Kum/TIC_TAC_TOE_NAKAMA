import React, { useEffect, useRef, useState } from "react";
import { Client } from "@heroiclabs/nakama-js";

const nakamaServerKey = import.meta.env.VITE_NAKAMA_SERVER_KEY || "defaultkey";
const nakamaHost = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1";
const nakamaPort = import.meta.env.VITE_NAKAMA_PORT || "7350";
const nakamaUseSsl = import.meta.env.VITE_NAKAMA_USE_SSL === "true";

const client = new Client(nakamaServerKey, nakamaHost, nakamaPort, nakamaUseSsl);

function decodeMatchPayload(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(raw));
  return "";
}

function App() {
  const socketRef = useRef(null);
  const sessionRef = useRef(null);
  const connectionLock = useRef(false);
  const identityRef = useRef({ userId: null, sessionId: null });
  const currentMatchIdRef = useRef("");
  const lastSyncRequestAtRef = useRef(0);
  const matchmakerTicketRef = useRef(null);

  const [mySymbol, setMySymbol] = useState(null);
  const [currentMatchId, setCurrentMatchId] = useState("");
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXTurn, setIsXTurn] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [gameStatus, setGameStatus] = useState("waiting");
  const [winnerSymbol, setWinnerSymbol] = useState(null);
  const [endedReason, setEndedReason] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomError, setRoomError] = useState("");

  const parseRpcPayload = (payload) => {
    if (!payload) return {};
    if (typeof payload === "string") {
      try {
        return JSON.parse(payload);
      } catch {
        return {};
      }
    }
    return payload;
  };

  const cancelMatchmaking = async () => {
    if (!socketRef.current || !matchmakerTicketRef.current) return;
    const ticket = matchmakerTicketRef.current;
    matchmakerTicketRef.current = null;
    try {
      await socketRef.current.removeMatchmaker(ticket);
    } catch (error) {
      console.warn("Failed to remove matchmaker ticket:", error);
    }
  };

  useEffect(() => {
    currentMatchIdRef.current = currentMatchId;
  }, [currentMatchId]);

  useEffect(() => {
    let cancelled = false;

    if (connectionLock.current) return;
    connectionLock.current = true;

    const init = async () => {
      try {
        const session = await client.authenticateDevice(Math.random().toString(36), true);
        sessionRef.current = session;
        identityRef.current = {
          userId: session.user_id || session.userId || null,
          sessionId: session.session_id || session.sessionId || null,
        };

        const socket = client.createSocket(false, false);
        const enterJoinedMatch = async (match) => {
          if (cancelled) return;

          identityRef.current = {
            userId: match.self?.user_id || match.self?.userId || identityRef.current.userId,
            sessionId: match.self?.session_id || match.self?.sessionId || identityRef.current.sessionId,
          };

          const joinedMatchId = match.match_id || match.matchId;
          currentMatchIdRef.current = joinedMatchId;
          setCurrentMatchId(joinedMatchId);
          setIsSearching(false);
          setRooms([]);
          setRoomError("");
          setGameStatus("waiting");
          setWinnerSymbol(null);
          setEndedReason(null);

          setTimeout(() => {
            requestSync(joinedMatchId);
          }, 500);
        };
        const requestSync = async (matchId) => {
          if (!matchId || cancelled) return;
          const now = Date.now();
          if (now - lastSyncRequestAtRef.current < 350) return;
          lastSyncRequestAtRef.current = now;
          console.log("SENDING SYNC REQUEST...");
          await socket.sendMatchState(matchId, 4, "{}");
        };

        socket.onmatchmakermatched = async (matched) => {
          if (cancelled) return;

          console.log("MATCHMAKER SUCCESS:", matched);
          const hasToken = typeof matched.token === "string" && matched.token.length > 0;
          const hasMatchId = typeof matched.match_id === "string" && matched.match_id.length > 0;
          if (!hasToken && !hasMatchId) {
            console.error("MATCHMAKER ERROR: no token or match_id in payload", matched);
            setIsSearching(false);
            return;
          }

          matchmakerTicketRef.current = null;
          const match = hasToken
            ? await socket.joinMatch(null, matched.token)
            : await socket.joinMatch(matched.match_id);
          await enterJoinedMatch(match);
        };

        socket.onmatchpresence = (presenceEvent) => {
          const presenceMatchId = presenceEvent.match_id || presenceEvent.matchId;
          if (presenceMatchId && presenceMatchId === currentMatchIdRef.current) {
            requestSync(presenceMatchId);
          }
        };

        socket.onmatchdata = (data) => {
          const opCode = Number(data.op_code || data.opCode);
          const jsonString = decodeMatchPayload(data.data);

          if (opCode !== 1) return;

          if (!jsonString || jsonString === "{}") {
            console.warn("Received empty payload from server");
            requestSync(currentMatchIdRef.current);
            return;
          }

          let payload = null;
          try {
            payload = JSON.parse(jsonString);
          } catch (error) {
            console.error("Failed to parse match payload:", jsonString, error);
            return;
          }

          console.log(`INCOMING: OpCode ${opCode}`, payload);

          setBoard(Array.isArray(payload.board) && payload.board.length === 9 ? payload.board : Array(9).fill(null));
          setIsXTurn(payload.turn === "X");
          setGameStatus(payload.status || "playing");
          setWinnerSymbol(payload.winner === "X" || payload.winner === "O" ? payload.winner : null);
          setEndedReason(payload.endedReason || null);

          if (payload.players) {
            const me = payload.players.find((player) =>
              player.sessionId === identityRef.current.sessionId ||
              player.session_id === identityRef.current.sessionId ||
              player.userId === identityRef.current.userId ||
              player.user_id === identityRef.current.userId
            );

            if (me) {
              console.log("SYMBOL ASSIGNED:", me.symbol);
              setMySymbol(me.symbol);
            } else {
              console.warn("My identity not found in player list:", identityRef.current);
            }
          }
        };

        await socket.connect(session, true);
        if (cancelled) {
          socket.disconnect();
          return;
        }
        socketRef.current = socket;
        console.log("Single Socket Connected:", identityRef.current);
      } catch (e) {
        console.error("NAKAMA ERROR:", e);
        if (!cancelled) {
          connectionLock.current = false;
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      connectionLock.current = false;
    };
  }, []);

  const findMatch = async () => {
    if (!socketRef.current) return;
    await cancelMatchmaking();
    setIsSearching(true);
    setMySymbol(null);
    setGameStatus("waiting");
    setWinnerSymbol(null);
    setEndedReason(null);
    setBoard(Array(9).fill(null));
    setRoomError("");
    const ticket = await socketRef.current.addMatchmaker("*", 2, 2);
    matchmakerTicketRef.current = ticket?.ticket || null;
    console.log("Added to Matchmaker...");
  };

  const applyJoinedMatchState = async (match) => {
    identityRef.current = {
      userId: match.self?.user_id || match.self?.userId || identityRef.current.userId,
      sessionId: match.self?.session_id || match.self?.sessionId || identityRef.current.sessionId,
    };

    const joinedMatchId = match.match_id || match.matchId;
    currentMatchIdRef.current = joinedMatchId;
    setCurrentMatchId(joinedMatchId);
    setIsSearching(false);
    setRooms([]);
    setRoomError("");
    setGameStatus("waiting");
    setWinnerSymbol(null);
    setEndedReason(null);

    if (socketRef.current && joinedMatchId) {
      await socketRef.current.sendMatchState(joinedMatchId, 4, "{}");
    }
  };

  const createRoom = async () => {
    if (!socketRef.current || !sessionRef.current) return;
    await cancelMatchmaking();
    setRoomError("");

    try {
      const rpcResponse = await client.rpc(sessionRef.current, "create_ttt_match", {});
      const payload = parseRpcPayload(rpcResponse?.payload);
      const matchId = payload.matchId || payload.match_id;
      if (!matchId) {
        setRoomError("Could not create room.");
        return;
      }

      const match = await socketRef.current.joinMatch(matchId);
      await applyJoinedMatchState(match);
    } catch (error) {
      console.error("Failed to create room:", error);
      setRoomError("Room creation failed.");
    }
  };

  const refreshRooms = async () => {
    if (!sessionRef.current) return;
    await cancelMatchmaking();
    setIsSearching(false);
    setRoomsLoading(true);
    setRoomError("");

    try {
      const response = await client.listMatches(sessionRef.current, 20, true, "tic-tac-toe", 0, 2);
      const available = (response.matches || [])
        .filter((match) => match.match_id && (match.size || 0) < 2)
        .map((match) => ({
          matchId: match.match_id,
          size: match.size || 0,
          authoritative: !!match.authoritative,
        }));
      setRooms(available);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
      setRoomError("Could not fetch rooms.");
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  };

  const joinRoom = async (matchId) => {
    if (!socketRef.current || !matchId) return;
    await cancelMatchmaking();
    setRoomError("");

    try {
      const match = await socketRef.current.joinMatch(matchId);
      await applyJoinedMatchState(match);
    } catch (error) {
      console.error("Failed to join room:", error);
      setRoomError("Could not join room. It may already be full.");
      await refreshRooms();
    }
  };

  const handleClick = async (index) => {
    if (
      !socketRef.current ||
      board[index] ||
      !currentMatchId ||
      !mySymbol ||
      gameStatus !== "playing" ||
      mySymbol !== (isXTurn ? "X" : "O")
    ) {
      return;
    }

    await socketRef.current.sendMatchState(currentMatchId, 1, JSON.stringify({ index }));
  };

  const handlePlayAgain = async () => {
    if (!socketRef.current) return;

    const previousMatchId = currentMatchId;

    setMySymbol(null);
    setCurrentMatchId("");
    currentMatchIdRef.current = "";
    setBoard(Array(9).fill(null));
    setIsXTurn(true);
    setIsSearching(true);
    setGameStatus("waiting");
    setWinnerSymbol(null);
    setEndedReason(null);

    try {
      if (previousMatchId) {
        await socketRef.current.leaveMatch(previousMatchId);
      }
    } catch (error) {
      console.warn("Failed to leave previous match:", error);
    }

    try {
      await cancelMatchmaking();
      const ticket = await socketRef.current.addMatchmaker("*", 2, 2);
      matchmakerTicketRef.current = ticket?.ticket || null;
      console.log("Added to Matchmaker...");
    } catch (error) {
      console.error("Failed to re-enter matchmaker:", error);
      setIsSearching(false);
    }
  };

  const winner = (() => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }

    return null;
  })();
  const finalWinner = winnerSymbol || winner;
  const hasGameEnded = gameStatus === "won" || gameStatus === "draw" || gameStatus === "abandoned";
  const cellSize = "min(28vw, 110px)";
  const boardGap = "min(3.2vw, 15px)";
  const panelWidth = "min(94vw, 450px)";
  const statusText =
    gameStatus === "abandoned"
      ? endedReason === "opponent_left"
        ? finalWinner === mySymbol
          ? "Opponent disconnected. You win by forfeit."
          : "You disconnected."
        : "Match ended."
      : gameStatus === "won"
      ? `Winner: ${finalWinner}!`
      : gameStatus === "draw"
      ? "It's a draw!"
      : gameStatus === "waiting"
      ? "Waiting for players..."
      : `Turn: ${isXTurn ? "X" : "O"}`;

  return (
    <div
      style={{
        textAlign: "center",
        backgroundColor: "#121212",
        color: "#fff",
        minHeight: "100vh",
        padding: "14px",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: "clamp(1.5rem, 5.6vw, 2.1rem)", margin: "10px 0 16px 0" }}>Nakama Tic-Tac-Toe</h1>

      {!currentMatchId ? (
        <div
          style={{
            margin: "20px auto",
            padding: "20px",
            border: "2px solid #333",
            width: panelWidth,
            borderRadius: "15px",
            backgroundColor: "#1e1e1e",
            boxSizing: "border-box",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Lobby</h3>
          {isSearching ? (
            <p>Searching for opponent...</p>
          ) : (
            <>
              <button
                onClick={findMatch}
                style={{
                  width: "100%",
                  padding: "13px",
                  cursor: "pointer",
                  backgroundColor: "#FF9800",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  fontSize: "clamp(0.9rem, 3.8vw, 1.1rem)",
                  marginBottom: "12px",
                }}
              >
                AUTO MATCH
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <button
                  onClick={createRoom}
                  style={{
                    padding: "11px",
                    cursor: "pointer",
                    backgroundColor: "#1565C0",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                  }}
                >
                  CREATE ROOM
                </button>
                <button
                  onClick={refreshRooms}
                  style={{
                    padding: "11px",
                    cursor: "pointer",
                    backgroundColor: "#455A64",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                  }}
                >
                  REFRESH ROOMS
                </button>
              </div>

              {roomError && <p style={{ color: "#FF8A80", margin: "8px 0" }}>{roomError}</p>}

              <div style={{ textAlign: "left", marginTop: "10px" }}>
                <p style={{ margin: "6px 0", color: "#BDBDBD" }}>Open Rooms</p>
                {roomsLoading ? (
                  <p style={{ margin: 0 }}>Loading rooms...</p>
                ) : rooms.length === 0 ? (
                  <p style={{ margin: 0, color: "#9E9E9E" }}>No open rooms found.</p>
                ) : (
                  rooms.map((room) => (
                    <div
                      key={room.matchId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "8px",
                        padding: "8px 10px",
                        border: "1px solid #333",
                        borderRadius: "8px",
                      }}
                    >
                      <span style={{ fontSize: "12px", color: "#CFD8DC" }}>
                        {room.matchId.slice(0, 8)}... ({room.size}/2)
                      </span>
                      <button
                        onClick={() => joinRoom(room.matchId)}
                        style={{
                          padding: "7px 10px",
                          cursor: "pointer",
                          backgroundColor: "#2E7D32",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: "bold",
                          fontSize: "12px",
                        }}
                      >
                        JOIN
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div
            style={{
              marginBottom: "20px",
              padding: "12px 14px",
              backgroundColor: "#1e1e1e",
              borderRadius: "12px",
              display: "inline-block",
              border: "1px solid #333",
              width: panelWidth,
              boxSizing: "border-box",
            }}
          >
            <p style={{ margin: "5px 0", fontSize: "1.2em" }}>
              Playing as:{" "}
              <strong style={{ color: mySymbol === "X" ? "#FF5252" : "#448AFF" }}>
                {mySymbol || "Assigning..."}
              </strong>
            </p>
          </div>

          <h2 style={{ height: "40px", color: hasGameEnded ? "#4CAF50" : "#fff" }}>
            {statusText}
          </h2>

          {hasGameEnded && (
            <div style={{ marginBottom: "18px" }}>
              <button
                onClick={handlePlayAgain}
                style={{
                  padding: "12px 18px",
                  cursor: "pointer",
                  backgroundColor: "#00C853",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  fontSize: "16px",
                }}
              >
                PLAY AGAIN
              </button>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(3, ${cellSize})`,
              gap: boardGap,
              justifyContent: "center",
            }}
          >
            {board.map((cell, i) => (
              <button
                key={i}
                onClick={() => handleClick(i)}
                style={{
                  width: cellSize,
                  height: cellSize,
                  fontSize: "clamp(2rem, 12vw, 3.5rem)",
                  fontWeight: "900",
                  backgroundColor: "#1e1e1e",
                  color: cell === "X" ? "#FF5252" : "#448AFF",
                  border: "3px solid #333",
                  borderRadius: "15px",
                  cursor: cell || hasGameEnded ? "default" : "pointer",
                }}
              >
                {cell}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;

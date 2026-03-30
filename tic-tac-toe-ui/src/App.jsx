import React, { useEffect, useRef, useState } from "react";
import { Client, Session } from "@heroiclabs/nakama-js";

const nakamaServerKey = import.meta.env.VITE_NAKAMA_SERVER_KEY || "defaultkey";
const nakamaHost = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1";
const nakamaPort = import.meta.env.VITE_NAKAMA_PORT || "7350";
const nakamaUseSsl = import.meta.env.VITE_NAKAMA_USE_SSL === "true";
const sessionStorageKey = "ttt_nakama_session";

const client = new Client(nakamaServerKey, nakamaHost, nakamaPort, nakamaUseSsl);
const modeOptions = [
  { id: "classic", label: "Classic", description: "No move timer" },
  { id: "timed", label: "Timed", description: "30 seconds per turn" },
];

function decodeMatchPayload(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(raw));
  return "";
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function parseMatchLabel(label) {
  const parsed = parseJson(label, null);
  if (!parsed || typeof parsed !== "object") {
    return { name: "tic-tac-toe", mode: "classic" };
  }
  return {
    name: parsed.name || "tic-tac-toe",
    mode: parsed.mode === "timed" ? "timed" : "classic",
  };
}

function formatPlayerName(name, ownerId) {
  if (name && !/^[0-9a-f-]{20,}$/i.test(name)) return name;
  if (ownerId) return `${ownerId.slice(0, 8)}...`;
  return "Player";
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function validateUsername(username) {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    return "Use 3-20 characters: lowercase letters, numbers, or underscore.";
  }
  return "";
}

function makeSyntheticEmail(username) {
  return `${normalizeUsername(username)}@tic-tac-toe.local`;
}

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.error === "string" && error.error.trim()) return error.error;
  return fallback;
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function App() {
  const socketRef = useRef(null);
  const sessionRef = useRef(null);
  const identityRef = useRef({ userId: null, sessionId: null });
  const currentMatchIdRef = useRef("");
  const lastSyncRequestAtRef = useRef(0);
  const matchmakerTicketRef = useRef(null);

  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountUsername, setAccountUsername] = useState("");
  const [selectedMode, setSelectedMode] = useState("classic");
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
  const [activeMode, setActiveMode] = useState("classic");
  const [turnSecondsRemaining, setTurnSecondsRemaining] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [myStanding, setMyStanding] = useState(null);

  const resetGameState = () => {
    setMySymbol(null);
    setCurrentMatchId("");
    currentMatchIdRef.current = "";
    setBoard(Array(9).fill(null));
    setIsXTurn(true);
    setIsSearching(false);
    setGameStatus("waiting");
    setWinnerSymbol(null);
    setEndedReason(null);
    setRooms([]);
    setRoomsLoading(false);
    setRoomError("");
    setActiveMode("classic");
    setTurnSecondsRemaining(null);
  };

  const persistSession = (session) => {
    localStorage.setItem(
      sessionStorageKey,
      JSON.stringify({
        token: session.token,
        refresh_token: session.refresh_token || session.refreshToken || "",
      })
    );
  };

  const clearPersistedSession = () => {
    localStorage.removeItem(sessionStorageKey);
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

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    identityRef.current = { userId: null, sessionId: null };
    matchmakerTicketRef.current = null;
  };

  const loadLeaderboard = async (sessionOverride) => {
    const session = sessionOverride || sessionRef.current;
    if (!session) return;
    setLeaderboardLoading(true);
    setLeaderboardError("");

    try {
      const response = await client.rpc(session, "get_ttt_leaderboard", JSON.stringify({ limit: 10 }));
      const payload = parseJson(response?.payload, {});
      setLeaderboard(Array.isArray(payload.records) ? payload.records : []);
      setMyStanding(Array.isArray(payload.ownerRecords) && payload.ownerRecords.length > 0 ? payload.ownerRecords[0] : null);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
      setLeaderboardError("Could not load leaderboard.");
      setLeaderboard([]);
      setMyStanding(null);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const requestSync = async (matchId) => {
    if (!matchId || !socketRef.current) return;
    const now = Date.now();
    if (now - lastSyncRequestAtRef.current < 350) return;
    lastSyncRequestAtRef.current = now;
    await socketRef.current.sendMatchState(matchId, 4, "{}");
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
    setTurnSecondsRemaining(null);

    if (socketRef.current && joinedMatchId) {
      await socketRef.current.sendMatchState(joinedMatchId, 4, "{}");
    }
  };

  const connectAuthenticatedSession = async (session) => {
    sessionRef.current = session;
    persistSession(session);
    setIsAuthenticated(true);

    const account = await client.getAccount(session);
    const user = account?.user || {};
    setAccountUsername(user.username || "");

    disconnectSocket();

    identityRef.current = {
      userId: session.user_id || session.userId || null,
      sessionId: session.session_id || session.sessionId || null,
    };

    const socket = client.createSocket(false, false);

    socket.onmatchmakermatched = async (matched) => {
      const hasToken = typeof matched.token === "string" && matched.token.length > 0;
      const hasMatchId = typeof matched.match_id === "string" && matched.match_id.length > 0;
      if (!hasToken && !hasMatchId) {
        setIsSearching(false);
        return;
      }

      matchmakerTicketRef.current = null;
      const match = hasToken ? await socket.joinMatch(null, matched.token) : await socket.joinMatch(matched.match_id);
      await applyJoinedMatchState(match);
    };

    socket.onmatchpresence = (presenceEvent) => {
      const presenceMatchId = presenceEvent.match_id || presenceEvent.matchId;
      if (presenceMatchId && presenceMatchId === currentMatchIdRef.current) {
        requestSync(presenceMatchId);
      }
    };

    socket.onmatchdata = (data) => {
      const opCode = Number(data.op_code || data.opCode);
      if (opCode !== 1) return;

      const jsonString = decodeMatchPayload(data.data);
      if (!jsonString || jsonString === "{}") {
        requestSync(currentMatchIdRef.current);
        return;
      }

      let payload = null;
      try {
        payload = JSON.parse(jsonString);
      } catch (error) {
        console.error("Failed to parse match payload:", error);
        return;
      }

      setBoard(Array.isArray(payload.board) && payload.board.length === 9 ? payload.board : Array(9).fill(null));
      setIsXTurn(payload.turn === "X");
      setGameStatus(payload.status || "playing");
      setWinnerSymbol(payload.winner === "X" || payload.winner === "O" ? payload.winner : null);
      setEndedReason(payload.endedReason || null);
      setActiveMode(payload.mode === "timed" ? "timed" : "classic");
      setTurnSecondsRemaining(Number.isFinite(payload.turnSecondsRemaining) ? payload.turnSecondsRemaining : null);

      if (payload.players) {
        const me = payload.players.find((player) =>
          player.sessionId === identityRef.current.sessionId ||
          player.session_id === identityRef.current.sessionId ||
          player.userId === identityRef.current.userId ||
          player.user_id === identityRef.current.userId
        );

        if (me) {
          setMySymbol(me.symbol);
        }
      }
    };

    await socket.connect(session, true);
    socketRef.current = socket;
    await loadLeaderboard(session);
  };

  const restoreSession = async () => {
    const raw = localStorage.getItem(sessionStorageKey);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      const restored = Session.restore(parsed.token, parsed.refresh_token);
      const isExpired = typeof restored.isexpired === "function" ? restored.isexpired(Date.now() / 1000) : restored.isexpired;
      const session = isExpired
        ? await withTimeout(client.sessionRefresh(restored), 5000, "Session refresh timed out.")
        : restored;
      await withTimeout(connectAuthenticatedSession(session), 5000, "Session restore timed out.");
      return true;
    } catch (error) {
      console.warn("Session restore failed:", error);
      clearPersistedSession();
      setAuthError("Previous session expired or could not be restored. Please log in again.");
      return false;
    }
  };

  useEffect(() => {
    currentMatchIdRef.current = currentMatchId;
  }, [currentMatchId]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const restored = await restoreSession();
        if (!restored && !cancelled) {
          resetGameState();
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && (gameStatus === "won" || gameStatus === "draw" || gameStatus === "abandoned")) {
      loadLeaderboard();
    }
  }, [gameStatus, isAuthenticated]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    const usernameError = validateUsername(authUsername);
    if (usernameError) {
      setAuthError(usernameError);
      return;
    }
    if (authPassword.length < 8) {
      setAuthError("Use a password with at least 8 characters.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      const normalizedUsername = normalizeUsername(authUsername);
      const create = authMode === "signup";
      const session = await client.authenticateEmail(
        create ? makeSyntheticEmail(normalizedUsername) : "",
        authPassword,
        create,
        normalizedUsername
      );
      resetGameState();
      await connectAuthenticatedSession(session);
      setAuthPassword("");
    } catch (error) {
      console.error("Authentication failed:", error);
      setAuthError(
        authMode === "signup"
          ? getErrorMessage(error, "Sign up failed. The username may already be taken.")
          : getErrorMessage(error, "Login failed. Check your username and password.")
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await cancelMatchmaking();
      if (socketRef.current && currentMatchIdRef.current) {
        await socketRef.current.leaveMatch(currentMatchIdRef.current);
      }
      if (sessionRef.current) {
        await client.sessionLogout(sessionRef.current);
      }
    } catch (error) {
      console.warn("Logout cleanup failed:", error);
    }

    disconnectSocket();
    clearPersistedSession();
    sessionRef.current = null;
    setIsAuthenticated(false);
    setAccountUsername("");
    setLeaderboard([]);
    setLeaderboardError("");
    setMyStanding(null);
    setAuthPassword("");
    resetGameState();
  };

  const findMatch = async () => {
    if (!socketRef.current) return;
    await cancelMatchmaking();
    setIsSearching(true);
    setMySymbol(null);
    setGameStatus("waiting");
    setWinnerSymbol(null);
    setEndedReason(null);
    setBoard(Array(9).fill(null));
    setTurnSecondsRemaining(null);
    setRoomError("");

    const query = `+properties.mode:${selectedMode}`;
    const ticket = await socketRef.current.addMatchmaker(query, 2, 2, { mode: selectedMode });
    matchmakerTicketRef.current = ticket?.ticket || null;
  };

  const createRoom = async () => {
    if (!socketRef.current || !sessionRef.current) return;
    await cancelMatchmaking();
    setRoomError("");

    try {
      const rpcResponse = await client.rpc(sessionRef.current, "create_ttt_match", JSON.stringify({ mode: selectedMode }));
      const payload = parseJson(rpcResponse?.payload, {});
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
      const response = await client.listMatches(sessionRef.current, 50, true, undefined, 0, 2);
      const available = (response.matches || [])
        .filter((match) => match.match_id && (match.size || 0) < 2)
        .map((match) => {
          const label = parseMatchLabel(match.label);
          return {
            matchId: match.match_id,
            size: match.size || 0,
            authoritative: !!match.authoritative,
            mode: label.mode,
          };
        })
        .filter((match) => match.mode === selectedMode);
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
    setIsSearching(false);
    setGameStatus("waiting");
    setWinnerSymbol(null);
    setEndedReason(null);
    setTurnSecondsRemaining(null);

    try {
      if (previousMatchId) {
        await socketRef.current.leaveMatch(previousMatchId);
      }
    } catch (error) {
      console.warn("Failed to leave previous match:", error);
    }
  };

  const hasGameEnded = gameStatus === "won" || gameStatus === "draw" || gameStatus === "abandoned";
  const panelWidth = "min(94vw, 460px)";
  const cellSize = "min(28vw, 110px)";
  const boardGap = "min(3.2vw, 15px)";
  const currentTurnSymbol = isXTurn ? "X" : "O";
  const isMyTurn = mySymbol && mySymbol === currentTurnSymbol;
  const finalWinner = winnerSymbol;
  const statusText =
    gameStatus === "abandoned"
      ? endedReason === "opponent_left"
        ? finalWinner === mySymbol
          ? "Opponent disconnected. You win by forfeit."
          : "Match ended after a disconnect."
        : endedReason === "timeout"
          ? finalWinner === mySymbol
            ? "Opponent ran out of time. You win."
            : "You ran out of time."
          : "Match ended."
      : gameStatus === "won"
        ? `Winner: ${finalWinner}!`
        : gameStatus === "draw"
          ? "It's a draw!"
          : gameStatus === "waiting"
            ? "Waiting for players..."
            : `Turn: ${currentTurnSymbol}${activeMode === "timed" && Number.isFinite(turnSecondsRemaining) ? ` - ${turnSecondsRemaining}s` : ""}`;

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "#121212", color: "#fff" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          textAlign: "center",
          backgroundColor: "#121212",
          color: "#fff",
          minHeight: "100vh",
          padding: "20px 14px",
          fontFamily: "sans-serif",
        }}
      >
        <h1 style={{ fontSize: "clamp(1.6rem, 6vw, 2.2rem)", margin: "10px 0 16px 0" }}>Nakama Tic-Tac-Toe</h1>
        <div
          style={{
            margin: "0 auto",
            padding: "20px",
            border: "2px solid #333",
            width: panelWidth,
            borderRadius: "15px",
            backgroundColor: "#1e1e1e",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
              style={{
                padding: "12px",
                cursor: "pointer",
                backgroundColor: authMode === "login" ? "#00ACC1" : "#263238",
                color: "white",
                border: "1px solid #455A64",
                borderRadius: "10px",
              }}
            >
              Login
            </button>
            <button
              onClick={() => {
                setAuthMode("signup");
                setAuthError("");
              }}
              style={{
                padding: "12px",
                cursor: "pointer",
                backgroundColor: authMode === "signup" ? "#00ACC1" : "#263238",
                color: "white",
                border: "1px solid #455A64",
                borderRadius: "10px",
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: "grid", gap: "12px" }}>
            <input
              value={authUsername}
              onChange={(event) => setAuthUsername(event.target.value)}
              placeholder="Username"
              autoComplete="username"
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #455A64",
                backgroundColor: "#263238",
                color: "#fff",
              }}
            />
            <input
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Password"
              type="password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #455A64",
                backgroundColor: "#263238",
                color: "#fff",
              }}
            />
            {authError && <p style={{ margin: 0, color: "#FF8A80" }}>{authError}</p>}
            <p style={{ margin: 0, color: "#B0BEC5", fontSize: "13px" }}>
              Username must be unique and use 3-20 lowercase letters, numbers, or underscores. Passwords must be at least 8 characters.
            </p>
            <button
              type="submit"
              style={{
                padding: "12px",
                cursor: "pointer",
                backgroundColor: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
              }}
            >
              {authMode === "signup" ? "Create Account" : "Log In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

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

      <div
        style={{
          margin: "0 auto 18px auto",
          width: panelWidth,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          padding: "10px 14px",
          borderRadius: "12px",
          backgroundColor: "#1e1e1e",
          border: "1px solid #333",
          boxSizing: "border-box",
        }}
      >
        <span style={{ color: "#CFD8DC" }}>Signed in as <strong style={{ color: "#80CBC4" }}>{accountUsername}</strong></span>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            backgroundColor: "#37474F",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
          }}
        >
          LOG OUT
        </button>
      </div>

      {!currentMatchId ? (
        <div style={{ display: "grid", gap: "18px", justifyContent: "center" }}>
          <div
            style={{
              margin: "0 auto",
              padding: "20px",
              border: "2px solid #333",
              width: panelWidth,
              borderRadius: "15px",
              backgroundColor: "#1e1e1e",
              boxSizing: "border-box",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Lobby</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
              {modeOptions.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  style={{
                    padding: "12px",
                    cursor: "pointer",
                    backgroundColor: selectedMode === mode.id ? "#00ACC1" : "#263238",
                    color: "white",
                    border: "1px solid #455A64",
                    borderRadius: "10px",
                  }}
                >
                  <strong>{mode.label}</strong>
                  <div style={{ fontSize: "12px", marginTop: "4px", color: "#CFD8DC" }}>{mode.description}</div>
                </button>
              ))}
            </div>

            {isSearching ? (
              <p>Searching for a {selectedMode} opponent...</p>
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
                  AUTO MATCH ({selectedMode.toUpperCase()})
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
                  <p style={{ margin: "6px 0", color: "#BDBDBD" }}>Open {selectedMode} Rooms</p>
                  {roomsLoading ? (
                    <p style={{ margin: 0 }}>Loading rooms...</p>
                  ) : rooms.length === 0 ? (
                    <p style={{ margin: 0, color: "#9E9E9E" }}>No open rooms found for this mode.</p>
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
                          {room.matchId.slice(0, 8)}... ({room.size}/2) - {room.mode}
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

          <div
            style={{
              margin: "0 auto",
              padding: "20px",
              border: "2px solid #333",
              width: panelWidth,
              borderRadius: "15px",
              backgroundColor: "#1e1e1e",
              boxSizing: "border-box",
              textAlign: "left",
            }}
          >
            <h3 style={{ marginTop: 0, textAlign: "center" }}>Leaderboard</h3>
            {leaderboardLoading ? (
              <p style={{ margin: 0 }}>Loading leaderboard...</p>
            ) : leaderboardError ? (
              <p style={{ margin: 0, color: "#FF8A80" }}>{leaderboardError}</p>
            ) : leaderboard.length === 0 ? (
              <p style={{ margin: 0, color: "#9E9E9E" }}>No ranked players yet.</p>
            ) : (
              leaderboard.map((entry) => (
                <div
                  key={entry.ownerId || `${entry.rank}-${entry.username}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr auto",
                    gap: "10px",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #263238",
                  }}
                >
                  <strong style={{ color: "#80CBC4" }}>#{entry.rank || "-"}</strong>
                  <div>
                    <div>{formatPlayerName(entry.username, entry.ownerId)}</div>
                    <div style={{ fontSize: "12px", color: "#B0BEC5" }}>
                      {entry.stats?.wins || 0}W / {entry.stats?.losses || 0}L / {entry.stats?.draws || 0}D
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "12px", color: "#FFE082" }}>
                    streak {entry.stats?.currentWinStreak || 0}
                  </div>
                </div>
              ))
            )}

            {myStanding && (
              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "12px",
                  borderTop: "1px solid #37474F",
                  textAlign: "center",
                  color: "#CFD8DC",
                }}
              >
                Your rank: #{myStanding.rank || "-"} - {myStanding.stats?.wins || 0} wins - streak {myStanding.stats?.currentWinStreak || 0}
              </div>
            )}
          </div>
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
              Playing as <strong style={{ color: mySymbol === "X" ? "#FF5252" : "#448AFF" }}>{mySymbol || "..."}</strong> in{" "}
              <strong style={{ color: "#80CBC4" }}>{activeMode}</strong> mode
            </p>
            {activeMode === "timed" && Number.isFinite(turnSecondsRemaining) && (
              <p style={{ margin: "4px 0 0 0", color: isMyTurn ? "#FFD54F" : "#B0BEC5" }}>
                {isMyTurn ? "Your clock" : "Opponent clock"}: {turnSecondsRemaining}s
              </p>
            )}
          </div>

          <h2 style={{ minHeight: "40px", color: hasGameEnded ? "#4CAF50" : "#fff" }}>{statusText}</h2>

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
                BACK TO LOBBY
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

import { useEffect, useRef, useState } from "react";
import { Session } from "@heroiclabs/nakama-js";
import { getErrorMessage, makeSyntheticEmail, normalizeUsername, validateUsername, withTimeout } from "../lib/auth";
import { createEmptyBoard, decodeMatchPayload, parseJson, parseMatchLabel } from "../lib/match";
import { nakamaClient, nakamaConfig } from "../lib/nakamaClient";

const sessionStorageKey = nakamaConfig.sessionStorageKey;

export function useTicTacToeApp() {
  const socketRef = useRef(null);
  const sessionRef = useRef(null);
  const identityRef = useRef({ userId: null, sessionId: null });
  const accountUsernameRef = useRef("");
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
  const [board, setBoard] = useState(createEmptyBoard());
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
    setBoard(createEmptyBoard());
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
      }),
    );
  };

  const clearPersistedSession = () => {
    localStorage.removeItem(sessionStorageKey);
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    identityRef.current = { userId: null, sessionId: null };
    matchmakerTicketRef.current = null;
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

  const loadLeaderboard = async (sessionOverride) => {
    const session = sessionOverride || sessionRef.current;
    if (!session) return;

    setLeaderboardLoading(true);
    setLeaderboardError("");

    try {
      const response = await withTimeout(
        nakamaClient.rpc(session, "get_ttt_leaderboard", JSON.stringify({ limit: 10 })),
        5000,
        "Leaderboard request timed out.",
      );
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

    const account = await withTimeout(nakamaClient.getAccount(session), 5000, "Account lookup timed out.");
    const user = account?.user || {};
    accountUsernameRef.current = user.username || "";
    setAccountUsername(user.username || "");

    disconnectSocket();

    identityRef.current = {
      userId: session.user_id || session.userId || null,
      sessionId: session.session_id || session.sessionId || null,
    };

    const socket = nakamaClient.createSocket(nakamaConfig.useSsl, false);

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

      setBoard(Array.isArray(payload.board) && payload.board.length === 9 ? payload.board : createEmptyBoard());
      setIsXTurn(payload.turn === "X");
      setGameStatus(payload.status || "playing");
      setWinnerSymbol(payload.winner === "X" || payload.winner === "O" ? payload.winner : null);
      setEndedReason(payload.endedReason || null);
      setActiveMode(payload.mode === "timed" ? "timed" : "classic");
      setTurnSecondsRemaining(Number.isFinite(payload.turnSecondsRemaining) ? payload.turnSecondsRemaining : null);

      if (payload.players) {
        const me = payload.players.find(
          (player) =>
            player.sessionId === identityRef.current.sessionId ||
            player.session_id === identityRef.current.sessionId ||
            player.userId === identityRef.current.userId ||
            player.user_id === identityRef.current.userId,
        );

        if (me) {
          setMySymbol(me.symbol);
        }
      }
    };

    await withTimeout(socket.connect(session, true), 5000, "Socket connection timed out.");
    socketRef.current = socket;
    loadLeaderboard(session);
  };

  const restoreSession = async () => {
    const raw = localStorage.getItem(sessionStorageKey);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      const restored = Session.restore(parsed.token, parsed.refresh_token);
      const isExpired = typeof restored.isexpired === "function" ? restored.isexpired(Date.now() / 1000) : restored.isexpired;
      const session = isExpired ? await withTimeout(nakamaClient.sessionRefresh(restored), 5000, "Session refresh timed out.") : restored;
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

  const submitAuth = async (event) => {
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
      const email = makeSyntheticEmail(normalizedUsername);
      const session = await withTimeout(
        nakamaClient.authenticateEmail(email, authPassword, create, normalizedUsername),
        5000,
        authMode === "signup" ? "Sign up timed out." : "Login timed out.",
      );
      resetGameState();
      await connectAuthenticatedSession(session);
      setAuthPassword("");
    } catch (error) {
      console.error("Authentication failed:", error);
      setAuthError(
        authMode === "signup"
          ? getErrorMessage(error, "Sign up failed. The username may already be taken.")
          : getErrorMessage(error, "Login failed. Check your username and password."),
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      await cancelMatchmaking();
      if (socketRef.current && currentMatchIdRef.current) {
        await socketRef.current.leaveMatch(currentMatchIdRef.current);
      }
      if (sessionRef.current) {
        await nakamaClient.sessionLogout(sessionRef.current);
      }
    } catch (error) {
      console.warn("Logout cleanup failed:", error);
    }

    disconnectSocket();
    clearPersistedSession();
    sessionRef.current = null;
    setIsAuthenticated(false);
    accountUsernameRef.current = "";
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
    setBoard(createEmptyBoard());
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
      const creatorUsername = accountUsernameRef.current || accountUsername || normalizeUsername(authUsername);
      const rpcResponse = await nakamaClient.rpc(
        sessionRef.current,
        "create_ttt_match",
        JSON.stringify({ mode: selectedMode, creatorUsername }),
      );
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
      const response = await nakamaClient.listMatches(sessionRef.current, 50, true, undefined, 0, 2);
      const available = (response.matches || [])
        .filter((match) => match.match_id && (match.size || 0) < 2)
        .map((match) => {
          const label = parseMatchLabel(match.label);
          return {
            matchId: match.match_id,
            size: match.size || 0,
            authoritative: Boolean(match.authoritative),
            mode: label.mode,
            creatorUsername: label.creatorUsername,
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

  const playMove = async (index) => {
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

  const leaveCompletedMatch = async () => {
    if (!socketRef.current) return;

    const previousMatchId = currentMatchId;

    setMySymbol(null);
    setCurrentMatchId("");
    currentMatchIdRef.current = "";
    setBoard(createEmptyBoard());
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

  return {
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
  };
}

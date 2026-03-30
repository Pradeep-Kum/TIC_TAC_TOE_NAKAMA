import { useEffect, useRef, useState } from "react";
import { createEmptyBoard } from "../lib/gameLogic";
import { nakamaClient, nakamaConfig } from "../lib/nakamaClient";
import { parseMatchState, parseRpcPayload } from "../lib/matchPayload";

const SYNC_OPCODE = 4;
const MOVE_OPCODE = 1;
const MATCH_LABEL = "tic-tac-toe";
const MAX_ROOMS = 20;

function createInitialViewState() {
  return {
    mySymbol: null,
    currentMatchId: "",
    board: createEmptyBoard(),
    isXTurn: true,
    isSearching: false,
    gameStatus: "waiting",
    winnerSymbol: null,
    endedReason: null,
    rooms: [],
    roomsLoading: false,
    roomError: "",
  };
}

export function useNakamaGame() {
  const socketRef = useRef(null);
  const sessionRef = useRef(null);
  const connectionLockRef = useRef(false);
  const identityRef = useRef({ userId: null, sessionId: null });
  const currentMatchIdRef = useRef("");
  const lastSyncRequestAtRef = useRef(0);
  const matchmakerTicketRef = useRef(null);

  const [viewState, setViewState] = useState(createInitialViewState);

  useEffect(() => {
    currentMatchIdRef.current = viewState.currentMatchId;
  }, [viewState.currentMatchId]);

  useEffect(() => {
    let cancelled = false;

    if (connectionLockRef.current) {
      return undefined;
    }

    connectionLockRef.current = true;

    const initializeConnection = async () => {
      try {
        const session = await nakamaClient.authenticateDevice(Math.random().toString(36), true);
        sessionRef.current = session;
        identityRef.current = {
          userId: session.user_id || session.userId || null,
          sessionId: session.session_id || session.sessionId || null,
        };

        const socket = nakamaClient.createSocket(nakamaConfig.useSsl, false);

        const requestSync = async (matchId) => {
          if (!matchId || cancelled) return;

          const now = Date.now();
          if (now - lastSyncRequestAtRef.current < 350) return;

          lastSyncRequestAtRef.current = now;
          await socket.sendMatchState(matchId, SYNC_OPCODE, "{}");
        };

        const applyJoinedMatchState = async (match) => {
          if (cancelled) return;

          identityRef.current = {
            userId: match.self?.user_id || match.self?.userId || identityRef.current.userId,
            sessionId: match.self?.session_id || match.self?.sessionId || identityRef.current.sessionId,
          };

          const joinedMatchId = match.match_id || match.matchId;
          currentMatchIdRef.current = joinedMatchId;

          setViewState((current) => ({
            ...current,
            currentMatchId: joinedMatchId,
            isSearching: false,
            gameStatus: "waiting",
            winnerSymbol: null,
            endedReason: null,
            roomError: "",
            rooms: [],
          }));

          window.setTimeout(() => {
            requestSync(joinedMatchId);
          }, 500);
        };

        socket.onmatchmakermatched = async (matched) => {
          if (cancelled) return;

          const hasToken = typeof matched.token === "string" && matched.token.length > 0;
          const hasMatchId = typeof matched.match_id === "string" && matched.match_id.length > 0;
          if (!hasToken && !hasMatchId) {
            setViewState((current) => ({ ...current, isSearching: false }));
            return;
          }

          matchmakerTicketRef.current = null;
          const match = hasToken
            ? await socket.joinMatch(null, matched.token)
            : await socket.joinMatch(matched.match_id);
          await applyJoinedMatchState(match);
        };

        socket.onmatchpresence = (presenceEvent) => {
          const presenceMatchId = presenceEvent.match_id || presenceEvent.matchId;
          if (presenceMatchId && presenceMatchId === currentMatchIdRef.current) {
            requestSync(presenceMatchId);
          }
        };

        socket.onmatchdata = (message) => {
          const opCode = Number(message.op_code || message.opCode);
          if (opCode !== MOVE_OPCODE) return;

          const payload = parseMatchState(message.data);
          if (!payload) {
            requestSync(currentMatchIdRef.current);
            return;
          }

          setViewState((current) => {
            const nextState = {
              ...current,
              board: Array.isArray(payload.board) && payload.board.length === 9 ? payload.board : createEmptyBoard(),
              isXTurn: payload.turn === "X",
              gameStatus: payload.status || "playing",
              winnerSymbol: payload.winner === "X" || payload.winner === "O" ? payload.winner : null,
              endedReason: payload.endedReason || null,
            };

            if (Array.isArray(payload.players)) {
              const me = payload.players.find(
                (player) =>
                  player.sessionId === identityRef.current.sessionId ||
                  player.session_id === identityRef.current.sessionId ||
                  player.userId === identityRef.current.userId ||
                  player.user_id === identityRef.current.userId,
              );

              if (me) {
                nextState.mySymbol = me.symbol;
              }
            }

            return nextState;
          });
        };

        await socket.connect(session, true);
        if (cancelled) {
          socket.disconnect();
          return;
        }

        socketRef.current = socket;
      } catch (error) {
        console.error("NAKAMA ERROR:", error);
        if (!cancelled) {
          connectionLockRef.current = false;
        }
      }
    };

    initializeConnection();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      connectionLockRef.current = false;
    };
  }, []);

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

  const resetMatchPresentation = () => {
    setViewState((current) => ({
      ...current,
      mySymbol: null,
      board: createEmptyBoard(),
      gameStatus: "waiting",
      winnerSymbol: null,
      endedReason: null,
      roomError: "",
    }));
  };

  const findMatch = async () => {
    if (!socketRef.current) return;

    await cancelMatchmaking();
    resetMatchPresentation();

    setViewState((current) => ({
      ...current,
      isSearching: true,
      rooms: [],
    }));

    const ticket = await socketRef.current.addMatchmaker("*", 2, 2);
    matchmakerTicketRef.current = ticket?.ticket || null;
  };

  const createRoom = async () => {
    if (!socketRef.current || !sessionRef.current) return;

    await cancelMatchmaking();
    setViewState((current) => ({ ...current, roomError: "" }));

    try {
      const rpcResponse = await nakamaClient.rpc(sessionRef.current, "create_ttt_match", {});
      const payload = parseRpcPayload(rpcResponse?.payload);
      const matchId = payload.matchId || payload.match_id;

      if (!matchId) {
        setViewState((current) => ({ ...current, roomError: "Could not create room." }));
        return;
      }

      const match = await socketRef.current.joinMatch(matchId);
      identityRef.current = {
        userId: match.self?.user_id || match.self?.userId || identityRef.current.userId,
        sessionId: match.self?.session_id || match.self?.sessionId || identityRef.current.sessionId,
      };

      const joinedMatchId = match.match_id || match.matchId;
      currentMatchIdRef.current = joinedMatchId;

      setViewState((current) => ({
        ...current,
        currentMatchId: joinedMatchId,
        isSearching: false,
        rooms: [],
        roomError: "",
        gameStatus: "waiting",
        winnerSymbol: null,
        endedReason: null,
      }));

      await socketRef.current.sendMatchState(joinedMatchId, SYNC_OPCODE, "{}");
    } catch (error) {
      console.error("Failed to create room:", error);
      setViewState((current) => ({ ...current, roomError: "Room creation failed." }));
    }
  };

  const refreshRooms = async () => {
    if (!sessionRef.current) return;

    await cancelMatchmaking();

    setViewState((current) => ({
      ...current,
      isSearching: false,
      roomsLoading: true,
      roomError: "",
    }));

    try {
      const response = await nakamaClient.listMatches(sessionRef.current, MAX_ROOMS, true, MATCH_LABEL, 0, 2);
      const rooms = (response.matches || [])
        .filter((match) => match.match_id && (match.size || 0) < 2)
        .map((match) => ({
          matchId: match.match_id,
          size: match.size || 0,
          authoritative: Boolean(match.authoritative),
        }));

      setViewState((current) => ({
        ...current,
        rooms,
      }));
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
      setViewState((current) => ({
        ...current,
        roomError: "Could not fetch rooms.",
        rooms: [],
      }));
    } finally {
      setViewState((current) => ({
        ...current,
        roomsLoading: false,
      }));
    }
  };

  const joinRoom = async (matchId) => {
    if (!socketRef.current || !matchId) return;

    await cancelMatchmaking();
    setViewState((current) => ({ ...current, roomError: "" }));

    try {
      const match = await socketRef.current.joinMatch(matchId);
      identityRef.current = {
        userId: match.self?.user_id || match.self?.userId || identityRef.current.userId,
        sessionId: match.self?.session_id || match.self?.sessionId || identityRef.current.sessionId,
      };

      const joinedMatchId = match.match_id || match.matchId;
      currentMatchIdRef.current = joinedMatchId;

      setViewState((current) => ({
        ...current,
        currentMatchId: joinedMatchId,
        isSearching: false,
        rooms: [],
        roomError: "",
        gameStatus: "waiting",
        winnerSymbol: null,
        endedReason: null,
      }));

      await socketRef.current.sendMatchState(joinedMatchId, SYNC_OPCODE, "{}");
    } catch (error) {
      console.error("Failed to join room:", error);
      setViewState((current) => ({
        ...current,
        roomError: "Could not join room. It may already be full.",
      }));
      await refreshRooms();
    }
  };

  const playMove = async (index) => {
    const { board, currentMatchId, mySymbol, gameStatus, isXTurn } = viewState;

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

    await socketRef.current.sendMatchState(currentMatchId, MOVE_OPCODE, JSON.stringify({ index }));
  };

  const playAgain = async () => {
    if (!socketRef.current) return;

    const previousMatchId = currentMatchIdRef.current;
    currentMatchIdRef.current = "";

    setViewState((current) => ({
      ...current,
      mySymbol: null,
      currentMatchId: "",
      board: createEmptyBoard(),
      isXTurn: true,
      isSearching: true,
      gameStatus: "waiting",
      winnerSymbol: null,
      endedReason: null,
    }));

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
    } catch (error) {
      console.error("Failed to re-enter matchmaker:", error);
      setViewState((current) => ({ ...current, isSearching: false }));
    }
  };

  return {
    ...viewState,
    createRoom,
    findMatch,
    joinRoom,
    playAgain,
    playMove,
    refreshRooms,
  };
}

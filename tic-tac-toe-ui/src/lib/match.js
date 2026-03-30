export const modeOptions = [
  { id: "classic", label: "Classic", description: "No move timer" },
  { id: "timed", label: "Timed", description: "30 seconds per turn" },
];

export function createEmptyBoard() {
  return Array(9).fill(null);
}

export function decodeMatchPayload(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(raw));
  return "";
}

export function parseJson(value, fallback = {}) {
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

export function parseMatchLabel(label) {
  const parsed = parseJson(label, null);
  if (!parsed || typeof parsed !== "object") {
    return { name: "tic-tac-toe", mode: "classic" };
  }

  return {
    name: parsed.name || "tic-tac-toe",
    mode: parsed.mode === "timed" ? "timed" : "classic",
  };
}

export function formatPlayerName(name, ownerId) {
  if (name && !/^[0-9a-f-]{20,}$/i.test(name)) return name;
  if (ownerId) return `${ownerId.slice(0, 8)}...`;
  return "Player";
}

export function getStatusText({ gameStatus, endedReason, finalWinner, mySymbol, currentTurnSymbol, activeMode, turnSecondsRemaining }) {
  if (gameStatus === "abandoned") {
    if (endedReason === "opponent_left") {
      return finalWinner === mySymbol ? "Opponent disconnected. You win by forfeit." : "Match ended after a disconnect.";
    }

    if (endedReason === "timeout") {
      return finalWinner === mySymbol ? "Opponent ran out of time. You win." : "You ran out of time.";
    }

    return "Match ended.";
  }

  if (gameStatus === "won") {
    return `Winner: ${finalWinner}!`;
  }

  if (gameStatus === "draw") {
    return "It's a draw!";
  }

  if (gameStatus === "waiting") {
    return "Waiting for players...";
  }

  return `Turn: ${currentTurnSymbol}${activeMode === "timed" && Number.isFinite(turnSecondsRemaining) ? ` - ${turnSecondsRemaining}s` : ""}`;
}

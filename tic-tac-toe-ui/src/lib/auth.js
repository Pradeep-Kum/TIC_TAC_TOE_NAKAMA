export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export function validateUsername(username) {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    return "Use 3-20 characters: lowercase letters, numbers, or underscore.";
  }
  return "";
}

export function makeSyntheticEmail(username) {
  return `${normalizeUsername(username)}@tic-tac-toe.local`;
}

export function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.error === "string" && error.error.trim()) return error.error;
  return fallback;
}

export function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

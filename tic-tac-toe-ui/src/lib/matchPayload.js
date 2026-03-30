export function decodeMatchPayload(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return new TextDecoder().decode(raw);
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(raw));
  return "";
}

export function parseRpcPayload(payload) {
  if (!payload) return {};
  if (typeof payload !== "string") return payload;

  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

export function parseMatchState(data) {
  const json = decodeMatchPayload(data);
  if (!json || json === "{}") {
    return null;
  }

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

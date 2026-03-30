import { Client } from "@heroiclabs/nakama-js";

export const nakamaConfig = {
  serverKey: import.meta.env.VITE_NAKAMA_SERVER_KEY || "defaultkey",
  host: import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1",
  port: import.meta.env.VITE_NAKAMA_PORT || "7350",
  useSsl: import.meta.env.VITE_NAKAMA_USE_SSL === "true",
  sessionStorageKey: "ttt_nakama_session",
};

export const nakamaClient = new Client(
  nakamaConfig.serverKey,
  nakamaConfig.host,
  nakamaConfig.port,
  nakamaConfig.useSsl,
);

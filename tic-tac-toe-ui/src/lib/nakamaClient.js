import { Client } from "@heroiclabs/nakama-js";

const serverKey = import.meta.env.VITE_NAKAMA_SERVER_KEY || "defaultkey";
const host = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1";
const port = import.meta.env.VITE_NAKAMA_PORT || "7350";
const useSsl = import.meta.env.VITE_NAKAMA_USE_SSL === "true";

export const nakamaConfig = {
  useSsl,
};

export const nakamaClient = new Client(serverKey, host, port, useSsl);

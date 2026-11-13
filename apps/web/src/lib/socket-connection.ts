import { resolveSocketHandshakeAuth } from "@/lib/socket-auth.client";
import { type Socket, io } from "socket.io-client";

/**
 * Opens the Socket.IO connection. Loaded on demand by `getSocket()` in `socket.ts`, so the client
 * library is a separate chunk and not part of any page's first scripts.
 */
export function createSocketConnection(): Socket {
  const url = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3002";
  return io(url, {
    // WebSocket-only: DO App Platform has no sticky sessions across ws replicas.
    transports: ["websocket"],
    // Authentication is the one-time BFF ticket below; never send browser cookies to WS.
    withCredentials: false,
    auth: (cb) => {
      void resolveSocketHandshakeAuth().then(cb);
    },
  });
}

import { resolveSocketHandshakeAuth } from "@/lib/socket-auth.client";
import { type Socket, io } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  const url = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3002";
  if (!socket) {
    socket = io(url, {
      // WebSocket-only: DO App Platform has no sticky sessions across ws replicas.
      transports: ["websocket"],
      withCredentials: true,
      auth: (cb) => {
        void resolveSocketHandshakeAuth().then(cb);
      },
    });
  }
  return socket;
}

import { fetchAuthJwtForSocket } from "@/lib/socket-auth";
import { type Socket, io } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  const url = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3002";
  if (!socket) {
    socket = io(url, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: (cb) => {
        void fetchAuthJwtForSocket().then((token) => cb(token ? { token } : {}));
      },
    });
  }
  return socket;
}

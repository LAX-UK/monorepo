import { fetchAuthJwtForSocket } from "@/lib/socket-auth";
import { type Socket, io } from "socket.io-client";

let socket: Socket | null = null;

async function applySocketAuth(target: Socket): Promise<void> {
  const token = await fetchAuthJwtForSocket();
  target.auth = token ? { token } : {};
}

function connectSocketWithAuth(target: Socket): void {
  void applySocketAuth(target).finally(() => {
    if (!target.connected) {
      target.connect();
    }
  });
}

export function getSocket(): Socket {
  const url = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3002";
  if (!socket) {
    const instance = io(url, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: false,
    });
    socket = instance;
    instance.io.on("reconnect_attempt", () => {
      void applySocketAuth(instance);
    });
    connectSocketWithAuth(instance);
  }
  return socket;
}

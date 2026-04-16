import { createServer } from "node:http";
import { Server } from "socket.io";
import { bridgeRedisToSockets } from "./services/redis-bridge.js";
import { createWsContainer } from "./container.js";
import { loadWsEnv } from "./env.js";
import { registerSocketHandlers } from "./handlers/register-handlers.js";

const env = loadWsEnv();
const container = createWsContainer(env);

const httpServer = createServer((req, res) => {
  const url = req.url ?? "";
  if (req.method === "GET" && (url === "/health" || url.startsWith("/health?"))) {
    void container.redis
      .ping()
      .then(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ service: "auction-ws", status: "ok", redis: "ok" }));
      })
      .catch(() => {
        res.writeHead(503, { "Content-Type": "text/plain" });
        res.end("Redis unavailable");
      });
    return;
  }
  if (url.startsWith("/socket.io/")) {
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

bridgeRedisToSockets(io, container.redisSub);

io.on("connection", (socket) => {
  registerSocketHandlers(socket, { io, env });
});

httpServer.listen(env.PORT, () => {
  console.log(`WebSocket gateway listening on http://localhost:${env.PORT}`);
});

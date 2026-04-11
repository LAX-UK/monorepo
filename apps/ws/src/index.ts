import { createServer } from "node:http";
import { Server } from "socket.io";
import { bridgeRedisToSockets } from "./services/redis-bridge.js";
import { createWsContainer } from "./container.js";
import { loadWsEnv } from "./env.js";
import { registerSocketHandlers } from "./handlers/register-handlers.js";

const env = loadWsEnv();
const container = createWsContainer(env);

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "auction-ws", status: "ok" }));
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

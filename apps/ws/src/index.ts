import { createServer } from "node:http";
import * as Sentry from "@sentry/node";
import pino from "pino";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { Server } from "socket.io";
import { createWsContainer } from "./container.js";
import { loadWsEnv } from "./env.js";
import { registerSocketHandlers } from "./handlers/register-handlers.js";
import { bridgeRedisToSockets } from "./services/redis-bridge.js";

const env = loadWsEnv();
if (env.SENTRY_DSN_WS) {
  Sentry.init({
    dsn: env.SENTRY_DSN_WS,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.05 : 1,
  });
}
const log = pino({
  level: env.LOG_LEVEL,
  base: { service: "auction-ws", env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});
const container = createWsContainer(env);

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "auction_ws_" });
const socketConnections = new Counter({
  name: "auction_ws_socket_connections_total",
  help: "Socket.IO connections accepted",
  registers: [metricsRegistry],
});
const httpDuration = new Histogram({
  name: "auction_ws_http_request_duration_seconds",
  help: "WS sidecar HTTP request duration in seconds",
  labelNames: ["route", "status"] as const,
  registers: [metricsRegistry],
});

const httpServer = createServer((req, res) => {
  const url = req.url ?? "";
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    const route = url.startsWith("/health/ready")
      ? "/health/ready"
      : url.startsWith("/health/live")
        ? "/health/live"
        : url.startsWith("/metrics")
          ? "/metrics"
          : "other";
    end({ route, status: String(res.statusCode) });
  });
  if (req.method === "GET" && (url === "/health/live" || url.startsWith("/health/live?"))) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ service: "auction-ws", status: "ok" }));
    return;
  }
  if (
    req.method === "GET" &&
    (url === "/health/ready" || url.startsWith("/health/ready?") || url === "/health")
  ) {
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
  if (req.method === "GET" && (url === "/metrics" || url.startsWith("/metrics?"))) {
    void metricsRegistry.metrics().then((body) => {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
      res.end(body);
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
  socketConnections.inc();
  registerSocketHandlers(socket, { io, env });
});

httpServer.listen(env.PORT, () => {
  log.info({ port: env.PORT }, "WebSocket gateway listening");
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "draining websocket gateway");
  const timeout = setTimeout(() => {
    log.error("graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  timeout.unref();
  io.close(() => {
    httpServer.close((err) => {
      if (err) {
        log.error({ err }, "failed to close HTTP server");
        process.exit(1);
      }
      void Promise.allSettled([container.redis.quit(), container.redisSub.quit()]).finally(() => {
        clearTimeout(timeout);
        process.exit(0);
      });
    });
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

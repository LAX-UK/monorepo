import { createServer } from "node:http";
import { initNodeSentry } from "@auction/observability";
import pino from "pino";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { Server } from "socket.io";
import { createWsContainer } from "./container.js";
import { loadWsEnv } from "./env.js";
import { consumeSocketTicket, registerSocketHandlers } from "./handlers/register-handlers.js";
import { verifyBidApiPrivilegeToken, verifyWsResourceToken } from "./resource-authenticator.js";
import { bindSocketIdentity, bridgeRedisToSockets } from "./services/redis-bridge.js";

const env = loadWsEnv();
if (env.SENTRY_DSN_WS) {
  initNodeSentry({
    dsn: env.SENTRY_DSN_WS,
    nodeEnv: env.NODE_ENV,
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
const latencyProbeAckSeconds = new Histogram({
  name: "auction_ws_latency_probe_ack_seconds",
  help: "Latency probe handler duration until ack sent (seconds)",
  buckets: [0.000_01, 0.000_05, 0.000_1, 0.000_5, 0.001, 0.005, 0.01, 0.05, 0.1],
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
    credentials: false,
  },
});

bridgeRedisToSockets(io, container.redisSub);

io.use(async (socket, next) => {
  const result = await consumeSocketTicket(socket, container.redis);
  if (result === "invalid") {
    next(new Error("invalid_ws_ticket"));
    return;
  }
  if (result === "anonymous") {
    const authToken =
      typeof socket.handshake.auth?.token === "string"
        ? socket.handshake.auth.token
        : typeof socket.handshake.headers.authorization === "string" &&
            socket.handshake.headers.authorization.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.slice("Bearer ".length)
          : undefined;
    if (authToken) {
      const internalIssuer = env.OIDC_INTERNAL_BASE_URL ?? env.OIDC_ISSUER_URL;
      const jwksUrl = `${internalIssuer.replace(/\/+$/, "")}/.well-known/jwks.json`;
      const principal = await verifyWsResourceToken({
        token: authToken,
        issuer: env.OIDC_ISSUER_URL,
        jwksUrl,
      });
      if (!principal) {
        next(new Error("invalid_ws_resource_token"));
        return;
      }
      socket.data.ticketUser = {
        id: principal.subject,
        ...(principal.sid ? { sid: principal.sid } : {}),
        role: principal.role ?? "client",
        ...(principal.staffRole ? { staff_role: principal.staffRole } : {}),
      };
      socket.data.authSubject = principal.subject;
      socket.data.authSid = principal.sid;
      const apiToken =
        typeof socket.handshake.auth?.apiToken === "string"
          ? socket.handshake.auth.apiToken
          : undefined;
      if (apiToken) {
        const apiPrincipal = await verifyBidApiPrivilegeToken({
          token: apiToken,
          issuer: env.OIDC_ISSUER_URL,
          jwksUrl,
        });
        if (
          !apiPrincipal ||
          apiPrincipal.subject !== principal.subject ||
          (principal.sid && apiPrincipal.sid && apiPrincipal.sid !== principal.sid)
        ) {
          next(new Error("invalid_ws_privilege_token"));
          return;
        }
        socket.data.privilegeToken = apiToken;
      }
    }
  }
  if (typeof socket.data.authSubject === "string") {
    await bindSocketIdentity(socket, {
      subject: socket.data.authSubject,
      ...(typeof socket.data.authSid === "string" ? { sid: socket.data.authSid } : {}),
    });
  }
  next();
});

io.on("connection", (socket) => {
  socketConnections.inc();
  registerSocketHandlers(socket, {
    io,
    env,
    ticketStore: container.redis,
    recordLatencyProbeAckSeconds: (seconds) => {
      latencyProbeAckSeconds.observe(seconds);
    },
  });
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

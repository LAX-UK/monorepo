import { createMiddleware } from "hono/factory";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry, prefix: "auction_api_" });

const httpDuration = new Histogram({
  name: "auction_api_http_request_duration_seconds",
  help: "API HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

const httpRequests = new Counter({
  name: "auction_api_http_requests_total",
  help: "API HTTP requests total",
  labelNames: ["method", "route", "status"] as const,
  registers: [metricsRegistry],
});

function routeLabel(path: string): string {
  if (path.startsWith("/api/auth/")) return "/api/auth/*";
  if (path.startsWith("/webhooks/")) return "/webhooks/*";
  if (path.startsWith("/.well-known/")) return "/.well-known/*";
  const [first] = path.split("/").filter(Boolean);
  return first ? `/${first}/*` : "/";
}

export function createMetricsMiddleware() {
  return createMiddleware(async (c, next) => {
    const end = httpDuration.startTimer();
    await next();
    const labels = {
      method: c.req.method,
      route: routeLabel(c.req.path),
      status: String(c.res.status),
    };
    end(labels);
    httpRequests.inc(labels);
  });
}

export async function renderMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

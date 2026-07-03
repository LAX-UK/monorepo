import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { Registry, collectDefaultMetrics } from "prom-client";
import type { WorkerContainer } from "./container/create-worker-container.js";

export type HealthServerHandle = {
  app: Hono;
  server: ServerType;
};

export function createMetricsRegistry(container: WorkerContainer): Registry {
  const metrics = new Registry();
  collectDefaultMetrics({ register: metrics, prefix: "auction_worker_" });
  metrics.registerMetric(container.marketingEventsOutcomeTotal);
  metrics.registerMetric(container.marketingEventsCapiBatchSize);
  return metrics;
}

export function startHealthServer(container: WorkerContainer): HealthServerHandle {
  const { env, db, redis, log, bootedAt, heartbeatKeys } = container;
  const metrics = createMetricsRegistry(container);

  const app = new Hono();

  app.get("/health/live", (c) => c.json({ service: "auction-worker", status: "ok" }));
  app.get("/health/ready", async (c) => {
    try {
      await db.execute(sql`select 1`);
      await redis.ping();
      if (Date.now() - bootedAt > 60_000) {
        const now = Date.now();
        for (const key of heartbeatKeys) {
          const raw = await redis.get(key);
          if (!raw || now - Number(raw) > 5 * 60_000) {
            return c.json(
              { service: "auction-worker", status: "degraded", staleHeartbeat: key },
              503,
            );
          }
        }
      }
      return c.json({ service: "auction-worker", status: "ok", redis: "ok", database: "ok" });
    } catch (err) {
      log.error({ err }, "worker readiness failed");
      return c.json({ service: "auction-worker", status: "degraded" }, 503);
    }
  });
  app.get("/metrics", async (c) =>
    c.text(await metrics.metrics(), 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    }),
  );

  const server = serve({ fetch: app.fetch, hostname: "0.0.0.0", port: env.PORT }, (info) => {
    log.info({ port: info.port }, "worker service listening");
  });

  return { app, server };
}

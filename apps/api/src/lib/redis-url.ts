import type { ConnectionOptions } from "bullmq";

/** Parse redis:// or rediss:// URL for BullMQ / ioredis-style clients. */
export function connectionOptionsFromRedisUrl(redisUrl: string): ConnectionOptions {
  const u = new URL(redisUrl);
  const port = u.port ? Number.parseInt(u.port, 10) : 6379;
  const dbPath = u.pathname.replace(/^\//, "");
  const db = dbPath ? Number.parseInt(dbPath, 10) : undefined;
  return {
    host: u.hostname,
    port: Number.isFinite(port) ? port : 6379,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    ...(Number.isFinite(db) ? { db: db as number } : {}),
    ...(u.protocol === "rediss:" ? { tls: {} as Record<string, never> } : {}),
  };
}

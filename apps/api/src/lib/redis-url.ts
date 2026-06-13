import type { RedisOptions } from "ioredis";

/** Parse redis:// or rediss:// URL for BullMQ / ioredis-style clients. */
export function connectionOptionsFromRedisUrl(redisUrl: string): RedisOptions {
  const u = new URL(redisUrl);
  const port = u.port ? Number.parseInt(u.port, 10) : 6379;
  const dbPath = u.pathname.replace(/^\//, "");
  const db = dbPath ? Number.parseInt(dbPath, 10) : undefined;
  const opts: RedisOptions = {
    host: u.hostname,
    port: Number.isFinite(port) ? port : 6379,
  };
  if (u.password) opts.password = decodeURIComponent(u.password);
  if (u.username) opts.username = decodeURIComponent(u.username);
  if (Number.isFinite(db)) opts.db = db as number;
  if (u.protocol === "rediss:") opts.tls = {};
  return opts;
}

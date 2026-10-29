import type { RedisOptions } from "ioredis";

/**
 * Connection options from a `redis://` or `rediss://` URL, read with the WHATWG URL parser.
 * Handing ioredis the URL string makes it call Node's deprecated `url.parse()`, which warns on
 * every server start (DEP0169).
 */
export function redisOptionsFromUrl(raw: string): RedisOptions {
  const url = new URL(raw);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error(`Unsupported Redis URL protocol: ${url.protocol}`);
  }
  const db = url.pathname.replace(/^\//, "");
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(db ? { db: Number(db) } : {}),
    ...(url.protocol === "rediss:" ? { tls: { servername: url.hostname } } : {}),
  };
}

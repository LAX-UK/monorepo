import net from "node:net";

function parseRedisEndpoint(redisUrl) {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: Number(parsed.port || 6379),
  };
}

export function isRedisReachable(redisUrl, timeoutMs = 1_000) {
  return new Promise((resolve) => {
    try {
      const { host, port } = parseRedisEndpoint(redisUrl);
      const socket = net.connect({ host, port, timeout: timeoutMs });
      const finish = (ok) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(ok);
      };
      socket.on("connect", () => finish(true));
      socket.on("error", () => finish(false));
      socket.on("timeout", () => finish(false));
    } catch {
      resolve(false);
    }
  });
}

/** Returns env for vitest smoke gates; drops REDIS_URL when broker is down outside CI. */
export async function smokeGateEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  const redisUrl = env.REDIS_URL?.trim();
  if (!redisUrl) return env;

  const reachable = await isRedisReachable(redisUrl);
  if (reachable) return env;

  const message = `Redis unreachable at ${redisUrl}`;
  if (env.CI === "true" || env.CI === "1") {
    console.error(`${message}; required in CI`);
    process.exit(1);
  }

  console.warn(`${message}; skipping Redis-backed integration smoke tests`);
  env.REDIS_URL = undefined;
  return env;
}

import { Redis } from "ioredis";
import type { WsEnv } from "./env.js";

export type WsContainer = {
  env: WsEnv;
  redis: Redis;
  /** Dedicated connection for pub/sub (do not issue commands other than subscribe). */
  redisSub: Redis;
};

function attachRedisErrorLogger(client: Redis, label: string): Redis {
  client.on("error", (err) => {
    console.error(`[ws-redis:${label}]`, err instanceof Error ? err.message : err);
  });
  return client;
}

export function createWsContainer(env: WsEnv): WsContainer {
  const redis = attachRedisErrorLogger(new Redis(env.REDIS_URL), "command");
  const redisSub = attachRedisErrorLogger(new Redis(env.REDIS_URL), "subscribe");
  return { env, redis, redisSub };
}

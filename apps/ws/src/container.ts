import { Redis } from "ioredis";
import { loadWsEnv, type WsEnv } from "./env.js";

export type WsContainer = {
  env: WsEnv;
  redis: Redis;
  /** Dedicated connection for pub/sub (do not issue commands other than subscribe). */
  redisSub: Redis;
};

export function createWsContainer(env: WsEnv): WsContainer {
  const redis = new Redis(env.REDIS_URL);
  const redisSub = new Redis(env.REDIS_URL);
  return { env, redis, redisSub };
}

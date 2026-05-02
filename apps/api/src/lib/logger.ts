import pino from "pino";
import type { Env } from "../env.js";
import { getRequestContext } from "./request-context.js";

export type LogFields = Record<string, unknown>;
export type AppLogger = pino.Logger;

const loggerByLevel = new Map<string, AppLogger>();

export function createBaseLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">): AppLogger {
  const key = `${env.LOG_LEVEL}:${env.NODE_ENV}`;
  const cached = loggerByLevel.get(key);
  if (cached) return cached;

  const logger = pino({
    level: env.LOG_LEVEL,
    base: {
      service: "auction-api",
      env: env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  loggerByLevel.set(key, logger);
  return logger;
}

export function createAppLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">): AppLogger {
  const requestId = getRequestContext()?.requestId;
  const logger = createBaseLogger(env);
  return requestId ? logger.child({ request_id: requestId }) : logger;
}

import pino from "pino";
import type { Env } from "../env.js";
import { getRequestContext } from "./request-context.js";

export type LogFields = Record<string, unknown>;
export type AppLogger = pino.Logger;

/** Shared redaction paths for `createBaseLogger` and tests. */
export const PINO_REDACT: { paths: string[]; censor: string } = {
  paths: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.body.password",
    "req.body.email",
    "stripe_secret_key",
    "stripeSecretKey",
    "*.stripe_secret_key",
    "*.stripeSecretKey",
    "*.client_secret",
    "*.clientSecret",
    "*.access_token",
    "*.refresh_token",
    "*.api_key",
    "*.apiKey",
  ],
  censor: "[REDACTED]",
};

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
    redact: PINO_REDACT,
  });
  loggerByLevel.set(key, logger);
  return logger;
}

export function createAppLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">): AppLogger {
  const requestId = getRequestContext()?.requestId;
  const logger = createBaseLogger(env);
  return requestId ? logger.child({ request_id: requestId }) : logger;
}

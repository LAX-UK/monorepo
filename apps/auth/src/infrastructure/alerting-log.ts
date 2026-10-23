import { Sentry } from "@auction/observability";

/** Log lines an operator must hear about. Their wording is the contract the alert rules match on. */
export const ALERTING_LOG_MESSAGES = [
  "auth_security_effect_abandoned",
  "rate_limit_redis_unavailable_using_in_process_fallback",
] as const;

type Context = Record<string, unknown>;
type LevelLog = (context: Context, message: string) => void;

/**
 * Wraps a logger so the alerting messages also reach Sentry as an event. Raw log lines stay in
 * the platform's component logs, where nothing can alert on them, so the two lines that mean
 * "a revocation was lost" and "rate limiting lost its shared store" are mirrored as issues.
 */
export function withAlertingLog<T extends { warn: LevelLog; error: LevelLog }>(
  log: T,
  capture: (message: string, context: Context, level: "warning" | "error") => void = (
    message,
    context,
    level,
  ) => {
    Sentry.captureMessage(message, { level, extra: context });
  },
): T {
  const alerting = new Set<string>(ALERTING_LOG_MESSAGES);
  const forward =
    (level: "warn" | "error"): LevelLog =>
    (context, message) => {
      log[level](context, message);
      if (alerting.has(message)) capture(message, context, level === "warn" ? "warning" : "error");
    };
  return Object.assign(Object.create(log) as T, { warn: forward("warn"), error: forward("error") });
}

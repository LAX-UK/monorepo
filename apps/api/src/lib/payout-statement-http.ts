import type { Context } from "hono";
import type { PayoutStatementOutcome } from "../services/interfaces/finance-routes/finance-payout-statement.js";
import { type AppLogger, createAppLogger } from "./logger.js";

const RETRY_AFTER_SEC = 5;

type LogEnv = Parameters<typeof createAppLogger>[0];

function defaultLogger(): AppLogger {
  return createAppLogger({
    LOG_LEVEL: (process.env.LOG_LEVEL ?? "info") as LogEnv["LOG_LEVEL"],
    NODE_ENV: (process.env.NODE_ENV ?? "production") as LogEnv["NODE_ENV"],
  });
}

/**
 * The HTTP answer for a payout statement. A failed generation says so, but the stored error text
 * is internal (it can name storage, templates or data): it goes to the logs, never to the client.
 */
export function mapPayoutStatementOutcomeToHttp(
  c: Context,
  outcome: PayoutStatementOutcome,
  notFoundError = "payout_not_found",
  log: () => AppLogger = defaultLogger,
) {
  switch (outcome.kind) {
    case "not_found":
      return c.json({ error: notFoundError }, 404);
    case "forbidden":
      return c.json({ error: outcome.error }, 403);
    case "generation_failed":
      log().warn(
        { detail: outcome.detail, path: c.req.path },
        "payout_statement_generation_failed_served",
      );
      return c.json({ error: "statement_generation_failed" }, 422);
    case "redirect":
      return c.redirect(outcome.url, 302);
    case "pending":
      return c.json({ error: "statement_pending" }, 503, {
        "Retry-After": String(RETRY_AFTER_SEC),
      });
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

import type { Context } from "hono";
import type { PayoutStatementOutcome } from "../services/interfaces/finance-routes/finance-payout-statement.js";

const RETRY_AFTER_SEC = 5;

export function mapPayoutStatementOutcomeToHttp(
  c: Context,
  outcome: PayoutStatementOutcome,
  notFoundError = "payout_not_found",
) {
  switch (outcome.kind) {
    case "not_found":
      return c.json({ error: notFoundError }, 404);
    case "forbidden":
      return c.json({ error: outcome.error }, 403);
    case "generation_failed":
      return c.json({ error: "statement_generation_failed", detail: outcome.detail }, 422);
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

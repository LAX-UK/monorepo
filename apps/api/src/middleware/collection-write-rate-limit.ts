import { createMiddleware } from "hono/factory";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import type { LegalEntityContext } from "./require-legal-entity-context.js";

const WINDOW_SEC = 3600;

/**
 * Booking, changing and cancelling together, per account, per hour. A person rebooking a few
 * times is nowhere near it; a script filling the diary is stopped well before it matters.
 */
export const COLLECTION_WRITES_PER_HOUR = 20;

/**
 * Limits how often one account may book, change or cancel collection visits. The budget belongs
 * to the account (not the person or the address), so members of one organisation share it and a
 * second address does not reset it. Mount after the account context. If the counter is
 * unreachable the request goes ahead: booking stays up, and the server-side rules still apply.
 */
export function createCollectionWriteRateLimit(
  store: IRateLimitStore,
  maxPerHour: number = COLLECTION_WRITES_PER_HOUR,
) {
  return createMiddleware<{ Variables: { legalEntityContext?: LegalEntityContext } }>(
    async (c, next) => {
      const account = c.get("legalEntityContext")?.legalEntityId;
      if (!account) {
        await next();
        return;
      }
      let result: Awaited<ReturnType<IRateLimitStore["increment"]>>;
      try {
        result = await store.increment(`rl:collection-writes:${account}`, maxPerHour, WINDOW_SEC);
      } catch (err) {
        console.warn("[rate-limit] counter unavailable; allowing collection write", {
          err: err instanceof Error ? err.message : String(err),
        });
        await next();
        return;
      }
      if (!result.allowed) {
        if (result.retryAfterSec !== undefined) {
          c.header("Retry-After", String(result.retryAfterSec));
        }
        return c.json(
          {
            error: "rate_limit_exceeded",
            message:
              "You've made a lot of changes to collections in the last hour. Please try again a little later, or contact us.",
          },
          429,
        );
      }
      await next();
    },
  );
}

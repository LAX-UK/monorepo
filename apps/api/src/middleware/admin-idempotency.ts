import { createHash } from "node:crypto";
import { createMiddleware } from "hono/factory";
import {
  IDEMPOTENCY_PENDING_VALUE,
  type IIdempotencyStore,
} from "../services/interfaces/idempotency-store.js";

/** Staff money actions are replayed for a day, which covers a retry after a closed tab. */
const REPLAY_TTL_SECONDS = 24 * 60 * 60;
/** An in-flight claim expires on its own if the process dies before releasing it. */
const IN_FLIGHT_TTL_SECONDS = 120;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const IDEMPOTENCY_REPLAYED_HEADER = "Idempotent-Replayed";

type StoredResponse = { fingerprint: string; status: number; body: string };

/**
 * Makes a staff mutation safe to retry. The caller sends an `Idempotency-Key`; the first request
 * with that key runs, and a repeat of the same request gets the first answer back, marked
 * `Idempotent-Replayed: true`, without running again. Only successful answers are kept, so a
 * request that failed can be retried with the same key. The key is scoped to the route and the
 * signed-in person, and reusing it for a different request body is refused.
 */
export function createAdminIdempotency(store: IIdempotencyStore, scope: string) {
  return createMiddleware<{ Variables: { userId?: string } }>(async (c, next) => {
    const key = c.req.header(IDEMPOTENCY_KEY_HEADER)?.trim();
    if (!key || !KEY_PATTERN.test(key)) {
      return c.json(
        {
          error: "An Idempotency-Key header of 8 to 128 letters, digits, - or _ is required",
          code: "idempotency_key_required",
        },
        400,
      );
    }
    const userId = c.get("userId") ?? "anonymous";
    const storeKey = `admin-idem:${scope}:${userId}:${key}`;
    const body = await c.req.raw.clone().text();
    const fingerprint = createHash("sha256")
      .update(`${c.req.method}\n${c.req.path}\n${body}`)
      .digest("hex");

    let claimed = await store.tryClaim(storeKey, IN_FLIGHT_TTL_SECONDS);
    if (!claimed) {
      const existing = await store.get(storeKey);
      if (existing === IDEMPOTENCY_PENDING_VALUE) {
        return c.json(
          { error: "This request is already being processed", code: "idempotency_in_progress" },
          409,
        );
      }
      if (existing) {
        const stored = parseStored(existing);
        if (stored) {
          if (stored.fingerprint !== fingerprint) {
            return c.json(
              {
                error: "This Idempotency-Key was already used for a different request",
                code: "idempotency_key_reuse",
              },
              422,
            );
          }
          return new Response(stored.body, {
            status: stored.status,
            headers: {
              "Content-Type": "application/json",
              [IDEMPOTENCY_REPLAYED_HEADER]: "true",
            },
          });
        }
      }
      // The entry vanished or was unreadable between the claim and the read: try once more.
      claimed = await store.tryClaim(storeKey, IN_FLIGHT_TTL_SECONDS);
      if (!claimed) {
        return c.json(
          { error: "This request is already being processed", code: "idempotency_in_progress" },
          409,
        );
      }
    }

    try {
      await next();
    } catch (error) {
      await store.delete(storeKey);
      throw error;
    }
    const status = c.res.status;
    if (status >= 200 && status < 300) {
      const payload: StoredResponse = {
        fingerprint,
        status,
        body: await c.res.clone().text(),
      };
      await store.setWithExpiry(storeKey, JSON.stringify(payload), REPLAY_TTL_SECONDS);
    } else {
      await store.delete(storeKey);
    }
  });
}

function parseStored(raw: string): StoredResponse | null {
  try {
    const value = JSON.parse(raw) as Partial<StoredResponse>;
    if (
      typeof value.fingerprint === "string" &&
      typeof value.status === "number" &&
      typeof value.body === "string"
    ) {
      return { fingerprint: value.fingerprint, status: value.status, body: value.body };
    }
  } catch {
    // fall through
  }
  return null;
}

import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { Container } from "../container.js";
import type { Env } from "../env.js";
import { createBaseLogger } from "../lib/logger.js";

/** Redis key for `SET … NX` — only one bulk settlement across API instances. */
export const BULK_PAYOUT_SETTLEMENT_LOCK_KEY = "payout:settlement:lock";
const BULK_PAYOUT_SETTLEMENT_LOCK_TTL_SEC = 30 * 60;

function timingSafeSecretMatches(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuf = Buffer.from(actual);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

/** Machine-to-machine triggers (worker / platform cron). Guarded by
 * `CRON_INTERNAL_SECRET` + `X-Cron-Secret` header — not for browser clients.
 */
export function createInternalCronRoutes(container: Container, env: Env) {
  const r = new Hono();

  r.post("/bulk-payout-settlement", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const lockOk = await container.redis.set(
      BULK_PAYOUT_SETTLEMENT_LOCK_KEY,
      "1",
      "EX",
      BULK_PAYOUT_SETTLEMENT_LOCK_TTL_SEC,
      "NX",
    );
    if (lockOk !== "OK") {
      return c.json({ reason: "settlement_already_running" }, 409);
    }

    try {
      const log = createBaseLogger(env).child({ component: "bulk_payout_settlement" });
      const bulk = await container.payoutService.runBulkSettlementWithTransfers(null, {
        initiateTransfer: (payoutId, opts) =>
          container.stripeConnectService.initiateTransfer(payoutId, opts),
        onEntityOutcome: (row) => {
          log.info(
            {
              legalEntityId: row.legalEntityId,
              payoutId: row.payoutId,
              outcome: row.outcome,
              resume: row.resume ?? false,
              reason: row.reason,
              stripeErrorCode: row.stripeErrorCode,
            },
            "bulk_payout_settlement_entity",
          );
        },
      });

      return c.json({
        data: {
          settlement: bulk.settlement,
          transfers: bulk.transfers,
        },
      });
    } finally {
      await container.redis.del(BULK_PAYOUT_SETTLEMENT_LOCK_KEY);
    }
  });

  /** worker → API Xero supplier bill for a paid payout (idempotent). */
  r.post("/xero-payout-bill", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    let body: { payoutId?: unknown };
    try {
      body = (await c.req.json()) as { payoutId?: unknown };
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const payoutId = typeof body.payoutId === "string" ? body.payoutId : "";
    if (!payoutId) {
      return c.json({ error: "payout_id_required" }, 400);
    }
    if (!container.xeroPayoutBillWriter) {
      return c.json({ error: "xero_payout_bill_disabled" }, 503);
    }
    const data = await container.xeroPayoutBillWriter.syncPaidPayout(payoutId);
    return c.json({ data });
  });

  return r;
}

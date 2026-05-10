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
      if (env.DISABLE_PAYOUT_SETTLEMENT) {
        return c.json(
          { error: "payout_settlement_disabled", code: "payout_settlement_disabled" },
          503,
        );
      }
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

  /** Expire stale `pending` buyer payments (winner never paid). */
  r.post("/expire-stale-payments", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const n = await container.paymentService.expireStalePendingPayments(
      env.PAYMENT_PENDING_EXPIRE_DAYS,
    );
    return c.json({ data: { expired: n } });
  });

  /** Replay Xero invoice sync for webhook rows that previously failed (idempotent). */
  r.post("/retry-xero-webhook-failures", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const rows = await container.xeroWebhookEventRepository.listRecentFailures(25);
    let recovered = 0;
    for (const row of rows) {
      const sync = await container.accountingProvider.syncInvoiceFromProvider(
        row.tenantId,
        row.resourceId,
      );
      if (sync.ok) {
        await container.xeroWebhookEventRepository.markProcessed(row.eventKey);
        recovered += 1;
      } else {
        await container.xeroWebhookEventRepository.markFailed(
          row.eventKey,
          sync.error ?? "retry_failed",
        );
      }
    }
    return c.json({ data: { attempted: rows.length, recovered } });
  });

  return r;
}

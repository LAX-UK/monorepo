import { timingSafeEqual } from "node:crypto";
import { verification } from "@auction/db/schema";
import { probeSentryConnectivity } from "@auction/observability";
import { inArray, lt } from "drizzle-orm";
import { Hono } from "hono";
import type { Container } from "../container.js";
import type { Env } from "../env.js";
import { createBaseLogger } from "../lib/logger.js";
import { proactiveRefreshXeroTokens } from "../services/accounting/xero-auth-runtime.js";

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

  /** Proactively refresh Xero OAuth tokens (keeps refresh token alive on idle stacks). */
  r.post("/refresh-xero-tokens", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (!env.XERO_CLIENT_ID || !env.XERO_CLIENT_SECRET || !env.XERO_REDIRECT_URI) {
      return c.json({ error: "xero_not_configured" }, 503);
    }
    const { DrizzleXeroConnectionRepository } = await import(
      "../repositories/drizzle-xero-connection.repository.js"
    );
    const connections = new DrizzleXeroConnectionRepository(container.db);
    const result = await proactiveRefreshXeroTokens({
      env,
      connections,
      redis: container.redis,
    });
    if (!result.ok) {
      return c.json({ data: result }, result.reason === "not_connected" ? 200 : 502);
    }
    return c.json({ data: result });
  });

  /** Replay admin refunds where Stripe succeeded but DB persist failed. */
  r.post("/retry-refund-reconciles", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const data = await container.paymentRefundReconcileService.replayPending(25);
    return c.json({ data });
  });

  /** Retry Xero bank payment recording for captured Stripe payments missing xeroPaymentId. */
  r.post("/retry-xero-stripe-capture-sync", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (!container.xeroPaymentRecorder) {
      return c.json({ error: "xero_payment_recorder_disabled" }, 503);
    }
    const { listPendingStripeCaptureSync } = await import(
      "../repositories/drizzle-payment-refund-reconcile.repository.js"
    );
    const rows = await listPendingStripeCaptureSync(container.db, 25);
    let synced = 0;
    for (const row of rows) {
      const result = await container.xeroPaymentRecorder.recordStripeCapture(
        row.paymentId,
        row.amount,
      );
      if (result.ok) synced += 1;
    }
    return c.json({ data: { attempted: rows.length, synced } });
  });

  /**
   * Purge expired Better Auth `verification` rows (email links, OTP artifacts).
   *
   * Deletes in batches of 500 via a subquery to avoid long table locks on large tables.
   * The cron should be invoked frequently enough that a single batch clears the backlog.
   */
  r.post("/purge-expired-verifications", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const now = new Date();
    const batchSize = 500;
    const deleted = await container.authDb
      .delete(verification)
      .where(
        inArray(
          verification.id,
          container.authDb
            .select({ id: verification.id })
            .from(verification)
            .where(lt(verification.expiresAt, now))
            .limit(batchSize),
        ),
      )
      .returning({ id: verification.id });
    return c.json({ data: { deleted: deleted.length, capped: deleted.length === batchSize } });
  });

  /** Nudge sellers whose draft submissions have been untouched for N days. */
  r.post("/stale-submission-draft-reminders", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const data = await container.itemSubmissionService.sendStaleDraftReminders({
      staleDays: env.SUBMISSION_DRAFT_REMINDER_DAYS,
    });
    return c.json({ data });
  });

  /** Verify Sentry connectivity from worker/cron callers (guarded by X-Cron-Secret). */
  r.post("/sentry-test", async (c) => {
    if (!env.CRON_INTERNAL_SECRET) {
      return c.json({ error: "cron_not_configured" }, 503);
    }
    const secret = c.req.header("x-cron-secret");
    if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (!env.SENTRY_DSN_API) {
      return c.json({ error: "sentry_not_configured" }, 503);
    }
    const eventId = await probeSentryConnectivity();
    return c.json({ ok: true, eventId });
  });

  return r;
}

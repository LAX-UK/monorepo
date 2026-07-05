import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { zValidator } from "../lib/z-validator.js";

/** Redis key for `SET … NX` — only one bulk settlement across API instances. */
export const BULK_PAYOUT_SETTLEMENT_LOCK_KEY = "payout:settlement:lock";
const BULK_PAYOUT_SETTLEMENT_LOCK_TTL_SEC = 30 * 60;

/** Redis key for lot/sale lifecycle sweep (worker cron → single API handler). */
export const LOT_LIFECYCLE_TICK_LOCK_KEY = "lot:lifecycle:tick:lock";
const LOT_LIFECYCLE_TICK_LOCK_TTL_SEC = 15;

function timingSafeSecretMatches(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBuf = Buffer.from(actual);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

function requireCronAuth(c: { req: { header: (name: string) => string | undefined } }, env: Env) {
  if (!env.CRON_INTERNAL_SECRET) {
    return { ok: false as const, status: 503 as const, body: { error: "cron_not_configured" } };
  }
  const secret = c.req.header("x-cron-secret");
  if (!timingSafeSecretMatches(secret, env.CRON_INTERNAL_SECRET)) {
    return { ok: false as const, status: 401 as const, body: { error: "unauthorized" } };
  }
  return { ok: true as const };
}

/** Machine-to-machine triggers (worker / platform cron). Guarded by
 * `CRON_INTERNAL_SECRET` + `X-Cron-Secret` header — not for browser clients.
 */
export function createInternalCronRoutes(container: ContainerInternalCronRoutesSlice, env: Env) {
  const r = new Hono();

  r.post("/bulk-payout-settlement", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);

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
      const bulk = await container.settlementCronService.runBulkSettlement();
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
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
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
    const result = await container.settlementCronService.syncXeroPayoutBill(payoutId);
    if (!result.ok) {
      return c.json({ error: result.error }, 503);
    }
    return c.json({ data: result.data });
  });

  /** Expire stale `pending` buyer payments (winner never paid). */
  r.post("/expire-stale-payments", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const data = await container.paymentMaintenanceCronService.expireStalePayments(
      env.PAYMENT_PENDING_EXPIRE_DAYS,
      env.PAYMENT_AUTHORIZED_EXPIRE_DAYS,
    );
    return c.json({ data });
  });

  /** Replay Xero invoice sync for webhook rows that previously failed (idempotent). */
  r.post("/retry-xero-webhook-failures", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const data = await container.accountingReplayCronService.retryXeroWebhookFailures();
    return c.json({ data });
  });

  /** Proactively refresh Xero OAuth tokens (keeps refresh token alive on idle stacks). */
  r.post("/refresh-xero-tokens", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const result = await container.accountingReplayCronService.refreshXeroTokens();
    if (!result.ok) {
      if (result.error === "xero_not_configured") {
        return c.json({ error: result.error }, 503);
      }
      const status = result.status === 502 ? 502 : 200;
      return c.json({ data: result.result }, status);
    }
    return c.json({ data: result.result });
  });

  /** Replay admin refunds where Stripe succeeded but DB persist failed. */
  r.post("/retry-refund-reconciles", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const data = await container.paymentMaintenanceCronService.retryRefundReconciles();
    return c.json({ data });
  });

  /** Retry Xero bank payment recording for captured Stripe payments missing xeroPaymentId. */
  r.post("/retry-xero-stripe-capture-sync", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const result = await container.accountingReplayCronService.retryXeroStripeCaptureSync();
    if (!result.ok) {
      return c.json({ error: result.error }, 503);
    }
    return c.json({ data: result.data });
  });

  /**
   * Create missing Xero ACCREC invoices for settleable payments (checkout proceeded while Xero was
   * down — XERO_INVOICE_BLOCKING=false). Idempotent; no-op while Xero is still disconnected.
   */
  r.post("/retry-xero-invoice-creation", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const result = await container.accountingReplayCronService.retryXeroInvoiceCreation();
    if (!result.ok) {
      return c.json({ error: result.error }, 503);
    }
    return c.json({ data: result.data });
  });

  /**
   * Purge expired Better Auth `verification` rows (email links, OTP artifacts).
   *
   * Deletes in batches of 500 via a subquery to avoid long table locks on large tables.
   * The cron should be invoked frequently enough that a single batch clears the backlog.
   */
  r.post("/purge-expired-verifications", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const data = await container.hygieneCronService.purgeExpiredVerifications();
    return c.json({ data });
  });

  /** Nudge sellers whose draft submissions have been untouched for N days. */
  r.post("/stale-submission-draft-reminders", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const data = await container.hygieneCronService.sendStaleSubmissionDraftReminders(
      env.SUBMISSION_DRAFT_REMINDER_DAYS,
    );
    return c.json({ data });
  });

  /** Verify Sentry connectivity from worker/cron callers (guarded by X-Cron-Secret). */
  r.post("/sentry-test", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const result = await container.hygieneCronService.probeSentry(env.SENTRY_DSN_API);
    if (!result.ok) {
      return c.json({ error: result.error }, 503);
    }
    return c.json({ ok: true, eventId: result.eventId });
  });

  /** Pull Veriff watchlist screening for a session (backfill when webhook ingest failed). */
  r.post("/aml/reconcile-watchlist", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const body = (await c.req.json().catch(() => ({}))) as { providerSessionId?: string };
    if (!body.providerSessionId) {
      return c.json({ error: "provider_session_id_required" }, 400);
    }
    try {
      const result = await container.hygieneCronService.reconcileAmlWatchlist(
        body.providerSessionId,
      );
      return c.json({ data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "reconcile_failed";
      return c.json({ error: message }, 502);
    }
  });

  /** Lot scheduled→active / active→ended transitions + sale status reconciliation (worker cron). */
  r.post("/lot-lifecycle-tick", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);

    const lockOk = await container.redis.set(
      LOT_LIFECYCLE_TICK_LOCK_KEY,
      "1",
      "EX",
      LOT_LIFECYCLE_TICK_LOCK_TTL_SEC,
      "NX",
    );
    if (lockOk !== "OK") {
      return c.json({ reason: "lifecycle_tick_already_running" }, 409);
    }

    try {
      const data = await container.lifecycleCronService.runLotLifecycleTick();
      return c.json({ data });
    } finally {
      await container.redis.del(LOT_LIFECYCLE_TICK_LOCK_KEY);
    }
  });

  /** Drain critical bid/lot-close notification outbox rows (outbid, won, lost). */
  r.post("/process-notification-outbox", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const data = await container.lifecycleCronService.processNotificationOutbox();
    return c.json({ data });
  });

  /** Expire abandoned display pairing rows and purge old terminal records. */
  r.post("/cleanup-display-pairings", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const data = await container.hygieneCronService.cleanupDisplayPairings();
    return c.json({ data });
  });

  /** Idempotently ensure a payment + invoice exists for one sold lot (worker projector). */
  r.post(
    "/ensure-lot-invoice",
    zValidator("json", z.object({ lotId: z.string().uuid() })),
    async (c) => {
      const auth = requireCronAuth(c, env);
      if (!auth.ok) return c.json(auth.body, auth.status);
      const { lotId } = c.req.valid("json");
      const data = await container.settlementCronService.ensureLotInvoice(lotId);
      return c.json({ data });
    },
  );

  /** Reconciliation sweep: backfill invoices for sold lots missing a payment row. */
  r.post("/ensure-lot-invoices", async (c) => {
    const auth = requireCronAuth(c, env);
    if (!auth.ok) return c.json(auth.body, auth.status);
    const data = await container.settlementCronService.ensureLotInvoices();
    return c.json({ data });
  });

  return r;
}

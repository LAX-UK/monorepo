import { Hono } from "hono";
import { z } from "zod";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { rejectAbsenteeReplayWhenDelegatedToWorker } from "../lib/absentee-replay-execution-guard.js";
import { rejectFinanceCronWhenDelegatedToWorker } from "../lib/finance-cron-execution-guard.js";
import { type CronAuthResult, requireCronAuth } from "../lib/internal-cron-auth.js";
import { zValidator } from "../lib/z-validator.js";

export { BULK_PAYOUT_SETTLEMENT_LOCK_KEY } from "../services/finance/internal-cron-application.service.js";
export { LOT_LIFECYCLE_TICK_LOCK_KEY } from "../services/finance/platform-lifecycle-cron-application.service.js";

/** Machine-to-machine triggers (worker / platform cron). Guarded by
 * `CRON_INTERNAL_SECRET` + `X-Cron-Secret` header — not for browser clients.
 */
export function createInternalCronRoutes(container: ContainerInternalCronRoutesSlice, env: Env) {
  const r = new Hono();
  const auth = (c: { req: { header: (name: string) => string | undefined } }) =>
    requireCronAuth((name) => c.req.header(name), env);

  const financeWorkerGate = () => {
    const delegated = rejectFinanceCronWhenDelegatedToWorker(env);
    if (!delegated.ok) {
      return { blocked: true as const, body: delegated.body, status: delegated.status };
    }
    return { blocked: false as const };
  };

  type FinanceCronAuth = CronAuthResult | { ok: false; status: 409; body: { error: string } };

  const authFinanceCron = (c: {
    req: { header: (name: string) => string | undefined };
  }): FinanceCronAuth => {
    const gate = auth(c);
    if (!gate.ok) return gate;
    const workerGate = financeWorkerGate();
    if (workerGate.blocked) {
      return { ok: false, status: workerGate.status, body: workerGate.body };
    }
    return { ok: true };
  };

  r.post("/bulk-payout-settlement", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);

    const outcome = await container.finance.internalCron.runBulkPayoutSettlementWithLock({
      settlementDisabled: env.DISABLE_PAYOUT_SETTLEMENT,
    });
    if (!outcome.ok) {
      return c.json(outcome.body, outcome.status);
    }
    return c.json({ data: outcome.data });
  });

  r.post("/xero-payout-bill", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
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
    const result = await container.finance.internalCron.syncXeroPayoutBill(payoutId);
    if (!result.ok) {
      return c.json({ error: result.error }, 503);
    }
    return c.json({ data: result.data });
  });

  r.post("/expire-stale-payments", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const data = await container.finance.internalCron.expireStalePayments(
      env.PAYMENT_PENDING_EXPIRE_DAYS,
      env.PAYMENT_AUTHORIZED_EXPIRE_DAYS,
    );
    return c.json({ data });
  });

  r.post("/retry-xero-webhook-failures", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const data = await container.finance.accountingCron.retryXeroWebhookFailures();
    return c.json({ data });
  });

  r.post("/refresh-xero-tokens", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const result = await container.finance.accountingCron.refreshXeroTokens();
    if (!result.ok) {
      if (result.error === "xero_not_configured") {
        return c.json({ error: result.error }, 503);
      }
      const status = result.status === 502 ? 502 : 200;
      return c.json({ data: result.result }, status);
    }
    return c.json({ data: result.result });
  });

  r.post("/retry-refund-reconciles", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const data = await container.finance.internalCron.retryRefundReconciles();
    return c.json({ data });
  });

  r.post("/retry-xero-stripe-capture-sync", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const result = await container.finance.accountingCron.retryXeroStripeCaptureSync();
    if (!result.ok) {
      return c.json({ error: result.error }, 503);
    }
    return c.json({ data: result.data });
  });

  r.post("/retry-xero-invoice-creation", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const result = await container.finance.accountingCron.retryXeroInvoiceCreation();
    if (!result.ok) {
      return c.json({ error: result.error }, 503);
    }
    return c.json({ data: result.data });
  });

  r.post("/xero-sync-invoice-webhook", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    let body: { tenantId?: unknown; resourceId?: unknown; eventKey?: unknown };
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
    const eventKey = typeof body.eventKey === "string" ? body.eventKey : "";
    if (!tenantId || !resourceId || !eventKey) {
      return c.json({ error: "tenant_resource_event_key_required" }, 400);
    }
    const result = await container.finance.accountingCron.syncXeroInvoiceWebhookEvent({
      tenantId,
      resourceId,
      eventKey,
    });
    if (!result.ok) {
      return c.json({ error: result.error ?? "sync_failed" }, 502);
    }
    return c.json({ data: result });
  });

  r.post("/xero-record-stripe-capture", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    let body: { paymentId?: unknown };
    try {
      body = (await c.req.json()) as { paymentId?: unknown };
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
    if (!paymentId) {
      return c.json({ error: "payment_id_required" }, 400);
    }
    const result = await container.finance.accountingCron.recordStripeCaptureForPayment(paymentId);
    if (!result.ok) {
      return c.json({ error: result.error }, 502);
    }
    return c.json({ data: result });
  });

  r.post("/xero-record-refund-credit-note", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    let body: { paymentId?: unknown };
    try {
      body = (await c.req.json()) as { paymentId?: unknown };
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
    if (!paymentId) {
      return c.json({ error: "payment_id_required" }, 400);
    }
    const result =
      await container.finance.accountingCron.recordRefundCreditNoteForPayment(paymentId);
    if (!result.ok) {
      return c.json({ error: result.error }, 502);
    }
    return c.json({ data: result });
  });

  r.post("/xero-acknowledge-payout-settlement", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
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
    const result = await container.finance.accountingCron.acknowledgePayoutSettlement(payoutId);
    if (!result.ok) {
      return c.json({ error: result.error }, 404);
    }
    return c.json({ data: result.data });
  });

  r.post("/stale-submission-draft-reminders", async (c) => {
    const gate = auth(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const data = await container.platformCron.hygiene.sendStaleSubmissionDraftReminders(
      env.SUBMISSION_DRAFT_REMINDER_DAYS,
    );
    return c.json({ data });
  });

  r.post("/sentry-test", async (c) => {
    const gate = auth(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const result = await container.platformCron.hygiene.probeSentry(env.SENTRY_DSN_API);
    if (!result.ok) {
      return c.json({ error: result.error }, 503);
    }
    return c.json({ ok: true, eventId: result.eventId });
  });

  r.post("/aml/reconcile-watchlist", async (c) => {
    const gate = auth(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const body = (await c.req.json().catch(() => ({}))) as { providerSessionId?: string };
    if (!body.providerSessionId) {
      return c.json({ error: "provider_session_id_required" }, 400);
    }
    try {
      const result = await container.platformCron.hygiene.reconcileAmlWatchlist(
        body.providerSessionId,
      );
      return c.json({ data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "reconcile_failed";
      return c.json({ error: message }, 502);
    }
  });

  r.post("/lot-lifecycle-tick", async (c) => {
    const gate = auth(c);
    if (!gate.ok) return c.json(gate.body, gate.status);

    if (env.LIFECYCLE_EXECUTION_OWNER === "worker") {
      return c.json({ error: "lifecycle_execution_delegated_to_worker" }, 409);
    }

    const outcome = await container.platformCron.lifecycle.runLotLifecycleTickWithLock();
    if (!outcome.ok) {
      return c.json(outcome.body, outcome.status);
    }
    return c.json({ data: outcome.data });
  });

  r.post(
    "/replay-absentee-for-lot",
    zValidator("json", z.object({ lotId: z.string().uuid() })),
    async (c) => {
      const gate = auth(c);
      if (!gate.ok) return c.json(gate.body, gate.status);
      const absenteeGate = rejectAbsenteeReplayWhenDelegatedToWorker(env);
      if (!absenteeGate.ok) return c.json(absenteeGate.body, absenteeGate.status);
      const { lotId } = c.req.valid("json");
      await container.absenteeBidService.replayScheduledForLot(lotId);
      return c.json({ ok: true });
    },
  );

  r.post("/process-notification-outbox", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const data = await container.platformCron.lifecycle.processNotificationOutbox();
    return c.json({ data });
  });

  r.post("/cleanup-display-pairings", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const data = await container.platformCron.hygiene.cleanupDisplayPairings();
    return c.json({ data });
  });

  r.post(
    "/ensure-lot-invoice",
    zValidator("json", z.object({ lotId: z.string().uuid() })),
    async (c) => {
      const gate = authFinanceCron(c);
      if (!gate.ok) return c.json(gate.body, gate.status);
      const { lotId } = c.req.valid("json");
      const data = await container.finance.settlementCron.ensureLotInvoice(lotId);
      return c.json({ data });
    },
  );

  r.post("/ensure-lot-invoices", async (c) => {
    const gate = authFinanceCron(c);
    if (!gate.ok) return c.json(gate.body, gate.status);
    const data = await container.finance.settlementCron.ensureLotInvoices();
    return c.json({ data });
  });

  return r;
}

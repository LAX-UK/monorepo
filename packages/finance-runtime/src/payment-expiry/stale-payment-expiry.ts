import { INVOICE_PAYMENT_DUE_DAYS } from "@auction/types";
import { type IMoneyPathMetrics, noMoneyPathMetrics } from "../money-path-metrics.js";
import {
  type IPaymentProviderCloser,
  type ProviderMoneyState,
  staleExpiryAction,
} from "./provider-money-state.js";

export type StalePayment = { id: string; lotId: string; buyerId: string };

export type StalePaymentStatus = "pending" | "authorized";

/** What the expiry job reads and changes about invoices. */
export interface IStalePaymentStore {
  listStalePendingBefore(cutoff: Date): Promise<StalePayment[]>;
  listStaleAuthorizedBefore(cutoff: Date): Promise<StalePayment[]>;
  /** The invoice as it is now, with the provider references the job needs. */
  findForExpiry(paymentId: string): Promise<{
    status: string;
    amountPence: number;
    stripePaymentIntentId: string | null;
    paymentGroupId: string | null;
    buyerLegalEntityId: string | null;
  } | null>;
  checkoutSessionIds(paymentId: string): Promise<string[]>;
  /**
   * Cancels only while the invoice is still unpaid, outside any "Pay several" payment, and with no
   * checkout opened since `checkStartedAt`; false otherwise (the next run looks again).
   */
  cancelIfUnpaid(paymentId: string, checkStartedAt: Date): Promise<boolean>;
  /** Money is on its way: an unpaid invoice is marked as such, as the "processing" webhook does. */
  markAuthorizedIfPending(paymentId: string): Promise<boolean>;
}

/**
 * Records money the provider shows as paid on an invoice we were about to expire. The API captures
 * it through the same path as the webhook; a process that cannot capture opens a finance task.
 */
export interface ILatePaymentRecorder {
  recordPaid(input: {
    paymentId: string;
    amountPence: number;
    buyerLegalEntityId: string | null;
    state: Extract<ProviderMoneyState, { kind: "paid" }>;
  }): Promise<void>;
}

export interface IStalePaymentEvents {
  publishCancelled(event: {
    paymentId: string;
    lotId: string;
    buyerUserId: string;
    reason: "stale_pending_expired" | "stale_authorized_expired";
  }): Promise<void>;
}

export type StalePaymentExpiryDeps = {
  payments: IStalePaymentStore;
  provider: IPaymentProviderCloser;
  latePayments: ILatePaymentRecorder;
  events: IStalePaymentEvents;
  metrics?: IMoneyPathMetrics;
  now?: () => Date;
};

export type StalePaymentExpiryReport = {
  expired: number;
  recordedPaid: number;
  keptInFlight: number;
  retryLater: number;
};

const DAY_MS = 86_400_000;

/**
 * Expires invoices nobody paid. The one implementation behind the API and the worker cron.
 *
 * An invoice is never cancelled while money may still reach it: every open checkout is closed
 * and re-read first. Paid money is recorded, money on its way keeps the invoice open, and an
 * unanswered provider leaves it for the next run.
 */
export async function expireStalePayments(
  deps: StalePaymentExpiryDeps,
  pendingMaxAgeDays: number,
  authorizedMaxAgeDays: number,
): Promise<StalePaymentExpiryReport> {
  const metrics = deps.metrics ?? noMoneyPathMetrics;
  // An invoice is never expired before it is due, whatever the configured ages.
  const pendingDays = Math.max(pendingMaxAgeDays, INVOICE_PAYMENT_DUE_DAYS);
  const authorizedDays = Math.max(authorizedMaxAgeDays, INVOICE_PAYMENT_DUE_DAYS);
  const now = (deps.now ?? (() => new Date()))().getTime();
  const report: StalePaymentExpiryReport = {
    expired: 0,
    recordedPaid: 0,
    keptInFlight: 0,
    retryLater: 0,
  };
  const batches: [StalePayment[], "stale_pending_expired" | "stale_authorized_expired"][] = [
    [
      await deps.payments.listStalePendingBefore(new Date(now - pendingDays * DAY_MS)),
      "stale_pending_expired",
    ],
    [
      await deps.payments.listStaleAuthorizedBefore(new Date(now - authorizedDays * DAY_MS)),
      "stale_authorized_expired",
    ],
  ];

  for (const [rows, reason] of batches) {
    for (const row of rows) {
      const current = await deps.payments.findForExpiry(row.id);
      if (!current || (current.status !== "pending" && current.status !== "authorized")) continue;
      // A payment in a "Pay several" group is released with its group, never on its own.
      if (current.paymentGroupId) continue;

      const checkStartedAt = new Date((deps.now ?? (() => new Date()))().getTime());
      const state = await deps.provider.closeAndRead({
        paymentId: row.id,
        paymentIntentId: current.stripePaymentIntentId,
        checkoutSessionIds: await deps.payments.checkoutSessionIds(row.id),
      });

      switch (staleExpiryAction(state)) {
        case "cancel":
          if (await deps.payments.cancelIfUnpaid(row.id, checkStartedAt)) {
            await deps.events.publishCancelled({
              paymentId: row.id,
              lotId: row.lotId,
              buyerUserId: row.buyerId,
              reason,
            });
            report.expired += 1;
          }
          break;
        case "record_paid":
          await deps.latePayments.recordPaid({
            paymentId: row.id,
            amountPence: current.amountPence,
            buyerLegalEntityId: current.buyerLegalEntityId,
            state: state as Extract<ProviderMoneyState, { kind: "paid" }>,
          });
          metrics.record("stale_payment_paid_at_provider");
          report.recordedPaid += 1;
          break;
        case "keep_in_flight":
          if (current.status === "pending") await deps.payments.markAuthorizedIfPending(row.id);
          metrics.record("stale_payment_money_in_flight");
          report.keptInFlight += 1;
          break;
        case "retry_later":
          metrics.record("stale_payment_provider_unknown");
          console.error(
            JSON.stringify({
              msg: "stale_payment_expiry_deferred",
              paymentId: row.id,
              error: state.kind === "unknown" ? state.error : null,
            }),
          );
          report.retryLater += 1;
          break;
      }
    }
  }
  return report;
}

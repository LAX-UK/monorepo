import type {
  IStripeRefundWatchRepository,
  StripeRefundWatchRow,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { type StaffRefundContext, staffRefundContextOf } from "../payment/refund-execution.js";
import type { IChargeRefundsReader } from "../stripe/stripe-charge-refunds.js";
import { isCountedRefund, isUnsettledRefund } from "../stripe/stripe-refund-status.js";
import type { PaymentWebhookResult } from "./payment-webhook-types.js";

/** First re-read five minutes after a refund was seen; doubled each time, at most every six hours. */
export const REFUND_RECHECK_BASE_MS = 5 * 60_000;
export const REFUND_RECHECK_MAX_MS = 6 * 60 * 60_000;
/** A claimed row is not taken by an overlapping run for this long. */
export const REFUND_RECHECK_LEASE_MS = 10 * 60_000;
export const REFUND_RECHECK_DEFAULT_BATCH = 50;
export const REFUND_RECHECK_MAX_BATCH = 200;

export function refundRecheckDelayMs(attempts: number): number {
  const exponent = Math.min(Math.max(attempts, 0), 16);
  return Math.min(REFUND_RECHECK_BASE_MS * 2 ** exponent, REFUND_RECHECK_MAX_MS);
}

export type StripeRefundReconcileDeps = {
  watch: Pick<IStripeRefundWatchRepository, "claimDue" | "reschedule" | "markSettled">;
  refunds: Pick<IChargeRefundsReader, "retrieveRefund" | "retrieveCharge">;
  /**
   * Settles the charge exactly as `charge.refunded` does (unapplied money, a deal, a Pay several
   * charge or a single invoice), measured against the refunds Stripe lists as succeeded.
   */
  settleCharge: (event: Stripe.Event, charge: Stripe.Charge) => Promise<PaymentWebhookResult>;
  /** Records a staff refund that was pending when it was made, now that it has succeeded. */
  completeStaffRefund: (
    context: StaffRefundContext,
    stripeRefundId: string,
  ) => Promise<{ isErr(): boolean }>;
  now?: () => Date;
  log?: Pick<Console, "info" | "warn" | "error">;
};

export type StripeRefundReconcileSummary = {
  checked: number;
  settled: number;
  stillPending: number;
  failed: number;
};

/**
 * The refund reconcile job. Every refund seen pending or requiring action is watched; this re-reads
 * the due ones from Stripe and, once a refund is final, settles its charge through the webhook's
 * own path. It needs no `charge.refund.updated` subscription and is safe beside it: the settlement
 * is measured from Stripe's list under the payment's lock and claimed under an id of its own per
 * refund and status, so a refund is counted, announced and clawed back once however many of the
 * webhook and the job see it, and in whatever order.
 */
export class StripeRefundReconcileService {
  constructor(private readonly deps: StripeRefundReconcileDeps) {}

  async run(input: { limit?: number } = {}): Promise<StripeRefundReconcileSummary> {
    const limit = Math.min(
      Math.max(Math.trunc(input.limit ?? REFUND_RECHECK_DEFAULT_BATCH), 1),
      REFUND_RECHECK_MAX_BATCH,
    );
    const rows = await this.deps.watch.claimDue(limit, REFUND_RECHECK_LEASE_MS, this.now());
    const summary: StripeRefundReconcileSummary = {
      checked: rows.length,
      settled: 0,
      stillPending: 0,
      failed: 0,
    };
    for (const row of rows) {
      try {
        const outcome = await this.reconcile(row);
        summary[outcome] += 1;
      } catch (err) {
        summary.failed += 1;
        recordMoneyPathEvent("refund_reconcile_failed");
        const message = err instanceof Error ? err.message : String(err);
        this.deps.log?.error(
          JSON.stringify({
            msg: "refund_reconcile_failed",
            stripeRefundId: row.stripeRefundId,
            error: message,
          }),
        );
        await this.deps.watch.reschedule(row.stripeRefundId, {
          status: row.status,
          nextCheckAt: this.later(row.attempts),
          lastError: message.slice(0, 500),
        });
      }
    }
    return summary;
  }

  private async reconcile(row: StripeRefundWatchRow): Promise<"settled" | "stillPending"> {
    const refund = await this.deps.refunds.retrieveRefund(row.stripeRefundId);
    if (isUnsettledRefund(refund.status)) {
      await this.deps.watch.reschedule(row.stripeRefundId, {
        status: refund.status,
        nextCheckAt: this.later(row.attempts),
        lastError: null,
      });
      return "stillPending";
    }
    const staff = staffRefundContextOf(row.staffRefund);
    if (staff && isCountedRefund(refund.status)) {
      const recorded = await this.deps.completeStaffRefund(staff, row.stripeRefundId);
      if (recorded.isErr()) throw new Error("The staff refund could not be recorded");
    }
    const chargeId = refund.chargeId || row.stripeChargeId;
    const charge = await this.deps.refunds.retrieveCharge(chargeId);
    // An id of its own per refund and final status: a repeat of this run is a duplicate, and a
    // refund that succeeded and was later reversed is settled again under its new status.
    const event = {
      id: `refund_reconcile:${row.stripeRefundId}:${refund.status}`,
      type: "charge.refund.updated",
      data: { object: { id: row.stripeRefundId, charge: chargeId } },
    } as unknown as Stripe.Event;
    const result = await this.deps.settleCharge(event, charge);
    recordMoneyPathEvent(
      isCountedRefund(refund.status)
        ? "refund_reconcile_succeeded"
        : "refund_reconcile_returned_nothing",
    );
    this.deps.log?.info(
      JSON.stringify({
        msg: "refund_reconciled",
        stripeRefundId: row.stripeRefundId,
        status: refund.status,
        staffRefund: staff !== null,
        action: result.action ?? null,
        reason: result.reason ?? null,
      }),
    );
    await this.deps.watch.markSettled(row.stripeRefundId, refund.status, this.now());
    return "settled";
  }

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  private later(attempts: number): Date {
    return new Date(this.now().getTime() + refundRecheckDelayMs(attempts));
  }
}

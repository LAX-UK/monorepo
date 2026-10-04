import type { Database } from "@auction/db";
import { shopOrder, shopPayoutLedger, shopRefund } from "@auction/db/schema";
import { Sentry } from "@auction/observability";
import { and, eq, isNull } from "drizzle-orm";
import type { PaymentRefundGateway } from "../../application/ports/payment-refund.gateway.js";
import { createDrizzleShopNotificationPublisher } from "../drizzle-shop-notification.publisher.js";

const MAX_SUBMIT_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
const SUBMIT_CLAIM_PREFIX = "submit_claim:";

function refundSubmitBackoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

function isEligibleForSubmit(row: { submitAttempts: number; updatedAt: Date }, now: Date): boolean {
  if (row.submitAttempts === 0) return true;
  return now.getTime() >= row.updatedAt.getTime() + refundSubmitBackoffMs(row.submitAttempts);
}

function alertRefundSubmitTerminalFailure(refundId: string, reason: string): void {
  Sentry.captureMessage("shop_refund_submit_terminal_failure", {
    level: "error",
    tags: { refundId },
    extra: { reason },
  });
}

async function recomputeOrderStatusAfterRefundChange(tx: Database, orderId: string): Promise<void> {
  const [order] = await tx
    .select({ totalPence: shopOrder.totalPence })
    .from(shopOrder)
    .where(eq(shopOrder.id, orderId))
    .limit(1);
  if (!order) return;
  const refundRows = await tx
    .select({ amountPence: shopRefund.amountPence, status: shopRefund.status })
    .from(shopRefund)
    .where(eq(shopRefund.orderId, orderId));
  const succeededTotal = refundRows
    .filter((row) => row.status === "succeeded")
    .reduce((sum, row) => sum + row.amountPence, 0);
  let nextStatus: "paid" | "partially_refunded" | "refunded" = "paid";
  if (succeededTotal > 0 && succeededTotal < order.totalPence) {
    nextStatus = "partially_refunded";
  } else if (succeededTotal >= order.totalPence) {
    nextStatus = "refunded";
  }
  await tx.update(shopOrder).set({ status: nextStatus }).where(eq(shopOrder.id, orderId));
}

export function createSubmitPendingRefundsRunner(
  db: Database,
  gateway: PaymentRefundGateway,
  options?: { opsAlertEmail?: string | null },
): () => Promise<number> {
  const notifications = createDrizzleShopNotificationPublisher();
  const opsAlertEmail = options?.opsAlertEmail ?? null;

  return async () => {
    const now = new Date();
    let submitted = 0;

    for (let batch = 0; batch < 20; batch++) {
      const claim = await db.transaction(async (tx) => {
        const candidates = await tx
          .select({
            id: shopRefund.id,
            submitAttempts: shopRefund.submitAttempts,
            updatedAt: shopRefund.updatedAt,
          })
          .from(shopRefund)
          .where(and(eq(shopRefund.status, "pending"), isNull(shopRefund.stripeRefundId)))
          .limit(20)
          .for("update", { skipLocked: true });

        for (const candidate of candidates) {
          if (!isEligibleForSubmit(candidate, now)) continue;
          const claimToken = `${SUBMIT_CLAIM_PREFIX}${now.toISOString()}`;
          const [locked] = await tx
            .update(shopRefund)
            .set({ lastError: claimToken, updatedAt: now })
            .where(
              and(
                eq(shopRefund.id, candidate.id),
                eq(shopRefund.status, "pending"),
                isNull(shopRefund.stripeRefundId),
              ),
            )
            .returning({
              id: shopRefund.id,
              orderId: shopRefund.orderId,
              orderLineId: shopRefund.orderLineId,
              amountPence: shopRefund.amountPence,
              submitAttempts: shopRefund.submitAttempts,
            });
          if (locked) {
            return { ...locked, claimToken };
          }
        }
        return null;
      });

      if (!claim) break;

      const [order] = await db
        .select({ stripePaymentIntentId: shopOrder.stripePaymentIntentId })
        .from(shopOrder)
        .where(eq(shopOrder.id, claim.orderId))
        .limit(1);
      const paymentIntentId = order?.stripePaymentIntentId;

      let stripeOutcome:
        | { ok: true; stripeRefundId: string }
        | { ok: false; retryable: boolean; message: string }
        | { ok: false; missingIntent: true; message: string };

      if (!paymentIntentId) {
        stripeOutcome = {
          ok: false,
          missingIntent: true,
          retryable: false,
          message: "Order missing stripe_payment_intent_id",
        };
      } else {
        const outcome = await gateway.submitRefund({
          refundId: claim.id,
          paymentIntentId,
          amountPence: claim.amountPence,
          idempotencyKey: claim.id,
        });
        stripeOutcome = outcome.ok
          ? outcome
          : { ok: false, retryable: outcome.retryable, message: outcome.message };
      }

      const finalized = await db.transaction(async (tx) => {
        const [row] = await tx
          .select({
            id: shopRefund.id,
            orderId: shopRefund.orderId,
            orderLineId: shopRefund.orderLineId,
            submitAttempts: shopRefund.submitAttempts,
            lastError: shopRefund.lastError,
            status: shopRefund.status,
            stripeRefundId: shopRefund.stripeRefundId,
          })
          .from(shopRefund)
          .where(eq(shopRefund.id, claim.id))
          .for("update")
          .limit(1);
        if (
          !row ||
          row.status !== "pending" ||
          row.stripeRefundId !== null ||
          row.lastError !== claim.claimToken
        ) {
          return false;
        }

        if (stripeOutcome.ok) {
          await tx
            .update(shopRefund)
            .set({
              stripeRefundId: stripeOutcome.stripeRefundId,
              submittedAt: now,
              lastError: null,
              updatedAt: now,
            })
            .where(eq(shopRefund.id, claim.id));
          return true;
        }

        const attempts = row.submitAttempts + 1;
        const terminal =
          attempts >= MAX_SUBMIT_ATTEMPTS ||
          !("retryable" in stripeOutcome && stripeOutcome.retryable) ||
          ("missingIntent" in stripeOutcome && stripeOutcome.missingIntent);

        await tx
          .update(shopRefund)
          .set({
            submitAttempts: attempts,
            lastError: stripeOutcome.message,
            updatedAt: now,
            ...(terminal ? { status: "failed" as const } : {}),
          })
          .where(eq(shopRefund.id, claim.id));

        if (terminal) {
          alertRefundSubmitTerminalFailure(claim.id, stripeOutcome.message);
          await recomputeOrderStatusAfterRefundChange(tx as Database, row.orderId);
          if (row.orderLineId) {
            await tx
              .update(shopPayoutLedger)
              .set({ blockedReason: null })
              .where(
                and(
                  eq(shopPayoutLedger.orderLineId, row.orderLineId),
                  eq(shopPayoutLedger.blockedReason, "cancellation"),
                ),
              );
          }
          if (opsAlertEmail?.includes("@")) {
            await notifications.queueCheckoutOpsAlert(tx as Database, {
              idempotencyKey: `refund-submit-failed:${claim.id}`,
              opsEmail: opsAlertEmail,
              alertKind: "shop_refund_submit_terminal_failure",
              orderId: row.orderId,
              detail: stripeOutcome.message,
            });
          }
        }
        return false;
      });

      if (finalized) submitted += 1;
    }

    return submitted;
  };
}

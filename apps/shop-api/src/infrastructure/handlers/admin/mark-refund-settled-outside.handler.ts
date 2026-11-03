import { shopOrder, shopOrderLine, shopRefund } from "@auction/db/schema";
import {
  SETTLED_OUTSIDE_REASON_MAX_LENGTH,
  SETTLED_OUTSIDE_REFERENCE_MAX_LENGTH,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { remainingRefundablePence } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import {
  applyPayoutEffectsForRefund,
  recomputeOrderRefundStatus,
} from "../../refund-settlement.js";
import { loadOrderRefunds } from "./load-order-refunds.js";

export type MarkRefundSettledOutsideCommand = {
  refundId: string;
  /** Why it was settled outside LAX. */
  reason: string;
  /** Where the refund can be found, such as the payment provider's refund ID. */
  externalReference: string;
  actorSubjectId: string;
  idempotencyKey: string;
  now?: Date;
};

export type MarkRefundSettledOutsideResult = { refundId: string; status: "succeeded" };

function invalid(message: string): never {
  throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, message, 400);
}

/**
 * Records that finance refunded the customer outside LAX after a refund here failed for good.
 * The refund then counts as paid: the order's refunded total and the artist's payout are settled
 * exactly as when the payment provider confirms a refund. Only a failed refund qualifies; a
 * pending one may still go through and a succeeded one is already paid, so either would pay the
 * customer twice.
 */
export function createMarkRefundSettledOutsideHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: MarkRefundSettledOutsideCommand) => Promise<MarkRefundSettledOutsideResult> {
  return async (command) => {
    const now = command.now ?? new Date();
    const reason = command.reason.trim();
    const reference = command.externalReference.trim();
    return deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "refund.settled_outside",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: { refundId: command.refundId, reason, reference },
        run: async () => {
          if (!reason) invalid("Say why the customer was refunded outside LAX");
          if (reason.length > SETTLED_OUTSIDE_REASON_MAX_LENGTH) invalid("The reason is too long");
          if (!reference)
            invalid("Enter the reference of the refund, such as the Stripe refund ID");
          if (reference.length > SETTLED_OUTSIDE_REFERENCE_MAX_LENGTH) {
            invalid("The reference is too long");
          }
          const db = shopPhaseDbSession(tx);
          const [refund] = await db
            .select({
              id: shopRefund.id,
              orderId: shopRefund.orderId,
              orderLineId: shopRefund.orderLineId,
              amountPence: shopRefund.amountPence,
              status: shopRefund.status,
            })
            .from(shopRefund)
            .where(eq(shopRefund.id, command.refundId))
            .for("update")
            .limit(1);
          if (!refund) throw notFound("Refund");
          if (refund.status !== "failed") {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              refund.status === "pending"
                ? "This refund is still being sent. Wait for it to fail, or let it go through"
                : "Only a failed refund can be marked as refunded outside LAX",
              409,
            );
          }
          const [order] = await db
            .select({ totalPence: shopOrder.totalPence })
            .from(shopOrder)
            .where(eq(shopOrder.id, refund.orderId))
            .for("update")
            .limit(1);
          if (!order) throw notFound("Order");

          // The customer cannot have been refunded more than they paid: every other refund still
          // counts, and this one is added once it is confirmed.
          const orderLines = await db
            .select({ orderLineId: shopOrderLine.id, totalPence: shopOrderLine.unitPricePence })
            .from(shopOrderLine)
            .where(eq(shopOrderLine.orderId, refund.orderId));
          const others = (await loadOrderRefunds(db, refund.orderId)).filter(
            (row) => row.refundId !== refund.id,
          );
          const lineTotal = refund.orderLineId
            ? orderLines.find((line) => line.orderLineId === refund.orderLineId)?.totalPence
            : undefined;
          const remaining = remainingRefundablePence({
            orderTotalPence: order.totalPence,
            ...(lineTotal !== undefined && refund.orderLineId
              ? { lineTotalPence: lineTotal, orderLineId: refund.orderLineId }
              : {}),
            refunds: others,
            orderLines,
          });
          if (refund.amountPence > remaining) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Another refund already covers this amount",
              409,
            );
          }

          await db
            .update(shopRefund)
            .set({
              status: "succeeded",
              lastError: null,
              settledOutsideAt: now,
              settledOutsideReference: reference,
              settledOutsideReason: reason,
              settledOutsideBySubjectId: command.actorSubjectId,
              updatedAt: now,
            })
            .where(eq(shopRefund.id, refund.id));

          const { succeededTotal } = await recomputeOrderRefundStatus(
            db,
            refund.orderId,
            order.totalPence,
          );
          await applyPayoutEffectsForRefund(db, refund.orderId, order.totalPence, succeededTotal);

          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "refund.write",
            action: "refund_settled_outside",
            targetType: "shop_refund",
            targetId: refund.id,
            afterJson: {
              orderId: refund.orderId,
              amountPence: refund.amountPence,
              ...(refund.orderLineId ? { orderLineId: refund.orderLineId } : {}),
              reference,
              reason,
            },
          });
          await tx.events.append({
            aggregateType: "shop_refund",
            aggregateId: refund.id,
            eventType: "shop.refund.completed",
            payload: {
              schemaVersion: 1,
              refundId: refund.id,
              orderId: refund.orderId,
              status: "succeeded",
            },
          });

          return { refundId: refund.id, status: "succeeded" as const };
        },
      }),
    );
  };
}

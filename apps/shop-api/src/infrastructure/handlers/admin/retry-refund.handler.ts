import { shopOrder, shopOrderLine, shopRefund } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { remainingRefundablePence } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { loadOrderRefunds } from "./load-order-refunds.js";

export type RetryRefundCommand = {
  refundId: string;
  actorSubjectId: string;
  idempotencyKey: string;
  now?: Date;
};

export type RetryRefundResult = { refundId: string; status: "pending" };

/**
 * Puts a failed refund back in the submission queue. The same refund row is reused, so Stripe
 * sees the same idempotency key and can never create a second refund for it. The retry is refused
 * unless the refund still fits the order's balance without itself: staff may have refunded the
 * customer another way since it failed.
 */
export function createRetryRefundHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: RetryRefundCommand) => Promise<RetryRefundResult> {
  return async (command) => {
    const now = command.now ?? new Date();
    return deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "refund.retry",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: { refundId: command.refundId },
        run: async () => {
          const db = shopPhaseDbSession(tx);
          const [refund] = await db
            .select({
              id: shopRefund.id,
              orderId: shopRefund.orderId,
              orderLineId: shopRefund.orderLineId,
              amountPence: shopRefund.amountPence,
              status: shopRefund.status,
              submitAttempts: shopRefund.submitAttempts,
              lastError: shopRefund.lastError,
            })
            .from(shopRefund)
            .where(eq(shopRefund.id, command.refundId))
            .for("update")
            .limit(1);
          if (!refund) throw notFound("Refund");
          if (refund.status !== "failed") {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Only a failed refund can be retried",
              409,
            );
          }
          const [order] = await db
            .select({ totalPence: shopOrder.totalPence, status: shopOrder.status })
            .from(shopOrder)
            .where(eq(shopOrder.id, refund.orderId))
            .for("update")
            .limit(1);
          if (!order) throw notFound("Order");
          if (order.status !== "paid" && order.status !== "partially_refunded") {
            throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Order is not refundable", 409);
          }

          const orderLines = await db
            .select({ orderLineId: shopOrderLine.id, totalPence: shopOrderLine.unitPricePence })
            .from(shopOrderLine)
            .where(eq(shopOrderLine.orderId, refund.orderId));
          // The refund being retried is not counted against itself; every other one is.
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
              status: "pending",
              submitAttempts: 0,
              lastError: null,
              submittedAt: null,
              updatedAt: now,
            })
            .where(eq(shopRefund.id, refund.id));

          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "refund.write",
            action: "retry_refund",
            targetType: "shop_refund",
            targetId: refund.id,
            afterJson: {
              orderId: refund.orderId,
              amountPence: refund.amountPence,
              ...(refund.orderLineId ? { orderLineId: refund.orderLineId } : {}),
              failedAttempts: refund.submitAttempts,
              ...(refund.lastError ? { lastError: refund.lastError.slice(0, 300) } : {}),
            },
          });

          return { refundId: refund.id, status: "pending" as const };
        },
      }),
    );
  };
}

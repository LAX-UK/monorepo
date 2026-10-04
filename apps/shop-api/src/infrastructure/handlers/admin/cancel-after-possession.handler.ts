import {
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopRefund,
  shopReturn,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type RefundLineInput, remainingRefundablePence } from "@auction/shop-domain";
import { and, eq, inArray } from "drizzle-orm";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

export type CancelAfterPossessionCommand = {
  orderLineId: string;
  editionId: string;
  actorSubjectId: string;
  idempotencyKey: string;
  now?: Date;
};

export function createCancelAfterPossessionHandler(deps: { uow: ShopUnitOfWorkFactory }) {
  return async (command: CancelAfterPossessionCommand) => {
    const now = command.now ?? new Date();
    return deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "order.cancel_after_possession",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const db = shopPhaseDbSession(tx);
          const [line] = await db
            .select({
              orderId: shopOrderLine.orderId,
              editionId: shopOrderLine.editionId,
              unitPricePence: shopOrderLine.unitPricePence,
            })
            .from(shopOrderLine)
            .where(eq(shopOrderLine.id, command.orderLineId))
            .for("update")
            .limit(1);
          if (!line) {
            throw notFound("Order line");
          }
          if (line.editionId !== command.editionId) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.VALIDATION,
              "Edition does not belong to order line",
              400,
            );
          }
          const [order] = await db
            .select({
              id: shopOrder.id,
              refundPeriodEndsAt: shopOrder.refundPeriodEndsAt,
              totalPence: shopOrder.totalPence,
              status: shopOrder.status,
            })
            .from(shopOrder)
            .where(eq(shopOrder.id, line.orderId))
            .for("update")
            .limit(1);
          if (!order) {
            throw notFound("Order");
          }
          if (!order.refundPeriodEndsAt || now > order.refundPeriodEndsAt) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Cancellation period has ended",
              409,
            );
          }
          if (order.status !== "paid" && order.status !== "partially_refunded") {
            throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Order is not cancellable", 409);
          }

          const refundRows = await db
            .select({
              amountPence: shopRefund.amountPence,
              status: shopRefund.status,
              orderLineId: shopRefund.orderLineId,
            })
            .from(shopRefund)
            .where(eq(shopRefund.orderId, order.id));
          const refunds: RefundLineInput[] = refundRows.map((row) => ({
            amountPence: row.amountPence,
            status: row.status,
            orderLineId: row.orderLineId,
          }));
          const remaining = remainingRefundablePence({
            orderTotalPence: order.totalPence,
            lineTotalPence: line.unitPricePence,
            refunds,
            orderLineId: command.orderLineId,
          });
          if (remaining <= 0) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "No refundable balance remains for this line",
              409,
            );
          }

          const [returnRow] = await db
            .insert(shopReturn)
            .values({
              orderLineId: command.orderLineId,
              editionId: command.editionId,
              status: "requested",
            })
            .returning({ id: shopReturn.id });
          if (!returnRow) {
            throw new Error("Failed to create return");
          }

          const [refund] = await db
            .insert(shopRefund)
            .values({
              orderId: order.id,
              orderLineId: command.orderLineId,
              amountPence: remaining,
              idempotencyKey: `cancellation:${command.idempotencyKey}`,
              requestedBySubjectId: command.actorSubjectId,
              source: "cancellation",
            })
            .returning({ id: shopRefund.id });
          if (!refund) {
            throw new Error("Failed to record cancellation refund");
          }

          await db
            .update(shopPayoutLedger)
            .set({ blockedReason: "cancellation" })
            .where(
              and(
                eq(shopPayoutLedger.orderLineId, command.orderLineId),
                inArray(shopPayoutLedger.status, ["pending_refund_period", "due"]),
              ),
            );

          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "refund.write",
            action: "cancel_after_possession",
            targetType: "shop_return",
            targetId: returnRow.id,
            afterJson: {
              orderLineId: command.orderLineId,
              editionId: command.editionId,
              refundId: refund.id,
              amountPence: remaining,
            },
          });

          await tx.events.append({
            aggregateType: "shop_return",
            aggregateId: returnRow.id,
            eventType: "shop.cancellation.requested",
            payload: {
              schemaVersion: 1,
              returnId: returnRow.id,
              orderLineId: command.orderLineId,
              editionId: command.editionId,
              refundId: refund.id,
            },
          });

          return { returnId: returnRow.id, refundId: refund.id, status: "requested" as const };
        },
      }),
    );
  };
}

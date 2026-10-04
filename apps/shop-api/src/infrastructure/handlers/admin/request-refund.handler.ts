import { shopOrder, shopOrderLine, shopRefund } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type RefundLineInput, remainingRefundablePence } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import { operatorContextAuditFields } from "../../../application/admin/operator-context.js";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

export type RequestRefundCommand = {
  orderId: string;
  orderLineId?: string;
  amountPence: number;
  actorSubjectId: string;
  idempotencyKey: string;
  operatorContext?: import("../../../application/admin/operator-context.js").ShopOperatorContext;
};

export type RequestRefundResult = { refundId: string; status: "pending" };

export function createRequestRefundHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: RequestRefundCommand) => Promise<RequestRefundResult> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "refund.request",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const [order] = await shopPhaseDbSession(tx)
            .select({
              id: shopOrder.id,
              status: shopOrder.status,
              totalPence: shopOrder.totalPence,
            })
            .from(shopOrder)
            .where(eq(shopOrder.id, command.orderId))
            .for("update")
            .limit(1);
          if (!order) {
            throw notFound("Order");
          }
          if (order.status !== "paid" && order.status !== "partially_refunded") {
            throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Order is not refundable", 409);
          }
          if (command.orderLineId) {
            const [line] = await shopPhaseDbSession(tx)
              .select({ id: shopOrderLine.id, unitPricePence: shopOrderLine.unitPricePence })
              .from(shopOrderLine)
              .where(
                and(
                  eq(shopOrderLine.id, command.orderLineId),
                  eq(shopOrderLine.orderId, command.orderId),
                ),
              )
              .limit(1);
            if (!line) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.VALIDATION,
                "Order line does not belong to order",
                400,
              );
            }
          }
          const refundRows = await shopPhaseDbSession(tx)
            .select({
              amountPence: shopRefund.amountPence,
              status: shopRefund.status,
              orderLineId: shopRefund.orderLineId,
            })
            .from(shopRefund)
            .where(eq(shopRefund.orderId, command.orderId));
          const refunds: RefundLineInput[] = refundRows.map((row) => ({
            amountPence: row.amountPence,
            status: row.status,
            orderLineId: row.orderLineId,
          }));
          let lineTotal: number | undefined;
          if (command.orderLineId) {
            const [line] = await shopPhaseDbSession(tx)
              .select({ unitPricePence: shopOrderLine.unitPricePence })
              .from(shopOrderLine)
              .where(eq(shopOrderLine.id, command.orderLineId))
              .limit(1);
            lineTotal = line?.unitPricePence;
          }
          const remaining = remainingRefundablePence({
            orderTotalPence: order.totalPence,
            ...(lineTotal !== undefined ? { lineTotalPence: lineTotal } : {}),
            refunds,
            ...(command.orderLineId ? { orderLineId: command.orderLineId } : {}),
          });
          if (command.amountPence > remaining) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.VALIDATION,
              "Refund amount exceeds remaining refundable balance",
              400,
            );
          }
          const [refund] = await shopPhaseDbSession(tx)
            .insert(shopRefund)
            .values({
              orderId: command.orderId,
              amountPence: command.amountPence,
              idempotencyKey: command.idempotencyKey,
              requestedBySubjectId: command.actorSubjectId,
              source: "admin",
              ...(command.orderLineId ? { orderLineId: command.orderLineId } : {}),
            })
            .returning({ id: shopRefund.id });
          if (!refund) {
            throw new Error("Failed to record refund");
          }
          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "refund.write",
            action: "request_refund",
            targetType: "shop_refund",
            targetId: refund.id,
            afterJson: {
              orderId: command.orderId,
              amountPence: command.amountPence,
              ...operatorContextAuditFields(command.operatorContext),
            },
          });
          await tx.events.append({
            aggregateType: "shop_refund",
            aggregateId: refund.id,
            eventType: "shop.refund.requested",
            payload: {
              schemaVersion: 1,
              refundId: refund.id,
              orderId: command.orderId,
              amountPence: command.amountPence,
            },
          });
          return { refundId: refund.id, status: "pending" as const };
        },
      }),
    );
}

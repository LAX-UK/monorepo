import { shopFramingTask, shopOrder, shopOrderLine, shopRefund } from "@auction/db/schema";
import { type AdminRefundReason, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type FramingTaskStatus,
  framingRefundBlock,
  remainingRefundablePence,
} from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import { operatorContextAuditFields } from "../../../application/admin/operator-context.js";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import {
  cancelFramingTasksForLines,
  framingLineIdsOfOrder,
  refundFrameWithPrint,
} from "./framing-refund.js";
import { loadOrderRefunds } from "./load-order-refunds.js";

export type RequestRefundCommand = {
  orderId: string;
  orderLineId?: string;
  amountPence: number;
  actorSubjectId: string;
  idempotencyKey: string;
  /** Why staff refunded; kept in the audit entry for the order's timeline. */
  reason?: AdminRefundReason;
  note?: string;
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
          let line:
            | { id: string; unitPricePence: number; kind: string; editionId: string | null }
            | undefined;
          if (command.orderLineId) {
            [line] = await shopPhaseDbSession(tx)
              .select({
                id: shopOrderLine.id,
                unitPricePence: shopOrderLine.unitPricePence,
                kind: shopOrderLine.kind,
                editionId: shopOrderLine.editionId,
              })
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
            if (line.kind === "framing") {
              // A frame already being made is not refunded as an unused item.
              const [task] = await shopPhaseDbSession(tx)
                .select({ status: shopFramingTask.status })
                .from(shopFramingTask)
                .where(eq(shopFramingTask.orderLineId, line.id))
                .for("update")
                .limit(1);
              if (task && framingRefundBlock(task.status as FramingTaskStatus)) {
                throw new ShopApiError(
                  SHOP_API_ERROR_CODES.CONFLICT,
                  "This frame is already being made, so it cannot be refunded as unused",
                  409,
                );
              }
            }
          }
          const orderLines = await shopPhaseDbSession(tx)
            .select({ orderLineId: shopOrderLine.id, totalPence: shopOrderLine.unitPricePence })
            .from(shopOrderLine)
            .where(eq(shopOrderLine.orderId, command.orderId));
          const refunds = await loadOrderRefunds(shopPhaseDbSession(tx), command.orderId);
          const lineTotal = command.orderLineId
            ? orderLines.find((line) => line.orderLineId === command.orderLineId)?.totalPence
            : undefined;
          const remaining = remainingRefundablePence({
            orderTotalPence: order.totalPence,
            ...(lineTotal !== undefined ? { lineTotalPence: lineTotal } : {}),
            refunds,
            orderLines,
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
          // The work on a frame ends with the refund that takes it back: the frame's own refund in
          // full, its print's refund in full (which takes the frame with it), or the whole order.
          // An order-level refund is not held back by a frame being made: it is a decision about
          // the sale, not about an unused item.
          let frameRefund: Awaited<ReturnType<typeof refundFrameWithPrint>> = null;
          if (line?.kind === "framing" && command.amountPence >= remaining) {
            await cancelFramingTasksForLines(tx, {
              frameLineIds: [line.id],
              actorSubjectId: command.actorSubjectId,
              reason: "frame_refunded",
            });
          } else if (line?.kind === "goods" && line.editionId && command.amountPence >= remaining) {
            frameRefund = await refundFrameWithPrint(tx, {
              orderId: command.orderId,
              orderTotalPence: order.totalPence,
              printLineId: line.id,
              source: "admin",
              idempotencyKey: command.idempotencyKey,
              actorSubjectId: command.actorSubjectId,
            });
          } else if (!line && command.amountPence >= remaining) {
            await cancelFramingTasksForLines(tx, {
              frameLineIds: await framingLineIdsOfOrder(shopPhaseDbSession(tx), command.orderId),
              actorSubjectId: command.actorSubjectId,
              reason: "order_refunded",
            });
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
              ...(command.orderLineId ? { orderLineId: command.orderLineId } : {}),
              ...(frameRefund ? { frameRefundId: frameRefund.refundId } : {}),
              ...(command.reason ? { reason: command.reason } : {}),
              ...(command.note ? { note: command.note } : {}),
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

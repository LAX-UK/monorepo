import {
  shopArtwork,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopRefund,
  shopReturn,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type ShopFulfilmentStatus,
  cancellationStockOutcome,
  isShopFulfilmentStatus,
  remainingRefundablePence,
} from "@auction/shop-domain";
import { and, eq, inArray } from "drizzle-orm";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { loadOrderRefunds } from "./load-order-refunds.js";
import { applyReturnedEditionStock } from "./returned-edition-stock.js";

export type CancelAfterPossessionResult = {
  /** The tracked return, when the item has to come back; null when it never left the gallery. */
  returnId: string | null;
  refundId: string;
  /** "restocked" when the item never left the gallery and is back on sale. */
  status: "requested" | "restocked";
};

export type CancelAfterPossessionCommand = {
  orderLineId: string;
  editionId: string;
  actorSubjectId: string;
  idempotencyKey: string;
  now?: Date;
};

/**
 * Cancels an item the customer has taken possession of, and refunds it. Stock follows the item: if
 * it never left the gallery it goes back on sale straight away; if it was dispatched or collected
 * a return is opened and staff put it back on sale when it arrives.
 */
export function createCancelAfterPossessionHandler(deps: { uow: ShopUnitOfWorkFactory }) {
  return async (command: CancelAfterPossessionCommand): Promise<CancelAfterPossessionResult> => {
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
              sellerPartyId: shopOrderLine.sellerPartyId,
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
              reference: shopOrder.reference,
              identitySubjectId: shopOrder.identitySubjectId,
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

          const refunds = await loadOrderRefunds(db, order.id);
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

          const [fulfilment] = await db
            .select({ status: shopFulfilment.status })
            .from(shopFulfilment)
            .where(eq(shopFulfilment.orderId, order.id))
            .limit(1);
          // Without a fulfilment record there is no proof the item is in the gallery.
          const fulfilmentStatus: ShopFulfilmentStatus =
            fulfilment && isShopFulfilmentStatus(fulfilment.status)
              ? fulfilment.status
              : "delivered";
          const stockOutcome = cancellationStockOutcome(fulfilmentStatus);
          if (stockOutcome === "restock_now" && !line.sellerPartyId) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "The line has no seller to return the print to",
              409,
            );
          }

          const returnRow =
            stockOutcome === "await_return"
              ? (
                  await db
                    .insert(shopReturn)
                    .values({
                      orderLineId: command.orderLineId,
                      editionId: command.editionId,
                      status: "requested",
                    })
                    .returning({ id: shopReturn.id })
                )[0]
              : null;
          if (stockOutcome === "await_return" && !returnRow) {
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
            targetType: returnRow ? "shop_return" : "shop_order_line",
            targetId: returnRow ? returnRow.id : command.orderLineId,
            afterJson: {
              orderLineId: command.orderLineId,
              editionId: command.editionId,
              refundId: refund.id,
              amountPence: remaining,
              stock: stockOutcome === "restock_now" ? "restocked" : "awaiting_return",
            },
          });

          if (returnRow) {
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
          }

          let restocked = false;
          if (stockOutcome === "restock_now" && line.sellerPartyId) {
            const stock = await applyReturnedEditionStock(db, {
              editionId: command.editionId,
              orderId: order.id,
              orderLineId: command.orderLineId,
              sellerPartyId: line.sellerPartyId,
              disposition: "back_on_sale",
              now,
            });
            restocked = true;
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: "refund.write",
              action: "edition_back_on_sale",
              targetType: "shop_edition",
              targetId: command.editionId,
              afterJson: {
                orderId: order.id,
                orderLineId: command.orderLineId,
                listingStatus: stock.listingStatus,
                reason: "cancelled_in_gallery",
              },
            });
            if (stock.onSale) {
              await tx.events.append({
                aggregateType: "shop_edition",
                aggregateId: command.editionId,
                eventType: "shop.edition.released",
                payload: { schemaVersion: 1, orderId: order.id, editionId: command.editionId },
              });
            }
          }

          const [artwork] = await db
            .select({ title: shopArtwork.title })
            .from(shopEdition)
            .innerJoin(shopArtwork, eq(shopArtwork.id, shopEdition.artworkId))
            .where(eq(shopEdition.id, command.editionId))
            .limit(1);
          // One email per cancellation: the refund row is created with it, and a replay of the
          // same command returns the stored result before reaching this point.
          await tx.notifications.queueCancellationConfirmed(tx.session, {
            idempotencyKey: `cancellation-confirmed:${refund.id}`,
            identitySubjectId: order.identitySubjectId,
            fallbackEmail: null,
            orderId: order.id,
            orderReference: order.reference,
            artworkTitle: artwork?.title ?? "Your item",
            amountPence: remaining,
          });

          return {
            returnId: returnRow?.id ?? null,
            refundId: refund.id,
            status: restocked ? ("restocked" as const) : ("requested" as const),
          };
        },
      }),
    );
  };
}

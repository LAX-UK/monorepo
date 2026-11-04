import { shopOrderLine, shopReturn } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type ShopReturnDisposition,
  type ShopReturnStatus,
  canTransitionReturn,
  isShopReturnStatus,
} from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { notifySellerReturnClosed } from "./notify-seller-return-closed.js";
import { applyReturnedEditionStock } from "./returned-edition-stock.js";

export type AdvanceReturnCommand = {
  returnId: string;
  to: "in_transit" | "received";
  /** Required on receipt: whether the print goes back on sale or is withdrawn as damaged. */
  disposition?: ShopReturnDisposition;
  actorSubjectId: string;
  idempotencyKey: string;
  now?: Date;
};

export type AdvanceReturnResult = {
  returnId: string;
  status: ShopReturnStatus;
  /** On receipt: whether the print can be bought again now. */
  onSale?: boolean;
};

/**
 * Moves a return one step: requested to in transit, then in transit to received. Receiving is the
 * only moment stock changes: the print goes back on sale, or is withdrawn if it came back
 * damaged. Back on sale emits the release event that tells people waiting for the edition.
 */
export function createAdvanceReturnHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: AdvanceReturnCommand) => Promise<AdvanceReturnResult> {
  return async (command) => {
    const now = command.now ?? new Date();
    return deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: `return.${command.to}`,
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: {
          returnId: command.returnId,
          to: command.to,
          disposition: command.disposition ?? null,
        },
        run: async (): Promise<AdvanceReturnResult> => {
          if (command.to === "received" && !command.disposition) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.VALIDATION,
              "Say whether the print goes back on sale or is withdrawn as damaged",
              400,
            );
          }
          if (command.to !== "received" && command.disposition) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.VALIDATION,
              "Only a received return has a decision",
              400,
            );
          }
          const db = shopPhaseDbSession(tx);
          const [row] = await db
            .select({
              id: shopReturn.id,
              status: shopReturn.status,
              orderLineId: shopReturn.orderLineId,
              editionId: shopReturn.editionId,
            })
            .from(shopReturn)
            .where(eq(shopReturn.id, command.returnId))
            .for("update")
            .limit(1);
          if (!row) throw notFound("Return");
          if (!isShopReturnStatus(row.status) || !canTransitionReturn(row.status, command.to)) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              `A return that is ${row.status.replace("_", " ")} cannot be marked ${command.to.replace("_", " ")}`,
              409,
            );
          }

          if (command.to === "in_transit") {
            await db
              .update(shopReturn)
              .set({ status: "in_transit", updatedAt: now })
              .where(eq(shopReturn.id, row.id));
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: "fulfilment.write",
              action: "return_in_transit",
              targetType: "shop_return",
              targetId: row.id,
              afterJson: { orderLineId: row.orderLineId, editionId: row.editionId },
            });
            return { returnId: row.id, status: "in_transit" };
          }

          const disposition = command.disposition as ShopReturnDisposition;
          const [line] = await db
            .select({ orderId: shopOrderLine.orderId, sellerPartyId: shopOrderLine.sellerPartyId })
            .from(shopOrderLine)
            .where(eq(shopOrderLine.id, row.orderLineId))
            .limit(1);
          if (!line) throw notFound("Order line");
          if (!line.sellerPartyId) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "The line has no seller to return the print to",
              409,
            );
          }
          const stock = await applyReturnedEditionStock(db, {
            editionId: row.editionId,
            orderId: line.orderId,
            orderLineId: row.orderLineId,
            sellerPartyId: line.sellerPartyId,
            disposition,
            now,
          });
          await db
            .update(shopReturn)
            .set({ status: "received", disposition, receivedAt: now, updatedAt: now })
            .where(eq(shopReturn.id, row.id));
          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "fulfilment.write",
            action: "return_received",
            targetType: "shop_return",
            targetId: row.id,
            afterJson: {
              orderLineId: row.orderLineId,
              editionId: row.editionId,
              disposition,
              listingStatus: stock.listingStatus,
            },
          });
          if (stock.onSale) {
            await tx.events.append({
              aggregateType: "shop_edition",
              aggregateId: row.editionId,
              eventType: "shop.edition.released",
              payload: { schemaVersion: 1, orderId: line.orderId, editionId: row.editionId },
            });
          }
          await notifySellerReturnClosed(db, tx, {
            returnId: row.id,
            editionId: row.editionId,
            orderLineId: row.orderLineId,
            sellerPartyId: line.sellerPartyId,
            listingStatus: stock.listingStatus,
          });
          return { returnId: row.id, status: "received", onSale: stock.onSale };
        },
      }),
    );
  };
}

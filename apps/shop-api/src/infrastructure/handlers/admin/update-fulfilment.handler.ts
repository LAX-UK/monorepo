import { shopFulfilment } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  SHOP_FULFILMENT_STATUSES,
  type ShopFulfilmentStatus,
  canTransitionFulfilmentStatus,
} from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

function parseFulfilmentStatus(raw: string): ShopFulfilmentStatus {
  if ((SHOP_FULFILMENT_STATUSES as readonly string[]).includes(raw)) {
    return raw as ShopFulfilmentStatus;
  }
  throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Invalid fulfilment status", 400);
}
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";

export type UpdateFulfilmentCommand = {
  fulfilmentId: string;
  status: string;
  actorSubjectId: string;
  idempotencyKey: string;
  carrier?: string;
  trackingNumber?: string;
};

export function createUpdateFulfilmentHandler(deps: { uow: ShopUnitOfWorkFactory }) {
  return async (command: UpdateFulfilmentCommand) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "fulfilment.update",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const nextStatus = parseFulfilmentStatus(command.status);
          const [existing] = await shopPhaseDbSession(tx)
            .select({
              id: shopFulfilment.id,
              status: shopFulfilment.status,
              orderId: shopFulfilment.orderId,
            })
            .from(shopFulfilment)
            .where(eq(shopFulfilment.id, command.fulfilmentId))
            .for("update")
            .limit(1);
          if (!existing) throw notFound("Fulfilment");
          const currentStatus = existing.status as ShopFulfilmentStatus;
          if (!canTransitionFulfilmentStatus(currentStatus, nextStatus)) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              `Invalid fulfilment transition from ${currentStatus} to ${nextStatus}`,
              409,
            );
          }
          await shopPhaseDbSession(tx)
            .update(shopFulfilment)
            .set({
              status: nextStatus,
              ...(command.carrier !== undefined ? { carrier: command.carrier } : {}),
              ...(command.trackingNumber !== undefined
                ? { trackingNumber: command.trackingNumber }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(shopFulfilment.id, command.fulfilmentId));
          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "fulfilment.write",
            action: "update_fulfilment",
            targetType: "shop_fulfilment",
            targetId: command.fulfilmentId,
            afterJson: { status: nextStatus },
          });
          if (nextStatus === "in_transit") {
            await tx.events.append({
              aggregateType: "shop_fulfilment",
              aggregateId: command.fulfilmentId,
              eventType: "shop.fulfilment.dispatched",
              payload: {
                schemaVersion: 1,
                fulfilmentId: command.fulfilmentId,
                orderId: existing.orderId,
              },
            });
          }
          return { fulfilmentId: command.fulfilmentId, status: command.status };
        },
      }),
    );
}

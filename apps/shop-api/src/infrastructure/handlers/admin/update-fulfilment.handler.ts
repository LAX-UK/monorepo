import { shopArtwork, shopFulfilment, shopOrder, shopOrderLine } from "@auction/db/schema";
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

function buildTrackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!trackingNumber?.trim()) return null;
  const num = trackingNumber.trim();
  const c = carrier?.trim().toLowerCase() ?? "";
  if (c.includes("royal mail")) {
    return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(num)}`;
  }
  return null;
}

function fulfilmentSummary(
  status: string,
  carrier?: string | null,
  trackingNumber?: string | null,
): string {
  const parts = [`Status: ${status.replace(/_/g, " ")}`];
  if (carrier?.trim()) parts.push(`Carrier: ${carrier.trim()}`);
  if (trackingNumber?.trim()) parts.push(`Tracking: ${trackingNumber.trim()}`);
  return parts.join(" · ");
}

export function createUpdateFulfilmentHandler(deps: {
  uow: ShopUnitOfWorkFactory;
  storefrontUrl: string;
}) {
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
              carrier: shopFulfilment.carrier,
              trackingNumber: shopFulfilment.trackingNumber,
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

            const [orderRow] = await shopPhaseDbSession(tx)
              .select({ identitySubjectId: shopOrder.identitySubjectId })
              .from(shopOrder)
              .where(eq(shopOrder.id, existing.orderId))
              .limit(1);
            const [lineRow] = await shopPhaseDbSession(tx)
              .select({ title: shopArtwork.title })
              .from(shopOrderLine)
              .innerJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
              .where(eq(shopOrderLine.orderId, existing.orderId))
              .limit(1);
            const carrier =
              command.carrier !== undefined ? command.carrier : (existing.carrier ?? null);
            const trackingNumber =
              command.trackingNumber !== undefined
                ? command.trackingNumber
                : (existing.trackingNumber ?? null);
            if (orderRow?.identitySubjectId) {
              await tx.notifications.queueDispatchNotice(tx.session, {
                idempotencyKey: `dispatch:${command.fulfilmentId}:${command.idempotencyKey}`,
                identitySubjectId: orderRow.identitySubjectId,
                fallbackEmail: null,
                artworkTitle: lineRow?.title ?? "Your order",
                trackingUrl: buildTrackingUrl(carrier, trackingNumber),
                fulfilmentSummary: fulfilmentSummary(nextStatus, carrier, trackingNumber),
              });
            }
          }
          return { fulfilmentId: command.fulfilmentId, status: command.status };
        },
      }),
    );
}

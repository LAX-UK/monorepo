import type { Database } from "@auction/db";
import { shopFulfilment, shopOrder, shopOrderLine, shopPayoutLedger } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type CancellationPeriodPolicy,
  type ShopFulfilmentStatus,
  canTransitionFulfilmentStatus,
  computeCancellationPeriodEndsAt,
  computePayoutDueAt,
} from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type { FulfilmentWriter } from "../../application/ports/fulfilment.writer.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { insertShopAdminAudit } from "../shop-admin-audit.js";
import {
  POSSESSION_FULFILMENT_STATUSES,
  parseFulfilmentStatus,
  policyNotConfigured,
} from "./phase-writer-shared.js";

export function createDrizzleFulfilmentWriter(
  db: Database,
  policy: CancellationPeriodPolicy | null,
): FulfilmentWriter {
  return {
    async updateStatus(command) {
      const nextStatus = parseFulfilmentStatus(command.status);
      const possessionAt = command.possessionAt ? new Date(command.possessionAt) : null;
      if (possessionAt && policy === null) {
        policyNotConfigured("Possession and cancellation period");
      }
      if (possessionAt && !POSSESSION_FULFILMENT_STATUSES.includes(nextStatus)) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Possession requires fulfilment status delivered, collected, or in_storage",
          400,
        );
      }

      await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({
            id: shopFulfilment.id,
            orderId: shopFulfilment.orderId,
            option: shopFulfilment.option,
            status: shopFulfilment.status,
            possessionAt: shopFulfilment.possessionAt,
          })
          .from(shopFulfilment)
          .where(eq(shopFulfilment.id, command.fulfilmentId))
          .for("update")
          .limit(1);
        if (!existing) {
          throw notFound("Fulfilment");
        }
        const currentStatus = existing.status as ShopFulfilmentStatus;
        if (!canTransitionFulfilmentStatus(currentStatus, nextStatus)) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            `Invalid fulfilment transition from ${currentStatus} to ${nextStatus}`,
            409,
          );
        }
        if (possessionAt && existing.possessionAt) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Possession was already recorded for this fulfilment",
            409,
          );
        }

        await tx
          .update(shopFulfilment)
          .set({
            status: nextStatus,
            ...(command.carrier !== undefined ? { carrier: command.carrier } : {}),
            ...(command.trackingNumber !== undefined
              ? { trackingNumber: command.trackingNumber }
              : {}),
            ...(possessionAt ? { possessionAt } : {}),
            updatedAt: new Date(),
          })
          .where(eq(shopFulfilment.id, command.fulfilmentId));

        if (possessionAt && policy) {
          const period = computeCancellationPeriodEndsAt({
            fulfilmentOption: existing.option,
            possessionAt,
            policy,
            isPersonalisedGoods: false,
          });
          if (!period.ok) {
            policyNotConfigured("Cancellation period");
          }
          const lines = await tx
            .select({ id: shopOrderLine.id })
            .from(shopOrderLine)
            .where(eq(shopOrderLine.orderId, existing.orderId));
          for (const line of lines) {
            await tx
              .update(shopPayoutLedger)
              .set({
                cancellationPeriodEndsAt: period.endsAt,
                blockedReason: null,
              })
              .where(
                and(
                  eq(shopPayoutLedger.orderLineId, line.id),
                  eq(shopPayoutLedger.blockedReason, "pending_possession"),
                ),
              );
          }
          await tx
            .update(shopOrder)
            .set({
              refundPeriodEndsAt: period.endsAt,
              updatedAt: new Date(),
            })
            .where(eq(shopOrder.id, existing.orderId));
          if (period.endsAt) {
            for (const line of lines) {
              await tx
                .update(shopPayoutLedger)
                .set({ payoutDueAt: computePayoutDueAt(period.endsAt) })
                .where(eq(shopPayoutLedger.orderLineId, line.id));
            }
          }
          await insertShopAdminAudit(tx as Database, {
            actorSubjectId: command.actorSubjectId,
            capability: "fulfilment.write",
            action: "record_possession",
            targetType: "shop_fulfilment",
            targetId: command.fulfilmentId,
            afterJson: {
              status: nextStatus,
              possessionAt: possessionAt.toISOString(),
              orderId: existing.orderId,
            },
          });
        }
      });

      return { fulfilmentId: command.fulfilmentId, status: command.status };
    },
  };
}

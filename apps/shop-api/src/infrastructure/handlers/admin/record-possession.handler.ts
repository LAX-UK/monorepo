import { shopFulfilment, shopOrder, shopOrderLine, shopPayoutLedger } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type CancellationPeriodPolicy,
  SHOP_FULFILMENT_STATUSES,
  type ShopFulfilmentStatus,
  canTransitionFulfilmentStatus,
  computeCancellationPeriodEndsAt,
  computePayoutDueAt,
  validatePossessionTimestamp,
} from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

const POSSESSION_FULFILMENT_STATUSES: readonly ShopFulfilmentStatus[] = [
  "delivered",
  "collected",
  "in_storage",
];

function parseFulfilmentStatus(raw: string): ShopFulfilmentStatus {
  if ((SHOP_FULFILMENT_STATUSES as readonly string[]).includes(raw)) {
    return raw as ShopFulfilmentStatus;
  }
  throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Invalid fulfilment status", 400);
}

function policyNotConfigured(feature: string): never {
  throw new ShopApiError(
    SHOP_API_ERROR_CODES.POLICY_NOT_CONFIGURED,
    `${feature} is blocked until cancellation policy is configured`,
    501,
  );
}
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";

export type RecordPossessionCommand = {
  fulfilmentId: string;
  status: string;
  possessionAt: string;
  actorSubjectId: string;
  idempotencyKey: string;
  now?: Date;
};

export function createRecordPossessionHandler(deps: {
  uow: ShopUnitOfWorkFactory;
  policy: CancellationPeriodPolicy | null;
}) {
  return async (command: RecordPossessionCommand) => {
    if (deps.policy === null) {
      policyNotConfigured("Possession and cancellation period");
    }
    const policy = deps.policy;
    const now = command.now ?? new Date();
    return deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "fulfilment.record_possession",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const nextStatus = parseFulfilmentStatus(command.status);
          const possessionAt = new Date(command.possessionAt);
          if (!POSSESSION_FULFILMENT_STATUSES.includes(nextStatus)) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.VALIDATION,
              "Possession requires fulfilment status delivered, collected, or in_storage",
              400,
            );
          }
          const [existing] = await shopPhaseDbSession(tx)
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
          if (!existing) throw notFound("Fulfilment");
          if (existing.possessionAt) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Possession was already recorded for this fulfilment",
              409,
            );
          }
          const currentStatus = existing.status as ShopFulfilmentStatus;
          if (!canTransitionFulfilmentStatus(currentStatus, nextStatus)) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              `Invalid fulfilment transition from ${currentStatus} to ${nextStatus}`,
              409,
            );
          }
          const [order] = await shopPhaseDbSession(tx)
            .select({ paidAt: shopOrder.paidAt })
            .from(shopOrder)
            .where(eq(shopOrder.id, existing.orderId))
            .for("update")
            .limit(1);
          if (!order?.paidAt) {
            throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Order is not paid", 409);
          }
          const bounds = validatePossessionTimestamp({
            paidAt: order.paidAt,
            possessionAt,
            now,
          });
          if (!bounds.ok) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.VALIDATION,
              bounds.reason === "before_paid"
                ? "Possession cannot be before payment"
                : "Possession cannot be in the future",
              400,
            );
          }
          const period = computeCancellationPeriodEndsAt({
            fulfilmentOption: existing.option,
            possessionAt,
            policy: policy as CancellationPeriodPolicy,
            isPersonalisedGoods: false,
          });
          if (!period.ok) {
            policyNotConfigured("Cancellation period");
          }
          await shopPhaseDbSession(tx)
            .update(shopFulfilment)
            .set({ status: nextStatus, possessionAt, updatedAt: new Date() })
            .where(eq(shopFulfilment.id, command.fulfilmentId));
          const lines = await shopPhaseDbSession(tx)
            .select({ id: shopOrderLine.id })
            .from(shopOrderLine)
            .where(eq(shopOrderLine.orderId, existing.orderId));
          for (const line of lines) {
            await shopPhaseDbSession(tx)
              .update(shopPayoutLedger)
              .set({
                cancellationPeriodEndsAt: period.endsAt,
                blockedReason: null,
                ...(period.endsAt ? { payoutDueAt: computePayoutDueAt(period.endsAt) } : {}),
              })
              .where(
                and(
                  eq(shopPayoutLedger.orderLineId, line.id),
                  eq(shopPayoutLedger.blockedReason, "pending_possession"),
                ),
              );
          }
          await shopPhaseDbSession(tx)
            .update(shopOrder)
            .set({ refundPeriodEndsAt: period.endsAt, updatedAt: new Date() })
            .where(eq(shopOrder.id, existing.orderId));
          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "fulfilment.write",
            action: "record_possession",
            targetType: "shop_fulfilment",
            targetId: command.fulfilmentId,
            afterJson: {
              possessionAt: possessionAt.toISOString(),
              orderId: existing.orderId,
            },
          });
          await tx.events.append({
            aggregateType: "shop_fulfilment",
            aggregateId: command.fulfilmentId,
            eventType: "shop.possession.recorded",
            payload: {
              schemaVersion: 1,
              fulfilmentId: command.fulfilmentId,
              orderId: existing.orderId,
              possessionAt: possessionAt.toISOString(),
            },
          });
          return { fulfilmentId: command.fulfilmentId, status: command.status };
        },
      }),
    );
  };
}

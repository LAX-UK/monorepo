import type { Database } from "@auction/db";
import {
  shopClientAssignment,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopParty,
  shopPayoutLedger,
  shopProductionTask,
  shopRefund,
  shopSaleFee,
  shopStockHold,
  shopThirdPartySale,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type CancellationPeriodPolicy,
  SHOP_FULFILMENT_STATUSES,
  type ShopFulfilmentStatus,
  canTransitionFulfilmentStatus,
  computeCancellationPeriodEndsAt,
  computePayoutDueAt,
} from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type { FulfilmentWriter } from "../application/ports/fulfilment.writer.js";
import type { OriginalSaleWriter } from "../application/ports/original-sale.writer.js";
import type { PayoutWriter } from "../application/ports/payout.writer.js";
import type { ProductionWriter } from "../application/ports/production.writer.js";
import type { RefundWriter } from "../application/ports/refund.writer.js";
import type { SaleFeeWriter } from "../application/ports/sale-fee.writer.js";
import type { StockHoldWriter } from "../application/ports/stock-hold.writer.js";
import type { ThirdPartySaleWriter } from "../application/ports/third-party-sale.writer.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { notFound } from "../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../lib/pg-errors.js";
import { insertShopAdminAudit } from "./shop-admin-audit.js";

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

export function createDrizzleProductionWriter(db: Database): ProductionWriter {
  return {
    async createTask(command) {
      const [line] = await db
        .select({ id: shopOrderLine.id })
        .from(shopOrderLine)
        .where(eq(shopOrderLine.id, command.orderLineId))
        .limit(1);
      if (!line) {
        throw notFound("Order line");
      }
      const [task] = await db
        .insert(shopProductionTask)
        .values({
          orderLineId: command.orderLineId,
          editionId: command.editionId,
          status: "queued",
          assignedToSubjectId: command.actorSubjectId,
        })
        .returning({ id: shopProductionTask.id });
      if (!task) {
        throw new Error("Failed to create production task");
      }
      return { taskId: task.id, status: "queued" };
    },
  };
}

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

export function createDrizzleRefundWriter(db: Database): RefundWriter {
  return {
    async requestRefund(command) {
      return db.transaction(async (tx) => {
        const [order] = await tx
          .select({ id: shopOrder.id })
          .from(shopOrder)
          .where(eq(shopOrder.id, command.orderId))
          .limit(1);
        if (!order) {
          throw notFound("Order");
        }
        const [refund] = await tx
          .insert(shopRefund)
          .values({
            orderId: command.orderId,
            amountPence: command.amountPence,
            idempotencyKey: command.idempotencyKey,
            requestedBySubjectId: command.actorSubjectId,
            ...(command.orderLineId ? { orderLineId: command.orderLineId } : {}),
          })
          .onConflictDoNothing()
          .returning({ id: shopRefund.id, status: shopRefund.status });
        if (!refund) {
          const [existing] = await tx
            .select({ id: shopRefund.id, status: shopRefund.status })
            .from(shopRefund)
            .where(eq(shopRefund.idempotencyKey, command.idempotencyKey))
            .limit(1);
          if (!existing) {
            throw new Error("Failed to record refund");
          }
          return { refundId: existing.id, status: "pending" as const };
        }
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: command.actorSubjectId,
          capability: "refund.write",
          action: "request_refund",
          targetType: "shop_refund",
          targetId: refund.id,
          afterJson: {
            orderId: command.orderId,
            amountPence: command.amountPence,
            idempotencyKey: command.idempotencyKey,
          },
        });
        return { refundId: refund.id, status: "pending" as const };
      });
    },
  };
}

export function createDrizzleStockHoldWriter(db: Database): StockHoldWriter {
  return {
    async createHold(command) {
      const expiresAt = new Date(command.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Hold expiry must be in the future",
          400,
        );
      }

      try {
        return await db.transaction(async (tx) => {
          const [assignment] = await tx
            .select({ brokerSubjectId: shopClientAssignment.brokerSubjectId })
            .from(shopClientAssignment)
            .where(
              and(
                eq(shopClientAssignment.clientPartyId, command.clientPartyId),
                eq(shopClientAssignment.brokerSubjectId, command.actorSubjectId),
              ),
            )
            .limit(1);
          if (!assignment) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.FORBIDDEN,
              "Broker is not assigned to this client",
              403,
            );
          }
          const [brokerParty] = await tx
            .select({ id: shopParty.id })
            .from(shopParty)
            .where(eq(shopParty.identitySubjectId, command.actorSubjectId))
            .limit(1);
          if (!brokerParty) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.POLICY_NOT_CONFIGURED,
              "Broker party not found for acting subject",
              501,
            );
          }

          const [edition] = await tx
            .select({ id: shopEdition.id })
            .from(shopEdition)
            .where(eq(shopEdition.id, command.editionId))
            .for("update")
            .limit(1);
          if (!edition) {
            throw notFound("Edition");
          }

          const updated = await tx
            .update(shopEdition)
            .set({ listingStatus: "held" })
            .where(
              and(
                eq(shopEdition.id, command.editionId),
                eq(shopEdition.listingStatus, "authorised"),
              ),
            )
            .returning({ id: shopEdition.id });
          if (updated.length !== 1) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Edition is not available to hold",
              409,
            );
          }

          const [hold] = await tx
            .insert(shopStockHold)
            .values({
              editionId: command.editionId,
              brokerPartyId: brokerParty.id,
              clientPartyId: command.clientPartyId,
              expiresAt,
              createdBySubjectId: command.actorSubjectId,
              ...(command.note ? { note: command.note } : {}),
            })
            .returning({ id: shopStockHold.id });
          if (!hold) {
            throw new Error("Failed to create stock hold");
          }
          await insertShopAdminAudit(tx as Database, {
            actorSubjectId: command.actorSubjectId,
            capability: "stock_hold.write",
            action: "create_hold",
            targetType: "shop_stock_hold",
            targetId: hold.id,
            afterJson: {
              editionId: command.editionId,
              clientPartyId: command.clientPartyId,
              expiresAt: expiresAt.toISOString(),
            },
          });
          return { holdId: hold.id, status: "active" as const };
        });
      } catch (err) {
        if (isPgUniqueViolation(err)) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Edition already has an active hold",
            409,
          );
        }
        throw err;
      }
    },

    async releaseHold(command) {
      const releasedAt = new Date();
      return db.transaction(async (tx) => {
        const [hold] = await tx
          .select({
            id: shopStockHold.id,
            editionId: shopStockHold.editionId,
            status: shopStockHold.status,
          })
          .from(shopStockHold)
          .where(eq(shopStockHold.id, command.holdId))
          .for("update")
          .limit(1);
        if (!hold) {
          throw notFound("Stock hold");
        }
        if (hold.status !== "active") {
          throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Hold is not active", 409);
        }
        await tx
          .update(shopStockHold)
          .set({ status: "released", releasedAt })
          .where(eq(shopStockHold.id, command.holdId));
        await tx
          .update(shopEdition)
          .set({ listingStatus: "authorised" })
          .where(and(eq(shopEdition.id, hold.editionId), eq(shopEdition.listingStatus, "held")));
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: command.actorSubjectId,
          capability: "stock_hold.write",
          action: "release_hold",
          targetType: "shop_stock_hold",
          targetId: command.holdId,
          afterJson: { editionId: hold.editionId, status: "released" },
        });
        return { holdId: command.holdId, status: "released" as const };
      });
    },
  };
}

export function createDrizzleThirdPartySaleWriter(db: Database): ThirdPartySaleWriter {
  return {
    async recordSale(command) {
      const [sale] = await db
        .insert(shopThirdPartySale)
        .values({
          editionId: command.editionId,
          sellerPartyId: command.sellerPartyId,
          buyerPartyId: command.buyerPartyId,
          grossPence: command.grossPence,
          recordedBySubjectId: command.actorSubjectId,
          status: "draft",
        })
        .returning({ id: shopThirdPartySale.id });
      if (!sale) {
        throw new Error("Failed to record third-party sale");
      }
      return { saleId: sale.id, status: "draft" };
    },
  };
}

export function createDrizzlePayoutWriter(db: Database): PayoutWriter {
  return {
    async markPaid(command) {
      const paidAt = new Date();
      return db.transaction(async (tx) => {
        const updated = await tx
          .update(shopPayoutLedger)
          .set({
            status: "paid",
            paidAt,
            paidReference: command.paidReference,
            paidBySubjectId: command.actorSubjectId,
          })
          .where(and(eq(shopPayoutLedger.id, command.payoutId), eq(shopPayoutLedger.status, "due")))
          .returning({ id: shopPayoutLedger.id });
        if (updated.length !== 1) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Payout is not due or does not exist",
            409,
          );
        }
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: command.actorSubjectId,
          capability: "payout.mark_paid",
          action: "mark_payout_paid",
          targetType: "shop_payout_ledger",
          targetId: command.payoutId,
          afterJson: { paidReference: command.paidReference, paidAt: paidAt.toISOString() },
        });
        return { payoutId: command.payoutId, status: "paid" as const };
      });
    },
  };
}

export function createDrizzleSaleFeeWriter(db: Database): SaleFeeWriter {
  return {
    async approveFee(command) {
      const approvedAt = new Date();
      return db.transaction(async (tx) => {
        const updated = await tx
          .update(shopSaleFee)
          .set({
            status: "approved",
            approvedBySubjectId: command.actorSubjectId,
            approvedAt,
          })
          .where(and(eq(shopSaleFee.id, command.feeId), eq(shopSaleFee.status, "pending")))
          .returning({ id: shopSaleFee.id });
        if (updated.length !== 1) {
          throw notFound("Sale fee");
        }
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: command.actorSubjectId,
          capability: "fee.approve",
          action: "approve_sale_fee",
          targetType: "shop_sale_fee",
          targetId: command.feeId,
          afterJson: { status: "approved", approvedAt: approvedAt.toISOString() },
        });
        return { feeId: command.feeId, status: "approved" as const };
      });
    },
  };
}

export function createDrizzleOriginalSaleWriter(db: Database): OriginalSaleWriter {
  return {
    async createReservation(command) {
      const [row] = await db
        .insert(shopOriginalSale)
        .values({
          artworkId: command.artworkId,
          buyerPartyId: command.buyerPartyId,
          salePricePence: command.salePricePence,
          recordedBySubjectId: command.actorSubjectId,
          status: "reserved",
          ...(command.reservationExpiresAt
            ? { reservationExpiresAt: new Date(command.reservationExpiresAt) }
            : {}),
        })
        .returning({ id: shopOriginalSale.id });
      if (!row) {
        throw new Error("Failed to create original sale reservation");
      }
      return { originalSaleId: row.id, status: "reserved" };
    },
  };
}

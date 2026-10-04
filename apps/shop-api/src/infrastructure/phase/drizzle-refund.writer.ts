import type { Database } from "@auction/db";
import { shopOrder, shopRefund } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { RefundWriter } from "../../application/ports/refund.writer.js";
import { notFound } from "../../errors/shop-api-error.js";
import { insertShopAdminAudit } from "../shop-admin-audit.js";

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

import type { Database } from "@auction/db";
import { shopSaleFee } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { SaleFeeWriter } from "../../application/ports/sale-fee.writer.js";
import { notFound } from "../../errors/shop-api-error.js";
import { insertShopAdminAudit } from "../shop-admin-audit.js";

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

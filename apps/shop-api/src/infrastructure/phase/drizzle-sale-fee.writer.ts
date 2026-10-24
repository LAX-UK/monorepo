import type { Database } from "@auction/db";
import { shopSaleFee } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { assertSaleFeeCanBeApproved } from "../../application/admin/sale-rules.js";
import type { SaleFeeWriter } from "../../application/ports/sale-fee.writer.js";
import { notFound } from "../../errors/shop-api-error.js";
import { insertShopAdminAudit } from "../shop-admin-audit.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";

export function createDrizzleSaleFeeWriter(
  db: Database,
  domainEventMode: ShopDomainEventPublisherMode = "off",
): SaleFeeWriter {
  const events = createShopDomainEventPublisher(domainEventMode);

  return {
    async approveFee(command) {
      const approvedAt = new Date();
      return db.transaction(async (tx) => {
        const [fee] = await tx
          .select({
            status: shopSaleFee.status,
            createdBySubjectId: shopSaleFee.createdBySubjectId,
          })
          .from(shopSaleFee)
          .where(eq(shopSaleFee.id, command.feeId))
          .for("update")
          .limit(1);
        if (!fee) {
          throw notFound("Sale fee");
        }
        assertSaleFeeCanBeApproved({ ...fee, actorSubjectId: command.actorSubjectId });
        await tx
          .update(shopSaleFee)
          .set({
            status: "approved",
            approvedBySubjectId: command.actorSubjectId,
            approvedAt,
          })
          .where(eq(shopSaleFee.id, command.feeId));
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: command.actorSubjectId,
          capability: "fee.approve",
          action: "approve_sale_fee",
          targetType: "shop_sale_fee",
          targetId: command.feeId,
          beforeJson: { status: "pending" },
          afterJson: { status: "approved", approvedAt: approvedAt.toISOString() },
        });
        await events.insertInTransaction(tx as Database, {
          aggregateType: "shop_sale_fee",
          aggregateId: command.feeId,
          eventType: "shop.sale_fee.approved",
          producer: "shop-api",
          payload: { schemaVersion: 1, feeId: command.feeId },
        });
        return { feeId: command.feeId, status: "approved" as const };
      });
    },
  };
}

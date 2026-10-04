import type { Database } from "@auction/db";
import { shopPayoutLedger } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import type { PayoutWriter } from "../../application/ports/payout.writer.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { insertShopAdminAudit } from "../shop-admin-audit.js";

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

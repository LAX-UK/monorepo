import type { Database } from "@auction/db";
import { shopThirdPartySale } from "@auction/db/schema";
import type { ThirdPartySaleWriter } from "../../application/ports/third-party-sale.writer.js";

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

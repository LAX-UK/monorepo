import type { Database } from "@auction/db";
import { shopOriginalSale } from "@auction/db/schema";
import type { OriginalSaleWriter } from "../../application/ports/original-sale.writer.js";

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

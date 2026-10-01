import type { Database } from "@auction/db";
import { shopEdition, shopOrderLine } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import { ShopApiError } from "../errors/shop-api-error.js";
import type { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";
import { sellableEditionCondition } from "./shop-edition-availability.js";

export async function reserveEditionsForCheckoutOrder(
  tx: Database,
  input: {
    orderId: string;
    reservedUntil: Date;
    expandedLines: Array<{ artworkId: string; unitPricePence: number }>;
  },
  events: ReturnType<typeof createShopDomainEventPublisher>,
): Promise<void> {
  for (const line of input.expandedLines) {
    const picked = await tx
      .select({
        id: shopEdition.id,
        ownerPartyId: shopEdition.ownerPartyId,
        editionNumber: shopEdition.editionNumber,
      })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, line.artworkId), sellableEditionCondition()))
      .orderBy(shopEdition.saleAuthorisedAt, shopEdition.editionNumber)
      .limit(1)
      .for("update", { skipLocked: true });
    const edition = picked[0];
    if (!edition?.ownerPartyId) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Edition unavailable", 409);
    }
    await tx
      .update(shopEdition)
      .set({
        listingStatus: "reserved",
        reservedUntil: input.reservedUntil,
        reservedByOrderId: input.orderId,
      })
      .where(eq(shopEdition.id, edition.id));
    await tx.insert(shopOrderLine).values({
      orderId: input.orderId,
      editionId: edition.id,
      artworkId: line.artworkId,
      sellerPartyId: edition.ownerPartyId,
      editionNumber: edition.editionNumber,
      unitPricePence: line.unitPricePence,
    });
    await events.insertInTransaction(tx, {
      aggregateType: "shop_edition",
      aggregateId: edition.id,
      eventType: "shop.edition.reserved",
      producer: "shop-api",
      payload: {
        schemaVersion: 1,
        orderId: input.orderId,
        artworkId: line.artworkId,
        editionNumber: edition.editionNumber,
      },
    });
  }
}

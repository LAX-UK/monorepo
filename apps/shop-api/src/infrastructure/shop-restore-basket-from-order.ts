import type { Database } from "@auction/db";
import { shopBasketLine, shopOrderLine } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { BasketOwner } from "../application/ports/commerce.ports.js";
import { ensureOpenBasket } from "./shop-basket.persistence.js";
import { sellableCountsByArtworkIds } from "./shop-edition-availability.js";
import { sellableCountsByVariantIds } from "./shop-variant-availability.js";

type OrderHeader = {
  identitySubjectId: string;
};

/** Returns cancelled checkout lines to the buyer's active basket after reservations are released. */
export async function restoreBasketLinesFromOrder(
  tx: Database,
  order: OrderHeader,
  orderId: string,
): Promise<void> {
  const lines = await tx
    .select({
      artworkId: shopOrderLine.artworkId,
      productVariantId: shopOrderLine.productVariantId,
      unitPricePence: shopOrderLine.unitPricePence,
    })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.orderId, orderId));

  if (lines.length === 0) {
    return;
  }

  const quantityByArtwork = new Map<string, { quantity: number; unitPricePence: number }>();
  const quantityByVariant = new Map<string, { quantity: number; unitPricePence: number }>();
  for (const line of lines) {
    if (line.artworkId) {
      const existing = quantityByArtwork.get(line.artworkId);
      if (existing) {
        existing.quantity += 1;
      } else {
        quantityByArtwork.set(line.artworkId, {
          quantity: 1,
          unitPricePence: line.unitPricePence,
        });
      }
      continue;
    }
    if (line.productVariantId) {
      const existing = quantityByVariant.get(line.productVariantId);
      if (existing) {
        existing.quantity += 1;
      } else {
        quantityByVariant.set(line.productVariantId, {
          quantity: 1,
          unitPricePence: line.unitPricePence,
        });
      }
    }
  }

  const owner: BasketOwner = { kind: "subject", identitySubjectId: order.identitySubjectId };
  const basketId = await ensureOpenBasket(tx, owner);
  const artworkIds = [...quantityByArtwork.keys()];
  const variantIds = [...quantityByVariant.keys()];
  const [sellableByArtwork, sellableByVariant] = await Promise.all([
    sellableCountsByArtworkIds(tx, artworkIds),
    sellableCountsByVariantIds(tx, variantIds),
  ]);

  for (const [artworkId, { quantity, unitPricePence }] of quantityByArtwork) {
    const sellable = sellableByArtwork.get(artworkId) ?? 0;
    if (sellable < 1) {
      continue;
    }
    const restoreQuantity = Math.min(quantity, sellable);
    const [existingLine] = await tx
      .select({ quantity: shopBasketLine.quantity })
      .from(shopBasketLine)
      .where(and(eq(shopBasketLine.basketId, basketId), eq(shopBasketLine.artworkId, artworkId)))
      .limit(1);
    const mergedQuantity = Math.min((existingLine?.quantity ?? 0) + restoreQuantity, sellable);
    if (mergedQuantity < 1) {
      continue;
    }
    if (existingLine) {
      await tx
        .update(shopBasketLine)
        .set({
          quantity: mergedQuantity,
          unitPricePence,
          updatedAt: new Date(),
        })
        .where(and(eq(shopBasketLine.basketId, basketId), eq(shopBasketLine.artworkId, artworkId)));
    } else {
      await tx.insert(shopBasketLine).values({
        basketId,
        artworkId,
        unitPricePence,
        quantity: mergedQuantity,
      });
    }
  }

  for (const [productVariantId, { quantity, unitPricePence }] of quantityByVariant) {
    const sellable = sellableByVariant.get(productVariantId) ?? 0;
    if (sellable < 1) {
      continue;
    }
    const restoreQuantity = Math.min(quantity, sellable);
    const [existingLine] = await tx
      .select({ quantity: shopBasketLine.quantity })
      .from(shopBasketLine)
      .where(
        and(
          eq(shopBasketLine.basketId, basketId),
          eq(shopBasketLine.productVariantId, productVariantId),
        ),
      )
      .limit(1);
    const mergedQuantity = Math.min((existingLine?.quantity ?? 0) + restoreQuantity, sellable);
    if (mergedQuantity < 1) {
      continue;
    }
    if (existingLine) {
      await tx
        .update(shopBasketLine)
        .set({
          quantity: mergedQuantity,
          unitPricePence,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shopBasketLine.basketId, basketId),
            eq(shopBasketLine.productVariantId, productVariantId),
          ),
        );
    } else {
      await tx.insert(shopBasketLine).values({
        basketId,
        productVariantId,
        unitPricePence,
        quantity: mergedQuantity,
      });
    }
  }
}

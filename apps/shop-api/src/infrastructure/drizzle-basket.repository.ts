import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopBasket,
  shopBasketLine,
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, gt, sql } from "drizzle-orm";
import type {
  BasketRepository,
  UpsertBasketLineInput,
} from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  assertBasketStock,
  ensureOpenBasket,
  loadBasketRecord,
  ownerWhere,
  repriceBasketLinesIfNeeded,
} from "./shop-basket.persistence.js";
import { sellableCountsByArtworkIds } from "./shop-edition-availability.js";
import { sellableCountsByVariantIds } from "./shop-variant-availability.js";

export function createDrizzleBasketRepository(
  db: Database,
  options: { merchandiseEnabled: boolean },
): BasketRepository {
  return {
    async getBasket(owner) {
      const row = await db
        .select({ id: shopBasket.id })
        .from(shopBasket)
        .where(ownerWhere(owner))
        .limit(1);
      if (!row[0]) return null;
      return loadBasketRecord(db, row[0].id);
    },

    async addOrUpdateLine(input: UpsertBasketLineInput) {
      if (!Number.isInteger(input.quantity) || input.quantity < 1) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Invalid quantity", 400);
      }
      if ("artworkSlug" in input) {
        return upsertArtworkLine(db, input);
      }
      if (!options.merchandiseEnabled) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FEATURE_DISABLED,
          "Merchandise is disabled",
          404,
        );
      }
      return upsertVariantLine(db, input);
    },

    async removeLine({ owner, lineId }) {
      const row = await db
        .select({ id: shopBasket.id })
        .from(shopBasket)
        .where(ownerWhere(owner))
        .limit(1);
      if (!row[0]) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Basket not found", 404);
      }
      await db
        .delete(shopBasketLine)
        .where(and(eq(shopBasketLine.basketId, row[0].id), eq(shopBasketLine.id, lineId)));
      return loadBasketRecord(db, row[0].id);
    },

    async mergeBaskets({ from, to }) {
      if (from.kind === "subject" && from.identitySubjectId !== to.identitySubjectId) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.BASKET_CONFLICT,
          "Basket subject mismatch",
          409,
        );
      }
      return db.transaction(async (tx) => {
        const dbTx = tx as Database;
        const fromBasket = await dbTx
          .select({ id: shopBasket.id })
          .from(shopBasket)
          .where(ownerWhere(from))
          .limit(1);
        if (!fromBasket[0]) {
          const id = await ensureOpenBasket(dbTx, to);
          return loadBasketRecord(dbTx, id);
        }
        const toBasketId = await ensureOpenBasket(dbTx, to);
        await dbTx.select().from(shopBasket).where(eq(shopBasket.id, toBasketId)).for("update");
        const fromLines = await dbTx
          .select()
          .from(shopBasketLine)
          .where(eq(shopBasketLine.basketId, fromBasket[0].id));
        for (const line of fromLines) {
          if (line.artworkId) {
            await dbTx
              .insert(shopBasketLine)
              .values({
                basketId: toBasketId,
                artworkId: line.artworkId,
                unitPricePence: line.unitPricePence,
                quantity: line.quantity,
              })
              .onConflictDoUpdate({
                target: [shopBasketLine.basketId, shopBasketLine.artworkId],
                targetWhere: sql`${shopBasketLine.artworkId} IS NOT NULL`,
                set: {
                  quantity: sql`${shopBasketLine.quantity} + ${line.quantity}`,
                  updatedAt: new Date(),
                },
              });
          } else if (line.productVariantId) {
            await dbTx
              .insert(shopBasketLine)
              .values({
                basketId: toBasketId,
                productVariantId: line.productVariantId,
                unitPricePence: line.unitPricePence,
                quantity: line.quantity,
              })
              .onConflictDoUpdate({
                target: [shopBasketLine.basketId, shopBasketLine.productVariantId],
                targetWhere: sql`${shopBasketLine.productVariantId} IS NOT NULL`,
                set: {
                  quantity: sql`${shopBasketLine.quantity} + ${line.quantity}`,
                  updatedAt: new Date(),
                },
              });
          }
        }
        await dbTx
          .update(shopBasket)
          .set({ retiredAt: new Date(), updatedAt: new Date() })
          .where(eq(shopBasket.id, fromBasket[0].id));
        const repriced = await repriceBasketLinesIfNeeded(dbTx, toBasketId);
        if (repriced) {
          throw new ShopApiError(SHOP_API_ERROR_CODES.PRICE_CHANGED, "Basket price changed", 409);
        }
        await assertBasketStock(dbTx, toBasketId);
        return loadBasketRecord(dbTx, toBasketId);
      });
    },
  };
}

async function upsertArtworkLine(
  db: Database,
  input: { owner: UpsertBasketLineInput["owner"]; artworkSlug: string; quantity: number },
) {
  const [artwork] = await db
    .select({
      id: shopArtwork.id,
      printPricePence: shopArtwork.printPricePence,
      eligible: shopArtwork.eligibleForEditionAllocation,
    })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, input.artworkSlug))
    .limit(1);
  if (!artwork?.eligible) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Artwork not purchasable", 404);
  }
  if (artwork.printPricePence === null) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Artwork has no listed price", 400);
  }
  const unitPricePence = artwork.printPricePence;
  return db.transaction(async (tx) => {
    const basketId = await ensureOpenBasket(tx as Database, input.owner);
    await tx.select().from(shopBasket).where(eq(shopBasket.id, basketId)).for("update");
    const sellableByArtwork = await sellableCountsByArtworkIds(tx as Database, [artwork.id]);
    const sellable = sellableByArtwork.get(artwork.id) ?? 0;
    if (input.quantity > sellable) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Insufficient stock", 409);
    }
    await tx
      .insert(shopBasketLine)
      .values({
        basketId,
        artworkId: artwork.id,
        unitPricePence,
        quantity: input.quantity,
      })
      .onConflictDoUpdate({
        target: [shopBasketLine.basketId, shopBasketLine.artworkId],
        targetWhere: sql`${shopBasketLine.artworkId} IS NOT NULL`,
        set: { quantity: input.quantity, unitPricePence, updatedAt: new Date() },
      });
    return loadBasketRecord(tx as Database, basketId);
  });
}

async function upsertVariantLine(
  db: Database,
  input: { owner: UpsertBasketLineInput["owner"]; productVariantId: string; quantity: number },
) {
  const availableStock = sql`${shopProductVariant.onHand} - ${shopProductVariant.reserved}`;
  const [variant] = await db
    .select({
      id: shopProductVariant.id,
      pricePence: shopProductVariant.pricePence,
    })
    .from(shopProductVariant)
    .innerJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
    .where(and(eq(shopProductVariant.id, input.productVariantId), gt(availableStock, 0)))
    .limit(1);
  if (!variant) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Product variant not purchasable", 404);
  }
  const unitPricePence = variant.pricePence;
  return db.transaction(async (tx) => {
    const basketId = await ensureOpenBasket(tx as Database, input.owner);
    await tx.select().from(shopBasket).where(eq(shopBasket.id, basketId)).for("update");
    const sellableByVariant = await sellableCountsByVariantIds(tx as Database, [variant.id]);
    const sellable = sellableByVariant.get(variant.id) ?? 0;
    if (input.quantity > sellable) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Insufficient stock", 409);
    }
    await tx
      .insert(shopBasketLine)
      .values({
        basketId,
        productVariantId: variant.id,
        unitPricePence,
        quantity: input.quantity,
      })
      .onConflictDoUpdate({
        target: [shopBasketLine.basketId, shopBasketLine.productVariantId],
        targetWhere: sql`${shopBasketLine.productVariantId} IS NOT NULL`,
        set: { quantity: input.quantity, unitPricePence, updatedAt: new Date() },
      });
    return loadBasketRecord(tx as Database, basketId);
  });
}

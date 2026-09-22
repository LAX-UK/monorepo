import type { Database } from "@auction/db";
import { shopArtwork, shopBasket, shopBasketLine } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, sql } from "drizzle-orm";
import type { BasketRepository } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  assertBasketStock,
  ensureOpenBasket,
  loadBasketRecord,
  ownerWhere,
  repriceBasketLinesIfNeeded,
} from "./shop-basket.persistence.js";
import { sellableCountsByArtworkIds } from "./shop-edition-availability.js";

export function createDrizzleBasketRepository(db: Database): BasketRepository {
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

    async addOrUpdateLine({ owner, artworkSlug, quantity }) {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Invalid quantity", 400);
      }
      const [artwork] = await db
        .select({
          id: shopArtwork.id,
          printPricePence: shopArtwork.printPricePence,
          eligible: shopArtwork.eligibleForEditionAllocation,
        })
        .from(shopArtwork)
        .where(eq(shopArtwork.slug, artworkSlug))
        .limit(1);
      if (!artwork?.eligible) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Artwork not purchasable", 404);
      }
      if (artwork.printPricePence === null) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Artwork has no listed price", 400);
      }
      const unitPricePence = artwork.printPricePence;
      return db.transaction(async (tx) => {
        const basketId = await ensureOpenBasket(tx as Database, owner);
        await tx.select().from(shopBasket).where(eq(shopBasket.id, basketId)).for("update");
        const sellableByArtwork = await sellableCountsByArtworkIds(tx as Database, [artwork.id]);
        const sellable = sellableByArtwork.get(artwork.id) ?? 0;
        if (quantity > sellable) {
          throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Insufficient stock", 409);
        }
        await tx
          .insert(shopBasketLine)
          .values({
            basketId,
            artworkId: artwork.id,
            unitPricePence,
            quantity,
          })
          .onConflictDoUpdate({
            target: [shopBasketLine.basketId, shopBasketLine.artworkId],
            set: { quantity, unitPricePence, updatedAt: new Date() },
          });
        return loadBasketRecord(tx as Database, basketId);
      });
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
              set: {
                quantity: sql`${shopBasketLine.quantity} + ${line.quantity}`,
                updatedAt: new Date(),
              },
            });
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

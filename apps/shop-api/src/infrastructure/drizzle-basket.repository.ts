import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopBasket,
  shopBasketLine,
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  FRAMING_CHOICE_MESSAGES,
  framingChoiceProblem,
} from "../application/framing/edition-framing.view.js";
import type {
  BasketRepository,
  UpsertBasketLineInput,
} from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";
import { createDrizzleEditionFramingReader } from "./framing/drizzle-edition-framing.store.js";
import {
  assertBasketStock,
  ensureOpenBasket,
  loadBasketRecord,
  ownerWhere,
  reconcileFramingPrices,
  repriceBasketLinesIfNeeded,
} from "./shop-basket.persistence.js";
import { sellableCountsByArtworkIds } from "./shop-edition-availability.js";
import { sellableCountsByVariantIds } from "./shop-variant-availability.js";

export function createDrizzleBasketRepository(
  db: Database,
  options: {
    merchandiseEnabled: boolean;
    /** Copies of one edition an order may hold; null or absent leaves only the stock. */
    editionOrderLimit?: number | null;
    /** SHOP_FRAMING_ENABLED: while off, no framing is taken and none is asked for. */
    framingEnabled?: boolean;
  },
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
        return upsertArtworkLine(db, {
          ...input,
          editionOrderLimit: options.editionOrderLimit ?? null,
          framingEnabled: options.framingEnabled ?? false,
        });
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

    async setLineFraming({ owner, lineId, framingOptionId }) {
      if (!options.framingEnabled) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FEATURE_DISABLED,
          "Framing is not available",
          404,
        );
      }
      const basket = await db
        .select({ id: shopBasket.id })
        .from(shopBasket)
        .where(ownerWhere(owner))
        .limit(1);
      if (!basket[0]) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Basket not found", 404);
      }
      const basketId = basket[0].id;
      const [line] = await db
        .select({ artworkId: shopBasketLine.artworkId })
        .from(shopBasketLine)
        .where(and(eq(shopBasketLine.basketId, basketId), eq(shopBasketLine.id, lineId)))
        .limit(1);
      if (!line?.artworkId) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Basket line not found", 404);
      }
      await assertFramingChoice(db, line.artworkId, framingOptionId);
      await db
        .update(shopBasketLine)
        // A new choice is shown at today's price, which is stamped on the line.
        .set({ framingOptionId, framingPricePence: null, updatedAt: new Date() })
        .where(and(eq(shopBasketLine.basketId, basketId), eq(shopBasketLine.id, lineId)));
      await reconcileFramingPrices(db, basketId);
      return loadBasketRecord(db, basketId);
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
                framingOptionId: line.framingOptionId,
                framingPricePence: line.framingPricePence,
              })
              .onConflictDoUpdate({
                target: [shopBasketLine.basketId, shopBasketLine.artworkId],
                targetWhere: sql`${shopBasketLine.artworkId} IS NOT NULL`,
                set: {
                  quantity: sql`GREATEST(${shopBasketLine.quantity}, ${line.quantity})`,
                  // The signed-in basket's own choice wins; otherwise the one made as a guest.
                  framingOptionId: sql`COALESCE(${shopBasketLine.framingOptionId}, ${line.framingOptionId})`,
                  framingPricePence: sql`CASE WHEN ${shopBasketLine.framingOptionId} IS NULL THEN ${line.framingPricePence} ELSE ${shopBasketLine.framingPricePence} END`,
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
                  quantity: sql`GREATEST(${shopBasketLine.quantity}, ${line.quantity})`,
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
  input: {
    owner: UpsertBasketLineInput["owner"];
    artworkSlug: string;
    quantity: number;
    editionOrderLimit: number | null;
    framingOptionId?: string | null | undefined;
    framingEnabled: boolean;
  },
) {
  const [artwork] = await db
    .select({
      id: shopArtwork.id,
      printPricePence: shopArtwork.printPricePence,
      eligible: shopArtwork.eligibleForEditionAllocation,
    })
    .from(shopArtwork)
    .where(and(eq(shopArtwork.slug, input.artworkSlug), publicArtworkVisible()))
    .limit(1);
  if (!artwork?.eligible) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Artwork not purchasable", 404);
  }
  if (artwork.printPricePence === null) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Artwork has no listed price", 400);
  }
  if (input.editionOrderLimit != null && input.quantity > input.editionOrderLimit) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.QUANTITY_LIMIT,
      `Limit ${input.editionOrderLimit} per order`,
      409,
    );
  }
  const unitPricePence = artwork.printPricePence;
  const chosen = input.framingOptionId;
  if (chosen != null && !input.framingEnabled) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FEATURE_DISABLED, "Framing is not available", 404);
  }
  return db.transaction(async (tx) => {
    const basketId = await ensureOpenBasket(tx as Database, input.owner);
    await tx.select().from(shopBasket).where(eq(shopBasket.id, basketId)).for("update");
    const sellableByArtwork = await sellableCountsByArtworkIds(tx as Database, [artwork.id]);
    const sellable = sellableByArtwork.get(artwork.id) ?? 0;
    if (input.quantity > sellable) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Insufficient stock", 409);
    }
    // Without a choice in the request the line keeps the framing it has, checked or not: a frame
    // paused since is flagged in the basket and the shopper chooses again there, so a quantity
    // change is never refused for it. Only a choice the request makes, or a new line, is checked.
    let framingOptionId: string | null = null;
    if (input.framingEnabled) {
      if (chosen !== undefined) {
        framingOptionId = chosen;
        await assertFramingChoice(tx as Database, artwork.id, framingOptionId);
      } else {
        const [existing] = await tx
          .select({ framingOptionId: shopBasketLine.framingOptionId })
          .from(shopBasketLine)
          .where(
            and(eq(shopBasketLine.basketId, basketId), eq(shopBasketLine.artworkId, artwork.id)),
          )
          .limit(1);
        framingOptionId = existing?.framingOptionId ?? null;
        // A new line must satisfy the edition's rule (a framed-only edition needs a frame).
        if (!existing) await assertFramingChoice(tx as Database, artwork.id, null);
      }
    }
    await tx
      .insert(shopBasketLine)
      .values({
        basketId,
        artworkId: artwork.id,
        unitPricePence,
        quantity: input.quantity,
        framingOptionId,
        framingPricePence: null,
      })
      .onConflictDoUpdate({
        target: [shopBasketLine.basketId, shopBasketLine.artworkId],
        targetWhere: sql`${shopBasketLine.artworkId} IS NOT NULL`,
        set: {
          quantity: input.quantity,
          unitPricePence,
          ...(input.framingEnabled ? { framingOptionId } : {}),
          // A choice made in this request is stamped at today's price; a kept one keeps its stamp.
          ...(input.framingEnabled && chosen !== undefined ? { framingPricePence: null } : {}),
          updatedAt: new Date(),
        },
      });
    if (input.framingEnabled) await reconcileFramingPrices(tx as Database, basketId);
    return loadBasketRecord(tx as Database, basketId);
  });
}

/**
 * Refuses a framing choice the shopper could not have made on the edition's page: an option that
 * is not shown, or no option at all on an edition sold framed only.
 */
async function assertFramingChoice(
  db: Database,
  artworkId: string,
  framingOptionId: string | null,
): Promise<void> {
  const facts = (await createDrizzleEditionFramingReader(db).read([artworkId])).get(artworkId);
  if (!facts) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Artwork not purchasable", 404);
  }
  const problem = framingChoiceProblem(facts, framingOptionId);
  if (problem) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, FRAMING_CHOICE_MESSAGES[problem], 400);
  }
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
    .where(
      and(
        eq(shopProductVariant.id, input.productVariantId),
        isNull(shopProductVariant.archivedAt),
        isNull(shopProduct.archivedAt),
        gt(availableStock, 0),
      ),
    )
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

import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopBasket,
  shopBasketLine,
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { BasketOwner, BasketRecord } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../lib/pg-errors.js";
import { sellableCountsByArtworkIds } from "./shop-edition-availability.js";
import { sellableCountsByVariantIds } from "./shop-variant-availability.js";

export const BASKET_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function assertStorefrontRedirectUrl(url: string, storefrontUrl: string): void {
  const allowedOrigin = storefrontUrl.replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Invalid redirect URL", 400);
  }
  const origin = `${parsed.protocol}//${parsed.host}`;
  if (origin !== allowedOrigin) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "Redirect URL must stay on the storefront",
      400,
    );
  }
}

export async function repriceBasketLinesIfNeeded(db: Database, basketId: string): Promise<boolean> {
  const now = new Date();
  const artworkUpdated = await db.execute(sql`
    UPDATE shop_basket_line AS bl
    SET unit_price_pence = a.print_price_pence, updated_at = ${now}
    FROM shop_artwork AS a
    WHERE bl.artwork_id = a.id
      AND bl.basket_id = ${basketId}
      AND a.print_price_pence IS NOT NULL
      AND bl.unit_price_pence IS DISTINCT FROM a.print_price_pence
  `);
  const variantUpdated = await db.execute(sql`
    UPDATE shop_basket_line AS bl
    SET unit_price_pence = v.price_pence, updated_at = ${now}
    FROM shop_product_variant AS v
    WHERE bl.product_variant_id = v.id
      AND bl.basket_id = ${basketId}
      AND bl.unit_price_pence IS DISTINCT FROM v.price_pence
  `);
  const artworkRows =
    typeof artworkUpdated === "object" && artworkUpdated !== null && "rowCount" in artworkUpdated
      ? Number(artworkUpdated.rowCount)
      : 0;
  const variantRows =
    typeof variantUpdated === "object" && variantUpdated !== null && "rowCount" in variantUpdated
      ? Number(variantUpdated.rowCount)
      : 0;
  return artworkRows + variantRows > 0;
}

export async function assertBasketStock(db: Database, basketId: string): Promise<void> {
  const basket = await loadBasketRecord(db, basketId);
  for (const line of basket.lines) {
    if (line.quantity > line.sellableCount) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Insufficient stock", 409);
    }
  }
}

export function ownerWhere(owner: BasketOwner) {
  if (owner.kind === "anonymous") {
    return and(eq(shopBasket.anonymousTokenHash, owner.tokenHash), isNull(shopBasket.retiredAt));
  }
  return and(
    eq(shopBasket.identitySubjectId, owner.identitySubjectId),
    isNull(shopBasket.retiredAt),
  );
}

export async function loadBasketRecord(db: Database, basketId: string): Promise<BasketRecord> {
  const [header] = await db.select().from(shopBasket).where(eq(shopBasket.id, basketId)).limit(1);
  if (!header) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Basket not found", 404);
  }
  if (header.retiredAt !== null) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Basket not found", 404);
  }
  if (header.expiresAt < new Date()) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.BASKET_CONFLICT, "Basket expired", 409);
  }
  const lines = await db
    .select({
      lineId: shopBasketLine.id,
      artworkId: shopBasketLine.artworkId,
      productVariantId: shopBasketLine.productVariantId,
      artworkSlug: shopArtwork.slug,
      artworkTitle: shopArtwork.title,
      primaryImageUrl: shopArtwork.primaryImageUrl,
      productSlug: shopProduct.slug,
      productTitle: shopProduct.title,
      variantSku: shopProductVariant.sku,
      unitPricePence: shopBasketLine.unitPricePence,
      liveArtworkPricePence: shopArtwork.printPricePence,
      liveVariantPricePence: shopProductVariant.pricePence,
      quantity: shopBasketLine.quantity,
    })
    .from(shopBasketLine)
    .leftJoin(shopArtwork, eq(shopBasketLine.artworkId, shopArtwork.id))
    .leftJoin(shopProductVariant, eq(shopBasketLine.productVariantId, shopProductVariant.id))
    .leftJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
    .where(eq(shopBasketLine.basketId, basketId))
    .orderBy(shopBasketLine.id);

  const artworkIds = lines.map((line) => line.artworkId).filter((id): id is string => id !== null);
  const variantIds = lines
    .map((line) => line.productVariantId)
    .filter((id): id is string => id !== null);
  const [sellableByArtwork, sellableByVariant] = await Promise.all([
    sellableCountsByArtworkIds(db, artworkIds),
    sellableCountsByVariantIds(db, variantIds),
  ]);

  const enriched = lines.map((line) => {
    if (line.artworkId) {
      return {
        lineId: line.lineId,
        artworkId: line.artworkId,
        artworkSlug: line.artworkSlug,
        artworkTitle: line.artworkTitle,
        productVariantId: null,
        productSlug: null,
        productTitle: null,
        variantSku: null,
        unitPricePence: line.unitPricePence,
        livePricePence: line.liveArtworkPricePence,
        quantity: line.quantity,
        sellableCount: sellableByArtwork.get(line.artworkId) ?? 0,
        imageUrl: line.primaryImageUrl,
      };
    }
    const variantId = line.productVariantId;
    if (!variantId) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Basket line has no target", 500);
    }
    return {
      lineId: line.lineId,
      artworkId: null,
      artworkSlug: null,
      artworkTitle: null,
      productVariantId: variantId,
      productSlug: line.productSlug,
      productTitle: line.productTitle,
      variantSku: line.variantSku,
      unitPricePence: line.unitPricePence,
      livePricePence: line.liveVariantPricePence,
      quantity: line.quantity,
      sellableCount: sellableByVariant.get(variantId) ?? 0,
      imageUrl: null,
    };
  });

  const basketOwner: BasketOwner = header.identitySubjectId
    ? { kind: "subject", identitySubjectId: header.identitySubjectId }
    : { kind: "anonymous", tokenHash: header.anonymousTokenHash ?? "" };

  return {
    basketId: header.id,
    owner: basketOwner,
    expiresAt: header.expiresAt,
    lines: enriched,
  };
}

export async function ensureOpenBasket(db: Database, owner: BasketOwner): Promise<string> {
  const existing = await db
    .select({ id: shopBasket.id, expiresAt: shopBasket.expiresAt })
    .from(shopBasket)
    .where(ownerWhere(owner))
    .limit(1);
  const now = new Date();
  if (existing[0]) {
    if (existing[0].expiresAt < now) {
      await db.update(shopBasket).set({ retiredAt: now }).where(eq(shopBasket.id, existing[0].id));
    } else {
      return existing[0].id;
    }
  }
  const expiresAt = new Date(now.getTime() + BASKET_TTL_MS);
  try {
    const [created] = await db
      .insert(shopBasket)
      .values({
        anonymousTokenHash: owner.kind === "anonymous" ? owner.tokenHash : null,
        identitySubjectId: owner.kind === "subject" ? owner.identitySubjectId : null,
        expiresAt,
      })
      .returning({ id: shopBasket.id });
    if (!created) throw new Error("Failed to create basket");
    return created.id;
  } catch (error) {
    if (!isPgUniqueViolation(error)) throw error;
    const raced = await db
      .select({ id: shopBasket.id, expiresAt: shopBasket.expiresAt })
      .from(shopBasket)
      .where(ownerWhere(owner))
      .limit(1);
    if (!raced[0]) throw error;
    if (raced[0].expiresAt < now) {
      await db.update(shopBasket).set({ retiredAt: now }).where(eq(shopBasket.id, raced[0].id));
      return ensureOpenBasket(db, owner);
    }
    return raced[0].id;
  }
}

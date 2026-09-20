import type { Database } from "@auction/db";
import { shopArtwork, shopBasket, shopBasketLine } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { BasketOwner, BasketRecord } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../lib/pg-errors.js";
import { sellableCountsByArtworkIds } from "./shop-edition-availability.js";

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
  const updated = await db.execute(sql`
    UPDATE shop_basket_line AS bl
    SET unit_price_pence = a.print_price_pence, updated_at = ${now}
    FROM shop_artwork AS a
    WHERE bl.artwork_id = a.id
      AND bl.basket_id = ${basketId}
      AND a.print_price_pence IS NOT NULL
      AND bl.unit_price_pence IS DISTINCT FROM a.print_price_pence
  `);
  const rowCount =
    typeof updated === "object" && updated !== null && "rowCount" in updated
      ? Number(updated.rowCount)
      : 0;
  return rowCount > 0;
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
      slug: shopArtwork.slug,
      title: shopArtwork.title,
      unitPricePence: shopBasketLine.unitPricePence,
      livePricePence: shopArtwork.printPricePence,
      quantity: shopBasketLine.quantity,
    })
    .from(shopBasketLine)
    .innerJoin(shopArtwork, eq(shopBasketLine.artworkId, shopArtwork.id))
    .where(eq(shopBasketLine.basketId, basketId));

  const sellableByArtwork = await sellableCountsByArtworkIds(
    db,
    lines.map((line) => line.artworkId),
  );
  const enriched = lines.map((line) => ({
    lineId: line.lineId,
    artworkId: line.artworkId,
    artworkSlug: line.slug,
    artworkTitle: line.title,
    unitPricePence: line.unitPricePence,
    livePricePence: line.livePricePence,
    quantity: line.quantity,
    sellableCount: sellableByArtwork.get(line.artworkId) ?? 0,
  }));

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
      throw new ShopApiError(SHOP_API_ERROR_CODES.BASKET_CONFLICT, "Basket expired", 409);
    }
    return existing[0].id;
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
      throw new ShopApiError(SHOP_API_ERROR_CODES.BASKET_CONFLICT, "Basket expired", 409);
    }
    return raced[0].id;
  }
}

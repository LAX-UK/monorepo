import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopBasket,
  shopBasketLine,
  shopParty,
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { basketEditions } from "../application/edition-runs/basket-edition.js";
import { presentBasketFraming } from "../application/framing/edition-framing.view.js";
import { framingPriceDrift } from "../application/framing/framing-order-guard.js";
import type { BasketOwner, BasketRecord } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../lib/pg-errors.js";
import { createDrizzleEditionRunsReader } from "./edition-runs/drizzle-edition-card-facts.reader.js";
import { createDrizzleEditionFramingReader } from "./framing/drizzle-edition-framing.store.js";
import { editionCountsByArtworkId } from "./public-artwork-rows.js";
import { sellableCountsByVariantIds } from "./shop-variant-availability.js";

export const BASKET_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * A checkout success or cancel URL must stay on the storefront: the same origin (scheme, host and
 * port), over http(s) and without credentials. Anything else is refused with a 400 before a
 * payment session is opened. A storefront URL that does not parse allows nothing.
 */
export function assertStorefrontRedirectUrl(url: string, storefrontUrl: string): void {
  const parsed = parseUrl(url);
  if (!parsed) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Invalid redirect URL", 400);
  }
  const storefront = parseUrl(storefrontUrl.trim());
  // Only an http(s) storefront has an origin to match; any other scheme's origin is opaque.
  const allowedOrigin =
    storefront && /^https?:$/.test(storefront.protocol) ? storefront.origin : null;
  if (
    !allowedOrigin ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.origin !== allowedOrigin
  ) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "Redirect URL must stay on the storefront",
      400,
    );
  }
}

/**
 * Keeps the price the shopper was shown for each frame. A frame whose price has not been stamped
 * yet takes today's (it was just chosen, or the line predates stamping). A stamped frame whose
 * price has moved is brought to today's price and reported, so checkout stops and shows the new
 * price rather than charging one the shopper has not seen. A frame no longer on offer is left to
 * the framing check.
 */
export async function reconcileFramingPrices(db: Database, basketId: string): Promise<boolean> {
  const basket = await loadBasketRecord(db, basketId);
  const { stamps, moved } = framingPriceDrift(basket.lines);
  for (const stamp of stamps) {
    await db
      .update(shopBasketLine)
      .set({ framingPricePence: stamp.pricePence, updatedAt: new Date() })
      .where(eq(shopBasketLine.id, stamp.lineId));
  }
  return moved;
}

/** Takes every frame out of a basket (framing is switched off): the shopper reads it unframed. */
export async function clearFramingFromBasket(db: Database, basketId: string): Promise<void> {
  await db
    .update(shopBasketLine)
    .set({ framingOptionId: null, framingPricePence: null, updatedAt: new Date() })
    .where(and(eq(shopBasketLine.basketId, basketId), isNotNull(shopBasketLine.framingOptionId)));
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
  const framingMoved = await reconcileFramingPrices(db, basketId);
  return artworkRows + variantRows > 0 || framingMoved;
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
      artistName: shopParty.displayName,
      artistSlug: shopArtist.slug,
      productSlug: shopProduct.slug,
      productTitle: shopProduct.title,
      variantSku: shopProductVariant.sku,
      unitPricePence: shopBasketLine.unitPricePence,
      liveArtworkPricePence: shopArtwork.printPricePence,
      liveVariantPricePence: shopProductVariant.pricePence,
      quantity: shopBasketLine.quantity,
      framingOptionId: shopBasketLine.framingOptionId,
      framingPricePence: shopBasketLine.framingPricePence,
    })
    .from(shopBasketLine)
    .leftJoin(shopArtwork, eq(shopBasketLine.artworkId, shopArtwork.id))
    .leftJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
    .leftJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
    .leftJoin(shopProductVariant, eq(shopBasketLine.productVariantId, shopProductVariant.id))
    .leftJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
    .where(eq(shopBasketLine.basketId, basketId))
    .orderBy(shopBasketLine.id);

  const artworkIds = lines.map((line) => line.artworkId).filter((id): id is string => id !== null);
  const variantIds = lines
    .map((line) => line.productVariantId)
    .filter((id): id is string => id !== null);
  const framedArtworkIds = lines
    .filter((line) => line.artworkId !== null && line.framingOptionId !== null)
    .map((line) => line.artworkId as string);
  const framingOptionIds = lines
    .map((line) => line.framingOptionId)
    .filter((id): id is string => id !== null);
  const framingReader = createDrizzleEditionFramingReader(db);
  const [editionCounts, editions, sellableByVariant, framingFacts, framingOptions] =
    await Promise.all([
      editionCountsByArtworkId(db, artworkIds),
      basketEditions(createDrizzleEditionRunsReader(db), artworkIds),
      sellableCountsByVariantIds(db, variantIds),
      framingReader.read(framedArtworkIds),
      framingReader.options(framingOptionIds),
    ]);

  const enriched = lines.map((line) => {
    if (line.artworkId) {
      const counts = editionCounts.get(line.artworkId);
      const edition = editions.get(line.artworkId);
      const facts = framingFacts.get(line.artworkId);
      const option = line.framingOptionId ? framingOptions.get(line.framingOptionId) : undefined;
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
        sellableCount: counts?.available ?? 0,
        imageUrl: line.primaryImageUrl,
        artistName: line.artistName,
        artistSlug: line.artistSlug,
        editionSize: edition?.size ?? null,
        editionLine: edition?.line ?? null,
        framingOptionId: line.framingOptionId,
        framing: facts && option ? presentBasketFraming(facts, option) : null,
        framingPricePence: line.framingPricePence,
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
      artistName: null,
      artistSlug: null,
      editionSize: null,
      editionLine: null,
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

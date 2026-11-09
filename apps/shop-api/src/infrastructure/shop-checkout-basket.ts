import type { Database } from "@auction/db";
import { shopBasketLine } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type FramingOrderSnapshot,
  type MoneyPence,
  computeMerchandiseSubtotal,
  pence,
} from "@auction/shop-domain";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  assertFramingOrderable,
  framingSubtotalPence,
} from "../application/framing/framing-order-guard.js";
import type { BasketOwner } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { createDrizzleEditionFramingReader } from "./framing/drizzle-edition-framing.store.js";
import {
  assertBasketStock,
  loadBasketRecord,
  repriceBasketLinesIfNeeded,
} from "./shop-basket.persistence.js";

/** A basket that has passed every check an order needs, with its subtotal and its lines. */
export type CheckoutBasket = {
  lines: Awaited<ReturnType<typeof loadBasketRecord>>["lines"];
  /** The goods alone: the works and products, which artists and owners are paid on. */
  merchandiseSubtotal: MoneyPence;
  /** The framing sold with the prints, apart from the goods. */
  framingSubtotal: MoneyPence;
};

/**
 * Loads a basket for an order and refuses it when it is not the caller's, is empty, holds a
 * product that is switched off, has changed price or is out of stock. Shared by every order that
 * is made from a basket, so each applies the same checks in the same order.
 */
export async function loadCheckoutBasket(
  db: Database,
  input: { basketId: string; ownedBy: (owner: BasketOwner) => boolean },
  options: { merchandiseEnabled: boolean; framingEnabled: boolean },
): Promise<CheckoutBasket> {
  const basket = await loadBasketRecord(db, input.basketId);
  if (!input.ownedBy(basket.owner)) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Basket ownership mismatch", 403);
  }
  if (basket.lines.length === 0) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Basket is empty", 400);
  }
  if (!options.merchandiseEnabled && basket.lines.some((line) => line.productVariantId != null)) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FEATURE_DISABLED, "Merchandise is disabled", 404);
  }
  const repriced = await repriceBasketLinesIfNeeded(db, input.basketId);
  if (repriced) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.PRICE_CHANGED, "Basket price changed", 409);
  }
  await assertBasketStock(db, input.basketId);
  const fresh = await loadBasketRecord(db, input.basketId);
  if (!options.framingEnabled && fresh.lines.some((line) => line.framingOptionId != null)) {
    // Framing was switched off with frames still in the basket. They are taken out, and the
    // shopper is told, rather than left at a dead end they cannot clear from the page.
    await db
      .update(shopBasketLine)
      .set({ framingOptionId: null, framingPricePence: null, updatedAt: new Date() })
      .where(
        and(eq(shopBasketLine.basketId, input.basketId), isNotNull(shopBasketLine.framingOptionId)),
      );
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.BASKET_CONFLICT,
      "Framing is no longer available, so the frames were removed from your basket. Check it and try again.",
      409,
    );
  }
  // Framing is checked on the lines the order is built from and priced on, not on the first read.
  const artworkIds = fresh.lines.flatMap((line) => (line.artworkId ? [line.artworkId] : []));
  await assertFramingOrderable({
    lines: fresh.lines,
    framingEnabled: options.framingEnabled,
    factsByArtwork:
      options.framingEnabled && artworkIds.length > 0
        ? await createDrizzleEditionFramingReader(db).read(artworkIds)
        : new Map(),
  });
  const merchandiseSubtotal = computeMerchandiseSubtotal(
    fresh.lines.map((line) => ({
      unitPricePence: pence(line.unitPricePence),
      quantity: line.quantity,
    })),
  );
  return {
    lines: fresh.lines,
    merchandiseSubtotal,
    framingSubtotal: pence(framingSubtotalPence(fresh.lines)),
  };
}

/** A print to reserve for an order, with the framing sold with it when there is any. */
export type ExpandedEditionCopy = {
  artworkId: string;
  unitPricePence: number;
  framing?: FramingOrderSnapshot;
};

/** One entry per copy: a line of three prints is three editions to reserve, each with its own frame. */
export function expandBasketLines(lines: CheckoutBasket["lines"]) {
  const editionLines: ExpandedEditionCopy[] = [];
  const variantLines: Array<{ productVariantId: string; unitPricePence: number }> = [];
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) {
      if (line.productVariantId) {
        variantLines.push({
          productVariantId: line.productVariantId,
          unitPricePence: line.unitPricePence,
        });
      } else if (line.artworkId) {
        editionLines.push({
          artworkId: line.artworkId,
          unitPricePence: line.unitPricePence,
          ...(line.framing
            ? {
                framing: {
                  optionId: line.framing.optionId,
                  name: line.framing.name,
                  frame: line.framing.frame,
                  mount: line.framing.mount,
                  glazing: line.framing.glazing,
                  hanging: line.framing.hanging,
                  leadTimeMinDays: line.framing.leadTimeMinDays,
                  leadTimeMaxDays: line.framing.leadTimeMaxDays,
                  pricePence: line.framing.pricePence,
                },
              }
            : {}),
        });
      }
    }
  }
  return { editionLines, variantLines };
}

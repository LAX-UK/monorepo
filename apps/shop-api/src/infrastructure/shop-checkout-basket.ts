import type { Database } from "@auction/db";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type MoneyPence, computeMerchandiseSubtotal, pence } from "@auction/shop-domain";
import type { BasketOwner } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  assertBasketStock,
  loadBasketRecord,
  repriceBasketLinesIfNeeded,
} from "./shop-basket.persistence.js";

/** A basket that has passed every check an order needs, with its subtotal and its lines. */
export type CheckoutBasket = {
  lines: Awaited<ReturnType<typeof loadBasketRecord>>["lines"];
  merchandiseSubtotal: MoneyPence;
};

/**
 * Loads a basket for an order and refuses it when it is not the caller's, is empty, holds a
 * product that is switched off, has changed price or is out of stock. Shared by every order that
 * is made from a basket, so each applies the same checks in the same order.
 */
export async function loadCheckoutBasket(
  db: Database,
  input: { basketId: string; ownedBy: (owner: BasketOwner) => boolean },
  options: { merchandiseEnabled: boolean },
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
  const merchandiseSubtotal = computeMerchandiseSubtotal(
    fresh.lines.map((line) => ({
      unitPricePence: pence(line.unitPricePence),
      quantity: line.quantity,
    })),
  );
  return { lines: fresh.lines, merchandiseSubtotal };
}

/** One entry per copy: a line of three prints is three editions to reserve. */
export function expandBasketLines(lines: CheckoutBasket["lines"]) {
  const editionLines: Array<{ artworkId: string; unitPricePence: number }> = [];
  const variantLines: Array<{ productVariantId: string; unitPricePence: number }> = [];
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) {
      if (line.productVariantId) {
        variantLines.push({
          productVariantId: line.productVariantId,
          unitPricePence: line.unitPricePence,
        });
      } else if (line.artworkId) {
        editionLines.push({ artworkId: line.artworkId, unitPricePence: line.unitPricePence });
      }
    }
  }
  return { editionLines, variantLines };
}

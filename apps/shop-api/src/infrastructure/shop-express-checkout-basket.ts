import { createHash } from "node:crypto";
import type { Database } from "@auction/db";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { addPence } from "@auction/shop-domain";
import type {
  ExpressCheckoutBasket,
  ExpressCheckoutBasketReader,
} from "../application/ports/express-checkout.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { loadBasketRecord } from "./shop-basket.persistence.js";
import { type CheckoutBasket, loadCheckoutBasket } from "./shop-checkout-basket.js";
import {
  type CheckoutStripeLine,
  groupCheckoutEditionLines,
  groupCheckoutFramingLines,
} from "./shop-checkout-stripe-presentation.js";

/**
 * The wallet sheet's lines for a basket, built the way the hosted page's are built for an order
 * (one line per artwork and price, then products, then framing), so both add up the same way.
 * Edition numbers are not known until the order reserves them, so none are named.
 */
export function expressBasketStripeLines(lines: CheckoutBasket["lines"]): CheckoutStripeLine[] {
  const editionRows = lines.flatMap((line) =>
    line.artworkId
      ? Array.from({ length: line.quantity }, () => ({
          artworkId: line.artworkId,
          editionNumber: null,
          unitPricePence: line.unitPricePence,
          title: line.artworkTitle ?? "Print",
          imageUrl: line.imageUrl,
          artistName: line.artistName ?? "",
        }))
      : [],
  );
  const variantLines: CheckoutStripeLine[] = lines.flatMap((line) =>
    line.productVariantId
      ? [
          {
            title: line.productTitle ?? "Product",
            description: `SKU ${line.variantSku ?? ""}`.trim(),
            quantity: line.quantity,
            unitAmountPence: line.unitPricePence,
            imageUrl: null,
          },
        ]
      : [],
  );
  const framingRows = lines.flatMap((line) =>
    line.framing
      ? Array.from({ length: line.quantity }, () => ({
          name: line.framing?.name ?? "Framing",
          unitPricePence: line.framing?.pricePence ?? 0,
        }))
      : [],
  );
  return [
    ...groupCheckoutEditionLines(editionRows),
    ...variantLines,
    ...groupCheckoutFramingLines(framingRows),
  ];
}

/** Changes whenever anything that would be ordered or charged changes. */
export function expressBasketContentKey(lines: CheckoutBasket["lines"]): string {
  const content = lines.map((line) => [
    line.lineId,
    line.artworkId,
    line.productVariantId,
    line.quantity,
    line.unitPricePence,
    line.framingOptionId ?? null,
    line.framing?.pricePence ?? null,
  ]);
  return createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 32);
}

export function createDrizzleExpressCheckoutBasketReader(
  db: Database,
  options: {
    merchandiseEnabled: boolean;
    framingEnabled: boolean;
    editionOrderLimit: number | null;
  },
): ExpressCheckoutBasketReader {
  return {
    async loadExpressBasket(input): Promise<ExpressCheckoutBasket> {
      const basket = await loadCheckoutBasket(db, input, options);
      return {
        lines: expressBasketStripeLines(basket.lines),
        subtotalPence: addPence(basket.merchandiseSubtotal, basket.framingSubtotal),
        contentKey: expressBasketContentKey(basket.lines),
      };
    },
    async assertBasketOwned(input) {
      const basket = await loadBasketRecord(db, input.basketId);
      if (!input.ownedBy(basket.owner)) {
        // The same refusal an order from someone else's basket gets.
        throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Basket ownership mismatch", 403);
      }
    },
  };
}

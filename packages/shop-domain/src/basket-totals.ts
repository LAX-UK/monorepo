import {
  type ShopFulfilmentOption,
  fulfilmentSurchargePence,
  isOnlineCheckoutFulfilment,
} from "./fulfilment-options.js";
import { type MoneyPence, addPence, multiplyPence, pence, sumPence } from "./money.js";
import { ShopDomainError } from "./shop-domain-error.js";

/**
 * How many copies of one edition a shopper can buy in one order. It is a stated rule ("Limit 2 per
 * order"), so the basket can cap the quantity without saying how many copies are left.
 */
export const SHOP_EDITION_ORDER_LIMIT = 2;

/** The most of one merchandise variant a basket line can hold. */
export const SHOP_BASKET_LINE_QUANTITY_MAX = 24;

/**
 * The most a shopper can put on a basket line right now: the order rule, lowered to what is
 * sellable. Never below 1, so a line that has gone over can still be stepped down.
 */
export function basketLineMaxQuantity(input: {
  kind: "edition" | "merchandise";
  sellableCount: number;
}): number {
  const rule = input.kind === "edition" ? SHOP_EDITION_ORDER_LIMIT : SHOP_BASKET_LINE_QUANTITY_MAX;
  return Math.max(1, Math.min(rule, input.sellableCount));
}

export type BasketLineInput = {
  unitPricePence: MoneyPence;
  quantity: number;
};

export function computeMerchandiseSubtotal(lines: readonly BasketLineInput[]): MoneyPence {
  if (lines.length === 0) {
    return pence(0);
  }
  return sumPence(lines.map((line) => multiplyPence(line.unitPricePence, line.quantity)));
}

export function computeOrderTotal(input: {
  merchandiseSubtotalPence: MoneyPence;
  fulfilment: ShopFulfilmentOption;
}): MoneyPence {
  if (!isOnlineCheckoutFulfilment(input.fulfilment)) {
    throw new ShopDomainError("International quotation fulfilment cannot be checked out online");
  }
  return addPence(
    input.merchandiseSubtotalPence,
    pence(fulfilmentSurchargePence(input.fulfilment)),
  );
}

export function assertQuantityWithinSellable(quantity: number, sellableCount: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ShopDomainError("Quantity must be at least 1");
  }
  if (quantity > sellableCount) {
    throw new ShopDomainError("Requested quantity exceeds sellable stock");
  }
}

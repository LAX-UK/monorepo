import {
  type ShopFulfilmentOption,
  fulfilmentSurchargePence,
  isOnlineCheckoutFulfilment,
} from "./fulfilment-options.js";
import { type MoneyPence, addPence, multiplyPence, pence, sumPence } from "./money.js";
import { ShopDomainError } from "./shop-domain-error.js";

/**
 * The most of one item a basket line can hold, whatever the stock (the API's upper bound). A
 * product rule, not a run size: runs now hold up to 500 prints and open editions have no size.
 */
export const SHOP_BASKET_LINE_QUANTITY_MAX = 10;

/**
 * The most a shopper can put on a basket line right now: the per-order limit when one applies
 * (a stated rule, such as "Limit 2 per order"), lowered to what is sellable. Never below 1, so a
 * line that has gone over can still be stepped down.
 */
export function basketLineMaxQuantity(input: {
  /** Copies of this item one order may hold; null when only stock limits it. */
  orderLimit: number | null;
  sellableCount: number;
}): number {
  const rule = Math.min(
    input.orderLimit ?? SHOP_BASKET_LINE_QUANTITY_MAX,
    SHOP_BASKET_LINE_QUANTITY_MAX,
  );
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

/**
 * What the order costs: the goods, the framing sold with them (kept apart from the goods, which
 * artists and owners are paid on), and the delivery charge.
 */
export function computeOrderTotal(input: {
  merchandiseSubtotalPence: MoneyPence;
  framingSubtotalPence?: MoneyPence;
  fulfilment: ShopFulfilmentOption;
}): MoneyPence {
  if (!isOnlineCheckoutFulfilment(input.fulfilment)) {
    throw new ShopDomainError("International quotation fulfilment cannot be checked out online");
  }
  return addPence(
    addPence(input.merchandiseSubtotalPence, input.framingSubtotalPence ?? pence(0)),
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

/**
 * What an order comes to once a quoted delivery price is known: the goods, the framing sold with
 * them and the delivery. Used wherever a total is set from a price that is not a fixed option's.
 */
export function orderTotalWithDelivery(input: {
  merchandiseSubtotalPence: number;
  framingSubtotalPence: number;
  deliveryPence: number;
}): number {
  return input.merchandiseSubtotalPence + input.framingSubtotalPence + input.deliveryPence;
}

import {
  type ShopFulfilmentOption,
  fulfilmentSurchargePence,
  isOnlineCheckoutFulfilment,
} from "./fulfilment-options.js";
import { type MoneyPence, addPence, multiplyPence, pence, sumPence } from "./money.js";
import { ShopDomainError } from "./shop-domain-error.js";

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

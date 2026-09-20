import { ShopDomainError } from "./shop-domain-error.js";

/** Integer GBP minor units (pence). No floats at commerce boundaries. */
export type MoneyPence = number & { readonly __brand: "MoneyPence" };

export function pence(value: number): MoneyPence {
  if (!Number.isInteger(value) || value < 0) {
    throw new ShopDomainError("Money must be a non-negative integer pence amount");
  }
  return value as MoneyPence;
}

export function addPence(a: MoneyPence, b: MoneyPence): MoneyPence {
  return pence(a + b);
}

export function multiplyPence(unit: MoneyPence, quantity: number): MoneyPence {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ShopDomainError("Quantity must be a positive integer");
  }
  return pence(unit * quantity);
}

export function sumPence(values: readonly MoneyPence[]): MoneyPence {
  return values.reduce((acc, v) => addPence(acc, v), pence(0));
}

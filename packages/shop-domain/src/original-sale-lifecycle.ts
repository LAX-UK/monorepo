import { ShopDomainError } from "./shop-domain-error.js";

export type ShopOriginalSaleStatus =
  | "reserved"
  | "deposit_due"
  | "invoiced"
  | "paid"
  | "assigned"
  | "cancelled";

export function assertOriginalSaleCanIssueInvoice(status: ShopOriginalSaleStatus): void {
  if (status !== "reserved" && status !== "deposit_due") {
    throw new ShopDomainError(`Cannot issue invoice from status ${status}`);
  }
}

export function assertOriginalSaleCanMarkPaid(status: ShopOriginalSaleStatus): void {
  if (status !== "invoiced") {
    throw new ShopDomainError(`Cannot mark paid from status ${status}`);
  }
}

export function assertOriginalSaleCanAssign(status: ShopOriginalSaleStatus): void {
  if (status !== "paid") {
    throw new ShopDomainError(`Cannot assign original from status ${status}`);
  }
}

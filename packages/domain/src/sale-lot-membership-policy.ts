import type { Sale } from "@auction/types";
import { SALE_STATUSES_ALLOWING_LOT_ADD } from "./sale-status-policy.js";

/** Attach/detach existing lots is draft-only; emergency add uses {@link SALE_STATUSES_ALLOWING_LOT_ADD}. */
export function canAttachLotToSale(sale: Pick<Sale, "status">): boolean {
  return sale.status === "draft";
}

export function canDetachLotFromSale(sale: Pick<Sale, "status">): boolean {
  return sale.status === "draft";
}

export function canAddLotToSale(sale: Pick<Sale, "status">): boolean {
  return SALE_STATUSES_ALLOWING_LOT_ADD.has(sale.status);
}

export const LOT_ADD_BLOCKED_MESSAGE =
  "Lots cannot be added once the sale has ended or been cancelled";

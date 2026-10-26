import { type OrderVatBreakdown, orderVatBreakdown } from "@auction/shop-domain";
import type { OrderRecord } from "./ports/commerce.ports.js";

/** The VAT included in an order, as stored on its lines and its delivery charge. */
export function orderRecordVat(
  record: Pick<OrderRecord, "lines" | "fulfilmentVatPence" | "totalPence">,
): OrderVatBreakdown | null {
  return orderVatBreakdown({
    lines: record.lines.map((line) => ({ vatPence: line.vatPence, vatRateBp: line.vatRateBp })),
    deliveryVatPence: record.fulfilmentVatPence,
    totalPence: record.totalPence,
  });
}

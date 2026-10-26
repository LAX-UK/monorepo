import { type OrderVatBreakdown, orderVatBreakdown } from "@auction/shop-domain";
import type { OrderRecord } from "./ports/commerce.ports.js";

/** The VAT included in an order, from the rate recorded on each line when it was sold. */
export function orderRecordVat(
  record: Pick<OrderRecord, "lines" | "fulfilmentSurchargePence">,
): OrderVatBreakdown | null {
  return orderVatBreakdown({
    lines: record.lines.map((line) => ({
      grossPence: line.unitPricePence,
      vatRateBp: line.vatRateBp,
    })),
    deliveryPence: record.fulfilmentSurchargePence,
  });
}

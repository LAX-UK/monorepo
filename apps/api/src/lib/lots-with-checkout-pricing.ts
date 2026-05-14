import type { Lot, Sale } from "@auction/types";
import type { Container } from "../container.js";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";

/** Batch-load sales and attach `checkoutPricing` for dashboard / list consumers. */
export async function lotsWithCheckoutPricing(container: Container, lots: Lot[]): Promise<Lot[]> {
  if (lots.length === 0) return lots;
  const saleIds = [
    ...new Set(
      lots
        .map((l) => l.saleId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const saleRows = await container.saleService.findByIds(saleIds);
  const saleById = new Map<string, Sale>(saleRows.map((s) => [s.id, s]));
  return lots.map((lotRow) => {
    const sale = lotRow.saleId ? (saleById.get(lotRow.saleId) ?? null) : null;
    return { ...lotRow, checkoutPricing: computeLotCheckoutPricing(lotRow, sale) };
  });
}

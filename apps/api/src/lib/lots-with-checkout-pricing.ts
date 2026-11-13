import type { IInvoicedSalePriceReader } from "@auction/persistence/interfaces";
import type { Lot, PublicLotView, Sale, WithSaleZone } from "@auction/types";
import type { SaleLookupPort } from "../container/container-slices.js";
import { withInvoicedSalePrices } from "./invoiced-sale-prices.js";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";
import { loadSalesForLots, withSaleTimeZone } from "./lot-sale-time-zone.js";

type LotsWithCheckoutPricingDeps = {
  saleService: SaleLookupPort;
  /** Public lists: sold lots show what their invoice charged. */
  invoicedSalePrices?: IInvoicedSalePriceReader | null | undefined;
};

/** Batch-load sales and attach `checkoutPricing` and the sale's `timeZone` for dashboard and list consumers. */
export async function lotsWithCheckoutPricing(
  container: LotsWithCheckoutPricingDeps,
  lots: (Lot | PublicLotView)[],
): Promise<WithSaleZone<Lot | PublicLotView>[]> {
  if (lots.length === 0) return lots;
  const saleById: Map<string, Sale> = await loadSalesForLots(container, lots);
  const saleOf = (lotRow: Lot | PublicLotView) =>
    lotRow.saleId ? (saleById.get(lotRow.saleId) ?? null) : null;
  const priced = lots.map((lotRow) =>
    withSaleTimeZone(
      { ...lotRow, checkoutPricing: computeLotCheckoutPricing(lotRow, saleOf(lotRow)) },
      saleOf(lotRow),
    ),
  );
  return withInvoicedSalePrices(container.invoicedSalePrices, priced, saleOf);
}

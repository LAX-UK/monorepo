import type { IInvoicedSalePriceReader, InvoicedSalePrice } from "@auction/persistence/interfaces";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { computeLotCheckoutPricing } from "./lot-checkout-pricing.js";
import { checkoutPricingFromInvoicedSale } from "./stored-checkout-pricing.js";

/*
 * Sold lots whose invoice is raised show what the invoice charged, on every public surface (lot
 * page, lists, cards, hang labels, results), not the premium worked out again under today's
 * rules. One read per list.
 */

type SoldResultFields = Pick<Lot, "id" | "status" | "winnerId"> &
  Partial<Pick<Lot, "hasWinner" | "resultPending">>;

/** Whether this view of a lot shows it sold, with the result published. */
export function showsSoldResult(lot: SoldResultFields): boolean {
  if (lot.status !== "ended" || lot.resultPending === true) return false;
  return lot.winnerId != null || lot.hasWinner === true;
}

/** The invoiced price of every lot in `lots` that shows as sold, in one read. */
export async function invoicedSalePricesOf(
  reader: IInvoicedSalePriceReader | null | undefined,
  lots: readonly SoldResultFields[],
): Promise<Map<string, InvoicedSalePrice>> {
  const sold = lots.filter(showsSoldResult).map((lot) => lot.id);
  if (!reader || sold.length === 0) return new Map();
  return reader.findInvoicedSalePrices(sold);
}

/**
 * The lots with each sold, invoiced lot's `checkoutPricing` read from its invoice. Other lots are
 * returned as they are.
 */
export async function withInvoicedSalePrices<T extends Lot | PublicLotView>(
  reader: IInvoicedSalePriceReader | null | undefined,
  lots: readonly T[],
  saleOf: (lot: T) => Sale | null,
): Promise<T[]> {
  const prices = await invoicedSalePricesOf(reader, lots);
  if (prices.size === 0) return [...lots];
  return lots.map((lot) => {
    const sold = prices.get(lot.id);
    if (!sold) return lot;
    const live = lot.checkoutPricing ?? computeLotCheckoutPricing(lot, saleOf(lot));
    return { ...lot, checkoutPricing: checkoutPricingFromInvoicedSale(live, sold) };
  });
}

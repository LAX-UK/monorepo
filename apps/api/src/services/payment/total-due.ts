import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { lotTotalDuePence } from "@auction/validators";

/**
 * Hammer + buyer's premium, in pence, for an invoice being raised now.
 *
 * A sale with premium tiers overrides the lot's flat rate. If the sale cannot be read the
 * request fails: falling back to the lot's flat rate would freeze a wrong total on the invoice.
 */
export async function computeTotalDuePence(
  sales: ISaleRepository | null,
  lot: Lot,
): Promise<number> {
  const sale: Sale | null = sales && lot.saleId ? await sales.findById(lot.saleId) : null;
  return lotTotalDuePence(lot, sale);
}

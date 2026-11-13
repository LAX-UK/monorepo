import type { InvoiceRaiser } from "@auction/finance-runtime";
import { gbpPenceToMajorString } from "@auction/finance-runtime";
import type { Lot } from "@auction/types";
import type { IReofferPricing } from "./reoffer-ports.js";

/**
 * The same pricing the invoice uses, so the total the bidder is shown is the total they are
 * billed: the lot as stored, for the bidder's account, at the offer's hammer. After a buyer
 * default voids the invoice, this is a fresh pricing under the lot's premium as it stands.
 */
export function invoiceReofferPricing(deps: {
  lots: { findById(id: string): Promise<Lot | null> };
  invoiceRaiser: Pick<InvoiceRaiser, "price">;
}): IReofferPricing {
  return {
    async priceFor({ lotId, buyerLegalEntityId, hammerPence }) {
      const found = await deps.lots.findById(lotId);
      if (!found) throw new Error(`Lot ${lotId} not found for pricing`);
      const priced = await deps.invoiceRaiser.price({
        ...found,
        buyerLegalEntityId,
        currentPrice: gbpPenceToMajorString(hammerPence),
      });
      return {
        lines: priced.lines,
        totalPence: priced.totalPence,
        invoiceDueAt: priced.existing?.dueAt ?? null,
      };
    },
  };
}

/** The buyer's premium a pricing charges an account at a hammer, in pence. */
export async function buyersPremiumMinorOf(
  pricing: IReofferPricing,
  input: { lotId: string; buyerLegalEntityId: string; hammerPence: number },
): Promise<number> {
  const priced = await pricing.priceFor(input);
  return priced.lines
    .filter((l) => l.kind === "buyers_premium")
    .reduce((sum, l) => sum + l.amountPence, 0);
}

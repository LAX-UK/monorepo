import { majorGbpToPence } from "@auction/domain";
import type { InvoiceLine, Lot, Sale } from "@auction/types";
import { buildBuyerPremiumPolicy } from "./buyer-premium.js";

/** The sale a lot belongs to could not be found, so its buyer's premium cannot be priced. */
export class InvoiceSaleMissingError extends Error {
  constructor(readonly saleId: string) {
    super(`Sale ${saleId} was not found, so the invoice cannot be priced`);
    this.name = "InvoiceSaleMissingError";
  }
}

export type InvoiceLines = {
  lines: InvoiceLine[];
  totalPence: number;
  /** The premium policy the lines were worked out with (`flat:0.2500`, `tiered:[…]`). */
  policyId: string;
};

function majorToPence(major: string): number {
  const n = Number.parseFloat(major);
  return Number.isFinite(n) ? majorGbpToPence(n) : 0;
}

/** A fraction such as "0.2500" as a percentage without trailing zeros ("25", "12.5"). */
function percentOf(fraction: string): string {
  const percent = Number.parseFloat(fraction) * 100;
  return Number.isFinite(percent) ? String(Number(percent.toFixed(3))) : "0";
}

/**
 * The lines of the invoice for a won lot, and their total in whole pence: the hammer price and the
 * buyer's premium. This is the one calculator behind every invoice total, used when the invoice
 * is raised at lot end and at checkout. Each part is rounded to the penny first, so the total is
 * always exactly the sum of its lines.
 *
 * A lot in a sale needs that sale: a sale's premium tiers override the lot's flat rate, so pricing
 * without the sale would freeze a wrong total. A missing sale throws.
 *
 * VAT, import VAT and Artist's Resale Right lines are not produced until the accountant has
 * confirmed the rules. The premium label does not say whether VAT is included for the same reason.
 */
export function buildInvoiceLines(lot: Lot, sale: Sale | null): InvoiceLines {
  if (lot.saleId && !sale) throw new InvoiceSaleMissingError(lot.saleId);

  const policy = buildBuyerPremiumPolicy({
    saleTiers: sale?.buyerPremiumTiers ?? null,
    lotRate: lot.buyerPremiumRate,
  });
  const hammerPence = majorToPence(lot.currentPrice);
  const premiumPence = policy.computePremiumMinor(hammerPence);
  const ratePercent = percentOf(policy.rateFor(hammerPence));
  const tiered = policy.id.startsWith("tiered:");

  const lines: InvoiceLine[] = [
    { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: hammerPence },
  ];
  if (premiumPence > 0) {
    lines.push({
      kind: "buyers_premium",
      label: tiered ? "Buyer's premium (tiered)" : `Buyer's premium (${ratePercent}%)`,
      ratePercent,
      amountPence: premiumPence,
    });
  }
  return { lines, totalPence: hammerPence + premiumPence, policyId: policy.id };
}

/** The invoice total in whole pence: the sum of {@link buildInvoiceLines}. */
export function lotTotalDuePence(lot: Lot, sale: Sale | null): number {
  return buildInvoiceLines(lot, sale).totalPence;
}

/** The sum of the lines' amounts, in whole pence. */
export function sumInvoiceLines(lines: readonly InvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.amountPence, 0);
}

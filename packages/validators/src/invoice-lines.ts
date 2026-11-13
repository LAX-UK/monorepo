import type { InvoiceLine, Lot, Sale } from "@auction/types";
import { buyerPremiumLineLabel, formatPremiumPercent } from "./buyer-premium-wording.js";
import { resolveBuyerPremium } from "./buyer-premium.js";
import { majorToPence } from "./major-to-pence.js";

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
  /** The premium policy the lines were worked out with (`flat:0.2500`, `bands:[…]`). */
  policyId: string;
};

/** A fraction such as "0.2500" as a percentage without trailing zeros ("25", "12.5"). */
function percentOf(fraction: string): string {
  return formatPremiumPercent(fraction).replace(/%$/u, "");
}

/**
 * The lines of the invoice for a won lot, and their total in whole pence: the hammer price and the
 * buyer's premium. This is the one calculator behind every invoice total, used when the invoice
 * is raised at lot end and at checkout. Each part is rounded to the penny first, so the total is
 * always exactly the sum of its lines.
 *
 * The premium is the lot's own when staff set one, else its sale's bands or flat rate
 * (`resolveBuyerPremium`). A lot in a sale needs that sale, so pricing without it would freeze a
 * wrong total: a missing sale throws. A banded premium's line says how it was worked out
 * ("Buyer's premium (15% of £500,000 + 10% of £100,000)") and carries no single rate.
 *
 * VAT, import VAT and Artist's Resale Right lines are not produced until the accountant has
 * confirmed the rules. The premium label does not say whether VAT is included for the same reason.
 */
export function buildInvoiceLines(lot: Lot, sale: Sale | null): InvoiceLines {
  if (lot.saleId && !sale) throw new InvoiceSaleMissingError(lot.saleId);

  const { policy, schedule } = resolveBuyerPremium({ lotRate: lot.buyerPremiumRate, sale });
  const hammerPence = majorToPence(lot.currentPrice);
  const premiumPence = policy.computePremiumMinor(hammerPence);
  const ratePercent = schedule.kind === "flat" ? percentOf(schedule.rate) : null;

  const lines: InvoiceLine[] = [
    { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: hammerPence },
  ];
  if (premiumPence > 0) {
    lines.push({
      kind: "buyers_premium",
      label: buyerPremiumLineLabel(schedule, policy.breakdown(hammerPence)),
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

import type { Sale } from "@auction/types";
import {
  describeBuyerPremium,
  isBuyerPremiumRate,
  saleBuyerPremiumSchedule,
} from "@auction/validators";

/*
 * The lot form's buyer's premium: a lot uses its sale's premium unless staff set one for it.
 * What the form says in each state, kept pure so each wording is a test.
 */

/** The sale's premium in words, or `null` when the sale (or its premium) is not known. */
export function salePremiumTermsFor(
  sale: Partial<Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers">> | null | undefined,
): string | null {
  if (!sale?.buyerPremiumRate && !sale?.buyerPremiumTiers?.length) return null;
  return describeBuyerPremium(
    saleBuyerPremiumSchedule({
      buyerPremiumRate: sale.buyerPremiumRate ?? "0",
      buyerPremiumTiers: sale.buyerPremiumTiers ?? null,
    }).schedule,
  );
}

export type LotPremiumFieldView = {
  /** "Uses the sale's premium: 15% up to £500,000, 10% above". */
  usesSaleLine: string;
  /** Shown while the lot has its own premium. */
  overrideNote: string;
};

/** The lines the lot form shows for its premium, given the sale's premium in words. */
export function lotPremiumFieldView(input: {
  salePremium: string | null;
  lotRate: string;
}): LotPremiumFieldView {
  const sale = input.salePremium;
  const usesSaleLine = sale
    ? `Uses the sale's premium: ${sale}`
    : "Uses the sale's premium. Choose the sale to see it.";
  const own = isBuyerPremiumRate(input.lotRate)
    ? describeBuyerPremium({ kind: "flat", rate: input.lotRate })
    : null;
  const overrideNote = [
    own ? `This lot charges its own premium: ${own}.` : "This lot will charge its own premium.",
    sale ? `The sale charges ${sale}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return { usesSaleLine, overrideNote };
}

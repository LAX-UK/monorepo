import type { Sale } from "@auction/types";
import { describeBuyerPremium, saleBuyerPremiumSchedule } from "@auction/validators";

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
  /** The value beside "Buyer's premium" while the lot uses the sale's: "Same as the sale: 15% …". */
  usesSaleLine: string;
  /**
   * The warning while the lot has a rate of its own; `null` while the field is blank, because a
   * blank field saves nothing and the lot keeps using the sale's premium.
   */
  overrideNotice: { title: string; body: string | null } | null;
};

/** The lot field's guidance: what the rate is charged on, and what leaving it blank does. */
export const LOT_PREMIUM_FIELD_DESCRIPTION =
  "Charged on the whole hammer instead of the sale's premium. Leave blank to use the sale's.";

/** An example rate, not a default: a blank field means the sale's premium. */
export const LOT_PREMIUM_FIELD_PLACEHOLDER = "e.g. 20";

/** The lines the lot form shows for its premium, given the sale's premium in words. */
export function lotPremiumFieldView(input: {
  salePremium: string | null;
  lotRate: string;
}): LotPremiumFieldView {
  const sale = input.salePremium;
  const usesSaleLine = sale
    ? `Same as the sale: ${sale}`
    : "Same as the sale. Choose the sale to see it.";
  const overrideNotice =
    input.lotRate.trim() === ""
      ? null
      : { title: "This lot has its own premium", body: sale ? `The sale charges ${sale}.` : null };
  return { usesSaleLine, overrideNotice };
}

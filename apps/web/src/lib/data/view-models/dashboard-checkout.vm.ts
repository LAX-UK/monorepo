import type { Lot } from "@auction/types";

/** Hammer, buyer's premium, and total for checkout display (pure, no I/O). Requires BE `checkoutPricing`. */
export function buildCheckoutTotalsVm(checkoutPricing: NonNullable<Lot["checkoutPricing"]>): {
  hammer: number;
  premium: number;
  total: number;
  buyerPremiumRate: number;
  premiumPercentLabel: string;
} {
  const hammer = Number.parseFloat(checkoutPricing.hammerMajor);
  const premium = Number.parseFloat(checkoutPricing.premiumMajor);
  const total = Number.parseFloat(checkoutPricing.totalMajor);
  const safeHammer = Number.isFinite(hammer) ? hammer : 0;
  const safePremium = Number.isFinite(premium) ? premium : 0;
  const safeTotal = Number.isFinite(total) ? total : safeHammer + safePremium;
  const effectiveRate = safeHammer > 0 ? safePremium / safeHammer : 0;
  return {
    hammer: safeHammer,
    premium: safePremium,
    total: safeTotal,
    buyerPremiumRate: effectiveRate,
    premiumPercentLabel:
      checkoutPricing.kind === "tiered"
        ? "Tiered"
        : `${Math.min(100, Math.max(0, Math.round(effectiveRate * 100)))}%`,
  };
}

const toPence = (major: number) => Math.round(major * 100);

/**
 * What checkout shows once an invoice exists: its stored total, which is what Stripe charges.
 * The lot's pricing today is used only for the hammer line; the premium line is the rest of the
 * stored total, so the lines always add up to the charge even if premium rates have changed.
 */
export function buildInvoiceTotalsVm(
  checkoutPricing: NonNullable<Lot["checkoutPricing"]>,
  invoiceAmount: string | null,
): ReturnType<typeof buildCheckoutTotalsVm> {
  const live = buildCheckoutTotalsVm(checkoutPricing);
  const stored = invoiceAmount == null ? Number.NaN : Number.parseFloat(invoiceAmount);
  if (!Number.isFinite(stored)) return live;
  const totalPence = toPence(stored);
  const hammerPence = Math.min(toPence(live.hammer), totalPence);
  const premiumPence = totalPence - hammerPence;
  const rate = hammerPence > 0 ? premiumPence / hammerPence : 0;
  return {
    hammer: hammerPence / 100,
    premium: premiumPence / 100,
    total: totalPence / 100,
    buyerPremiumRate: rate,
    premiumPercentLabel:
      checkoutPricing.kind === "tiered"
        ? "Tiered"
        : `${Math.min(100, Math.max(0, Math.round(rate * 100)))}%`,
  };
}

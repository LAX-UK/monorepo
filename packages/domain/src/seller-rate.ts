/**
 * A rate in basis points as people read it: "15%", "12.5%", "20%", "0%". Exact, with no float
 * step and no trailing zeros, so the rate a seller reads is the rate their agreement records.
 */
export function ratePercentLabel(bps: number): string {
  if (!Number.isInteger(bps) || bps < 0) throw new RangeError("rate must be whole basis points");
  const whole = Math.floor(bps / 100);
  const hundredths = bps % 100;
  if (hundredths === 0) return `${whole}%`;
  return `${whole}.${String(hundredths).padStart(2, "0").replace(/0$/, "")}%`;
}

/**
 * The seller's commission as the agreement states it, from its stored rate ("15", "12.50"):
 * "15% of the hammer price, plus VAT". The same words on the agreement panel and its PDF.
 */
export function sellerCommissionTerm(commissionPercent: string): string {
  return `${String(Number.parseFloat(commissionPercent))}% of the hammer price, plus VAT`;
}

/** Said under a payout's lines and on its statement: how the seller's charges are worked out. */
export const SELLER_PAYOUT_NOTE =
  "Commission is charged on the hammer price at the rate in your signed agreement, plus VAT. The buyer's premium is paid to LAX and isn't part of your proceeds.";

/** Said in place of VAT when the company that charges the commission is not VAT-registered. */
export function notVatRegisteredLine(companyName: string): string {
  return `No VAT: ${companyName} is not VAT-registered`;
}

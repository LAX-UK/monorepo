import type { SellerHeldReason } from "@/lib/data/http/admin-seller-proceeds.shared";
import { legalEntityFor } from "@auction/branding";

/** The company that charges commission: its name comes from branding, never typed. */
export const BID_COMPANY_NAME = legalEntityFor("bid").name;

/** Why a sale's payout is held, as staff read it on every screen. */
export const HELD_REASON_LABEL: Readonly<Record<SellerHeldReason, string>> = {
  no_agreement: "No signed agreement",
  not_accepted: "The seller hasn't accepted the agreement yet",
  no_commission: "The agreement has no commission",
  other_seller: "The agreement is for another seller",
  vat_setting_missing: `VAT setting for ${BID_COMPANY_NAME} is missing`,
  negative_net: "Deductions are more than the hammer",
  legacy_invoice: "The buyer's invoice has no hammer line",
};

/** What fixes each held reason, as one sentence that says what to do. */
export const HELD_REASON_FIX: Readonly<Record<SellerHeldReason, string>> = {
  no_agreement:
    "Record the seller's signed consignment agreement so the commission can be worked out.",
  not_accepted:
    "Record the seller's signed copy of the agreement so the commission can be worked out.",
  no_commission:
    "Record the signed agreement with its commission so the commission can be worked out.",
  other_seller:
    "Record the agreement this lot's seller signed so the commission can be worked out.",
  vat_setting_missing:
    "Payouts are held until an Administrator sets whether the company charges VAT on commission, in Finance › Settings.",
  negative_net: "Check the commission on the signed agreement with an Administrator.",
  legacy_invoice: "Settle this sale by hand from the buyer's invoice.",
};

/** Reasons a recorded signed agreement fixes. */
const FIXED_BY_RECORDING: ReadonlySet<SellerHeldReason> = new Set([
  "no_agreement",
  "not_accepted",
  "no_commission",
  "other_seller",
]);

export function heldReasonFixedByRecording(reason: SellerHeldReason): boolean {
  return FIXED_BY_RECORDING.has(reason);
}

/** "Payout held: no signed agreement". */
export function heldTitle(reason: SellerHeldReason): string {
  const label = HELD_REASON_LABEL[reason];
  // Lower-case only the first word, and never a name ("VAT", the company).
  const lowered = /^(VAT|[A-Z]{2,})/.test(label)
    ? label
    : label.charAt(0).toLowerCase() + label.slice(1);
  return `Payout held: ${lowered}`;
}

/** "Lot 21", or the lot's title when it has no number yet. */
export function lotName(lot: { lotNumber: number | null; lotTitle: string | null }): string {
  if (lot.lotNumber !== null) return `Lot ${lot.lotNumber}`;
  return lot.lotTitle ?? "This lot";
}

/**
 * Why a document is parked: built and stored, but kept from the books until a person (or an
 * answer from the accountant) says how it goes. A parked document sits in "Needs a person" and is
 * never claimed, retried or tried again by hand. Once its reason is settled a person releases it
 * (`release`, checked against the stored rows by `resolveParked`); otherwise it can be cancelled.
 */
export const PARK_REASONS = [
  /** The courier delivery's VAT treatment waits for the accountant. */
  "vat_on_delivery",
  /** The invoice the payment is for was cancelled after it was paid. */
  "invoice_cancelled",
  /** Delivery outside the UK (a Shop delivery quote): its VAT waits for the accountant. */
  "vat_on_outside_uk_delivery",
] as const;
export type ParkReason = (typeof PARK_REASONS)[number];

/** Every parked document's stored reason starts with this. */
export const PARKED_REASON_PREFIX = "accounting_parked_";

/** The reason stored on a parked document, e.g. `accounting_parked_vat_on_delivery`. */
export function parkedReasonCode(reason: ParkReason): string {
  return `${PARKED_REASON_PREFIX}${reason}`;
}

/** The park reason behind a stored reason, or null when the document is not parked. */
export function parkReasonOf(reason: string | null | undefined): ParkReason | null {
  if (typeof reason !== "string" || !reason.startsWith(PARKED_REASON_PREFIX)) return null;
  const rest = reason.slice(PARKED_REASON_PREFIX.length);
  return (PARK_REASONS as readonly string[]).includes(rest) ? (rest as ParkReason) : null;
}

export function isParkedReason(reason: string | null | undefined): boolean {
  return parkReasonOf(reason) !== null;
}

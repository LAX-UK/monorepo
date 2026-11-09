import type { ShopStaffCapability } from "./staff-capabilities.js";

/** Quoting delivery and turning a request down need `order.write`; reading the tab needs `order.read`. */
export const DELIVERY_QUOTES_WRITE_CAPABILITY: ShopStaffCapability = "order.write";

export const QUOTE_PRICE_MAX_PENCE = 10_000_000;
export const QUOTE_CARRIER_MAX_LENGTH = 120;
export const QUOTE_SERVICE_MAX_LENGTH = 120;
export const QUOTE_LEAD_TIME_NOTE_MAX_LENGTH = 300;
export const QUOTE_DECLINE_NOTE_MAX_LENGTH = 500;

export type DeliveryQuoteInputField = "pricePence" | "carrier" | "service" | "leadTimeNote";

export type DeliveryQuoteInputIssue = {
  field: DeliveryQuoteInputField;
  reason: "not_whole_pence" | "below_one_penny" | "too_high" | "required" | "too_long";
};

export type DeliveryQuoteInput = {
  pricePence: number;
  carrier: string;
  service?: string | undefined;
  leadTimeNote?: string | undefined;
};

/**
 * What staff must give to send a quote: a price in whole pence the buyer pays for delivery with
 * insurance included, and the carrier. Service and a lead-time note are optional words for the
 * buyer's email.
 */
export function deliveryQuoteInputIssues(input: DeliveryQuoteInput): DeliveryQuoteInputIssue[] {
  const issues: DeliveryQuoteInputIssue[] = [];
  if (!Number.isInteger(input.pricePence))
    issues.push({ field: "pricePence", reason: "not_whole_pence" });
  else if (input.pricePence < 1) issues.push({ field: "pricePence", reason: "below_one_penny" });
  else if (input.pricePence > QUOTE_PRICE_MAX_PENCE) {
    issues.push({ field: "pricePence", reason: "too_high" });
  }
  const carrier = input.carrier.trim();
  if (carrier === "") issues.push({ field: "carrier", reason: "required" });
  else if (carrier.length > QUOTE_CARRIER_MAX_LENGTH) {
    issues.push({ field: "carrier", reason: "too_long" });
  }
  if ((input.service?.trim().length ?? 0) > QUOTE_SERVICE_MAX_LENGTH) {
    issues.push({ field: "service", reason: "too_long" });
  }
  if ((input.leadTimeNote?.trim().length ?? 0) > QUOTE_LEAD_TIME_NOTE_MAX_LENGTH) {
    issues.push({ field: "leadTimeNote", reason: "too_long" });
  }
  return issues;
}

/** The note staff leave when they turn a request down: the buyer is told why. */
export function declineNoteIssue(note: string): "required" | "too_long" | null {
  const trimmed = note.trim();
  if (trimmed === "") return "required";
  return trimmed.length > QUOTE_DECLINE_NOTE_MAX_LENGTH ? "too_long" : null;
}

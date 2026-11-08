import {
  type DeliveryRegion,
  type DeliveryRegionId,
  deliveryDestination,
  isIsoCountryCode,
} from "./delivery-regions.js";

/*
 * Delivery outside the UK, from the buyer's side: where a basket can go, what the address must
 * say, how long the print is held while the gallery quotes, and how a request ends. The quote's own
 * steps (requested, quoted, accepted, withdrawn) are the saleroom's state machine in
 * `@auction/domain`, which shop-api applies; this file holds only what is particular to the Shop.
 */

/** Working days a print is held for a delivery quote before the request lapses. */
export const QUOTE_HOLD_WORKING_DAYS = 3;

/** The date `days` working days (Monday to Friday) after `from`, keeping the time of day. */
export function addWorkingDays(from: Date, days: number): Date {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return date;
}

/**
 * How many delivery quote requests one buyer can have waiting at once. A request holds prints for
 * three working days, so without a cap one person could hold a whole run by asking again and again.
 */
export const MAX_OPEN_QUOTE_REQUESTS_PER_BUYER = 3;

/**
 * A guest's hold is shorter by default: a guest cannot be held to account the way a signed-in
 * buyer can, so a request costs the gallery less stock for less time. A setting, within 1 to 3.
 */
export const GUEST_QUOTE_HOLD_WORKING_DAYS_DEFAULT = 1;

/** Open requests one client IP can have across guests: a shared office is allowed a few. */
export const MAX_OPEN_QUOTE_REQUESTS_PER_GUEST_IP = 4;

/** Open requests one browser (its basket token) can have, whatever email it gives. */
export const MAX_OPEN_QUOTE_REQUESTS_PER_BASKET_TOKEN = 2;

/**
 * When a print held for a quote asked for at `now` is released if the quote is not paid, after
 * `workingDays` (three for a signed-in buyer).
 */
export function quoteHoldUntil(now: Date, workingDays: number = QUOTE_HOLD_WORKING_DAYS): Date {
  return addWorkingDays(now, workingDays);
}

/** Why a quote request ended without being paid; the buyer is told which. */
export const DELIVERY_QUOTE_END_REASONS = [
  "cancelled_by_buyer",
  "cannot_deliver",
  "expired",
] as const;
export type DeliveryQuoteEndReason = (typeof DELIVERY_QUOTE_END_REASONS)[number];

/** What checkout does with a destination country. */
export type OutsideUkAssessment =
  /** The UK: ordinary checkout, not this flow. */
  | { kind: "in_uk" }
  /** Staff quote the delivery; `regionId` is null for a country outside the four regions. */
  | { kind: "quote"; country: string; regionId: DeliveryRegionId | null }
  /** The region has a fixed rate: the buyer pays it with the order, no wait. */
  | { kind: "fixed"; country: string; regionId: DeliveryRegionId; pricePence: number }
  /** Export-restricted: not offered; collection is suggested instead. */
  | { kind: "refused"; country: string; reason: "export_restricted" };

export function assessOutsideUkDelivery(
  countryCode: string,
  regions: readonly DeliveryRegion[],
  restricted: readonly string[],
): OutsideUkAssessment {
  const country = countryCode.trim().toUpperCase();
  if (country === "GB") return { kind: "in_uk" };
  const destination = deliveryDestination(country, regions, restricted);
  if (destination.kind === "not_delivered") {
    return { kind: "refused", country, reason: "export_restricted" };
  }
  if (destination.kind === "quote_elsewhere") {
    return { kind: "quote", country, regionId: null };
  }
  const { region } = destination;
  if (region.fixedPricePence !== null) {
    return { kind: "fixed", country, regionId: region.id, pricePence: region.fixedPricePence };
  }
  return { kind: "quote", country, regionId: region.id };
}

export type OutsideUkAddress = {
  recipientName: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  postcode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  phone: string;
};

export type OutsideUkAddressField =
  | "recipientName"
  | "line1"
  | "city"
  | "postcode"
  | "country"
  | "phone";

export type OutsideUkAddressIssue = {
  field: OutsideUkAddressField;
  reason: "required" | "too_long" | "unknown_country" | "united_kingdom" | "invalid_phone";
};

const MAX_LENGTH: Record<OutsideUkAddressField, number> = {
  recipientName: 200,
  line1: 200,
  city: 120,
  postcode: 20,
  country: 2,
  phone: 30,
};

const PHONE_SHAPE = /^\+?[0-9][0-9 ()./-]{5,}$/;

/**
 * What an international address must have. Postal codes differ by country (some have none worth
 * checking), so the code is only required and bounded, never matched to a format. The phone is
 * required because a courier uses it to arrange delivery.
 */
export function outsideUkAddressIssues(address: OutsideUkAddress): OutsideUkAddressIssue[] {
  const issues: OutsideUkAddressIssue[] = [];
  const text: [OutsideUkAddressField, string][] = [
    ["recipientName", address.recipientName],
    ["line1", address.line1],
    ["city", address.city],
    ["postcode", address.postcode],
  ];
  for (const [field, value] of text) {
    const trimmed = value.trim();
    if (trimmed === "") issues.push({ field, reason: "required" });
    else if (trimmed.length > MAX_LENGTH[field]) issues.push({ field, reason: "too_long" });
  }
  const country = address.country.trim().toUpperCase();
  if (country === "") issues.push({ field: "country", reason: "required" });
  else if (country === "GB") issues.push({ field: "country", reason: "united_kingdom" });
  else if (!isIsoCountryCode(country)) issues.push({ field: "country", reason: "unknown_country" });
  const phone = address.phone.trim();
  if (phone === "") issues.push({ field: "phone", reason: "required" });
  else if (phone.length > MAX_LENGTH.phone || !PHONE_SHAPE.test(phone)) {
    issues.push({ field: "phone", reason: "invalid_phone" });
  }
  return issues;
}

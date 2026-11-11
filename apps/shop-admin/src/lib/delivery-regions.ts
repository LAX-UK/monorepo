import type { DeliveryCountry, DeliveryRegionView } from "@auction/shop-contracts";
import {
  type DeliveryRegionField,
  type DeliveryRegionId,
  type DeliveryRegionIssueReason,
  FIXED_PRICE_MAX_PENCE,
  LEAD_TIME_MAX_DAYS,
  type LeadTimeDays,
  type RestrictedCountryIssueReason,
  deliveryRegionIssues,
  formatLeadTime,
  restrictedCountryIssues,
} from "@auction/shop-domain";
import { formatPenceAsPounds, formatStaffNumber } from "@auction/staff-ui";

/*
 * LAX Admin › Settings › Delivery regions, in words. The rules are the domain's, run as staff type
 * and again by shop-api on save; this file only says them in plain sentences and lays out the rows.
 */

/** Who is in each region, said the way lax.bid/shipping says it. */
const REGION_NOTE: Record<DeliveryRegionId, string> = {
  uk: "All four nations",
  eu: "27 countries",
  north_america: "United States, Canada",
  asia_pacific: "14 countries",
};

export type RegionRowView = {
  id: DeliveryRegionId | "elsewhere";
  name: string;
  note: string;
  standard: string;
  specialist: string;
  price: string;
  /** Every region can be edited; "Everywhere else" is whatever is left, so it cannot. */
  editable: boolean;
};

/** How a region's price reads in the list: "£15.00 fixed", or "Quote" when staff quote it. */
export function regionPriceLabel(region: Pick<DeliveryRegionView, "fixedPricePence">): string {
  return region.fixedPricePence === null
    ? "Quote"
    : `${formatPenceAsPounds(region.fixedPricePence)} fixed`.replace(/^/, "£");
}

const span = (lead: LeadTimeDays) => formatLeadTime(lead);

export function regionRows(regions: readonly DeliveryRegionView[]): RegionRowView[] {
  return [
    ...regions.map(
      (region): RegionRowView => ({
        id: region.id,
        name: region.name,
        note: REGION_NOTE[region.id],
        standard: span(region.standard),
        specialist: span(region.specialist),
        price: regionPriceLabel(region),
        editable: true,
      }),
    ),
    {
      id: "elsewhere",
      name: "Everywhere else",
      note: "Countries not listed above",
      standard: "Not stated",
      specialist: "Not stated",
      price: "Quote",
      editable: false,
    },
  ];
}

/** "Belarus, Iran, North Korea, Russia, Syria", or the words for an empty list. */
export function notDeliveredToSentence(countries: readonly DeliveryCountry[]): string {
  return countries.length === 0
    ? "No countries. Every country can be quoted."
    : countries.map((country) => country.name).join(", ");
}

const REGION_MESSAGES: Record<DeliveryRegionIssueReason, string> = {
  not_a_whole_number: "Enter a whole number of working days",
  below_one: "Enter at least 1 working day",
  too_long: `Enter ${LEAD_TIME_MAX_DAYS} working days or fewer`,
  min_above_max: "The shortest time can't be longer than the longest",
  price_not_whole_pence: "Enter a price in pounds and pence",
  price_below_one_penny: "Enter a price of at least 1p",
  price_too_high: `Enter a price of ${`£${formatStaffNumber(FIXED_PRICE_MAX_PENCE / 100)}`} or less`,
  uk_price_is_set_in_checkout:
    "UK delivery is charged at its fixed price in checkout, so the price can't be changed here yet",
};

const COUNTRY_MESSAGES: Record<RestrictedCountryIssueReason, string> = {
  unknown_country: "Choose a country from the list",
  duplicate: "This country is in the list twice",
  united_kingdom: "The United Kingdom can't be on this list",
  too_many: "The list is too long",
};

export type RegionFormValues = {
  standardMin: string;
  standardMax: string;
  specialistMin: string;
  specialistMax: string;
  priceMode: "quote" | "fixed";
  /** Whole pence, or null while the field is empty or not an amount. */
  pricePence: number | null;
};

export type RegionBody = {
  standardMinDays: number;
  standardMaxDays: number;
  specialistMinDays: number;
  specialistMaxDays: number;
  fixedPricePence: number | null;
};

/** The form's starting values for a region. */
export function regionFormValues(region: DeliveryRegionView): RegionFormValues {
  return {
    standardMin: String(region.standard.minDays),
    standardMax: String(region.standard.maxDays),
    specialistMin: String(region.specialist.minDays),
    specialistMax: String(region.specialist.maxDays),
    priceMode: region.fixedPricePence === null ? "quote" : "fixed",
    pricePence: region.fixedPricePence,
  };
}

const EMPTY_DAYS = "Enter the number of working days";
const EMPTY_PRICE = "Enter the price in pounds";

/** A day count typed as text: whole digits, or NaN so the domain says why not. */
function days(text: string): number {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export type RegionFormCheck =
  | { ok: true; body: RegionBody }
  | { ok: false; errors: Partial<Record<DeliveryRegionField, string>> };

/**
 * Checks the form with the domain's rules, saying each problem against its field. Empty text is
 * its own sentence: "Enter the number of working days" reads better than "whole number".
 */
export function checkRegionForm(id: DeliveryRegionId, values: RegionFormValues): RegionFormCheck {
  const errors: Partial<Record<DeliveryRegionField, string>> = {};
  const fields: [DeliveryRegionField, string][] = [
    ["standardMinDays", values.standardMin],
    ["standardMaxDays", values.standardMax],
    ["specialistMinDays", values.specialistMin],
    ["specialistMaxDays", values.specialistMax],
  ];
  for (const [field, text] of fields) {
    if (text.trim() === "") errors[field] = EMPTY_DAYS;
  }
  if (values.priceMode === "fixed" && values.pricePence === null) {
    errors.fixedPricePence = EMPTY_PRICE;
  }
  const edit = {
    standard: { minDays: days(values.standardMin), maxDays: days(values.standardMax) },
    specialist: { minDays: days(values.specialistMin), maxDays: days(values.specialistMax) },
    fixedPricePence: values.priceMode === "fixed" ? values.pricePence : null,
  };
  for (const issue of deliveryRegionIssues({ id }, edit)) {
    if (!(issue.field in errors)) errors[issue.field] = REGION_MESSAGES[issue.reason];
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      standardMinDays: edit.standard.minDays,
      standardMaxDays: edit.standard.maxDays,
      specialistMinDays: edit.specialist.minDays,
      specialistMaxDays: edit.specialist.maxDays,
      fixedPricePence: edit.fixedPricePence,
    },
  };
}

/** The sentence for each field the server named when it refused a region. */
export function regionIssueMessages(
  issues: readonly { field: string; reason: string }[],
): Partial<Record<DeliveryRegionField, string>> {
  const messages: Partial<Record<DeliveryRegionField, string>> = {};
  for (const issue of issues) {
    const message = REGION_MESSAGES[issue.reason as DeliveryRegionIssueReason];
    if (message && !(issue.field in messages))
      messages[issue.field as DeliveryRegionField] = message;
  }
  return messages;
}

/** The sentence for the first country the list is refused over, or null when it is fine. */
export function checkRestrictedCountries(codes: readonly string[]): string | null {
  const [first] = restrictedCountryIssues(codes);
  return first ? COUNTRY_MESSAGES[first.reason] : null;
}

/** The field label and the id the error summary links to, per field. */
export const REGION_FIELD_LABELS: Record<DeliveryRegionField, string> = {
  standardMinDays: "Standard, shortest",
  standardMaxDays: "Standard, longest",
  specialistMinDays: "Specialist, shortest",
  specialistMaxDays: "Specialist, longest",
  fixedPricePence: "Price",
};

import { FULFILMENT_SURCHARGE_PENCE } from "./fulfilment-options.js";
import type { ShopStaffCapability } from "./staff-capabilities.js";

/**
 * Where LAX Shop delivers and how it is priced, as lax.bid/shipping tells it: four regions with a
 * guide to how long delivery takes, an optional fixed price per region (empty means "we quote"),
 * quoted delivery everywhere else, and a list of countries we do not deliver to, where collection
 * is offered instead. Times are working days after dispatch.
 */

/** Editing the regions needs the settings capability; reading them is open to every staff member. */
export const DELIVERY_REGIONS_EDIT_CAPABILITY: ShopStaffCapability = "settings.write";

export const DELIVERY_REGION_IDS = ["uk", "eu", "north_america", "asia_pacific"] as const;
export type DeliveryRegionId = (typeof DELIVERY_REGION_IDS)[number];

export function isDeliveryRegionId(value: string): value is DeliveryRegionId {
  return (DELIVERY_REGION_IDS as readonly string[]).includes(value);
}

/** A span of working days: "10 to 15". */
export type LeadTimeDays = { minDays: number; maxDays: number };

export type DeliveryRegion = {
  id: DeliveryRegionId;
  name: string;
  standard: LeadTimeDays;
  /** Specialist or white-glove handling takes longer. */
  specialist: LeadTimeDays;
  /** The price of delivery to the region in pence, tax-inclusive, or `null` when it is quoted. */
  fixedPricePence: number | null;
};

/** The longest lead time or price staff can enter, so a typo cannot publish nonsense. */
export const LEAD_TIME_MAX_DAYS = 120;
export const FIXED_PRICE_MAX_PENCE = 100_000_00;

/** lax.bid/shipping's lead times; the UK keeps the fixed price checkout charges today. */
export const DEFAULT_DELIVERY_REGIONS: readonly DeliveryRegion[] = [
  {
    id: "uk",
    name: "United Kingdom",
    standard: { minDays: 5, maxDays: 10 },
    specialist: { minDays: 10, maxDays: 20 },
    fixedPricePence: FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery,
  },
  {
    id: "eu",
    name: "European Union",
    standard: { minDays: 10, maxDays: 15 },
    specialist: { minDays: 15, maxDays: 25 },
    fixedPricePence: null,
  },
  {
    id: "north_america",
    name: "North America",
    standard: { minDays: 12, maxDays: 18 },
    specialist: { minDays: 18, maxDays: 30 },
    fixedPricePence: null,
  },
  {
    id: "asia_pacific",
    name: "Asia Pacific",
    standard: { minDays: 14, maxDays: 21 },
    specialist: { minDays: 21, maxDays: 35 },
    fixedPricePence: null,
  },
];

/** Countries by region, as ISO 3166-1 alpha-2 codes. Not editable: the region names say who is in. */
export const DELIVERY_REGION_COUNTRIES: Readonly<Record<DeliveryRegionId, readonly string[]>> = {
  uk: ["GB"],
  eu: [
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
  ],
  north_america: ["US", "CA"],
  asia_pacific: [
    "AU",
    "NZ",
    "JP",
    "KR",
    "CN",
    "HK",
    "TW",
    "SG",
    "MY",
    "TH",
    "VN",
    "ID",
    "PH",
    "IN",
  ],
};

/** The countries LAX Shop does not deliver to until staff change the list: the UK export restrictions. */
export const DEFAULT_EXPORT_RESTRICTED_COUNTRIES: readonly string[] = [
  "BY",
  "IR",
  "KP",
  "RU",
  "SY",
];

/** Every country the restricted list can name. */
export const ISO_COUNTRY_CODES: readonly string[] =
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(
    " ",
  );

const ISO_SET: ReadonlySet<string> = new Set(ISO_COUNTRY_CODES);

export function isIsoCountryCode(value: string): boolean {
  return ISO_SET.has(value);
}

/** How many countries the restricted list can hold; far more than any real list. */
export const RESTRICTED_COUNTRIES_MAX = 60;

/** Where an address in a country is delivered, by the rules staff set. */
export type DeliveryDestination =
  /** A region we deliver to, at its fixed price when it has one, otherwise by quote. */
  | { kind: "region"; region: DeliveryRegion }
  /** Not in a region: delivered by quote, with no lead time stated. */
  | { kind: "quote_elsewhere" }
  /** Not delivered to; collection is offered instead. */
  | { kind: "not_delivered" };

export function deliveryDestination(
  countryCode: string,
  regions: readonly DeliveryRegion[],
  restricted: readonly string[],
): DeliveryDestination {
  const code = countryCode.trim().toUpperCase();
  if (restricted.includes(code)) return { kind: "not_delivered" };
  const id = DELIVERY_REGION_IDS.find((regionId) =>
    DELIVERY_REGION_COUNTRIES[regionId].includes(code),
  );
  const region = id ? regions.find((candidate) => candidate.id === id) : undefined;
  return region ? { kind: "region", region } : { kind: "quote_elsewhere" };
}

/** Whether delivery to the region is quoted rather than charged at a fixed price. */
export function isQuotedRegion(region: DeliveryRegion): boolean {
  return region.fixedPricePence === null;
}

export type DeliveryRegionField =
  | "standardMinDays"
  | "standardMaxDays"
  | "specialistMinDays"
  | "specialistMaxDays"
  | "fixedPricePence";

export type DeliveryRegionIssueReason =
  | "not_a_whole_number"
  | "below_one"
  | "too_long"
  | "min_above_max"
  | "price_not_whole_pence"
  | "price_below_one_penny"
  | "price_too_high"
  /** The UK is charged at checkout, which does not read this price yet. */
  | "uk_price_is_set_in_checkout";

export type DeliveryRegionIssue = { field: DeliveryRegionField; reason: DeliveryRegionIssueReason };

export type DeliveryRegionEdit = {
  standard: LeadTimeDays;
  specialist: LeadTimeDays;
  fixedPricePence: number | null;
};

function leadTimeIssues(
  span: LeadTimeDays,
  fields: { min: DeliveryRegionField; max: DeliveryRegionField },
): DeliveryRegionIssue[] {
  const issues: DeliveryRegionIssue[] = [];
  for (const [field, value] of [
    [fields.min, span.minDays],
    [fields.max, span.maxDays],
  ] as const) {
    if (!Number.isInteger(value)) issues.push({ field, reason: "not_a_whole_number" });
    else if (value < 1) issues.push({ field, reason: "below_one" });
    else if (value > LEAD_TIME_MAX_DAYS) issues.push({ field, reason: "too_long" });
  }
  const wholeAndInRange = issues.length === 0;
  if (wholeAndInRange && span.minDays > span.maxDays) {
    issues.push({ field: fields.min, reason: "min_above_max" });
  }
  return issues;
}

/**
 * Checks a region's new lead times and price. The rules are the same wherever they are asked:
 * LAX Admin as staff type, shop-api on save. The UK's price cannot change here yet: checkout
 * charges the UK at its fixed delivery price and does not read the regions, so a different
 * figure here would say one thing and charge another.
 */
export function deliveryRegionIssues(
  region: Pick<DeliveryRegion, "id">,
  edit: DeliveryRegionEdit,
): DeliveryRegionIssue[] {
  const issues = [
    ...leadTimeIssues(edit.standard, { min: "standardMinDays", max: "standardMaxDays" }),
    ...leadTimeIssues(edit.specialist, { min: "specialistMinDays", max: "specialistMaxDays" }),
  ];
  const price = edit.fixedPricePence;
  if (price !== null) {
    if (!Number.isInteger(price))
      issues.push({ field: "fixedPricePence", reason: "price_not_whole_pence" });
    else if (price < 1) issues.push({ field: "fixedPricePence", reason: "price_below_one_penny" });
    else if (price > FIXED_PRICE_MAX_PENCE) {
      issues.push({ field: "fixedPricePence", reason: "price_too_high" });
    }
  }
  if (region.id === "uk" && price !== FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery) {
    issues.push({ field: "fixedPricePence", reason: "uk_price_is_set_in_checkout" });
  }
  return issues;
}

export type RestrictedCountryIssueReason =
  | "unknown_country"
  | "duplicate"
  | "united_kingdom"
  | "too_many";

export type RestrictedCountryIssue = { code: string; reason: RestrictedCountryIssueReason };

/** Checks the list of countries we do not deliver to. The United Kingdom cannot be on it. */
export function restrictedCountryIssues(codes: readonly string[]): RestrictedCountryIssue[] {
  const issues: RestrictedCountryIssue[] = [];
  const seen = new Set<string>();
  for (const code of codes) {
    if (!isIsoCountryCode(code)) issues.push({ code, reason: "unknown_country" });
    else if (code === "GB") issues.push({ code, reason: "united_kingdom" });
    else if (seen.has(code)) issues.push({ code, reason: "duplicate" });
    seen.add(code);
  }
  if (codes.length > RESTRICTED_COUNTRIES_MAX) {
    issues.push({ code: codes[RESTRICTED_COUNTRIES_MAX] ?? "", reason: "too_many" });
  }
  return issues;
}

/** "5 to 10", the way the delivery page and LAX Admin say a span of working days. */
export function formatLeadTime(span: LeadTimeDays): string {
  return span.minDays === span.maxDays
    ? String(span.minDays)
    : `${span.minDays} to ${span.maxDays}`;
}

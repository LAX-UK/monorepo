import { createHash } from "node:crypto";
import type { AtgLotSnapshot, AtgSaleSnapshot, AtgSyncConfig } from "./atg-types.js";
import { toGapDate } from "./gap-date.js";
import type { GapAuctionFields, GapLotFields } from "./gap-types.js";
import { toWindowsTimezoneId } from "./windows-timezone.js";

const TITLE_MAX = 100;
const AUCTION_TITLE_MAX = 250;
const LONG_DESCRIPTION_MAX = 8000;
const LOT_NUMBER_MAX = 20;
const ADDRESS_MAX = 50;
const POSTCODE_MAX = 20;
const COUNTRY_MAX = 30;

/** A lot that cannot be represented on ATG until it is fixed in LAX. */
export class AtgMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtgMappingError";
  }
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function optionalClip(value: string | null, max: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function money(value: string | null | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** LAX stores premium as a fraction (`0.2500`); GAP expects a percentage (`25`). */
function percent(rate: string): number | undefined {
  const n = Number(rate);
  return Number.isFinite(n) ? Math.round(n * 10_000) / 100 : undefined;
}

function isTimed(sale: Pick<AtgSaleSnapshot, "atgSettings">): boolean {
  return sale.atgSettings.auctionType === "Timed";
}

/** ATG takes one flat buyer's premium per auction. */
export function assertSaleMappableForAtg(sale: AtgSaleSnapshot): void {
  if (sale.buyerPremiumTiers && sale.buyerPremiumTiers.length > 0) {
    throw new AtgMappingError("ATG needs a single flat buyer's premium; remove the bands.");
  }
}

export function mapSaleToAuctionFields(
  sale: AtgSaleSnapshot,
  config: AtgSyncConfig,
): GapAuctionFields {
  assertSaleMappableForAtg(sale);
  const fields: GapAuctionFields = {
    Title: clip(sale.title.trim(), AUCTION_TITLE_MAX),
    AuctionListings: [
      {
        PlatformCode: config.platformCode,
        AuctionTypeAndListing: sale.atgSettings.auctionType,
        CategoryName: config.defaultCategory,
        Private: sale.atgSettings.distribution !== "public_marketplace",
      },
    ],
    TimezoneId: toWindowsTimezoneId(config.timezone),
    Currency: config.currency,
    CountryCode: config.countryCode,
    IncrementSetId: config.incrementSetId,
    ClientsAuctionId: sale.id,
    SaleDates: [{ Starts: toGapDate(sale.startTime), Ends: toGapDate(sale.endTime) }],
  };
  if (config.clientId) fields.ClientId = config.clientId;
  const premium = percent(sale.buyerPremiumRate);
  if (premium !== undefined) fields.BuyersPremium = premium;
  if (isTimed(sale)) {
    fields.TimedStart = toGapDate(sale.startTime);
    fields.TimedFirstLotEnds = toGapDate(sale.endTime);
  }
  const address1 = optionalClip(sale.locationAddressLine1, ADDRESS_MAX);
  if (address1) fields.Address1 = address1;
  const address2 = optionalClip(sale.locationAddressLine2, ADDRESS_MAX);
  if (address2) fields.Address2 = address2;
  const town = optionalClip(sale.locationCity, ADDRESS_MAX);
  if (town) fields.TownCity = town;
  const postcode = optionalClip(sale.locationPostcode, POSTCODE_MAX);
  if (postcode) fields.Postcode = postcode;
  const country = optionalClip(sale.locationCountry, COUNTRY_MAX);
  if (country) fields.Country = country;
  const info = sale.description?.trim();
  if (info) fields.ImportantInformation = info;
  const terms = sale.terms?.trim();
  if (terms) fields.Terms = terms;
  return fields;
}

function lotEstimate(
  lot: AtgLotSnapshot,
  currency: string,
): { low: number; high: number } | undefined {
  const raw = lot.marketingDetails.estimate;
  if (!raw || typeof raw !== "object") return undefined;
  const { low, high, currency: estimateCurrency } = raw as Record<string, unknown>;
  if (typeof estimateCurrency === "string" && estimateCurrency && estimateCurrency !== currency) {
    return undefined;
  }
  const lowN = money(typeof low === "string" ? low : undefined);
  const highN = money(typeof high === "string" ? high : undefined);
  return lowN !== undefined && highN !== undefined && highN >= lowN
    ? { low: lowN, high: highN }
    : undefined;
}

function lotTitle(lot: AtgLotSnapshot, config: AtgSyncConfig): string {
  const title = lot.title.trim();
  const artist = lot.artistName?.trim();
  const full = config.artistPlacement === "title_prefix" && artist ? `${artist} - ${title}` : title;
  return clip(full, TITLE_MAX);
}

function lotLongDescription(lot: AtgLotSnapshot, config: AtgSyncConfig): string {
  const artist = lot.artistName?.trim();
  const lines = [
    config.artistPlacement === "description" && artist ? artist : null,
    lot.title.trim(),
    lot.medium?.trim() || null,
    lot.dimensions?.trim() || null,
  ].filter((line): line is string => Boolean(line));
  const body = lot.description?.trim();
  const text = body ? `${lines.join("\n")}\n\n${body}` : lines.join("\n");
  return clip(text, LONG_DESCRIPTION_MAX);
}

/** `AuctionId` is filled in by the sync service once the auction exists. */
export function mapLotToLotFields(
  lot: AtgLotSnapshot,
  sale: Pick<AtgSaleSnapshot, "buyerPremiumRate" | "atgSettings">,
  sequence: number,
  config: AtgSyncConfig,
): Omit<GapLotFields, "AuctionId"> {
  if (percent(lot.buyerPremiumRate) !== percent(sale.buyerPremiumRate)) {
    throw new AtgMappingError(
      "ATG takes one buyer's premium per auction; set this lot's rate to the sale's rate",
    );
  }
  if (lot.lotNumber == null) {
    throw new AtgMappingError("Lot number is required before the lot can be sent to ATG");
  }
  const lotNumber = String(lot.lotNumber);
  if (lotNumber.length > LOT_NUMBER_MAX) {
    throw new AtgMappingError(`Lot number exceeds ${LOT_NUMBER_MAX} characters`);
  }
  const fields: Omit<GapLotFields, "AuctionId"> = {
    LotNumber: lotNumber,
    Title: lotTitle(lot, config),
    LongDescription: lotLongDescription(lot, config),
    CategoryName: config.defaultCategory,
    Quantity: 1,
    SequenceNumber: sequence,
  };
  const estimate = lotEstimate(lot, config.currency);
  if (estimate) {
    fields.LowEstimate = estimate.low;
    fields.HighEstimate = estimate.high;
  }
  const opening = money(lot.startingPrice);
  if (opening !== undefined) fields.OpeningPrice = opening;
  const reserve = money(lot.reservePrice);
  if (reserve !== undefined) fields.Reserve = reserve;
  const buyNow = money(lot.buyNowPrice);
  if (buyNow !== undefined) fields.BuyItNowPrice = buyNow;
  if (isTimed(sale)) fields.EndTimeUtc = toGapDate(lot.endTime);
  return fields;
}

/** Lot fields ATG refuses to change once the lot has a bid. */
const BID_LOCKED_LOT_FIELDS = [
  "LongDescription",
  "Reserve",
  "LowEstimate",
  "HighEstimate",
  "OpeningPrice",
] as const satisfies readonly (keyof GapLotFields)[];

/** Hash of the bid-locked fields only, to tell locked edits from safe ones after bidding. */
export function bidLockedFieldsHash(fields: Partial<GapLotFields>): string {
  return payloadHash(Object.fromEntries(BID_LOCKED_LOT_FIELDS.map((key) => [key, fields[key]])));
}

/** Stored values are either absolute URLs or storage keys under the public media origin. */
export function resolveLotImageUrls(lot: AtgLotSnapshot, config: AtgSyncConfig): string[] {
  const base = config.mediaBaseUrl.replace(/\/+$/, "");
  return lot.images
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, config.maxImagesPerLot)
    .map((value) =>
      /^https?:\/\//i.test(value)
        ? value
        : `${base}/${value.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`,
    );
}

/** GAP orders images by name: `1` is primary, then `1-1`, `1-2`, … */
export function gapImageName(index: number): string {
  return index === 0 ? "1" : `1-${index}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Order-independent hash of a mapped payload, used to skip unchanged updates. */
export function payloadHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

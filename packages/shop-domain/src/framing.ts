import type { ShopStaffCapability } from "./staff-capabilities.js";

/**
 * The framing catalogue: ready-made framing options (a frame, a mount and glazing) that LAX Shop
 * offers on editions. Each option has a price per size band, including VAT, and a lead time in
 * working days. Staff keep the catalogue in LAX Admin; each edition chooses which options to offer.
 */

/** Changing the catalogue changes what editions can offer, so it needs catalogue edit rights. */
export const FRAMING_EDIT_CAPABILITY: ShopStaffCapability = "catalogue.write";
/** Reading the catalogue needs no more than opening the catalogue. */
export const FRAMING_READ_CAPABILITY: ShopStaffCapability = "catalogue.read";

export type FramingSizeBand = {
  code: string;
  /** The shorter side a sheet may have, in centimetres. */
  shortSideCm: number;
  /** The longer side a sheet may have, in centimetres. */
  longSideCm: number;
};

/** Sheet sizes with a fixed price. Larger sheets are quoted. */
export const FRAMING_SIZE_BANDS = [
  { code: "up_to_40x50", shortSideCm: 40, longSideCm: 50 },
  { code: "up_to_60x80", shortSideCm: 60, longSideCm: 80 },
  { code: "up_to_80x100", shortSideCm: 80, longSideCm: 100 },
] as const satisfies readonly FramingSizeBand[];

export type FramingBandCode = (typeof FRAMING_SIZE_BANDS)[number]["code"];

export const FRAMING_BAND_CODES = FRAMING_SIZE_BANDS.map((band) => band.code) as [
  FramingBandCode,
  ...FramingBandCode[],
];

/** "Up to 60 × 80 cm", as the bands are named on screen. */
export function framingBandLabel(code: FramingBandCode): string {
  const band = FRAMING_SIZE_BANDS.find((candidate) => candidate.code === code);
  if (!band) return code;
  return `Up to ${band.shortSideCm} × ${band.longSideCm} cm`;
}

/**
 * The smallest band a sheet fits, whichever way round it is measured; null when it is larger than
 * every band, which means framing is quoted.
 */
export function framingBandForSheet(widthCm: number, heightCm: number): FramingBandCode | null {
  if (!(widthCm > 0) || !(heightCm > 0)) return null;
  const short = Math.min(widthCm, heightCm);
  const long = Math.max(widthCm, heightCm);
  const band = FRAMING_SIZE_BANDS.find((b) => short <= b.shortSideCm && long <= b.longSideCm);
  return band?.code ?? null;
}

export const FRAMING_FRAMES = ["black_wood", "white_wood", "natural_oak"] as const;
export type FramingFrame = (typeof FRAMING_FRAMES)[number];

export const FRAMING_MOUNTS = ["window_conservation", "float_conservation"] as const;
export type FramingMount = (typeof FRAMING_MOUNTS)[number];

/** Glass is not offered online: it is not safe to post. */
export const FRAMING_GLAZINGS = ["uv_acrylic"] as const;
export type FramingGlazing = (typeof FRAMING_GLAZINGS)[number];

export const FRAMING_HANGINGS = ["d_rings_cord"] as const;
export type FramingHanging = (typeof FRAMING_HANGINGS)[number];

export const FRAMING_FRAME_LABELS: Record<FramingFrame, string> = {
  black_wood: "Black wood",
  white_wood: "White wood",
  natural_oak: "Natural oak, 20 mm",
};

export const FRAMING_MOUNT_LABELS: Record<FramingMount, string> = {
  window_conservation: "Window mount, white conservation board",
  float_conservation: "Float mount, paper edge visible, raised on board",
};

export const FRAMING_GLAZING_LABELS: Record<FramingGlazing, string> = {
  uv_acrylic: "UV-filtering acrylic",
};

export const FRAMING_HANGING_LABELS: Record<FramingHanging, string> = {
  d_rings_cord: "D-rings and cord",
};

/** An option is a draft until staff first offer it, then active or paused. */
export const FRAMING_STATUSES = ["draft", "active", "paused"] as const;
export type FramingStatus = (typeof FRAMING_STATUSES)[number];

export const FRAMING_NAME_MAX_LENGTH = 80;
export const FRAMING_LEAD_TIME_MAX_DAYS = 90;
/** £10,000 including VAT; a framing price above it is a slip of the keyboard. */
export const FRAMING_PRICE_MAX_PENCE = 1_000_000;

export type FramingPrices = Record<FramingBandCode, number>;

/** What staff enter for one option. */
export type FramingOptionInput = {
  name: string;
  frame: FramingFrame;
  mount: FramingMount;
  glazing: FramingGlazing;
  hanging: FramingHanging;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  /** Pence including VAT per band; a band without a price is null. */
  pricesPence: Record<FramingBandCode, number | null>;
};

export type FramingField =
  | "name"
  | "leadTimeMinDays"
  | "leadTimeMaxDays"
  | `price:${FramingBandCode}`;

export type FramingIssueReason =
  | "name_required"
  | "name_too_long"
  | "lead_time_min_invalid"
  | "lead_time_max_invalid"
  | "lead_time_order"
  | "price_missing"
  | "price_invalid"
  /** The band's price is still the launch placeholder, so the option cannot be offered. */
  | "placeholder_price";

export type FramingIssue = { field: FramingField; reason: FramingIssueReason };

const isWholeNumber = (value: number | null): value is number =>
  value !== null && Number.isInteger(value);

/** Everything wrong with an option, in the order the fields appear on screen; empty when it is fine. */
export function framingOptionIssues(input: FramingOptionInput): FramingIssue[] {
  const issues: FramingIssue[] = [];
  const name = input.name.trim();
  if (name.length === 0) issues.push({ field: "name", reason: "name_required" });
  else if (name.length > FRAMING_NAME_MAX_LENGTH) {
    issues.push({ field: "name", reason: "name_too_long" });
  }

  const { leadTimeMinDays: min, leadTimeMaxDays: max } = input;
  const minOk = isWholeNumber(min) && min >= 1 && min <= FRAMING_LEAD_TIME_MAX_DAYS;
  const maxOk = isWholeNumber(max) && max >= 1 && max <= FRAMING_LEAD_TIME_MAX_DAYS;
  if (!minOk) issues.push({ field: "leadTimeMinDays", reason: "lead_time_min_invalid" });
  if (!maxOk) issues.push({ field: "leadTimeMaxDays", reason: "lead_time_max_invalid" });
  if (minOk && maxOk && max < min) {
    issues.push({ field: "leadTimeMaxDays", reason: "lead_time_order" });
  }

  for (const band of FRAMING_BAND_CODES) {
    const price = input.pricesPence[band];
    if (price === null) issues.push({ field: `price:${band}`, reason: "price_missing" });
    else if (!Number.isInteger(price) || price < 1 || price > FRAMING_PRICE_MAX_PENCE) {
      issues.push({ field: `price:${band}`, reason: "price_invalid" });
    }
  }
  return issues;
}

/** "10 to 15 working days", or "10 working days" when both ends are the same. */
export function framingLeadTimeLabel(minDays: number, maxDays: number): string {
  return minDays === maxDays ? `${minDays} working days` : `${minDays} to ${maxDays} working days`;
}

/** The price in each band, and whether it is still the launch placeholder. */
export type FramingBandPrices = Record<
  FramingBandCode,
  { pricePence: number; placeholder: boolean }
>;

/**
 * Which bands are still placeholders after a save. A band stays a placeholder only while its
 * price is unchanged and staff have not confirmed it as right: entering a price, or confirming
 * the seeded one, makes that band real. Other bands are not affected.
 */
export function nextPlaceholderBands(
  previous: FramingBandPrices,
  next: FramingPrices,
  confirmed: readonly FramingBandCode[],
): FramingBandCode[] {
  return FRAMING_BAND_CODES.filter(
    (band) =>
      previous[band].placeholder &&
      previous[band].pricePence === next[band] &&
      !confirmed.includes(band),
  );
}

/** The bands whose seeded price is still waiting for the framer's real one. */
export function placeholderBandsOf(prices: FramingBandPrices): FramingBandCode[] {
  return FRAMING_BAND_CODES.filter((band) => prices[band].placeholder);
}

/**
 * Everything wrong with saving an option. Offering while any band's price is a placeholder is
 * refused, band by band, so a seeded option cannot reach shoppers before every price is the
 * framer's.
 */
export function framingSaveIssues(
  input: FramingOptionInput,
  save: { offered: boolean; placeholderBands: readonly FramingBandCode[] },
): FramingIssue[] {
  const issues = framingOptionIssues(input);
  if (!save.offered) return issues;
  for (const band of save.placeholderBands) {
    const field = `price:${band}` as const;
    if (!issues.some((issue) => issue.field === field)) {
      issues.push({ field, reason: "placeholder_price" });
    }
  }
  return issues;
}

/** A short stable code for an option, from its name: "Natural oak, float mount" is "natural-oak-float-mount". */
export function framingCodeFromName(name: string): string {
  const code = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return code || "framing-option";
}

/**
 * The status after a save: offered means active; not offered keeps a draft a draft and pauses
 * anything that was active or already paused.
 */
export function nextFramingStatus(current: FramingStatus | null, offered: boolean): FramingStatus {
  if (offered) return "active";
  return current === null || current === "draft" ? "draft" : "paused";
}

/** The launch options. Their prices are placeholders until the framer's arrive. */
export type FramingLaunchOption = {
  code: string;
  name: string;
  frame: FramingFrame;
  mount: FramingMount;
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
  pricesPence: FramingPrices;
};

export const FRAMING_LAUNCH_OPTIONS: readonly FramingLaunchOption[] = [
  {
    code: "black-wood",
    name: "Black wood frame",
    frame: "black_wood",
    mount: "window_conservation",
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    pricesPence: { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 },
  },
  {
    code: "white-wood",
    name: "White wood frame",
    frame: "white_wood",
    mount: "window_conservation",
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    pricesPence: { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 },
  },
  {
    code: "natural-oak",
    name: "Natural oak frame",
    frame: "natural_oak",
    mount: "window_conservation",
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    pricesPence: { up_to_40x50: 14000, up_to_60x80: 22500, up_to_80x100: 29500 },
  },
  {
    code: "natural-oak-float",
    name: "Natural oak, float mount",
    frame: "natural_oak",
    mount: "float_conservation",
    leadTimeMinDays: 15,
    leadTimeMaxDays: 20,
    pricesPence: { up_to_40x50: 16500, up_to_60x80: 26000, up_to_80x100: 34000 },
  },
];
